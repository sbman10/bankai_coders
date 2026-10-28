import type { PlatformAdapter } from "./platform-adapter.interface";
import type {
  AvailabilityInfo,
  CanonicalProductIdentity,
  NormalizedProductQuote,
  PriceInfo,
  ScrapedContent,
  SupportedStorePlatform,
} from "./platform.types";
import { extractAsin, extractMarketplace, canonicalizeAmazonUrl } from "@/lib/amazon/asin";
import {
  cleanProductTitle,
  detectBrandFromTitle,
  extractModelFromTitle,
  extractVariantAttributes,
  isBlockedOrErrorTitle,
} from "../price-intelligence/canonical-identity";
import { defaultCategoryRouter } from "../price-intelligence/category-router";
import { validateCurrentSellingPrice } from "../price-intelligence/price-validator";

export function isAmazonBlockedOrErrorContent(
  content: ScrapedContent | { html?: string; markdown?: string; title?: string }
): boolean {
  const html = content.html || "";
  const md = content.markdown || "";

  // 1. Explicit bot challenge or captcha
  const lowerHtml = html.toLowerCase();
  const lowerMd = md.toLowerCase();
  if (
    lowerHtml.includes("enter the characters you see below") ||
    lowerHtml.includes("to discuss automated access to amazon data") ||
    lowerHtml.includes("api-services-support@amazon.com") ||
    lowerMd.includes("enter the characters you see below") ||
    lowerMd.includes("to discuss automated access to amazon data")
  ) {
    return true;
  }

  // If a valid product title element exists, it's definitely a real product page, NOT a block page!
  const prodMatch = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  if (prodMatch) {
    const prodTitle = prodMatch[1].replace(/<[^>]+>/g, "").trim();
    if (prodTitle && !isBlockedOrErrorTitle(prodTitle)) {
      return false;
    }
  }

  // 2. If NO valid productTitle exists, check if title tag or main heading indicates a blocked domain / error
  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleTag = (titleTagMatch ? titleTagMatch[1] : "").toLowerCase();
  if (
    titleTag.includes("robot check") ||
    titleTag.includes("amazon-adsystem") ||
    titleTag.includes("is blocked") ||
    titleTag.includes("err_blocked") ||
    titleTag.includes("blocked by client")
  ) {
    return true;
  }

  const firstMdH1Match = md.match(/^#\s+(.+)$/m);
  const firstH1 = (firstMdH1Match ? firstMdH1Match[1] : "").toLowerCase();
  if (
    firstH1.includes("amazon-adsystem") ||
    firstH1.includes("is blocked") ||
    firstH1.includes("err_blocked") ||
    firstH1.includes("access denied")
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts a product title slug from Amazon URL as a fallback.
 * e.g. /Samsung-A36-Dark-Green-128/dp/B0HJ255RGS -> "Samsung A36 Dark Green 128"
 */
export function extractAmazonTitleFromUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    let trimmed = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/^\/([a-zA-Z0-9%_-]+)\/dp\//i);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      if (/^(?:gp|dp)$/i.test(decoded)) return null;
      return decoded
        .split(/[-_]+/)
        .map((w) => {
          if (/^(?:5g|4g|gb|tb|mb|ram|rom|mah)$/i.test(w)) return w.toUpperCase();
          return w.charAt(0).toUpperCase() + w.slice(1);
        })
        .join(" ");
    }
    return null;
  } catch {
    return null;
  }
}

export class AmazonAdapter implements PlatformAdapter {
  readonly platform: SupportedStorePlatform = "Amazon";

