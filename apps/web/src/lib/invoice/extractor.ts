import { isPdf, extractPdfPages } from "@/lib/rag/pdf-indexer";
import { parseOcrHeuristically } from "@/lib/ocr/openai-parser";
import { validateExtractedFields } from "@/lib/ocr/validator";

export type ExtractedInvoice = {
  productName: string;
  brand: string | null;
  model: string | null;
  category: string;
  ownerName: string | null;
  buyingMethod: string | null;
  purchasePlatform: string | null;
  seller: string | null;
  amount: number | null;
  currency: string;
  purchaseDate: string | null;
  invoiceNumber: string | null;
  orderId: string | null;
  suggestedWarrantyMonths: number | null;
  rawText: string;
  confidence: number;
};

export function parseInvoiceHeuristically(text: string): ExtractedInvoice {
  const extracted = parseOcrHeuristically(text);
  const validation = validateExtractedFields(extracted);
  const v = validation.validatedFields;

  let score = 0.5;
  if (v.product_name) score += 0.1;
  if (v.brand) score += 0.1;
  if (v.price !== null) score += 0.1;
  if (v.purchase_date) score += 0.1;
  if (v.order_id || v.invoice_number) score += 0.1;

  return {
    productName: v.product_name || "Purchased Product",
    brand: v.brand,
    model: v.model,
    category: v.category || "Electronics",
    ownerName: v.owner_name,
    buyingMethod: v.buying_method,
    purchasePlatform: v.source_marketplace,
    seller: v.seller,
    amount: v.price,
    currency: v.currency || "INR",
    purchaseDate: v.purchase_date,
    invoiceNumber: v.invoice_number,
    orderId: v.order_id,
    suggestedWarrantyMonths: validation.calculatedWarrantyMonths,
    rawText: text.slice(0, 4000),
    confidence: Math.min(score, 0.98),
  };
}

export async function extractInvoiceFromBuffer(bytes: Uint8Array, filename: string): Promise<ExtractedInvoice> {
  let text = "";
  if (isPdf(bytes)) {
    try {
      const pages = await extractPdfPages(bytes);
      text = pages.map((p) => p.text).join("\n\n");
    } catch {
      text = "";
    }
  } else {
    try {
      text = new TextDecoder().decode(bytes);
    } catch {
      text = "";
    }
  }

  if (!text || text.length < 10) {
    const basename = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    return {
      productName: basename.length > 2 ? basename : "Uploaded Product Invoice",
      brand: null,
      model: null,
      category: "Electronics",
      ownerName: null,
      buyingMethod: null,
      purchasePlatform: null,
      seller: null,
      amount: null,
      currency: "INR",
      purchaseDate: null,
      invoiceNumber: null,
      orderId: null,
      suggestedWarrantyMonths: null,
      rawText: text,
      confidence: 0.5,
    };
  }

  return parseInvoiceHeuristically(text);
}
