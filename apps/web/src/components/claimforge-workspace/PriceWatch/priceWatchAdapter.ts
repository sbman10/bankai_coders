import { DiscoveredProduct, RetailerOffer, WatchStatus } from "./types";

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
  "meesho.com": "Meesho",
  "www.meesho.com": "Meesho",
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

  if (hostname === "amazon.com" || hostname === "www.amazon.com") {
    return {
      isValid: false,
      normalizedUrl: parsed.toString(),
      hostname,
      retailerName: "Amazon.com",
      isSupportedRetailer: false,
      error: "Price Watch currently supports Amazon India (INR), not Amazon.com (USD). Paste an Amazon.in product link.",
    };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    hostname,
    retailerName: retailerName || hostname,
    isSupportedRetailer,
  };
}

function transformBackendAnalysisToDiscoveredProduct(
  analysis: any,
  validation: UrlValidationResult
): DiscoveredProduct {
  const id = analysis.canonicalIdentity;
  const quote = analysis.sourceQuote;
  const quotedPrice = quote?.price?.current;
  const currentPrice = typeof quotedPrice === "number" && Number.isFinite(quotedPrice) && quotedPrice > 0
    ? quotedPrice
    : null;
  const quotedMrp = quote?.price?.mrp;
  const mrp = typeof quotedMrp === "number" && Number.isFinite(quotedMrp) && quotedMrp > 0
    ? quotedMrp
    : currentPrice;

  // Format variant details (RAM, Storage, Color, Size)
  const variantParts: string[] = [];
  if (id.variant?.ram) variantParts.push(`${id.variant.ram} RAM`);
  if (id.variant?.storage) variantParts.push(`${id.variant.storage} Storage`);
  if (id.variant?.color) variantParts.push(id.variant.color);
  if (id.variant?.size) variantParts.push(id.variant.size);
  if (id.variant?.volume_or_weight) variantParts.push(id.variant.volume_or_weight);
  const variantStr = variantParts.join(" · ") || undefined;

  const isAvailable = quote?.availability?.status === "IN_STOCK";
  const hostnameLower = validation.hostname.toLowerCase();
  const sourceRetailerId = hostnameLower.includes("amazon")
    ? "amazon"
    : hostnameLower.includes("flipkart")
    ? "flipkart"
    : hostnameLower.includes("meesho")
    ? "meesho"
    : "other";

  const sourceOffer: RetailerOffer | null = currentPrice === null ? null : {
    id: `off-${validation.hostname.replace(/[^a-z0-9]/g, "")}-${id.sku || "source"}`,
    retailerId: sourceRetailerId,
    retailerName: validation.retailerName,
    storeDomain: validation.hostname,
    price: currentPrice,
    originalPrice: mrp !== null && mrp > currentPrice ? mrp : undefined,
    currency: "INR",
    availability: isAvailable ? "in_stock" : "out_of_stock",
    availabilityText: quote?.availability?.evidence || (isAvailable ? "In Stock (Verified Offer)" : "Currently unavailable"),
    url: validation.normalizedUrl,
    lastCheckedAt: "Just now",
    deliveryDays: 2,
    condition: "new",
    isLowestPrice: true,
  };

  const offers: RetailerOffer[] = sourceOffer ? [sourceOffer] : [];

  if (analysis.candidateEvaluations && Array.isArray(analysis.candidateEvaluations)) {
    for (const cand of analysis.candidateEvaluations) {
      if (
        cand.isEligibleForComparison &&
        typeof cand.quote?.price?.current === "number" &&
        Number.isFinite(cand.quote.price.current) &&
        cand.quote.price.current > 0
      ) {
        const cPrice = cand.quote.price.current;
        const cMrp = cand.quote.price.mrp;
        const cPlatform = cand.quote.platform || "Other";
        const pLower = cPlatform.toLowerCase();
        const cId = pLower === "flipkart"
          ? "flipkart"
          : pLower === "meesho"
          ? "meesho"
          : pLower.includes("amazon")
          ? "amazon"
          : "other";
        const cDomain = pLower === "flipkart"
          ? "flipkart.com"
          : pLower === "meesho"
          ? "meesho.com"
          : pLower.includes("amazon")
          ? "amazon.in"
          : `${pLower}.com`;

        offers.push({
          id: `off-${cId}-${Date.now()}`,
          retailerId: cId as any,
          retailerName: cPlatform,
          storeDomain: cDomain,
          price: cPrice,
          originalPrice: cMrp && cMrp > cPrice ? cMrp : undefined,
          currency: "INR",
          availability: cand.quote.availability?.status === "IN_STOCK" ? "in_stock" : "out_of_stock",
          availabilityText: cand.quote.availability?.evidence || "In Stock",
          url: cand.quote.productUrl,
          lastCheckedAt: "Just now",
          deliveryDays: 3,
          condition: "new",
          isLowestPrice: false,
        });
      }
    }
  }

  const metrics = computePriceMetrics(offers);
  if (metrics.lowestOffer) {
    for (const o of offers) {
      o.isLowestPrice = o.id === metrics.lowestOffer.id;
    }
  }

  return {
    id: `discovered-${id.sku || Date.now()}`,
    title: id.cleanTitle || id.rawTitle,
    brand: id.brand || validation.retailerName,
    model: id.model && id.brand && !id.model.toLowerCase().includes(id.brand.toLowerCase()) ? `${id.brand} ${id.model}` : (id.model || id.cleanTitle),
    variant: variantStr,
    category: analysis.detectedCategory || "General",
    imageUrl: id.imageUrl || undefined,
    sourceUrl: validation.normalizedUrl,
    sourceRetailer: validation.retailerName,
    rating: 4.5,
    reviewsCount: undefined,
    verifiedTimestamp: offers.length > 0 ? "Verified live just now" : undefined,
    isSamplePreview: false,
    matchingConfidenceNote: offers.length > 0
      ? `Live verified catalog data from ${validation.retailerName}${id.sku ? ` (ASIN: ${id.sku})` : ""}. Availability: ${isAvailable ? "In Stock" : "Unavailable"}.`
      : "Product details were identified from the source page, but no current price could be verified.",
    offers,
    lowestPrice: metrics.lowestPrice,
    highestPrice: metrics.highestPrice,
    potentialSavings: metrics.potentialSavings,
    storesCount: offers.length,
  };
}

/**
 * Discovers live multi-retailer offers for a product link.
 * Connects to the backend Price Intelligence API (/api/price-intelligence/analyze).
 */
export async function discoverProductFromUrl(url: string): Promise<DiscoveredProduct> {
  const validation = validateProductUrl(url);
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid URL.");
  }

  // Only backend results count as live data; never substitute sample prices after a lookup.
  try {
    const res = await fetch("/api/price-intelligence/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: validation.normalizedUrl,
        platforms: ["Amazon", "Flipkart", "Meesho"],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.analysis) {
        return transformBackendAnalysisToDiscoveredProduct(data.analysis, validation);
      }
    } else {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error || `Failed to analyze link from ${validation.retailerName}.`);
    }
  } catch (err: unknown) {
    if (err instanceof TypeError) {
      throw new Error("We couldn't reach the price checker. Please try again.");
    }
    throw err;
  }

  throw new Error(`Could not retrieve price intelligence data from ${validation.retailerName}.`);
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
