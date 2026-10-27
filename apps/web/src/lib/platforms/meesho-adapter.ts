import type { PlatformAdapter } from "./platform-adapter.interface";
import type {
  AvailabilityInfo,
  CanonicalProductIdentity,
  NormalizedProductQuote,
  PriceInfo,
  ScrapedContent,
  SupportedStorePlatform,
} from "./platform.types";
import {
  cleanProductTitle,
  detectBrandFromTitle,
  extractModelFromTitle,
  extractVariantAttributes,
} from "../price-intelligence/canonical-identity";
import { defaultCategoryRouter } from "../price-intelligence/category-router";
import { validateCurrentSellingPrice } from "../price-intelligence/price-validator";

/**
 * Extracts Meesho's unique product identifier from URL.
 * e.g. /p/2x9abc -> "2x9abc"
 */
export function extractMeeshoProductId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    let trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/i);
    if (match) {
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts a product title slug from Meesho URL as a fallback.
 * e.g. /kc-creation-night-suit-for-women/p/7fyayt -> "Kc Creation Night Suit For Women"
 */
export function extractMeeshoTitleFromUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    let trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/^\/([a-zA-Z0-9-]+)\/p\//i);
    if (match && match[1]) {
      return match[1]
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalizes a Meesho URL into a canonical format.
 */
export function canonicalizeMeeshoUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  try {
    let trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    const pid = extractMeeshoProductId(trimmed);
    if (pid) {
      return `https://www.meesho.com/p/${pid}`;
    }
    const parsed = new URL(trimmed);
    return new URL(parsed.pathname, "https://www.meesho.com").toString();
  } catch {
    return url;
  }
}

export class MeeshoAdapter implements PlatformAdapter {
  readonly platform: SupportedStorePlatform = "Meesho";

  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    try {
      let trimmed = url.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        trimmed = `https://${trimmed}`;
      }
      const host = new URL(trimmed).hostname.toLowerCase();
      return /(?:^|\.)meesho\.com$/i.test(host);
    } catch {
      return false;
    }
  }

  /**
   * Strictly extracts the ACTUAL selling price, distinguishing from MRP, combo discounts, and coupons.
   */
  extractPrice(content: ScrapedContent): PriceInfo | null {
    const html = content.html || "";
    const md = content.markdown || "";

    let currentPrice: number | null = null;
    let mrp: number | null = null;

    const parseAmount = (str: string | null | undefined): number | null => {
      if (!str) return null;
      const clean = str.replace(/[₹$,]/g, "").match(/(\d+(?:\.\d{1,2})?)/);
      if (!clean) return null;
      const val = parseFloat(clean[1]);
      return !Number.isNaN(val) && val > 0 ? Math.round(val * 100) / 100 : null;
    };

    // 1. Extract from HTML
    if (html) {
      // Strip React comments (e.g. ₹<!-- -->222)
      const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, "");
      const h1Idx = cleanHtml.search(/<h1[\s>]/i);
      const productHtml = h1Idx !== -1 ? cleanHtml.substring(h1Idx) : cleanHtml;

      // Meesho typical price elements: <h4 ...>₹...</h4>, data-testid="pdp-price", class contains "price"
      const priceMatch =
        productHtml.match(/<h4[^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\/h4>/i) ||
        productHtml.match(/data-testid=["'](?:product-price|pdp-price)["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i) ||
        productHtml.match(/class=["'][^"']*\bprice\b[^"']*["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i) ||
        productHtml.match(/₹\s*([\d,]+(?:\.\d{2})?)/);

      if (priceMatch) {
        currentPrice = parseAmount(priceMatch[1]);
      }

      // MRP extraction
      const mrpMatch =
        productHtml.match(/text-decoration(?:-line)?:\s*line-through[^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i) ||
        productHtml.match(/class=["'][^"']*\bline-through\b[^"']*["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i) ||
        productHtml.match(/class=["'][^"']*\bmrp\b[^"']*["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i);

      if (mrpMatch) {
        const val = parseAmount(mrpMatch[1]);
        if (val && (!currentPrice || val > currentPrice)) {
          mrp = val;
        }
      }
    }

    // 2. Fallback to Markdown
    if (!currentPrice && md) {
      const lines = md.split("\n");
      let foundHeading = false;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!foundHeading) {
          if (/^#\s+/.test(line)) foundHeading = true;
          continue;
        }

        // Ignore lines with EMI, bulk offer, coupon, shipping
        if (/\b(emi|per\s*month|\/month|coupon|bank\s*offer|cashback|delivery\s*fee|free\s*delivery)\b/i.test(line)) {
          continue;
        }

        const pricePattern = /(?:Price|₹)\s*₹?\s*([\d,]{2,}(?:\.\d{2})?)/i;
        const match = line.match(pricePattern);
        if (match) {
          const val = parseAmount(match[1]);
          if (val && val > 0) {
            currentPrice = val;
            break;
          }
        }
      }

      if (!mrp && md) {
        const lines2 = md.split("\n");
        let foundHeading2 = false;
        for (const rawLine of lines2) {
          const line = rawLine.trim();
          if (!foundHeading2) {
            if (/^#\s+/.test(line)) foundHeading2 = true;
            continue;
          }
          const mrpMatch = line.match(/~~₹?\s*([\d,]+(?:\.\d{2})?)~~/);
          if (mrpMatch) {
            const val = parseAmount(mrpMatch[1]);
            if (val && (!currentPrice || val > currentPrice)) {
              mrp = val;
              break;
            }
          }
        }
      }
    }

    const validation = validateCurrentSellingPrice({
      sellingPrice: currentPrice,
      mrp,
      currency: "INR",
      platform: "Meesho",
    });

    if (!validation.isValid || !validation.price) {
      return null;
    }

    return validation.price;
  }

  /**
   * Strictly extracts availability state based on positive purchase proof or out-of-stock indicators.
   */
  extractAvailability(content: ScrapedContent): AvailabilityInfo {
    const html = content.html || "";
    const md = content.markdown || "";

    // Explicit Out of Stock
    const isExplicitlyOutOfStock =
      /\bOut of Stock\b/i.test(html) ||
      /\bOut of Stock\b/i.test(md) ||
      /\bSold Out\b/i.test(html) ||
      /\bSold Out\b/i.test(md) ||
      /\bCurrently Unavailable\b/i.test(html) ||
      /\bItem is currently out of stock\b/i.test(html);

    if (isExplicitlyOutOfStock) {
      return {
        status: "OUT_OF_STOCK",
        evidence: "Meesho explicitly marked item Out of Stock",
        confidence: 0.98,
      };
    }

    // Positive purchase evidence
    const hasAddToCartButton =
      /\bAdd to Cart\b/i.test(html) ||
      /\bAdd to Cart\b/i.test(md) ||
      /class=["'][^"']*\badd-to-cart\b[^"']*["']/i.test(html);

    const hasBuyNowButton =
      /\bBuy Now\b/i.test(html) ||
      /\bBuy Now\b/i.test(md) ||
      /class=["'][^"']*\bbuy-now\b[^"']*["']/i.test(html);

    if (hasAddToCartButton || hasBuyNowButton) {
      const evidence = hasAddToCartButton
        ? "Meesho Add to Cart button present"
        : "Meesho Buy Now button present";

      return {
        status: "IN_STOCK",
        evidence,
        confidence: 0.98,
      };
    }

    // 404 / Not Found
    if (content.statusCode === 404 || /page not found|item not found/i.test(md)) {
      return {
        status: "NOT_FOUND",
        evidence: "Meesho page returned 404 Not Found",
        confidence: 0.99,
      };
    }

    // Default to UNKNOWN (never assume in stock)
    return {
      status: "UNKNOWN",
      evidence: "Meesho page loaded but positive purchase indicators were not verifiable",
      confidence: 0.4,
    };
  }

  /**
   * Extracts canonical product identity from Meesho page content.
   */
  extractCanonicalIdentity(content: ScrapedContent, url: string): CanonicalProductIdentity {
    const html = content.html || "";
    const md = content.markdown || "";
    const canonicalUrl = canonicalizeMeeshoUrl(url);

    // 1. Raw Title
    let rawTitle = "";
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      rawTitle = h1Match[1].replace(/<[^>]+>/g, "").trim();
    } else {
      const mdH1 = md.match(/^#\s+(.+)$/m);
      if (mdH1) {
        rawTitle = mdH1[1].trim();
      } else {
        const headTitle = html.match(/<title>([\s\S]*?)<\/title>/i);
        if (headTitle) {
          rawTitle = headTitle[1].replace(/\s*\|\s*Meesho.*$/i, "").trim();
        }
      }
    }

    if (!rawTitle || /^(?:meesho|online shopping)$/i.test(rawTitle)) {
      const slugTitle = extractMeeshoTitleFromUrl(url);
      if (slugTitle) {
        rawTitle = slugTitle;
      }
    }

    const cleanTitle = cleanProductTitle(rawTitle);

    // 2. Brand (Meesho contains many generic unbranded items)
    let explicitBrand: string | null = null;
    const brandMatch =
      md.match(/(?:^|\n)[*\s-]*(?:Brand\s*Name|Brand)\s*[:|]\s*([^\n\r|]+)/i) ||
      html.match(/(?:Brand\s*Name|Brand)\s*[:<][^>]*>\s*([^<\n\r|]+)/i);
    if (brandMatch) {
      const candidate = brandMatch[1].trim();
      if (
        !candidate.includes("http") &&
        !candidate.includes("[") &&
        !candidate.includes("]") &&
        !candidate.includes("(") &&
        !candidate.includes(")") &&
        candidate.length <= 40
      ) {
        explicitBrand = candidate;
      }
    }
    const brand = detectBrandFromTitle(cleanTitle, explicitBrand);

    // 3. Model
    let explicitModel: string | null = null;
    const modelMatch = md.match(/Model\s*:?\s*([^\n\r|]+)/i);
    if (modelMatch) {
      explicitModel = modelMatch[1].trim();
    }
    const model = explicitModel || (brand ? extractModelFromTitle(cleanTitle, brand) : null);

    // Slice markdown to only product section (avoid header/footer navigation trees polluting variants)
    const headingIdx = md.search(/^#\s+/m);
    const productMd = headingIdx !== -1 ? md.substring(headingIdx) : md;

    // 4. Variant attributes
    const variant = extractVariantAttributes(cleanTitle, productMd);

    // 5. Category
    const detectedCategory = defaultCategoryRouter.detectCategory(cleanTitle);

    // 6. Image (prefer product image over marketing banner)
    let imageUrl: string | null = null;
    const imgMatch =
      md.match(/!\[.*?\]\((https:\/\/images\.meesho\.com\/images\/products\/[^\s)]+)\)/i) ||
      html.match(/src=["'](https:\/\/images\.meesho\.com\/images\/products\/[^"']+)["']/i) ||
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      md.match(/!\[.*?\]\((https:\/\/images\.meesho\.com[^\s)]+)\)/i);
    if (imgMatch) {
      imageUrl = imgMatch[1];
    }

    const pid = extractMeeshoProductId(url);

    return {
      platform: "Meesho",
      sourceUrl: canonicalUrl,
      rawTitle,
      cleanTitle,
      brand,
      model,
      modelNumber: explicitModel,
      productIdentifier: pid || undefined,
      identifierType: pid ? "MEESHO_PRODUCT_ID" : undefined,
      sku: pid || undefined,
      category: detectedCategory,
      variant,
      seller: "Meesho Supplier",
      imageUrl,
    };
  }

  normalize(content: ScrapedContent, url: string): NormalizedProductQuote {
    const canonicalUrl = canonicalizeMeeshoUrl(url);
    const identity = this.extractCanonicalIdentity(content, canonicalUrl);
    const price = this.extractPrice(content);
    const availability = this.extractAvailability(content);

    let rawConfidence = availability.confidence;
    if (!price) {
      rawConfidence *= 0.5;
    }
    // Strictness penalty: if brand is unknown/generic on Meesho, penalize confidence
    if (!identity.brand) {
      rawConfidence *= 0.5;
    }

    return {
      platform: "Meesho",
      productUrl: canonicalUrl,
      productIdentifier: identity.productIdentifier,
      identifierType: identity.identifierType,
      title: identity.cleanTitle,
      brand: identity.brand,
      model: identity.model,
      variant: identity.variant,
      price,
      availability,
      seller: identity.seller,
      imageUrl: identity.imageUrl,
      scrapedAt: new Date().toISOString(),
      rawConfidence: Math.round(rawConfidence * 100) / 100,
    };
  }

  buildSearchQuery(identity: CanonicalProductIdentity): string {
    const parts: string[] = [];
    if (identity.brand) parts.push(identity.brand);
    if (identity.model) parts.push(identity.model);
    if (identity.variant.capacity) parts.push(identity.variant.capacity);
    if (identity.variant.ram) parts.push(identity.variant.ram);
    if (identity.variant.storage) parts.push(identity.variant.storage);
    if (identity.variant.size) parts.push(identity.variant.size);
    if (identity.variant.color) parts.push(identity.variant.color);

    return parts.join(" ");
  }
}

export const meeshoAdapter = new MeeshoAdapter();
