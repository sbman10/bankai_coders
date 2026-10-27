import { firecrawlCache, type CachedScrapeResult } from "./cache";

export interface ScrapeOptions {
  forceRefresh?: boolean;
  formats?: ("markdown" | "html")[];
  timeoutMs?: number;
  waitForSelector?: string;
}

export interface ScrapeAuditLog {
  timestamp: string;
  url: string;
  statusCode: number;
  success: boolean;
  source: "cache" | "firecrawl_api" | "fallback_fetch";
  estimatedCredits: number;
  durationMs: number;
  errorMessage?: string;
}

export interface FirecrawlScrapeResponse {
  markdown: string;
  html?: string;
  statusCode: number;
  cached: boolean;
  auditLog: ScrapeAuditLog;
}

export interface FirecrawlSearchResult {
  url: string;
  title: string;
  description?: string;
}

export interface FirecrawlSearchResponse {
  results: FirecrawlSearchResult[];
  cached: boolean;
  auditLog: ScrapeAuditLog;
}

// In-memory audit log for monitoring credit consumption
const auditLogs: ScrapeAuditLog[] = [];

export function getScrapeAuditLogs(): readonly ScrapeAuditLog[] {
  return auditLogs;
}

export function getTotalCreditsConsumed(): number {
  return auditLogs.reduce((acc, log) => acc + log.estimatedCredits, 0);
}

export class FirecrawlClient {
  private apiKey: string | null;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = "https://api.firecrawl.dev/v1") {
    this.apiKey = apiKey || process.env.FIRECRAWL_API_KEY || null;
    this.baseUrl = baseUrl;
  }

  /**
   * Scrapes a URL through Firecrawl with strict caching, credit conservation,
   * max 1 retry, and deterministic audit logging.
   */
  async scrapeUrl(url: string, options: ScrapeOptions = {}): Promise<FirecrawlScrapeResponse> {
    const startTime = Date.now();
    const { forceRefresh = false, formats = ["markdown", "html"], timeoutMs = 20000 } = options;

    // 1. Check Cache first unless forceRefresh is true
    if (!forceRefresh) {
      const cached = firecrawlCache.get(url);
      if (cached) {
        const audit: ScrapeAuditLog = {
          timestamp: new Date().toISOString(),
          url,
          statusCode: cached.statusCode,
          success: true,
          source: "cache",
          estimatedCredits: 0,
          durationMs: Date.now() - startTime,
        };
        auditLogs.push(audit);
        return {
          markdown: cached.markdown,
          html: cached.html,
          statusCode: cached.statusCode,
          cached: true,
          auditLog: audit,
        };
      }
    }

    const apiKey = this.apiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not configured on the server.");
    }

    // 2. Perform Firecrawl scrape with max 1 retry
    let lastError: Error | null = null;
    const maxAttempts = 2; // initial + max 1 retry

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${this.baseUrl}/scrape`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            url,
            formats,
            onlyMainContent: false, // needed to preserve buy box, price widgets, and stock indicators
            waitFor: 1000,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          throw new Error(`Firecrawl API error (status ${response.status}): ${errBody || response.statusText}`);
        }

        const data = await response.json();
        const content = data?.data || data;
        const markdown = content?.markdown || "";
        const html = content?.html || "";

        // Standard Firecrawl scrape costs 1 credit
        const estimatedCredits = 1;
        const audit: ScrapeAuditLog = {
          timestamp: new Date().toISOString(),
          url,
          statusCode: response.status,
          success: true,
          source: "firecrawl_api",
          estimatedCredits,
          durationMs: Date.now() - startTime,
        };
        auditLogs.push(audit);

        // Cache the result
        firecrawlCache.set(url, {
          url,
          markdown,
          html,
          statusCode: response.status,
          source: "firecrawl",
        });

        return {
          markdown,
          html,
          statusCode: response.status,
          cached: false,
          auditLog: audit,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // If first attempt failed, log and attempt retry once if not aborted by timeout
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // If both attempts failed, record audit and throw
    const failedAudit: ScrapeAuditLog = {
      timestamp: new Date().toISOString(),
      url,
      statusCode: 500,
      success: false,
      source: "firecrawl_api",
      estimatedCredits: 0,
      durationMs: Date.now() - startTime,
      errorMessage: lastError?.message,
    };
    auditLogs.push(failedAudit);

    throw new Error(`Failed to scrape ${url} with Firecrawl: ${lastError?.message}`);
  }

  /**
   * Searches web sources through Firecrawl with strict caching, credit conservation,
   * max 1 retry, and deterministic audit logging.
   */
  async search(
    query: string,
    options: { limit?: number; forceRefresh?: boolean; timeoutMs?: number } = {}
  ): Promise<FirecrawlSearchResponse> {
    const startTime = Date.now();
    const { limit = 3, forceRefresh = false, timeoutMs = 20000 } = options;

    if (!forceRefresh) {
      const cached = firecrawlCache.getSearch(query);
      if (cached) {
        const audit: ScrapeAuditLog = {
          timestamp: new Date().toISOString(),
          url: `search:${query}`,
          statusCode: 200,
          success: true,
          source: "cache",
          estimatedCredits: 0,
          durationMs: Date.now() - startTime,
        };
        auditLogs.push(audit);
        return {
          results: cached.results.slice(0, limit),
          cached: true,
          auditLog: audit,
        };
      }
    }

    const apiKey = this.apiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not configured on the server.");
    }

    let lastError: Error | null = null;
    const maxAttempts = 2; // initial + max 1 retry

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${this.baseUrl}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            limit,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          throw new Error(`Firecrawl Search API error (status ${response.status}): ${errBody || response.statusText}`);
        }

        const data = await response.json();
        const rawResults = data?.data || data?.results || [];
        const results: FirecrawlSearchResult[] = (Array.isArray(rawResults) ? rawResults : [])
          .map((r: any) => ({
            url: r.url || "",
            title: r.title || "",
            description: r.description || r.markdown || undefined,
          }))
          .filter((r: FirecrawlSearchResult) => r.url.length > 0);

        const audit: ScrapeAuditLog = {
          timestamp: new Date().toISOString(),
          url: `search:${query}`,
          statusCode: response.status,
          success: true,
          source: "firecrawl_api",
          estimatedCredits: 1,
          durationMs: Date.now() - startTime,
        };
        auditLogs.push(audit);

        firecrawlCache.setSearch(query, results);

        return {
          results,
          cached: false,
          auditLog: audit,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    const failedAudit: ScrapeAuditLog = {
      timestamp: new Date().toISOString(),
      url: `search:${query}`,
      statusCode: 500,
      success: false,
      source: "firecrawl_api",
      estimatedCredits: 0,
      durationMs: Date.now() - startTime,
      errorMessage: lastError?.message,
    };
    auditLogs.push(failedAudit);

    throw new Error(`Failed to search "${query}" with Firecrawl: ${lastError?.message}`);
  }
}

export const defaultFirecrawlClient = new FirecrawlClient();
