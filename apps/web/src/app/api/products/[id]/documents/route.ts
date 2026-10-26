import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { prototypeStore } from "@/lib/store/prototype-store";

const productIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const documentListFields = "id, product_id, document_kind, original_filename, mime_type, size_bytes, created_at, ingestion_status, ingestion_warning_code, indexed_at";
const kinds = new Set(["invoice", "warranty", "manual", "other"]);
const mimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

async function bodyOf(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const value = await readJsonBody(request, 8 * 1024);
    return isRecord(value) ? value : NextResponse.json({ error: "Document details must be a JSON object." }, { status: 400 });
  } catch (error) {
    if (error instanceof JsonBodyError) {
      const message = error.status === 413 ? "Document details are too large." : "Document details must be valid JSON.";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: "Document details must be valid JSON." }, { status: 400 });
  }
}

function normalizeDocumentPayload(body: Record<string, unknown>) {
  let kind = String(body.documentKind || "");
  let label = typeof body.documentLabel === "string" && body.documentLabel.trim().length > 0
    ? body.documentLabel.trim().slice(0, 140)
    : undefined;

  if (kind === "extended_warranty") {
    kind = "warranty";
    if (!label) label = "Extended Warranty / AMC";
  } else if (kind === "warranty_card") {
    kind = "warranty";
    if (!label) label = "Warranty Card";
  } else if (kind === "service_receipt") {
    kind = "other";
    if (!label) label = "Service / Repair Receipt";
  } else if (kind === "installation") {
    kind = "other";
    if (!label) label = "Installation Document";
  }

  return { kind, label };
}

function validDocument(body: Record<string, unknown>, userId: string, productId: string) {
  const { documentKind, storagePath, fileName, mimeType, sizeBytes, documentLabel } = body;
  const { kind } = normalizeDocumentPayload(body);
  const pathPattern = new RegExp(`^${userId}/[0-9a-f-]{36}-[A-Za-z0-9][A-Za-z0-9._-]{0,139}$`, "i");
  const validLabel = documentLabel === undefined || documentLabel === null || (typeof documentLabel === "string" && documentLabel.length <= 140);
  return body.productId === productId && typeof documentKind === "string" && kinds.has(kind) &&
    typeof storagePath === "string" && storagePath.length <= 512 && pathPattern.test(storagePath) &&
    typeof fileName === "string" && fileName.length > 0 && fileName.length <= 240 && !/[\u0000-\u001f\u007f]/.test(fileName) &&
    typeof mimeType === "string" && mimeTypes.has(mimeType) && Number.isInteger(sizeBytes) && Number(sizeBytes) >= 1 && Number(sizeBytes) <= 10 * 1024 * 1024 &&
    validLabel;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view product documents." }, { status: 401 });
    const { id: productId } = await context.params;
    if (!productIdPattern.test(productId)) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });

    const { data: product, error: productError } = await supabase.from("products").select("id")
      .eq("id", productId).eq("user_id", user.id).maybeSingle();
    if (productError) return NextResponse.json({ error: "The product could not be checked." }, { status: 503 });
    if (!product) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });

    const { data, error } = await supabase.from("product_documents").select(documentListFields)
      .eq("user_id", user.id).eq("product_id", productId).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Product documents could not be loaded." }, { status: 503 });
    return NextResponse.json({ documents: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const { id: productId } = await context.params;
      const documents = prototypeStore.getProductDocuments(productId);
      return NextResponse.json({ documents }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Product document storage is not configured yet." }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before attaching a document." }, { status: 401 });
    const { id: productId } = await context.params;
    if (!productIdPattern.test(productId)) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });
    const body = await bodyOf(request);
    if (body instanceof NextResponse) return body;
    if (!validDocument(body, user.id, productId)) return NextResponse.json({ error: "Check the document type, file name, storage path, and 10 MB file-size limit." }, { status: 400 });

    const { kind: normalizedKind, label: normalizedLabel } = normalizeDocumentPayload(body);

    const { data: product, error: productError } = await supabase.from("products").select("id")
      .eq("id", productId).eq("user_id", user.id).maybeSingle();
    if (productError) return NextResponse.json({ error: "The product could not be checked." }, { status: 503 });
    if (!product) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      product_id: productId,
      document_kind: normalizedKind,
      storage_path: body.storagePath,
      original_filename: body.fileName,
      mime_type: body.mimeType,
      size_bytes: body.sizeBytes,
    };
    if (normalizedLabel) {
      insertPayload.document_label = normalizedLabel;
    }

    const { data, error } = await supabase.from("product_documents").insert(insertPayload).select(documentListFields).single();
    if (error || !data) return NextResponse.json({ error: "The document could not be attached to this product." }, { status: 503 });
    return NextResponse.json({ document: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const { id: productId } = await context.params;
      const body = await bodyOf(request);
      if (body instanceof NextResponse) return body;
      const { kind: normalizedKind, label: normalizedLabel } = normalizeDocumentPayload(body);
      const document = prototypeStore.createProductDocument({
        productId,
        documentKind: (normalizedKind as "invoice" | "warranty" | "manual" | "other") || "other",
        documentLabel: normalizedLabel,
        fileName: String(body.fileName || "document.pdf"),
        mimeType: String(body.mimeType || "application/pdf"),
        sizeBytes: Number(body.sizeBytes) || 1024,
        storagePath: typeof body.storagePath === "string" ? body.storagePath : undefined,
      });
      return NextResponse.json({ document }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Product document storage is not configured yet." }, { status: 503 });
  }
}
