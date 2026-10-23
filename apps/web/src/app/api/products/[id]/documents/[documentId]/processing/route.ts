import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RouteContext = { params: Promise<{ id: string; documentId: string }> };

const documentStatuses = new Set(["uploaded", "extracting", "indexed", "needs_review", "failed"]);
const jobStatuses = new Set(["queued", "processing", "retry_wait", "succeeded", "needs_review", "failed", "cancelled"]);
const dispatchStatuses = new Set(["pending", "dispatching", "dispatched"]);
const safeWarnings = new Set([
  "ocr_required", "unsupported_file_size", "source_unavailable", "invalid_pdf_content",
  "pdf_unreadable", "text_incomplete_or_ocr_required", "text_not_found",
  "stale_index_cleanup_failed", "index_write_failed", "index_publish_failed",
]);

async function findOwnedDocument(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, productId: string, documentId: string) {
  return supabase.from("product_documents")
    .select("id, product_id, user_id, ingestion_status, ingestion_warning_code, indexed_at, index_version")
    .eq("id", documentId).eq("product_id", productId).eq("user_id", userId).maybeSingle();
}

const jobSelect = "id, document_id, status, dispatch_status, target_index_version, created_at";

function jobResponse(job: Record<string, unknown>) {
  if (
    typeof job.id !== "string" ||
    typeof job.status !== "string" || !jobStatuses.has(job.status) ||
    typeof job.dispatch_status !== "string" || !dispatchStatuses.has(job.dispatch_status) ||
    !Number.isInteger(job.target_index_version) ||
    typeof job.created_at !== "string"
  ) return null;

  return {
    job: {
      id: job.id,
      status: job.status,
      dispatchStatus: job.dispatch_status,
      targetIndexVersion: job.target_index_version,
      createdAt: job.created_at,
    },
  };
}

function acceptedJob(job: Record<string, unknown>) {
  const body = jobResponse(job);
  if (!body) return NextResponse.json({ error: "Document processing is unavailable." }, { status: 503 });
  return NextResponse.json(body, {
    status: 202,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function findIdempotentJob(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, idempotencyKey: string) {
  return supabase.from("document_processing_jobs").select(jobSelect)
    .eq("user_id", userId).eq("idempotency_key", idempotencyKey).maybeSingle();
}

async function findActiveJob(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, documentId: string, targetIndexVersion: number) {
  return supabase.from("document_processing_jobs").select(jobSelect)
    .eq("user_id", userId).eq("document_id", documentId)
    .eq("target_index_version", targetIndexVersion)
    .in("status", ["queued", "processing", "retry_wait"]).maybeSingle();
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Sign in to check document processing." }, { status: 401 });

    const { id: productId, documentId } = await context.params;
    if (!uuid.test(productId) || !uuid.test(documentId)) {
      return NextResponse.json({ error: "This document could not be found." }, { status: 404 });
    }

    const { data: document, error: documentError } = await findOwnedDocument(supabase, user.id, productId, documentId);
    if (documentError) return NextResponse.json({ error: "The document could not be checked." }, { status: 503 });
    if (!document) return NextResponse.json({ error: "This document could not be found." }, { status: 404 });
    if (!documentStatuses.has(document.ingestion_status)) {
      return NextResponse.json({ error: "Document processing status is unavailable." }, { status: 503 });
    }

    const { data: job, error: jobError } = await supabase.from("document_processing_jobs")
      .select("id, status, dispatch_status, attempt_count, updated_at, safe_error_code")
      .eq("user_id", user.id).eq("document_id", documentId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (jobError) return NextResponse.json({ error: "Document processing status is unavailable." }, { status: 503 });
    if (job && (!jobStatuses.has(job.status) || !dispatchStatuses.has(job.dispatch_status))) {
      return NextResponse.json({ error: "Document processing status is unavailable." }, { status: 503 });
    }

    return NextResponse.json({
      status: document.ingestion_status,
      warningCode: safeWarnings.has(document.ingestion_warning_code ?? "") ? document.ingestion_warning_code : null,
      indexedAt: document.indexed_at,
      indexVersion: document.index_version,
      job: job ? {
        id: job.id,
        status: job.status,
        dispatchStatus: job.dispatch_status,
        attemptCount: job.attempt_count,
        updatedAt: job.updated_at,
        safeErrorCode: safeWarnings.has(job.safe_error_code ?? "") ? job.safe_error_code : null,
      } : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Document processing status is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Sign in to request document processing." }, { status: 401 });

    const { id: productId, documentId } = await context.params;
    if (!uuid.test(productId) || !uuid.test(documentId)) {
      return NextResponse.json({ error: "This document could not be found." }, { status: 404 });
    }

    const { data: document, error: documentError } = await findOwnedDocument(supabase, user.id, productId, documentId);
    if (documentError) return NextResponse.json({ error: "The document could not be checked." }, { status: 503 });
    if (!document) return NextResponse.json({ error: "This document could not be found." }, { status: 404 });

    const body = await readJsonBody(request, 1024);
    if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.idempotencyKey !== "string" || !uuid.test(body.idempotencyKey)) {
      return NextResponse.json({ error: "Provide only a valid idempotencyKey." }, { status: 400 });
    }
    const idempotencyKey = body.idempotencyKey;

    const { data: previousJob, error: previousJobError } = await findIdempotentJob(supabase, user.id, idempotencyKey);
    if (previousJobError) return NextResponse.json({ error: "The processing request could not be checked." }, { status: 503 });
    if (previousJob) {
      if (previousJob.document_id !== documentId) {
        return NextResponse.json({ error: "This idempotency key was already used for another request." }, { status: 409 });
      }
      return acceptedJob(previousJob);
    }

    const currentVersion = document.index_version ?? 0;
    if (!Number.isInteger(currentVersion) || currentVersion < 0) {
      return NextResponse.json({ error: "Document processing status is unavailable." }, { status: 503 });
    }
    const targetIndexVersion = currentVersion + 1;

    const { data: activeJob, error: activeJobError } = await findActiveJob(supabase, user.id, documentId, targetIndexVersion);
    if (activeJobError) return NextResponse.json({ error: "The processing request could not be checked." }, { status: 503 });
    if (activeJob) return acceptedJob(activeJob);

    if (!new Set(["uploaded", "indexed", "needs_review", "failed"]).has(document.ingestion_status)) {
      return NextResponse.json({ error: "This document cannot be reprocessed in its current state." }, { status: 409 });
    }

    const admin = createAdminClient();
    const { data: createdJob, error: createError } = await admin.from("document_processing_jobs")
      .insert({
        user_id: user.id,
        document_id: documentId,
        target_index_version: targetIndexVersion,
        idempotency_key: idempotencyKey,
      })
      .select(jobSelect).single();

    if (createError || !createdJob) {
      const { data: racedJob, error: racedJobError } = await findIdempotentJob(supabase, user.id, idempotencyKey);
      if (!racedJobError && racedJob?.document_id === documentId) return acceptedJob(racedJob);
      const { data: racedActiveJob, error: racedActiveError } = await findActiveJob(supabase, user.id, documentId, targetIndexVersion);
      if (!racedActiveError && racedActiveJob) return acceptedJob(racedActiveJob);
      return NextResponse.json({ error: "The processing request could not be saved." }, { status: 503 });
    }

    return acceptedJob(createdJob);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json({ error: error.status === 413 ? "The request body is too large." : "Provide a bounded JSON request body." }, { status: error.status });
    }
    return NextResponse.json({ error: "Document processing is temporarily unavailable." }, { status: 503 });
  }
}
