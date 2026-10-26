export type OcrEngine = "google-cloud-vision" | "pdfjs-fallback" | "tesseract-fallback" | "text-fallback" | "link-resolver" | "hybrid-invoice-link";

export type OcrPage = {
  pageNumber: number;
  text: string;
  confidence?: number;
};

export type OcrRawResult = {
  text: string;
  pages: OcrPage[];
  mimeType: string;
  fileName: string;
  engine: OcrEngine;
  debugError?: string;
};

export type ExtractedProductFields = {
  brand: string | null;
  product_name: string | null;
  model: string | null;
  category: string | null;
  serial_number: string | null;
  invoice_number: string | null;
  order_id: string | null;
  purchase_date: string | null;
  seller: string | null;
  price: number | null;
  currency: string | null;
  warranty_duration: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  quantity: number | null;
  source_marketplace: string | null;
  owner_name: string | null;
  buying_method: string | null;
  image_url?: string | null;
  image_urls?: string[];
  asin?: string | null;
  source_url?: string | null;
};

export type FieldConfidence = "confident" | "needs_review" | "not_found";

export type ValidationResult = {
  validatedFields: ExtractedProductFields;
  fieldStatus: Record<keyof ExtractedProductFields, FieldConfidence>;
  calculatedWarrantyMonths: number | null;
  calculatedWarrantyEnd: string | null;
  warnings: string[];
};

export type DuplicateMatch = {
  productId: string;
  productName: string;
  matchedField: "order_id" | "invoice_number" | "serial_number" | "name";
  matchedValue: string;
  message: string;
};

export type InvoiceExtractionResponse = {
  success: boolean;
  rawText: string;
  ocrEngine: OcrEngine;
  extracted: ExtractedProductFields;
  fieldStatus: Record<keyof ExtractedProductFields, FieldConfidence>;
  calculatedWarrantyMonths: number | null;
  calculatedWarrantyEnd: string | null;
  duplicates: DuplicateMatch[];
  warnings: string[];
  imageUrl?: string | null;
  imageUrls?: string[];
  asin?: string | null;
  sourceUrl?: string | null;
  error?: string;
};
