import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";

type ClaimDocumentInput = {
  kind: "invoice" | "warranty";
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const claimIntakeEventType = "claim.intake.received";

type DispatchResult = "accepted" | "pending" | "not_configured";

async function dispatchClaimIntake(eventId: string): Promise<DispatchResult> {
  const webhookUrl = process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL?.trim();
  const webhookToken = process.env.N8N_WEBHOOK_AUTH_TOKEN?.trim();
  if (!webhookUrl || !webhookToken) return "not_configured";

  let parsedWebhookUrl: URL;
  try {
    parsedWebhookUrl = new URL(webhookUrl);
    if (parsedWebhookUrl.protocol !== "https:" || parsedWebhookUrl.username || parsedWebhookUrl.password) {
      return "pending";
    }
  } catch {
    return "pending";
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return "pending";
  }

  let lease: { leased?: boolean; claim_id?: string; product_id?: string } | null;
  try {
    const result = await admin.rpc("lease_claim_intake_event", { p_event_id: eventId });
    lease = result.data;
    if (result.error) return "pending";
  } catch {
    return "pending";
  }
  if (!lease?.leased || typeof lease.claim_id !== "string" || typeof lease.product_id !== "string") {
    return "pending";
  }

  let succeeded = false;
  let safeErrorCode: "n8n_unavailable" | "n8n_rejected" | "invalid_response" = "n8n_unavailable";
  try {
    const response = await fetch(parsedWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-claimforge-secret": webhookToken },
      body: JSON.stringify({
        eventId,
        eventType: claimIntakeEventType,
        claimId: lease.claim_id,
        productId: lease.product_id,
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      redirect: "error",
    });
    if (response.status === 202) succeeded = true;
    else safeErrorCode = response.ok ? "invalid_response" : "n8n_rejected";
  } catch {
    safeErrorCode = "n8n_unavailable";
  }

  try {
    const { error: finishError } = await admin.rpc("finish_claim_intake_event_dispatch", {
      p_event_id: eventId,
      p_succeeded: succeeded,
      p_safe_error_code: succeeded ? null : safeErrorCode,
    });
    return succeeded && !finishError ? "accepted" : "pending";
  } catch {
    return "pending";
  }
}

function isValidDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isClaimDocument(value: unknown, userId: string): value is ClaimDocumentInput {
  if (!isRecord(value)) return false;
  const expectedPath = new RegExp(`^${userId}/[0-9a-f-]{36}-[A-Za-z0-9][A-Za-z0-9._-]{0,139}$`, "i");
  return (value.kind === "invoice" || value.kind === "warranty") &&
    typeof value.storagePath === "string" && value.storagePath.length <= 512 && expectedPath.test(value.storagePath) &&
    typeof value.fileName === "string" && value.fileName.length > 0 && value.fileName.length <= 240 && !/[\u0000-\u001f\u007f]/.test(value.fileName) &&
    typeof value.mimeType === "string" && allowedMimeTypes.has(value.mimeType) &&
    Number.isInteger(value.sizeBytes) && Number(value.sizeBytes) > 0 && Number(value.sizeBytes) <= 10 * 1024 * 1024;
}

async function validateStoredDocuments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documents: ClaimDocumentInput[],
): Promise<"valid" | "invalid" | "unavailable"> {
  for (const document of documents) {
    const { data, error } = await supabase.storage.from("claim-documents").download(document.storagePath);
    if (error) return "unavailable";
    if (!data || data.size !== document.sizeBytes) return "invalid";

    const header = new Uint8Array(await data.slice(0, 1024).arrayBuffer());
    const isPdf = document.mimeType === "application/pdf" &&
      String.fromCharCode(...header).includes("%PDF-");
    const isJpeg = document.mimeType === "image/jpeg" &&
      header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const isPng = document.mimeType === "image/png" &&
      header.length >= 8 && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e &&
      header[3] === 0x47 && header[4] === 0x0d && header[5] === 0x0a && header[6] === 0x1a && header[7] === 0x0a;
    if (!isPdf && !isJpeg && !isPng) return "invalid";
  }
  return "valid";
}

import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { prototypeStore } from "@/lib/store/prototype-store";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view your claims." }, { status: 401 });

    const { data, error } = await supabase
      .from("claims")
      .select("id, product_id, fault_description, failure_date, status, assessment, claim_draft, created_at, products(name), claim_evidence(id, document_id, evidence_kind, content, source_page, confidence, created_at), claim_approvals(id, approved_content, approved_at, action_status)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: "Your claims could not be loaded." }, { status: 503 });

    return NextResponse.json({ claims: data ?? [] });
  } catch {
    if (!isSupabaseConfigured()) {
      const claims = prototypeStore.getClaims();
      return NextResponse.json({ claims });
    }
    return NextResponse.json({ error: "Claim storage is not configured yet." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before saving a claim." }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      const value = await readJsonBody(request, 16 * 1024);
      if (!isRecord(value)) return NextResponse.json({ error: "The claim details were not valid JSON." }, { status: 400 });
      body = value;
    } catch (error) {
      if (error instanceof JsonBodyError) {
        const message = error.status === 413 ? "The claim details are too large." : "The claim details were not valid JSON.";
        return NextResponse.json({ error: message }, { status: error.status });
      }
      return NextResponse.json({ error: "The claim details were not valid JSON." }, { status: 400 });
    }

    const product = typeof body.product === "string" ? body.product.trim() : "";
    const fault = typeof body.fault === "string" ? body.fault.trim() : "";
    const failureDate = typeof body.failureDate === "string" ? body.failureDate : null;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    const documents = body.documents === undefined ? [] : body.documents;
    if (!product || product.length > 160 || !fault || fault.length > 4000 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      return NextResponse.json({ error: "Add a product name and a fault description, then try again." }, { status: 400 });
    }
    if (body.failureDate !== undefined && body.failureDate !== null && (!failureDate || !isValidDate(failureDate))) {
      return NextResponse.json({ error: "Choose a valid date for when the issue began." }, { status: 400 });
    }
    if (!Array.isArray(documents) || documents.length > 2 || documents.some((document) => !isClaimDocument(document, user.id)) ||
      new Set(documents.filter(isRecord).map((document) => document.kind)).size !== documents.length) {
      return NextResponse.json({ error: "One of the attached documents is invalid. Please remove it and upload it again." }, { status: 400 });
    }

    const documentValidation = await validateStoredDocuments(supabase, documents as ClaimDocumentInput[]);
    if (documentValidation === "invalid") {
      return NextResponse.json({ error: "An uploaded document does not match its declared file type. Please replace it and try again." }, { status: 400 });
    }
    if (documentValidation === "unavailable") {
      return NextResponse.json({ error: "Your private documents could not be verified. Please retry in a moment." }, { status: 503 });
    }

    const { data, error } = await supabase.rpc("create_claim_intake_with_event", {
      p_idempotency_key: idempotencyKey,
      p_product_name: product,
      p_fault_description: fault,
      p_failure_date: failureDate,
      p_documents: (documents as ClaimDocumentInput[]).map((document) => ({
        document_kind: document.kind,
        storage_path: document.storagePath,
        original_filename: document.fileName,
        mime_type: document.mimeType,
        size_bytes: document.sizeBytes,
      })),
    });
    if (error?.code === "PGRST202" || error?.code === "42883") {
      const legacy = await supabase.rpc("create_claim_intake", {
        p_idempotency_key: idempotencyKey,
        p_product_name: product,
        p_fault_description: fault,
        p_failure_date: failureDate,
        p_documents: (documents as ClaimDocumentInput[]).map((document) => ({
          document_kind: document.kind,
          storage_path: document.storagePath,
          original_filename: document.fileName,
          mime_type: document.mimeType,
          size_bytes: document.sizeBytes,
        })),
      });
      if (legacy.error || !legacy.data?.claim_id || !legacy.data?.product_id) {
        return NextResponse.json({ error: "Your claim could not be saved. Your documents remain private; please retry." }, { status: 503 });
      }
      return NextResponse.json({
        claim: { id: legacy.data.claim_id, productId: legacy.data.product_id, status: "received" },
        duplicate: Boolean(legacy.data.duplicate),
        automation: legacy.data.duplicate ? "duplicate" : "migration_required",
      }, { status: legacy.data.duplicate ? 200 : 201 });
    }
    if (error || !data?.claim_id || !data?.product_id) {
      return NextResponse.json({ error: "Your claim could not be saved. Your documents remain private; please retry." }, { status: 503 });
    }

    const eventId = typeof data.event_id === "string" ? data.event_id : null;
    const automation = data.duplicate
      ? "duplicate"
      : eventId
        ? await dispatchClaimIntake(eventId)
        : "migration_required";

    return NextResponse.json({
      claim: { id: data.claim_id, productId: data.product_id, status: "received" },
      duplicate: Boolean(data.duplicate),
      automation,
    }, { status: data.duplicate ? 200 : 201 });
  } catch {
    if (!isSupabaseConfigured()) {
      let body: Record<string, unknown> = {};
      try {
        const val = await readJsonBody(request, 16 * 1024);
        if (isRecord(val)) body = val;
      } catch {}
      const product = typeof body.product === "string" ? body.product.trim() : "Product";
      const fault = typeof body.fault === "string" ? body.fault.trim() : "Reported issue";
      const failureDate = typeof body.failureDate === "string" ? body.failureDate : null;
      const claim = prototypeStore.createClaim({
        productName: product,
        fault,
        failureDate,
      });
      return NextResponse.json({
        claim: { id: claim.id, productId: claim.product_id, status: claim.status },
        duplicate: false,
        automation: "not_configured",
      }, { status: 201 });
    }
    return NextResponse.json({ error: "Claim intake is not configured yet." }, { status: 503 });
  }
}
