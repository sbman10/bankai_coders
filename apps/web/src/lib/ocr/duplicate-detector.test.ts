import { describe, it, expect } from "vitest";
import { findPotentialDuplicates } from "./duplicate-detector";
import type { ExtractedProductFields } from "./types";

describe("findPotentialDuplicates", () => {
  const existingProducts = [
    {
      id: "prod-1",
      name: "Demo Wireless Headphones",
      brand: "DemoSound",
      model: "TEST-Q20",
      order_id: "TEST-404-1234567-8901234",
      invoice_number: "TEST-INV-2026-10427",
      serial_number: "TEST-SN-00012345",
    },
    {
      id: "prod-2",
      name: "Apple iPhone 15",
      brand: "Apple",
      model: "A3090",
      order_id: "ORD-998811",
      invoice_number: "INV-554433",
      serial_number: "F2LX9012",
    },
  ];

  it("detects duplicate by Order ID", () => {
    const extracted: Partial<ExtractedProductFields> = {
      product_name: "Demo Headphones",
      order_id: "TEST-404-1234567-8901234",
    };

    const matches = findPotentialDuplicates(extracted, existingProducts);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedField).toBe("order_id");
    expect(matches[0].productId).toBe("prod-1");
  });

  it("detects duplicate by Invoice Number", () => {
    const extracted: Partial<ExtractedProductFields> = {
      product_name: "Different Name",
      invoice_number: "TEST-INV-2026-10427",
    };

    const matches = findPotentialDuplicates(extracted, existingProducts);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedField).toBe("invoice_number");
  });

  it("detects duplicate by Serial Number", () => {
    const extracted: Partial<ExtractedProductFields> = {
      product_name: "Different Name",
      serial_number: "TEST-SN-00012345",
    };

    const matches = findPotentialDuplicates(extracted, existingProducts);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedField).toBe("serial_number");
  });

  it("returns empty array when no duplicate exists", () => {
    const extracted: Partial<ExtractedProductFields> = {
      product_name: "Sony Headphones",
      brand: "Sony",
      model: "WH-1000XM5",
      order_id: "NEW-ORDER-12345",
      invoice_number: "NEW-INV-99999",
      serial_number: "NEW-SN-777",
    };

    const matches = findPotentialDuplicates(extracted, existingProducts);
    expect(matches).toHaveLength(0);
  });
});
