import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const order = vi.fn();
const limit = vi.fn();
const eq = vi.fn();
const is = vi.fn();
const select = vi.fn();
const from = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  limit.mockResolvedValue({ data: [{ id: "notice-1", user_id: userId, read_at: null }], error: null });
  order.mockReturnValue({ limit });
  is.mockResolvedValue({ count: 1, error: null });
  eq.mockReturnValue({ order, is });
  select.mockReturnValue({ eq });
  from.mockReturnValue({ select });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from,
  });
});

describe("GET /api/notifications", () => {
  it("returns a private, owner-filtered inbox and unread count", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(from).toHaveBeenCalledWith("notifications");
    expect(eq).toHaveBeenCalledWith("user_id", userId);
    expect((await response.json()).unreadCount).toBe(1);
  });

  it("rejects an unauthenticated inbox request", async () => {
    createClient.mockResolvedValueOnce({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) }, from });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
});
