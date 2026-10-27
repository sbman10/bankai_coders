import { Blob } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createClient, functionsInvoke, ocrImage } = vi.hoisted(() => ({ createAdminClient: vi.fn(), createClient: vi.fn(), functionsInvoke: vi.fn(), ocrImage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/rag/local-ocr", () => ({ ocrImage }));

import { POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const productId = "7d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const documentId = "8d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const documentRow = {
  id: documentId,
  product_id: productId,
  user_id: userId,
  storage_path: `${userId}/document.png`,
  mime_type: "image/png",
  size_bytes: 2048,
  index_version: 0,
  ingestion_status: "uploaded",
};
const updatePayload = vi.fn();
const download = vi.fn();
const insertChunks = vi.fn();
const chunkDeleteEq = vi.fn();

function syntheticPdf(text: string): Uint8Array {
  const escaped = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "ascii"));
}

function makeRequest() {
  return new Request(`http://localhost/api/products/${productId}/documents/${documentId}/index`, { method: "POST" });
}

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  query.single = vi.fn(async () => result);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(documentRow, {
    storage_path: `${userId}/document.png`,
    mime_type: "image/png",
    size_bytes: 2048,
    index_version: 0,
    ingestion_status: "uploaded",
  });
  const docQuery = queryResult({ data: documentRow, error: null });
  const updateQuery = queryResult({ data: { id: documentId }, error: null });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn(() => ({ select: vi.fn(() => docQuery) })),
    storage: { from: vi.fn(() => ({ download })) },
    functions: { invoke: functionsInvoke },
  });
  createAdminClient.mockReturnValue({
    from: vi.fn((table: string) => table === "product_documents"
      ? { update: vi.fn((payload: unknown) => { updatePayload(payload); return updateQuery; }) }
      : {
        delete: vi.fn(() => {
          const query: Record<string, unknown> = {};
          query.eq = vi.fn((column: string, value: unknown) => { chunkDeleteEq(column, value); return query; });
          query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve, reject);
          return query;
        }),
        insert: insertChunks,
      }),
  });
  download.mockResolvedValue({ data: null, error: null });
  insertChunks.mockResolvedValue({ error: null });
  functionsInvoke.mockResolvedValue({ data: {
    embeddings: [Array.from({ length: 384 }, () => 0.125)], modelAlias: "gte-small",
    modelRepository: "Supabase/gte-small", modelRevision: null, dimension: 384,
    pooling: "mean", normalized: true,
  }, error: null });
  ocrImage.mockResolvedValue({ text: "", confidence: 0 });
});

