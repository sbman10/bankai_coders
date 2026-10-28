import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const rpc = vi.fn();
const select = vi.fn();
const single = vi.fn();
const eq = vi.fn();

function request(body: unknown) {
  return new Request("http://localhost/api/price-watches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: "watch-1", error: null });
  single.mockResolvedValue({ data: { id: "watch-1", checking_mode: "manual" }, error: null });
  eq.mockReturnValue({ eq, single });
  select.mockReturnValue({ eq });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    rpc,
    from: vi.fn().mockReturnValue({ select }),
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
    expect(rpc).toHaveBeenCalledWith("create_price_watch_with_initial_observation", expect.objectContaining({
      p_product_id: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      p_current_price: 2499,
      p_target_price: 1999,
      p_checking_mode: "manual",
    }));
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("p_user_id");
  });

  it("rejects non-HTTPS product links without writing", async () => {
    const response = await POST(request({
      productId: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      currentPrice: 2499,
      targetPrice: 1999,
      productUrl: "http://store.example/item",
    }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("enables daily checking only when the user requests it for a supported retailer URL", async () => {
    const response = await POST(request({
      productId: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      currentPrice: 2499,
      targetPrice: 1999,
      productUrl: "https://www.amazon.in/dp/B0CX21CBRX",
      checkingMode: "automated",
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_price_watch_with_initial_observation", expect.objectContaining({
      p_checking_mode: "automated",
      p_current_price: 2499,
    }));
  });

  it("rejects automated checks for unsupported hosts", async () => {
    const response = await POST(request({
      productId: "a746fbe1-a663-44ac-88f7-2e99e9022bc5",
      currentPrice: 2499,
      targetPrice: 1999,
      productUrl: "https://attacker.example/item",
      checkingMode: "automated",
    }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
