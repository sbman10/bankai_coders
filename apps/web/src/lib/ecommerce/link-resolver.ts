/**
 * Product Link Resolver — Platform-Aware Accurate Extractor
 * Strictly extracts verified catalog data from Amazon India, Flipkart, and Meesho.
 * Never invents, infers, or hallucinates data.
 */

import { extractAsin, extractMarketplace } from "@/lib/amazon/asin";

export type SupportedPlatform = "Amazon" | "Flipkart" | "Meesho";
export type FieldExtractionStatus = "found" | "not_found" | "needs_review";

export interface NormalizedProductData {
  platform: SupportedPlatform;
  productUrl: string;

  productName: string | null;
  brand: string | null;
  model: string | null;

  primaryImage: string | null;
  additionalImages: string[];

  seller: string | null;

  currentPrice: {
    amount: number;
    currency: string;
  } | null;

  warrantyDuration: string | null;
  category: string | null;

  extractionStatus: {
    productName: FieldExtractionStatus;
    brand: FieldExtractionStatus;
    model: FieldExtractionStatus;
    primaryImage: FieldExtractionStatus;
    seller: FieldExtractionStatus;
    currentPrice: FieldExtractionStatus;
    warrantyDuration: FieldExtractionStatus;
    category: FieldExtractionStatus;
  };
}

/**
 * Backward-compatible wrapper type supporting existing callers.
 */
export interface ProductLinkResolution extends NormalizedProductData {
  url: string;
  sourceUrl: string;
  marketplace: string;
  asin: string | null;
  title: string | null;
  price: number | null;
  imageUrl: string | null;
  imageUrls: string[];
}

export class InvalidMarketplaceUrlError extends Error {
  constructor(message = "Please enter a valid Amazon, Flipkart or Meesho product URL.") {
    super(message);
    this.name = "InvalidMarketplaceUrlError";
  }
}

export class MarketplaceAccessError extends Error {
  constructor(
    message = "This marketplace page couldn't be accessed automatically. You can enter the product details manually."
  ) {
    super(message);
    this.name = "MarketplaceAccessError";
  }
}

export class PageRetrievalError extends Error {
  constructor(
    message = "We couldn't retrieve this product page. Please check the URL or enter the product details manually."
  ) {
    super(message);
    this.name = "PageRetrievalError";
  }
}

/**
 * Validates and identifies the marketplace from a product URL.
 */
export function detectPlatform(rawUrl: string): {
  platform: SupportedPlatform;
  marketplace: string;
  canonicalUrl: string;
  asin: string | null;
} {
  let trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    throw new InvalidMarketplaceUrlError();
  }

  // Prepend https:// if user pasted url without scheme (e.g. amazon.in/dp/... or flipkart.com/...)
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidMarketplaceUrlError();
  }

  const host = parsed.hostname.toLowerCase();

  // 1. Amazon (Amazon.in, international Amazon, or amzn shortlinks)
  if (
    /(?:^|\.)amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp)$/i.test(host) ||
    /(?:^|\.)amzn\.(in|to)$/i.test(host)
  ) {
    const asin = extractAsin(trimmed);
    const domain = host.includes("amazon.") ? extractMarketplace(trimmed).replace(/^www\./i, "") : "amazon.in";
    const canonical = asin ? `https://www.amazon.in/dp/${asin}` : trimmed;
    return {
      platform: "Amazon",
      marketplace: domain.charAt(0).toUpperCase() + domain.slice(1),
      canonicalUrl: canonical,
      asin,
    };
  }

  // 2. Flipkart
  if (/(?:^|\.)flipkart\.com$/i.test(host)) {
    return {
      platform: "Flipkart",
      marketplace: "Flipkart",
      canonicalUrl: trimmed,
      asin: null,
    };
  }

  // 3. Meesho
  if (/(?:^|\.)meesho\.com$/i.test(host)) {
    return {
      platform: "Meesho",
      marketplace: "Meesho",
      canonicalUrl: trimmed,
      asin: null,
    };
  }

  throw new InvalidMarketplaceUrlError();
}

