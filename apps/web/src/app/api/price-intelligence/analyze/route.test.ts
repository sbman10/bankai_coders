import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import { crossStoreService } from "@/lib/price-intelligence/cross-store-service";

describe("POST /api/price-intelligence/analyze", () => {
  it("rejects non-JSON or missing URL with 400 Bad Request", async () => {
    const req = new Request("http://localhost:3000/api/price-intelligence/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Valid product 'url' parameter is required");
  });

  it("successfully analyzes an Amazon URL and returns analysis payload", async () => {
    vi.spyOn(crossStoreService, "analyzeProductUrl").mockResolvedValue({
      sourceUrl: "https://www.amazon.in/dp/B0CX21CBRX",
      canonicalIdentity: {
        platform: "Amazon",
        sourceUrl: "https://www.amazon.in/dp/B0CX21CBRX",
        rawTitle: "Realme P4 5G",
        cleanTitle: "Realme P4 5G",
        brand: "Realme",
        model: "P4 5G",
        category: "Mobiles & Tablets",
        variant: { ram: "8GB", storage: "128GB" },
        seller: "Appario Retail",
        imageUrl: null,
      },
      detectedCategory: "Mobiles & Tablets",
      relevantPlatformsToSearch: ["Flipkart", "Croma", "Meesho"],
      suggestedCrossStoreSearchQuery: '"Realme P4 5G 8GB 128GB"',
      sourceQuote: {
        platform: "Amazon",
        productUrl: "https://www.amazon.in/dp/B0CX21CBRX",
        title: "Realme P4 5G",
        brand: "Realme",
        model: "P4 5G",
        variant: { ram: "8GB", storage: "128GB" },
        price: { current: 15999, currency: "INR", mrp: 19999 },
        availability: { status: "IN_STOCK", evidence: "Add to cart", confidence: 0.98 },
        seller: "Appario Retail",
        imageUrl: null,
        scrapedAt: new Date().toISOString(),
        rawConfidence: 0.98,
      },
      candidateEvaluations: [],
      comparisonSummary: null,
      cached: false,
      timestamp: new Date().toISOString(),
    });

    const req = new Request("http://localhost:3000/api/price-intelligence/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.amazon.in/dp/B0CX21CBRX" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.analysis.canonicalIdentity.brand).toBe("Realme");
    expect(data.analysis.sourceQuote.price.current).toBe(15999);
  });
});
