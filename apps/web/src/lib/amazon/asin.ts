/**
 * Amazon ASIN utilities — pure, deterministic, no external I/O.
 *
 * ASIN format: exactly 10 characters, starts with B0, or numeric-only
 * (B0-style ASINs are most common; numeric ASINs appear for books/ISBNs).
 * We validate the extracted token with a known-good regex before trusting it.
 */

export const ASIN_RE = /^[A-Z0-9]{10}$/;

/**
 * Patterns that appear in Amazon URLs immediately before the ASIN segment.
 * Order matters — more-specific patterns first.
 */
const PATH_PATTERNS = [
  // /dp/ASIN  or  /gp/product/ASIN
  /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i,
  // /product/ASIN
  /\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
  // ?ASIN=…  query param (rare, but present in some affiliate links)
  /[?&]ASIN=([A-Z0-9]{10})(?:&|$)/i,
];

const AMAZON_HOSTS = /^(?:www\.)?(?:amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp)|amzn\.(in|to))$/i;

/**
 * Returns the ASIN if `rawUrl` is a valid Amazon product URL, or null otherwise.
 * Never throws.
 */
export function extractAsin(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let parsed: URL;
  try {
    let clean = rawUrl.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(clean)) {
      clean = `https://${clean}`;
    }
    parsed = new URL(clean);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.toLowerCase();
  const isAmazonHost = AMAZON_HOSTS.test(host);

  // If host is not a direct Amazon host, check if it's an ad redirect or tracking URL containing an Amazon product URL
  if (!isAmazonHost) {
    const urlParam = parsed.searchParams.get("url") || parsed.searchParams.get("adUrl") || parsed.searchParams.get("targetUrl");
    if (urlParam) {
      return extractAsin(urlParam);
    }
    return null;
  }

  // 1. Direct path check
  const path = parsed.pathname + parsed.search;
  for (const re of PATH_PATTERNS) {
    const match = path.match(re);
    if (match && ASIN_RE.test(match[1].toUpperCase())) {
      return match[1].toUpperCase();
    }
  }

  // 2. Decoded search params (e.g. picassoRedirect with url=%2F...%2Fdp%2FB09453J4ST)
  try {
    const decodedSearch = decodeURIComponent(parsed.search);
    for (const re of PATH_PATTERNS) {
      const match = decodedSearch.match(re);
      if (match && ASIN_RE.test(match[1].toUpperCase())) {
        return match[1].toUpperCase();
      }
    }
  } catch {}

  // 3. Embedded url parameter check
  const embeddedUrl = parsed.searchParams.get("url") || parsed.searchParams.get("adUrl");
  if (embeddedUrl) {
    const subAsin = extractAsin(embeddedUrl);
    if (subAsin) return subAsin;
  }

  return null;
}

/**
 * Normalizes an Amazon URL into a clean canonical product URL:
 * https://www.amazon.in/dp/<ASIN>
 *
 * Strips advertising redirects, sponsored click tracking (picassoRedirect),
 * query parameters, affiliate tags, and ad-system references.
 * Ensures an advertising domain (e.g. aax-eu.amazon-adsystem.com) NEVER becomes the product URL.
 */
export function canonicalizeAmazonUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  const asin = extractAsin(trimmed);
  if (!asin) return trimmed;

  try {
    let clean = trimmed;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(clean)) {
      clean = `https://${clean}`;
    }
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase();

    // Never use advertising domains as the canonical host
    if (host.includes("amazon-adsystem") || host.includes("adsystem")) {
      return `https://www.amazon.in/dp/${asin}`;
    }

    // Preserve regional amazon store if valid, otherwise default to amazon.in
    const amazonMatch = host.match(/(?:^|\.)(amazon\.(?:in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp))$/i);
    const domain = amazonMatch ? amazonMatch[1] : "amazon.in";
    return `https://www.${domain}/dp/${asin}`;
  } catch {
    return `https://www.amazon.in/dp/${asin}`;
  }
}

/**
 * Detects the Amazon locale from the URL hostname.
 * Returns the marketplace identifier used by PA-API (e.g. "www.amazon.in").
 */
export function extractMarketplace(rawUrl: string): string {
  try {
    const { hostname } = new URL(rawUrl.trim());
    // normalise: ensure www. prefix
    return hostname.startsWith("www.") ? hostname : `www.${hostname}`;
  } catch {
    return "www.amazon.in";
  }
}

