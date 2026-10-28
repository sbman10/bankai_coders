import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { PATCH } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const upsert = vi.fn();
const select = vi.fn();
const single = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  single.mockResolvedValue({ data: { reminder_email_enabled: true }, error: null });
  select.mockReturnValue({ single });
  upsert.mockReturnValue({ select });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockReturnValue({ upsert }),
  });
});

describe("PATCH /api/notification-preferences", () => {
  it("saves email opt-in for the authenticated user, not a body-supplied identity", async () => {
    const response = await PATCH(new Request("http://localhost/api/notification-preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reminderEmailEnabled: true, user_id: "another-user" }),
    }));

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({ user_id: userId, reminder_email_enabled: true }, { onConflict: "user_id" });
  });
});
