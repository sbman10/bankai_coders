import { describe, expect, it } from "vitest";
import { validateCurrentSellingPrice } from "./price-validator";

describe("Price Validator (validateCurrentSellingPrice)", () => {
  it("validates a genuine current selling price with MRP and computes discount", () => {
    const res = validateCurrentSellingPrice({
      sellingPrice: 37990,
      mrp: 49490,
      currency: "INR",
    });

    expect(res.isValid).toBe(true);
    expect(res.price).toEqual({
      current: 37990,
      currency: "INR",
      mrp: 49490,
      discount_percent: 23,
    });
  });

  it("handles valid price when no MRP is provided", () => {
    const res = validateCurrentSellingPrice({
      sellingPrice: 1299,
      mrp: null,
      currency: "INR",
    });

    expect(res.isValid).toBe(true);
    expect(res.price?.current).toBe(1299);
    expect(res.price?.mrp).toBeNull();
    expect(res.price?.discount_percent).toBeNull();
  });

  it("rejects non-positive, zero, or NaN selling prices", () => {
    expect(validateCurrentSellingPrice({ sellingPrice: 0 }).isValid).toBe(false);
    expect(validateCurrentSellingPrice({ sellingPrice: -500 }).isValid).toBe(false);
    expect(validateCurrentSellingPrice({ sellingPrice: NaN }).isValid).toBe(false);
    expect(validateCurrentSellingPrice({ sellingPrice: null }).isValid).toBe(false);
  });

  it("rejects when selling price exceeds MRP", () => {
    const res = validateCurrentSellingPrice({
      sellingPrice: 55000,
      mrp: 50000,
    });
    expect(res.isValid).toBe(false);
    expect(res.rejectionReason).toContain("cannot exceed MRP");
  });

  it("rejects EMI installment prices falsely labeled as selling price", () => {
    const res = validateCurrentSellingPrice({
      sellingPrice: 1999,
      mrp: 50000,
      contextText: "₹1,999 /month EMI starts at",
    });
    expect(res.isValid).toBe(false);
    expect(res.rejectionReason).toContain("EMI_PRICE_REJECTED");
  });

  it("rejects exchange-adjusted prices", () => {
    const res = validateCurrentSellingPrice({
      sellingPrice: 30000,
      mrp: 50000,
      contextText: "₹30,000 with exchange offer applied",
    });
    expect(res.isValid).toBe(false);
    expect(res.rejectionReason).toContain("EXCHANGE_PRICE_REJECTED");
  });

  it("rejects bank offer / coupon conditional prices", () => {
    const res = validateCurrentSellingPrice({
      sellingPrice: 35990,
      mrp: 50000,
      contextText: "Effective price with bank offer ₹35,990",
    });
    expect(res.isValid).toBe(false);
    expect(res.rejectionReason).toContain("BANK_OFFER_PRICE_REJECTED");
  });

  it("rejects variant mismatch", () => {
    const res = validateCurrentSellingPrice({
      sellingPrice: 37990,
      mrp: 49490,
      isVariantMatched: false,
    });
    expect(res.isValid).toBe(false);
    expect(res.rejectionReason).toContain("VARIANT_MISMATCH");
  });

  it("TEST 12 — Price Contamination: ensures genuine selling price is selected, not MRP, EMI, or Bank Offer", () => {
    // Given page data:
    // MRP ₹50,000
    // Selling Price ₹37,990
    // EMI ₹1,999/month
    // Bank offer ₹35,990
    // Exchange ₹30,000
    const validSelling = validateCurrentSellingPrice({
      sellingPrice: 37990,
      mrp: 50000,
      currency: "INR",
      contextText: "Selling Price ₹37,990",
    });
    expect(validSelling.isValid).toBe(true);
    expect(validSelling.price?.current).toBe(37990);

    const emiCheck = validateCurrentSellingPrice({
      sellingPrice: 1999,
      mrp: 50000,
      contextText: "EMI ₹1,999/month",
    });
    expect(emiCheck.isValid).toBe(false);

    const bankCheck = validateCurrentSellingPrice({
      sellingPrice: 35990,
      mrp: 50000,
      contextText: "with bank offer ₹35,990",
    });
    expect(bankCheck.isValid).toBe(false);

    const exchangeCheck = validateCurrentSellingPrice({
      sellingPrice: 30000,
      mrp: 50000,
      contextText: "with exchange ₹30,000",
    });
    expect(exchangeCheck.isValid).toBe(false);
  });
});
