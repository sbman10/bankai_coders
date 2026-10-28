import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { PATCH } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const update = vi.fn();
const eqId = vi.fn();
const eqOwner = vi.fn();
const inStatus = vi.fn();
const select = vi.fn();
const maybeSingle = vi.fn();

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/reminders/reminder-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { id: "reminder-1", status: "scheduled" }, error: null });
  select.mockReturnValue({ maybeSingle });
  inStatus.mockReturnValue({ select });
  eqOwner.mockReturnValue({ in: inStatus });
  eqId.mockReturnValue({ eq: eqOwner });
  update.mockReturnValue({ eq: eqId });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockReturnValue({ update }),
  });
});

describe("PATCH /api/reminders/[id]", () => {
  it("snoozes an owned scheduled or already-delivered reminder to a future local date", async () => {
    const response = await PATCH(makeRequest({ action: "snooze", remindAt: "2026-12-02", user_id: "someone-else" }), {
      params: Promise.resolve({ id: "a746fbe1-a663-44ac-88f7-2e99e9022bc5" }),
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ remind_at: "2026-12-02T09:00:00+05:30", status: "scheduled" });
    expect(eqOwner).toHaveBeenCalledWith("user_id", userId);
    expect(inStatus).toHaveBeenCalledWith("status", ["scheduled", "sent"]);
  });

  it("rejects unknown actions before writing", async () => {
    const response = await PATCH(makeRequest({ action: "send" }), {
      params: Promise.resolve({ id: "a746fbe1-a663-44ac-88f7-2e99e9022bc5" }),
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("lets the owner complete a reminder after its notification has been delivered", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "reminder-1", status: "completed" }, error: null });
    const response = await PATCH(makeRequest({ action: "complete" }), {
      params: Promise.resolve({ id: "a746fbe1-a663-44ac-88f7-2e99e9022bc5" }),
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", completed_at: expect.any(String) }));
    expect(inStatus).toHaveBeenCalledWith("status", ["scheduled", "sent"]);
  });
});
