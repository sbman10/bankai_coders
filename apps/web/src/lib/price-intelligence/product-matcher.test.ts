import { describe, it, expect } from "vitest";
import { ProductMatcher } from "./product-matcher";
import type { CanonicalProductIdentity } from "../platforms/platform.types";

describe("Product Matcher — Strict Matching & Variant Conflict Rejection", () => {
  const matcher = new ProductMatcher();

  const realmeCanonical: CanonicalProductIdentity = {
    platform: "Amazon",
    sourceUrl: "https://www.amazon.in/dp/B0CX21CBRX",
    rawTitle: "Realme P4 5G (Submarine Blue, 8GB RAM, 128GB Storage)",
    cleanTitle: "Realme P4 5G (Submarine Blue, 8GB RAM, 128GB Storage)",
    brand: "Realme",
    model: "P4 5G",
    category: "Mobiles & Tablets",
    variant: {
      ram: "8GB",
      storage: "128GB",
      color: "Submarine Blue",
    },
    seller: "Appario Retail",
    imageUrl: "https://m.media-amazon.com/images/I/71xyz.jpg",
  };

  it("yields a STRONG_MATCH (>=90%) when candidate matches brand, model, and identical 8GB/128GB variant", () => {
    const candidate = {
      title: "Realme P4 5G (Submarine Blue, 128 GB) (8 GB RAM)",
      brand: "Realme",
      model: "P4 5G",
      category: "Mobiles & Tablets",
      variant: {
        ram: "8GB",
        storage: "128GB",
        color: "Submarine Blue",
      },
    };

    const result = matcher.evaluateMatch(realmeCanonical, candidate);
    expect(result.isMatch).toBe(true);
    expect(result.matchStatus).toBe("STRONG_MATCH");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(result.matchedAttributes).toContain("brand");
    expect(result.matchedAttributes).toContain("storage");
    expect(result.matchedAttributes).toContain("ram");
  });

  it("STRICTLY REJECTS matching when candidate has 256GB storage instead of 128GB", () => {
    const candidate256GB = {
      title: "Realme P4 5G (Submarine Blue, 256 GB) (8 GB RAM)",
      brand: "Realme",
      model: "P4 5G",
      category: "Mobiles & Tablets",
      variant: {
        ram: "8GB",
        storage: "256GB", // CONFLICT!
      },
    };

    const result = matcher.evaluateMatch(realmeCanonical, candidate256GB);
    expect(result.isMatch).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.matchStatus).toBe("MISMATCH");
    expect(result.rejectionReason).toContain("Storage mismatch");
  });

  it("STRICTLY REJECTS matching when candidate has 12GB RAM instead of 8GB", () => {
    const candidate12GBRam = {
      title: "Realme P4 5G (12GB RAM, 128GB Storage)",
      brand: "Realme",
      model: "P4 5G",
      category: "Mobiles & Tablets",
      variant: {
        ram: "12GB", // CONFLICT!
        storage: "128GB",
      },
    };

    const result = matcher.evaluateMatch(realmeCanonical, candidate12GBRam);
    expect(result.isMatch).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.matchStatus).toBe("MISMATCH");
    expect(result.rejectionReason).toContain("RAM mismatch");
  });

  it("STRICTLY REJECTS matching when volume differs (e.g. Nivea Cream 100ml vs 200ml)", () => {
    const niveaCanonical: CanonicalProductIdentity = {
      platform: "Amazon",
      sourceUrl: "https://www.amazon.in/dp/B00NIVEA100",
      rawTitle: "Nivea Soft Light Moisturiser 100ml",
      cleanTitle: "Nivea Soft Light Moisturiser 100ml",
      brand: "Nivea",
      model: "Soft Light Moisturiser",
      category: "Beauty & Personal Care",
      variant: {
        volume_or_weight: "100ml",
      },
      seller: "Cloudtail",
      imageUrl: null,
    };

    const candidate200ml = {
      title: "Nivea Soft Light Moisturiser Cream 200ml",
      brand: "Nivea",
      model: "Soft Light Moisturiser",
      category: "Beauty & Personal Care",
      variant: {
        volume_or_weight: "200ml", // CONFLICT!
      },
    };

    const result = matcher.evaluateMatch(niveaCanonical, candidate200ml);
    expect(result.isMatch).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.matchStatus).toBe("MISMATCH");
    expect(result.rejectionReason).toContain("Volume/weight mismatch");
  });

  it("STRICTLY REJECTS matching when clothing size differs (e.g. Size M vs Size XL)", () => {
    const tshirtCanonical: CanonicalProductIdentity = {
      platform: "Amazon",
      sourceUrl: "https://www.amazon.in/dp/B00TSHIRTM",
      rawTitle: "Puma Men's Solid T-Shirt (Size: M)",
      cleanTitle: "Puma Men's Solid T-Shirt (Size: M)",
      brand: "Puma",
      model: "Solid T-Shirt",
      category: "Fashion & Apparel",
      variant: {
        size: "M",
      },
      seller: "Puma Sports",
      imageUrl: null,
    };

    const candidateXL = {
      title: "Puma Men's Solid T-Shirt (Size: XL)",
      brand: "Puma",
      model: "Solid T-Shirt",
      category: "Fashion & Apparel",
      variant: {
        size: "XL", // CONFLICT!
      },
    };

    const result = matcher.evaluateMatch(tshirtCanonical, candidateXL);
    expect(result.isMatch).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.matchStatus).toBe("MISMATCH");
    expect(result.rejectionReason).toContain("Size mismatch");
  });

  it("STRICTLY REJECTS matching when brand conflicts entirely", () => {
    const candidateSamsung = {
      title: "Samsung Galaxy M15 5G (8GB RAM, 128GB Storage)",
      brand: "Samsung",
      model: "Galaxy M15",
      category: "Mobiles & Tablets",
      variant: {
        ram: "8GB",
        storage: "128GB",
      },
    };

    const result = matcher.evaluateMatch(realmeCanonical, candidateSamsung);
    expect(result.isMatch).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.matchStatus).toBe("MISMATCH");
    expect(result.rejectionReason).toContain("Brand conflict");
  });
});
