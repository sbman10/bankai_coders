import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { processClaimIntake } = vi.hoisted(() => ({ processClaimIntake: vi.fn() }));
vi.mock("@/lib/claims/process-claim", () => ({ processClaimIntake }));

import { POST } from "./route";

const originalSecret = process.env.N8N_CALLBACK_SECRET;
const originalSupabaseSecret = process.env.SUPABASE_SECRET_KEY;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const claimId = "1946a9a2-3e28-4e07-88c1-6bc1716a2bc6";
const eventId = "a5417f3e-19d7-4be3-bb8c-123456789abc";

function request(body: unknown, secret = "processing-test-secret") {
  return new Request("http://localhost/api/integrations/n8n/process", {
    method: "POST",
    headers: { "content-type": "application/json", "x-claimforge-callback-secret": secret },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.N8N_CALLBACK_SECRET = "processing-test-secret";
  process.env.SUPABASE_SECRET_KEY = "test-only-service-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  processClaimIntake.mockResolvedValue({ status: "ready_for_review", duplicate: false });
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.N8N_CALLBACK_SECRET;
  else process.env.N8N_CALLBACK_SECRET = originalSecret;
  if (originalSupabaseSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSupabaseSecret;
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
});

describe("n8n claim processing endpoint", () => {
  it("rejects requests without the separate server-to-server secret", async () => {
    const response = await POST(request({ eventId, claimId }, "wrong-secret"));

    expect(response.status).toBe(401);
    expect(processClaimIntake).not.toHaveBeenCalled();
  });

  it("accepts only event and claim identifiers, then returns a safe status", async () => {
    const response = await POST(request({ eventId, claimId }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, duplicate: false, status: "ready_for_review" });
    expect(processClaimIntake).toHaveBeenCalledWith({ eventId, claimId });
  });

  it("rejects any request that attempts to pass document content", async () => {
    const response = await POST(request({ eventId, claimId, documentText: "private warranty text" }));

    expect(response.status).toBe(400);
    expect(processClaimIntake).not.toHaveBeenCalled();
  });

  it("preserves the existing result on an idempotent delivery", async () => {
    processClaimIntake.mockResolvedValue({ status: "ready_for_review", duplicate: true });
    const response = await POST(request({ eventId, claimId }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, duplicate: true, status: "ready_for_review" });
  });
});
