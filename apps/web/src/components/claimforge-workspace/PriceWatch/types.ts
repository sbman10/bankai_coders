/**
 * Price Watch 2.0 Frontend Types
 * Isolated UI-only types for discovery, comparison, alert configuration, and watchlist management.
 * Note: Zero backend modifications — these interfaces define the expected frontend contract.
 */

export interface RetailerOffer {
  id: string;
  retailerId: "amazon" | "flipkart" | "croma" | "reliance-digital" | "vijay-sales" | "other";
  retailerName: string;
  storeDomain: string;
  price: number;
  originalPrice?: number;
  currency: "INR";
  availability: "in_stock" | "low_stock" | "out_of_stock" | "check_store";
  availabilityText?: string;
  url: string;
  lastCheckedAt: string;
  shippingFee?: number;
  deliveryDays?: number;
  condition: "new" | "refurbished" | "open_box";
  isLowestPrice?: boolean;
}

export interface DiscoveredProduct {
  id: string;
  title: string;
  brand: string;
  model: string;
  variant?: string;
  category?: string;
  imageUrl?: string;
  sourceUrl: string;
  sourceRetailer: string;
  rating?: number;
  reviewsCount?: number;
  verifiedTimestamp: string;
  isSamplePreview?: boolean;
  matchingConfidenceNote?: string;
  offers: RetailerOffer[];
  lowestPrice: number;
  highestPrice: number;
  potentialSavings: number;
  storesCount: number;
}

export interface PriceAlertConfig {
  targetPrice: number;
  nearTargetBuffer: number;
  alertScope: "any_store" | "specific_store";
  preferredStore?: string;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyWhatsApp: boolean;
}

export type WatchStatus = "watching" | "near_target" | "target_reached" | "unavailable" | "manual";

export interface EnrichedPriceWatch {
  id: string;
  productId: string;
  name: string;
  url: string;
  currentPrice: number;
  targetPrice: number;
  currency: string;
  lastCheckedAt?: string;
  createdAt: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  retailerName?: string;
  storesComparedCount?: number;
  nearTargetBuffer?: number;
  status: WatchStatus;
  isDemo?: boolean;
  bestOfferUrl?: string;
}
