import { describe, it, expect } from "vitest";
import { PriceComparisonEngine, calculateMedianPrice } from "./comparison-engine";
import type { NormalizedProductQuote } from "../platforms/platform.types";

describe("Price Comparison Engine — Statistical Calculations & Exclusion Rules", () => {
  const engine = new PriceComparisonEngine();

  it("calculates exact Lowest, Median Price, and Highest matching the user specification", () => {
    // Exact example from user specification:
    // Amazon ₹16,999, Flipkart ₹15,499, Croma ₹17,490, Meesho ₹18,200
    const quotes: NormalizedProductQuote[] = [
      {
        platform: "Amazon",
        productUrl: "https://www.amazon.in/dp/B0CX1",
        title: "Realme P4 5G 8GB 128GB",
        brand: "Realme",
        model: "P4 5G",
        variant: { ram: "8GB", storage: "128GB" },
        price: { current: 16999, currency: "INR", mrp: 19999 },
        availability: { status: "IN_STOCK", evidence: "Add to Cart present", confidence: 0.95 },
        seller: "Appario Retail",
        imageUrl: null,
        scrapedAt: new Date().toISOString(),
        rawConfidence: 0.95,
      },
      {
        platform: "Flipkart",
        productUrl: "https://www.flipkart.com/p/realme-p4",
        title: "Realme P4 5G 8GB 128GB",
        brand: "Realme",
        model: "P4 5G",
        variant: { ram: "8GB", storage: "128GB" },
        price: { current: 15499, currency: "INR", mrp: 19999 },
        availability: { status: "IN_STOCK", evidence: "Buy Now present", confidence: 0.95 },
        seller: "FlashTech",
        imageUrl: null,
        scrapedAt: new Date().toISOString(),
        rawConfidence: 0.95,
      },
      {
        platform: "Croma",
        productUrl: "https://www.croma.com/p/realme-p4",
        title: "Realme P4 5G 8GB 128GB",
        brand: "Realme",
        model: "P4 5G",
        variant: { ram: "8GB", storage: "128GB" },
        price: { current: 17490, currency: "INR", mrp: 19999 },
        availability: { status: "IN_STOCK", evidence: "In Stock badge", confidence: 0.95 },
        seller: "Croma Retail",
        imageUrl: null,
        scrapedAt: new Date().toISOString(),
        rawConfidence: 0.95,
      },
      {
        platform: "Meesho",
        productUrl: "https://www.meesho.com/p/realme-p4",
        title: "Realme P4 5G 8GB 128GB",
        brand: "Realme",
        model: "P4 5G",
        variant: { ram: "8GB", storage: "128GB" },
        price: { current: 18200, currency: "INR", mrp: 19999 },
        availability: { status: "IN_STOCK", evidence: "Buy Now present", confidence: 0.95 },
        seller: "DirectSeller",
        imageUrl: null,
        scrapedAt: new Date().toISOString(),
        rawConfidence: 0.95,
      },
    ];

    const result = engine.compare(quotes);
    expect(result).not.toBeNull();
    // Lowest = ₹15,499 (Flipkart)
    expect(result?.lowestPrice.amount).toBe(15499);
    expect(result?.lowestPrice.platform).toBe("Flipkart");

    // Median = ₹17,244.50 (Average of 16,999 and 17,490)
    expect(result?.medianPrice.amount).toBe(17244.5);
    expect(result?.medianPrice.label).toBe("Median Price");

    // Highest = ₹18,200 (Meesho)
    expect(result?.highestPrice.amount).toBe(18200);
    expect(result?.highestPrice.platform).toBe("Meesho");

    // Savings
    expect(result?.maxSavings).toBe(2701);
    expect(result?.availableStoreCount).toBe(4);
  });

  it("calculates median for odd number of items using exact middle value", () => {
    // 1000, 2000, 3000 -> Median = 2000
    expect(calculateMedianPrice([1000, 2000, 3000])).toBe(2000);
    expect(calculateMedianPrice([500, 1500, 900])).toBe(900);
  });

  it("EXCLUDES out of stock, unverified, or missing price quotes from comparison calculations", () => {
    const quotes: NormalizedProductQuote[] = [
      {
        platform: "Amazon",
        productUrl: "https://www.amazon.in/dp/B0CX1",
        title: "Realme P4 5G",
        brand: "Realme",
        model: "P4 5G",
        variant: {},
        price: { current: 15999, currency: "INR", mrp: 18999 },
        availability: { status: "IN_STOCK", evidence: "In Stock", confidence: 0.95 },
        seller: null,
        imageUrl: null,
        scrapedAt: new Date().toISOString(),
        rawConfidence: 0.95,
      },
      {
        platform: "Flipkart",
        productUrl: "https://www.flipkart.com/p/realme-p4-oos",
        title: "Realme P4 5G",
        brand: "Realme",
        model: "P4 5G",
        variant: {},
        price: { current: 12999, currency: "INR", mrp: 18999 },
        availability: { status: "OUT_OF_STOCK", evidence: "Sold Out", confidence: 0.95 }, // OUT OF STOCK!
        seller: null,
        imageUrl: null,
        scrapedAt: new Date().toISOString(),
        rawConfidence: 0.95,
      },
      {
        platform: "Croma",
        productUrl: "https://www.croma.com/p/realme-p4-unk",
        title: "Realme P4 5G",
        brand: "Realme",
        model: "P4 5G",
        variant: {},
        price: { current: 11999, currency: "INR", mrp: 18999 },
        availability: { status: "UNKNOWN", evidence: "No CTA", confidence: 0.3 }, // UNKNOWN!
        seller: null,
        imageUrl: null,
        scrapedAt: new Date().toISOString(),
        rawConfidence: 0.3,
      },
    ];

    const result = engine.compare(quotes);
    expect(result).not.toBeNull();
    // Only Amazon is verified and in stock
    expect(result?.availableStoreCount).toBe(1);
    expect(result?.lowestPrice.amount).toBe(15999);
    expect(result?.lowestPrice.platform).toBe("Amazon");
    // The unverified Flipkart (12,999) and Croma (11,999) must NOT lower the lowest price!
    expect(result?.unverifiedOrUnavailable.length).toBe(2);
  });
});
