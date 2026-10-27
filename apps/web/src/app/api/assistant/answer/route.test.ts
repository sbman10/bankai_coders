import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const productId = "7d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const documentId = "8d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const productMaybeSingle = vi.fn();
const documentIn = vi.fn();
const rpc = vi.fn();
const functionsInvoke = vi.fn();
const fetchMock = vi.fn();

function request(body: unknown) {
  return new Request("http://localhost/api/assistant/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { productId, documentIds: [documentId], question: "Does this warranty cover a speaker failure?", ...overrides };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  productMaybeSingle.mockResolvedValue({ data: { id: productId }, error: null });
  documentIn.mockResolvedValue({ data: [{ id: documentId, ingestion_status: "indexed", index_version: 1 }], error: null });
  rpc.mockResolvedValue({ data: [], error: null });
  functionsInvoke.mockResolvedValue({ data: {
    embedding: Array.from({ length: 384 }, () => 0.125),
    modelAlias: "gte-small",
    modelRepository: "Supabase/gte-small",
    modelRevision: null,
    dimension: 384,
    pooling: "mean",
    normalized: true,
  }, error: null });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn((table: string) => table === "products"
      ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: productMaybeSingle })) })) })) }
      : { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ in: documentIn })) })) })) }),
    rpc,
    functions: { invoke: functionsInvoke },
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("document-grounded assistant answer route", () => {
  it("requires a signed-in user", async () => {
    createClient.mockResolvedValueOnce({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } });
    const response = await POST(request(validBody()));

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed or incomplete question requests", async () => {
    const response = await POST(request(validBody({ documentIds: [], question: " " })));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects questions that exceed the embedding model input bound", async () => {
    const response = await POST(request(validBody({ question: "w".repeat(401) })));
    expect(response.status).toBe(400);
  });

  it("does not retrieve when any selected document is not owned by the user and product", async () => {
    documentIn.mockResolvedValueOnce({ data: [], error: null });
    const response = await POST(request(validBody()));

    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not answer from a selected document that is not ready for search", async () => {
    documentIn.mockResolvedValueOnce({ data: [{ id: documentId, ingestion_status: "needs_review", index_version: 0 }], error: null });

    const response = await POST(request(validBody()));

    expect(response.status).toBe(409);
    expect(functionsInvoke).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("abstains when retrieval returns evidence outside the selected documents", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "test-model");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        status: "conditional",
        answer: "The synthetic unselected policy may apply.",
        documentFacts: [],
        userFactsUsed: [],
        inferences: [],
        citations: [{ chunkId: "9d87b716-e870-4a40-a6b8-fcd6f6b0d6ee" }],
        missingInformation: [],
        followUpQuestions: [],
      }) } }],
    }), { status: 200 }));
    rpc.mockResolvedValueOnce({
      data: [{
        chunk_id: "9d87b716-e870-4a40-a6b8-fcd6f6b0d6ee",
        document_id: "ad87b716-e870-4a40-a6b8-fcd6f6b0d6ee",
        document_name: "Unselected synthetic policy",
        page_number: 7,
        section_path: "Exclusions",
        content: "Synthetic exclusion text for an unselected document.",
        extraction_confidence: 1,
      }],
      error: null,
    });

    const response = await POST(request(validBody()));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe("insufficient_evidence");
    expect(result.citations).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("abstains when Groq returns a citation ID absent from retrieved evidence", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "test-model");
    rpc.mockResolvedValueOnce({
      data: [{
        chunk_id: "9d87b716-e870-4a40-a6b8-fcd6f6b0d6ee",
        document_id: documentId,
        document_name: "Synthetic policy.pdf",
        page_number: 2,
        section_path: "Coverage",
        content: "Synthetic coverage clause.",
        extraction_confidence: null,
      }],
      error: null,
    });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        status: "supported",
        answer: "A synthetic claim is covered.",
        documentFacts: ["The policy covers the claim."],
        userFactsUsed: [],
        inferences: [],
        citations: [{ chunkId: "bd87b716-e870-4a40-a6b8-fcd6f6b0d6ee" }],
        missingInformation: [],
        followUpQuestions: [],
      }) } }],
    }), { status: 200 }));

    const response = await POST(request(validBody()));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe("insufficient_evidence");
    expect(result.citations).toEqual([]);
    expect(result.answer).toMatch(/couldn’t verify/i);
  });

  it("does not present a decisive conclusion when the model reports conflicting clauses", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "test-model");
    rpc.mockResolvedValueOnce({
      data: [{
        chunk_id: "9d87b716-e870-4a40-a6b8-fcd6f6b0d6ee",
        document_id: documentId,
        document_name: "Synthetic policy.pdf",
        page_number: 2,
        section_path: "Coverage",
        content: "Synthetic conflicting coverage clause.",
        extraction_confidence: null,
      }],
      error: null,
    });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        status: "conflicting_terms",
        answer: "You are definitely covered.",
        documentFacts: ["One clause appears to cover the event."],
        userFactsUsed: [],
        inferences: [],
        citations: [{ chunkId: "9d87b716-e870-4a40-a6b8-fcd6f6b0d6ee" }],
        missingInformation: ["Which policy version applies?"],
        followUpQuestions: ["Can you confirm the policy version?"],
      }) } }],
    }), { status: 200 }));

    const response = await POST(request(validBody()));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe("conflicting_terms");
    expect(result.answer).not.toMatch(/definitely covered/i);
    expect(result.answer).toMatch(/can’t determine|cannot determine/i);
    expect(result.citations).toEqual([expect.objectContaining({ documentName: "Synthetic policy.pdf", page: 2, section: "Coverage" })]);
  });

  it("uses retrieval constrained to the signed-in user's selected product and documents", async () => {
    await POST(request(validBody()));

    expect(functionsInvoke).toHaveBeenCalledWith("embed-text", {
      body: { text: "Does this warranty cover a speaker failure?" },
    });
    expect(rpc).toHaveBeenCalledWith("search_selected_document_chunks_by_embedding", {
      p_query_embedding: Array.from({ length: 384 }, () => 0.125),
      p_product_id: productId,
      p_document_ids: [documentId],
      p_result_limit: 8,
    });
  });

  it("can cite an exact policy phrase found by keyword search when vector search misses it", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "test-model");
    const chunkId = "9d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
    rpc.mockImplementation(async (name: string) => name === "search_selected_document_chunks"
      ? { data: [{ chunk_id: chunkId, document_id: documentId, document_name: "Synthetic warranty.pdf", page_number: 3, section_path: "Exclusions", content: "Accidental damage is excluded from this synthetic warranty.", extraction_confidence: null }], error: null }
      : { data: [], error: null });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      status: "supported", answer: "The selected warranty excludes accidental damage.",
      documentFacts: ["Accidental damage is excluded."], userFactsUsed: [], inferences: [],
      citations: [{ chunkId }], missingInformation: [], followUpQuestions: [],
    }) } }] }), { status: 200 }));

    const response = await POST(request(validBody({ question: "Is accidental damage excluded?" })));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe("supported");
    expect(result.citations).toEqual([expect.objectContaining({ chunkId, page: 3, section: "Exclusions" })]);
    expect(rpc).toHaveBeenCalledWith("search_selected_document_chunks", {
      p_query_text: "Is accidental damage excluded?", p_product_id: productId,
      p_document_ids: [documentId], p_result_limit: 8,
    });
  });

  it("does not search or answer when query embedding is unavailable", async () => {
    functionsInvoke.mockResolvedValueOnce({ data: null, error: { message: "private provider detail" } });

    const response = await POST(request(validBody()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Semantic document search is unavailable. Please try again later." });
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("abstains without calling Groq when selected documents contain no matching evidence", async () => {
    const response = await POST(request(validBody()));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe("insufficient_evidence");
    expect(result.citations).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

});
