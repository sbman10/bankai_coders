import type { CanonicalProductIdentity, ScrapedContent, SupportedStorePlatform } from "../platforms/platform.types";
import { extractAsin } from "@/lib/amazon/asin";
import { extractFlipkartPid } from "../platforms/flipkart-adapter";

export type ScraperFailureReason =
  | "PAGE_ACQUISITION_FAILED"
  | "PRODUCT_ID_NOT_FOUND"
  | "MODEL_NOT_FOUND"
  | "PRICE_NOT_FOUND"
  | "PRICE_VALIDATION_FAILED"
  | "AVAILABILITY_UNKNOWN"
  | "VARIANT_MISMATCH"
  | "MATCH_CONFIDENCE_TOO_LOW"
  | "CANDIDATE_NOT_FOUND"
  | "WRONG_PRODUCT_RETURNED"
  | "CAPTCHA_OR_BLOCKED"
  | "INVALID_PRODUCT_PAGE";

export interface ScraperDiagnosticLog {
  platform: SupportedStorePlatform;
  inputUrl: string;
  normalizedUrl: string;
  acquisitionSuccess: boolean;
  extractionSuccess: boolean;
  productIdentifier?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: Record<string, any>;
  price?: number | null;
  availability?: string;
  matchConfidence?: number;
  failureReason?: ScraperFailureReason | string;
  timestamp: string;
}

// In-memory diagnostic ring buffer for internal inspection
const MAX_LOGS = 100;
const diagnosticLogs: ScraperDiagnosticLog[] = [];

export function recordScraperDiagnostic(entry: Omit<ScraperDiagnosticLog, "timestamp">): ScraperDiagnosticLog {
  const completeLog: ScraperDiagnosticLog = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  if (diagnosticLogs.length >= MAX_LOGS) {
    diagnosticLogs.shift();
  }
  diagnosticLogs.push(completeLog);

  // Structured internal logging for observability without exposing verbose debug UI to user
  if (process.env.NODE_ENV !== "test") {
    console.info(`[SCRAPER_DIAGNOSTIC] [${completeLog.platform}] ${completeLog.normalizedUrl} - success:${completeLog.extractionSuccess}${completeLog.failureReason ? ` failure:${completeLog.failureReason}` : ""}`);
  }

  return completeLog;
}

export function getRecentScraperDiagnostics(): ScraperDiagnosticLog[] {
  return [...diagnosticLogs];
}

export function clearScraperDiagnostics(): void {
  diagnosticLogs.length = 0;
}

/**
 * Extracts the product identifier directly from a URL.
 */
export function extractIdentifierFromUrl(url: string, platform: SupportedStorePlatform): string | null {
  if (!url) return null;
  try {
    let clean = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(clean)) {
      clean = `https://${clean}`;
    }
    const parsed = new URL(clean);

    if (platform === "Amazon") {
      return extractAsin(url);
    }

    if (platform === "Flipkart") {
      return extractFlipkartPid(url);
    }

    if (platform === "Croma") {
      // Croma: .../p/(\d+) or pid=(\d+)
      const pidParam = parsed.searchParams.get("pid");
      if (pidParam) return pidParam.trim();
      const match = parsed.pathname.match(/\/p\/(\d+)/i) || parsed.pathname.match(/\/(\d{5,8})(?:[/?#]|$)/);
      if (match) return match[1];
      return null;
    }

    if (platform === "Meesho") {
      // Meesho: meesho.com/p/([a-zA-Z0-9_-]+) or meesho.com/s/p/([a-zA-Z0-9_-]+)
      const match = parsed.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/i);
      if (match) return match[1];
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates that an extracted canonical identity actually belongs to the requested URL.
 * Prevents wrong products from being silently substituted.
 */
export function validateExtractedIdentityAgainstUrl(
  requestedUrl: string,
  extracted: CanonicalProductIdentity,
  content?: ScrapedContent
): { isValid: boolean; failureReason?: ScraperFailureReason; message?: string } {
  const urlId = extractIdentifierFromUrl(requestedUrl, extracted.platform);
  const extractedId = extracted.productIdentifier || extracted.sku;

  // 1. CAPTCHA or Robot block check
  const textToCheck = `${content?.markdown || ""} ${content?.html || ""}`.toLowerCase();
  if (
    textToCheck.includes("enter the characters you see below") ||
    textToCheck.includes("type the characters above") ||
    textToCheck.includes("robot check") ||
    textToCheck.includes("automated access")
  ) {
    return {
      isValid: false,
      failureReason: "CAPTCHA_OR_BLOCKED",
      message: "Scraping acquisition was intercepted by a bot challenge or captcha.",
    };
  }

  // 2. Generic Home or Category page check
  const title = (extracted.cleanTitle || extracted.rawTitle || "").trim().toLowerCase();
  if (
    !title ||
    title.includes("online shopping site for mobiles") ||
    title.includes("explore plus") ||
    title.includes("page not found") ||
    title.includes("something went wrong") ||
    title.includes("hamburger menu")
  ) {
    return {
      isValid: false,
      failureReason: "INVALID_PRODUCT_PAGE",
      message: "The page did not return a valid individual product page.",
    };
  }

  // 3. ID Comparison if URL identifier is present
  if (urlId && extractedId) {
    const normUrlId = urlId.trim().toUpperCase();
    const normExtractedId = extractedId.trim().toUpperCase();
    if (normUrlId !== normExtractedId) {
      return {
        isValid: false,
        failureReason: "WRONG_PRODUCT_RETURNED",
        message: `Identity mismatch: Requested URL identifier '${normUrlId}' does not match extracted identity '${normExtractedId}'.`,
      };
    }
  }

  return { isValid: true };
}