describe("POST /api/products/[id]/documents/[documentId]/index", () => {
  it("indexes searchable text from a private synthetic PDF with page provenance", async () => {
    const text = "Synthetic warranty terms cover manufacturing defects for one year.";
    const bytes = syntheticPdf(text);
    documentRow.storage_path = `${userId}/document.pdf`;
    documentRow.mime_type = "application/pdf";
    documentRow.size_bytes = bytes.byteLength;
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: productId, documentId }) });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ status: "indexed", pagesIndexed: 1 });
    expect(insertChunks).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ user_id: userId, document_id: documentId, page_number: 1, content: expect.stringContaining("manufacturing defects"), embedding: expect.any(Array), embedding_model_alias: "gte-small" }),
    ]));
    expect(functionsInvoke).toHaveBeenCalledWith("embed-text", { body: { texts: expect.arrayContaining([expect.stringContaining("manufacturing defects")]) } });
    expect(updatePayload).toHaveBeenLastCalledWith(expect.objectContaining({ ingestion_status: "indexed" }));
  });

  it("indexes an owned image invoice only when OCR returns usable page text", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    documentRow.size_bytes = bytes.byteLength;
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });
    ocrImage.mockResolvedValue({ text: "Receipt: headphones purchased on 12 March 2026.", confidence: 0.91 });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: productId, documentId }) });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ status: "indexed", pagesIndexed: 1 });
    expect(insertChunks).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ page_number: 1, content: expect.stringContaining("headphones purchased"), embedding: expect.any(Array) }),
    ]));
  });

  it("does not publish a searchable index when embeddings are unavailable", async () => {
    const bytes = syntheticPdf("Synthetic policy text for a failed embedding request.");
    documentRow.storage_path = `${userId}/document.pdf`;
    documentRow.mime_type = "application/pdf";
    documentRow.size_bytes = bytes.byteLength;
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });
    functionsInvoke.mockResolvedValue({ data: null, error: { message: "synthetic provider error" } });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: productId, documentId }) });

    expect(response.status).toBe(503);
    expect(insertChunks).not.toHaveBeenCalled();
    expect(updatePayload).not.toHaveBeenCalledWith(expect.objectContaining({ ingestion_status: "indexed" }));
  });

  it("keeps a prior index searchable when re-indexing cannot embed the document", async () => {
    const bytes = syntheticPdf("A previously indexed synthetic warranty clause.");
    documentRow.storage_path = `${userId}/document.pdf`;
    documentRow.mime_type = "application/pdf";
    documentRow.size_bytes = bytes.byteLength;
    documentRow.index_version = 1;
    documentRow.ingestion_status = "indexed";
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });
    functionsInvoke.mockResolvedValue({ data: null, error: { message: "synthetic provider error" } });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: productId, documentId }) });

    expect(response.status).toBe(503);
    expect(insertChunks).not.toHaveBeenCalled();
    expect(updatePayload).not.toHaveBeenCalledWith(expect.objectContaining({ ingestion_status: "extracting" }));
    expect(updatePayload).not.toHaveBeenCalledWith(expect.objectContaining({ ingestion_status: "failed" }));
    expect(updatePayload).toHaveBeenCalledWith(expect.objectContaining({ ingestion_warning_code: "embedding_unavailable" }));
  });

  it("marks a native-text PDF with an empty page for review without publishing chunks", async () => {
    const bytes = syntheticPdf("");
    documentRow.storage_path = `${userId}/empty-document.pdf`;
    documentRow.mime_type = "application/pdf";
    documentRow.size_bytes = bytes.byteLength;
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: productId, documentId }) });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ status: "needs_review", reason: "text_incomplete_or_ocr_required" });
    expect(updatePayload).toHaveBeenCalledWith(expect.objectContaining({
      ingestion_status: "needs_review",
      ingestion_warning_code: "text_incomplete_or_ocr_required",
    }));
    expect(insertChunks).not.toHaveBeenCalled();
  });

  it("makes a scanned PDF searchable when local OCR reads its rendered page", async () => {
    const bytes = syntheticPdf("");
    documentRow.storage_path = `${userId}/scanned-policy.pdf`;
    documentRow.mime_type = "application/pdf";
    documentRow.size_bytes = bytes.byteLength;
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });
    ocrImage.mockResolvedValue({ text: "Accidental damage is excluded under this synthetic policy.", confidence: 0.92 });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: productId, documentId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "indexed", pagesIndexed: 1 });
    expect(insertChunks).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ page_number: 1, content: expect.stringContaining("Accidental damage is excluded"), extraction_confidence: 0.92 }),
    ]));
  });

  it("marks an unreadable synthetic PDF for review with a safe warning", async () => {
    const bytes = new Uint8Array(Buffer.from("%PDF-1.4\\nmalformed synthetic PDF", "ascii"));
    documentRow.storage_path = `${userId}/unreadable-document.pdf`;
    documentRow.mime_type = "application/pdf";
    documentRow.size_bytes = bytes.byteLength;
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: productId, documentId }) });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ status: "needs_review", reason: "pdf_unreadable" });
    expect(updatePayload).toHaveBeenCalledWith(expect.objectContaining({
      ingestion_status: "needs_review",
      ingestion_warning_code: "pdf_unreadable",
    }));
    expect(insertChunks).not.toHaveBeenCalled();
  });

  it("cleans a failed index version before retrying the same document", async () => {
    const bytes = syntheticPdf("Synthetic policy text for retry testing.");
    documentRow.storage_path = `${userId}/document.pdf`;
    documentRow.mime_type = "application/pdf";
    documentRow.size_bytes = bytes.byteLength;
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });
    insertChunks.mockResolvedValueOnce({ error: { message: "synthetic write failure" } }).mockResolvedValueOnce({ error: null });

    const context = { params: Promise.resolve({ id: productId, documentId }) };
    const firstResponse = await POST(makeRequest(), context);
    expect(firstResponse.status).toBe(503);
    const retryResponse = await POST(makeRequest(), context);

    expect(retryResponse.status).toBe(200);
    expect(chunkDeleteEq).toHaveBeenCalledWith("user_id", userId);
    expect(chunkDeleteEq).toHaveBeenCalledWith("document_id", documentId);
    expect(chunkDeleteEq).toHaveBeenCalledWith("index_version", 1);
  });

  it("keeps an unreadable image out of search when local OCR finds no text", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    documentRow.size_bytes = bytes.byteLength;
    download.mockResolvedValue({ data: new Blob([bytes]), error: null });
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: productId, documentId }) });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ status: "needs_review", reason: "text_incomplete_or_ocr_required" });
    expect(updatePayload).toHaveBeenCalledWith(expect.objectContaining({
      ingestion_status: "needs_review",
      ingestion_warning_code: "text_incomplete_or_ocr_required",
    }));
    expect(ocrImage).toHaveBeenCalled();
    expect(insertChunks).not.toHaveBeenCalled();
  });
});
