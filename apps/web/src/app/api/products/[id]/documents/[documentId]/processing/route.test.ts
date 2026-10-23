import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { GET, POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const productId = "7d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const documentId = "8d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const context = { params: Promise.resolve({ id: productId, documentId }) };

function makeRequest(method: "GET" | "POST", body?: unknown) {
  return new Request(`http://localhost/api/products/${productId}/documents/${documentId}/processing`, {
    method,
    ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  });
});

function ownedDocumentQuery(result: unknown) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  return query;
}

describe("document processing status API", () => {
  it("rejects unauthenticated status reads and reprocessing requests", async () => {
    const getResponse = await GET(makeRequest("GET"), context);
    const postResponse = await POST(makeRequest("POST", {
      idempotencyKey: "6d109d93-e712-4fd7-a6ae-2a403460cd3a",
    }), context);

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns an indistinguishable not-found response for another user's document", async () => {
    const ownedDocument = ownedDocumentQuery({ data: null, error: null });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ownedDocument),
    });

    const response = await POST(makeRequest("POST", {
      idempotencyKey: "6d109d93-e712-4fd7-a6ae-2a403460cd3a",
    }), context);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "This document could not be found." });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(ownedDocument.eq).toHaveBeenNthCalledWith(1, "id", documentId);
    expect(ownedDocument.eq).toHaveBeenNthCalledWith(2, "product_id", productId);
    expect(ownedDocument.eq).toHaveBeenNthCalledWith(3, "user_id", userId);
  });

  it("rejects unexpected request fields without creating a job", async () => {
    const documentQuery = ownedDocumentQuery({
      data: { id: documentId, product_id: productId, user_id: userId, ingestion_status: "uploaded", index_version: 0 },
      error: null,
    });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => documentQuery),
    });

    const response = await POST(makeRequest("POST", {
      idempotencyKey: "6d109d93-e712-4fd7-a6ae-2a403460cd3a",
      status: "indexed",
    }), context);

    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a new request while the document is in a disallowed state", async () => {
    const documentQuery = ownedDocumentQuery({
      data: { id: documentId, product_id: productId, user_id: userId, ingestion_status: "extracting", index_version: 0 },
      error: null,
    });
    const idempotencyQuery = ownedDocumentQuery({ data: null, error: null });
    const activeJobQuery = ownedDocumentQuery({ data: null, error: null });
    activeJobQuery.in = vi.fn(() => activeJobQuery);
    let jobReads = 0;
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "product_documents") return documentQuery;
        jobReads += 1;
        return jobReads === 1 ? idempotencyQuery : activeJobQuery;
      }),
    });

    const response = await POST(makeRequest("POST", {
      idempotencyKey: "6d109d93-e712-4fd7-a6ae-2a403460cd3a",
    }), context);

    expect(response.status).toBe(409);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("creates a durable job and reports pending dispatch without changing document state", async () => {
    const documentQuery = ownedDocumentQuery({
      data: { id: documentId, product_id: productId, user_id: userId, ingestion_status: "indexed", index_version: 3 },
      error: null,
    });
    const idempotencyQuery = ownedDocumentQuery({ data: null, error: null });
    const activeJobQuery = ownedDocumentQuery({ data: null, error: null });
    activeJobQuery.in = vi.fn(() => activeJobQuery);
    let jobReads = 0;
    const createdJob = {
      id: "2d109d93-e712-4fd7-a6ae-2a403460cd3a",
      document_id: documentId,
      status: "queued",
      dispatch_status: "pending",
      target_index_version: 4,
      created_at: "2026-10-23T10:00:00.000Z",
    };
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: createdJob, error: null }) })),
    }));
    const adminFrom = vi.fn(() => ({ insert }));
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "product_documents") return documentQuery;
        jobReads += 1;
        return jobReads === 1 ? idempotencyQuery : activeJobQuery;
      }),
    });
    createAdminClient.mockReturnValue({ from: adminFrom });

    const response = await POST(makeRequest("POST", {
      idempotencyKey: "6d109d93-e712-4fd7-a6ae-2a403460cd3a",
    }), context);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      job: {
        id: createdJob.id,
        status: "queued",
        dispatchStatus: "pending",
        targetIndexVersion: 4,
        createdAt: createdJob.created_at,
      },
    });
    expect(insert).toHaveBeenCalledWith({
      user_id: userId,
      document_id: documentId,
      target_index_version: 4,
      idempotency_key: "6d109d93-e712-4fd7-a6ae-2a403460cd3a",
    });
    expect(documentQuery.update).toBeUndefined();
  });

  it("returns the same pending job when the idempotency key is repeated", async () => {
    const documentQuery = ownedDocumentQuery({
      data: {
        id: documentId,
        product_id: productId,
        user_id: userId,
        ingestion_status: "indexed",
        index_version: 3,
      },
      error: null,
    });
    const existingJob = {
      id: "2d109d93-e712-4fd7-a6ae-2a403460cd3a",
      user_id: userId,
      document_id: documentId,
      target_index_version: 4,
      idempotency_key: "6d109d93-e712-4fd7-a6ae-2a403460cd3a",
      status: "queued",
      dispatch_status: "pending",
      created_at: "2026-10-23T10:00:00.000Z",
    };
    const idempotencyQuery = ownedDocumentQuery({ data: existingJob, error: null });
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn((table: string) => table === "product_documents" ? documentQuery : idempotencyQuery),
    });

    const response = await POST(makeRequest("POST", {
      idempotencyKey: existingJob.idempotency_key,
    }), context);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      job: {
        id: existingJob.id,
        status: "queued",
        dispatchStatus: "pending",
        targetIndexVersion: 4,
        createdAt: existingJob.created_at,
      },
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns only safe ingestion and job status for the owned product document", async () => {
    const document = {
      id: documentId,
      product_id: productId,
      user_id: userId,
      ingestion_status: "needs_review",
      ingestion_warning_code: "ocr_required",
      indexed_at: null,
      index_version: 0,
    };
    const documentQuery = ownedDocumentQuery({ data: document, error: null });
    const jobQuery = ownedDocumentQuery({
      data: {
        id: "2d109d93-e712-4fd7-a6ae-2a403460cd3a",
        status: "needs_review",
        dispatch_status: "dispatched",
        attempt_count: 1,
        updated_at: "2026-10-23T10:00:00.000Z",
        safe_error_code: "ocr_required",
        storage_path: "must-not-escape",
        content: "must-not-escape",
      },
      error: null,
    });
    jobQuery.order = vi.fn(() => jobQuery);
    jobQuery.limit = vi.fn(() => jobQuery);
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn((table: string) => table === "product_documents" ? documentQuery : jobQuery),
    });

    const response = await GET(makeRequest("GET"), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "needs_review",
      warningCode: "ocr_required",
      indexedAt: null,
      indexVersion: 0,
      job: {
        id: "2d109d93-e712-4fd7-a6ae-2a403460cd3a",
        status: "needs_review",
        dispatchStatus: "dispatched",
        attemptCount: 1,
        updatedAt: "2026-10-23T10:00:00.000Z",
        safeErrorCode: "ocr_required",
      },
    });
  });
});