/**
 * Validates that an image URL is legitimate and not a placeholder, logo, or tracking pixel.
 */
export function isValidProductImage(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const s = url.trim().toLowerCase();
  if (!s.startsWith("http://") && !s.startsWith("https://")) return false;

  // Reject logos, sprites, placeholders, spinners, avatars, transparent pixels
  const badPatterns = [
    "nav-sprite",
    "transparent-pixel",
    "pixel.gif",
    "blank.gif",
    "spacer.gif",
    "logo_lite",
    "flipkart-logo",
    "amazon-logo",
    "meesho-logo",
    "placeholder",
    "spinner",
    "loading",
    "avatar",
    "star-rating",
    "badge",
    "banner",
    "cart-icon",
    "fkheaderlogo",
    "header_cart",
    "batman-returns/batman-returns",
  ];

  for (const pat of badPatterns) {
    if (s.includes(pat)) return false;
  }

  return true;
}

/**
 * Filter and deduplicate verified image URLs.
 */
function sanitizeImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const u of urls) {
    if (isValidProductImage(u) && !seen.has(u)) {
      seen.add(u);
      valid.push(u);
    }
  }
  return valid;
}

/**
 * Clean and decode HTML entities and extra whitespace from text.
 */
function cleanText(text: string | null | undefined): string | null {
  if (!text || typeof text !== "string") return null;
  const cleaned = text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[\u200E\u200F\u00A0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.toLowerCase() === "null" || cleaned.toLowerCase() === "n/a") {
    return null;
  }
  return cleaned;
}

/**
 * Parse numeric price from raw currency string (e.g. "₹4,499.00" -> 4499).
 */
function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const clean = text.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!clean) return null;
  const val = parseFloat(clean[1]);
  return !Number.isNaN(val) && val > 0 ? Math.round(val * 100) / 100 : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM PARSERS
// ─────────────────────────────────────────────────────────────────────────────

interface RawExtractedFields {
  productName: string | null;
  brand: string | null;
  model: string | null;
  primaryImage: string | null;
  additionalImages: string[];
  seller: string | null;
  currentPrice: { amount: number; currency: string } | null;
  warrantyDuration: string | null;
  category: string | null;
}

/**
 * Amazon India HTML Extractor
 */
