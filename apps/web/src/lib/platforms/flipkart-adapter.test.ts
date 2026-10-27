import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FlipkartAdapter,
  extractFlipkartPid,
  canonicalizeFlipkartUrl,
} from "./flipkart-adapter";
import { AmazonAdapter } from "./amazon-adapter";
import { CrossStorePriceIntelligenceService } from "../price-intelligence/cross-store-service";
import { FirecrawlClient } from "../firecrawl/firecrawl-client";
import { firecrawlCache } from "../firecrawl/cache";
import { prototypeStore } from "../store/prototype-store";
import { defaultProductMatcher } from "../price-intelligence/product-matcher";
import { defaultPriceComparisonEngine } from "../price-intelligence/comparison-engine";

describe("Phase 2A — Flipkart Cross-Store Integration Test Suite", () => {
  let flipkartAdapter: FlipkartAdapter;
  let mockFirecrawl: FirecrawlClient;
  let service: CrossStorePriceIntelligenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    firecrawlCache.clear();
    flipkartAdapter = new FlipkartAdapter();
    mockFirecrawl = new FirecrawlClient("test-key");
    service = new CrossStorePriceIntelligenceService(
      mockFirecrawl,
      new AmazonAdapter(),
      flipkartAdapter
    );
  });

  // =========================================================================
  // TEST A — Flipkart direct product URL
  // =========================================================================
  describe("TEST A — Flipkart Direct Product URL", () => {
    it("identifies Flipkart URLs, cleans tracking parameters, and extracts canonical PID", () => {
      const rawUrl =
        "https://www.flipkart.com/oneplus-nord-ce-3-lite-5g-chromatic-gray-128-gb/p/itm2cd5a4e168a9f?pid=MOBGZJ42RAGZTZTH&lid=LSTMOBGZJ42RAGZTZTH&marketplace=FLIPKART&otracker=hp_omu";

      expect(flipkartAdapter.canHandle(rawUrl)).toBe(true);
      expect(flipkartAdapter.canHandle("https://dl.flipkart.com/s/xyz123")).toBe(true);
      expect(flipkartAdapter.canHandle("https://fkrt.it/abc456")).toBe(true);
      expect(flipkartAdapter.canHandle("https://www.amazon.in/dp/B0CX21CBRX")).toBe(false);

      const pid = extractFlipkartPid(rawUrl);
      expect(pid).toBe("MOBGZJ42RAGZTZTH");

      const canonicalUrl = canonicalizeFlipkartUrl(rawUrl);
      expect(canonicalUrl).toBe(
        "https://www.flipkart.com/oneplus-nord-ce-3-lite-5g-chromatic-gray-128-gb/p/itm2cd5a4e168a9f?pid=MOBGZJ42RAGZTZTH"
      );
      // Tracking params like otracker, marketplace, lid must be stripped
      expect(canonicalUrl).not.toContain("otracker");
      expect(canonicalUrl).not.toContain("marketplace");
    });

    it("extracts complete canonical identity, selling price, and availability from a direct Flipkart product page", () => {
      const flipkartUrl =
        "https://www.flipkart.com/oneplus-nord-ce-3-lite-5g-chromatic-gray-128-gb/p/itm2cd5a4e168a9f?pid=MOBGZJ42RAGZTZTH";

      const sampleHtml = `
        <html>
          <body>
            <div class="_3GIHBu">Mobiles & Accessories > Smartphones > OnePlus</div>
            <h1 class="VU-ZEz">OnePlus Nord CE 3 Lite 5G (Chromatic Gray, 128 GB) (8 GB RAM)</h1>
            <span class="G6XhRU">OnePlus</span>
            <div class="Nx9bqj CxhGGd">₹17,499</div>
            <div class="yRaY8j A68aAq">₹19,999</div>
            <div id="sellerName"><span>OmniTech Retail</span></div>
            <img class="_0DkuPH" src="https://rukminim2.flixcart.com/image/oneplus.jpg" />
            <button class="_2KpZ6l _2U9uOA _3v1-ww">ADD TO CART</button>
            <button class="_2KpZ6l _2U9uOA ih0U9O _3v1-ww">BUY NOW</button>
          </body>
        </html>
      `;

      const sampleMd = `
# OnePlus Nord CE 3 Lite 5G (Chromatic Gray, 128 GB) (8 GB RAM)
₹17,499
~~₹19,999~~ 12% off
Add to Cart
Buy Now
Seller: OmniTech Retail
      `;

      const content = {
        html: sampleHtml,
        markdown: sampleMd,
        statusCode: 200,
      };

      const identity = flipkartAdapter.extractCanonicalIdentity(content, flipkartUrl);
      expect(identity.platform).toBe("Flipkart");
      expect(identity.brand).toBe("OnePlus");
      expect(identity.cleanTitle).toContain("OnePlus Nord CE 3 Lite 5G");
      expect(identity.variant.ram).toBe("8GB");
      expect(identity.variant.storage).toBe("128GB");
      expect(identity.variant.color).toBe("Chromatic Gray");
      expect(identity.sku).toBe("MOBGZJ42RAGZTZTH");
      expect(identity.seller).toBe("OmniTech Retail");
      expect(identity.category).toBe("Mobiles & Tablets");

      const price = flipkartAdapter.extractPrice(content);
      expect(price).not.toBeNull();
      expect(price?.current).toBe(17499);
      expect(price?.mrp).toBe(19999);
      expect(price?.discount_percent).toBe(13); // round((19999-17499)/19999*100) = 13%

      const avail = flipkartAdapter.extractAvailability(content);
      expect(avail.status).toBe("IN_STOCK");
      expect(avail.evidence).toContain("Add to Cart");
    });
  });

  // =========================================================================
  // TEST B — Bidirectional Cross-Store Discovery (Amazon <-> Flipkart)
  // =========================================================================
  describe("TEST B — Bidirectional Cross-Store Discovery (Amazon <-> Flipkart)", () => {
    it("TEST 1: Amazon URL → Amazon extraction → Flipkart discovery → Flipkart matching → Flipkart availability → Flipkart price → Amazon + Flipkart comparison", async () => {
      const amazonUrl = "https://www.amazon.in/dp/B0CX21CBRX";
      const flipkartUrl = "https://www.flipkart.com/oneplus-n6-midnight-green-128-gb/p/itm123456789";

      // 1. Mock Amazon scrape
      vi.spyOn(mockFirecrawl, "scrapeUrl").mockImplementation(async (targetUrl: string) => {
        if (targetUrl === amazonUrl) {
          return {
            markdown: "# OnePlus N6 (Midnight Green, 6GB RAM, 128GB Storage)\n₹18,499",
            html: `
              <span id="productTitle">OnePlus N6 (Midnight Green, 6GB RAM, 128GB Storage)</span>
              <a id="bylineInfo">Brand: OnePlus</a>
              <div id="corePriceDisplay_desktop_feature_div">
                <span class="a-price a-text-price a-size-medium apexPriceToPay">
                  <span class="a-offscreen">₹18,499.00</span>
                </span>
              </div>
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
              durationMs: 100,
            },
          };
        }

        if (targetUrl === flipkartUrl) {
          return {
            markdown: "# OnePlus N6 (Midnight Green, 128 GB) (6 GB RAM)\n₹17,999\nADD TO CART",
            html: `
              <h1 class="VU-ZEz">OnePlus N6 (Midnight Green, 128 GB) (6 GB RAM)</h1>
              <div class="Nx9bqj CxhGGd">₹17,999</div>
              <button class="_2KpZ6l _2U9uOA _3v1-ww">ADD TO CART</button>
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
              durationMs: 100,
            },
          };
        }

        throw new Error(`Unexpected scrapeUrl for ${targetUrl}`);
      });

      // 2. Mock targeted Firecrawl search
      const searchSpy = vi.spyOn(mockFirecrawl, "search").mockResolvedValue({
        results: [
          {
            url: flipkartUrl,
            title: "OnePlus N6 (Midnight Green, 128 GB) (6 GB RAM) - Flipkart",
            description: "Buy OnePlus N6 6GB 128GB online at best price",
          },
        ],
        cached: false,
        auditLog: {
          timestamp: new Date().toISOString(),
          url: "search:site:flipkart.com OnePlus N6 6GB 128GB",
          statusCode: 200,
          success: true,
          source: "firecrawl_api",
          estimatedCredits: 1,
          durationMs: 90,
        },
      });

      const result = await service.analyzeProductUrl(amazonUrl, {
        recordObservation: true,
        targetPlatforms: ["Flipkart"],
      });

      expect(searchSpy).toHaveBeenCalledTimes(1);
      const searchCallQuery = searchSpy.mock.calls[0][0];
      expect(searchCallQuery).toContain("site:flipkart.com");
      expect(searchCallQuery).toContain("OnePlus");
      expect(searchCallQuery).toContain("128GB");

      // Verify Candidate was evaluated and matched
      expect(result.candidateEvaluations.length).toBe(1);
      const cand = result.candidateEvaluations[0];
      expect(cand.quote.platform).toBe("Flipkart");
      expect(cand.matchResult.isMatch).toBe(true);
      expect(cand.matchResult.confidenceScore).toBeGreaterThanOrEqual(90);
      expect(cand.quote.availability.status).toBe("IN_STOCK");
      expect(cand.isEligibleForComparison).toBe(true);
      expect(cand.quote.price?.current).toBe(17999);

      // Verify Cross-Store Comparison: Amazon ₹18,499 vs Flipkart ₹17,999
      expect(result.comparisonSummary).not.toBeNull();
      expect(result.comparisonSummary?.lowestPrice.amount).toBe(17999);
      expect(result.comparisonSummary?.lowestPrice.platform).toBe("Flipkart");
      expect(result.comparisonSummary?.highestPrice.amount).toBe(18499);
      expect(result.comparisonSummary?.highestPrice.platform).toBe("Amazon");
      expect(result.comparisonSummary?.availableStoreCount).toBe(2);

      // Verify price observations stored
      const observations = prototypeStore.getPriceObservations();
      const flipkartObs = observations.find((o) => o.platform === "Flipkart");
      expect(flipkartObs).toBeDefined();
      expect(flipkartObs?.price).toBe(17999);
      expect(flipkartObs?.availability).toBe("IN_STOCK");
    });

    it("TEST 2: Flipkart URL → Flipkart extraction → Amazon discovery → Amazon matching → Amazon availability → Amazon price → Flipkart + Amazon comparison", async () => {
      const flipkartWashingMachineUrl =
        "https://www.flipkart.com/ifb-9-kg-swirl-wash-2x-power-steam-30-min-steam-refresh-program-eco-inverter-motor-wifi-enabled-deepclean-powered-ai-fully-automatic-front-load-washing-machine-in-built-heater-black/p/itma835527a5d0c6?pid=WMNHEGV6JCGH7V7B";
      const amazonWashingMachineUrl =
        "https://www.amazon.in/IFB-EXECUTIVE-MXN-9014K-CMS/dp/B0F8QV7RCR";

      // 1. Mock Firecrawl Scrapes
      vi.spyOn(mockFirecrawl, "scrapeUrl").mockImplementation(async (targetUrl: string) => {
        if (targetUrl === flipkartWashingMachineUrl) {
          return {
            markdown: `
# IFB 9 kg with 9 Swirl Wash, 2x Power Steam, 30 Min Steam Refresh Program, Eco Inverter Motor, WiFi Enabled, DeepClean Powered by Ai Fully Automatic Front Load Washing Machine with In-built Heater Black
49,490
₹37,990
Buy Now
Add to Cart
            `,
            html: `
              <h1 class="v1zwn21n">IFB 9 kg with 9 Swirl Wash, 2x Power Steam, 30 Min Steam Refresh Program, Eco Inverter Motor, WiFi Enabled, DeepClean Powered by Ai Fully Automatic Front Load Washing Machine with In-built Heater Black</h1>
              <div style="text-decoration-line: line-through;">49,490</div>
              <div font="default-fk-font-l">₹37,990</div>
              <button>BUY NOW</button>
            `,
            statusCode: 200,
            cached: false,
            auditLog: {
              timestamp: new Date().toISOString(),
              url: flipkartWashingMachineUrl,
              statusCode: 200,
              success: true,
              source: "firecrawl_api",
              estimatedCredits: 1,
              durationMs: 120,
            },
          };
        }

        if (targetUrl === amazonWashingMachineUrl) {
          return {
            markdown: `
# IFB 9Kg 5 Star, 9 Swirl Wash, Steam Refresh, Eco Inverter Motor, WiFi Enabled Fully Automatic Front Load Washing Machine (EXECUTIVE MXN 9014K CMS, Mocha)
₹37,990
Add to Cart
            `,
            html: `
              <span id="productTitle">IFB 9Kg 5 Star, 9 Swirl Wash, Steam Refresh, Eco Inverter Motor, WiFi Enabled Fully Automatic Front Load Washing Machine (EXECUTIVE MXN 9014K CMS, Mocha)</span>
              <a id="bylineInfo">Brand: IFB</a>
              <div id="corePriceDisplay_desktop_feature_div">
                <span class="a-price a-text-price a-size-medium apexPriceToPay">
                  <span class="a-offscreen">₹37,990.00</span>
                </span>
              </div>
              <input id="add-to-cart-button" type="submit" value="Add to Cart" />
            `,
            statusCode: 200,
            cached: false,
            auditLog: {
              timestamp: new Date().toISOString(),
              url: amazonWashingMachineUrl,
              statusCode: 200,
              success: true,
              source: "firecrawl_api",
              estimatedCredits: 1,
              durationMs: 110,
            },
          };
        }

        throw new Error(`Unexpected scrapeUrl for ${targetUrl}`);
      });

      // 2. Mock Search for Amazon candidate
      const searchSpy = vi.spyOn(mockFirecrawl, "search").mockResolvedValue({
        results: [
          {
            url: amazonWashingMachineUrl,
            title: "IFB 9Kg 5 Star Front Load Washing Machine WiFi Enabled - Amazon.in",
            description: "Buy IFB 9kg Front Load WiFi Washing Machine online at Amazon India",
          },
        ],
        cached: false,
        auditLog: {
          timestamp: new Date().toISOString(),
          url: "search:site:amazon.in IFB 9 kg Front Load WiFi",
          statusCode: 200,
          success: true,
          source: "firecrawl_api",
          estimatedCredits: 1,
          durationMs: 95,
        },
      });

      const result = await service.analyzeProductUrl(flipkartWashingMachineUrl, {
        targetPlatforms: ["Amazon"],
      });

      // Verify Flipkart direct extraction was correct
      expect(result.sourceQuote.platform).toBe("Flipkart");
      expect(result.sourceQuote.productIdentifier).toBe("WMNHEGV6JCGH7V7B");
      expect(result.sourceQuote.identifierType).toBe("FLIPKART_PID");
      expect(result.sourceQuote.brand).toBe("IFB");
      expect(result.sourceQuote.price?.current).toBe(37990);
      expect(result.sourceQuote.price?.mrp).toBe(49490);
      expect(result.sourceQuote.availability.status).toBe("IN_STOCK");

      // Verify Amazon search was triggered with site:amazon.in
      expect(searchSpy).toHaveBeenCalledTimes(1);
      const searchCallQuery = searchSpy.mock.calls[0][0];
      expect(searchCallQuery).toContain("site:amazon.in");
      expect(searchCallQuery).toContain("IFB");
      expect(searchCallQuery).toContain("9 kg");

      // Verify Amazon Candidate was evaluated and matched
      expect(result.candidateEvaluations.length).toBe(1);
      const cand = result.candidateEvaluations[0];
      expect(cand.quote.platform).toBe("Amazon");
      expect(cand.matchResult.isMatch).toBe(true);
      expect(cand.matchResult.confidenceScore).toBeGreaterThanOrEqual(85);
      expect(cand.quote.availability.status).toBe("IN_STOCK");
      expect(cand.isEligibleForComparison).toBe(true);
      expect(cand.quote.price?.current).toBe(37990);

      // Verify Cross-Store Comparison: Flipkart ₹37,990 vs Amazon ₹37,990
      expect(result.comparisonSummary).not.toBeNull();
      expect(result.comparisonSummary?.lowestPrice.amount).toBe(37990);
      expect(result.comparisonSummary?.highestPrice.amount).toBe(37990);
      expect(result.comparisonSummary?.medianPrice.amount).toBe(37990);
      expect(result.comparisonSummary?.availableStoreCount).toBe(2);
      expect(result.comparisonSummary?.totalCheckedCount).toBe(2);
    });
  });

  // =========================================================================
  // TEST C — Incorrect variant rejection
  // =========================================================================
  describe("TEST C — Incorrect Variant Rejection", () => {
    it("strictly rejects candidates with capacity mismatch (9kg vs 8kg)", () => {
      const ref9kg = {
        platform: "Flipkart" as const,
        sourceUrl: "https://flipkart.com/p/ifb9kg",
        rawTitle: "IFB 9 kg Front Load WiFi Enabled Washing Machine",
        cleanTitle: "IFB 9 kg Front Load WiFi Enabled Washing Machine",
        brand: "IFB",
        model: "Executive",
        category: "Home Appliances",
        variant: { capacity: "9 kg", connectivity: "WiFi Enabled", appliance_type: "Front Load" },
        seller: null,
        imageUrl: null,
      };

      const cand8kg = {
        title: "IFB 8 kg Front Load WiFi Enabled Washing Machine",
        brand: "IFB",
        model: "Executive",
        variant: { capacity: "8 kg", connectivity: "WiFi Enabled", appliance_type: "Front Load" },
      };

      const match = defaultProductMatcher.evaluateMatch(ref9kg, cand8kg);
      expect(match.isMatch).toBe(false);
      expect(match.confidenceScore).toBe(0);
      expect(match.rejectionReason).toContain("Capacity mismatch");
    });

    it("strictly rejects candidates with connectivity mismatch (WiFi vs Non-WiFi)", () => {
      const refWifi = {
        platform: "Flipkart" as const,
        sourceUrl: "https://flipkart.com/p/ifb9kg",
        rawTitle: "IFB 9 kg Front Load WiFi Enabled Washing Machine",
        cleanTitle: "IFB 9 kg Front Load WiFi Enabled Washing Machine",
        brand: "IFB",
        model: "Executive",
        category: "Home Appliances",
        variant: { capacity: "9 kg", connectivity: "WiFi Enabled", appliance_type: "Front Load" },
        seller: null,
        imageUrl: null,
      };

      const candNonWifi = {
        title: "IFB 9 kg Front Load Non-WiFi Washing Machine",
        brand: "IFB",
        model: "Executive",
        variant: { capacity: "9 kg", connectivity: "Non-WiFi", appliance_type: "Front Load" },
      };

      const match = defaultProductMatcher.evaluateMatch(refWifi, candNonWifi);
      expect(match.isMatch).toBe(false);
      expect(match.confidenceScore).toBe(0);
      expect(match.rejectionReason).toContain("Connectivity mismatch");
    });

    it("strictly rejects candidates with appliance type mismatch (Front Load vs Top Load)", () => {
      const refFrontLoad = {
        platform: "Flipkart" as const,
        sourceUrl: "https://flipkart.com/p/ifb9kg",
        rawTitle: "IFB 9 kg Front Load Washing Machine",
        cleanTitle: "IFB 9 kg Front Load Washing Machine",
        brand: "IFB",
        model: "Executive",
        category: "Home Appliances",
        variant: { capacity: "9 kg", appliance_type: "Front Load" },
        seller: null,
        imageUrl: null,
      };

      const candTopLoad = {
        title: "IFB 9 kg Top Load Washing Machine",
        brand: "IFB",
        model: "Executive",
        variant: { capacity: "9 kg", appliance_type: "Top Load" },
      };

      const match = defaultProductMatcher.evaluateMatch(refFrontLoad, candTopLoad);
      expect(match.isMatch).toBe(false);
      expect(match.confidenceScore).toBe(0);
      expect(match.rejectionReason).toContain("Appliance type mismatch");
    });

    it("strictly rejects candidates with mismatched RAM or Storage (e.g. 8GB/256GB vs 6GB/128GB)", async () => {
      const amazonUrl = "https://www.amazon.in/dp/B0CX21CBRX";

      vi.spyOn(mockFirecrawl, "scrapeUrl").mockResolvedValue({
        markdown: "# OnePlus N6 (6GB RAM, 128GB Storage)\n₹18,499",
        html: `
          <span id="productTitle">OnePlus N6 (6GB RAM, 128GB Storage)</span>
          <div id="corePriceDisplay_desktop_feature_div"><span class="a-offscreen">₹18,499</span></div>
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
          durationMs: 100,
        },
      });

      // Flipkart candidate has 8GB RAM / 256GB Storage (CONFLICT with 6GB/128GB!)
      const conflictingFlipkartCandidate = {
        platform: "Flipkart" as const,
        url: "https://www.flipkart.com/oneplus-n6-256gb/p/itm999",
        title: "OnePlus N6 (Midnight Green, 256 GB) (8 GB RAM)",
        rawContent: {
          html: `
            <h1 class="VU-ZEz">OnePlus N6 (Midnight Green, 256 GB) (8 GB RAM)</h1>
            <div class="Nx9bqj CxhGGd">₹21,999</div>
            <button class="_2KpZ6l _2U9uOA _3v1-ww">ADD TO CART</button>
          `,
          markdown: "# OnePlus N6 (Midnight Green, 256 GB) (8 GB RAM)\n₹21,999\nAdd to Cart",
        },
      };

      const result = await service.analyzeProductUrl(amazonUrl, {
        candidates: [conflictingFlipkartCandidate],
      });

      expect(result.candidateEvaluations.length).toBe(1);
      const evalResult = result.candidateEvaluations[0];
      expect(evalResult.matchResult.isMatch).toBe(false);
      expect(evalResult.isEligibleForComparison).toBe(false);
      expect(evalResult.matchResult.confidenceScore).toBe(0);
      expect(evalResult.matchResult.rejectionReason).toMatch(/mismatch/i);

      // Comparison should ONLY have Amazon because Flipkart candidate was rejected!
      expect(result.comparisonSummary?.verifiedQuotes.length).toBe(1);
      expect(result.comparisonSummary?.lowestPrice.platform).toBe("Amazon");
      expect(result.comparisonSummary?.lowestPrice.amount).toBe(18499);
      expect(result.comparisonSummary?.availableStoreCount).toBe(1);
    });

    it("strictly rejects volume/size/pack mismatches (e.g. 100ml vs 200ml, Pack of 1 vs Pack of 2)", () => {
      const creamRef = {
        platform: "Amazon" as const,
        sourceUrl: "https://amazon.in/dp/xyz",
        rawTitle: "Nivea Soft Light Moisturizer Cream 100ml",
        cleanTitle: "Nivea Soft Light Moisturizer Cream 100ml",
        brand: "Nivea",
        model: "Soft Light",
        category: "Beauty & Personal Care",
        variant: { volume_or_weight: "100ml", pack_size: 1 },
        seller: null,
        imageUrl: null,
      };

      const conflicting200ml = {
        title: "Nivea Soft Light Moisturizer Cream 200ml",
        brand: "Nivea",
        model: "Soft Light",
        variant: { volume_or_weight: "200ml", pack_size: 1 },
      };

      const match200 = defaultProductMatcher.evaluateMatch(creamRef, conflicting200ml);
      expect(match200.isMatch).toBe(false);
      expect(match200.rejectionReason).toContain("Volume/weight mismatch");

      const conflictingPackOf2 = {
        title: "Nivea Soft Light Moisturizer Cream 100ml (Pack of 2)",
        brand: "Nivea",
        model: "Soft Light",
        variant: { volume_or_weight: "100ml", pack_size: 2 },
      };

      const matchPack = defaultProductMatcher.evaluateMatch(creamRef, conflictingPackOf2);
      expect(matchPack.isMatch).toBe(false);
      expect(matchPack.rejectionReason).toContain("Pack size mismatch");
    });
  });

  // =========================================================================
  // TEST D — Price validation (No MRP, EMI, Bank offers, Exchange, Carousel Ads)
  // =========================================================================
  describe("TEST D — Price Validation", () => {
    it("extracts the actual selling price and ignores MRP, EMI, bank offers, protect fees, and exchange discounts", () => {
      const noisyContent = {
        html: `
          <html>
            <body>
              <h1 class="VU-ZEz">OnePlus Nord (Gray Onyx, 128 GB)</h1>
              <div style="text-decoration-line: line-through;">29,999</div>
              <div class="Nx9bqj CxhGGd">₹27,999</div>
              <div class="_1psv1ze29">+₹129 Protect Promise Fee</div>
              <div class="offer">Buy at ₹26,599 with Bank offer</div>
              <div class="emi">₹9,583 x 3m No Cost EMI</div>
              <div class="exchange">Get up to ₹16,000 off on exchange</div>
            </body>
          </html>
        `,
        markdown: `
# OnePlus Nord (Gray Onyx, 128 GB)
₹27,999
[+₹129 Protect Promise Fee](https://flipkart.com/fee)
Buy at ₹26,599 with Bank offer
₹9,583 x 3m
Pay ₹28,748
₹1,400 off
Up to ₹16,000 off on Exchange
        `,
        statusCode: 200,
      };

      const price = flipkartAdapter.extractPrice(noisyContent);
      expect(price).not.toBeNull();
      // MUST be ₹27,999 — NOT ₹129 (fee), NOT ₹26,599 (bank offer), NOT ₹9,583 (EMI), NOT ₹16,000 (exchange)!
      expect(price?.current).toBe(27999);
      expect(price?.mrp).toBe(29999);
      expect(price?.discount_percent).toBe(7);
    });

    it("verifies the real IFB washing machine case: extracts ₹37,990 and rejects carousel ad price ₹23,890", () => {
      // Simulates the exact Flipkart layout that produced ₹23,890 bug
      const ifbPageContent = {
        html: `
          <html>
            <body>
              <!-- Sponsored Carousel AD BEFORE Product -->
              <div class="ad-carousel">
                <span class="product-title">IFB 5.5 Kg Fully Automatic Front Load</span>
                <div style="text-decoration-line: line-through;">26,990</div>
                <div font="default-fk-font-l">₹23,890</div>
                <span class="ad-badge">AD</span>
              </div>

              <!-- Main Product Section -->
              <h1 class="VU-ZEz">IFB 9 kg with 9 Swirl Wash, 2x Power Steam, 30 Min Steam Refresh ... more</h1>
              <div style="text-decoration-line: line-through;">49,490</div>
              <div font="default-fk-font-l">₹37,990</div>
              <button>BUY NOW</button>
            </body>
          </html>
        `,
        markdown: `
IFB 5.5 Kg Fully Automatic Front Load
26,990
₹23,890 AD

# IFB 9 kg with 9 Swirl Wash, 2x Power Steam, 30 Min Steam Refresh ... more
More about IFB 9 kg with 9 Swirl Wash, 2x Power Steam, 30 Min Steam Refresh Program, Eco Inverter Motor, WiFi Enabled, DeepClean Powered by Ai Fully Automatic Front Load Washing Machine with In-built Heater Black+

49,490
₹37,990
[+₹236 Protect Promise Fee](https://flipkart.com/fee)
Buy Now
        `,
        statusCode: 200,
      };

      const ifbUrl =
        "https://www.flipkart.com/ifb-9-kg-swirl-wash-2x-power-steam-30-min-steam-refresh/p/itma835527a5d0c6?pid=WMNHEGV6JCGH7V7B";
      const price = flipkartAdapter.extractPrice(ifbPageContent);
      const identity = flipkartAdapter.extractCanonicalIdentity(ifbPageContent, ifbUrl);

      // ₹23,890 MUST NOT be accepted. Actual price is ₹37,990!
      expect(price?.current).toBe(37990);
      expect(price?.current).not.toBe(23890);
      expect(price?.mrp).toBe(49490);
      expect(price?.discount_percent).toBe(23);

      // Identity should be fully parsed from un-truncated title
      expect(identity.productIdentifier).toBe("WMNHEGV6JCGH7V7B");
      expect(identity.identifierType).toBe("FLIPKART_PID");
      expect(identity.brand).toBe("IFB");
      expect(identity.variant.capacity).toBe("9 kg");
      expect(identity.variant.connectivity).toBe("WiFi Enabled");
      expect(identity.variant.appliance_type).toBe("Front Load");
    });
  });

  // =========================================================================
  // TEST E — Cross-store comparison (Lowest, Median, Highest, Differing Prices)
  // =========================================================================
  describe("TEST E — Cross-Store Comparison Calculations", () => {
    it("TEST 4: Correct same product with different price — calculates correct lowest, median, and highest", () => {
      // Amazon ₹39,990, Flipkart ₹37,990
      const quotes: import("./platform.types").NormalizedProductQuote[] = [
        {
          platform: "Amazon",
          productUrl: "https://amazon.in/dp/B0F8QV7RCR",
          title: "IFB 9 kg Front Load WiFi Enabled Washing Machine",
          brand: "IFB",
          model: "Executive",
          variant: { capacity: "9 kg", connectivity: "WiFi Enabled", appliance_type: "Front Load" },
          price: { current: 39990, mrp: 49490, currency: "INR" },
          availability: { status: "IN_STOCK", evidence: "Add to Cart", confidence: 0.98 },
          seller: "Appario",
          imageUrl: null,
          scrapedAt: new Date().toISOString(),
          rawConfidence: 0.98,
        },
        {
          platform: "Flipkart",
          productUrl: "https://flipkart.com/p/ifb9kg",
          title: "IFB 9 kg Front Load WiFi Enabled Washing Machine",
          brand: "IFB",
          model: "Executive",
          variant: { capacity: "9 kg", connectivity: "WiFi Enabled", appliance_type: "Front Load" },
          price: { current: 37990, mrp: 49490, currency: "INR" },
          availability: { status: "IN_STOCK", evidence: "Buy Now", confidence: 0.98 },
          seller: "OmniTech",
          imageUrl: null,
          scrapedAt: new Date().toISOString(),
          rawConfidence: 0.98,
        },
      ];

      const summary = defaultPriceComparisonEngine.compare(quotes);
      expect(summary).not.toBeNull();
      // lowest = ₹37,990 (Flipkart)
      expect(summary?.lowestPrice.amount).toBe(37990);
      expect(summary?.lowestPrice.platform).toBe("Flipkart");
      // highest = ₹39,990 (Amazon)
      expect(summary?.highestPrice.amount).toBe(39990);
      expect(summary?.highestPrice.platform).toBe("Amazon");
      // median = (37990 + 39990) / 2 = ₹38,990
      expect(summary?.medianPrice.amount).toBe(38990);
      expect(summary?.maxSavings).toBe(2000);
      expect(summary?.availableStoreCount).toBe(2);
      expect(summary?.totalCheckedCount).toBe(2);
    });

    it("excludes out of stock and unknown offers from lowest/median/highest calculations", () => {
      const quotes: import("./platform.types").NormalizedProductQuote[] = [
        {
          platform: "Flipkart",
          productUrl: "https://flipkart.com/p/ifb9kg",
          title: "IFB 9 kg Washing Machine",
          brand: "IFB",
          model: "Executive",
          variant: { capacity: "9 kg" },
          price: { current: 37990, mrp: 49490, currency: "INR" },
          availability: { status: "IN_STOCK", evidence: "Buy Now", confidence: 0.98 },
          seller: null,
          imageUrl: null,
          scrapedAt: new Date().toISOString(),
          rawConfidence: 0.98,
        },
        {
          platform: "Amazon",
          productUrl: "https://amazon.in/dp/xyz",
          title: "IFB 9 kg Washing Machine",
          brand: "IFB",
          model: "Executive",
          variant: { capacity: "9 kg" },
          price: { current: 34990, mrp: 49490, currency: "INR" },
          availability: { status: "OUT_OF_STOCK", evidence: "Currently unavailable", confidence: 0.98 },
          seller: null,
          imageUrl: null,
          scrapedAt: new Date().toISOString(),
          rawConfidence: 0.98,
        },
      ];

      const summary = defaultPriceComparisonEngine.compare(quotes);
      expect(summary).not.toBeNull();
      // Only the 1 IN_STOCK offer participates!
      expect(summary?.availableStoreCount).toBe(1);
      expect(summary?.totalCheckedCount).toBe(2);
      expect(summary?.lowestPrice.amount).toBe(37990);
      expect(summary?.highestPrice.amount).toBe(37990);
      expect(summary?.medianPrice.amount).toBe(37990);
      expect(summary?.unverifiedOrUnavailable.length).toBe(1);
      expect(summary?.unverifiedOrUnavailable[0].platform).toBe("Amazon");
    });
  });

  // =========================================================================
  // TEST F — Cache safety (TEST 5)
  // =========================================================================
  describe("TEST F — Caching Verification (TEST 5)", () => {
    it("TEST 5: Second identical check reuses cache without duplicate scraping or credit consumption", async () => {
      const flipkartUrl = "https://www.flipkart.com/oneplus-nord/p/itm123?pid=MOBXYZ123";

      // Populate cache
      firecrawlCache.set(flipkartUrl, {
        url: flipkartUrl,
        markdown: "# OnePlus Nord\n₹27,999\nADD TO CART",
        html: "<div class='Nx9bqj CxhGGd'>₹27,999</div><button>ADD TO CART</button>",
        statusCode: 200,
        source: "firecrawl",
      });

      // Call scrapeUrl on client with forceRefresh = false
      const client = new FirecrawlClient("test-key");
      const res1 = await client.scrapeUrl(flipkartUrl, { forceRefresh: false });
      expect(res1.cached).toBe(true);
      expect(res1.auditLog.estimatedCredits).toBe(0);

      const res2 = await client.scrapeUrl(flipkartUrl, { forceRefresh: false });
      expect(res2.cached).toBe(true);
      expect(res2.auditLog.estimatedCredits).toBe(0);

      // Also verify search cache
      firecrawlCache.setSearch("site:flipkart.com OnePlus Nord 128GB", [
        { url: flipkartUrl, title: "OnePlus Nord" },
      ]);

      const searchRes = await client.search("site:flipkart.com OnePlus Nord 128GB", { forceRefresh: false });
      expect(searchRes.cached).toBe(true);
      expect(searchRes.auditLog.estimatedCredits).toBe(0);
      expect(searchRes.results.length).toBe(1);
    });
  });
});
