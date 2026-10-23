import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET, POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const productId = "7d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const storagePath = `${userId}/9e42118c-3567-445c-9a94-1abc5c0fe631-invoice.pdf`;
const productSelect = vi.fn();
const productEq = vi.fn();
const productMaybeSingle = vi.fn();
const documentSelect = vi.fn();
const documentEq = vi.fn();
const documentOrder = vi.fn();
const documentLimit = vi.fn();
const documentInsert = vi.fn();
const documentSingle = vi.fn();

const context = { params: Promise.resolve({ id: productId }) };

function request(body?: unknown) {
  return new Request("http://localhost/api/products/id/documents", {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  productSelect.mockReturnValue({ eq: productEq });
  productEq.mockReturnValue({ eq: productEq, maybeSingle: productMaybeSingle });
  documentSelect.mockReturnValue({ eq: documentEq });
  documentEq.mockReturnValue({ eq: documentEq, order: documentOrder });
  documentOrder.mockReturnValue({ limit: documentLimit });
  documentInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: documentSingle }) });
  productMaybeSingle.mockResolvedValue({ data: { id: productId }, error: null });
  documentLimit.mockResolvedValue({ data: [{ id: "document-1", product_id: productId, document_kind: "invoice" }], error: null });
  documentSingle.mockResolvedValue({ data: { id: "document-1", product_id: productId, storage_path: storagePath, document_kind: "invoice" }, error: null });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn((table: string) => table === "products" ? { select: productSelect } : { select: documentSelect, insert: documentInsert }),
  });
});

describe("product passport documents", () => {
  it("lists only metadata for a product owned by the signed-in user", async () => {
    const response = await GET(request(), context);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.documents).toHaveLength(1);
    expect(documentSelect).toHaveBeenCalledWith(expect.stringContaining("ingestion_status"));
    expect(documentSelect).toHaveBeenCalledWith(expect.not.stringContaining("storage_path"));
    expect(documentEq).toHaveBeenCalledWith("user_id", userId);
    expect(documentEq).toHaveBeenCalledWith("product_id", productId);
  });

  it("registers a validated private file reference against an owned product", async () => {
    const response = await POST(request({
      productId,
      documentKind: "invoice",
      storagePath,
      fileName: "Invoice.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    }), context);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.document.id).toBe("document-1");
    expect(documentInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId,
      product_id: productId,
      document_kind: "invoice",
      storage_path: storagePath,
      size_bytes: 2048,
    }));
  });

  it("rejects another user's storage path before writing metadata", async () => {
    const response = await POST(request({
      productId,
      documentKind: "invoice",
      storagePath: `another-user/${storagePath.split("/")[1]}`,
      fileName: "Invoice.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    }), context);

    expect(response.status).toBe(400);
    expect(documentInsert).not.toHaveBeenCalled();
  });

  it("does not expose documents for a product the user does not own", async () => {
    productMaybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await GET(request(), context);

    expect(response.status).toBe(404);
    expect(documentSelect).not.toHaveBeenCalled();
  });
});
