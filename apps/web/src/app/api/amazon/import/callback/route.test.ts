import { timingSafeEqual } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoist Supabase admin mock ─────────────────────────────────────────────────
const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const SECRET = "test-callback-secret-abc";
const userId = "a1b2c3d4-0000-4000-8000-000000000001";
const jobId = "b2c3d4e5-0001-4000-8000-000000000002";
const asin = "B0CJST1BFX";

function makeRequest(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-claimforge-callback-secret"] = secret;
  return new Request("http://localhost/api/amazon/import/callback", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const validPayload = {
  jobId,
  userId,
  asin,
  marketplace: "www.amazon.in",
  name: "Sony WH-1000XM5 Wireless Headphones",
  brand: "Sony",
  model: "WH-1000XM5",
  category: "Electronics",
  description: "Industry-leading noise cancelling headphones.",
  features: ["30-hour battery life", "Multipoint connection"],
  imageUrls: ["https://m.media-amazon.com/images/I/example.jpg"],
  sourceUrl: "https://www.amazon.in/dp/B0CJST1BFX",
};

const maybeSingle = vi.fn();
const limit = vi.fn();
const eq2 = vi.fn();
const eq1 = vi.fn();
const selectDup = vi.fn();
const fromDup = vi.fn();

const single = vi.fn();
const selectInsert = vi.fn();
const insert = vi.fn();
const fromInsert = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("N8N_CALLBACK_SECRET", SECRET);

  // Duplicate-check chain: .from().select().eq().eq().limit().maybeSingle()
  maybeSingle.mockResolvedValue({ data: null, error: null }); // no duplicate
  limit.mockReturnValue({ maybeSingle });
  eq2.mockReturnValue({ limit });
  eq1.mockReturnValue({ eq: eq2 });
  selectDup.mockReturnValue({ eq: eq1 });
  fromDup.mockReturnValue({ select: selectDup });

  // Insert chain: .from().insert().select().single()
  single.mockResolvedValue({
    data: { id: "product-uuid-1", name: validPayload.name, asin },
    error: null,
  });
  selectInsert.mockReturnValue({ single });
  insert.mockReturnValue({ select: selectInsert });
  fromInsert.mockReturnValue({ insert });

  // Alternate between the two chains based on call order
  createAdminClient.mockReturnValue({
    from: vi.fn()
      .mockReturnValueOnce({ select: selectDup }) // first call = duplicate check
      .mockReturnValueOnce({ insert }),            // second call = insert
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

import { POST } from "./route";

describe("POST /api/amazon/import/callback", () => {
  it("saves a new product and returns the product id", async () => {
    const response = await POST(makeRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.duplicate).toBe(false);
    expect(body.productId).toBe("product-uuid-1");
  });

  it("detects a duplicate ASIN and returns existingProductId without inserting", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "existing-product-123" }, error: null });

    const response = await POST(makeRequest(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.duplicate).toBe(true);
    expect(body.existingProductId).toBe("existing-product-123");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a request with a wrong callback secret", async () => {
    const response = await POST(makeRequest(validPayload, "wrong-secret"));
    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a request with no callback secret header", async () => {
    const response = await POST(makeRequest(validPayload, null));
    expect(response.status).toBe(401);
  });

  it("rejects payload with missing product name", async () => {
    const response = await POST(makeRequest({ ...validPayload, name: "" }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects payload with an invalid ASIN", async () => {
    const response = await POST(makeRequest({ ...validPayload, asin: "INVALID" }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects payload with an invalid jobId", async () => {
    const response = await POST(makeRequest({ ...validPayload, jobId: "not-a-uuid" }));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("strips ownership fields — purchase_date is never set from catalog data", async () => {
    const response = await POST(makeRequest({
      ...validPayload,
      purchase_date: "2026-01-01", // attacker tries to inject ownership data
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    // The insert payload should never carry purchase_date from body
    const insertedRow = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow.purchase_date).toBeNull();
  });

  it("returns 503 when callback secret env var is absent", async () => {
    vi.stubEnv("N8N_CALLBACK_SECRET", "");
    const response = await POST(makeRequest(validPayload));
    expect(response.status).toBe(503);
  });
});
