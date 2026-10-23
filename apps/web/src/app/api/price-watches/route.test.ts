import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const insert = vi.fn();
const select = vi.fn();
const single = vi.fn();

function request(body: unknown) {
  return new Request("http://localhost/api/price-watches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  single.mockResolvedValue({ data: { id: "watch-1", checking_mode: "manual" }, error: null });
  select.mockReturnValue({ single });
  insert.mockReturnValue({ select });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockReturnValue({ insert }),
  });
});

describe("manual price watch creation", () => {
  it("stores a manual watch under the signed-in owner", async () => {
    const response = await POST(request({
      productId: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      currentPrice: 2499,
      targetPrice: 1999,
      productUrl: "https://store.example/item",
      user_id: "another-user",
      checking_mode: "automated",
    }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId,
      product_id: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      current_price: 2499,
      target_price: 1999,
      checking_mode: "manual",
    }));
    expect(insert.mock.calls[0][0].user_id).not.toBe("another-user");
  });

  it("rejects non-HTTPS product links without writing", async () => {
    const response = await POST(request({
      productId: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      currentPrice: 2499,
      targetPrice: 1999,
      productUrl: "http://store.example/item",
    }));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});
