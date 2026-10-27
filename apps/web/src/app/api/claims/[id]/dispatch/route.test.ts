import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, dispatchClaimIntake } = vi.hoisted(() => ({ createClient: vi.fn(), dispatchClaimIntake: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/claims/dispatch-claim-intake", () => ({ dispatchClaimIntake }));

import { POST } from "./route";

const claimId = "1946a9a2-3e28-4e07-88c1-6bc1716a2bc6";
const eventId = "a5417f3e-19d7-4be3-bb8c-123456789abc";
const context = { params: Promise.resolve({ id: claimId }) };
const maybeSingle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { event_id: eventId, dispatch_status: "pending" }, error: null });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "signed-in-user" } }, error: null }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
    })),
  });
  dispatchClaimIntake.mockResolvedValue("accepted");
});

afterEach(() => vi.clearAllMocks());

describe("POST /api/claims/[id]/dispatch", () => {
  it("requires a signed-in owner and retries only the claim's outbox event", async () => {
    const response = await POST(new Request(`http://localhost/api/claims/${claimId}/dispatch`, { method: "POST" }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ automation: "accepted" });
    expect(dispatchClaimIntake).toHaveBeenCalledWith(eventId);
  });

  it("does not dispatch when RLS cannot find an event for this signed-in user", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await POST(new Request(`http://localhost/api/claims/${claimId}/dispatch`, { method: "POST" }), context);

    expect(response.status).toBe(404);
    expect(dispatchClaimIntake).not.toHaveBeenCalled();
  });

  it("does not send a second webhook for an already-dispatched event", async () => {
    maybeSingle.mockResolvedValue({ data: { event_id: eventId, dispatch_status: "dispatched" }, error: null });

    const response = await POST(new Request(`http://localhost/api/claims/${claimId}/dispatch`, { method: "POST" }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ automation: "accepted" });
    expect(dispatchClaimIntake).not.toHaveBeenCalled();
  });

  it("rejects malformed claim IDs before reading user data", async () => {
    const response = await POST(new Request("http://localhost/api/claims/not-a-uuid/dispatch", { method: "POST" }), { params: Promise.resolve({ id: "not-a-uuid" }) });

    expect(response.status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
  });
});
