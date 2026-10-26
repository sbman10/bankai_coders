
import { EmbeddingBoundaryError, isValidGteSmallVector } from "./embeddings";

export type ProcessingWarningCode =
  | "text_incomplete_or_ocr_required"
  | "text_not_found"
  | "embedding_unavailable"
  | "embedding_invalid_output"
  | "embedding_input_invalid"
  | "index_write_failed"
  | "index_publish_failed"
  | "processing_failed";

export type ProcessingJob = {
  id: string;
  documentId: string;
  targetIndexVersion: number;
  attempt: number;
  maxAttempts: number;
};

export type WorkerChunk = {
  page_number: number;
  section_path: string | null;
  chunk_index: number;
  content: string;
  content_hash: string;
  extraction_confidence: number | null;
};

export type PreparedIndex = {
  complete: boolean;
  warningCode?: ProcessingWarningCode;
  chunks: WorkerChunk[];
};

export type StagedChunk = WorkerChunk & {
  embedding: number[];
  embedding_provider: "supabase_edge_runtime";
  embedding_model_alias: "gte-small";
  embedding_model_repository: "Supabase/gte-small";
  embedding_model_revision: null;
  embedding_dimension: 384;
  embedding_pooling: "mean";
  embedding_normalized: true;
  index_version: number;
};

export type ProcessingWorkerDependencies = {
  claim(jobId: string): Promise<
    | { kind: "claimed"; job: ProcessingJob }
    | { kind: "not_claimed"; reason: "terminal" | "busy" | "not_due" }
  >;
  extractAndChunk(job: ProcessingJob): Promise<PreparedIndex>;
  embedChunks(texts: string[]): Promise<number[][]>;
  stageIndex(job: ProcessingJob, chunks: StagedChunk[]): Promise<void>;
  publishIndex(job: ProcessingJob): Promise<void>;
  markNeedsReview(job: ProcessingJob, warningCode: ProcessingWarningCode): Promise<void>;
  markRetry(job: ProcessingJob, warningCode: ProcessingWarningCode): Promise<void>;
};

export type ProcessingWorkerResult =
  | { status: "duplicate" }
  | { status: "deferred" }
  | { status: "needs_review"; warningCode: ProcessingWarningCode }
  | { status: "retry_wait"; warningCode: ProcessingWarningCode }
  | { status: "succeeded" };

export function createDocumentProcessingHandler(dependencies: ProcessingWorkerDependencies) {
  return async function handleDocumentJob(jobId: string): Promise<ProcessingWorkerResult> {
    const claim = await dependencies.claim(jobId);
    if (claim.kind !== "claimed") {
      return claim.reason === "terminal" ? { status: "duplicate" } : { status: "deferred" };
    }

    const { job } = claim;
    const handleFailure = async (error: unknown): Promise<ProcessingWorkerResult> => {
      const warningCode = error instanceof ProcessingError
        ? error.warningCode
        : error instanceof EmbeddingBoundaryError
          ? error.code
          : "processing_failed";
      if (job.attempt >= job.maxAttempts) {
        await dependencies.markNeedsReview(job, warningCode);
        return { status: "needs_review", warningCode };
      }
      await dependencies.markRetry(job, warningCode);
      return { status: "retry_wait", warningCode };
    };

    let prepared: PreparedIndex;
    try {
      prepared = await dependencies.extractAndChunk(job);
    } catch (error) {
      return handleFailure(error);
    }
    if (!prepared.complete) {
      const warningCode = prepared.warningCode ?? "text_incomplete_or_ocr_required";
      await dependencies.markNeedsReview(job, warningCode);
      return { status: "needs_review", warningCode };
    }
    if (prepared.chunks.length === 0) {
      await dependencies.markNeedsReview(job, "text_not_found");
      return { status: "needs_review", warningCode: "text_not_found" };
    }

    try {
      const embeddings = await dependencies.embedChunks(prepared.chunks.map((chunk) => chunk.content));
      if (embeddings.length !== prepared.chunks.length || embeddings.some((vector) => !isValidGteSmallVector(vector))) {
        throw new ProcessingError("embedding_invalid_output");
      }

      const stagedChunks: StagedChunk[] = prepared.chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
        embedding_provider: "supabase_edge_runtime",
        embedding_model_alias: "gte-small",
        embedding_model_repository: "Supabase/gte-small",
        embedding_model_revision: null,
        embedding_dimension: 384,
        embedding_pooling: "mean",
        embedding_normalized: true,
        index_version: job.targetIndexVersion,
      }));

      await dependencies.stageIndex(job, stagedChunks);
      await dependencies.publishIndex(job);
      return { status: "succeeded" };
    } catch (error) {
      return handleFailure(error);
    }
  };
}


