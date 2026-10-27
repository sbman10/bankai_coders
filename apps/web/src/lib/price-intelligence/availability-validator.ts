import type { AvailabilityInfo, AvailabilityStatus, ScrapedContent } from "../platforms/platform.types";

export class AvailabilityValidator {
  /**
   * Strictly evaluates the purchase readiness of a store product page.
   * NEVER assumes HTTP 200 = available.
   * UNKNOWN is never treated as available.
   */
  validate(content: ScrapedContent): AvailabilityInfo {
    const html = content.html || "";
    const md = content.markdown || "";
    const statusCode = content.statusCode || 200;

    // 1. Not Found
    if (statusCode === 404 || /page not found|item not found|we couldn't find that page/i.test(md)) {
      return {
        status: "NOT_FOUND",
        evidence: "Page returned 404 or product not found message",
        confidence: 0.99,
      };
    }

    // 2. Explicit Out of Stock
    const outOfStockPatterns = [
      /\bcurrently unavailable\b/i,
      /\bout of stock\b/i,
      /\bsold out\b/i,
      /\btemporarily out of stock\b/i,
      /\bitem is out of stock\b/i,
      /\bwe don't know when or if this item will be back in stock\b/i,
    ];

    for (const pat of outOfStockPatterns) {
      if (pat.test(html) || pat.test(md)) {
        return {
          status: "OUT_OF_STOCK",
          evidence: `Explicit stock unavailability indicator found: '${pat.source}'`,
          confidence: 0.95,
        };
      }
    }

    // 3. Positive purchase evidence for IN_STOCK
    const positivePurchasePatterns = [
      /id=["']add-to-cart-button["']/i,
      /id=["']buy-now-button["']/i,
      /name=["']submit\.add-to-cart["']/i,
      /name=["']submit\.buy-now["']/i,
      /\bAdd to Cart\b/i,
      /\bBuy Now\b/i,
      /\bIn Stock\b/i,
      /\bIn stock\./i,
      /\bOnly \d+ left in stock\b/i,
      /\bUsually dispatched in \d+/i,
    ];

    for (const pat of positivePurchasePatterns) {
      if (pat.test(html) || pat.test(md)) {
        return {
          status: "IN_STOCK",
          evidence: `Verified positive purchase indicator: '${pat.source}'`,
          confidence: 0.95,
        };
      }
    }

    // 4. Default to UNKNOWN (Never assume available without positive purchase proof)
    return {
      status: "UNKNOWN",
      evidence: "Page loaded but positive purchase button or explicit stock status was not verifiable",
      confidence: 0.3,
    };
  }

  isPurchasable(status: AvailabilityStatus): boolean {
    return status === "IN_STOCK";
  }
}

export const defaultAvailabilityValidator = new AvailabilityValidator();
