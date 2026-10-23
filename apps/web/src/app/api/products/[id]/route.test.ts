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
const countSelect = vi.fn();
const countEq = vi.fn();
let dependencyCount = 0;

function makeRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/products/product-1", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "7d87b716-e870-4a40-a6b8-fcd6f6b0d6ee" }) };

beforeEach(() => {
  vi.clearAllMocks();
  dependencyCount = 0;
  maybeSingle.mockResolvedValue({ data: { id: context.params }, error: null });
  select.mockReturnValue({ maybeSingle });
  eq.mockReturnValue({ eq, select });
  update.mockReturnValue({ eq });
  remove.mockReturnValue({ eq });
  const countBuilder = { eq: countEq, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ count: dependencyCount, error: null }).then(resolve) };
  countEq.mockReturnValue(countBuilder);
  countSelect.mockReturnValue(countBuilder);
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn((table: string) => table === "products" ? { update, delete: remove } : { select: countSelect }),
  });
});

describe("product ownership", () => {
  it("edits only the signed-in user's product", async () => {
    const response = await PATCH(makeRequest("PATCH", { name: "Updated headphones", brand: "Auralis", model: "Pulse 2", seller: "Example Store", serialNumber: "SN-123456" }), context);

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ name: "Updated headphones", brand: "Auralis", model: "Pulse 2", seller: "Example Store", serial_number: "SN-123456" });
    expect(eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("deletes only the signed-in user's product", async () => {
    const response = await DELETE(makeRequest("DELETE"), context);

    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("does not treat another user's product as editable", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await PATCH(makeRequest("PATCH", { name: "Updated" }), context);

    expect(response.status).toBe(404);
  });

  it("protects product-linked claim and document records from cascading deletion", async () => {
    dependencyCount = 1;

    const response = await DELETE(makeRequest("DELETE"), context);

    expect(response.status).toBe(409);
    expect(remove).not.toHaveBeenCalled();
  });
});
