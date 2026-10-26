import type { ExtractedProductFields, FieldConfidence, ValidationResult } from "./types";

function cleanString(val: unknown, maxLen = 160): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "n/a" || trimmed.toLowerCase() === "none") {
    return null;
  }
  // Strip stray leading/trailing colons, dashes, hashes, or dots (e.g. ":" or "Sold By :")
  const cleaned = trimmed.replace(/^[:\-#.\s]+|[:\-#.\s]+$/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

export function parseDateToIso(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  // 1. Direct YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const testDate = new Date(`${iso}T00:00:00.000Z`);
    if (!Number.isNaN(testDate.valueOf()) && testDate.toISOString().slice(0, 10) === iso) {
      return iso;
    }
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const testDate = new Date(`${iso}T00:00:00.000Z`);
    if (!Number.isNaN(testDate.valueOf()) && testDate.toISOString().slice(0, 10) === iso) {
      return iso;
    }
  }

  // 3. Named month, e.g. "24 October 2026" or "October 24, 2026" or "24-Oct-2026"
  const cleanNamed = s.replace(/[-]/g, " ");
  const parsed = new Date(cleanNamed);
  if (!Number.isNaN(parsed.valueOf())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    // Ensure reasonable year range (e.g., between 2000 and 2040)
    if (y >= 2000 && y <= 2040) {
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

export function parseWarrantyMonths(warrantyStr: unknown): number | null {
  if (typeof warrantyStr !== "string") return null;
  const text = warrantyStr.toLowerCase().trim();
  if (!text || text === "null" || text === "none" || text === "no warranty" || text === "n/a") {
    return null;
  }

  // Look for years (e.g. "1 year", "2 years", "1 yr")
  const yearMatch = text.match(/(\d+)\s*(?:year|yr)s?/);
  if (yearMatch) {
    const yrs = parseInt(yearMatch[1], 10);
    if (!Number.isNaN(yrs) && yrs > 0 && yrs <= 10) {
      return yrs * 12;
    }
  }

  // Look for months (e.g. "12 months", "6 months", "24 m")
  const monthMatch = text.match(/(\d+)\s*(?:month|mo|m)s?/);
  if (monthMatch) {
    const mos = parseInt(monthMatch[1], 10);
    if (!Number.isNaN(mos) && mos > 0 && mos <= 120) {
      return mos;
    }
  }

  return null;
}

export function calculateWarrantyEndDate(startDateIso: string | null, months: number | null): string | null {
  if (!startDateIso || !months || months <= 0) return null;
  const d = new Date(`${startDateIso}T00:00:00.000Z`);
  if (Number.isNaN(d.valueOf())) return null;
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function validateExtractedFields(raw: Partial<ExtractedProductFields>): ValidationResult {
  const warnings: string[] = [];

  const validated: ExtractedProductFields = {
    brand: cleanString(raw.brand, 120),
    product_name: cleanString(raw.product_name, 300),
    model: cleanString(raw.model, 120),
    category: cleanString(raw.category, 80) || "Electronics",
    serial_number: cleanString(raw.serial_number, 120),
    invoice_number: cleanString(raw.invoice_number, 120),
    order_id: cleanString(raw.order_id, 120),
    purchase_date: null,
    seller: cleanString(raw.seller, 160),
    price: null,
    currency: cleanString(raw.currency, 10) || "INR",
    warranty_duration: cleanString(raw.warranty_duration, 80),
    warranty_start_date: null,
    warranty_end_date: null,
    quantity: null,
    source_marketplace: cleanString(raw.source_marketplace, 80),
    owner_name: cleanString(raw.owner_name, 120),
    buying_method: cleanString(raw.buying_method, 80),
    image_url: cleanString(raw.image_url, 1000),
    image_urls: raw.image_urls ?? [],
    asin: cleanString(raw.asin, 20),
    source_url: cleanString(raw.source_url, 1000),
  };

  const fieldStatus: Record<keyof ExtractedProductFields, FieldConfidence> = {
    brand: "not_found",
    product_name: "not_found",
    model: "not_found",
    category: "not_found",
    serial_number: "not_found",
    invoice_number: "not_found",
    order_id: "not_found",
    purchase_date: "not_found",
    seller: "not_found",
    price: "not_found",
    currency: "not_found",
    warranty_duration: "not_found",
    warranty_start_date: "not_found",
    warranty_end_date: "not_found",
    quantity: "not_found",
    source_marketplace: "not_found",
    owner_name: "not_found",
    buying_method: "not_found",
    image_url: raw.image_url ? "confident" : "not_found",
    image_urls: raw.image_urls && raw.image_urls.length > 0 ? "confident" : "not_found",
    asin: raw.asin ? "confident" : "not_found",
    source_url: raw.source_url ? "confident" : "not_found",
  };

  // 1. Product Name
  if (validated.product_name) {
    fieldStatus.product_name = validated.product_name.length >= 3 ? "confident" : "needs_review";
  }

  // 2. Brand
  if (validated.brand) {
    fieldStatus.brand = validated.brand.length >= 2 ? "confident" : "needs_review";
  }

  // 3. Model
  if (validated.model) {
    fieldStatus.model = validated.model.length >= 2 ? "confident" : "needs_review";
  }

  // 4. Category
  if (validated.category) {
    fieldStatus.category = "confident";
  }

  // 5. Serial Number
  if (validated.serial_number) {
    fieldStatus.serial_number = validated.serial_number.length >= 3 ? "confident" : "needs_review";
  }

  // 6. Invoice Number
  if (validated.invoice_number) {
    fieldStatus.invoice_number = validated.invoice_number.length >= 3 ? "confident" : "needs_review";
  }

  // 7. Order ID
  if (validated.order_id) {
    fieldStatus.order_id = validated.order_id.length >= 3 ? "confident" : "needs_review";
  }

  // 8. Seller
  if (validated.seller) {
    fieldStatus.seller = validated.seller.length >= 2 ? "confident" : "needs_review";
  }

  // 9. Source Marketplace
  if (validated.source_marketplace) {
    fieldStatus.source_marketplace = "confident";
  }

  // 10. Owner Name
  if (validated.owner_name) {
    fieldStatus.owner_name = validated.owner_name.length >= 2 ? "confident" : "needs_review";
  }

  // 11. Buying Method
  if (validated.buying_method) {
    fieldStatus.buying_method = "confident";
  }

  // 12. Quantity
  if (typeof raw.quantity === "number" && !Number.isNaN(raw.quantity) && raw.quantity > 0) {
    validated.quantity = Math.round(raw.quantity);
    fieldStatus.quantity = "confident";
  } else if (raw.quantity !== null && raw.quantity !== undefined) {
    const q = parseInt(String(raw.quantity), 10);
    if (!Number.isNaN(q) && q > 0) {
      validated.quantity = q;
      fieldStatus.quantity = "confident";
    }
  }

  // 13. Price
  if (typeof raw.price === "number" && !Number.isNaN(raw.price) && raw.price >= 0) {
    validated.price = Math.round(raw.price * 100) / 100;
    fieldStatus.price = validated.price > 0 ? "confident" : "needs_review";
    if (validated.price === 0) warnings.push("Price extracted as 0. Please verify.");
  } else if (typeof raw.price === "string" && (raw.price as string).trim()) {
    const cleanNum = (raw.price as string).replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleanNum);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      validated.price = Math.round(parsed * 100) / 100;
      fieldStatus.price = validated.price > 0 ? "confident" : "needs_review";
    } else {
      fieldStatus.price = "needs_review";
      warnings.push("Could not parse price amount cleanly.");
    }
  }

  // 14. Currency
  if (validated.currency) {
    if (validated.currency.includes("₹") || validated.currency.toLowerCase().includes("rs")) {
      validated.currency = "INR";
    }
    fieldStatus.currency = "confident";
  }

  // 15. Purchase Date
  if (raw.purchase_date) {
    const parsed = parseDateToIso(raw.purchase_date);
    if (parsed) {
      validated.purchase_date = parsed;
      fieldStatus.purchase_date = "confident";
    } else {
      fieldStatus.purchase_date = "needs_review";
      warnings.push(`Could not reliably parse purchase date: "${String(raw.purchase_date)}".`);
    }
  }

  // 16. Warranty Duration & Calculation
  const warrantyMonths = parseWarrantyMonths(validated.warranty_duration);
  if (validated.warranty_duration) {
    if (warrantyMonths !== null) {
      fieldStatus.warranty_duration = "confident";
    } else {
      fieldStatus.warranty_duration = "needs_review";
    }
  }

  // Calculate Warranty End
  const calculatedWarrantyEnd = calculateWarrantyEndDate(validated.purchase_date, warrantyMonths);
  if (calculatedWarrantyEnd) {
    validated.warranty_end_date = calculatedWarrantyEnd;
    fieldStatus.warranty_end_date = "confident";
  }

  return {
    validatedFields: validated,
    fieldStatus,
    calculatedWarrantyMonths: warrantyMonths,
    calculatedWarrantyEnd,
    warnings,
  };
}
