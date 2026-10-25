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

const AMAZON_HOSTS = /^(?:www\.)?amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp)$/i;

/**
 * Returns the ASIN if `rawUrl` is a valid Amazon product URL, or null otherwise.
 * Never throws.
 */
export function extractAsin(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!AMAZON_HOSTS.test(parsed.hostname)) return null;

  const path = parsed.pathname + parsed.search;
  for (const re of PATH_PATTERNS) {
    const match = path.match(re);
    if (match && ASIN_RE.test(match[1].toUpperCase())) {
      return match[1].toUpperCase();
    }
  }

  return null;
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
