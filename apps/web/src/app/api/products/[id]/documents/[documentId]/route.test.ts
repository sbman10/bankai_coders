import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { DELETE, GET } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const productId = "7d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const documentId = "8d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const storagePath = `${userId}/9e42118c-3567-445c-9a94-1abc5c0fe631-invoice.pdf`;
const select = vi.fn();
const eq = vi.fn();
const maybeSingle = vi.fn();
const remove = vi.fn();
const deleteRow = vi.fn();
const deleteEq = vi.fn();
const deletedMaybeSingle = vi.fn();
const createSignedUrl = vi.fn();

const context = { params: Promise.resolve({ id: productId, documentId }) };
const request = (method: string) => new Request(`http://localhost/api/products/${productId}/documents/${documentId}`, { method });

beforeEach(() => {
  vi.clearAllMocks();
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ eq, maybeSingle });
  maybeSingle.mockResolvedValue({ data: { id: documentId, product_id: productId, storage_path: storagePath, original_filename: "Invoice.pdf" }, error: null });
  deleteRow.mockReturnValue({ eq: deleteEq });
  deleteEq.mockReturnValue({ eq: deleteEq, select: vi.fn().mockReturnValue({ maybeSingle: deletedMaybeSingle }) });
  deletedMaybeSingle.mockResolvedValue({ data: { id: documentId }, error: null });
  remove.mockResolvedValue({ error: null });
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example/signed" }, error: null });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn(() => ({ select, delete: deleteRow })),
    storage: { from: vi.fn(() => ({ remove, createSignedUrl })) },
  });
});

describe("private product document access", () => {
  it("creates a short-lived signed URL only for an owned document", async () => {
    const response = await GET(request("GET"), context);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.url).toBe("https://storage.example/signed");
    expect(createSignedUrl).toHaveBeenCalledWith(storagePath, 60, { download: "Invoice.pdf" });
  });

  it("removes the private file and its metadata only for an owned document", async () => {
    const response = await DELETE(request("DELETE"), context);

    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith([storagePath]);
    expect(deleteRow).toHaveBeenCalledOnce();
    expect(deleteEq).toHaveBeenCalledWith("user_id", userId);
  });

  it("does not create a signed URL for another product's document", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await GET(request("GET"), context);

    expect(response.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
