import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const insert = vi.fn();
const select = vi.fn();
const single = vi.fn();

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/reminders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  single.mockResolvedValue({ data: { id: "reminder-1", status: "scheduled" }, error: null });
  select.mockReturnValue({ single });
  insert.mockReturnValue({ select });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockReturnValue({ insert }),
  });
});

describe("replenishment reminders", () => {
  it("schedules an in-app reminder against an owned product", async () => {
    const response = await POST(makeRequest({
      productId: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      estimateDays: 45,
      remindAt: "2026-12-01",
      user_id: "another-user",
      channel: "email",
    }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId,
      product_id: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      channel: "in_app",
      status: "scheduled",
      reason: expect.stringContaining("45-day"),
      remind_at: "2026-12-01T09:00:00+05:30",
    }));
  });

  it("rejects unusable reminder dates and estimates without writing", async () => {
    const response = await POST(makeRequest({
      productId: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      estimateDays: 0,
      remindAt: "not-a-date",
    }));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});
