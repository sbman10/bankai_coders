import { describe, expect, it, vi } from "vitest";
import { createDocumentProcessingHandler, createQueueMessageConsumer, createScheduledDocumentWorker, MAX_WORKER_BATCH_SIZE } from "../../../../../supabase/functions/_shared/document-processing-worker";

const jobId = "26f5c2b8-6c84-43eb-98f3-95c770f7b2c9";

describe("document processing worker", () => {
  it("does not publish a partial index and treats its redelivery as a duplicate", async () => {
    let activeIndexVersion = 4;
    let terminal = false;
    const publishIndex = vi.fn(async () => {
      activeIndexVersion = 5;
    });
    const handler = createDocumentProcessingHandler({
      claim: vi.fn(async () => {
        if (terminal) return { kind: "not_claimed" as const, reason: "terminal" as const };
        return {
          kind: "claimed" as const,
          job: { id: jobId, documentId: "document-1", targetIndexVersion: 5, attempt: 1, maxAttempts: 3 },
        };
      }),
      extractAndChunk: vi.fn(async () => ({
        complete: false,
        warningCode: "text_incomplete_or_ocr_required" as const,
        chunks: [{ page_number: 1, section_path: "Coverage", chunk_index: 0, content: "partial synthetic clause", content_hash: "synthetic-hash", extraction_confidence: null }],
      })),
      embedChunks: vi.fn(),
      stageIndex: vi.fn(),
      publishIndex,
      markNeedsReview: vi.fn(async () => {
        terminal = true;
      }),
      markRetry: vi.fn(),
    });

    const firstDelivery = await handler(jobId);
    const duplicateDelivery = await handler(jobId);

    expect(firstDelivery).toEqual({ status: "needs_review", warningCode: "text_incomplete_or_ocr_required" });
    expect(duplicateDelivery).toEqual({ status: "duplicate" });
    expect(publishIndex).not.toHaveBeenCalled();
    expect(activeIndexVersion).toBe(4);
  });

  it("acknowledges a queue message only after durable job handling returns", async () => {
    const acknowledgements: string[] = [];
    const handleJob = vi.fn(async () => ({ status: "retry_wait" as const, warningCode: "embedding_unavailable" as const }));
    const consume = createQueueMessageConsumer(
      async () => [{ id: "message-1", body: { jobId } }],
      async (messageId) => { acknowledgements.push(messageId); },
      handleJob,
    );

    const count = await consume();

    expect(handleJob).toHaveBeenCalledWith(jobId);
    expect(acknowledgements).toEqual(["message-1"]);
    expect(count).toBe(1);
  });

  it("retries outbox dispatch failures and bounds scheduled queue work", async () => {
    const markDispatchRetry = vi.fn();
    const readMessages = vi.fn(async () => []);
    const worker = createScheduledDocumentWorker({
      claimDueOutbox: vi.fn(async (limit) => {
        expect(limit).toBe(MAX_WORKER_BATCH_SIZE);
        return [{ outboxId: "outbox-1", jobId }];
      }),
      sendQueueMessage: vi.fn(async () => { throw new Error("synthetic queue failure"); }),
      markDispatched: vi.fn(),
      markDispatchRetry,
      readMessages,
      acknowledge: vi.fn(),
      handleJob: vi.fn(),
    });

    const result = await worker(500);

    expect(result).toEqual({ dispatched: 0, dispatchFailed: 1, acknowledged: 0 });
    expect(markDispatchRetry).toHaveBeenCalledWith("outbox-1");
    expect(readMessages).toHaveBeenCalledWith(MAX_WORKER_BATCH_SIZE);
  });

  it("keeps a busy job message unacknowledged for visibility-timeout redelivery", async () => {
    const acknowledge = vi.fn();
    const consume = createQueueMessageConsumer(
      async () => [{ id: "message-busy", body: { jobId } }],
      acknowledge,
      async () => ({ status: "deferred" }),
    );

    const count = await consume();

    expect(count).toBe(0);
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("stages all vectors under the target version before publishing it", async () => {
    let activeIndexVersion = 3;
    const staged: Array<{ index_version: number; embedding: number[] }> = [];
    const handler = createDocumentProcessingHandler({
      claim: async () => ({ kind: "claimed", job: { id: jobId, documentId: "document-1", targetIndexVersion: 4, attempt: 1, maxAttempts: 3 } }),
      extractAndChunk: async () => ({ complete: true, chunks: [
        { page_number: 2, section_path: "Coverage", chunk_index: 0, content: "synthetic clause", content_hash: "hash", extraction_confidence: null },
      ] }),
      embedChunks: async () => [Array.from({ length: 384 }, () => 0.25)],
      stageIndex: async (_job, rows) => { staged.push(...rows); },
      publishIndex: async (job) => { activeIndexVersion = job.targetIndexVersion; },
      markNeedsReview: vi.fn(),
      markRetry: vi.fn(),
    });

    const result = await handler(jobId);

    expect(result).toEqual({ status: "succeeded" });
    expect(staged).toHaveLength(1);
    expect(staged[0]).toMatchObject({
      index_version: 4,
      embedding_dimension: 384,
      embedding_model_alias: "gte-small",
      embedding_model_revision: null,
      embedding_pooling: "mean",
      embedding_normalized: true,
    });
    expect(activeIndexVersion).toBe(4);
  });

  it("keeps the active index unchanged when embedding output is invalid", async () => {
    let activeIndexVersion = 9;
    const markRetry = vi.fn();
    const stageIndex = vi.fn();
    const publishIndex = vi.fn(async () => { activeIndexVersion = 10; });
    const handler = createDocumentProcessingHandler({
      claim: async () => ({
        kind: "claimed",
        job: { id: jobId, documentId: "document-1", targetIndexVersion: 10, attempt: 2, maxAttempts: 3 },
      }),
      extractAndChunk: async () => ({
        complete: true,
        chunks: [{ page_number: 1, section_path: "Coverage", chunk_index: 0, content: "synthetic clause", content_hash: "hash", extraction_confidence: null }],
      }),
      embedChunks: async () => [[0, Number.POSITIVE_INFINITY]],
      stageIndex,
      publishIndex,
      markNeedsReview: vi.fn(),
      markRetry,
    });

    const result = await handler(jobId);

    expect(result).toEqual({ status: "retry_wait", warningCode: "embedding_invalid_output" });
    expect(markRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 2, maxAttempts: 3 }), "embedding_invalid_output");
    expect(stageIndex).not.toHaveBeenCalled();
    expect(publishIndex).not.toHaveBeenCalled();
    expect(activeIndexVersion).toBe(9);
  });

  it("moves an exhausted retry to needs-review without publishing", async () => {
    const markNeedsReview = vi.fn();
    const publishIndex = vi.fn();
    const handler = createDocumentProcessingHandler({
      claim: async () => ({
        kind: "claimed",
        job: { id: jobId, documentId: "document-1", targetIndexVersion: 2, attempt: 3, maxAttempts: 3 },
      }),
      extractAndChunk: async () => { throw new Error("synthetic failure details"); },
      embedChunks: vi.fn(),
      stageIndex: vi.fn(),
      publishIndex,
      markNeedsReview,
      markRetry: vi.fn(),
    });

    const result = await handler(jobId);

    expect(result).toEqual({ status: "needs_review", warningCode: "processing_failed" });
    expect(markNeedsReview).toHaveBeenCalledWith(expect.objectContaining({ id: jobId }), "processing_failed");
    expect(publishIndex).not.toHaveBeenCalled();
  });
});
