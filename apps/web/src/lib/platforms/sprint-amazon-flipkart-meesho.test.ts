import { describe, it, expect, vi } from "vitest";
import { AmazonAdapter } from "./amazon-adapter";
import { FlipkartAdapter } from "./flipkart-adapter";
import { MeeshoAdapter } from "./meesho-adapter";
import { defaultProductMatcher } from "../price-intelligence/product-matcher";
import { validateCurrentSellingPrice } from "../price-intelligence/price-validator";
import { defaultAvailabilityValidator } from "../price-intelligence/availability-validator";
import { CrossStorePriceIntelligenceService } from "../price-intelligence/cross-store-service";
import { FirecrawlClient } from "../firecrawl/firecrawl-client";
import type { CanonicalProductIdentity } from "./platform.types";

describe("Sprint 20–25 Min: Amazon ↔ Flipkart ↔ Meesho Core Verification", () => {
  const amazonAdapter = new AmazonAdapter();
  const flipkartAdapter = new FlipkartAdapter();
  const meeshoAdapter = new MeeshoAdapter();

  // ───────────────────────────────────────────────────────────────────────────
  // CRITICAL VARIANT TEST 1: Same product family, DIFFERENT COLOR must MATCH
  // ───────────────────────────────────────────────────────────────────────────
  it("Variant Test: Same product family with DIFFERENT COLOR must MATCH (family-level)", () => {
    const amazonRef: CanonicalProductIdentity = {
      platform: "Amazon",
      sourceUrl: "https://www.amazon.in/dp/B0H3LKPC2K",
      rawTitle: "Samsung Galaxy A36 5G (Black, 8GB RAM, 128GB Storage)",
      cleanTitle: "Samsung Galaxy A36 5G (Black, 8GB RAM, 128GB Storage)",
      brand: "Samsung",
      model: "Galaxy A36 5G",
      category: "Mobiles & Tablets",
      variant: { ram: "8GB", storage: "128GB", color: "Black" },
      seller: "Appario Retail",
      imageUrl: null,
    };

    const flipkartCand = {
      title: "Samsung Galaxy A36 5G (Dark Green, 128 GB) (8 GB RAM)",
      brand: "Samsung",
      model: "Galaxy A36 5G",
      category: "Mobiles & Tablets",
      variant: { ram: "8GB", storage: "128GB", color: "Dark Green" },
    };

    const match = defaultProductMatcher.evaluateMatch(amazonRef, flipkartCand);

    expect(match.isMatch).toBe(true);
    expect(match.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(match.matchStatus).toBe("STRONG_MATCH");
    expect(match.variantDifference).toContain("color");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CRITICAL VARIANT TEST 2: Same model, DIFFERENT STORAGE must REJECT
  // ───────────────────────────────────────────────────────────────────────────
  it("Variant Test: Same model with DIFFERENT STORAGE must REJECT immediately", () => {
    const ref: CanonicalProductIdentity = {
      platform: "Amazon",
      sourceUrl: "https://www.amazon.in/dp/B0H3LKPC2K",
      rawTitle: "Samsung Galaxy A36 5G (8GB RAM, 128GB Storage)",
      cleanTitle: "Samsung Galaxy A36 5G (8GB RAM, 128GB Storage)",
      brand: "Samsung",
      model: "Galaxy A36 5G",
      category: "Mobiles & Tablets",
      variant: { ram: "8GB", storage: "128GB" },
      seller: null,
      imageUrl: null,
    };

    const candDifferentStorage = {
      title: "Samsung Galaxy A36 5G (8GB RAM, 256GB Storage)",
      brand: "Samsung",
      model: "Galaxy A36 5G",
      category: "Mobiles & Tablets",
      variant: { ram: "8GB", storage: "256GB" },
    };

    const match = defaultProductMatcher.evaluateMatch(ref, candDifferentStorage);

    expect(match.isMatch).toBe(false);
    expect(match.confidenceScore).toBe(0);
    expect(match.matchStatus).toBe("MISMATCH");
    expect(match.rejectionReason).toContain("Storage mismatch");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CRITICAL VARIANT TEST 3: Same model, DIFFERENT RAM must REJECT
  // ───────────────────────────────────────────────────────────────────────────
  it("Variant Test: Same model with DIFFERENT RAM must REJECT immediately", () => {
    const ref: CanonicalProductIdentity = {
      platform: "Amazon",
      sourceUrl: "https://www.amazon.in/dp/B0H3LKPC2K",
      rawTitle: "Samsung Galaxy A36 5G (8GB RAM, 128GB Storage)",
      cleanTitle: "Samsung Galaxy A36 5G (8GB RAM, 128GB Storage)",
      brand: "Samsung",
      model: "Galaxy A36 5G",
      category: "Mobiles & Tablets",
      variant: { ram: "8GB", storage: "128GB" },
      seller: null,
      imageUrl: null,
    };

    const candDifferentRam = {
      title: "Samsung Galaxy A36 5G (6GB RAM, 128GB Storage)",
      brand: "Samsung",
      model: "Galaxy A36 5G",
      category: "Mobiles & Tablets",
      variant: { ram: "6GB", storage: "128GB" },
    };

    const match = defaultProductMatcher.evaluateMatch(ref, candDifferentRam);

    expect(match.isMatch).toBe(false);
    expect(match.confidenceScore).toBe(0);
    expect(match.matchStatus).toBe("MISMATCH");
    expect(match.rejectionReason).toContain("RAM mismatch");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CRITICAL VARIANT TEST 4: DIFFERENT MODEL must REJECT
  // ───────────────────────────────────────────────────────────────────────────
  it("Variant Test: DIFFERENT MODEL (Galaxy A36 vs Galaxy A26) must REJECT", () => {
    const ref: CanonicalProductIdentity = {
      platform: "Amazon",
      sourceUrl: "https://www.amazon.in/dp/B0H3LKPC2K",
      rawTitle: "Samsung Galaxy A36 5G",
      cleanTitle: "Samsung Galaxy A36 5G",
      brand: "Samsung",
      model: "Galaxy A36",
      category: "Mobiles & Tablets",
      variant: { ram: "8GB", storage: "128GB" },
      seller: null,
      imageUrl: null,
    };

    const candDifferentModel = {
      title: "Samsung Galaxy A26 5G",
      brand: "Samsung",
      model: "Galaxy A26",
      category: "Mobiles & Tablets",
      variant: { ram: "8GB", storage: "128GB" },
    };

    const match = defaultProductMatcher.evaluateMatch(ref, candDifferentModel);

    expect(match.isMatch).toBe(false);
    expect(match.confidenceScore).toBe(0);
    expect(match.matchStatus).toBe("MISMATCH");
    expect(match.rejectionReason).toContain("Model conflict");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DIRECTION 1: Amazon → Flipkart
  // ───────────────────────────────────────────────────────────────────────────
  it("Direction 1: Amazon → Flipkart cross-store comparison finds and matches same product family", async () => {
    const mockClient = new FirecrawlClient("mock-key");

    vi.spyOn(mockClient, "scrapeUrl").mockImplementation(async (url: string) => {
      if (url.includes("amazon.in")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# Samsung Galaxy A36 5G (8GB RAM, 128GB Storage, Black)\nPrice: ₹26,999\nIn Stock",
          html: `
            <span id="productTitle">Samsung Galaxy A36 5G (8GB RAM, 128GB Storage, Black)</span>
            <span class="a-price-whole">26,999</span>
            <input id="add-to-cart-button" type="submit" value="Add to Cart" />
          `,
          auditLog: {} as any,
        };
      }
      if (url.includes("flipkart.com")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# Samsung Galaxy A36 5G (Dark Green, 128 GB) (8 GB RAM)\nPrice: ₹25,970\nIn Stock",
          html: `
            <h1 class="VU-ZEz">Samsung Galaxy A36 5G (Dark Green, 128 GB) (8 GB RAM)</h1>
            <div font="default-fk-font-l">₹25,970</div>
            <button class="_2KpZ6l _2U9uOA _3v1-ww">Buy Now</button>
          `,
          auditLog: {} as any,
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.spyOn(mockClient, "search").mockResolvedValue({
      results: [
        {
          url: "https://www.flipkart.com/samsung-galaxy-a36-5g/p/itmc39f6?pid=MOBHNJ8FASRHRJZS",
          title: "Samsung Galaxy A36 5G (Dark Green, 128 GB)",
        },
      ],
      cached: false,
      auditLog: {} as any,
    });

    const service = new CrossStorePriceIntelligenceService(mockClient);
    const result = await service.analyzeProductUrl("https://www.amazon.in/dp/B0H3LKPC2K", {
      targetPlatforms: ["Flipkart"],
    });

    expect(result.canonicalIdentity.brand).toBe("Samsung");
    expect(result.sourceQuote.platform).toBe("Amazon");
    expect(result.sourceQuote.price?.current).toBe(26999);

    expect(result.candidateEvaluations.length).toBe(1);
    expect(result.candidateEvaluations[0].isEligibleForComparison).toBe(true);
    expect(result.candidateEvaluations[0].quote.platform).toBe("Flipkart");
    expect(result.candidateEvaluations[0].quote.price?.current).toBe(25970);
    expect(result.comparisonSummary?.lowestPrice.platform).toBe("Flipkart");
    expect(result.comparisonSummary?.lowestPrice.amount).toBe(25970);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DIRECTION 2: Amazon → Meesho (Generic item on Meesho rejected for data integrity)
  // ───────────────────────────────────────────────────────────────────────────
  it("Direction 2: Amazon → Meesho strictly rejects unbranded or counterfeit candidates on Meesho", async () => {
    const mockClient = new FirecrawlClient("mock-key");

    vi.spyOn(mockClient, "scrapeUrl").mockImplementation(async (url: string) => {
      if (url.includes("amazon.in")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# Samsung Galaxy A36 5G (8GB RAM, 128GB Storage)\nPrice: ₹26,999\nIn Stock",
          html: `<span id="productTitle">Samsung Galaxy A36 5G (8GB RAM, 128GB Storage)</span>
                 <span class="a-price-whole">26,999</span>
                 <input id="add-to-cart-button" type="submit" value="Add to Cart" />`,
          auditLog: {} as any,
        };
      }
      if (url.includes("meesho.com")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# Premium Smartphone Cover Suitable for Galaxy Phones\nPrice: ₹199\nAdd to Cart",
          html: `<h1>Premium Smartphone Cover Suitable for Galaxy Phones</h1>
                 <h4>₹199</h4>
                 <button>Add to Cart</button>`,
          auditLog: {} as any,
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.spyOn(mockClient, "search").mockResolvedValue({
      results: [
        {
          url: "https://www.meesho.com/p/cover-99",
          title: "Smartphone Cover Suitable for Galaxy Phones",
        },
      ],
      cached: false,
      auditLog: {} as any,
    });

    const service = new CrossStorePriceIntelligenceService(mockClient);
    const result = await service.analyzeProductUrl("https://www.amazon.in/dp/B0H3LKPC2K", {
      targetPlatforms: ["Meesho"],
    });

    // DATA INTEGRITY: Meesho candidate was NOT Samsung Galaxy A36 5G phone!
    // Must NOT be eligible for comparison!
    expect(result.candidateEvaluations.length).toBe(1);
    expect(result.candidateEvaluations[0].isEligibleForComparison).toBe(false);
    expect(result.candidateEvaluations[0].matchResult.isMatch).toBe(false);
    expect(result.comparisonSummary?.availableStoreCount).toBe(1); // Only verified Amazon quote
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DIRECTION 3: Flipkart → Amazon
  // ───────────────────────────────────────────────────────────────────────────
  it("Direction 3: Flipkart → Amazon cross-store comparison finds and matches same product", async () => {
    const mockClient = new FirecrawlClient("mock-key");

    vi.spyOn(mockClient, "scrapeUrl").mockImplementation(async (url: string) => {
      if (url.includes("flipkart.com")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# Samsung Galaxy A36 5G (Dark Green, 128 GB) (8 GB RAM)\nPrice: ₹26,999\nIn Stock",
          html: `<h1 class="VU-ZEz">Samsung Galaxy A36 5G (Dark Green, 128 GB) (8 GB RAM)</h1>
                 <div font="default-fk-font-l">₹26,999</div>
                 <button class="_2KpZ6l _2U9uOA _3v1-ww">Buy Now</button>`,
          auditLog: {} as any,
        };
      }
      if (url.includes("amazon.in")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# Samsung Galaxy A36 5G (Awesome Black, 8GB RAM, 128GB Storage)\nPrice: ₹25,970\nIn Stock",
          html: `<span id="productTitle">Samsung Galaxy A36 5G (Awesome Black, 8GB RAM, 128GB Storage)</span>
                 <span class="a-price-whole">25,970</span>
                 <input id="add-to-cart-button" type="submit" value="Add to Cart" />`,
          auditLog: {} as any,
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.spyOn(mockClient, "search").mockResolvedValue({
      results: [
        {
          url: "https://www.amazon.in/dp/B0H3LKPC2K",
          title: "Samsung Galaxy A36 5G (Awesome Black, 8GB RAM, 128GB)",
        },
      ],
      cached: false,
      auditLog: {} as any,
    });

    const service = new CrossStorePriceIntelligenceService(mockClient);
    const result = await service.analyzeProductUrl(
      "https://www.flipkart.com/samsung-galaxy-a36-5g/p/itm123?pid=MOBHNJ8FASRHRJZS",
      { targetPlatforms: ["Amazon"] }
    );

    expect(result.sourceQuote.platform).toBe("Flipkart");
    expect(result.candidateEvaluations.length).toBe(1);
    expect(result.candidateEvaluations[0].isEligibleForComparison).toBe(true);
    expect(result.candidateEvaluations[0].quote.platform).toBe("Amazon");
    expect(result.candidateEvaluations[0].quote.price?.current).toBe(25970);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DIRECTION 4: Flipkart → Meesho
  // ───────────────────────────────────────────────────────────────────────────
  it("Direction 4: Flipkart → Meesho correctly verifies genuine product or safely rejects mismatch", async () => {
    const mockClient = new FirecrawlClient("mock-key");

    vi.spyOn(mockClient, "scrapeUrl").mockImplementation(async (url: string) => {
      if (url.includes("flipkart.com")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# boAt Rockerz 450 Bluetooth Headphones\nPrice: ₹1,499\nIn Stock",
          html: `<h1 class="VU-ZEz">boAt Rockerz 450 Bluetooth Headphones (Luscious Black)</h1>
                 <div font="default-fk-font-l">₹1,499</div>
                 <button class="_2KpZ6l _2U9uOA _3v1-ww">Buy Now</button>`,
          auditLog: {} as any,
        };
      }
      if (url.includes("meesho.com")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# boAt Rockerz 450 Wireless On-Ear Headphones\nBrand: boAt\nModel: Rockerz 450\nPrice: ₹1,399\nAdd to Cart",
          html: `<h1>boAt Rockerz 450 Wireless On-Ear Headphones</h1>
                 <h4>₹1,399</h4>
                 <button>Add to Cart</button>`,
          auditLog: {} as any,
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.spyOn(mockClient, "search").mockResolvedValue({
      results: [
        {
          url: "https://www.meesho.com/p/boat-450",
          title: "boAt Rockerz 450 Wireless On-Ear Headphones",
        },
      ],
      cached: false,
      auditLog: {} as any,
    });

    const service = new CrossStorePriceIntelligenceService(mockClient);
    const result = await service.analyzeProductUrl(
      "https://www.flipkart.com/boat-rockerz-450/p/itm123?pid=ACCFK12345",
      { targetPlatforms: ["Meesho"] }
    );

    expect(result.sourceQuote.platform).toBe("Flipkart");
    expect(result.candidateEvaluations.length).toBe(1);
    expect(result.candidateEvaluations[0].isEligibleForComparison).toBe(true);
    expect(result.candidateEvaluations[0].quote.platform).toBe("Meesho");
    expect(result.candidateEvaluations[0].quote.price?.current).toBe(1399);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DIRECTION 5: Meesho → Amazon / Flipkart
  // ───────────────────────────────────────────────────────────────────────────
  it("Direction 5: Meesho → Amazon/Flipkart finds matching branded audio across stores", async () => {
    const mockClient = new FirecrawlClient("mock-key");

    vi.spyOn(mockClient, "scrapeUrl").mockImplementation(async (url: string) => {
      if (url.includes("meesho.com")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# boAt Rockerz 450 Wireless On-Ear Headphones\nBrand: boAt\nModel: Rockerz 450\nPrice: ₹1,399\nAdd to Cart",
          html: `<h1>boAt Rockerz 450 Wireless On-Ear Headphones</h1>
                 <h4>₹1,399</h4>
                 <button>Add to Cart</button>`,
          auditLog: {} as any,
        };
      }
      if (url.includes("amazon.in")) {
        return {
          statusCode: 200,
          cached: false,
          markdown: "# boAt Rockerz 450 Bluetooth On Ear Headphones with Mic\nPrice: ₹1,499\nIn Stock",
          html: `<span id="productTitle">boAt Rockerz 450 Bluetooth On Ear Headphones with Mic</span>
                 <span class="a-price-whole">1,499</span>
                 <input id="add-to-cart-button" type="submit" value="Add to Cart" />`,
          auditLog: {} as any,
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    vi.spyOn(mockClient, "search").mockResolvedValue({
      results: [
        {
          url: "https://www.amazon.in/dp/B07PR1CL3S",
          title: "boAt Rockerz 450 Bluetooth On Ear Headphones",
        },
      ],
      cached: false,
      auditLog: {} as any,
    });

    const service = new CrossStorePriceIntelligenceService(mockClient);
    const result = await service.analyzeProductUrl(
      "https://www.meesho.com/p/boat-450",
      { targetPlatforms: ["Amazon"] }
    );

    expect(result.sourceQuote.platform).toBe("Meesho");
    expect(result.candidateEvaluations.length).toBe(1);
    expect(result.candidateEvaluations[0].isEligibleForComparison).toBe(true);
    expect(result.candidateEvaluations[0].quote.platform).toBe("Amazon");
    expect(result.candidateEvaluations[0].quote.price?.current).toBe(1499);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PRICE INTEGRITY: Selling price is strictly kept, EMI/MRP/Offer rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("Price Integrity: Selling price ₹37,990 is kept; EMI, bank offer, exchange price are rejected", () => {
    // Valid Selling Price
    const valid = validateCurrentSellingPrice({
      sellingPrice: 37990,
      mrp: 50000,
      contextText: "Selling Price: ₹37,990",
    });
    expect(valid.isValid).toBe(true);
    expect(valid.price?.current).toBe(37990);

    // Reject EMI
    const emi = validateCurrentSellingPrice({
      sellingPrice: 1999,
      mrp: 50000,
      contextText: "EMI from ₹1,999/month",
    });
    expect(emi.isValid).toBe(false);

    // Reject Bank Offer
    const bank = validateCurrentSellingPrice({
      sellingPrice: 35990,
      mrp: 50000,
      contextText: "Effective price with bank offer ₹35,990",
    });
    expect(bank.isValid).toBe(false);

    // Reject Exchange Price
    const exchange = validateCurrentSellingPrice({
      sellingPrice: 30000,
      mrp: 50000,
      contextText: "with exchange offer ₹30,000",
    });
    expect(exchange.isValid).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // AVAILABILITY VALIDATION: Only IN_STOCK products are factored into comparison
  // ───────────────────────────────────────────────────────────────────────────
  it("Availability Validation: IN_STOCK is factored; OUT_OF_STOCK and UNKNOWN are excluded", () => {
    const inStock = defaultAvailabilityValidator.validate({
      html: `<button id="add-to-cart-button">Add to Cart</button>`,
      markdown: "In Stock",
    });
    expect(inStock.status).toBe("IN_STOCK");
    expect(defaultAvailabilityValidator.isPurchasable(inStock.status)).toBe(true);

    const outOfStock = defaultAvailabilityValidator.validate({
      html: `<div>Currently unavailable</div>`,
      markdown: "Out of Stock",
    });
    expect(outOfStock.status).toBe("OUT_OF_STOCK");
    expect(defaultAvailabilityValidator.isPurchasable(outOfStock.status)).toBe(false);

    const unknown = defaultAvailabilityValidator.validate({
      html: `<div>Product showcase</div>`,
      markdown: "Product info",
    });
    expect(unknown.status).toBe("UNKNOWN");
    expect(defaultAvailabilityValidator.isPurchasable(unknown.status)).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MEESHO VERIFICATION: No RegExp crashes on header links, price + availability parsed
  // ───────────────────────────────────────────────────────────────────────────
  it("Meesho Extraction: Safely handles long navigation markdown trees without invalid regex crash, parses price and stock", () => {
    const meeshoUrl = "https://www.meesho.com/kc-creation-night-suit-for-women/p/7fyayt";
    const sampleContent = {
      url: meeshoUrl,
      html: `
        <head><title>KC CREATION, Night Suit For women | Meesho</title></head>
        <body>
          <a href="https://www.meesho.com/top-brands/pl/3u77">Top Brands</a>
          <a href="https://www.meesho.com/shimla-apples/pl/6myd">Shimla Apples</a>
          <h1>KC CREATION, Night Suit For women</h1>
          <h4>₹<!-- -->222</h4>
          <button>Add to Cart</button>
          <button>Buy Now</button>
        </body>
      `,
      markdown: `
[Top Brands](https://www.meesho.com/top-brands/pl/3u77) [Shimla Apples](https://www.meesho.com/shimla-apples/pl/6myd) [Jewellery](https://www.meesho.com/jewellery/pl/9tx)

# KC CREATION, Night Suit For women

#### ₹222

Add to Cart
Buy Now

###### Product Details
Name : KC CREATION, Night Suit For women
Top Fabric : Satin
      `,
      statusCode: 200,
    };

    expect(() => {
      const identity = meeshoAdapter.extractCanonicalIdentity(sampleContent, meeshoUrl);
      expect(identity.cleanTitle).toBe("KC CREATION, Night Suit For women");
      expect(identity.productIdentifier).toBe("7fyayt");
      expect(identity.platform).toBe("Meesho");
      expect(identity.category).toBe("Fashion & Apparel");
    }).not.toThrow();

    const price = meeshoAdapter.extractPrice(sampleContent);
    expect(price).not.toBeNull();
    expect(price?.current).toBe(222);
    expect(price?.currency).toBe("INR");

    const availability = meeshoAdapter.extractAvailability(sampleContent);
    expect(availability.status).toBe("IN_STOCK");
  });
});
