import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { DELETE, PATCH } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const update = vi.fn();
const remove = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const maybeSingle = vi.fn();
const context = { params: Promise.resolve({ id: "3f2be616-8139-4c51-9f9e-7a46f388ab2d" }) };

function makeRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/price-watches/watch-1", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: { id: "watch-1", current_price: 1899 }, error: null });
  select.mockReturnValue({ maybeSingle });
  eq.mockReturnValue({ eq, select });
  update.mockReturnValue({ eq });
  remove.mockReturnValue({ eq });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockReturnValue({ update, delete: remove }),
  });
});

describe("manual price watches", () => {
  it("records a user-entered price for the signed-in user's watch", async () => {
    const response = await PATCH(makeRequest("PATCH", { currentPrice: 1899 }), context);

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ current_price: 1899, last_checked_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("rejects negative prices without writing", async () => {
    const response = await PATCH(makeRequest("PATCH", { currentPrice: -1 }), context);

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("allows a signed-in user to remove only their own watch", async () => {
    const response = await DELETE(makeRequest("DELETE"), context);

    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("user_id", userId);
  });
});
