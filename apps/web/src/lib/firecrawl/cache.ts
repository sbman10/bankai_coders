import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface CachedScrapeResult {
  url: string;
  normalizedUrl: string;
  markdown: string;
  html?: string;
  statusCode: number;
  cachedAt: string;
  expiresAt: string;
  source: "firecrawl" | "local_fetch";
}

export interface CachedSearchResult {
  query: string;
  results: { url: string; title: string; description?: string }[];
  cachedAt: string;
  expiresAt: string;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const memoryCache = new Map<string, CachedScrapeResult>();
const searchMemoryCache = new Map<string, CachedSearchResult>();

function getCacheDir(subdir = "firecrawl"): string {
  const dir = path.resolve(process.cwd(), ".cache", subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function hashUrl(url: string): string {
  const normalized = url.trim().toLowerCase().replace(/\/$/, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export class FirecrawlScrapeCache {
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(url: string): CachedScrapeResult | null {
    const key = hashUrl(url);

    // 1. Check in-memory cache
    const memEntry = memoryCache.get(key);
    if (memEntry) {
      if (new Date(memEntry.expiresAt).getTime() > Date.now()) {
        return memEntry;
      }
      memoryCache.delete(key);
    }

    // 2. Check disk cache
    try {
      const filePath = path.join(getCacheDir(), `${key}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const entry: CachedScrapeResult = JSON.parse(raw);
        if (new Date(entry.expiresAt).getTime() > Date.now()) {
          memoryCache.set(key, entry);
          return entry;
        }
        // Expired, delete it
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    } catch {
      // Ignore disk read failures
    }

    return null;
  }

  set(url: string, result: Omit<CachedScrapeResult, "cachedAt" | "expiresAt" | "normalizedUrl">): CachedScrapeResult {
    const key = hashUrl(url);
    const now = Date.now();
    const entry: CachedScrapeResult = {
      ...result,
      normalizedUrl: url.trim().toLowerCase().replace(/\/$/, ""),
      cachedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
    };

    memoryCache.set(key, entry);

    try {
      const filePath = path.join(getCacheDir(), `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entry), "utf-8");
    } catch {
      // Non-fatal disk write error
    }

    return entry;
  }

  has(url: string): boolean {
    return this.get(url) !== null;
  }

  getSearch(query: string): CachedSearchResult | null {
    const key = `search_${hashUrl(query)}`;
    const mem = searchMemoryCache.get(key);
    if (mem) {
      if (new Date(mem.expiresAt).getTime() > Date.now()) {
        return mem;
      }
      searchMemoryCache.delete(key);
    }

    try {
      const filePath = path.join(getCacheDir("firecrawl-search"), `${key}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const entry: CachedSearchResult = JSON.parse(raw);
        if (new Date(entry.expiresAt).getTime() > Date.now()) {
          searchMemoryCache.set(key, entry);
          return entry;
        }
        try { fs.unlinkSync(filePath); } catch {}
      }
    } catch {}

    return null;
  }

  setSearch(query: string, results: { url: string; title: string; description?: string }[]): CachedSearchResult {
    const key = `search_${hashUrl(query)}`;
    const now = Date.now();
    const entry: CachedSearchResult = {
      query,
      results,
      cachedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
    };

    searchMemoryCache.set(key, entry);

    try {
      const filePath = path.join(getCacheDir("firecrawl-search"), `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entry), "utf-8");
    } catch {}

    return entry;
  }

  clear(): void {
    memoryCache.clear();
    searchMemoryCache.clear();
    try {
      for (const subdir of ["firecrawl", "firecrawl-search"]) {
        const dir = getCacheDir(subdir);
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            if (f.endsWith(".json")) {
              fs.unlinkSync(path.join(dir, f));
            }
          }
        }
      }
    } catch {}
  }
}

export const firecrawlCache = new FirecrawlScrapeCache();
