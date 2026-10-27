export type SupportedStorePlatform =
  | "Amazon"
  | "Flipkart"
  | "Meesho"
  | "Myntra"
  | "Nykaa"
  | "Croma";

export type AvailabilityStatus =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "NOT_FOUND"
  | "UNKNOWN";

export interface PriceInfo {
  current: number;
  currency: string;
  mrp: number | null;
  discount_percent?: number | null;
}

export interface AvailabilityInfo {
  status: AvailabilityStatus;
  evidence: string;
  confidence: number; // 0.0 to 1.0
}

export type ProductIdentifierType =
  | "ASIN"
  | "FLIPKART_PID"
  | "CROMA_PRODUCT_ID"
  | "MEESHO_PRODUCT_ID"
  | "FSN"
  | "SKU"
  | "OTHER";

export interface CanonicalProductVariant {
  ram?: string | null;
  storage?: string | null;
  color?: string | null;
  size?: string | null;
  capacity?: string | null; // e.g. "9 kg"
  connectivity?: string | null; // e.g. "WiFi Enabled" vs "Non-WiFi"
  appliance_type?: string | null; // e.g. "Front Load" vs "Top Load"
  quantity?: number | null;
  pack_size?: number | null;
  volume_or_weight?: string | null;
  other_attributes?: Record<string, string>;
}

export interface CanonicalProductIdentity {
  platform: SupportedStorePlatform;
  sourceUrl: string;
  rawTitle: string;
  cleanTitle: string;
  brand: string | null;
  model: string | null;
  modelNumber?: string | null;
  productIdentifier?: string | null;
  identifierType?: ProductIdentifierType;
  sku?: string | null; // preserved for backward-compatibility
  category: string | null;
  variant: CanonicalProductVariant;
  seller: string | null;
  imageUrl: string | null;
}

export interface NormalizedProductQuote {
  platform: SupportedStorePlatform;
  productUrl: string;
  title: string;
  brand: string | null;
  model: string | null;
  variant: CanonicalProductVariant;
  productIdentifier?: string | null;
  identifierType?: ProductIdentifierType;
  sku?: string | null; // preserved for backward-compatibility
  price: PriceInfo | null;
  availability: AvailabilityInfo;
  seller: string | null;
  imageUrl: string | null;
  scrapedAt: string;
  rawConfidence: number;
}

export interface ScrapedContent {
  markdown: string;
  html?: string;
  statusCode?: number;
}
