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
 * Extracts Croma's unique product ID / SKU (e.g. 305597 from .../p/305597).
 */
export function extractCromaProductId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    let trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    const pid = parsed.searchParams.get("pid");
    if (pid && pid.trim().length > 0) {
      return pid.trim();
    }
    // Match /p/(\d+) or /p/([a-zA-Z0-9_-]+)
    const match = parsed.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/i) || parsed.pathname.match(/\/(\d{5,8})(?:[/?#]|$)/);
    if (match) {
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts product title from Croma URL slug if HTML only contains shell navigation.
 */
export function extractCromaTitleFromUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    let trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/^\/([^\/]+)\/p\b/i) || parsed.pathname.match(/^\/([^\/]+)\/(\d+)/i);
    if (match && match[1]) {
      const slug = match[1]
        .replace(/-+/g, " ")
        .replace(/\b(\d+)\s+(\d+)\s+cm\b/gi, "$1.$2 cm")
        .replace(/\b(\d+)\s+(\d+)\s+inch\b/gi, "$1.$2 inch")
        .trim();
      if (slug.length > 5 && !slug.toLowerCase().includes("hamburger")) {
        return slug
          .split(" ")
          .map((w) => {
            const upper = w.toUpperCase();
            if (["GB", "RAM", "SSD", "ROM", "TB", "MB", "M3", "M2", "M1", "5G", "4G", "OS", "LED", "OLED", "QLED", "HD", "FHD", "UHD", "4K", "AI"].includes(upper)) {
              return upper;
            }
            return w.charAt(0).toUpperCase() + w.slice(1);
          })
          .join(" ");
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalizes a Croma URL into a canonical format.
 */
export function canonicalizeCromaUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  try {
    let trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    const pid = extractCromaProductId(trimmed);
    const cleanUrl = new URL(parsed.pathname, "https://www.croma.com");
    if (pid && !cleanUrl.pathname.includes(`/p/${pid}`)) {
      cleanUrl.searchParams.set("pid", pid);
    }
    return cleanUrl.toString();
  } catch {
    return url;
  }
}

export class CromaAdapter implements PlatformAdapter {
  readonly platform: SupportedStorePlatform = "Croma";

  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    try {
      let trimmed = url.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        trimmed = `https://${trimmed}`;
      }
      const host = new URL(trimmed).hostname.toLowerCase();
      return /(?:^|\.)croma\.com$/i.test(host);
    } catch {
      return false;
    }
  }

  /**
   * Strictly extracts the ACTUAL selling price, distinguishing from MRP, EMI, and bank offers.
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
      // Find product section starting from H1 or pd-title to avoid recommendation carousels
      const h1Idx = html.search(/<h1[\s>]/i);
      const productHtml = h1Idx !== -1 ? html.substring(h1Idx) : html;

      // Modern Croma price classes: amount pl-2, amount, cp-price, new-price
      const currentPriceMatch =
        productHtml.match(/class=["'][^"']*\bamount\b[^"']*["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\/span>/i) ||
        productHtml.match(/class=["'][^"']*\bcp-price\b[^"']*["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\/span>/i) ||
        productHtml.match(/data-testid=["']new-price["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i) ||
        productHtml.match(/class=["'][^"']*\bpdp-price\b[^"']*["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i) ||
        productHtml.match(/id=["']pdp-product-price["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i);

      if (currentPriceMatch) {
        currentPrice = parseAmount(currentPriceMatch[1]);
      }

      // MRP extraction (old-price, del-price, mrp, strike)
      const mrpMatch =
        productHtml.match(/class=["'][^"']*(?:old-price|del-price|oldprice|mrp)[^"']*["'][^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\/span>/i) ||
        productHtml.match(/text-decoration(?:-line)?:\s*line-through[^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\//i) ||
        productHtml.match(/MRP:?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i);

      if (mrpMatch) {
        const val = parseAmount(mrpMatch[1]);
        if (val && (!currentPrice || val > currentPrice)) {
          mrp = val;
        }
      }
    }

    // 2. Fallback to Markdown with strict EMI / Bank Offer / Exchange filtering
    if (!currentPrice && md) {
      const lines = md.split("\n");
      let foundTitle = false;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!foundTitle) {
          if (/^#\s+/.test(line)) foundTitle = true;
          continue;
        }

        // Ignore lines with EMI, bank offers, exchange rates, combos, delivery charges
        if (
          /\b(emi|per\s*month|\/month|\/mo\b|pm\b|x\s*\d+\s*months?|bank\s*offer|cashback|delivery\s*fee|shipping|coupon|with\s*exchange|save\s*up\s*to)\b/i.test(
            line
          )
        ) {
          continue;
        }

        // Match standalone price: "₹37,990" or "₹ 37,990"
        const pricePattern = /(?:Price|₹)\s*₹?\s*([\d,]{3,}(?:\.\d{2})?)/i;
        const match = line.match(pricePattern);
        if (match) {
          const val = parseAmount(match[1]);
          if (val && val > 0) {
            currentPrice = val;
            break;
          }
        }
      }

      // MRP from strikethrough or MRP line
      if (!mrp && md) {
        const lines2 = md.split("\n");
        let foundTitle2 = false;
        for (const rawLine of lines2) {
          const line = rawLine.trim();
          if (!foundTitle2) {
            if (/^#\s+/.test(line)) foundTitle2 = true;
            continue;
          }
          const mrpMatch =
            line.match(/~~₹?\s*([\d,]+(?:\.\d{2})?)~~/) ||
            line.match(/(?:MRP|M\.R\.P\.):?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i);
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
      platform: "Croma",
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

    // Out of Stock check
    const isExplicitlyOutOfStock =
      /\bCurrently Out of Stock\b/i.test(html) ||
      /\bCurrently Out of Stock\b/i.test(md) ||
      /\bOut of Stock\b/i.test(html) ||
      /\bOut of Stock\b/i.test(md) ||
      /\bSold Out\b/i.test(html) ||
      /\bSold Out\b/i.test(md) ||
      /\bNotify Me\b/i.test(html) ||
      /\bNotify Me\b/i.test(md) ||
      /\bItem is unavailable\b/i.test(html) ||
      /\bItem is unavailable\b/i.test(md);

    if (isExplicitlyOutOfStock) {
      return {
        status: "OUT_OF_STOCK",
        evidence: "Croma explicitly marked item as Out of Stock or Notify Me",
        confidence: 0.98,
      };
    }

    // Positive purchase evidence
    const hasAddToCartButton =
      /\bAdd to Cart\b/i.test(html) ||
      /\bAdd to Cart\b/i.test(md) ||
      /id=["']btn-add-to-cart["']/i.test(html) ||
      /class=["'][^"']*\bpdp-add-to-cart\b[^"']*["']/i.test(html);

    const hasBuyNowButton =
      /\bBuy Now\b/i.test(html) ||
      /\bBuy Now\b/i.test(md) ||
      /id=["']btn-buy-now["']/i.test(html) ||
      /class=["'][^"']*\bpdp-buy-now\b[^"']*["']/i.test(html);

    const hasDeliveryEvidence =
      /\bExpress Delivery\b/i.test(html) ||
      /\bStandard Delivery\b/i.test(html) ||
      /\bDelivery by\b/i.test(html) ||
      /\bIn Stock\b/i.test(html);

    if (hasAddToCartButton || hasBuyNowButton || hasDeliveryEvidence) {
      const evidence = hasAddToCartButton
        ? "Croma Add to Cart button present"
        : hasBuyNowButton
        ? "Croma Buy Now button present"
        : "Croma Express/Standard delivery available";

      return {
        status: "IN_STOCK",
        evidence,
        confidence: 0.98,
      };
    }

    // Not found
    if (content.statusCode === 404 || /we couldn't find that page|page not found|404 error/i.test(md)) {
      return {
        status: "NOT_FOUND",
        evidence: "Croma page returned 404 Not Found",
        confidence: 0.99,
      };
    }

    // Default to UNKNOWN (never assume in stock)
    return {
      status: "UNKNOWN",
      evidence: "Croma page loaded but positive purchase indicators were not verifiable",
      confidence: 0.4,
    };
  }

  /**
   * Extracts canonical product identity from Croma page content.
   */
  extractCanonicalIdentity(content: ScrapedContent, url: string): CanonicalProductIdentity {
    const html = content.html || "";
    const md = content.markdown || "";
    const canonicalUrl = canonicalizeCromaUrl(url);

    // 1. Raw Title
    let rawTitle = "";
    const h1Match =
      html.match(/<h1[^>]*class=["'][^"']*\b(?:pd-title|pdp-title)\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

    if (h1Match) {
      const candTitle = h1Match[1].replace(/<[^>]+>/g, "").trim();
      if (!candTitle.toLowerCase().includes("hamburger") && candTitle.length > 3) {
        rawTitle = candTitle;
      }
    }

    if (!rawTitle) {
      const mdH1 = md.match(/^#\s+(.+)$/m);
      if (mdH1) {
        const candMd = mdH1[1].trim();
        if (!candMd.toLowerCase().includes("hamburger") && candMd.length > 3) {
          rawTitle = candMd;
        }
      }
    }

    if (!rawTitle) {
      const headTitle = html.match(/<title>([\s\S]*?)<\/title>/i);
      if (headTitle) {
        const candHead = headTitle[1].replace(/\s*-\s*Buy\s+.*$/i, "").replace(/\s*\|\s*Croma.*$/i, "").trim();
        if (!candHead.toLowerCase().includes("hamburger") && candHead.length > 3) {
          rawTitle = candHead;
        }
      }
    }

    // Fallback to URL slug if page was client-rendered SPA or returned navigation shell
    if (!rawTitle || rawTitle.toLowerCase().includes("hamburger") || rawTitle.length < 5) {
      const slugTitle = extractCromaTitleFromUrl(url);
      if (slugTitle) {
        rawTitle = slugTitle;
      }
    }

    const cleanTitle = cleanProductTitle(rawTitle);

    // 2. Brand
    let explicitBrand: string | null = null;
    const brandMatch =
      html.match(/class=["'][^"']*\bbrand-name\b[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
      md.match(/Brand\s*:?\s*([A-Za-z0-9\s.,&'-]+)/i);
    if (brandMatch) {
      const candB = brandMatch[1].trim();
      // Guard against 1-char icons like "s" from Croma navigation headers
      if (candB.length > 1) {
        explicitBrand = candB;
      }
    }
    const brand = detectBrandFromTitle(cleanTitle, explicitBrand);

    // 3. Model
    let explicitModel: string | null = null;
    const modelMatch =
      html.match(/Model (?:Name|Number)[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i) ||
      md.match(/Model (?:Name|Number)\s*\|\s*([^\n|]+)/i);
    if (modelMatch) {
      const candM = modelMatch[1].replace(/<[^>]+>/g, "").trim();
      if (candM.length > 1) {
        explicitModel = candM;
      }
    }
    const model = explicitModel || extractModelFromTitle(cleanTitle, brand);

    // 4. Variant attributes
    const variant = extractVariantAttributes(cleanTitle, md);

    // 5. Category
    let breadcrumbText: string | null = null;
    const breadcrumbMatch = html.match(/class=["'][^"']*\bbreadcrumb\b[^"']*["'][\s\S]*?<\/ul>/i);
    if (breadcrumbMatch) {
      breadcrumbText = breadcrumbMatch[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    const detectedCategory = defaultCategoryRouter.detectCategory(cleanTitle, breadcrumbText);

    // 6. Image
    let imageUrl: string | null = null;
    const imgMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      md.match(/!\[.*?\]\((https:\/\/media\.croma\.com[^\s)]+)\)/i);
    if (imgMatch) {
      imageUrl = imgMatch[1];
    }

    const pid = extractCromaProductId(url);

    return {
      platform: "Croma",
      sourceUrl: canonicalUrl,
      rawTitle,
      cleanTitle,
      brand,
      model,
      modelNumber: explicitModel,
      productIdentifier: pid || undefined,
      identifierType: pid ? "CROMA_PRODUCT_ID" : undefined,
      sku: pid || undefined,
      category: detectedCategory,
      variant,
      seller: "Croma",
      imageUrl,
    };
  }

  normalize(content: ScrapedContent, url: string): NormalizedProductQuote {
    const canonicalUrl = canonicalizeCromaUrl(url);
    const identity = this.extractCanonicalIdentity(content, canonicalUrl);
    const price = this.extractPrice(content);
    const availability = this.extractAvailability(content);

    let rawConfidence = availability.confidence;
    if (!price) {
      rawConfidence *= 0.5;
    }
    if (!identity.brand) {
      rawConfidence *= 0.8;
    }

    return {
      platform: "Croma",
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
    if (identity.brand && (!identity.model || !identity.model.toLowerCase().includes(identity.brand.toLowerCase()))) {
      parts.push(identity.brand);
    }
    if (identity.model) {
      parts.push(identity.model);
    } else if (identity.cleanTitle) {
      parts.push(identity.cleanTitle);
    }
    if (identity.variant.capacity && !parts.join(" ").includes(identity.variant.capacity)) parts.push(identity.variant.capacity);
    if (identity.variant.connectivity && !parts.join(" ").includes(identity.variant.connectivity)) parts.push(identity.variant.connectivity);
    if (identity.variant.appliance_type && !parts.join(" ").includes(identity.variant.appliance_type)) parts.push(identity.variant.appliance_type);
    if (identity.variant.ram && !parts.join(" ").includes(identity.variant.ram)) parts.push(identity.variant.ram);
    if (identity.variant.storage && !parts.join(" ").includes(identity.variant.storage)) parts.push(identity.variant.storage);
    if (identity.variant.size && !parts.join(" ").includes(identity.variant.size)) parts.push(identity.variant.size);
    if (identity.variant.volume_or_weight && !parts.join(" ").includes(identity.variant.volume_or_weight)) parts.push(identity.variant.volume_or_weight);
    if (identity.variant.color && !parts.join(" ").includes(identity.variant.color)) parts.push(identity.variant.color);

    return parts.join(" ").trim();
  }
}

export const cromaAdapter = new CromaAdapter();
