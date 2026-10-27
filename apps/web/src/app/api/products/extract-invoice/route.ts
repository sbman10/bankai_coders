import { NextResponse } from "next/server";
import { isRecord, readJsonBody } from "@/lib/http/read-json-body";
import { performDocumentOcr } from "@/lib/ocr/vision";
import { extractFieldsFromText } from "@/lib/ocr/openai-parser";
import { validateExtractedFields } from "@/lib/ocr/validator";
import { findPotentialDuplicates } from "@/lib/ocr/duplicate-detector";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { prototypeStore } from "@/lib/store/prototype-store";
import { findGtinCandidates, lookupBarcodeProductImage } from "@/lib/ecommerce/product-catalog";
import {
  resolveProductLink,
  type ProductLinkResolution,
  InvalidMarketplaceUrlError,
  MarketplaceAccessError,
  PageRetrievalError,
} from "@/lib/ecommerce/link-resolver";
import type { ExtractedProductFields, InvoiceExtractionResponse, OcrEngine, OcrRawResult } from "@/lib/ocr/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

async function getExistingProducts(): Promise<Array<{ id: string; name: string; brand?: string | null; model?: string | null; order_id?: string | null; invoice_number?: string | null; serial_number?: string | null }>> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, brand, model, order_id, invoice_number, serial_number")
          .eq("user_id", user.id)
          .limit(100);
        if (!error && Array.isArray(data)) {
          return data;
        }
      }
    }
  } catch {
    // Fall back to prototypeStore
  }

  return prototypeStore.getProducts().map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    model: p.model,
    order_id: p.order_id,
    invoice_number: p.invoice_number,
    serial_number: p.serial_number,
  }));
}

async function canLookupBarcode(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    return !error && Boolean(data.user);
  } catch {
    return false;
  }
}

async function addBarcodeProductImage(
  fields: ExtractedProductFields,
  rawText: string
): Promise<ExtractedProductFields> {
  if (fields.image_url || !(await canLookupBarcode())) return fields;
  const gtin = findGtinCandidates(rawText)[0];
  if (!gtin) return fields;

  const match = await lookupBarcodeProductImage(gtin);
  if (!match) return fields;
  return { ...fields, image_url: match.imageUrl, image_urls: [match.imageUrl] };
}

function createExtractionFailureResponse(ocrResult: OcrRawResult): NextResponse {
  if (ocrResult.errorType === "server_configuration_error") {
    return NextResponse.json(
      {
        error: "Server document extraction service encountered an initialization failure. Please enter details manually or try again later.",
        engine: ocrResult.engine,
        debugError: process.env.NODE_ENV !== "production" ? ocrResult.debugError : undefined,
      },
      { status: 500 }
    );
  }
  if (ocrResult.errorType === "corrupt_document") {
    return NextResponse.json(
      {
        error: "The uploaded file appears to be damaged or not a valid document.",
        engine: ocrResult.engine,
        debugError: process.env.NODE_ENV !== "production" ? ocrResult.debugError : undefined,
      },
      { status: 400 }
    );
  }
  return NextResponse.json(
    {
      error:
        "Couldn't read this document clearly. Try uploading a higher-resolution image or a clearer scan, or enter details manually.",
      debugError: process.env.NODE_ENV !== "production" ? ocrResult.debugError : undefined,
      engine: ocrResult.engine,
    },
    { status: 422 }
  );
}

async function handleLinkResolution(productUrl: string): Promise<
  | { success: true; linkData: ProductLinkResolution }
  | { success: false; response: NextResponse }
> {
  try {
    const linkData = await resolveProductLink(productUrl);
    return { success: true, linkData };
  } catch (err) {
    if (err instanceof InvalidMarketplaceUrlError) {
      return {
        success: false,
        response: NextResponse.json({ error: err.message }, { status: 400 }),
      };
    }
    if (err instanceof MarketplaceAccessError || err instanceof PageRetrievalError) {
      return {
        success: false,
        response: NextResponse.json({ error: err.message }, { status: 422 }),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not retrieve product link." },
        { status: 422 }
      ),
    };
  }
}

