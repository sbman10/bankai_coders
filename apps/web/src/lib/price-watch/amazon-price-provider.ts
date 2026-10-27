import { AmazonAdapter, amazonAdapter } from "../platforms/amazon-adapter";
import type { PriceInfo, AvailabilityInfo, NormalizedProductQuote, ScrapedContent } from "../platforms/platform.types";
import { defaultFirecrawlClient } from "../firecrawl/firecrawl-client";
import { extractAsin } from "@/lib/amazon/asin";

export * from "../platforms/amazon-adapter";

export class AmazonAccessError extends Error {
  constructor(message = "Failed to access Amazon page") {
    super(message);
    this.name = "AmazonAccessError";
  }
}

export class InvalidAmazonUrlError extends Error {
  constructor(message = "Invalid Amazon URL provided") {
    super(message);
    this.name = "InvalidAmazonUrlError";
  }
}

export class PriceUnavailableError extends Error {
  constructor(message = "Price is unavailable for this product") {
    super(message);
    this.name = "PriceUnavailableError";
  }
}

export class UnsupportedPlatformError extends Error {
  constructor(message = "Platform is not supported by Amazon price provider") {
    super(message);
    this.name = "UnsupportedPlatformError";
  }
}

export interface AmazonPriceResult {
  price: number;
  currentPrice: number;
  mrp?: number | null;
  currency: string;
  isAvailable: boolean;
  inStock: boolean;
  availability: string;
  asin?: string | null;
  title?: string | null;
  url: string;
  timestamp: string;
}

export class AmazonPriceProvider extends AmazonAdapter {
  async getAmazonPrice(url: string): Promise<AmazonPriceResult> {
    if (!url || typeof url !== "string") {
      throw new InvalidAmazonUrlError("URL is required and must be a string");
    }

    let parsed: URL;
    try {
      parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      throw new InvalidAmazonUrlError(`Invalid URL structure: ${url}`);
    }

    const host = parsed.hostname.toLowerCase();
    const isAmazon =
      /(?:^|\.)amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp)$/i.test(host) ||
      /(?:^|\.)amzn\.(in|to)$/i.test(host);

    if (!isAmazon) {
      if (/(?:flipkart|croma|meesho|myntra|nykaa)/i.test(host)) {
        throw new UnsupportedPlatformError(`Unsupported platform for Amazon provider: ${host}`);
      }
      throw new InvalidAmazonUrlError(`Not an Amazon URL: ${url}`);
    }

    const asin = extractAsin(url);

    let scrape;
    try {
      scrape = await defaultFirecrawlClient.scrapeUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to scrape Amazon product page";
      throw new AmazonAccessError(msg);
    }

    if (scrape.statusCode === 404 || scrape.statusCode >= 500) {
      throw new AmazonAccessError(`Amazon returned status code ${scrape.statusCode}`);
    }

    const scrapedContent: ScrapedContent = {
      html: scrape.html,
      markdown: scrape.markdown,
      statusCode: scrape.statusCode,
    };

    const priceInfo = this.extractPrice(scrapedContent);
    const availabilityInfo = this.extractAvailability(scrapedContent);
    const identity = this.extractCanonicalIdentity(scrapedContent, url);

    if (!priceInfo || priceInfo.current === null || priceInfo.current === undefined) {
      throw new PriceUnavailableError(`No current selling price available for ASIN ${asin || url}`);
    }

    const isAvailable = availabilityInfo.status === "IN_STOCK";

    return {
      price: priceInfo.current,
      currentPrice: priceInfo.current,
      mrp: priceInfo.mrp ?? null,
      currency: priceInfo.currency || "INR",
      isAvailable,
      inStock: isAvailable,
      availability: availabilityInfo.status,
      asin: identity.productIdentifier || asin || null,
      title: identity.cleanTitle || null,
      url,
      timestamp: new Date().toISOString(),
    };
  }

  async getPrice(url: string): Promise<PriceInfo | null> {
    const scrape = await defaultFirecrawlClient.scrapeUrl(url);
    return this.extractPrice({
      html: scrape.html,
      markdown: scrape.markdown,
      statusCode: scrape.statusCode,
    });
  }

  async getQuote(url: string): Promise<NormalizedProductQuote> {
    const scrape = await defaultFirecrawlClient.scrapeUrl(url);
    return this.normalize(
      {
        html: scrape.html,
        markdown: scrape.markdown,
        statusCode: scrape.statusCode,
      },
      url
    );
  }
}

export const amazonPriceProvider = new AmazonPriceProvider();
export default amazonPriceProvider;
