import type { NormalizedProductQuote, SupportedStorePlatform } from "../platforms/platform.types";

export interface StorePriceQuote {
  platform: SupportedStorePlatform;
  price: number | null;
  currency: string;
  mrp?: number | null;
  productUrl: string;
  seller?: string | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "NOT_FOUND" | "UNKNOWN";
  matchConfidence: number;
}

export interface PriceComparisonSummary {
  lowestPrice: {
    amount: number;
    platform: SupportedStorePlatform;
    url: string;
  };
  medianPrice: {
    amount: number;
    label: "Median Price";
  };
  highestPrice: {
    amount: number;
    platform: SupportedStorePlatform;
    url: string;
  };
  currency: string;
  maxSavings: number;
  maxSavingsPercent: number;
  availableStoreCount: number;
  totalCheckedCount: number;
  verifiedQuotes: StorePriceQuote[];
  unverifiedOrUnavailable: StorePriceQuote[];
}

export function calculateMedianPrice(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // Average of two middle values
    const median = (sorted[mid - 1] + sorted[mid]) / 2;
    return Math.round(median * 100) / 100;
  } else {
    // Exact middle value
    return sorted[mid];
  }
}

export class PriceComparisonEngine {
  /**
   * Compares prices across verified, available store quotes.
   * STRICT: Only quotes with availability === 'IN_STOCK' and a valid numeric price
   * are factored into Lowest, Median Price, and Highest calculations.
   */
  compare(quotes: NormalizedProductQuote[]): PriceComparisonSummary | null {
    const verifiedQuotes: StorePriceQuote[] = [];
    const unverifiedOrUnavailable: StorePriceQuote[] = [];

    for (const q of quotes) {
      const isAvailable = q.availability.status === "IN_STOCK";
      const hasPrice = q.price && typeof q.price.current === "number" && q.price.current > 0;

      const storeQuote: StorePriceQuote = {
        platform: q.platform,
        price: hasPrice ? q.price!.current : null,
        currency: q.price?.currency || "INR",
        mrp: q.price?.mrp ?? null,
        productUrl: q.productUrl,
        seller: q.seller,
        availability: q.availability.status,
        matchConfidence: q.rawConfidence,
      };

      if (isAvailable && hasPrice) {
        verifiedQuotes.push(storeQuote);
      } else {
        unverifiedOrUnavailable.push(storeQuote);
      }
    }

    if (verifiedQuotes.length === 0) {
      return null;
    }

    // Sort verified quotes by price ascending
    verifiedQuotes.sort((a, b) => a.price - b.price);

    const lowest = verifiedQuotes[0];
    const highest = verifiedQuotes[verifiedQuotes.length - 1];
    const prices = verifiedQuotes.map((q) => q.price);
    const medianAmount = calculateMedianPrice(prices);

    const maxSavings = Math.round((highest.price - lowest.price) * 100) / 100;
    const maxSavingsPercent =
      highest.price > 0 ? Math.round(((highest.price - lowest.price) / highest.price) * 100) : 0;

    return {
      lowestPrice: {
        amount: lowest.price,
        platform: lowest.platform,
        url: lowest.productUrl,
      },
      medianPrice: {
        amount: medianAmount,
        label: "Median Price",
      },
      highestPrice: {
        amount: highest.price,
        platform: highest.platform,
        url: highest.productUrl,
      },
      currency: lowest.currency,
      maxSavings,
      maxSavingsPercent,
      availableStoreCount: verifiedQuotes.length,
      totalCheckedCount: quotes.length,
      verifiedQuotes,
      unverifiedOrUnavailable,
    };
  }
}

export const defaultPriceComparisonEngine = new PriceComparisonEngine();
