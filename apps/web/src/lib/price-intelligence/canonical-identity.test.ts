import { describe, it, expect } from "vitest";
import {
  cleanProductTitle,
  detectBrandFromTitle,
  extractModelFromTitle,
  extractVariantAttributes,
} from "./canonical-identity";

describe("Canonical Product Identity & Variant Extraction", () => {
  it("cleans noisy e-commerce titles by removing marketplace boilerplate", () => {
    const raw = "Amazon.in : Realme P4 5G (Submarine Blue, 8GB RAM, 128GB Storage) : Amazon.in";
    const cleaned = cleanProductTitle(raw);
    expect(cleaned).toBe("Realme P4 5G (Submarine Blue, 8GB RAM, 128GB Storage)");
  });

  it("extracts RAM and Storage accurately from smartphone specifications", () => {
    const title = "Realme P4 5G (Submarine Blue, 8GB RAM, 128GB Storage)";
    const variant = extractVariantAttributes(title);
    expect(variant.ram).toBe("8GB");
    expect(variant.storage).toBe("128GB");
    expect(variant.color).toBe("Submarine Blue");
  });

  it("extracts 12GB RAM and 256GB Storage variant accurately", () => {
    const title = "Realme P4 5G (Cosmic Black, 12GB RAM, 256GB Storage)";
    const variant = extractVariantAttributes(title);
    expect(variant.ram).toBe("12GB");
    expect(variant.storage).toBe("256GB");
  });

  it("extracts volume and weight accurately for personal care products", () => {
    const title1 = "Nivea Soft Light Moisturiser Cream, 100ml Pack";
    const variant1 = extractVariantAttributes(title1);
    expect(variant1.volume_or_weight).toBe("100ml");

    const title2 = "Nivea Soft Light Moisturiser Cream, 200 ml";
    const variant2 = extractVariantAttributes(title2);
    expect(variant2.volume_or_weight).toBe("200ml");
  });

  it("extracts clothing sizes accurately", () => {
    const titleM = "Puma Men's Solid Regular Fit T-Shirt (Size: M)";
    const variantM = extractVariantAttributes(titleM);
    expect(variantM.size).toBe("M");

    const titleXL = "Puma Men's Solid Regular Fit T-Shirt (Size: XL)";
    const variantXL = extractVariantAttributes(titleXL);
    expect(variantXL.size).toBe("XL");
  });

  it("extracts display screen sizes for electronics", () => {
    const title = 'Samsung 55 inch Crystal 4K UHD Smart TV (Titan Grey)';
    const variant = extractVariantAttributes(title);
    expect(variant.size).toBe("55 inch");
  });

  it("detects known brands reliably even when byline info is missing", () => {
    expect(detectBrandFromTitle("Realme P4 5G 8GB 128GB")).toBe("Realme");
    expect(detectBrandFromTitle("Sony WH-1000XM5 Wireless Headphones")).toBe("Sony");
    expect(detectBrandFromTitle("Apple iPhone 15 Pro 256GB")).toBe("Apple");
    expect(detectBrandFromTitle("Nivea Nourishing Body Milk 400ml")).toBe("Nivea");
  });

  it("extracts clean model name excluding brand and variant parentheses", () => {
    const title = "Realme P4 5G (Submarine Blue, 8GB RAM, 128GB Storage)";
    const model = extractModelFromTitle(title, "Realme");
    expect(model).toBe("P4 5G");
  });
});
