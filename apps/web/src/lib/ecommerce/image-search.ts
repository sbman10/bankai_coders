/**
 * Automated High-Resolution Product Image Search Service
 * Finds authentic, aesthetic catalog and retail product photos for products
 * added via invoice or manual entry.
 */

export interface ProductQueryInput {
  name: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
}

export interface ProductImageResult {
  imageUrl: string;
  title?: string;
  source: "retail_search" | "wikimedia" | "catalog";
}

// In-memory cache for fast repeated lookups (key: normalized query string)
const imageCache = new Map<string, ProductImageResult>();

export function clearImageSearchCache(): void {
  imageCache.clear();
}

/**
 * Strips noise, tax codes, parenthetical descriptions, and redundant brand tokens
 * to produce an optimal product search query.
 */
export function cleanSearchQuery(input: string | ProductQueryInput): string {
  let name = "";
  let brand = "";
  let model = "";

  if (typeof input === "string") {
    name = input;
  } else {
    name = input.name || "";
    brand = input.brand || "";
    model = input.model || "";
  }

  // Remove parenthetical details like (Luscious Black, 15H Playback)
  let cleanName = name.replace(/\([^)]*\)/g, " ");

  // Remove common invoice keywords and noise patterns
  cleanName = cleanName.replace(
    /\b(qty|quantity|item|sku|hsn|inv|invoice|order|mrp|rs|inr|tax|gst|inclusive|model)\b[:0-9.\s-]*/gi,
    " "
  );

  // Avoid duplicating brand if name already starts with brand
  if (brand && cleanName.toLowerCase().startsWith(brand.toLowerCase())) {
    cleanName = cleanName.slice(brand.length).trim();
  }

  const parts = [brand, cleanName, model]
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = parts.join(" ").replace(/\s+/g, " ").trim();

  // Keep first 8 words max for search precision
  const words = merged.split(" ").slice(0, 8);
  return words.join(" ");
}

/**
 * Searches for an authentic product photo using Bing Product Images.
 */
async function searchBingImages(cleanQuery: string): Promise<ProductImageResult | null> {
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(cleanQuery + " product")}&form=HDRSC2`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Bing embeds high-res image metadata in: m="{&quot;murl&quot;:&quot;https://...&quot;,&quot;t&quot;:&quot;...&quot;}"
    const murlMatches = [...html.matchAll(/murl&quot;:&quot;(https:[^&]+)&quot;/g)];
    if (!murlMatches || murlMatches.length === 0) return null;

    // Filter for clean retail/photo image URLs (prefer Amazon, Flipkart, CDN, clean extensions)
    const validImage = murlMatches.find((m) => {
      const u = m[1].toLowerCase();
      if (u.includes(".svg") || u.includes(".gif") || u.includes("placeholder") || u.includes("blank")) {
        return false;
      }
      return (
        u.includes("media-amazon.com") ||
        u.includes("flipkart") ||
        u.includes("images") ||
        u.endsWith(".jpg") ||
        u.endsWith(".jpeg") ||
        u.endsWith(".png") ||
        u.endsWith(".webp")
      );
    });

    const chosenUrl = validImage ? validImage[1] : murlMatches[0][1];
    return {
      imageUrl: chosenUrl,
      source: "retail_search",
    };
  } catch {
    return null;
  }
}

/**
 * Fallback search via Wikimedia Commons for generic items.
 */
async function searchWikimediaFallback(cleanQuery: string): Promise<ProductImageResult | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanQuery
    )}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;

    const res = await fetch(url, {
      headers: { "User-Agent": "ProductVault/1.0 (support@claimforge.app)" },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {});

    for (const p of pages as Array<{ title?: string; imageinfo?: Array<{ thumburl?: string; url?: string }> }>) {
      const title = (p.title || "").toLowerCase();
      if (title.endsWith(".pdf") || title.endsWith(".webm") || title.endsWith(".svg") || title.includes("nebula")) {
        continue;
      }
      const info = p.imageinfo?.[0];
      const img = info?.thumburl || info?.url;
      if (img && img.startsWith("https://")) {
        return {
          imageUrl: img,
          title: p.title,
          source: "wikimedia",
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Main public entrypoint: Searches for the top matching image for any product.
 * Returns null safely if no image is found or if a network error occurs.
 */
export async function searchProductImage(
  input: string | ProductQueryInput
): Promise<ProductImageResult | null> {
  const query = cleanSearchQuery(input);
  if (!query) return null;

  const cacheKey = query.toLowerCase();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  // 1. Primary: Retail / Bing Image Search
  let result = await searchBingImages(query);

  // 2. Fallback: Wikimedia Commons
  if (!result) {
    result = await searchWikimediaFallback(query);
  }

  // 3. Fallback: If query had 3+ words, retry with simplified first 2 words (core noun)
  if (!result && query.split(" ").length > 2) {
    const simplified = query.split(" ").slice(0, 2).join(" ");
    result = await searchBingImages(simplified);
    if (!result) {
      result = await searchWikimediaFallback(simplified);
    }
  }

  if (result) {
    imageCache.set(cacheKey, result);
  }

  return result;
}

