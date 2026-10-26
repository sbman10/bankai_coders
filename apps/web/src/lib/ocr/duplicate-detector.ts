import type { DuplicateMatch, ExtractedProductFields } from "./types";

export type ExistingProductSummary = {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  order_id?: string | null;
  invoice_number?: string | null;
  serial_number?: string | null;
};

export function findPotentialDuplicates(
  extracted: Partial<ExtractedProductFields>,
  existingProducts: ExistingProductSummary[]
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  const targetOrderId = extracted.order_id?.trim().toLowerCase();
  const targetInvoiceNo = extracted.invoice_number?.trim().toLowerCase();
  const targetSerial = extracted.serial_number?.trim().toLowerCase();

  for (const prod of existingProducts) {
    // 1. Order ID match
    if (targetOrderId && prod.order_id && prod.order_id.trim().toLowerCase() === targetOrderId) {
      matches.push({
        productId: prod.id,
        productName: prod.name,
        matchedField: "order_id",
        matchedValue: extracted.order_id!,
        message: `An existing product "${prod.name}" has the same Order ID (${extracted.order_id}).`,
      });
      continue;
    }

    // 2. Invoice Number match
    if (targetInvoiceNo && prod.invoice_number && prod.invoice_number.trim().toLowerCase() === targetInvoiceNo) {
      matches.push({
        productId: prod.id,
        productName: prod.name,
        matchedField: "invoice_number",
        matchedValue: extracted.invoice_number!,
        message: `An existing product "${prod.name}" has the same Invoice Number (${extracted.invoice_number}).`,
      });
      continue;
    }

    // 3. Serial Number match
    if (targetSerial && prod.serial_number && prod.serial_number.trim().toLowerCase() === targetSerial) {
      matches.push({
        productId: prod.id,
        productName: prod.name,
        matchedField: "serial_number",
        matchedValue: extracted.serial_number!,
        message: `An existing product "${prod.name}" has the same Serial Number (${extracted.serial_number}).`,
      });
      continue;
    }
  }

  return matches;
}