export type QueueMessage = { id: string; body: unknown };
export const MAX_WORKER_BATCH_SIZE = 10;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createQueueMessageConsumer(
  readMessages: (limit: number) => Promise<QueueMessage[]>,
  acknowledge: (messageId: string) => Promise<void>,
  handleJob: (jobId: string) => Promise<ProcessingWorkerResult>,
) {
  return async function consumeBatch(limit = MAX_WORKER_BATCH_SIZE): Promise<number> {
    const batchLimit = boundedBatch(limit);
    const messages = await readMessages(batchLimit);
    let acknowledged = 0;
    for (const message of messages) {
      const jobId = message.body && typeof message.body === "object" &&
        "jobId" in message.body && typeof message.body.jobId === "string" && uuid.test(message.body.jobId)
        ? message.body.jobId
        : null;
      if (!jobId) {
        await acknowledge(message.id);
        acknowledged += 1;
        continue;
      }
      const result = await handleJob(jobId);
      if (result.status === "deferred") continue;
      await acknowledge(message.id);
      acknowledged += 1;
    }
    return acknowledged;
  };
}

export type OutboxJob = { outboxId: string; jobId: string };

export type ScheduledWorkerDependencies = {
  claimDueOutbox(limit: number): Promise<OutboxJob[]>;
  sendQueueMessage(jobId: string): Promise<void>;
  markDispatched(outboxId: string): Promise<void>;
  markDispatchRetry(outboxId: string): Promise<void>;
  readMessages(limit: number): Promise<QueueMessage[]>;
  acknowledge(messageId: string): Promise<void>;
  handleJob(jobId: string): Promise<ProcessingWorkerResult>;
};

export function createScheduledDocumentWorker(dependencies: ScheduledWorkerDependencies) {
  return async function runScheduledBatch(requestedLimit = MAX_WORKER_BATCH_SIZE) {
    const limit = boundedBatch(requestedLimit);
    const outboxJobs = await dependencies.claimDueOutbox(limit);
    let dispatched = 0;
    let dispatchFailed = 0;

    for (const outboxJob of outboxJobs) {
      try {
        await dependencies.sendQueueMessage(outboxJob.jobId);
        await dependencies.markDispatched(outboxJob.outboxId);
        dispatched += 1;
      } catch {
        await dependencies.markDispatchRetry(outboxJob.outboxId);
        dispatchFailed += 1;
      }
    }

    const acknowledged = await createQueueMessageConsumer(
      dependencies.readMessages,
      dependencies.acknowledge,
      dependencies.handleJob,
    )(limit);

    return { dispatched, dispatchFailed, acknowledged };
  };
}

function boundedBatch(value: number): number {
  if (!Number.isFinite(value)) return MAX_WORKER_BATCH_SIZE;
  return Math.min(MAX_WORKER_BATCH_SIZE, Math.max(1, Math.floor(value)));
}

export class ProcessingError extends Error {
  constructor(readonly warningCode: ProcessingWarningCode) {
    super(warningCode);
    this.name = "ProcessingError";
  }
}