function buildResponsePayload(
  rawText: string,
  engine: OcrEngine,
  extracted: ExtractedProductFields,
  duplicates: ReturnType<typeof findPotentialDuplicates>,
  linkData?: ProductLinkResolution | null
): InvoiceExtractionResponse & { invoice: Record<string, unknown>; productData?: ProductLinkResolution | null } {
  const merged: ExtractedProductFields = { ...extracted };

  if (linkData) {
    if (engine === "hybrid-invoice-link") {
      // Product Link takes priority for catalog identity & media
      if (linkData.productName) {
        merged.product_name = linkData.productName;
      }
      if (linkData.brand) {
        merged.brand = linkData.brand;
      }
      if (linkData.model) {
        merged.model = linkData.model;
      }
      if (linkData.category) {
        merged.category = linkData.category;
      }
      if (linkData.primaryImage) {
        merged.image_url = linkData.primaryImage;
        merged.image_urls = linkData.additionalImages || [];
      }
      if (linkData.marketplace) {
        merged.source_marketplace = linkData.marketplace;
      }
      merged.asin = linkData.asin || null;
      merged.source_url = linkData.sourceUrl || linkData.url || null;

      // Seller fallback from link if missing in invoice
      if (!merged.seller && linkData.seller) {
        merged.seller = linkData.seller;
      }

      // Warranty fallback from link if missing in invoice
      if (!merged.warranty_duration && linkData.warrantyDuration) {
        merged.warranty_duration = linkData.warrantyDuration;
      }

      // Note: Verified invoice facts take priority for purchase fields:
      // purchase_date, price (purchase price paid), order_id, invoice_number, owner_name, buying_method
    } else if (engine === "link-resolver") {
      // Pure product-link extraction: only data from the product page!
      merged.product_name = linkData.productName || null;
      merged.brand = linkData.brand || null;
      merged.model = linkData.model || null;
      merged.category = linkData.category || null;
      merged.seller = linkData.seller || null;
      merged.price = linkData.currentPrice?.amount ?? null;
      merged.currency = linkData.currentPrice?.currency ?? "INR";
      merged.warranty_duration = linkData.warrantyDuration || null;
      merged.source_marketplace = linkData.marketplace;
      merged.image_url = linkData.primaryImage || null;
      merged.image_urls = linkData.additionalImages || [];
      merged.asin = linkData.asin || null;
      merged.source_url = linkData.sourceUrl || linkData.url || null;

      // Purchase & invoice fields MUST remain null
      merged.purchase_date = null;
      merged.invoice_number = null;
      merged.order_id = null;
      merged.serial_number = null;
      merged.owner_name = null;
      merged.buying_method = null;
      merged.quantity = null;
      merged.warranty_start_date = null;
      merged.warranty_end_date = null;
    }
  }

  const validation = validateExtractedFields(merged);
  const v = validation.validatedFields;

  // When engine is link-resolver, explicitly ensure purchase facts are marked 'not_found'
  if (engine === "link-resolver") {
    validation.fieldStatus.purchase_date = "not_found";
    validation.fieldStatus.invoice_number = "not_found";
    validation.fieldStatus.order_id = "not_found";
    validation.fieldStatus.serial_number = "not_found";
    validation.fieldStatus.owner_name = "not_found";
    validation.fieldStatus.buying_method = "not_found";
    validation.fieldStatus.quantity = "not_found";
    validation.fieldStatus.warranty_start_date = "not_found";
    validation.fieldStatus.warranty_end_date = "not_found";

    if (linkData) {
      validation.fieldStatus.product_name =
        linkData.extractionStatus.productName === "found" ? "confident" : "not_found";
      validation.fieldStatus.brand =
        linkData.extractionStatus.brand === "found" ? "confident" : "not_found";
      validation.fieldStatus.model =
        linkData.extractionStatus.model === "found" ? "confident" : "not_found";
      validation.fieldStatus.category =
        linkData.extractionStatus.category === "found" ? "confident" : "not_found";
      validation.fieldStatus.seller =
        linkData.extractionStatus.seller === "found" ? "confident" : "not_found";
      validation.fieldStatus.price =
        linkData.extractionStatus.currentPrice === "found" ? "confident" : "not_found";
      validation.fieldStatus.warranty_duration =
        linkData.extractionStatus.warrantyDuration === "found" ? "confident" : "not_found";
      validation.fieldStatus.image_url =
        linkData.extractionStatus.primaryImage === "found" ? "confident" : "not_found";
    }
  }

  // Confidence score calculation
  let score = 0.5;
  if (v.product_name) score += 0.1;
  if (v.brand) score += 0.1;
  if (v.price !== null) score += 0.1;
  if (v.purchase_date) score += 0.1;
  if (v.order_id || v.invoice_number) score += 0.1;
  if (linkData?.primaryImage || linkData?.imageUrl) score += 0.05;

  const legacyInvoice = {
    productName: v.product_name || "Product",
    brand: v.brand,
    model: v.model,
    category: v.category,
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
    warrantyEnd: validation.calculatedWarrantyEnd,
    rawText: rawText.slice(0, 4000),
    confidence: Math.min(score, 0.98),
    imageUrl: linkData?.primaryImage || v.image_url || null,
    asin: linkData?.asin || v.asin || null,
    sourceUrl: linkData?.sourceUrl || v.source_url || null,
  };

  return {
    success: true,
    invoice: legacyInvoice,
    productData: linkData || null,
    rawText,
    ocrEngine: engine,
    extracted: v,
    fieldStatus: validation.fieldStatus,
    calculatedWarrantyMonths: validation.calculatedWarrantyMonths,
    calculatedWarrantyEnd: validation.calculatedWarrantyEnd,
    duplicates,
    warnings: validation.warnings,
    imageUrl: linkData?.primaryImage || v.image_url || null,
    imageUrls: linkData?.additionalImages || v.image_urls || [],
    asin: linkData?.asin || v.asin || null,
    sourceUrl: linkData?.sourceUrl || v.source_url || null,
  };
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");
    const isNonJsonWithFormData = !contentType.includes("application/json") && typeof request.formData === "function";

    if (isMultipart || isNonJsonWithFormData) {
      let formData: FormData | null = null;
      try {
        formData = await request.formData();
      } catch (err) {
        console.error("[extract-invoice route] formData error:", err);
        formData = null;
      }

      if (formData) {
        const file = formData.get("invoice") ?? formData.get("file");
        const productUrl = (formData.get("productUrl") ?? formData.get("url"))?.toString()?.trim() || null;
        const isBlobLike = Boolean(file && typeof (file as { arrayBuffer?: unknown }).arrayBuffer === "function");

        // Case 1: ONLY Link provided (no file)
        if (!isBlobLike && productUrl) {
          const resolution = await handleLinkResolution(productUrl);
          if (!resolution.success) {
            return resolution.response;
          }
          const linkData = resolution.linkData;
          const initialFields: ExtractedProductFields = {
            brand: linkData.brand,
            product_name: linkData.productName || null,
            model: linkData.model,
            category: linkData.category,
            serial_number: null,
            invoice_number: null,
            order_id: null,
            purchase_date: null,
            seller: linkData.seller,
            price: linkData.currentPrice?.amount ?? null,
            currency: linkData.currentPrice?.currency ?? "INR",
            warranty_duration: linkData.warrantyDuration,
            warranty_start_date: null,
            warranty_end_date: null,
            quantity: null,
            source_marketplace: linkData.marketplace,
            owner_name: null,
            buying_method: null,
            image_url: linkData.primaryImage,
            image_urls: linkData.additionalImages,
            asin: linkData.asin,
            source_url: linkData.sourceUrl,
          };
          const existingProducts = await getExistingProducts();
          const duplicates = findPotentialDuplicates(initialFields, existingProducts);
          return NextResponse.json(
            buildResponsePayload("", "link-resolver", initialFields, duplicates, linkData)
          );
        }

        // Case 2: File provided (with or without productUrl)
        if (isBlobLike) {
          const blobFile = file as Blob;
          if (blobFile.size > MAX_FILE_SIZE) {
            return NextResponse.json(
              { error: "Invoice file must be 10 MB or smaller." },
              { status: 413 }
            );
          }

          const mimeType = blobFile.type || "application/pdf";
          if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return NextResponse.json(
              { error: "Unsupported document type. Please attach a PDF, PNG, JPG, or WEBP invoice or receipt." },
              { status: 400 }
            );
          }

          const buffer = new Uint8Array(await blobFile.arrayBuffer());
          const filename = blobFile instanceof File ? blobFile.name : "invoice.pdf";

          console.log("[OCR ROUTE] Processing file:", { filename, mimeType, size: buffer.length });

          // Perform OCR
          const ocrResult = await performDocumentOcr(buffer, filename, mimeType);
          console.log("[OCR ROUTE] OCR result:", { engine: ocrResult.engine, textLength: ocrResult.text.length });

          if (!ocrResult.text || ocrResult.text.trim().length === 0) {
            return createExtractionFailureResponse(ocrResult);
          }

          // Perform Structured Extraction
          const extracted = await extractFieldsFromText(ocrResult.text);

          // Resolve link if also provided (Hybrid Flow)
          let linkData: ProductLinkResolution | null = null;
          let finalEngine = ocrResult.engine;
          if (productUrl) {
            const resolution = await handleLinkResolution(productUrl);
            if (resolution.success) {
              linkData = resolution.linkData;
              finalEngine = "hybrid-invoice-link";
            }
          }

          const imageFields = await addBarcodeProductImage(extracted, ocrResult.text);
          const existingProducts = await getExistingProducts();
          const duplicates = findPotentialDuplicates(imageFields, existingProducts);

          return NextResponse.json(
            buildResponsePayload(ocrResult.text, finalEngine, imageFields, duplicates, linkData)
          );
        }

        return NextResponse.json(
          { error: "Please attach an invoice file or enter a product link." },
          { status: 400 }
        );
      }
    }

    // 2. JSON Body Handling
    const body = await readJsonBody(request, 15 * 1024 * 1024);
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid request format." }, { status: 400 });
    }

    const productUrl = typeof body.productUrl === "string" ? body.productUrl.trim() : (typeof body.url === "string" ? body.url.trim() : null);

    // Link only via JSON
    if (productUrl && !body.text && !body.fileBase64) {
      const resolution = await handleLinkResolution(productUrl);
      if (!resolution.success) {
        return resolution.response;
      }
      const linkData = resolution.linkData;
      const initialFields: ExtractedProductFields = {
        brand: linkData.brand,
        product_name: linkData.productName || null,
        model: linkData.model,
        category: linkData.category,
        serial_number: null,
        invoice_number: null,
        order_id: null,
        purchase_date: null,
        seller: linkData.seller,
        price: linkData.currentPrice?.amount ?? null,
        currency: linkData.currentPrice?.currency ?? "INR",
        warranty_duration: linkData.warrantyDuration,
        warranty_start_date: null,
        warranty_end_date: null,
        quantity: null,
        source_marketplace: linkData.marketplace,
        owner_name: null,
        buying_method: null,
        image_url: linkData.primaryImage,
        image_urls: linkData.additionalImages,
        asin: linkData.asin,
        source_url: linkData.sourceUrl,
      };
      const existingProducts = await getExistingProducts();
      const duplicates = findPotentialDuplicates(initialFields, existingProducts);
      return NextResponse.json(
        buildResponsePayload("", "link-resolver", initialFields, duplicates, linkData)
      );
    }

    // Direct text passed
    if (typeof body.text === "string" && body.text.trim().length > 0) {
      const extracted = await extractFieldsFromText(body.text);
      let linkData: ProductLinkResolution | null = null;
      let engine: OcrEngine = "text-fallback";
      if (productUrl) {
        const resolution = await handleLinkResolution(productUrl);
        if (resolution.success) {
          linkData = resolution.linkData;
          engine = "hybrid-invoice-link";
        }
      }
      const imageFields = await addBarcodeProductImage(extracted, body.text);
      const existingProducts = await getExistingProducts();
      const duplicates = findPotentialDuplicates(imageFields, existingProducts);

      return NextResponse.json(
        buildResponsePayload(body.text, engine, imageFields, duplicates, linkData)
      );
    }

    // Base64 file passed
    if (typeof body.fileBase64 === "string" && body.fileBase64.length > 0) {
      const binaryString = atob(body.fileBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const filename = typeof body.filename === "string" ? body.filename : "invoice.pdf";
      const mimeType = typeof body.mimeType === "string" ? body.mimeType : "application/pdf";

      const ocrResult = await performDocumentOcr(bytes, filename, mimeType);
      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        return createExtractionFailureResponse(ocrResult);
      }
      const extracted = await extractFieldsFromText(ocrResult.text);

      let linkData: ProductLinkResolution | null = null;
      let engine = ocrResult.engine;
      if (productUrl) {
        const resolution = await handleLinkResolution(productUrl);
        if (resolution.success) {
          linkData = resolution.linkData;
          engine = "hybrid-invoice-link";
        }
      }
      const imageFields = await addBarcodeProductImage(extracted, ocrResult.text);

      const existingProducts = await getExistingProducts();
      const duplicates = findPotentialDuplicates(imageFields, existingProducts);

      return NextResponse.json(
        buildResponsePayload(ocrResult.text, engine, imageFields, duplicates, linkData)
      );
    }

    return NextResponse.json({ error: "Provide an invoice file, invoice text, or product link." }, { status: 400 });
  } catch (error) {
    console.error("[extract-invoice route] Unexpected failure:", error);
    return NextResponse.json(
      { error: "Failed to extract product details. Please try again or enter details manually." },
      { status: 500 }
    );
  }
}
