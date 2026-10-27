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
 * Extracts Flipkart's unique Product ID / FSN (e.g. MOBGZJ42RAGZTZTH or itm...).
 */
export function extractFlipkartPid(url: string): string | null {
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
    const match = parsed.pathname.match(/\/p\/(itm[a-zA-Z0-9]+)/i);
    if (match) {
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalizes a Flipkart URL to a canonical, tracking-free URL.
 */
export function canonicalizeFlipkartUrl(url: string): string {
  if (!url || typeof url !== "string") return url;
  try {
    let trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    const pid = parsed.searchParams.get("pid");

    // Standardize domain to https://www.flipkart.com
    const cleanUrl = new URL(parsed.pathname, "https://www.flipkart.com");
    if (pid) {
      cleanUrl.searchParams.set("pid", pid.trim());
    }
    return cleanUrl.toString();
  } catch {
    return url;
  }
}

export class FlipkartAdapter implements PlatformAdapter {
  readonly platform: SupportedStorePlatform = "Flipkart";

  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    try {
      let trimmed = url.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        trimmed = `https://${trimmed}`;
      }
      const host = new URL(trimmed).hostname.toLowerCase();
      return (
        /(?:^|\.)flipkart\.com$/i.test(host) ||
        /(?:^|\.)fkrt\.it$/i.test(host)
      );
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

    // Helper: Parse currency number from string
    const parseAmount = (str: string | null | undefined): number | null => {
      if (!str) return null;
      const clean = str.replace(/[₹$,]/g, "").match(/(\d+(?:\.\d{1,2})?)/);
      if (!clean) return null;
      const val = parseFloat(clean[1]);
      return !Number.isNaN(val) && val > 0 ? Math.round(val * 100) / 100 : null;
    };

    // 1. Extract Current Selling Price and MRP from HTML
    if (html) {
      // Find the main product heading in HTML to ignore sponsored carousel ads preceding the product!
      const h1Idx = html.search(/<h1[\s>]/i);
      const productHtml = h1Idx !== -1 ? html.substring(h1Idx) : html;

      // First check atomic modern price block where strike-through MRP immediately precedes the current price
      const modernPriceBlock = productHtml.match(
        /text-decoration(?:-line)?:\s*line-through[^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\/div>[\s\S]{0,350}?(?:font=["']default-fk-font-l["'][^>]*>|class=["'][^"']*Nx9bqj[^"']*["'][^>]*>)\s*₹\s*([\d,]+(?:\.\d{2})?)/i
      );
      if (modernPriceBlock) {
        const blockMrp = parseAmount(modernPriceBlock[1]);
        const blockPrice = parseAmount(modernPriceBlock[2]);
        if (blockPrice && blockPrice > 0) {
          currentPrice = blockPrice;
          if (blockMrp && blockMrp > blockPrice) {
            mrp = blockMrp;
          }
        }
      }

      // Standalone modern price
      if (!currentPrice) {
        const modernPrice = productHtml.match(/font=["']default-fk-font-l["'][^>]*>₹\s*([\d,]+(?:\.\d{2})?)<\/div>/i);
        if (modernPrice) {
          currentPrice = parseAmount(modernPrice[1]);
        }
      }

      // Legacy Flipkart classes: Nx9bqj CxhGGd (product view), _30jeq3 _16Jk6d
      if (!currentPrice) {
        const priceMatch =
          productHtml.match(/class=["'][^"']*Nx9bqj\s+CxhGGd[^"']*["'][^>]*>([^<]+)<\/div>/i) ||
          productHtml.match(/class=["'][^"']*Nx9bqj[^"']*["'][^>]*>([^<]+)<\/div>/i) ||
          productHtml.match(/class=["'][^"']*_30jeq3\s+_16Jk6d[^"']*["'][^>]*>([^<]+)<\/div>/i) ||
          productHtml.match(/class=["'][^"']*_30jeq3[^"']*["'][^>]*>([^<]+)<\/div>/i);

        if (priceMatch) {
          currentPrice = parseAmount(priceMatch[1]);
        }
      }

      // Standalone MRP fallback
      if (!mrp) {
        const modernMrpMatches = Array.from(
          productHtml.matchAll(/text-decoration(?:-line)?:\s*line-through[^>]*>₹?\s*([\d,]+(?:\.\d{2})?)<\/div>/gi)
        );
        for (const m of modernMrpMatches) {
          const val = parseAmount(m[1]);
          if (val && (!currentPrice || val > currentPrice)) {
            mrp = val;
            break;
          }
        }
      }

      if (!mrp) {
        const legacyMrpMatches = Array.from(
          productHtml.matchAll(/class=["'][^"']*(?:yRaY8j|_3I9_wc)[^"']*["'][^>]*>([^<]+)<\/div>/gi)
        );
        for (const m of legacyMrpMatches) {
          const val = parseAmount(m[1]);
          if (val && (!currentPrice || val > currentPrice)) {
            mrp = val;
            break;
          }
        }
      }
    }

    // 2. Fallback to Markdown with strict EMI / Bank Offer / Exchange / Carousel Ad filtering
    if (!currentPrice && md) {
      const lines = md.split("\n");
      // CRITICAL: Products carousel/recommendation ads appear BEFORE the main product heading.
      // Only evaluate lines after the main title heading (# ) to prevent extracting prices of sponsored carousel items!
      let titleHeadingFound = false;
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!titleHeadingFound) {
          if (/^#\s+/.test(line)) {
            titleHeadingFound = true;
          }
          continue;
        }

        // Reject lines containing EMI, bank offers, exchange rates, combos, delivery fees, protection fees, or ads
        if (
          /\b(emi|per\s*month|\/month|pm\b|x\s*\d+m|pay\s*₹|bank\s*offer|with\s*bank\s*offer|cashback|delivery\s*fee|shipping|coupon|save\s*up\s*to|with\s*exchange|exchange\s*offer|protect\s*promise|fee|buy\s*at\s*₹|apply\s*offers?|more\s*offers?|ad\]|\bAD\b)\b/i.test(
            line
          )
        ) {
          continue;
        }

        // Match standalone selling price e.g. "₹37,990" or "Special Price: ₹37,990"
        const pricePattern = /(?:Special Price|Price|₹)\s*₹?\s*([\d,]{3,}(?:\.\d{2})?)/i;
        const match = line.match(pricePattern);
        if (match) {
          const val = parseAmount(match[1]);
          if (val && val > 0) {
            currentPrice = val;
            break;
          }
        }
      }

      // MRP from Markdown strikethrough (~~₹49,490~~) or MRP prefix
      if (!mrp && md) {
        const lines = md.split("\n");
        let foundHeading = false;
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!foundHeading) {
            if (/^#\s+/.test(line)) foundHeading = true;
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
          if (currentPrice && /^\d{2,3},\d{3}$/.test(line)) {
            const possible = parseAmount(line);
            if (possible && possible > currentPrice) {
              mrp = possible;
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
      platform: "Flipkart",
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

    // 1. Positive Purchase Evidence for IN_STOCK
    const hasAddToCartButton =
      /\bAdd to Cart\b/i.test(html) ||
      /\bADD TO CART\b/i.test(html) ||
      /\bAdd to Cart\b/i.test(md) ||
      /\bADD TO CART\b/i.test(md);

    const hasBuyNowButton =
      /\bBuy Now\b/i.test(html) ||
      /\bBUY NOW\b/i.test(html) ||
      /\bBuy Now\b/i.test(md) ||
      /\bBUY NOW\b/i.test(md);

    const hasInStockText =
      /\bIn Stock\b/i.test(html) ||
      /\bIn Stock\b/i.test(md) ||
      /\bAvailable\b/i.test(md);

    // Explicit Out-of-Stock takes precedence if both somehow matched
    const isExplicitlyOutOfStock =
      /\bNotify Me\b/i.test(html) ||
      /\bNotify Me\b/i.test(md) ||
      /\bCurrently Out of Stock\b/i.test(html) ||
      /\bCurrently Out of Stock\b/i.test(md) ||
      /\bSold Out\b/i.test(html) ||
      /\bSold Out\b/i.test(md) ||
      /\bItem is out of stock\b/i.test(html) ||
      /\bItem is out of stock\b/i.test(md) ||
      /\bThis item is unavailable\b/i.test(html) ||
      /\bThis item is unavailable\b/i.test(md);

    if (isExplicitlyOutOfStock) {
      return {
        status: "OUT_OF_STOCK",
        evidence: "Flipkart explicitly marked item with 'Notify Me' or 'Currently Out of Stock'",
        confidence: 0.98,
      };
    }

    if (hasAddToCartButton || hasBuyNowButton || hasInStockText) {
      const evidence = hasAddToCartButton
        ? "Flipkart Add to Cart button present"
        : hasBuyNowButton
        ? "Flipkart Buy Now button present"
        : "Flipkart In Stock status verified";

      return {
        status: "IN_STOCK",
        evidence,
        confidence: 0.98,
      };
    }

    // 2. Not Found (404 or product removed)
    if (content.statusCode === 404 || /we couldn't find that page|page not found/i.test(md)) {
      return {
        status: "NOT_FOUND",
        evidence: "Flipkart page not found or product removed (404)",
        confidence: 0.99,
      };
    }

    // 3. Inconclusive: UNKNOWN
    return {
      status: "UNKNOWN",
      evidence: "Page loaded but positive purchase button or explicit stock status was not verifiable",
      confidence: 0.4,
    };
  }

  /**
   * Extracts canonical product identity from Flipkart page content.
   */
  extractCanonicalIdentity(content: ScrapedContent, url: string): CanonicalProductIdentity {
    const html = content.html || "";
    const md = content.markdown || "";
    const canonicalUrl = canonicalizeFlipkartUrl(url);

    // 1. Raw Title
    let rawTitle = "";
    const h1Match =
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/class=["'][^"']*VU-ZEz[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
      html.match(/class=["'][^"']*B_NuCI[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

    if (h1Match) {
      rawTitle = h1Match[1].replace(/<[^>]+>/g, "").trim();
    } else {
      const mdH1 = md.match(/^#\s+(.+)$/m);
      if (mdH1) {
        rawTitle = mdH1[1].trim();
      } else {
        const headTitle = html.match(/<title>([\s\S]*?)<\/title>/i);
        if (headTitle) {
          rawTitle = headTitle[1].replace(/\s*-\s*Flipkart.*$/i, "").trim();
        }
      }
    }

    // Check if title was truncated by Flipkart with "...more" or "..." and un-truncated title exists in "More about [Product]"
    if (rawTitle.includes("...") || rawTitle.includes("more")) {
      const moreAboutMatch = md.match(/More about\s+([^\n\\]+)/i);
      if (moreAboutMatch && moreAboutMatch[1].trim().length > rawTitle.length) {
        rawTitle = moreAboutMatch[1].trim();
      }
    }

    const cleanTitle = cleanProductTitle(rawTitle);

    // 2. Brand
    let explicitBrand: string | null = null;
    const brandMatch =
      html.match(/class=["'][^"']*G6XhRU[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
      md.match(/Brand\s*:?\s*([A-Za-z0-9\s.,&'-]+)/i);
    if (brandMatch) {
      const bCandidate = brandMatch[1].trim();
      if (!/^(?:store|shop|brand|visit|official\s*store)$/i.test(bCandidate)) {
        explicitBrand = bCandidate || null;
      }
    }
    const brand = detectBrandFromTitle(cleanTitle, explicitBrand);

    // 3. Model
    let explicitModel: string | null = null;
    const modelRowMatch =
      html.match(/Model Name[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i) ||
      html.match(/Model Number[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i) ||
      md.match(/Model (?:Name|Number)\s*\|\s*([^\n|]+)/i);
    if (modelRowMatch) {
      explicitModel = modelRowMatch[1].replace(/<[^>]+>/g, "").trim() || null;
    }
    const model = explicitModel || extractModelFromTitle(cleanTitle, brand);

    // 4. Variant attributes (RAM, storage, color, size, pack_size, etc.)
    const variant = extractVariantAttributes(cleanTitle, md);

    // 5. Category
    let breadcrumbText: string | null = null;
    const breadcrumbMatch =
      html.match(/class=["'][^"']*_3GIHBu[^"']*["'][\s\S]*?<\/div>/i) ||
      html.match(/class=["'][^"']*r2CdBx[^"']*["'][\s\S]*?<\/div>/i);
    if (breadcrumbMatch) {
      breadcrumbText = breadcrumbMatch[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    const detectedCategory = defaultCategoryRouter.detectCategory(cleanTitle, breadcrumbText);

    // 6. Seller
    let seller: string | null = null;
    const sellerMatch =
      html.match(/id=["']sellerName["'][\s\S]*?<span>([^<]+)<\/span>/i) ||
      html.match(/class=["'][^"']*_1RLviY[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
      md.match(/Seller\s*:?\s*([A-Za-z0-9\s.,&'-]+?)(?:\(|\n|<|\.)/i);
    if (sellerMatch) {
      seller = sellerMatch[1].replace(/<[^>]+>/g, "").trim() || null;
    }

    // 7. Image URL
    let imageUrl: string | null = null;
    const imgMatch =
      html.match(/class=["'][^"']*_0DkuPH[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      md.match(/!\[.*?\]\((https:\/\/rukminim[^\s)]+)\)/i);
    if (imgMatch) {
      imageUrl = imgMatch[1];
    }

    const pid = extractFlipkartPid(url);

    return {
      platform: "Flipkart",
      sourceUrl: canonicalUrl,
      rawTitle,
      cleanTitle,
      brand,
      model,
      modelNumber: explicitModel,
      productIdentifier: pid || undefined,
      identifierType: pid ? "FLIPKART_PID" : undefined,
      sku: pid || undefined,
      category: detectedCategory,
      variant,
      seller,
      imageUrl,
    };
  }

  /**
   * Combines all extracted components into a validated NormalizedProductQuote.
   */
  normalize(content: ScrapedContent, url: string): NormalizedProductQuote {
    const canonicalUrl = canonicalizeFlipkartUrl(url);
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
      platform: "Flipkart",
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

  /**
   * Builds an accurate, highly specific search query for cross-store discovery.
   */
  buildSearchQuery(identity: CanonicalProductIdentity): string {
    const parts: string[] = [];
    if (identity.brand) parts.push(identity.brand);
    if (identity.model) parts.push(identity.model);
    if (identity.variant.capacity) parts.push(identity.variant.capacity);
    if (identity.variant.connectivity) parts.push(identity.variant.connectivity);
    if (identity.variant.appliance_type) parts.push(identity.variant.appliance_type);
    if (identity.variant.ram) parts.push(identity.variant.ram);
    if (identity.variant.storage) parts.push(identity.variant.storage);
    if (identity.variant.size) parts.push(identity.variant.size);
    if (identity.variant.volume_or_weight) parts.push(identity.variant.volume_or_weight);
    if (identity.variant.color) parts.push(identity.variant.color);
    if (identity.variant.pack_size && identity.variant.pack_size > 1) {
      parts.push(`Pack of ${identity.variant.pack_size}`);
    }

    return parts.join(" ");
  }
}

export const flipkartAdapter = new FlipkartAdapter();
