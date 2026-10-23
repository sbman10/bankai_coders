import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const claimId = "a5417f3e-19d7-4be3-bb8c-123456789abc";
const key = "6d9d35df-a035-4a95-ad77-62936735f47f";
const claimMaybeSingle = vi.fn();
const approvalInsert = vi.fn();
const approvalSelect = vi.fn();
const approvalEq = vi.fn();
const approvalMaybeSingle = vi.fn();

const context = { params: Promise.resolve({ id: claimId }) };
const approvedContent = "Hello support, my headphones stopped working. Please advise on next steps.";

function request(body: unknown) {
  return new Request(`http://localhost/api/claims/${claimId}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { approvedContent, idempotencyKey: key, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  claimMaybeSingle.mockResolvedValue({ data: { id: claimId, status: "ready_for_review", claim_draft: "Generated draft" }, error: null });
  approvalInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "approval-1", claim_id: claimId, approved_content: approvedContent, action_status: "draft_only" }, error: null }) }) });
  approvalSelect.mockReturnValue({ eq: approvalEq });
  approvalEq.mockReturnValue({ eq: approvalEq, maybeSingle: approvalMaybeSingle });
  approvalMaybeSingle.mockResolvedValue({ data: null, error: null });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn((table: string) => table === "claims"
      ? { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: claimMaybeSingle }) }) }) }
      : { insert: approvalInsert, select: approvalSelect }),
  });
});

describe("claim approval gate", () => {
  it("records the exact edited content as draft-only for a reviewable claim", async () => {
    const response = await POST(request(validBody()), context);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.approval).toEqual(expect.objectContaining({ approved_content: approvedContent, action_status: "draft_only" }));
    expect(approvalInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId,
      claim_id: claimId,
      approved_content: approvedContent,
      action_status: "draft_only",
      content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      idempotency_key: key,
    }));
  });

  it("does not record approval before processing has produced a reviewable draft", async () => {
    claimMaybeSingle.mockResolvedValue({ data: { id: claimId, status: "received", claim_draft: null }, error: null });
    const response = await POST(request(validBody()), context);

    expect(response.status).toBe(409);
    expect(approvalInsert).not.toHaveBeenCalled();
  });

  it("does not approve a claim owned by a different user", async () => {
    claimMaybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await POST(request(validBody()), context);

    expect(response.status).toBe(404);
    expect(approvalInsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid approval idempotency key", async () => {
    const response = await POST(request(validBody({ idempotencyKey: "reused" })), context);

    expect(response.status).toBe(400);
    expect(approvalInsert).not.toHaveBeenCalled();
  });

  it("returns the prior approval after the same exact content collides on retry", async () => {
    approvalInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } }) }) });
    approvalMaybeSingle.mockResolvedValue({ data: { id: "approval-1", claim_id: claimId, approved_content: approvedContent, action_status: "draft_only" }, error: null });
    const response = await POST(request(validBody()), context);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.duplicate).toBe(true);
    expect(result.approval.action_status).toBe("draft_only");
  });
});
