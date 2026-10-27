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

export interface AmazonPriceRequestOptions {
  htmlOverride?: string;
  markdownOverride?: string;
  forceRefresh?: boolean;
  [key: string]: unknown;
}

export interface AmazonPriceInputObject {
  url?: string;
  asin?: string;
  options?: AmazonPriceRequestOptions;
}

export type AmazonPriceInput = string | AmazonPriceInputObject;

export interface AmazonPriceResult {
  platform: "Amazon" | string;
  productId: string;
  productUrl: string;
  productName: string;
  price: number;
  currentPrice: number;
  mrp: number | null;
  currency: string;
  isAvailable: boolean;
  inStock: boolean;
  availability: string;
  seller: string | null;
  imageUrl: string | null;
  checkedAt: string;
  asin?: string | null;
  title?: string | null;
  url?: string;
  timestamp?: string;
}

export class AmazonPriceProvider extends AmazonAdapter {
  async getAmazonPrice(
    input: AmazonPriceInput,
    options?: AmazonPriceRequestOptions
  ): Promise<AmazonPriceResult> {
    let targetUrl = "";
    let targetAsin: string | null = null;
    let effectiveOptions: AmazonPriceRequestOptions = { ...options };

    if (typeof input === "string") {
      targetUrl = input.trim();
    } else if (input && typeof input === "object") {
      if (input.options) {
        effectiveOptions = { ...effectiveOptions, ...input.options };
      }
      if (typeof input.url === "string") {
        targetUrl = input.url.trim();
      }
      if (typeof input.asin === "string") {
        targetAsin = input.asin.trim();
        if (!targetUrl) {
          targetUrl = `https://www.amazon.in/dp/${targetAsin}`;
        }
      }
    }

    if (!targetUrl && !targetAsin) {
      throw new InvalidAmazonUrlError("URL or ASIN is required");
    }

    // If an ASIN is given as string e.g. "B0H3LKPC2K"
    if (/^[A-Z0-9]{10}$/i.test(targetUrl) && !targetUrl.includes(".")) {
      targetAsin = targetUrl;
      targetUrl = `https://www.amazon.in/dp/${targetAsin}`;
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`);
    } catch {
      throw new InvalidAmazonUrlError(`Invalid URL structure: ${targetUrl}`);
    }

    const host = parsed.hostname.toLowerCase();
    const isAmazon =
      /(?:^|\.)amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp)$/i.test(host) ||
      /(?:^|\.)amzn\.(in|to)$/i.test(host);

    if (!isAmazon) {
      if (/(?:flipkart|croma|meesho|myntra|nykaa|reliance|tatacliq)/i.test(host)) {
        throw new UnsupportedPlatformError(`Unsupported platform for Amazon provider: ${host}`);
      }
      throw new InvalidAmazonUrlError(`Not an Amazon URL: ${targetUrl}`);
    }

    const asin = targetAsin || extractAsin(targetUrl);

    let html = "";
    let markdown = "";
    let statusCode = 200;

    if (effectiveOptions.htmlOverride) {
      html = effectiveOptions.htmlOverride;
      markdown = effectiveOptions.markdownOverride || "";
      statusCode = 200;

      // Check if htmlOverride simulates a 404 or captcha block
      if (html.includes("Robot Check") || html.includes("Type the characters you see")) {
        throw new AmazonAccessError("Amazon access blocked by bot detection challenge");
      }
      if (html.includes("Page Not Found") || html.includes("Looking for something?")) {
        throw new AmazonAccessError("Amazon page not found (404)");
      }
    } else {
      let scrape;
      try {
        scrape = await defaultFirecrawlClient.scrapeUrl(targetUrl, {
          forceRefresh: effectiveOptions.forceRefresh,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to scrape Amazon product page";
        throw new AmazonAccessError(msg);
      }

      if (scrape.statusCode === 404 || scrape.statusCode >= 500) {
        throw new AmazonAccessError(`Amazon returned status code ${scrape.statusCode}`);
      }

      html = scrape.html || "";
      markdown = scrape.markdown || "";
      statusCode = scrape.statusCode;
    }

    const scrapedContent: ScrapedContent = {
      html,
      markdown,
      statusCode,
    };

    const priceInfo = this.extractPrice(scrapedContent);
    const availabilityInfo = this.extractAvailability(scrapedContent);
    const identity = this.extractCanonicalIdentity(scrapedContent, targetUrl);

    if (!priceInfo || priceInfo.current === null || priceInfo.current === undefined) {
      throw new PriceUnavailableError(`No current selling price available for ASIN ${asin || targetUrl}`);
    }

    const isAvailable = availabilityInfo.status === "IN_STOCK";
    const productId = asin || identity.productIdentifier || "";
    const productName = identity.cleanTitle || identity.rawTitle || "Amazon Product";
    const productUrl = targetUrl;
    const checkedAt = new Date().toISOString();
    const seller = identity.seller || "Amazon";
    const imageUrl = identity.imageUrl || null;

    return {
      platform: "Amazon",
      productId,
      productUrl,
      productName,
      price: priceInfo.current,
      currentPrice: priceInfo.current,
      mrp: priceInfo.mrp ?? null,
      currency: priceInfo.currency || "INR",
      isAvailable,
      inStock: isAvailable,
      availability: availabilityInfo.status,
      seller,
      imageUrl,
      checkedAt,
      asin: productId,
      title: productName,
      url: productUrl,
      timestamp: checkedAt,
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
