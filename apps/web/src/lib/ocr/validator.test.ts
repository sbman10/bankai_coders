import { describe, it, expect } from "vitest";
import { validateExtractedFields } from "./validator";
import type { ExtractedProductFields } from "./types";

describe("validateExtractedFields", () => {
  it("marks empty/null fields as not_found", () => {
    const raw: ExtractedProductFields = {
      brand: null,
      product_name: null,
      model: null,
      category: null,
      serial_number: null,
      invoice_number: null,
      order_id: null,
      purchase_date: null,
      seller: null,
      price: null,
      currency: null,
      warranty_duration: null,
      warranty_start_date: null,
      warranty_end_date: null,
      quantity: null,
      source_marketplace: null,
      owner_name: null,
      buying_method: null,
    };

    const result = validateExtractedFields(raw);
    expect(result.fieldStatus.product_name).toBe("not_found");
    expect(result.fieldStatus.brand).toBe("not_found");
    expect(result.fieldStatus.warranty_duration).toBe("not_found");
    expect(result.calculatedWarrantyMonths).toBeNull();
    expect(result.calculatedWarrantyEnd).toBeNull();
  });

  it("validates confident fields for the demo invoice data", () => {
    const demoData: ExtractedProductFields = {
      brand: "DemoSound",
      product_name: "Demo Wireless Headphones",
      model: "TEST-Q20",
      category: "Electronics",
      serial_number: "TEST-SN-00012345",
      invoice_number: "TEST-INV-2026-10427",
      order_id: "TEST-404-1234567-8901234",
      purchase_date: "2026-10-24",
      seller: "Demo Electronics Seller Pvt. Ltd.",
      price: 2499,
      currency: "INR",
      warranty_duration: "12 months",
      warranty_start_date: "2026-10-24",
      warranty_end_date: "2027-10-24",
      quantity: 1,
      source_marketplace: "Amazon",
      owner_name: "Kapish Gupta",
      buying_method: "Credit Card",
    };

    const result = validateExtractedFields(demoData);
    expect(result.fieldStatus.brand).toBe("confident");
    expect(result.fieldStatus.product_name).toBe("confident");
    expect(result.fieldStatus.model).toBe("confident");
    expect(result.fieldStatus.order_id).toBe("confident");
    expect(result.fieldStatus.invoice_number).toBe("confident");
    expect(result.fieldStatus.purchase_date).toBe("confident");
    expect(result.fieldStatus.price).toBe("confident");
    expect(result.fieldStatus.warranty_duration).toBe("confident");
    expect(result.calculatedWarrantyMonths).toBe(12);
    expect(result.calculatedWarrantyEnd).toBe("2027-10-24");
    expect(result.warnings).toHaveLength(0);
  });

  it("normalizes diverse date formats (e.g. 24 October 2026, 24/10/2026)", () => {
    const input: ExtractedProductFields = {
      brand: "Sony",
      product_name: "WH-1000XM5",
      model: "WH1000XM5",
      category: "Electronics",
      serial_number: null,
      invoice_number: null,
      order_id: null,
      purchase_date: "24 October 2026",
      seller: null,
      price: 26990,
      currency: "INR",
      warranty_duration: "1 year",
      warranty_start_date: null,
      warranty_end_date: null,
      quantity: 1,
      source_marketplace: "Flipkart",
      owner_name: null,
      buying_method: null,
    };

    const result = validateExtractedFields(input);
    expect(result.validatedFields.purchase_date).toBe("2026-10-24");
    expect(result.fieldStatus.purchase_date).toBe("confident");
    expect(result.calculatedWarrantyMonths).toBe(12);
    expect(result.calculatedWarrantyEnd).toBe("2027-10-24");
  });

  it("marks invalid or ambiguous dates as needs_review", () => {
    const input: ExtractedProductFields = {
      brand: "Boat",
      product_name: "Airdopes",
      model: "141",
      category: "Electronics",
      serial_number: null,
      invoice_number: null,
      order_id: null,
      purchase_date: "invalid-date-string",
      seller: null,
      price: 999,
      currency: "INR",
      warranty_duration: null,
      warranty_start_date: null,
      warranty_end_date: null,
      quantity: 1,
      source_marketplace: null,
      owner_name: null,
      buying_method: null,
    };

    const result = validateExtractedFields(input);
    expect(result.validatedFields.purchase_date).toBeNull();
    expect(result.fieldStatus.purchase_date).toBe("needs_review");
    expect(result.warnings.some((w) => w.toLowerCase().includes("date"))).toBe(true);
  });

  it("anti-hallucination: does NOT invent warranty if warranty is absent", () => {
    const input: ExtractedProductFields = {
      brand: "Apple",
      product_name: "MacBook Air M2",
      model: "MLXY3HN/A",
      category: "Electronics",
      serial_number: null,
      invoice_number: "INV-99",
      order_id: null,
      purchase_date: "2026-05-10",
      seller: "Apple India",
      price: 99900,
      currency: "INR",
      warranty_duration: null,
      warranty_start_date: null,
      warranty_end_date: null,
      quantity: 1,
      source_marketplace: null,
      owner_name: null,
      buying_method: null,
    };

    const result = validateExtractedFields(input);
    expect(result.validatedFields.warranty_duration).toBeNull();
    expect(result.fieldStatus.warranty_duration).toBe("not_found");
    expect(result.calculatedWarrantyMonths).toBeNull();
    expect(result.calculatedWarrantyEnd).toBeNull();
  });
});
