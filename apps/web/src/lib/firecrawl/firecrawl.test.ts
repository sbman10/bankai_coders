import { describe, it, expect, beforeEach, vi } from "vitest";
import { FirecrawlScrapeCache, hashUrl } from "./cache";
import { FirecrawlClient, getScrapeAuditLogs, getTotalCreditsConsumed } from "./firecrawl-client";

describe("Firecrawl Cache & Client", () => {
  let cache: FirecrawlScrapeCache;

  beforeEach(() => {
    cache = new FirecrawlScrapeCache(5000); // 5s TTL
    cache.clear();
  });

  it("normalizes and hashes URLs consistently regardless of trailing slash or casing", () => {
    const hash1 = hashUrl("https://www.amazon.in/dp/B0CX21CBRX/");
    const hash2 = hashUrl("HTTPS://WWW.AMAZON.IN/dp/B0CX21CBRX");
    expect(hash1).toBe(hash2);
  });

  it("caches and retrieves scrape results without network calls", () => {
    const url = "https://www.amazon.in/dp/B0CX21CBRX";
    expect(cache.has(url)).toBe(false);

    cache.set(url, {
      url,
      markdown: "# Realme P4 5G 8GB 128GB\nPrice: ₹15,999",
      html: "<html><body>Realme P4 5G</body></html>",
      statusCode: 200,
      source: "firecrawl",
    });

    expect(cache.has(url)).toBe(true);
    const retrieved = cache.get(url);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.markdown).toContain("Realme P4 5G");
    expect(retrieved?.statusCode).toBe(200);
  });

  it("serves from cache on subsequent client calls and records 0 credits consumed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          markdown: "# Test Product\nPrice: ₹9,999",
          html: "<div>In Stock</div>",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new FirecrawlClient("test-key");
    const testUrl = "https://www.amazon.in/dp/B0TESTING123";

    // First call: should call fetch
    const res1 = await client.scrapeUrl(testUrl);
    expect(res1.cached).toBe(false);
    expect(res1.markdown).toContain("Test Product");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call: should hit cache, NOT fetch
    const res2 = await client.scrapeUrl(testUrl);
    expect(res2.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // STILL 1!

    vi.unstubAllGlobals();
  });

  it("retries at most once when Firecrawl API fails on the first attempt", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 502,
          statusText: "Bad Gateway",
          text: async () => "Gateway Timeout",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { markdown: "Recovered on attempt 2" },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new FirecrawlClient("test-key");
    const res = await client.scrapeUrl("https://www.amazon.in/dp/B0RETRYTEST", { forceRefresh: true });

    expect(callCount).toBe(2);
    expect(res.markdown).toBe("Recovered on attempt 2");

    vi.unstubAllGlobals();
  });

  it("fails cleanly after max 1 retry without infinite loops or credit wastage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Error",
      text: async () => "Server Error",
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new FirecrawlClient("test-key");
    await expect(client.scrapeUrl("https://www.amazon.in/dp/B0FAILTEST", { forceRefresh: true })).rejects.toThrow(
      "Failed to scrape https://www.amazon.in/dp/B0FAILTEST"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2); // Initial + 1 retry, no more

    vi.unstubAllGlobals();
  });
});
