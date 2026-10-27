import { describe, it, expect, vi } from "vitest";
import { AmazonAdapter } from "./amazon-adapter";
import { FlipkartAdapter } from "./flipkart-adapter";
import { CromaAdapter } from "./croma-adapter";
import { MeeshoAdapter } from "./meesho-adapter";
import { defaultProductMatcher } from "../price-intelligence/product-matcher";
import { validateCurrentSellingPrice } from "../price-intelligence/price-validator";
import { defaultAvailabilityValidator } from "../price-intelligence/availability-validator";
import { FirecrawlScrapeCache, hashUrl } from "../firecrawl/cache";
import { CrossStorePriceIntelligenceService } from "../price-intelligence/cross-store-service";
import { FirecrawlClient } from "../firecrawl/firecrawl-client";
import { extractAsin } from "@/lib/amazon/asin";

describe("ProductVault — Mandatory 15-Test Scraper & Cross-Store Integration Suite", () => {
  const amazonAdapter = new AmazonAdapter();
  const flipkartAdapter = new FlipkartAdapter();
  const cromaAdapter = new CromaAdapter();
  const meeshoAdapter = new MeeshoAdapter();

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1 — Amazon Direct
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 1 — Amazon Direct: extracts correct product identity, ASIN, model, variant, price, and availability", () => {
    const url = "https://www.amazon.in/OnePlus-Midnight-Smoothness-Military-Grade-Durability/dp/B0H3LKPC2K/ref=sr_1_3";
    const html = `
      <html>
        <body>
          <span id="productTitle">OnePlus N6 (Midnight Green, 6GB RAM, 128GB Storage)</span>
          <a id="bylineInfo">Brand: OnePlus</a>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price a-text-price a-size-medium apexPriceToPay">
              <span class="a-offscreen">₹19,999.00</span>
            </span>
            <span class="a-price a-text-price a-size-base" data-a-strike="true">
              <span class="a-offscreen">₹24,999.00</span>
            </span>
          </div>
          <div id="availability">
            <span class="a-color-success">In stock.</span>
          </div>
          <input id="add-to-cart-button" type="submit" value="Add to Cart" />
          <div id="sellerProfileTriggerId">Appario Retail Private Ltd</div>
        </body>
      </html>
    `;
    const content = { html, markdown: "# OnePlus N6\nPrice: ₹19,999", statusCode: 200 };

    const identity = amazonAdapter.extractCanonicalIdentity(content, url);
    const quote = amazonAdapter.normalize(content, url);

    expect(quote.platform).toBe("Amazon");
    expect(quote.productIdentifier).toBe("B0H3LKPC2K");
    expect(quote.identifierType).toBe("ASIN");
    expect(identity.brand).toBe("OnePlus");
    expect(identity.model).toBe("N6");
    expect(identity.variant.ram).toBe("6GB");
    expect(identity.variant.storage).toBe("128GB");
    expect(identity.variant.color).toBe("Midnight Green");
    expect(quote.price?.current).toBe(19999);
    expect(quote.price?.mrp).toBe(24999);
    expect(quote.availability.status).toBe("IN_STOCK");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2 — Flipkart Direct: Mouse
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 2 — Flipkart Direct (Mouse): extracts Logitech G102 Lightsync Mouse without returning another mouse", () => {
    const url = "https://www.flipkart.com/logitech-g102-lightsync-wired-optical-gaming-mouse/p/itm123456?pid=ACCFG102XYZ123";
    const html = `
      <html>
        <body>
          <h1 class="VU-ZEz">Logitech G102 Lightsync Wired Optical Gaming Mouse (Black)</h1>
          <span class="G6XhRU">Logitech</span>
          <div font="default-fk-font-l">₹1,495</div>
          <div style="text-decoration: line-through">₹1,995</div>
          <button class="_2KpZ6l _2U9uOA _3v1-ww">Add to Cart</button>
          <div id="sellerName"><span>SuperComNet</span></div>
        </body>
      </html>
    `;
    const content = {
      html,
      markdown: "# Logitech G102 Lightsync Wired Optical Gaming Mouse (Black)\nPrice: ₹1,495\n~~₹1,995~~\nAdd to Cart",
      statusCode: 200,
    };

    const identity = flipkartAdapter.extractCanonicalIdentity(content, url);
    const quote = flipkartAdapter.normalize(content, url);

    expect(quote.platform).toBe("Flipkart");
    expect(quote.productIdentifier).toBe("ACCFG102XYZ123");
    expect(quote.identifierType).toBe("FLIPKART_PID");
    expect(identity.brand).toBe("Logitech");
    expect(identity.model).toContain("G102");
    expect(identity.variant.color).toBe("Black");
    expect(quote.price?.current).toBe(1495);
    expect(quote.price?.mrp).toBe(1995);
    expect(quote.availability.status).toBe("IN_STOCK");

    // Must NOT be another model
    expect(identity.model).not.toBe("G304");
    expect(identity.brand).not.toBe("HP");
    expect(identity.brand).not.toBe("Redragon");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3 — Flipkart Direct: Smartphone
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 3 — Flipkart Direct (Smartphone): extracts Realme phone with correct RAM, storage, colour, and price", () => {
    const url = "https://www.flipkart.com/realme-p1-5g-peacock-green-128-gb/p/itma7c0d2825bfbc?pid=MOBGZJ42RAGZTZTH";
    const html = `
      <html>
        <body>
          <h1 class="VU-ZEz">Realme P1 5G (Peacock Green, 128 GB) (6 GB RAM)</h1>
          <span class="G6XhRU">Realme</span>
          <div font="default-fk-font-l">₹14,999</div>
          <div style="text-decoration: line-through">₹20,999</div>
          <button class="_2KpZ6l _2U9uOA _3v1-ww">Add to Cart</button>
        </body>
      </html>
    `;
    const content = {
      html,
      markdown: "# Realme P1 5G (Peacock Green, 128 GB) (6 GB RAM)\nPrice: ₹14,999\n~~₹20,999~~\nAdd to Cart",
      statusCode: 200,
    };

    const identity = flipkartAdapter.extractCanonicalIdentity(content, url);
    const quote = flipkartAdapter.normalize(content, url);

    expect(quote.platform).toBe("Flipkart");
    expect(quote.productIdentifier).toBe("MOBGZJ42RAGZTZTH");
    expect(quote.identifierType).toBe("FLIPKART_PID");
    expect(identity.brand).toBe("Realme");
    expect(identity.model).toBe("P1 5G");
    expect(identity.variant.ram).toBe("6GB");
    expect(identity.variant.storage).toBe("128GB");
    expect(identity.variant.color).toBe("Peacock Green");
    expect(quote.price?.current).toBe(14999);
    expect(quote.price?.mrp).toBe(20999);
    expect(quote.availability.status).toBe("IN_STOCK");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4 — Amazon → Flipkart
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 4 — Amazon → Flipkart: matches exact equivalent on Flipkart and excludes unrelated mice", async () => {
    const mockFirecrawl = new FirecrawlClient("test-key");
    const service = new CrossStorePriceIntelligenceService(mockFirecrawl);

    const amazonUrl = "https://www.amazon.in/dp/B07S9DR87T";
    vi.spyOn(mockFirecrawl, "scrapeUrl").mockResolvedValue({
      markdown: "# Logitech G102 Lightsync Gaming Mouse (Black)\nPrice: ₹1,495",
      html: `
        <span id="productTitle">Logitech G102 Lightsync Gaming Mouse (Black)</span>
        <a id="bylineInfo">Brand: Logitech</a>
        <div id="corePriceDisplay_desktop_feature_div"><span class="a-offscreen">₹1,495.00</span></div>
        <input id="add-to-cart-button" type="submit" value="Add to Cart" />
      `,
      statusCode: 200,
      cached: false,
      auditLog: {
        timestamp: new Date().toISOString(),
        url: amazonUrl,
        statusCode: 200,
        success: true,
        source: "firecrawl_api",
        estimatedCredits: 1,
        durationMs: 50,
      },
    });

    // Candidates:
    // 1: Exact G102 on Flipkart
    // 2: Redragon mouse on Flipkart (unrelated product)
    const candidates = [
      {
        platform: "Flipkart" as const,
        url: "https://www.flipkart.com/logitech-g102-lightsync/p/itm123?pid=ACCFG102XYZ123",
        title: "Logitech G102 Lightsync Wired Gaming Mouse (Black)",
        rawContent: {
          html: `<h1>Logitech G102 Lightsync Wired Gaming Mouse (Black)</h1><div font="default-fk-font-l">₹1,399</div><button>Add to Cart</button>`,
          markdown: "Price: ₹1,399\nAdd to Cart",
        },
      },
      {
        platform: "Flipkart" as const,
        url: "https://www.flipkart.com/redragon-m601/p/itm999?pid=ACCRED999",
        title: "Redragon M601 Centrophorus Gaming Mouse",
        rawContent: {
          html: `<h1>Redragon M601 Centrophorus Gaming Mouse</h1><div font="default-fk-font-l">₹999</div><button>Add to Cart</button>`,
          markdown: "Price: ₹999\nAdd to Cart",
        },
      },
    ];

    const result = await service.analyzeProductUrl(amazonUrl, { candidates });

    expect(result.candidateEvaluations[0].matchResult.isMatch).toBe(true);
    expect(result.candidateEvaluations[0].isEligibleForComparison).toBe(true);

    // Unrelated mouse rejected
    expect(result.candidateEvaluations[1].matchResult.isMatch).toBe(false);
    expect(result.candidateEvaluations[1].isEligibleForComparison).toBe(false);

    // Only 2 verified stores compared (Amazon + verified Flipkart)
    expect(result.comparisonSummary?.availableStoreCount).toBe(2);
    expect(result.comparisonSummary?.lowestPrice.amount).toBe(1399);
    expect(result.comparisonSummary?.lowestPrice.platform).toBe("Flipkart");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5 — Flipkart → Amazon
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 5 — Flipkart → Amazon: matches exact equivalent on Amazon from Flipkart source", async () => {
    const mockFirecrawl = new FirecrawlClient("test-key");
    const service = new CrossStorePriceIntelligenceService(mockFirecrawl);

    const flipkartUrl = "https://www.flipkart.com/p/realme-p1?pid=MOBGZJ42RAGZTZTH";
    vi.spyOn(mockFirecrawl, "scrapeUrl").mockResolvedValue({
      markdown: "# Realme P1 5G (Peacock Green, 128 GB) (6 GB RAM)\nPrice: ₹14,999",
      html: `
        <h1>Realme P1 5G (Peacock Green, 128 GB) (6 GB RAM)</h1>
        <span class="G6XhRU">Realme</span>
        <div font="default-fk-font-l">₹14,999</div>
        <button>Add to Cart</button>
      `,
      statusCode: 200,
      cached: false,
      auditLog: {
        timestamp: new Date().toISOString(),
        url: flipkartUrl,
        statusCode: 200,
        success: true,
        source: "firecrawl_api",
        estimatedCredits: 1,
        durationMs: 50,
      },
    });

    const candidates = [
      {
        platform: "Amazon" as const,
        url: "https://www.amazon.in/dp/B0D123XYZ",
        title: "Realme P1 5G (Peacock Green, 6GB RAM, 128GB Storage)",
        rawContent: {
          html: `<span id="productTitle">Realme P1 5G (Peacock Green, 6GB RAM, 128GB Storage)</span><span class="a-offscreen">₹15,499.00</span><input id="add-to-cart-button" />`,
          markdown: "Price: ₹15,499\nAdd to Cart",
        },
      },
    ];

    const result = await service.analyzeProductUrl(flipkartUrl, { candidates });

    expect(result.candidateEvaluations[0].matchResult.isMatch).toBe(true);
    expect(result.candidateEvaluations[0].isEligibleForComparison).toBe(true);
    expect(result.comparisonSummary?.availableStoreCount).toBe(2);
    expect(result.comparisonSummary?.lowestPrice.amount).toBe(14999);
    expect(result.comparisonSummary?.lowestPrice.platform).toBe("Flipkart");
    expect(result.comparisonSummary?.highestPrice.amount).toBe(15499);
    expect(result.comparisonSummary?.highestPrice.platform).toBe("Amazon");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6 — Croma Direct
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 6 — Croma Direct: extracts MacBook Air from Croma with CROMA_PRODUCT_ID and verified specs", () => {
    const url = "https://www.croma.com/apple-macbook-air-m3-chip-16gb-512gb-ssd-mac-os-38-1-cm-15-inch-space-grey-2024-/p/305597";
    const html = `
      <html>
        <body>
          <h1 class="pd-title">Apple MacBook Air 15" M3 (16GB RAM, 512GB SSD, Space Grey)</h1>
          <span class="amount">₹1,44,900.00</span>
          <span class="old-price">₹1,54,900.00</span>
          <button class="pdp-add-to-cart">Add to Cart</button>
        </body>
      </html>
    `;
    const content = {
      html,
      markdown: "# Apple MacBook Air 15\" M3 (16GB RAM, 512GB SSD, Space Grey)\nPrice: ₹1,44,900\nAdd to Cart",
      statusCode: 200,
    };

    const identity = cromaAdapter.extractCanonicalIdentity(content, url);
    const quote = cromaAdapter.normalize(content, url);

    expect(quote.platform).toBe("Croma");
    expect(quote.productIdentifier).toBe("305597");
    expect(quote.identifierType).toBe("CROMA_PRODUCT_ID");
    expect(identity.brand).toBe("Apple");
    expect(identity.variant.ram).toBe("16GB");
    expect(identity.variant.storage).toBe("512GB");
    expect(identity.variant.color).toBe("Space Grey");
    expect(quote.price?.current).toBe(144900);
    expect(quote.price?.mrp).toBe(154900);
    expect(quote.availability.status).toBe("IN_STOCK");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7 — Croma → Amazon / Flipkart Cross-Store
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 7 — Croma Cross-Store: compares Croma MacBook against Amazon & Flipkart verified offers", async () => {
    const mockFirecrawl = new FirecrawlClient("test-key");
    const service = new CrossStorePriceIntelligenceService(mockFirecrawl);

    const cromaUrl = "https://www.croma.com/p/305597";
    vi.spyOn(mockFirecrawl, "scrapeUrl").mockResolvedValue({
      markdown: "# Apple MacBook Air 15 M3 16GB 512GB Space Grey\nPrice: ₹1,44,900",
      html: `
        <h1 class="pd-title">Apple MacBook Air 15 M3 (16GB RAM, 512GB SSD, Space Grey)</h1>
        <span class="amount">₹1,44,900.00</span>
        <button class="pdp-add-to-cart">Add to Cart</button>
      `,
      statusCode: 200,
      cached: false,
      auditLog: {
        timestamp: new Date().toISOString(),
        url: cromaUrl,
        statusCode: 200,
        success: true,
        source: "firecrawl_api",
        estimatedCredits: 1,
        durationMs: 50,
      },
    });

    const candidates = [
      {
        platform: "Amazon" as const,
        url: "https://www.amazon.in/dp/B0CX23V253",
        title: "Apple MacBook Air 15 M3 (16GB RAM, 512GB SSD, Space Grey)",
        rawContent: {
          html: `<span class="a-offscreen">₹1,42,990.00</span><input id="add-to-cart-button" />`,
          markdown: "Price: ₹1,42,990\nAdd to Cart",
        },
      },
      {
        platform: "Flipkart" as const,
        url: "https://www.flipkart.com/apple-macbook-air-m3/p/itm123?pid=APPLE15M3",
        title: "Apple MacBook Air 15 M3 (16 GB, 512 GB SSD, Space Grey)",
        rawContent: {
          html: `<div font="default-fk-font-l">₹1,43,490</div><button>Add to Cart</button>`,
          markdown: "Price: ₹1,43,490\nAdd to Cart",
        },
      },
    ];

    const result = await service.analyzeProductUrl(cromaUrl, { candidates });

    expect(result.comparisonSummary?.availableStoreCount).toBe(3);
    expect(result.comparisonSummary?.lowestPrice.amount).toBe(142990);
    expect(result.comparisonSummary?.lowestPrice.platform).toBe("Amazon");
    expect(result.comparisonSummary?.medianPrice.amount).toBe(143490);
    expect(result.comparisonSummary?.highestPrice.amount).toBe(144900);
    expect(result.comparisonSummary?.highestPrice.platform).toBe("Croma");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8 — Meesho Direct
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 8 — Meesho Direct: extracts boAt earbuds with MEESHO_PRODUCT_ID and validated price", () => {
    const url = "https://www.meesho.com/boat-airdopes-131-wireless-earbuds/p/4x7y8z";
    const html = `
      <html>
        <body>
          <h1>boAt Airdopes 131 Wireless Earbuds (Active Black)</h1>
          <h4 class="price">₹899</h4>
          <span style="text-decoration: line-through">₹2,990</span>
          <button class="add-to-cart">Add to Cart</button>
        </body>
      </html>
    `;
    const content = {
      html,
      markdown: "# boAt Airdopes 131 Wireless Earbuds (Active Black)\nPrice: ₹899\n~~₹2,990~~\nAdd to Cart",
      statusCode: 200,
    };

    const identity = meeshoAdapter.extractCanonicalIdentity(content, url);
    const quote = meeshoAdapter.normalize(content, url);

    expect(quote.platform).toBe("Meesho");
    expect(quote.productIdentifier).toBe("4x7y8z");
    expect(quote.identifierType).toBe("MEESHO_PRODUCT_ID");
    expect(identity.brand).toBe("boAt");
    expect(quote.price?.current).toBe(899);
    expect(quote.price?.mrp).toBe(2990);
    expect(quote.availability.status).toBe("IN_STOCK");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9 — Meesho Cross-Store (Strict Identity, No Forced Match)
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 9 — Meesho Cross-Store: rejects generic unbranded Meesho product against branded reference", () => {
    const reference = {
      platform: "Amazon" as const,
      sourceUrl: "https://www.amazon.in/dp/B07S9DR87T",
      rawTitle: "Logitech G102 Lightsync Gaming Mouse",
      cleanTitle: "Logitech G102 Lightsync Gaming Mouse",
      brand: "Logitech",
      model: "G102",
      category: "General Electronics",
      variant: {},
      seller: "Cloudtail",
      imageUrl: null,
    };

    const genericMeeshoCandidate = {
      title: "Fancy RGB Wireless Mouse with 7 Colors LED Backlight",
      brand: null, // Generic unbranded on Meesho
      model: null,
      category: "General Electronics",
      variant: {},
    };

    const matchResult = defaultProductMatcher.evaluateMatch(reference, genericMeeshoCandidate);

    // Must NOT force match!
    expect(matchResult.isMatch).toBe(false);
    expect(matchResult.confidenceScore).toBeLessThan(75);
    expect(matchResult.matchStatus).toBe("LOW_CONFIDENCE");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10 — Wrong Variant (8GB/128GB vs 12GB/256GB -> REJECT)
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 10 — Wrong Variant: strictly rejects match when RAM or storage conflict", () => {
    const reference = {
      platform: "Amazon" as const,
      sourceUrl: "https://www.amazon.in/dp/B0H3LKPC2K",
      rawTitle: "OnePlus N6 (6GB RAM, 128GB Storage)",
      cleanTitle: "OnePlus N6 (6GB RAM, 128GB Storage)",
      brand: "OnePlus",
      model: "N6",
      category: "Mobiles & Tablets",
      variant: {
        ram: "6GB",
        storage: "128GB",
      },
      seller: "Appario",
      imageUrl: null,
    };

    const candidateWrongStorage = {
      title: "OnePlus N6 (12GB RAM, 256GB Storage)",
      brand: "OnePlus",
      model: "N6",
      category: "Mobiles & Tablets",
      variant: {
        ram: "12GB",
        storage: "256GB", // CONFLICT!
      },
    };

    const result = defaultProductMatcher.evaluateMatch(reference, candidateWrongStorage);
    expect(result.isMatch).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.matchStatus).toBe("MISMATCH");
    expect(result.rejectionReason).toContain("Storage mismatch");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11 — Wrong Model (Same brand, similar title, different model -> REJECT)
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 11 — Wrong Model: strictly rejects match when model numbers conflict (Logitech G102 vs G304)", () => {
    const reference = {
      platform: "Amazon" as const,
      sourceUrl: "https://www.amazon.in/dp/B07S9DR87T",
      rawTitle: "Logitech G102 Lightsync Gaming Mouse",
      cleanTitle: "Logitech G102 Lightsync Gaming Mouse",
      brand: "Logitech",
      model: "G102",
      category: "General Electronics",
      variant: {},
      seller: "Cloudtail",
      imageUrl: null,
    };

    const candidateG304 = {
      title: "Logitech G304 Lightspeed Wireless Gaming Mouse",
      brand: "Logitech",
      model: "G304", // CONFLICT!
      category: "General Electronics",
      variant: {},
    };

    const result = defaultProductMatcher.evaluateMatch(reference, candidateG304);
    expect(result.isMatch).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.matchStatus).toBe("MISMATCH");
    expect(result.rejectionReason).toContain("Model conflict");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12 — Price Contamination (MRP, EMI, Bank Offer, Exchange Rejection)
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 12 — Price Contamination: ensures selling price is ₹37,990 and rejects EMI, Bank, or Exchange amounts", () => {
    // 1. Genuine selling price
    const valid = validateCurrentSellingPrice({
      sellingPrice: 37990,
      mrp: 50000,
      currency: "INR",
      contextText: "Selling Price ₹37,990",
    });
    expect(valid.isValid).toBe(true);
    expect(valid.price?.current).toBe(37990);

    // 2. Reject EMI ₹1,999/month
    const emi = validateCurrentSellingPrice({
      sellingPrice: 1999,
      mrp: 50000,
      contextText: "EMI ₹1,999/month starts here",
    });
    expect(emi.isValid).toBe(false);

    // 3. Reject Bank Offer ₹35,990
    const bank = validateCurrentSellingPrice({
      sellingPrice: 35990,
      mrp: 50000,
      contextText: "Effective price with bank offer ₹35,990",
    });
    expect(bank.isValid).toBe(false);

    // 4. Reject Exchange ₹30,000
    const exchange = validateCurrentSellingPrice({
      sellingPrice: 30000,
      mrp: 50000,
      contextText: "with exchange offer ₹30,000",
    });
    expect(exchange.isValid).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 13 — Availability Validation (UNKNOWN never treated as IN_STOCK)
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 13 — Availability Validation: tests IN_STOCK, OUT_OF_STOCK, and guarantees UNKNOWN is never purchasable", () => {
    // A. IN_STOCK with Add to Cart button
    const inStock = defaultAvailabilityValidator.validate({
      html: `<button id="add-to-cart-button">Add to Cart</button>`,
      markdown: "In Stock",
    });
    expect(inStock.status).toBe("IN_STOCK");
    expect(defaultAvailabilityValidator.isPurchasable(inStock.status)).toBe(true);

    // B. OUT_OF_STOCK with explicit unavailable text
    const outOfStock = defaultAvailabilityValidator.validate({
      html: `<div>Currently unavailable. We don't know when this item will be back.</div>`,
      markdown: "Out of Stock",
    });
    expect(outOfStock.status).toBe("OUT_OF_STOCK");
    expect(defaultAvailabilityValidator.isPurchasable(outOfStock.status)).toBe(false);

    // C. UNKNOWN with generic page that lacks positive purchase evidence
    const unknown = defaultAvailabilityValidator.validate({
      html: `<div>Welcome to our product showcase</div>`,
      markdown: "Product details and specifications",
    });
    expect(unknown.status).toBe("UNKNOWN");
    // CRITICAL REQUIREMENT: UNKNOWN must NEVER be treated as available
    expect(defaultAvailabilityValidator.isPurchasable(unknown.status)).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 14 — Cache Isolation (Product A vs Product B)
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 14 — Cache Isolation: Product B must NEVER return Product A's cached data", () => {
    const cache = new FirecrawlScrapeCache();
    cache.clear();
    const urlA = "https://www.flipkart.com/logitech-g102/p/itm111?pid=PID_AAA";
    const urlB = "https://www.flipkart.com/realme-p1/p/itm222?pid=PID_BBB";

    // Hash keys must be distinct
    const hashA = hashUrl(urlA);
    const hashB = hashUrl(urlB);
    expect(hashA).not.toBe(hashB);

    cache.set(urlA, {
      url: urlA,
      markdown: "# Logitech G102 Mouse\nPrice: ₹1,495",
      statusCode: 200,
      source: "firecrawl",
    });

    const cachedA = cache.get(urlA);
    const cachedB = cache.get(urlB);

    expect(cachedA).not.toBeNull();
    expect(cachedA?.markdown).toContain("Logitech G102");

    // Product B must be null and NOT return Product A
    expect(cachedB).toBeNull();

    // Now set Product B
    cache.set(urlB, {
      url: urlB,
      markdown: "# Realme P1 Smartphone\nPrice: ₹14,999",
      statusCode: 200,
      source: "firecrawl",
    });

    expect(cache.get(urlA)?.markdown).toContain("Logitech G102");
    expect(cache.get(urlB)?.markdown).toContain("Realme P1");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 15 — Amazon Regression
  // ───────────────────────────────────────────────────────────────────────────
  it("TEST 15 — Amazon Regression: ensures Amazon ASIN extraction and adapter behavior remain 100% verified", () => {
    const testCases = [
      {
        url: "https://www.amazon.in/dp/B0CX21CBRX",
        expectedAsin: "B0CX21CBRX",
      },
      {
        url: "https://www.amazon.in/OnePlus-Midnight-Green-128GB/dp/B0H3LKPC2K/ref=sr_1_1",
        expectedAsin: "B0H3LKPC2K",
      },
      {
        url: "https://www.amazon.com/gp/product/B09XS7JWHH",
        expectedAsin: "B09XS7JWHH",
      },
    ];

    for (const tc of testCases) {
      expect(extractAsin(tc.url)).toBe(tc.expectedAsin);
      expect(amazonAdapter.canHandle(tc.url)).toBe(true);
    }

    // Verify search query builder for Amazon
    const query = amazonAdapter.buildSearchQuery({
      platform: "Amazon",
      sourceUrl: testCases[0].url,
      rawTitle: "Realme P4 5G",
      cleanTitle: "Realme P4 5G",
      brand: "Realme",
      model: "P4 5G",
      category: "Mobiles & Tablets",
      variant: { ram: "8GB", storage: "128GB" },
      seller: null,
      imageUrl: null,
    });
    expect(query).toContain("Realme");
    expect(query).toContain("P4 5G");
    expect(query).toContain("8GB");
    expect(query).toContain("128GB");
  });
});
