import { DiscoveredProduct, RetailerOffer, WatchStatus } from "./types";
import { SAMPLE_PRODUCTS } from "./priceWatchDemoData";

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  hostname: string;
  retailerName: string;
  isSupportedRetailer: boolean;
  error?: string;
}

const SUPPORTED_DOMAINS: Record<string, string> = {
  "amazon.in": "Amazon India",
  "www.amazon.in": "Amazon India",
  "amazon.com": "Amazon",
  "www.amazon.com": "Amazon",
  "flipkart.com": "Flipkart",
  "www.flipkart.com": "Flipkart",
  "croma.com": "Croma",
  "www.croma.com": "Croma",
  "reliancedigital.in": "Reliance Digital",
  "www.reliancedigital.in": "Reliance Digital",
  "vijaysales.com": "Vijay Sales",
  "www.vijaysales.com": "Vijay Sales",
  "tatacliq.com": "Tata CLiQ",
  "www.tatacliq.com": "Tata CLiQ",
};

/**
 * Validates a user-pasted URL on the frontend.
 * Strictly verifies protocol, format, and supported store domains.
 */
export function validateProductUrl(inputUrl: string): UrlValidationResult {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalizedUrl: "",
      hostname: "",
      retailerName: "",
      isSupportedRetailer: false,
      error: "Please enter or paste a product link.",
    };
  }

  // Check valid URL structure
  let parsed: URL;
  try {
    // If protocol is missing, add https for parsing inspection
    const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    return {
      isValid: false,
      normalizedUrl: trimmed,
      hostname: "",
      retailerName: "",
      isSupportedRetailer: false,
      error: "Please enter a valid web URL (e.g., https://amazon.in/dp/...)",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isValid: false,
      normalizedUrl: trimmed,
      hostname: "",
      retailerName: "",
      isSupportedRetailer: false,
      error: "Only HTTP and HTTPS links are supported.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.includes(".") || hostname.length < 4) {
    return {
      isValid: false,
      normalizedUrl: trimmed,
      hostname: "",
      retailerName: "",
      isSupportedRetailer: false,
      error: "Please enter a valid web URL (e.g., https://amazon.in/dp/...)",
    };
  }

  const retailerName = SUPPORTED_DOMAINS[hostname] || "";
  const isSupportedRetailer = Boolean(retailerName);

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    hostname,
    retailerName: retailerName || hostname,
    isSupportedRetailer,
  };
}

/**
 * Simulates discovery of multi-retailer offers for a product link.
 * Isolated demonstration adapter — returns deterministic results.
 */
export async function discoverProductFromUrl(url: string): Promise<DiscoveredProduct> {
  const validation = validateProductUrl(url);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid URL.");
  }

  // Artificial short delay to simulate network latency for realistic UX feel
  await new Promise((resolve) => setTimeout(resolve, 450));

  const lower = url.toLowerCase();

  // Match against sample products based on URL fragments or keywords
  if (lower.includes("macbook") || lower.includes("m3") || lower.includes("b0cx23v253") || lower.includes("apple")) {
    return { ...SAMPLE_PRODUCTS[0], sourceUrl: validation.normalizedUrl };
  }
  if (lower.includes("sony") || lower.includes("xm5") || lower.includes("b09xs7jwhh") || lower.includes("headphone")) {
    return { ...SAMPLE_PRODUCTS[1], sourceUrl: validation.normalizedUrl };
  }
  if (lower.includes("s24") || lower.includes("galaxy") || lower.includes("samsung") || lower.includes("b0cs5xw9g9")) {
    return { ...SAMPLE_PRODUCTS[2], sourceUrl: validation.normalizedUrl };
  }
  if (lower.includes("dyson") || lower.includes("vacuum") || lower.includes("b0b5dfj38f")) {
    return { ...SAMPLE_PRODUCTS[3], sourceUrl: validation.normalizedUrl };
  }

  // If a supported retailer URL was entered but doesn't match predefined samples,
  // produce an honest demonstration preview showing discovery capability
  if (validation.isSupportedRetailer) {
    const defaultProduct = SAMPLE_PRODUCTS[0];
    return {
      ...defaultProduct,
      id: `discovered-${Date.now()}`,
      title: `${validation.retailerName} Discovered Item: ${defaultProduct.title}`,
      sourceUrl: validation.normalizedUrl,
      sourceRetailer: validation.retailerName,
      isSamplePreview: true,
      matchingConfidenceNote: `Preview demonstration: Found 4 comparable offers based on SKU match from ${validation.retailerName}.`,
    };
  }

  // If unsupported retailer
  throw new Error(
    `Retailer "${validation.hostname}" is not yet integrated. Supported stores currently include Amazon India, Flipkart, Croma, and Reliance Digital. Try one of our sample links above.`
  );
}

/**
 * Format numbers as Indian Rupee (INR) currency.
 */
export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "₹0";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * Determine watch status based on current observed price, user's target price, and buffer.
 */
export function determineWatchStatus(
  currentPrice: number,
  targetPrice: number,
  nearTargetBuffer?: number
): WatchStatus {
  if (currentPrice <= 0 || targetPrice <= 0) return "watching";
  if (currentPrice <= targetPrice) return "target_reached";
  if (nearTargetBuffer && nearTargetBuffer > 0 && currentPrice <= targetPrice + nearTargetBuffer) {
    return "near_target";
  }
  return "watching";
}

/**
 * Computes price metrics from a list of retailer offers.
 */
export function computePriceMetrics(offers: RetailerOffer[]) {
  const validOffers = offers.filter((o) => o.price > 0 && o.availability !== "out_of_stock");
  if (validOffers.length === 0) {
    return {
      lowestPrice: 0,
      highestPrice: 0,
      potentialSavings: 0,
      storesCount: offers.length,
      lowestOffer: undefined,
    };
  }

  const sorted = [...validOffers].sort((a, b) => a.price - b.price);
  const lowestOffer = sorted[0];
  const highestOffer = sorted[sorted.length - 1];
  const lowestPrice = lowestOffer.price;
  const highestPrice = highestOffer.price;
  const potentialSavings = Math.max(0, highestPrice - lowestPrice);

  return {
    lowestPrice,
    highestPrice,
    potentialSavings,
    storesCount: validOffers.length,
    lowestOffer,
  };
}
