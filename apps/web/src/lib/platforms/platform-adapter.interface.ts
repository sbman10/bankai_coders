import type {
  SupportedStorePlatform,
  CanonicalProductIdentity,
  NormalizedProductQuote,
  PriceInfo,
  AvailabilityInfo,
  ScrapedContent,
} from "./platform.types";

export interface PlatformAdapter {
  readonly platform: SupportedStorePlatform;

  /**
   * Checks whether this adapter can handle the given URL.
   */
  canHandle(url: string): boolean;

  /**
   * Extracts canonical product identity (brand, model, variant specs) from page content.
   */
  extractCanonicalIdentity(content: ScrapedContent, url: string): CanonicalProductIdentity;

  /**
   * Strictly extracts the ACTUAL selling price, distinguishing from MRP, EMI, and bank offers.
   */
  extractPrice(content: ScrapedContent): PriceInfo | null;

  /**
   * Strictly extracts availability state based on positive purchase proof or out-of-stock indicators.
   */
  extractAvailability(content: ScrapedContent): AvailabilityInfo;

  /**
   * Combines all extracted components into a validated NormalizedProductQuote.
   */
  normalize(content: ScrapedContent, url: string): NormalizedProductQuote;

  /**
   * Builds an accurate, highly specific search query for cross-store discovery.
   */
  buildSearchQuery(identity: CanonicalProductIdentity): string;
}
