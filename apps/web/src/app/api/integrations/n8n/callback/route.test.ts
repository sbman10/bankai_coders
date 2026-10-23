import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { POST } from "./route";

const originalSecret = process.env.N8N_CALLBACK_SECRET;
const originalSupabaseSecret = process.env.SUPABASE_SECRET_KEY;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rpc = vi.fn();
const claimId = "b4e1c9f0-342f-4f99-9c7f-e7ff2f5e3441";
const eventId = "a5417f3e-19d7-4be3-bb8c-123456789abc";

function makeRequest(body: unknown, secret = "callback-test-secret") {
  return new Request("http://localhost/api/integrations/n8n/callback", {
    method: "POST",
    headers: { "content-type": "application/json", "x-claimforge-callback-secret": secret },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    eventId,
    claimId,
    status: "ready_for_review",
    assessment: "likely within stated term",
    claimDraft: "Please review my warranty claim.",
    evidence: [{ kind: "warranty_clause", content: "Coverage lasts 12 months.", sourcePage: 2, confidence: 0.98 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.N8N_CALLBACK_SECRET = "callback-test-secret";
  process.env.SUPABASE_SECRET_KEY = "test-supabase-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  rpc.mockResolvedValue({ data: { duplicate: false, claimId, status: "ready_for_review" }, error: null });
  createAdminClient.mockReturnValue({ rpc });
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.N8N_CALLBACK_SECRET;
  else process.env.N8N_CALLBACK_SECRET = originalSecret;
  if (originalSupabaseSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSupabaseSecret;
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
});

describe("n8n claim-processing callback", () => {
  it("authenticates the workflow and stores a validated result idempotently", async () => {
    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, duplicate: false, claimId, status: "ready_for_review" });
    expect(rpc).toHaveBeenCalledWith("apply_claim_processing_result", expect.objectContaining({
      p_claim_id: claimId,
      p_event_id: `${claimId}:${eventId}`,
      p_status: "ready_for_review",
      p_assessment: "likely within stated term",
      p_claim_draft: "Please review my warranty claim.",
      p_evidence: [{
        kind: "warranty_clause",
        content: "Coverage lasts 12 months.",
        source_page: 2,
        confidence: 0.98,
        document_id: null,
      }],
    }));
  });

  it("rejects forged callbacks without touching Supabase", async () => {
    const response = await POST(makeRequest(validBody(), "wrong-secret"));

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects unsupported claim statuses and assessment labels", async () => {
    const response = await POST(makeRequest(validBody({ status: "approved", assessment: "approved" })));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires a review draft before a claim can become ready for review", async () => {
    const response = await POST(makeRequest(validBody({ claimDraft: "" })));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects evidence with a document reference that is not a UUID", async () => {
    const response = await POST(makeRequest(validBody({ evidence: [{ kind: "warranty_clause", content: "Term", documentId: "other-user-file" }] })));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the idempotent result from the database without repeating work", async () => {
    rpc.mockResolvedValue({ data: { duplicate: true, claimId, status: "ready_for_review" }, error: null });

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, duplicate: true, claimId, status: "ready_for_review" });
  });

  it("does not expose Supabase errors or secrets", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "internal database detail" } });

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "The claim-processing result could not be saved." });
  });
});
