import { describe, it, expect, vi, beforeEach } from "vitest";
import { AmazonAdapter, isAmazonBlockedOrErrorContent } from "./amazon-adapter";
import { CrossStorePriceIntelligenceService } from "../price-intelligence/cross-store-service";
import { FirecrawlClient } from "../firecrawl/firecrawl-client";
import { AmazonPriceProvider, AmazonAccessError, PriceUnavailableError } from "../price-watch/amazon-price-provider";
import { defaultPriceComparisonEngine, PriceComparisonEngine } from "../price-intelligence/comparison-engine";
import { defaultPriceObservationStore } from "../price-intelligence/price-observation-store";
import { extractAsin, canonicalizeAmazonUrl } from "@/lib/amazon/asin";
import { validateExtractedIdentityAgainstUrl } from "../price-intelligence/scraper-diagnostics";
import type { NormalizedProductQuote, ScrapedContent } from "./platform.types";

describe("Amazon Scraper Regression Suite (Tests A - E)", () => {
  let mockFirecrawl: FirecrawlClient;
  let crossStoreService: CrossStorePriceIntelligenceService;
  let adapter: AmazonAdapter;
  let priceProvider: AmazonPriceProvider;

  beforeEach(() => {
    mockFirecrawl = new FirecrawlClient("test-key");
    adapter = new AmazonAdapter();
    priceProvider = new AmazonPriceProvider();
    crossStoreService = new CrossStorePriceIntelligenceService(mockFirecrawl, adapter);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST A — Original Amazon product URL (Razer DeathAdder Essential)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test A: extracts correct product identity and valid price for Razer DeathAdder Essential and rejects ad redirects", async () => {
    const rawSponsoredUrl =
      "https://www.amazon.in/gp/slredirect/picassoRedirect.html/ref=pa_sp_atf_aps_sr_pg1_1?adId=20087654321&url=%2FRazer-DeathAdder-Essential-Gaming-RZ01-03850100-R3M1%2Fdp%2FB09453J4ST%2Fref%3Dsr_1_1";

    // 1. Verify URL normalization strips advertising tracking and prevents ad-domain redirection
    const canonical = canonicalizeAmazonUrl(rawSponsoredUrl);
    expect(canonical).toBe("https://www.amazon.in/dp/B09453J4ST");
    expect(extractAsin(rawSponsoredUrl)).toBe("B09453J4ST");

    const razerHtml = `
      <html>
        <head>
          <title>Razer DeathAdder Essential Ergonomic Wired Gaming Mouse : Amazon.in: Computers & Accessories</title>
        </head>
        <body>
          <span id="productTitle">Razer DeathAdder Essential Ergonomic Wired Gaming Mouse (Black)</span>
          <a id="bylineInfo">Brand: Razer</a>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price a-text-price a-size-medium apexPriceToPay">
              <span class="a-offscreen">₹1,299.00</span>
            </span>
            <span class="a-price a-text-price a-size-base" data-a-strike="true">
              <span class="a-offscreen">₹4,499.00</span>
            </span>
          </div>
          <div id="availability">
            <span class="a-size-medium a-color-success">In stock.</span>
          </div>
          <input id="add-to-cart-button" type="submit" value="Add to Cart" />
          <div id="sellerProfileTriggerId">Appario Retail Private Ltd</div>
        </body>
      </html>
    `;

    vi.spyOn(mockFirecrawl, "scrapeUrl").mockResolvedValue({
      markdown: "# Razer DeathAdder Essential Ergonomic Wired Gaming Mouse\nPrice: ₹1,299\nM.R.P.: ₹4,499\nIn stock.",
      html: razerHtml,
      statusCode: 200,
      cached: false,
      auditLog: {
        timestamp: new Date().toISOString(),
        url: canonical,
        statusCode: 200,
        success: true,
        source: "firecrawl_api",
        estimatedCredits: 1,
        durationMs: 80,
      },
    });

    const analysis = await crossStoreService.analyzeProductUrl(rawSponsoredUrl);

    // Verify correct product identity
    expect(analysis.canonicalIdentity.brand).toBe("Razer");
    expect(analysis.canonicalIdentity.cleanTitle).toContain("Razer DeathAdder Essential");
    expect(analysis.canonicalIdentity.productIdentifier).toBe("B09453J4ST");
    expect(analysis.sourceQuote.price?.current).toBe(1299);
    expect(analysis.sourceQuote.price?.mrp).toBe(4499);
    expect(analysis.sourceQuote.availability.status).toBe("IN_STOCK");
    expect(analysis.sourceQuote.price?.current).not.toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST B — Invalid Amazon content (Blocked-Page Rejection)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test B: recognizes 'aax-eu.amazon-adsystem.com is blocked' as an error and produces a clear extraction failure", async () => {
    const blockedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>aax-eu.amazon-adsystem.com is blocked</title>
        </head>
        <body>
          <h1>aax-eu.amazon-adsystem.com is blocked</h1>
          <p>Requests to the server have been blocked by an extension (net::ERR_BLOCKED_BY_CLIENT).</p>
        </body>
      </html>
    `;
    const blockedContent: ScrapedContent = {
      html: blockedHtml,
      markdown: "# aax-eu.amazon-adsystem.com is blocked\nRequests to the server have been blocked by an extension.",
      statusCode: 200,
    };

    // 1. Verify content level detection
    expect(isAmazonBlockedOrErrorContent(blockedContent)).toBe(true);

    // 2. Adapter must reject it and NOT return error string as title or invent bogus variants
    const identity = adapter.extractCanonicalIdentity(blockedContent, "https://www.amazon.in/dp/B09453J4ST");
    expect(identity.cleanTitle).toBe("");
    expect(identity.rawTitle).toBe("");
    expect(identity.brand).toBeNull();
    expect(identity.model).toBeNull();
    expect(Object.keys(identity.variant)).toHaveLength(0);

    const quote = adapter.normalize(blockedContent, "https://www.amazon.in/dp/B09453J4ST");
    expect(quote.title).toBe("");
    expect(quote.price).toBeNull();
    expect(quote.availability.status).toBe("UNKNOWN");

    // 3. validateExtractedIdentityAgainstUrl must fail with CAPTCHA_OR_BLOCKED
    const check = validateExtractedIdentityAgainstUrl(
      "https://www.amazon.in/dp/B09453J4ST",
      identity,
      blockedContent
    );
    expect(check.isValid).toBe(false);
    expect(check.failureReason).toBe("CAPTCHA_OR_BLOCKED");

    // 4. CrossStorePriceIntelligenceService must fail and throw an extraction error
    vi.spyOn(mockFirecrawl, "scrapeUrl").mockResolvedValue({
      markdown: blockedContent.markdown,
      html: blockedContent.html,
      statusCode: 200,
      cached: false,
      auditLog: {
        timestamp: new Date().toISOString(),
        url: "https://www.amazon.in/dp/B09453J4ST",
        statusCode: 200,
        success: true,
        source: "firecrawl_api",
        estimatedCredits: 1,
        durationMs: 50,
      },
    });

    await expect(
      crossStoreService.analyzeProductUrl("https://www.amazon.in/dp/B09453J4ST")
    ).rejects.toThrow(/Scraper validation failed/i);

    // 5. AmazonPriceProvider must throw AmazonAccessError
    await expect(
      priceProvider.getAmazonPrice({
        asin: "B09453J4ST",
        options: {
          htmlOverride: blockedHtml,
        },
      })
    ).rejects.toThrow(AmazonAccessError);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST C — Missing price integrity (price = null, not 0)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test C: ensures missing price produces null, never 0, and excludes from lowest-price calculations", async () => {
    // Content without any price
    const noPriceContent: ScrapedContent = {
      html: `
        <html>
          <body>
            <span id="productTitle">Razer DeathAdder Essential Ergonomic Wired Gaming Mouse</span>
            <div id="availability">
              <span class="a-color-success">In stock.</span>
            </div>
            <input id="add-to-cart-button" type="submit" value="Add to Cart" />
          </body>
        </html>
      `,
      markdown: "# Razer DeathAdder Essential\nIn stock.",
      statusCode: 200,
    };

    // 1. Adapter price extraction returns null, not 0
    const price = adapter.extractPrice(noPriceContent);
    expect(price).toBeNull();

    // 2. Normalize sets price: null
    const quote = adapter.normalize(noPriceContent, "https://www.amazon.in/dp/B09453J4ST");
    expect(quote.price).toBeNull();

    // 3. Comparison engine handles quote with null price without calculating lowestPrice: 0
    const comparison = defaultPriceComparisonEngine.compare([quote]);
    expect(comparison).toBeNull(); // No verified priced offers -> null summary

    // 4. Observation store strictly rejects recording price: 0
    await expect(
      defaultPriceObservationStore.recordObservation({
        platform: "Amazon",
        productUrl: "https://www.amazon.in/dp/B09453J4ST",
        title: "Razer DeathAdder",
        price: 0,
        availability: "IN_STOCK",
      })
    ).rejects.toThrow(/Invalid price observation/i);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST D — Valid Amazon product
  // ───────────────────────────────────────────────────────────────────────────
  it("Test D: verifies standard Amazon scraping flow functions correctly for valid product", async () => {
    const validHtml = `
      <html>
        <head>
          <title>Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black : Amazon.in</title>
        </head>
        <body>
          <span id="productTitle">Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black</span>
          <a id="bylineInfo">Visit the Sony Store</a>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price a-text-price a-size-medium apexPriceToPay">
              <span class="a-offscreen">₹29,990.00</span>
            </span>
            <span class="a-price a-text-price a-size-base" data-a-strike="true">
              <span class="a-offscreen">₹34,990.00</span>
            </span>
          </div>
          <div id="availability">
            <span class="a-color-success">In stock.</span>
          </div>
          <input id="add-to-cart-button" type="submit" value="Add to Cart" />
        </body>
      </html>
    `;

    const content: ScrapedContent = {
      html: validHtml,
      markdown: "# Sony WH-1000XM5 Wireless Noise Cancelling Headphones\nPrice: ₹29,990",
      statusCode: 200,
    };

    const quote = adapter.normalize(content, "https://www.amazon.in/dp/B09XS7JWHH");
    expect(quote.title).toBe("Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black");
    expect(quote.brand).toBe("Sony");
    expect(quote.price?.current).toBe(29990);
    expect(quote.price?.mrp).toBe(34990);
    expect(quote.availability.status).toBe("IN_STOCK");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST E — Regression check (Integration with Comparison Engine)
  // ───────────────────────────────────────────────────────────────────────────
  it("Test E: verifies valid Amazon prices pass through to the comparison engine and calculate correct lowest price", () => {
    const engine = new PriceComparisonEngine();

    const amazonQuote: NormalizedProductQuote = {
      platform: "Amazon",
      productUrl: "https://www.amazon.in/dp/B09453J4ST",
      title: "Razer DeathAdder Essential Ergonomic Wired Gaming Mouse",
      brand: "Razer",
      model: "DeathAdder Essential",
      variant: { color: "Black" },
      price: { current: 1299, currency: "INR", mrp: 4499 },
      availability: { status: "IN_STOCK", evidence: "Add to Cart present", confidence: 0.98 },
      seller: "Appario Retail",
      imageUrl: null,
      scrapedAt: new Date().toISOString(),
      rawConfidence: 0.98,
    };

    const flipkartQuote: NormalizedProductQuote = {
      platform: "Flipkart",
      productUrl: "https://www.flipkart.com/p/razer-deathadder",
      title: "Razer DeathAdder Essential Gaming Mouse",
      brand: "Razer",
      model: "DeathAdder Essential",
      variant: { color: "Black" },
      price: { current: 1449, currency: "INR", mrp: 4499 },
      availability: { status: "IN_STOCK", evidence: "Buy Now present", confidence: 0.95 },
      seller: "RetailNet",
      imageUrl: null,
      scrapedAt: new Date().toISOString(),
      rawConfidence: 0.95,
    };

    const summary = engine.compare([amazonQuote, flipkartQuote]);
    expect(summary).not.toBeNull();
    expect(summary?.lowestPrice.amount).toBe(1299);
    expect(summary?.lowestPrice.platform).toBe("Amazon");
    expect(summary?.highestPrice.amount).toBe(1449);
    expect(summary?.highestPrice.platform).toBe("Flipkart");
    expect(summary?.availableStoreCount).toBe(2);
    expect(summary?.maxSavings).toBe(150);
  });
});