  canonicalizeUrl(url: string): string {
    return canonicalizeAmazonUrl(url);
  }

  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    try {
      let trimmed = url.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        trimmed = `https://${trimmed}`;
      }
      const host = new URL(trimmed).hostname.toLowerCase();
      return (
        /(?:^|\.)amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp)$/i.test(host) ||
        /(?:^|\.)amzn\.(in|to)$/i.test(host)
      );
    } catch {
      return false;
    }
  }

  extractPrice(content: ScrapedContent): PriceInfo | null {
    if (isAmazonBlockedOrErrorContent(content)) {
      return null;
    }

    const html = content.html || "";
    const md = content.markdown || "";

    let currentPrice: number | null = null;
    let mrp: number | null = null;

    // Helper: Parse currency number from string
    const parseAmount = (str: string | null | undefined): number | null => {
      if (!str) return null;
      // Strip currency signs, commas, extra whitespace
      const clean = str.replace(/[₹$,]/g, "").match(/(\d+(?:\.\d{1,2})?)/);
      if (!clean) return null;
      const val = parseFloat(clean[1]);
      return !Number.isNaN(val) && val > 0 ? Math.round(val * 100) / 100 : null;
    };

    // 1. Extract Current Selling Price from HTML
    if (html) {
      // Primary: apexPriceToPay or corePrice_feature_div offscreen text
      const apexMatch =
        html.match(/apexPriceToPay[\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
        html.match(
          /class=["']a-price\s+a-text-price\s+a-size-medium\s+apexPriceToPay["'][\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i
        ) ||
        html.match(/id=["']corePriceDisplay_desktop_feature_div["'][\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
        html.match(/id=["']corePrice_feature_div["'][\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
        html.match(/id=["']priceblock_ourprice["'][^>]*>([^<]+)<\/span>/i) ||
        html.match(/id=["']priceblock_dealprice["'][^>]*>([^<]+)<\/span>/i);

      if (apexMatch) {
        currentPrice = parseAmount(apexMatch[1]);
      }

      // Secondary HTML fallback: search for a-price with a-offscreen
      if (!currentPrice) {
        const allOffscreenMatches = [...html.matchAll(/class=["'][^"']*a-price[^"']*["'][\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/gi)];
        for (const m of allOffscreenMatches) {
          const amt = parseAmount(m[1]);
          if (amt && amt > 0) {
            currentPrice = amt;
            break;
          }
        }
      }

      // Tertiary: generic a-offscreen or a-price-whole
      if (!currentPrice) {
        const offscreenMatch = html.match(/class=["']a-offscreen["']>([^<]+)<\/span>/i);
        if (offscreenMatch) {
          currentPrice = parseAmount(offscreenMatch[1]);
        }
      }

      if (!currentPrice) {
        const wholeMatch =
          html.match(/id=["']corePriceDisplay_desktop_feature_div["'][\s\S]*?class=["']a-price-whole["']>([^<]+)/i) ||
          html.match(/class=["']a-price-whole["']>([^<]+)/i);
        if (wholeMatch) {
          currentPrice = parseAmount(wholeMatch[1]);
        }
      }

      // Extract MRP (Strike-through / basis price)
      const mrpMatch =
        html.match(/class=["']a-price\s+a-text-price\s+a-size-base["'][\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
        html.match(/data-a-strike=["']true["'][\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
        html.match(/M\.R\.P\.[\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
        html.match(/M\.R\.P\.[\s\S]*?₹\s*([\d,]+(?:\.\d{2})?)/i);

      if (mrpMatch) {
        mrp = parseAmount(mrpMatch[1]);
      }
    }

    // 2. Fallback to Markdown with strict EMI / Bank Offer / Delivery filtering
    if (!currentPrice && md) {
      const lines = md.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        // Ignore lines representing EMI, bank discounts, coupons, cashback, delivery fees
        if (
          /\b(emi|per\s*month|\/month|month\b|bank\s*offer|cashback|delivery\s*fee|shipping|coupon|save\s*up\s*to\s*₹)\b/i.test(
            line
          )
        ) {
          continue;
        }

        // Look for price patterns e.g. "₹18,999" or "Price: ₹18,999" or "Deal Price: ₹18,999"
        const pricePattern = /(?:Price|Deal Price|Price:\s*|₹)\s*₹?\s*([\d,]{3,}(?:\.\d{2})?)/i;
        const match = line.match(pricePattern);
        if (match) {
          const val = parseAmount(match[1]);
          // Sanity check: must be greater than typical EMI (e.g. at least ₹50 unless accessories)
          if (val && val > 0) {
            currentPrice = val;
            break;
          }
        }
      }

      // MRP from Markdown
      if (!mrp && md) {
        const mrpMatch = md.match(/M\.?R\.?P\.?:?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i);
        if (mrpMatch) {
          mrp = parseAmount(mrpMatch[1]);
        }
      }
    }

    const validation = validateCurrentSellingPrice({
      sellingPrice: currentPrice,
      mrp,
      currency: "INR",
      platform: "Amazon",
    });

    if (!validation.isValid || !validation.price) {
      return null;
    }

    return validation.price;
  }

  extractAvailability(content: ScrapedContent): AvailabilityInfo {
    const html = content.html || "";
    const md = content.markdown || "";

    // 1. Not Found (404 or product removed)
    if (content.statusCode === 404 || /Looking for something\?[\s\S]*?We're sorry/i.test(html)) {
      return {
        status: "NOT_FOUND",
        evidence: "Amazon page not found or product removed (404)",
        confidence: 0.99,
      };
    }

    if (isAmazonBlockedOrErrorContent(content)) {
      return {
        status: "UNKNOWN",
        evidence: "Page blocked or ad-system error encountered",
        confidence: 0,
      };
    }

    // 2. Positive Purchase Evidence for IN_STOCK
    const hasAddToCartButton =
      /id=["']add-to-cart-button["']/i.test(html) ||
      /name=["']submit\.add-to-cart["']/i.test(html) ||
      /\bAdd to Cart\b/i.test(md);

    const hasBuyNowButton =
      /id=["']buy-now-button["']/i.test(html) ||
      /name=["']submit\.buy-now["']/i.test(html) ||
      /\bBuy Now\b/i.test(md);

    const hasInStockText =
      /id=["']availability["'][\s\S]*?class=["']a-size-medium\s+a-color-success["']>[\s\S]*?In stock\./i.test(html) ||
      /id=["']availability["'][\s\S]*?Only \d+ left in stock/i.test(html) ||
      /\bIn stock\./i.test(md) ||
      /\bOnly \d+ left in stock/i.test(md);

    if (hasAddToCartButton || hasBuyNowButton || hasInStockText) {
      const evidence = hasAddToCartButton
        ? "Add to Cart button present"
        : hasBuyNowButton
        ? "Buy Now button present"
        : "Explicit In Stock badge found";

      return {
        status: "IN_STOCK",
        evidence,
        confidence: 0.98,
      };
    }

    // 3. Explicit Out of Stock Evidence
    const isExplicitlyOutOfStock =
      /id=["']availability["'][\s\S]*?Currently unavailable\./i.test(html) ||
      /Currently unavailable\./i.test(md) ||
      /We don't know when or if this item will be back in stock\./i.test(html) ||
      /We don't know when or if this item will be back in stock\./i.test(md) ||
      /Out of stock\./i.test(html) ||
      /Out of stock\./i.test(md) ||
      /Temporarily out of stock\./i.test(html);

    if (isExplicitlyOutOfStock) {
      return {
        status: "OUT_OF_STOCK",
        evidence: "Explicitly marked 'Currently unavailable' or 'Out of stock'",
        confidence: 0.95,
      };
    }

    // 4. Inconclusive or no purchase evidence: UNKNOWN
    return {
      status: "UNKNOWN",
      evidence: "Page loaded but positive purchase button or explicit stock status was not verifiable",
      confidence: 0.4,
    };
  }

  extractCanonicalIdentity(content: ScrapedContent, url: string): CanonicalProductIdentity {
    const asin = extractAsin(url);
    if (isAmazonBlockedOrErrorContent(content)) {
      return {
        platform: "Amazon",
        sourceUrl: url,
        rawTitle: "",
        cleanTitle: "",
        brand: null,
        model: null,
        modelNumber: null,
        productIdentifier: asin || undefined,
        identifierType: asin ? "ASIN" : undefined,
        sku: asin || undefined,
        category: "Electronics",
        variant: {},
        seller: null,
        imageUrl: null,
      };
    }

    const html = content.html || "";
    const md = content.markdown || "";

    // 1. Raw Title
    let rawTitle = "";
    const titleMatch = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
    if (titleMatch) {
      const candidate = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      if (!isBlockedOrErrorTitle(candidate)) {
        rawTitle = candidate;
      }
    }

    if (!rawTitle && md) {
      const allMdH1s = [...md.matchAll(/^#\s+(.+)$/gm)].map((m) => m[1].trim());
      for (const h of allMdH1s) {
        if (
          !isBlockedOrErrorTitle(h) &&
          !/^(?:skip to|keyboard shortcut|select the department|see personalized recommendations)/i.test(h)
        ) {
          rawTitle = h;
          break;
        }
      }
    }

    if (!rawTitle && html) {
      const headTitle = html.match(/<title>([\s\S]*?)<\/title>/i);
      if (headTitle) {
        const candidate = headTitle[1]
          .replace(/\s*:\s*Amazon\.[a-z.]+.*$/i, "")
          .replace(/\s*-\s*Amazon\.[a-z.]+.*$/i, "")
          .trim();
        if (!isBlockedOrErrorTitle(candidate) && !/^(?:amazon\.[a-z.]+|online shopping site)/i.test(candidate)) {
          rawTitle = candidate;
        }
      }
    }

    if (!rawTitle || isBlockedOrErrorTitle(rawTitle)) {
      const slugTitle = extractAmazonTitleFromUrl(url);
      if (slugTitle && !isBlockedOrErrorTitle(slugTitle)) {
        rawTitle = slugTitle;
      }
    }

    if (isBlockedOrErrorTitle(rawTitle)) {
      rawTitle = "";
    }
    const cleanTitle = cleanProductTitle(rawTitle);

    // 2. Brand
    let explicitBrand: string | null = null;
    const bylineMatch = html.match(/id=["']bylineInfo["'][^>]*>([\s\S]*?)<\/a>/i);
    if (bylineMatch) {
      const txt = bylineMatch[1].replace(/<[^>]+>/g, "").trim();
      if (txt) {
        explicitBrand = txt.replace(/^(?:Visit the|Brand:)\s*/i, "").replace(/\s*Store$/i, "").trim() || null;
      }
    }
    const brand = detectBrandFromTitle(cleanTitle, explicitBrand);

    // 3. Model
    let explicitModel: string | null = null;
    const modelRowMatch =
      html.match(
        /<tr[^>]*>[\s\S]*?<th[^>]*>\s*(?:Model Number|Item model number)\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/i
      ) ||
      html.match(/<tr[^>]*>[\s\S]*?<th[^>]*>\s*Model Name\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/i);
    if (modelRowMatch) {
      explicitModel = modelRowMatch[1].replace(/<[^>]+>/g, "").trim() || null;
    }
    const model = explicitModel || extractModelFromTitle(cleanTitle, brand);

    // 4. Variant attributes
    const variant = cleanTitle ? extractVariantAttributes(cleanTitle, md) : {};

    // 5. Category
    let breadcrumbText: string | null = null;
    const breadcrumbMatch = html.match(/id=["']wayfinding-breadcrumbs_feature_div["'][\s\S]*?<\/div>/i);
    if (breadcrumbMatch) {
      breadcrumbText = breadcrumbMatch[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    const detectedCategory = defaultCategoryRouter.detectCategory(cleanTitle, breadcrumbText);

    // 6. Seller
    let seller: string | null = null;
    const sellerMatch =
      html.match(/id=["']sellerProfileTriggerId["'][^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/id=["']merchant-info["'][\s\S]*?sold by\s*:?\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/sold by\s*:?\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
      md.match(/Sold by\s*:?\s*\[?([A-Za-z0-9\s.,&'-]+?)(?:\]|\n|<|\.|\()/i);
    if (sellerMatch) {
      seller = sellerMatch[1].replace(/<[^>]+>/g, "").trim() || null;
    }

    // 7. Image
    let imageUrl: string | null = null;
    const landingImageMatch =
      html.match(/id=["']landingImage["'][^>]*data-old-hires=["']([^"']+)["']/i) ||
      html.match(/id=["']landingImage["'][^>]*src=["']([^"']+)["']/i);
    if (landingImageMatch) {
      imageUrl = landingImageMatch[1];
    } else {
      const ogImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      if (ogImg) {
        imageUrl = ogImg[1];
      } else {
        const mdImg =
          md.match(/!\[.*?\]\((https:\/\/m\.media-amazon\.com\/images\/I\/[^\s)]+)\)/i) ||
          html.match(/(https:\/\/m\.media-amazon\.com\/images\/I\/[a-zA-Z0-9%_+.-]+\.(?:jpg|png|webp))/i);
        if (mdImg) {
          imageUrl = mdImg[1];
        }
      }
    }

    return {
      platform: "Amazon",
      sourceUrl: url,
      rawTitle,
      cleanTitle,
      brand,
      model,
      modelNumber: explicitModel,
      productIdentifier: asin || undefined,
      identifierType: asin ? "ASIN" : undefined,
      sku: asin || undefined,
      category: detectedCategory,
      variant,
      seller,
      imageUrl,
    };
  }

  normalize(content: ScrapedContent, url: string): NormalizedProductQuote {
    const identity = this.extractCanonicalIdentity(content, url);
    const price = this.extractPrice(content);
    const availability = this.extractAvailability(content);

    // Raw confidence combines availability confidence and whether price was found
    let rawConfidence = availability.confidence;
    if (!price) {
      rawConfidence *= 0.5;
    }
    if (!identity.brand) {
      rawConfidence *= 0.8;
    }

    return {
      platform: "Amazon",
      productUrl: url,
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

export const amazonAdapter = new AmazonAdapter();
