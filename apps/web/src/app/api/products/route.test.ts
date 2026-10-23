import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const insert = vi.fn();
const select = vi.fn();
const single = vi.fn();

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  single.mockResolvedValue({ data: { id: "product-1", name: "Headphones" }, error: null });
  select.mockReturnValue({ single });
  insert.mockReturnValue({ select });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockReturnValue({ insert }),
  });
});

describe("product creation", () => {
  it("saves a product under the authenticated user", async () => {
    const response = await POST(makeRequest({
      name: "Headphones",
      brand: "Auralis",
      model: "Pulse 2",
      category: "Audio",
      seller: "Example Store",
      serialNumber: "SN-123456",
      purchaseDate: "2026-02-12",
      warrantyEnd: "2027-02-12",
      user_id: "another-user",
    }));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.product.id).toBe("product-1");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: userId,
      name: "Headphones",
      brand: "Auralis",
      model: "Pulse 2",
      category: "Audio",
      seller: "Example Store",
      serial_number: "SN-123456",
      purchase_date: "2026-02-12",
      warranty_end: "2027-02-12",
    }));
    expect(insert.mock.calls[0][0].user_id).not.toBe("another-user");
  });

  it("rejects an invalid date without writing to Supabase", async () => {
    const response = await POST(makeRequest({ name: "Headphones", purchaseDate: "2026-02-31" }));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn().mockReturnValue({ insert }),
    });

    const response = await POST(makeRequest({ name: "Headphones" }));

    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });
});
