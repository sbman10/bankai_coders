import { beforeEach, describe, expect, it, vi } from "vitest";

const { authGetUser, productsLimit } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  productsLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/configured", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: authGetUser },
    from: () => ({ select: () => ({ eq: () => ({ limit: productsLimit }) }) }),
  }),
}));
vi.mock("@/lib/ocr/openai-parser", () => ({
  extractFieldsFromText: async () => ({
    brand: "Example",
    product_name: "Example headphones",
    model: null,
    category: "Audio",
    serial_number: null,
    invoice_number: "INV-1",
    order_id: null,
    purchase_date: null,
    seller: null,
    price: 100,
    currency: "INR",
    warranty_duration: null,
    warranty_start_date: null,
    warranty_end_date: null,
    quantity: 1,
    source_marketplace: null,
    owner_name: null,
    buying_method: null,
  }),
}));

import { POST } from "./route";

describe("invoice barcode image enrichment", () => {
  beforeEach(() => {
    authGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    productsLimit.mockResolvedValue({ data: [], error: null });
  });

  it("looks up a printed invoice barcode for a signed-in user and returns the catalog image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ title: "Example headphones", images: ["https://images.example/headphones.jpg"] }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "EAN: 4002293401102" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      imageUrl: "https://images.example/headphones.jpg",
      extracted: { image_url: "https://images.example/headphones.jpg" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps extraction successful without a barcode or catalog result", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Invoice for Example headphones" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, imageUrl: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
