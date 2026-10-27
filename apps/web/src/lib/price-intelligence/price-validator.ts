import type { PriceInfo, SupportedStorePlatform } from "../platforms/platform.types";

export interface PriceValidationInput {
  sellingPrice: number | null | undefined;
  mrp?: number | null;
  currency?: string | null;
  platform?: SupportedStorePlatform;
  contextText?: string;
  isVariantMatched?: boolean;
}

export interface PriceValidationResult {
  isValid: boolean;
  price: PriceInfo | null;
  rejectionReason?: string;
}

/**
 * Centralized selling price validation for ProductVault.
 * Ensures that price observations reflect true, current selling prices and
 * filters out MRP, EMI, bank offers, exchange values, cashback, or variant mismatches.
 */
export function validateCurrentSellingPrice(input: PriceValidationInput): PriceValidationResult {
  const { sellingPrice, mrp, platform, contextText, isVariantMatched } = input;

  // 1. Variant Mismatch Check
  if (isVariantMatched === false) {
    return {
      isValid: false,
      price: null,
      rejectionReason: "VARIANT_MISMATCH: Price does not correspond to the requested product variant.",
    };
  }

  // 2. Existence and Finite Positive Check
  if (
    sellingPrice === null ||
    sellingPrice === undefined ||
    typeof sellingPrice !== "number" ||
    Number.isNaN(sellingPrice) ||
    !Number.isFinite(sellingPrice) ||
    sellingPrice <= 0
  ) {
    return {
      isValid: false,
      price: null,
      rejectionReason: "PRICE_NOT_FOUND: No valid positive selling price provided.",
    };
  }

  // 3. Currency Check
  const rawCurrency = (input.currency || "INR").trim().toUpperCase();
  const normalizedCurrency = rawCurrency === "₹" || rawCurrency === "RS" || rawCurrency === "INR" ? "INR" : rawCurrency;
  if (normalizedCurrency !== "INR") {
    return {
      isValid: false,
      price: null,
      rejectionReason: `INVALID_CURRENCY: Expected INR, got '${normalizedCurrency}'.`,
    };
  }

  // 4. Selling Price cannot be greater than MRP if MRP is present
  if (mrp !== null && mrp !== undefined && typeof mrp === "number" && Number.isFinite(mrp) && mrp > 0) {
    if (sellingPrice > mrp) {
      return {
        isValid: false,
        price: null,
        rejectionReason: `PRICE_VALIDATION_FAILED: Selling price (₹${sellingPrice}) cannot exceed MRP (₹${mrp}).`,
      };
    }
  }

  // 5. Context Inspection: Reject EMI, Bank Offers, Exchange discounts, Cashback
  if (contextText) {
    const lowerContext = contextText.toLowerCase();

    // Check if context specifically tags this price as an EMI installment
    if (
      /\b(per\s*month|\/month|\/mo\b|pm\b|\bx\s*\d+\s*months?|\bemi\s*starts?\s*at\b|\bstarting\s*emi\b)/i.test(
        lowerContext
      )
    ) {
      return {
        isValid: false,
        price: null,
        rejectionReason: "EMI_PRICE_REJECTED: Extracted amount corresponds to an EMI installment, not full selling price.",
      };
    }

    // Check if context specifically tags this price as exchange adjusted
    if (
      /\b(with\s*exchange|exchange\s*discount|after\s*exchange|including\s*exchange\s*offer)\b/i.test(lowerContext)
    ) {
      return {
        isValid: false,
        price: null,
        rejectionReason: "EXCHANGE_PRICE_REJECTED: Extracted amount reflects trade-in / exchange-adjusted price.",
      };
    }

    // Check if price is purely a bank/card discount or coupon conditional
    if (
      /\b(effective\s*price\s*with\s*(?:card|bank|coupon)|with\s*bank\s*offer|bank\s*offer\s*price|after\s*coupon|coupon\s*discount)\b/i.test(
        lowerContext
      )
    ) {
      return {
        isValid: false,
        price: null,
        rejectionReason: "BANK_OFFER_PRICE_REJECTED: Extracted amount includes conditional bank or coupon discounts.",
      };
    }

    // Check if price is cashback-adjusted
    if (/\b(effective\s*price\s*after\s*cashback|cashback\s*adjusted)\b/i.test(lowerContext)) {
      return {
        isValid: false,
        price: null,
        rejectionReason: "CASHBACK_PRICE_REJECTED: Extracted amount includes conditional cashback.",
      };
    }
  }

  // 6. Suspiciously Low Price Heuristic (e.g. ₹1,999 for ₹50,000 electronics item)
  if (mrp && mrp >= 20000 && sellingPrice < 3000) {
    // If selling price is < 15% of high-end MRP, it is almost certainly an EMI amount
    if (sellingPrice / mrp < 0.15) {
      return {
        isValid: false,
        price: null,
        rejectionReason: `SUSPICIOUS_PRICE_REJECTED: Price ₹${sellingPrice} is <15% of MRP ₹${mrp}, likely an EMI monthly installment.`,
      };
    }
  }

  // Calculate clean discount percentage if MRP is valid
  let discount_percent: number | null = null;
  const validMrp = mrp && mrp > sellingPrice ? Math.round(mrp * 100) / 100 : null;
  if (validMrp) {
    discount_percent = Math.round(((validMrp - sellingPrice) / validMrp) * 100);
  }

  return {
    isValid: true,
    price: {
      current: Math.round(sellingPrice * 100) / 100,
      currency: "INR",
      mrp: validMrp,
      discount_percent,
    },
  };
}