function extractAmazonData(html: string): RawExtractedFields {
  // 1. Product Name
  let productName: string | null = null;
  const titleMatch = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  if (titleMatch) {
    productName = cleanText(titleMatch[1]);
  } else {
    const headTitle = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (headTitle) {
      const cleaned = cleanText(headTitle[1]);
      productName = cleaned ? cleaned.replace(/^Amazon\.in\s*:?\s*/i, "").replace(/: Amazon\.in$/i, "") : null;
    }
  }

  // 2. Images
  const additionalImages: string[] = [];
  let primaryImage: string | null = null;

  // Check colorImages embedded JSON (Amazon's hi-res gallery)
  const colorImagesMatch =
    html.match(/'colorImages':\s*\{\s*'initial':\s*A\.\$\.parseJSON\('(\[[^']+\।?\])'\)/i) ||
    html.match(/'colorImages':\s*\{\s*'initial':\s*(\[[^\]]+\])\s*\}/i) ||
    html.match(/"colorImages":\s*\{\s*"initial":\s*(\[[^\]]+\])\s*\}/i);

  if (colorImagesMatch) {
    try {
      const rawJson = colorImagesMatch[1].replace(/\\'/g, "'").replace(/&quot;/g, '"');
      const items = JSON.parse(rawJson) as Array<{
        hiRes?: string;
        large?: string;
        main?: Record<string, unknown>;
      }>;
      for (const item of items) {
        const candidate = item.hiRes || item.large;
        if (candidate && isValidProductImage(candidate)) {
          additionalImages.push(candidate);
        }
      }
    } catch {
      // Fallback to regex scan if JSON parse fails
    }
  }

  // Check data-a-dynamic-image
  if (additionalImages.length === 0) {
    const dynamicMatch = html.match(/data-a-dynamic-image=["']([^"']+)["']/i);
    if (dynamicMatch) {
      try {
        const parsed = JSON.parse(dynamicMatch[1].replace(/&quot;/g, '"')) as Record<string, [number, number]>;
        // Sort by resolution descending
        const sorted = Object.entries(parsed).sort((a, b) => {
          const areaA = (a[1]?.[0] || 0) * (a[1]?.[1] || 0);
          const areaB = (b[1]?.[0] || 0) * (b[1]?.[1] || 0);
          return areaB - areaA;
        });
        for (const [imgUrl] of sorted) {
          if (isValidProductImage(imgUrl)) {
            additionalImages.push(imgUrl);
          }
        }
      } catch {}
    }
  }

  // Check landingImage data-old-hires or src
  const landingImageMatch =
    html.match(/id=["']landingImage["'][^>]*data-old-hires=["']([^"']+)["']/i) ||
    html.match(/id=["']landingImage["'][^>]*src=["']([^"']+)["']/i);
  if (landingImageMatch && isValidProductImage(landingImageMatch[1])) {
    additionalImages.unshift(landingImageMatch[1]);
  }

  const sanitizedImages = sanitizeImageUrls(additionalImages);
  if (sanitizedImages.length > 0) {
    primaryImage = sanitizedImages[0];
  }

  // 3. Brand
  let brand: string | null = null;
  // Tech spec table Brand row
  const brandRowMatch = html.match(
    /<tr[^>]*>[\s\S]*?<th[^>]*>\s*(?:Brand|Brand Name)\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/i
  );
  if (brandRowMatch) {
    brand = cleanText(brandRowMatch[1].replace(/<[^>]+>/g, ""));
  }
  // bylineInfo
  if (!brand) {
    const bylineMatch = html.match(/id=["']bylineInfo["'][^>]*>([\s\S]*?)<\/a>/i);
    if (bylineMatch) {
      const txt = cleanText(bylineMatch[1].replace(/<[^>]+>/g, ""));
      if (txt) {
        brand = txt.replace(/^(?:Visit the|Brand:)\s*/i, "").replace(/\s*Store$/i, "").trim() || null;
      }
    }
  }

  // 4. Model
  let model: string | null = null;
  const modelRowMatch =
    html.match(
      /<tr[^>]*>[\s\S]*?<th[^>]*>\s*(?:Model Number|Item model number)\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/i
    ) ||
    html.match(
      /<tr[^>]*>[\s\S]*?<th[^>]*>\s*Model Name\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/i
    ) ||
    html.match(
      /<span class=["']a-text-bold["']>\s*(?:Item model number|Model Number)\s*<\/span>[\s\S]*?<span>([\s\S]*?)<\/span>/i
    );
  if (modelRowMatch) {
    model = cleanText(modelRowMatch[1].replace(/<[^>]+>/g, ""));
  }

  // 5. Seller
  let seller: string | null = null;
  const sellerMatch =
    html.match(/id=["']sellerProfileTriggerId["'][^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/id=["']merchant-info["'][\s\S]*?sold by\s*:?\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/sold by\s*:?\s*<a[^>]*id=["']sellerProfileTriggerId["'][^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/sold by\s*:?\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/(?:sold by|ships from and sold by)\s*:?\s*([A-Za-z0-9\s.,&'-]+?)(?:\s+and\s+Fulfilled|\.|\n|<)/i);
  if (sellerMatch) {
    seller = cleanText(sellerMatch[1].replace(/<[^>]+>/g, ""));
  }

  // 6. Current Price
  let currentPrice: { amount: number; currency: string } | null = null;
  const apexMatch =
    html.match(/apexPriceToPay[\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
    html.match(/class=["']a-price\s+a-text-price\s+a-size-medium\s+apexPriceToPay["'][\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
    html.match(/id=["']corePrice_feature_div["'][\s\S]*?class=["']a-offscreen["']>([^<]+)<\/span>/i) ||
    html.match(/class=["']a-price-whole["']>([^<]+)<\/span>/i);

  if (apexMatch) {
    const amt = parsePrice(apexMatch[1]);
    if (amt) {
      currentPrice = { amount: amt, currency: "INR" };
    }
  }

  // 7. Warranty Duration
  let warrantyDuration: string | null = null;
  const warrantyRowMatch =
    html.match(
      /<tr[^>]*>[\s\S]*?<th[^>]*>\s*(?:Warranty|Warranty Description|Manufacturer Warranty)\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/i
    ) ||
    html.match(
      /<span class=["']a-text-bold["']>\s*(?:Warranty|Warranty Description)\s*<\/span>[\s\S]*?<span>([\s\S]*?)<\/span>/i
    );
  if (warrantyRowMatch) {
    warrantyDuration = cleanText(warrantyRowMatch[1].replace(/<[^>]+>/g, ""));
  }

  // 8. Category
  let category: string | null = null;
  const breadcrumbMatch = html.match(/id=["']wayfinding-breadcrumbs_feature_div["'][\s\S]*?<\/div>/i);
  if (breadcrumbMatch) {
    const crumbs = [...breadcrumbMatch[0].matchAll(/<a[^>]*class=["'][^"']*a-link-normal[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => cleanText(m[1].replace(/<[^>]+>/g, "")))
      .filter((c): c is string => Boolean(c));
    if (crumbs.length > 0) {
      category = crumbs[crumbs.length - 1];
    }
  }

  return {
    productName,
    brand,
    model,
    primaryImage,
    additionalImages: sanitizedImages,
    seller,
    currentPrice,
    warrantyDuration,
    category,
  };
}

/**
 * Flipkart HTML Extractor
 */
/**
 * Upgrades Flipkart / Flixcart image URLs to 1500x1500px high-resolution.
 */
function upgradeFlixcartImageResolution(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  return url.replace(/\/image\/\d+\/\d+\//, "/image/1500/1500/");
}

/**
 * Flipkart HTML Extractor
 */
function extractFlipkartData(html: string): RawExtractedFields {
  let productName: string | null = null;
  let brand: string | null = null;
  let model: string | null = null;
  let primaryImage: string | null = null;
  const additionalImages: string[] = [];
  let seller: string | null = null;
  let currentPrice: { amount: number; currency: string } | null = null;
  let warrantyDuration: string | null = null;
  let category: string | null = null;

  // 1. Schema.org JSON-LD extraction (allowing any attributes before/after type)
  const jsonLds = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of jsonLds) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item) continue;
        if (!productName && item.name) productName = cleanText(item.name);
        if (!brand && item.brand) {
          brand = typeof item.brand === "string" ? cleanText(item.brand) : cleanText(item.brand?.name);
        }
        if (!category && item.category) {
          category = cleanText(item.category);
        }
        if (!currentPrice && item.offers) {
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          if (offer && offer.price) {
            const amt = typeof offer.price === "number" ? offer.price : parsePrice(String(offer.price));
            if (amt) {
              currentPrice = { amount: amt, currency: offer.priceCurrency || "INR" };
            }
          }
        }
        if (Array.isArray(item.image)) {
          for (const img of item.image) {
            if (typeof img === "string" && isValidProductImage(img)) {
              const upgraded = upgradeFlixcartImageResolution(img);
              if (upgraded) additionalImages.push(upgraded);
            }
          }
        } else if (typeof item.image === "string" && isValidProductImage(item.image)) {
          const upgraded = upgradeFlixcartImageResolution(item.image);
          if (upgraded) additionalImages.push(upgraded);
        }
      }
    } catch {}
  }

  // 2. window.__INITIAL_STATE__ extraction
  const stateIdx = html.indexOf("window.__INITIAL_STATE__");
  if (stateIdx !== -1) {
    const eqIdx = html.indexOf("=", stateIdx);
    const endScriptIdx = html.indexOf("</script>", stateIdx);
    if (eqIdx !== -1 && endScriptIdx !== -1 && endScriptIdx > eqIdx) {
      let stateStr = html.slice(eqIdx + 1, endScriptIdx).trim();
      if (stateStr.endsWith(";")) stateStr = stateStr.slice(0, -1).trim();
      try {
        const state = JSON.parse(stateStr);
        // Fallback to seoData schema if not caught by script tag
        const schema = state.multiWidgetState?.pageDataResponse?.seoData?.schema?.[0];
        if (schema) {
          if (!productName && schema.name) productName = cleanText(schema.name);
          if (!brand && schema.brand) {
            brand = typeof schema.brand === "string" ? cleanText(schema.brand) : cleanText(schema.brand?.name);
          }
          if (!category && schema.category) category = cleanText(schema.category);
          if (!currentPrice && schema.offers?.price) {
            const amt = typeof schema.offers.price === "number" ? schema.offers.price : parsePrice(String(schema.offers.price));
            if (amt) currentPrice = { amount: amt, currency: schema.offers.priceCurrency || "INR" };
          }
          if (Array.isArray(schema.image)) {
            for (const img of schema.image) {
              if (typeof img === "string" && isValidProductImage(img)) {
                const upgraded = upgradeFlixcartImageResolution(img);
                if (upgraded) additionalImages.push(upgraded);
              }
            }
          }
        }
      } catch {}

      // Seller from state/script
      if (!seller) {
        const sellerPattern = stateStr.match(/Seller:\s*([^"\\]+)/i) || stateStr.match(/"sellerName":\s*"([^"]+)"/i);
        if (sellerPattern) {
          seller = cleanText(sellerPattern[1]);
        }
      }

      // Model Number or Name from state/script
      if (!model) {
        const modelNumMatch = stateStr.match(/"Model Number"[\s\S]{0,120}?"text":\s*\["([^"]+)"\]/i)
          || stateStr.match(/"Model Number"[\s\S]{0,120}?"text":\s*"([^"]+)"/i)
          || stateStr.match(/"(?:Model Number|Model Name)":\s*"([^"]+)"/i);
        if (modelNumMatch) {
          model = cleanText(modelNumMatch[1]);
        } else {
          const modelNameMatch = stateStr.match(/"Model Name"[\s\S]{0,120}?"text":\s*\["([^"]+)"\]/i)
            || stateStr.match(/"Model Name"[\s\S]{0,120}?"text":\s*"([^"]+)"/i);
          if (modelNameMatch) model = cleanText(modelNameMatch[1]);
        }
      }

      // Warranty from state/script
      if (!warrantyDuration) {
        const warrantyMatch = stateStr.match(/"(?:text|value|warranty)":\s*"([^"]*(?:Year|Month|Domestic|Manufacturer)\s+Warranty[^"]*)"/i)
          || stateStr.match(/"(?:Domestic Warranty|Warranty Summary)":\s*"([^"]+)"/i);
        if (warrantyMatch) {
          warrantyDuration = cleanText(warrantyMatch[1]);
        }
      }
    }
  }

  // 3. Fallbacks from HTML elements / classes / meta
  if (!productName) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<span class=["'][^"']*B_NuCI[^"']*["']>([\s\S]*?)<\/span>/i);
    if (h1) {
      productName = cleanText(h1[1].replace(/<[^>]+>/g, ""));
    } else {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitle) {
        productName = cleanText(ogTitle[1]);
      } else {
        const titleTag = html.match(/<title>([\s\S]*?)<\/title>/i);
        if (titleTag) {
          const t = cleanText(titleTag[1]);
          productName = t ? t.replace(/\s*:?\s*Buy .* at Flipkart.*$/i, "").replace(/: Flipkart\.com$/i, "") : null;
        }
      }
    }
  }

  // Fallback for image from og:image
  if (additionalImages.length === 0) {
    const ogImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImg && isValidProductImage(ogImg[1])) {
      const upgraded = upgradeFlixcartImageResolution(ogImg[1]);
      if (upgraded) additionalImages.push(upgraded);
    }
  }

  if (!currentPrice) {
    const priceDiv = html.match(/<div class=["'][^"']*(?:Nx9bqj|_30jeq3)[^"']*["']>([^<]+)<\/div>/i);
    if (priceDiv) {
      const amt = parsePrice(priceDiv[1]);
      if (amt) currentPrice = { amount: amt, currency: "INR" };
    }
  }

  if (!seller) {
    const sellerMatch =
      html.match(/id=["']sellerName["'][\s\S]*?<span>([\s\S]*?)<\/span>/i) ||
      html.match(/<div class=["'][^"']*_1RLviY[^"']*["']>[\s\S]*?<span>([\s\S]*?)<\/span>/i) ||
      html.match(/<div class=["'][^"']*_2mFmU7[^"']*["']>([\s\S]*?)<\/div>/i);
    if (sellerMatch) {
      const s = cleanText(sellerMatch[1].replace(/<[^>]+>/g, ""));
      if (s && !/become a seller/i.test(s)) seller = s;
    }
  }

  // Table rows for model, warranty, brand (legacy Flipkart tables)
  const rows = [...html.matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi)];
  for (const r of rows) {
    const k = cleanText(r[1].replace(/<[^>]+>/g, ""))?.toLowerCase() || "";
    const v = cleanText(r[2].replace(/<[^>]+>/g, ""));
    if (!v) continue;
    if (!model && (k === "model name" || k === "model number")) {
      model = v;
    }
    if (!warrantyDuration && (k.includes("warranty summary") || k.includes("domestic warranty") || k === "warranty")) {
      warrantyDuration = v;
    }
    if (!brand && k === "brand") {
      brand = v;
    }
  }

  const sanitized = sanitizeImageUrls(additionalImages);
  if (sanitized.length > 0) {
    primaryImage = sanitized[0];
  }

  return {
    productName,
    brand,
    model,
    primaryImage,
    additionalImages: sanitized,
    seller,
    currentPrice,
    warrantyDuration,
    category,
  };
}

/**
 * Meesho HTML Extractor
 */
function extractMeeshoData(html: string): RawExtractedFields {
  let productName: string | null = null;
  let brand: string | null = null;
  const model: string | null = null;
  let primaryImage: string | null = null;
  const additionalImages: string[] = [];
  let seller: string | null = null;
  let currentPrice: { amount: number; currency: string } | null = null;
  const warrantyDuration: string | null = null;
  let category: string | null = null;

  // 1. __NEXT_DATA__ SSR extraction
  const nextData = html.match(/<script id=["']__NEXT_DATA__["'] type=["']application\/json["']>([\s\S]*?)<\/script>/i);
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData[1]);
      const data = parsed?.props?.pageProps?.data || parsed?.props?.pageProps?.product;
      if (data) {
        if (data.name) productName = cleanText(data.name);
        if (data.supplier_name) seller = cleanText(data.supplier_name);
        if (data.brand_name) brand = cleanText(data.brand_name);
        if (data.category_name) category = cleanText(data.category_name);

        const priceVal = data.discountedPrice ?? data.price;
        if (typeof priceVal === "number" && priceVal > 0) {
          currentPrice = { amount: priceVal, currency: "INR" };
        }

        if (Array.isArray(data.images)) {
          for (const img of data.images) {
            if (typeof img === "string" && isValidProductImage(img)) {
              additionalImages.push(img);
            }
          }
        }
      }
    } catch {}
  }

  // 2. OpenGraph Fallback
  if (!productName) {
    const ogTitle =
      html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i);
    if (ogTitle) productName = cleanText(ogTitle[1]);
  }

  if (additionalImages.length === 0) {
    const ogImage =
      html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
    if (ogImage && isValidProductImage(ogImage[1])) {
      additionalImages.push(ogImage[1]);
    }
  }

  const sanitized = sanitizeImageUrls(additionalImages);
  if (sanitized.length > 0) {
    primaryImage = sanitized[0];
  }

  return {
    productName,
    brand,
    model,
    primaryImage,
    additionalImages: sanitized,
    seller,
    currentPrice,
    warrantyDuration,
    category,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveProductLinkOptions {
  htmlOverride?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Resolves verified catalog information and official product photographs from
 * supported e-commerce links (Amazon India, Flipkart, Meesho).
 *
 * Accuracy > Hallucination:
 * - Never invents brand, model, seller, warranty, or category.
 * - Leaves unverified fields as null with extractionStatus = "not_found".
 * - Throws explicit, actionable errors for invalid URLs, network/404 failures, or anti-bot blocks.
 */
export async function resolveProductLink(
  rawUrl: string,
  options?: ResolveProductLinkOptions
): Promise<ProductLinkResolution> {
  const detected = detectPlatform(rawUrl);
  const { platform, marketplace } = detected;
  let { canonicalUrl, asin } = detected;

  let html: string;

  if (typeof options?.htmlOverride === "string") {
    html = options.htmlOverride;
  } else {
    const fetchFn = options?.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await fetchFn(canonicalUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
        },
        signal: options?.signal ?? AbortSignal.timeout(10000),
      });
    } catch (err) {
      if (err instanceof MarketplaceAccessError || err instanceof PageRetrievalError) {
        throw err;
      }
      throw new PageRetrievalError();
    }

    // Handle bot blocks or cloudflare challenges
    if (res.status === 403 || res.status === 503) {
      throw new MarketplaceAccessError();
    }

    if (!res.ok) {
      throw new PageRetrievalError();
    }

    html = await res.text();

    // Check for captcha or bot challenge pages
    if (
      html.includes("Robot Check") ||
      html.includes("Type the characters you see in this image") ||
      html.includes("Access Denied") ||
      html.includes("cf-browser-verification")
    ) {
      throw new MarketplaceAccessError();
    }

    if (platform === "Amazon" && !asin && res.url) {
      asin = extractAsin(res.url);
      if (asin) {
        canonicalUrl = `https://www.amazon.in/dp/${asin}`;
      }
    }
  }

  // Resolve ASIN from canonical link tag in HTML if still missing
  if (platform === "Amazon" && !asin) {
    const canonicalTagMatch = html.match(/<link rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (canonicalTagMatch) {
      asin = extractAsin(canonicalTagMatch[1]);
    }
    if (asin) {
      canonicalUrl = `https://www.amazon.in/dp/${asin}`;
    }
  }

  // Parse according to platform
  let rawExtracted: RawExtractedFields;
  if (platform === "Amazon") {
    rawExtracted = extractAmazonData(html);
  } else if (platform === "Flipkart") {
    rawExtracted = extractFlipkartData(html);
  } else {
    rawExtracted = extractMeeshoData(html);
  }

  const {
    productName,
    brand,
    model,
    primaryImage,
    additionalImages,
    seller,
    currentPrice,
    warrantyDuration,
    category,
  } = rawExtracted;

  const extractionStatus = {
    productName: productName ? ("found" as const) : ("not_found" as const),
    brand: brand ? ("found" as const) : ("not_found" as const),
    model: model ? ("found" as const) : ("not_found" as const),
    primaryImage: primaryImage ? ("found" as const) : ("not_found" as const),
    seller: seller ? ("found" as const) : ("not_found" as const),
    currentPrice: currentPrice ? ("found" as const) : ("not_found" as const),
    warrantyDuration: warrantyDuration ? ("found" as const) : ("not_found" as const),
    category: category ? ("found" as const) : ("not_found" as const),
  };

  return {
    platform,
    productUrl: rawUrl.trim(),
    url: rawUrl.trim(),
    sourceUrl: canonicalUrl,
    marketplace,
    asin,

    productName,
    title: productName,
    brand,
    model,

    primaryImage,
    imageUrl: primaryImage,
    additionalImages,
    imageUrls: additionalImages,

    seller,

    currentPrice,
    price: currentPrice?.amount ?? null,

    warrantyDuration,
    category,

    extractionStatus,
  };
}
