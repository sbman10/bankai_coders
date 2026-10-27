import { AmazonAdapter, amazonAdapter } from "../platforms/amazon-adapter";
import type { PriceInfo, AvailabilityInfo, NormalizedProductQuote, ScrapedContent } from "../platforms/platform.types";
import { defaultFirecrawlClient } from "../firecrawl/firecrawl-client";

export * from "../platforms/amazon-adapter";

export class AmazonPriceProvider extends AmazonAdapter {
  async getPrice(url: string): Promise<PriceInfo | null> {
    const scrape = await defaultFirecrawlClient.scrapeUrl(url);
    return this.extractPrice({
      url,
      html: scrape.html,
      markdown: scrape.markdown,
      statusCode: scrape.statusCode,
    });
  }

  async getQuote(url: string): Promise<NormalizedProductQuote> {
    const scrape = await defaultFirecrawlClient.scrapeUrl(url);
    return this.normalize(
      {
        url,
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
