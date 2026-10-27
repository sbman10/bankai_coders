import { describe, it, expect, beforeEach, vi } from "vitest";
import { CrossStorePriceIntelligenceService } from "./cross-store-service";
import { FirecrawlClient } from "../firecrawl/firecrawl-client";
import { AmazonAdapter } from "../platforms/amazon-adapter";
import { prototypeStore } from "../store/prototype-store";

describe("CrossStorePriceIntelligenceService — Phase 1 End-to-End Pipeline", () => {
  let mockFirecrawl: FirecrawlClient;
  let service: CrossStorePriceIntelligenceService;

  beforeEach(() => {
    mockFirecrawl = new FirecrawlClient("test-key");
    service = new CrossStorePriceIntelligenceService(mockFirecrawl, new AmazonAdapter());
  });

  it("executes the complete Phase 1 pipeline: Amazon extraction -> canonical identity -> category detection -> relevant store discovery -> variant matching -> comparison -> observation recording", async () => {
    const amazonUrl = "https://www.amazon.in/dp/B0CX21CBRX";

    // Realistic Amazon HTML mock snippet
    const amazonHtml = `
      <html>
        <head>
          <title>Amazon.in : Realme P4 5G (Submarine Blue, 8GB RAM, 128GB Storage) : Amazon.in</title>
        </head>
        <body>
          <div id="wayfinding-breadcrumbs_feature_div">
            <a class="a-link-normal">Electronics</a>
            <a class="a-link-normal">Mobiles & Accessories</a>
            <a class="a-link-normal">Smartphones</a>
          </div>
          <span id="productTitle">Realme P4 5G (Submarine Blue, 8GB RAM, 128GB Storage)</span>
          <a id="bylineInfo">Brand: Realme</a>
          <div id="corePriceDisplay_desktop_feature_div">
            <span class="a-price a-text-price a-size-medium apexPriceToPay">
              <span class="a-offscreen">₹15,999.00</span>
            </span>
            <span class="a-price a-text-price a-size-base" data-a-strike="true">
              <span class="a-offscreen">₹19,999.00</span>
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

    vi.spyOn(mockFirecrawl, "scrapeUrl").mockResolvedValue({
      markdown: "# Realme P4 5G 8GB 128GB\nPrice: ₹15,999",
      html: amazonHtml,
      statusCode: 200,
      cached: false,
      auditLog: {
        timestamp: new Date().toISOString(),
        url: amazonUrl,
        statusCode: 200,
        success: true,
        source: "firecrawl_api",
        estimatedCredits: 1,
        durationMs: 120,
      },
    });

    // We supply two candidates from other platforms to verify matching vs rejection:
    // Candidate 1: Flipkart matching 8GB/128GB variant at ₹15,499 (IN_STOCK)
    // Candidate 2: Croma conflicting 12GB/256GB variant at ₹18,490 (IN_STOCK)
    const candidates = [
      {
        platform: "Flipkart" as const,
        url: "https://www.flipkart.com/p/realme-p4-5g-8gb-128gb",
        title: "Realme P4 5G (Submarine Blue, 128 GB) (8 GB RAM)",
        rawContent: {
          html: `
            <span class="B_NuCI">Realme P4 5G (Submarine Blue, 128 GB) (8 GB RAM)</span>
            <div class="_30jeq3">₹15,499</div>
            <button class="_2KpZ6l _2U9uOA _3v1-ww">BUY NOW</button>
          `,
          markdown: "Price: ₹15,499\nBuy Now",
        },
      },
      {
        platform: "Croma" as const,
        url: "https://www.croma.com/p/realme-p4-5g-12gb-256gb",
        title: "Realme P4 5G (Submarine Blue, 256 GB) (12 GB RAM)",
        rawContent: {
          html: `
            <h1>Realme P4 5G (Submarine Blue, 256 GB) (12 GB RAM)</h1>
            <div class="amount">₹18,490</div>
            <button class="add-to-cart">Add to Cart</button>
          `,
          markdown: "Price: ₹18,490\nAdd to Cart",
        },
      },
    ];

    const result = await service.analyzeProductUrl(amazonUrl, {
      candidates,
      recordObservation: true,
    });

    // 1. Verify Canonical Identity
    expect(result.canonicalIdentity.brand).toBe("Realme");
    expect(result.canonicalIdentity.model).toBe("P4 5G");
    expect(result.canonicalIdentity.variant.ram).toBe("8GB");
    expect(result.canonicalIdentity.variant.storage).toBe("128GB");

    // 2. Verify Category Detection & Store Routing
    expect(result.detectedCategory).toBe("Mobiles & Tablets");
    expect(result.relevantPlatformsToSearch).toContain("Flipkart");
    expect(result.relevantPlatformsToSearch).toContain("Croma");
    expect(result.relevantPlatformsToSearch).toContain("Meesho");
    // Irrelevant platforms like Nykaa or Myntra must NOT be in Mobiles & Tablets
    expect(result.relevantPlatformsToSearch).not.toContain("Nykaa");
    expect(result.relevantPlatformsToSearch).not.toContain("Myntra");

    // 3. Verify Targeted Search Query
    expect(result.suggestedCrossStoreSearchQuery).toContain("Realme P4 5G");
    expect(result.suggestedCrossStoreSearchQuery).toContain("8GB");
    expect(result.suggestedCrossStoreSearchQuery).toContain("128GB");

    // 4. Verify Candidate Matching & Rejection
    expect(result.candidateEvaluations.length).toBe(2);

    // Candidate 1 (Flipkart): Matched
    const flipkartEval = result.candidateEvaluations[0];
    expect(flipkartEval.matchResult.isMatch).toBe(true);
    expect(flipkartEval.isEligibleForComparison).toBe(true);

    // Candidate 2 (Croma 256GB): REJECTED due to variant mismatch!
    const cromaEval = result.candidateEvaluations[1];
    expect(cromaEval.matchResult.isMatch).toBe(false);
    expect(cromaEval.isEligibleForComparison).toBe(false);
    expect(cromaEval.matchResult.rejectionReason).toContain("Storage mismatch");

    // 5. Verify Price Comparison
    // Eligible: Amazon (₹15,999) + Flipkart (₹15,499)
    // Croma (₹18,490) is NOT included because variant mismatched!
    expect(result.comparisonSummary).not.toBeNull();
    expect(result.comparisonSummary?.lowestPrice.amount).toBe(15499);
    expect(result.comparisonSummary?.lowestPrice.platform).toBe("Flipkart");
    expect(result.comparisonSummary?.highestPrice.amount).toBe(15999);
    expect(result.comparisonSummary?.highestPrice.platform).toBe("Amazon");
    // Median of 15,499 and 15,999 = (15499 + 15999) / 2 = 15749
    expect(result.comparisonSummary?.medianPrice.amount).toBe(15749);
    expect(result.comparisonSummary?.medianPrice.label).toBe("Median Price");

    // 6. Verify Price Observation was recorded
    const observations = prototypeStore.getPriceObservations();
    const amazonObs = observations.find((o) => o.product_url === amazonUrl);
    expect(amazonObs).toBeDefined();
    expect(amazonObs?.price).toBe(15999);
    expect(amazonObs?.availability).toBe("IN_STOCK");
    expect(amazonObs?.platform).toBe("Amazon");
  });
});
