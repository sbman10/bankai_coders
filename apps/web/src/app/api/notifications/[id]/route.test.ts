import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { PATCH } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const update = vi.fn();
const eqId = vi.fn();
const eqOwner = vi.fn();
const isRead = vi.fn();
const select = vi.fn();
const maybeSingle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { id: "notice-1" }, error: null });
  select.mockReturnValue({ maybeSingle });
  isRead.mockReturnValue({ select });
  eqOwner.mockReturnValue({ is: isRead });
  eqId.mockReturnValue({ eq: eqOwner });
  update.mockReturnValue({ eq: eqId });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockReturnValue({ update }),
  });
});

describe("PATCH /api/notifications/[id]", () => {
  it("marks only an unread notification owned by the signed-in user as read", async () => {
    const response = await PATCH(new Request("http://localhost/api/notifications/notice-1", { method: "PATCH" }), {
      params: Promise.resolve({ id: "a746fbe1-a663-44ac-88f7-2e99e9022bc5" }),
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }));
    expect(eqOwner).toHaveBeenCalledWith("user_id", userId);
    expect(isRead).toHaveBeenCalledWith("read_at", null);
  });
});
