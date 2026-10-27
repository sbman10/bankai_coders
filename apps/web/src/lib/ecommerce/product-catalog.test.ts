import { afterEach, describe, expect, it, vi } from "vitest";
import { findGtinCandidates, isValidGtin, lookupBarcodeProductImage } from "./product-catalog";

describe("free barcode catalog lookup", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("validates supported GTIN lengths and check digits", () => {
    expect(isValidGtin("4002293401102")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("4002293401103")).toBe(false);
    expect(isValidGtin("1234567")).toBe(false);
  });

  it("prioritizes a labeled barcode and returns only checksum-valid candidates", () => {
    expect(findGtinCandidates("Order 123456789012, EAN: 4002293401102")).toEqual([
      "4002293401102",
    ]);
    expect(findGtinCandidates("Order ID: 4002293401102")).toEqual([]);
  });

  it("looks up a valid GTIN through the free no-key endpoint and returns a secure image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ title: "Example headphones", ean: "4002293401102", images: ["https://images.example/item.jpg"] }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupBarcodeProductImage("4002293401102")).resolves.toEqual({
      title: "Example headphones",
      imageUrl: "https://images.example/item.jpg",
      gtin: "4002293401102",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/prod/trial/lookup?upc=4002293401102");
  });

  it("does not call the provider for invalid codes and ignores insecure image URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ title: "Example", images: ["http://images.example/item.jpg"] }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupBarcodeProductImage("4002293401103")).resolves.toBeNull();
    await expect(lookupBarcodeProductImage("4002293401102")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats provider errors and rate limits as a nonfatal no-match", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(lookupBarcodeProductImage("4002293401102")).resolves.toBeNull();
  });
});
