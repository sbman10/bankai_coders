import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set(["processing", "needs_information", "ready_for_review", "needs_human_help"]);
const assessments = new Set(["likely within stated term", "unclear", "appears outside stated term"]);
const evidenceKinds = new Set(["fact", "warranty_clause", "missing_item", "inference"]);

function constantTimeMatches(expected: string, received: string | null): boolean {
  if (!received) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function validEvidence(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.length <= 12 && value.every((item) => {
    if (!isRecord(item)) return false;
    const confidenceValid = item.confidence === undefined || item.confidence === null ||
      (typeof item.confidence === "number" && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1);
    const pageValid = item.sourcePage === undefined || item.sourcePage === null ||
      (Number.isInteger(item.sourcePage) && Number(item.sourcePage) >= 1 && Number(item.sourcePage) <= 100_000);
    const documentValid = item.documentId === undefined || item.documentId === null ||
      (typeof item.documentId === "string" && uuidV4.test(item.documentId));
    return typeof item.kind === "string" && evidenceKinds.has(item.kind) &&
      typeof item.content === "string" && item.content.trim().length > 0 && item.content.length <= 4000 &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item.content) &&
      confidenceValid && pageValid && documentValid;
  });
}

export async function POST(request: Request) {
  const callbackSecret = process.env.N8N_CALLBACK_SECRET;
  if (!callbackSecret || !process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Claim processing is not configured yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!constantTimeMatches(callbackSecret, request.headers.get("x-claimforge-callback-secret"))) {
    return NextResponse.json({ error: "This callback is not authorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let body: Record<string, unknown>;
  try {
    const value = await readJsonBody(request, 64 * 1024);
    if (!isRecord(value)) return NextResponse.json({ error: "The processing result must be a JSON object." }, { status: 400 });
    body = value;
  } catch (error) {
    if (error instanceof JsonBodyError) {
      const message = error.status === 413 ? "The processing result is too large." : "The processing result must be valid JSON.";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: "The processing result must be valid JSON." }, { status: 400 });
  }

  const claimId = typeof body.claimId === "string" ? body.claimId : "";
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const status = typeof body.status === "string" ? body.status : "";
  const assessment = typeof body.assessment === "string" ? body.assessment : "";
  const claimDraft = body.claimDraft === undefined || body.claimDraft === null ? null : body.claimDraft;
  const evidence = body.evidence === undefined ? [] : body.evidence;

  if (!uuidV4.test(claimId) || !uuidV4.test(eventId) || !statuses.has(status) || !assessments.has(assessment) ||
    (claimDraft !== null && (typeof claimDraft !== "string" || claimDraft.length > 10_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(claimDraft))) ||
    (status === "ready_for_review" && (typeof claimDraft !== "string" || !claimDraft.trim())) || !validEvidence(evidence)) {
    return NextResponse.json({ error: "The processing result did not match the expected claim format." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const pEvidence = evidence.map((item) => ({
    kind: item.kind,
    content: (item.content as string).trim(),
    source_page: item.sourcePage ?? null,
    confidence: item.confidence ?? null,
    document_id: item.documentId ?? null,
  }));

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("apply_claim_processing_result", {
      p_claim_id: claimId,
      p_event_id: `${claimId}:${eventId}`,
      p_status: status,
      p_assessment: assessment,
      p_claim_draft: claimDraft,
      p_evidence: pEvidence,
    });
    if (error || !data || data.conflict) {
      return NextResponse.json({ error: data?.conflict ? "This claim is no longer awaiting processing." : "The claim-processing result could not be saved." }, {
        status: data?.conflict ? 409 : 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json({ ok: true, duplicate: Boolean(data.duplicate), claimId, status: data.status }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Claim processing is not configured yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
