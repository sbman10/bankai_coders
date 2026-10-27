/**
 * Product Link Resolver — Extracts catalog identity, marketplace, and product photos
 * from e-commerce links (Amazon, Flipkart, Meesho, or direct retailer URLs).
 */

import { extractAsin, extractMarketplace } from "@/lib/amazon/asin";
export type ProductLinkResolution = {
  url: string;
  sourceUrl: string;
  marketplace: string;
  asin: string | null;
  title: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  price: number | null;
  seller: string | null;
  imageUrl: string | null;
  imageUrls: string[];
};

/**
 * Common known electronics / lifestyle brands to detect from slugs or text.
 */
const KNOWN_BRANDS = [
  "Soundcore",
  "Anker",
  "Sony",
  "Apple",
  "Samsung",
  "Boat",
  "Noise",
  "OnePlus",
  "JBL",
  "Bose",
  "Sennheiser",
  "LG",
  "Philips",
  "Xiaomi",
  "Realme",
  "Dell",
  "HP",
  "Lenovo",
  "Asus",
  "Acer",
  "Logitech",
  "Minimalist",
  "Titan",
  "Fastrack",
  "Casio",
  "Nike",
  "Puma",
  "Adidas",
];

/**
 * Clean up URL slug into a readable title.
 * e.g., "soundcore-Anker-Bluetooth-Headphones-Cancellation" -> "Soundcore Anker Bluetooth Headphones Cancellation"
 */
function cleanSlugToTitle(slug: string): string {
  const words = slug
    .replace(/[_-]+/g, " ")
    .replace(/\b(dp|gp|product|ref)\b.*$/i, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^[0-9a-f]{8,}$/i.test(w));

  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Extract brand from text or title using known brand list.
 */
function detectBrand(text: string): string | null {
  const lower = text.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`\\b${brand.toLowerCase()}\\b`, "i").test(lower)) {
      return brand;
    }
  }
  return null;
}

/**
 * Detect model designation (e.g. Q20i, WH-1000XM5, A3004, M3).
 */
function detectModel(text: string): string | null {
  const m = text.match(/\b([A-Z]{1,4}[- ]?[0-9]{3,5}[A-Z0-9]*|Q[0-9]{2}[a-z]?|M[1-4]|iPhone\s+[0-9]{1,2}(?:\s+Pro(?:\s+Max)?)?)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Detect high-level category from text keywords.
 */
function detectCategory(text: string): string {
  const q = text.toLowerCase();
  if (
    q.includes("headphone") ||
    q.includes("earphone") ||
    q.includes("headset") ||
    q.includes("audio") ||
    q.includes("earbuds") ||
    q.includes("tws") ||
    q.includes("soundbar") ||
    q.includes("speaker") ||
    q.includes("airdopes") ||
    q.includes("airpod") ||
    q.includes("cancelling") ||
    /\b(wh|wf)-[0-9]+/i.test(q)
  ) {
    return "Audio";
  }
  if (q.includes("laptop") || q.includes("macbook") || q.includes("notebook") || q.includes("computer") || q.includes("pc")) {
    return "Computers";
  }
  if (q.includes("phone") || q.includes("iphone") || q.includes("mobile") || q.includes("pixel") || q.includes("smartphone")) {
    return "Mobile Phones";
  }
  if (q.includes("refrigerator") || q.includes("fridge") || q.includes("washing machine") || q.includes("microwave") || q.includes("appliance")) {
    return "Appliances";
  }
  if (q.includes("watch") || q.includes("smartwatch") || q.includes("timepiece")) {
    return "Wearables";
  }
  if (q.includes("cream") || q.includes("sunscreen") || q.includes("lotion") || q.includes("serum") || q.includes("skincare")) {
    return "Personal Care";
  }
  if (q.includes("shoe") || q.includes("sneaker") || q.includes("footwear")) {
    return "Footwear";
  }
  return "Electronics";
}

/**
 * Resolves product details and photo from a product link URL.
 * Never throws — always returns a safe, structured object.
 */
export async function resolveProductLink(
  rawUrl: string,
  fallbackKeywords?: string | null,
): Promise<ProductLinkResolution> {
  const trimmed = rawUrl.trim();
  const emptyResult: ProductLinkResolution = {
    url: trimmed,
    sourceUrl: trimmed,
    marketplace: "Web",
    asin: null,
    title: null,
    brand: null,
    model: null,
    category: "Electronics",
    price: null,
    seller: null,
    imageUrl: null,
    imageUrls: [],
  };

  if (!trimmed) return emptyResult;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return emptyResult;
  }

  const host = parsed.hostname.toLowerCase();
  let marketplace = "Online Store";
  let asin: string | null = null;
  let titleFromSlug: string | null = null;
  let canonicalUrl = trimmed;

  // 1. Amazon Resolution
  if (/amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp)$/i.test(host)) {
    asin = extractAsin(trimmed);
    const domain = extractMarketplace(trimmed).replace(/^www\./i, "");
    marketplace = domain.charAt(0).toUpperCase() + domain.slice(1);

    if (asin) {
      canonicalUrl = `https://www.${domain}/dp/${asin}`;
    }

    // Parse product slug from path before /dp/
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const dpIdx = pathParts.findIndex((p) => p.toLowerCase() === "dp" || p.toLowerCase() === "product");
    if (dpIdx > 0) {
      titleFromSlug = cleanSlugToTitle(pathParts[dpIdx - 1]);
    } else if (pathParts.length > 0 && !pathParts[0].startsWith("B0")) {
      titleFromSlug = cleanSlugToTitle(pathParts[0]);
    }
  } else if (/flipkart\.com$/i.test(host)) {
    marketplace = "Flipkart";
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      titleFromSlug = cleanSlugToTitle(pathParts[0]);
    }
  } else if (/meesho\.com$/i.test(host)) {
    marketplace = "Meesho";
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      titleFromSlug = cleanSlugToTitle(pathParts[0]);
    }
  } else {
    marketplace = host.replace(/^www\./i, "");
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      titleFromSlug = cleanSlugToTitle(pathParts[pathParts.length - 1]);
    }
  }

  // Combine title clues
  const effectiveTitle = titleFromSlug || fallbackKeywords || null;
  const brand = effectiveTitle ? detectBrand(effectiveTitle) : null;
  const model = effectiveTitle ? detectModel(effectiveTitle) : null;
  const category = effectiveTitle ? detectCategory(effectiveTitle) : "Electronics";

  return {
    url: trimmed,
    sourceUrl: canonicalUrl,
    marketplace,
    asin,
    title: effectiveTitle,
    brand,
    model,
    category,
    price: null,
    seller: marketplace.includes("Amazon") ? "Amazon Retail" : marketplace,
    imageUrl: null,
    imageUrls: [],
  };
}
