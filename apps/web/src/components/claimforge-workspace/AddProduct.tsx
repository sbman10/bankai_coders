"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { TechHeading } from "../TechText";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileCheck,
  FileText,
  Info,
  LoaderCircle,
  PackagePlus,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { InvoiceExtractionResponse, FieldConfidence } from "@/lib/ocr/types";

export type ProductPayload = {
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  seller: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  warrantyEnd: string | null;
  ownerName?: string | null;
  buyingMethod?: string | null;
  purchasePlatform?: string | null;
  pricePaid?: number | null;
  currency?: string | null;
  invoiceNumber?: string | null;
  orderId?: string | null;
  warrantyDurationMonths?: number | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  asin?: string | null;
};

export type CreatedProductInfo = ProductPayload & { id?: string };

interface AddProductProps {
  busy: boolean;
  onAdd: (
    product: ProductPayload,
    attachedFiles?: { invoice?: File | null; warranty?: File | null }
  ) => Promise<boolean>;
  onCancel?: () => void;
  onSuccess?: (productName: string) => void;
}

function calculateWarrantyEnd(startDateStr: string, months: number): string {
  if (!startDateStr || !months) return "";
  const d = new Date(`${startDateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.valueOf())) return "";
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function AddProduct({ busy, onAdd, onCancel, onSuccess }: AddProductProps) {
  const [entryMode, setEntryMode] = useState<"automated" | "manual">("automated");
  const [productUrl, setProductUrl] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("");
  const [seller, setSeller] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [buyingMethod, setBuyingMethod] = useState("");
  const [purchasePlatform, setPurchasePlatform] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [orderId, setOrderId] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualImageSearching, setManualImageSearching] = useState(false);

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [warrantyFile, setWarrantyFile] = useState<File | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanSummary, setScanSummary] = useState<{
    ownerName?: string | null;
    platform?: string | null;
    buyingMethod?: string | null;
    amount?: number | null;
    date?: string | null;
    seller?: string | null;
    hasImage?: boolean;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateAndSetFile(file: File): boolean {
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    const isExtensionValid = Boolean(file.name.match(/\.(pdf|png|jpe?g)$/i));
    if (!validTypes.includes(file.type) && !isExtensionValid) {
      setScanError("Please upload a PDF, PNG, or JPG file.");
      return false;
    }
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setScanError("File size exceeds the 10 MB limit. Please upload a smaller scan or receipt.");
      return false;
    }
    setInvoiceFile(file);
    setScanError("");
    return true;
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }

  function handleRemoveFile() {
    setInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setScanError("");
    setScanSuccess(false);
    setScanSummary(null);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [ocrData, setOcrData] = useState<InvoiceExtractionResponse | null>(null);
  const [showDebugOcr, setShowDebugOcr] = useState(false);

  // Review editable fields
  const [revName, setRevName] = useState("");
  const [revBrand, setRevBrand] = useState("");
  const [revModel, setRevModel] = useState("");
  const [revCategory, setRevCategory] = useState("");
  const [revSerial, setRevSerial] = useState("");
  const [revPurchaseDate, setRevPurchaseDate] = useState("");
  const [revWarrantyMonths, setRevWarrantyMonths] = useState("");
  const [revWarrantyEnd, setRevWarrantyEnd] = useState("");
  const [revPrice, setRevPrice] = useState("");
  const [revCurrency, setRevCurrency] = useState("INR");
  const [revSeller, setRevSeller] = useState("");
  const [revOwnerName, setRevOwnerName] = useState("");
  const [revBuyingMethod, setRevBuyingMethod] = useState("");
  const [revPlatform, setRevPlatform] = useState("");
  const [revInvoiceNumber, setRevInvoiceNumber] = useState("");
  const [revOrderId, setRevOrderId] = useState("");
  const [revImageUrl, setRevImageUrl] = useState("");
  const [revSourceUrl, setRevSourceUrl] = useState("");
  const [revAsin, setRevAsin] = useState("");

  function renderStatusBadge(status?: FieldConfidence, isWebLink = false) {
    if (status === "confident") {
      return (
        <span className="field-pill field-pill-confident">
          {isWebLink ? "✓ FOUND ON PRODUCT PAGE" : "✓ Confident"}
        </span>
      );
    }
    if (status === "needs_review") {
      return (
        <span className="field-pill field-pill-review">
          {isWebLink ? "⚠️ NEEDS REVIEW" : "⚠️ Needs Review"}
        </span>
      );
    }
    return (
      <span className="field-pill field-pill-notfound">
        {isWebLink ? "○ NOT FOUND" : "○ Not Found"}
      </span>
    );
  }

  async function handleAutomatedExtract(selectedFile?: File) {
    const file = selectedFile ?? invoiceFile;
    const urlVal = productUrl.trim();

    if (!file && !urlVal) {
      setScanError("Please upload an invoice file, enter a product web link, or both.");
      return;
    }

    setScanning(true);
    setScanError("");
    setScanSuccess(false);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("invoice", file);
      }
      if (urlVal) {
        formData.append("productUrl", urlVal);
      }

      const res = await fetch("/api/products/extract-invoice", {
        method: "POST",
        body: formData,
      });

      const data: InvoiceExtractionResponse & { invoice?: Record<string, unknown> } = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Could not extract product details.");

      if (file) setInvoiceFile(file);
      setOcrData(data);

      const inv = (data.invoice || {}) as Record<string, unknown>;
      const ext = (data.extracted || {}) as Record<string, unknown>;
      const isLinkOnly = data.ocrEngine === "link-resolver";

      const nameVal = String(ext.product_name ?? inv.productName ?? "").trim();
      const brandVal = String(ext.brand ?? inv.brand ?? "").trim();
      const modelVal = String(ext.model ?? inv.model ?? "").trim();
      const catVal = String(ext.category ?? inv.category ?? "").trim();
      const serialVal = isLinkOnly ? "" : String(ext.serial_number ?? "").trim();
      const dateVal = isLinkOnly ? "" : String(ext.purchase_date ?? inv.purchaseDate ?? "").trim();
      const monthsVal = data.calculatedWarrantyMonths !== null && data.calculatedWarrantyMonths !== undefined
        ? String(data.calculatedWarrantyMonths)
        : (inv.suggestedWarrantyMonths !== null && inv.suggestedWarrantyMonths !== undefined
          ? String(inv.suggestedWarrantyMonths)
          : "");
      const endVal = isLinkOnly
        ? ""
        : String(data.calculatedWarrantyEnd ?? (dateVal && monthsVal ? calculateWarrantyEnd(dateVal, Number(monthsVal)) : "")).trim();
      const priceVal = ext.price !== null && ext.price !== undefined ? String(ext.price) : (inv.amount !== null && inv.amount !== undefined ? String(inv.amount) : "");
      const currVal = String(ext.currency ?? inv.currency ?? "INR").trim();
      const sellerVal = String(ext.seller ?? inv.seller ?? "").trim();
      const ownerVal = isLinkOnly ? "" : String(ext.owner_name ?? inv.ownerName ?? "").trim();
      const methodVal = isLinkOnly ? "" : String(ext.buying_method ?? inv.buyingMethod ?? "").trim();
      const platVal = String(ext.source_marketplace ?? inv.purchasePlatform ?? "").trim();
      const invNoVal = isLinkOnly ? "" : String(ext.invoice_number ?? inv.invoiceNumber ?? "").trim();
      const ordIdVal = isLinkOnly ? "" : String(ext.order_id ?? inv.orderId ?? "").trim();
      const imgVal = String(data.imageUrl ?? ext.image_url ?? inv.imageUrl ?? "").trim();
      const srcVal = String(data.sourceUrl ?? ext.source_url ?? inv.sourceUrl ?? "").trim();
      const asinVal = String(data.asin ?? ext.asin ?? inv.asin ?? "").trim();

      // Set review fields
      setRevName(nameVal);
      setRevBrand(brandVal);
      setRevModel(modelVal);
      setRevCategory(catVal);
      setRevSerial(serialVal);
      setRevPurchaseDate(dateVal);
      setRevWarrantyMonths(monthsVal);
      setRevWarrantyEnd(endVal);
      setRevPrice(priceVal);
      setRevCurrency(currVal);
      setRevSeller(sellerVal);
      setRevOwnerName(ownerVal);
      setRevBuyingMethod(methodVal);
      setRevPlatform(platVal);
      setRevInvoiceNumber(invNoVal);
      setRevOrderId(ordIdVal);
      setRevImageUrl(imgVal);
      setRevSourceUrl(srcVal);
      setRevAsin(asinVal);

      // Populate base form
      setName(nameVal);
      setBrand(brandVal);
      setModel(modelVal);
      setCategory(catVal);
      setSerialNumber(serialVal);
      setPurchaseDate(dateVal);
      setWarrantyMonths(monthsVal);
      setWarrantyEnd(endVal);
      setPricePaid(priceVal);
      setSeller(sellerVal);
      setOwnerName(ownerVal);
      setBuyingMethod(methodVal);
      setPurchasePlatform(platVal);
      setInvoiceNumber(invNoVal);
      setOrderId(ordIdVal);

      setScanSuccess(true);
      setScanSummary({
        ownerName: ownerVal || null,
        platform: platVal || null,
        buyingMethod: methodVal || null,
        amount: priceVal ? Number(priceVal) : null,
        date: dateVal || null,
        seller: sellerVal || null,
        hasImage: Boolean(imgVal),
      });

      // Open interactive review modal
      setReviewModalOpen(true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to extract product details.");
    } finally {
      setScanning(false);
    }
  }

  async function handleConfirmReview() {
    const savedName = revName.trim();
    const saved = await onAdd({
      name: savedName,
      brand: revBrand.trim() || null,
      model: revModel.trim() || null,
      category: revCategory.trim() || "Other",
      seller: revSeller.trim() || null,
      serialNumber: revSerial.trim() || null,
      purchaseDate: revPurchaseDate || null,
      warrantyEnd: revWarrantyEnd || null,
      ownerName: revOwnerName.trim() || null,
      buyingMethod: revBuyingMethod.trim() || null,
      purchasePlatform: revPlatform.trim() || null,
      pricePaid: revPrice ? Number(revPrice) : null,
      currency: revCurrency || "INR",
      invoiceNumber: revInvoiceNumber.trim() || null,
      orderId: revOrderId.trim() || null,
      warrantyDurationMonths: revWarrantyMonths ? Number(revWarrantyMonths) : null,
      imageUrl: (manualImageUrl || revImageUrl).trim() || null,
      sourceUrl: revSourceUrl.trim() || null,
      asin: revAsin.trim() || null,
    }, {
      invoice: invoiceFile,
      warranty: warrantyFile,
    });

    if (saved) {
      setReviewModalOpen(false);
      setOcrData(null);
      resetForm();
      onSuccess?.(savedName);
    }
  }

  function handleSwitchToManual() {
    setReviewModalOpen(false);
    setEntryMode("manual");
  }

  function handleCancelReview() {
    setReviewModalOpen(false);
  }

  function handleWarrantyMonthsChange(val: string) {
    setWarrantyMonths(val);
    const m = parseInt(val, 10);
    if (!Number.isNaN(m) && purchaseDate) {
      setWarrantyEnd(calculateWarrantyEnd(purchaseDate, m));
    }
  }

  function handlePurchaseDateChange(val: string) {
    setPurchaseDate(val);
    const m = parseInt(warrantyMonths, 10);
    if (!Number.isNaN(m) && val) {
      setWarrantyEnd(calculateWarrantyEnd(val, m));
    }
  }

  function resetForm() {
    setName(""); setBrand(""); setModel(""); setCategory(""); setSeller("");
    setSerialNumber(""); setPurchaseDate(""); setWarrantyEnd("");
    setOwnerName(""); setBuyingMethod(""); setPurchasePlatform("");
    setPricePaid(""); setInvoiceNumber(""); setOrderId(""); setWarrantyMonths("12");
    setProductUrl(""); setRevImageUrl(""); setRevSourceUrl(""); setRevAsin("");
    setInvoiceFile(null); setWarrantyFile(null); setScanSuccess(false); setScanSummary(null);
    setManualImageUrl("");
  }

  async function handleAutoSearchManualImage() {
    if (!name.trim()) return;
    setManualImageSearching(true);
    try {
      const q = [brand.trim(), name.trim(), model.trim()].filter(Boolean).join(" ");
      const res = await fetch(`/api/products/search-image?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category.trim())}`);
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setManualImageUrl(data.imageUrl);
      }
    } catch {
      // non-blocking
    } finally {
      setManualImageSearching(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const savedName = name.trim();
    const saved = await onAdd({
      name: savedName,
      brand: brand.trim() || null,
      model: model.trim() || null,
      category: category.trim() || "Other",
      seller: seller.trim() || null,
      serialNumber: serialNumber.trim() || null,
      purchaseDate: purchaseDate || null,
      warrantyEnd: warrantyEnd || null,
      ownerName: ownerName.trim() || null,
      buyingMethod: buyingMethod.trim() || null,
      purchasePlatform: purchasePlatform.trim() || null,
      pricePaid: pricePaid ? Number(pricePaid) : null,
      currency: "INR",
      invoiceNumber: invoiceNumber.trim() || null,
      orderId: orderId.trim() || null,
      warrantyDurationMonths: warrantyMonths ? Number(warrantyMonths) : null,
      imageUrl: (manualImageUrl || revImageUrl).trim() || null,
      sourceUrl: revSourceUrl.trim() || productUrl.trim() || null,
      asin: revAsin.trim() || null,
    }, {
      invoice: invoiceFile,
      warranty: warrantyFile,
    });

    if (saved) {
      resetForm();
      onSuccess?.(savedName);
    }
  }

  return (
    <div className="page-content subpage-content add-product-page-layout">
      {/* Back to My Products breadcrumb / action */}
      {onCancel && (
        <div className="add-product-back-bar">
          <button
            type="button"
            className="add-product-back-btn"
            onClick={onCancel}
            aria-label="Back to My Products (Back to library)"
          >
            <ArrowLeft size={16} />
            <span>Back to My Products</span>
          </button>
        </div>
      )}

      {/* Main Page Header */}
      <div className="add-product-header">
        <div className="add-product-eyebrow">
          <span className="eyebrow-line" /> NEW PRODUCT PASSPORT
        </div>
        <TechHeading
          variant="page"
          as="h1"
          text="Add Product"
          fontSize={38}
          height={54}
          className="add-product-heading"
        />
        <p className="add-product-subtitle">
          Start with an invoice, a product link, or enter the details yourself.
        </p>
      </div>

      <div className="add-product-container">
        {/* Mode Selector Segmented Control */}
        <div className="add-product-segmented-control" role="tablist" aria-label="Registration mode">
          <button
            type="button"
            role="tab"
            aria-selected={entryMode === "automated"}
            aria-label="Automatic import"
            className={`add-product-segment-btn ${entryMode === "automated" ? "active" : ""}`}
            onClick={() => setEntryMode("automated")}
          >
            <Sparkles size={15} />
            <span>Automatic import</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={entryMode === "manual"}
            aria-label="Enter manually (Add manually)"
            className={`add-product-segment-btn ${entryMode === "manual" ? "active" : ""}`}
            onClick={() => setEntryMode("manual")}
          >
            <Edit3 size={15} />
            <span>Enter manually</span>
          </button>
        </div>

        {entryMode === "automated" ? (
          <div className="add-product-main-card">
            <div className="add-product-dual-grid">
              {/* Option 1: Invoice Upload Dropzone */}
              <div className="add-product-option-col">
                <div className="add-product-col-header">
                  <div className="add-product-icon-bubble">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h2 className="add-product-col-title">Upload an invoice</h2>
                    <p className="add-product-col-desc">
                      Choose a receipt or purchase invoice to extract available details.
                      <span className="sr-only"> Register a purchase invoice or extract details from an invoice.</span>
                    </p>
                  </div>
                </div>

                {/* Dropzone / Selected File Card */}
                {!invoiceFile ? (
                  <div
                    className={`invoice-dropzone ${isDragging ? "is-dragover" : ""}`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    aria-label="Upload invoice dropzone"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      aria-label="Upload invoice file"
                      accept="application/pdf,image/png,image/jpeg"
                      disabled={scanning || busy}
                      className="sr-only"
                      onChange={handleFileSelect}
                    />
                    <div className="dropzone-center-content">
                      <div className="dropzone-icon-ring">
                        <Upload size={18} />
                      </div>
                      <div className="dropzone-action-text">
                        <span className="dropzone-browse-cta">Browse files</span>
                        <span className="dropzone-drag-hint"> or drop invoice here</span>
                      </div>
                      <span className="dropzone-meta-info">PDF, JPG or PNG · Max 10 MB</span>
                    </div>
                  </div>
                ) : (
                  <div className="selected-file-card">
                    <div className="selected-file-main">
                      <div className="selected-file-icon-box">
                        <FileCheck size={20} color="#EA580C" />
                      </div>
                      <div className="selected-file-details">
                        <span className="selected-file-name" title={invoiceFile.name}>
                          {invoiceFile.name}
                        </span>
                        <span className="selected-file-meta">
                          {formatFileSize(invoiceFile.size)} ·{" "}
                          <span className="selected-ready-badge">Ready for extraction</span>
                        </span>
                      </div>
                    </div>
                    <div className="selected-file-actions">
                      <button
                        type="button"
                        className="file-action-link"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={scanning || busy}
                      >
                        Replace file
                      </button>
                      <button
                        type="button"
                        className="file-action-link file-action-remove"
                        onClick={handleRemoveFile}
                        disabled={scanning || busy}
                        aria-label="Remove invoice file"
                      >
                        Remove file
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        aria-label="Upload invoice file"
                        accept="application/pdf,image/png,image/jpeg"
                        disabled={scanning || busy}
                        className="sr-only"
                        onChange={handleFileSelect}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Option 2: Product Web Link */}
              <div className="add-product-option-col">
                <div className="add-product-col-header">
                  <div className="add-product-icon-bubble">
                    <ExternalLink size={18} />
                  </div>
                  <div>
                    <h2 className="add-product-col-title">Paste a product link</h2>
                    <p className="add-product-col-desc">
                      Add a product page URL to retrieve available product details.
                    </p>
                  </div>
                </div>

                <div className="product-link-input-container">
                  <div className="product-link-field-wrap">
                    <ExternalLink size={16} className="product-link-icon" />
                    <input
                      type="url"
                      aria-label="Product Web Link"
                      className="product-link-input"
                      placeholder="https://amazon.in/dp/... or store URL"
                      value={productUrl}
                      disabled={scanning || busy}
                      onChange={(e) => {
                        setProductUrl(e.target.value);
                        if (scanError) setScanError("");
                      }}
                    />
                    {productUrl && (
                      <button
                        type="button"
                        className="clear-url-btn"
                        onClick={() => setProductUrl("")}
                        aria-label="Clear URL"
                        disabled={scanning || busy}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {productUrl.trim() && (
                    <div className="automated-detected-pill" style={{ marginTop: "6px" }}>
                      {productUrl.toLowerCase().includes("amazon") || productUrl.toLowerCase().includes("amzn.")
                        ? "🛒 Amazon.in Link"
                        : productUrl.toLowerCase().includes("flipkart")
                        ? "🛒 Flipkart Link"
                        : productUrl.toLowerCase().includes("meesho")
                        ? "🛒 Meesho Link"
                        : "🌐 Web Link"}
                    </div>
                  )}
                  <p className="product-link-retailer-hint">
                    Supported: Amazon, Flipkart, Croma, Reliance Digital, or official brand stores.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {scanError && (
              <div className="add-product-error-banner" role="alert">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <div className="error-banner-body">
                  <span>{scanError}</span>
                  <button
                    type="button"
                    className="error-manual-link"
                    onClick={() => setEntryMode("manual")}
                  >
                    Enter details manually instead
                  </button>
                </div>
              </div>
            )}

            {/* Primary Action Row */}
            <div className="add-product-cta-bar">
              <button
                type="button"
                className={`button add-product-primary-cta ${
                  !scanning && (invoiceFile || productUrl.trim()) ? "is-ready" : "is-disabled"
                }`}
                disabled={scanning || busy || (!invoiceFile && !productUrl.trim())}
                onClick={() => void handleAutomatedExtract()}
                aria-label={
                  invoiceFile && productUrl.trim()
                    ? "Extract product details from invoice and link"
                    : invoiceFile
                    ? "Extract details from invoice — Extract product details"
                    : productUrl.trim()
                    ? "Fetch details from product link — Extract product details"
                    : "Extract product details"
                }
              >
                {scanning ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    <span>Extracting details…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Extract product details</span>
                  </>
                )}
              </button>

              <span className="add-product-cta-footnote">
                {invoiceFile && productUrl.trim()
                  ? "Combining invoice purchase data with live catalog specifications."
                  : invoiceFile
                  ? "Extracts seller, date, price, order #, and buyer name from your document."
                  : productUrl.trim()
                  ? "Retrieves official product image, brand, model, and catalog specifications."
                  : "Upload an invoice, paste a link, or both to extract details."}
              </span>
            </div>

            {/* Scanning Progress */}
            {scanning && (
              <div className="add-product-scanning-bar" role="status">
                <LoaderCircle size={15} className="spin" />
                <span>Reading document &amp; retrieving catalog specifications…</span>
              </div>
            )}

            {/* Scan Summary Pill Strip */}
            {scanSuccess && scanSummary && !scanning && (
              <div className="invoice-scan-summary" role="status">
                <div className="scan-summary-title">
                  <CheckCircle2 size={16} color="var(--green-600)" />
                  <span>Product details extracted successfully</span>
                </div>
                <div className="scan-summary-tags">
                  {scanSummary.ownerName && (
                    <span className="extracted-pill">
                      <strong>Owner:</strong> {scanSummary.ownerName}
                    </span>
                  )}
                  {scanSummary.amount && (
                    <span className="extracted-pill">
                      <strong>Amount:</strong> ₹{scanSummary.amount.toLocaleString("en-IN")}
                    </span>
                  )}
                  {scanSummary.date && (
                    <span className="extracted-pill">
                      <strong>Date:</strong> {scanSummary.date}
                    </span>
                  )}
                  {scanSummary.seller && (
                    <span className="extracted-pill">
                      <strong>Seller:</strong> {scanSummary.seller}
                    </span>
                  )}
                  {scanSummary.platform && (
                    <span className="extracted-pill">
                      <strong>Platform:</strong> {scanSummary.platform}
                    </span>
                  )}
                  {scanSummary.hasImage && (
                    <span className="extracted-pill photo-pill">
                      <FileCheck size={13} /> Official Photo Attached
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Manual Form Mode */
          <form className="tool-form passport-tool-form add-product-main-card" onSubmit={submit}>
            <div className="tool-form-title">
              <span className="tool-icon"><Edit3 size={18} /></span>
              <div>
                <h2>Add product passport manually</h2>
                <p>Register all product, purchase, and warranty details into your private vault.</p>
              </div>
            </div>

            {/* Section 1: Product Identity */}
            <div className="form-subheading">
              <div className="eyebrow"><span className="eyebrow-line" /> PRODUCT IDENTITY</div>
            </div>
            <div className="tool-fields tool-fields-three">
              <label>
                Product name
                <input
                  required
                  maxLength={160}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Sony WH-1000XM5"
                />
              </label>
              <label>
                Brand
                <input
                  maxLength={120}
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  placeholder="e.g. Sony"
                />
              </label>
              <label>
                Model
                <input
                  maxLength={120}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="e.g. WH-1000XM5"
                />
              </label>
            </div>

            <div className="tool-fields tool-fields-two">
              <label>
                Category
                <input
                  required
                  maxLength={80}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="e.g. Electronics, Appliances, Personal Care"
                />
              </label>
              <label>
                Serial number
                <input
                  maxLength={120}
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  placeholder="Found on box, invoice, or unit"
                />
              </label>
            </div>

            {/* Auto-find product photo */}
            {manualImageUrl ? (
              <div style={{display:"flex",alignItems:"center",gap:"14px",padding:"12px 14px",background:"var(--surface-muted,#f8fafc)",borderRadius:"10px",margin:"8px 0 16px",border:"1px solid var(--border-subtle,#e2e8f0)"}}>
                <img src={manualImageUrl} alt={name||"Product"} style={{width:"56px",height:"56px",objectFit:"contain",borderRadius:"8px",background:"#ffffff",border:"1px solid #e2e8f0",padding:"2px"}} onError={() => setManualImageUrl("")} />
                <div style={{flex:1}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:"var(--accent,#0284c7)",display:"flex",alignItems:"center",gap:"5px"}}><CheckCircle2 size={15}/> Product photograph attached</div>
                  <span style={{fontSize:"11px",color:"var(--text-muted,#64748b)"}}>Retrieved from catalog</span>
                </div>
                <button type="button" onClick={() => setManualImageUrl("")} style={{fontSize:"12px",color:"var(--text-muted,#64748b)",background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline"}}>Remove</button>
              </div>
            ) : (
              <div style={{margin:"8px 0 16px"}}>
                <button type="button" onClick={handleAutoSearchManualImage} disabled={!name.trim()||manualImageSearching} className="btn-secondary" style={{display:"inline-flex",alignItems:"center",gap:"6px",fontSize:"12px",padding:"6px 12px",borderRadius:"6px",cursor:!name.trim()?"not-allowed":"pointer",opacity:!name.trim()?0.6:1}}>
                  {manualImageSearching ? <LoaderCircle size={14} className="spin"/> : <Sparkles size={14}/>}
                  {manualImageSearching ? "Finding photo..." : "Auto-find product photo"}
                </button>
              </div>
            )}

            {/* Section 2: Purchase & Seller Details */}
            <div className="form-subheading">
              <div className="eyebrow"><span className="eyebrow-line" /> PURCHASE &amp; SELLER DETAILS</div>
            </div>
            <div className="tool-fields tool-fields-three">
              <label>
                Seller
                <input
                  maxLength={160}
                  value={seller}
                  onChange={(event) => setSeller(event.target.value)}
                  placeholder="e.g. Appario Retail, Reliance Digital"
                />
              </label>
              <label>
                Purchase platform
                <input
                  maxLength={80}
                  value={purchasePlatform}
                  onChange={(event) => setPurchasePlatform(event.target.value)}
                  placeholder="e.g. Amazon.in, Official Store"
                />
              </label>
              <label>
                Price paid (₹)
                <input
                  type="number"
                  min="0"
                  max="99999999"
                  value={pricePaid}
                  onChange={(event) => setPricePaid(event.target.value)}
                  placeholder="e.g. 26990"
                />
              </label>
            </div>

            <div className="tool-fields tool-fields-three">
              <label>
                Buyer / Owner name
                <input
                  maxLength={120}
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  placeholder="Name on the invoice"
                />
              </label>
              <label>
                Payment method
                <input
                  maxLength={80}
                  value={buyingMethod}
                  onChange={(event) => setBuyingMethod(event.target.value)}
                  placeholder="e.g. Credit Card, UPI, Net Banking"
                />
              </label>
              <label>
                Invoice / Order #
                <input
                  maxLength={120}
                  value={invoiceNumber || orderId}
                  onChange={(event) => {
                    setInvoiceNumber(event.target.value);
                    setOrderId(event.target.value);
                  }}
                  placeholder="e.g. INV-2026-90412"
                />
              </label>
            </div>

            {/* Section 3: Warranty Details */}
            <div className="form-subheading">
              <div className="eyebrow"><span className="eyebrow-line" /> WARRANTY &amp; TIMELINE</div>
            </div>
            <div className="tool-fields tool-fields-three">
              <label>
                Purchase date
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => handlePurchaseDateChange(event.target.value)}
                />
              </label>
              <label>
                Warranty duration
                <select
                  value={warrantyMonths}
                  onChange={(event) => handleWarrantyMonthsChange(event.target.value)}
                >
                  <option value="6">6 Months</option>
                  <option value="12">1 Year (12 Months)</option>
                  <option value="18">18 Months</option>
                  <option value="24">2 Years (24 Months)</option>
                  <option value="36">3 Years (36 Months)</option>
                  <option value="0">No warranty / Expired</option>
                </select>
              </label>
              <label>
                Warranty end date
                <input
                  type="date"
                  value={warrantyEnd}
                  onChange={(event) => setWarrantyEnd(event.target.value)}
                />
              </label>
            </div>

            {/* Section 4: Attach Documents */}
            <div className="form-subheading">
              <div className="eyebrow"><span className="eyebrow-line" /> ATTACH DOCUMENTS</div>
            </div>
            <div className="tool-fields tool-fields-two">
              <label className="file-field-label">
                <span>Purchase Invoice (PDF or image)</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                />
                <span className="file-hint">{invoiceFile ? invoiceFile.name : "Optional · stored privately"}</span>
              </label>
              <label className="file-field-label">
                <span>Warranty Card / Document</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => setWarrantyFile(e.target.files?.[0] || null)}
                />
                <span className="file-hint">{warrantyFile ? warrantyFile.name : "Optional · stored privately"}</span>
              </label>
            </div>

            <div className="tool-form-actions">
              <button
                disabled={busy || !name.trim()}
                className="button button-primary"
                type="submit"
              >
                <Plus size={15} /> Add product
              </button>
              {onCancel && (
                <button
                  type="button"
                  className="button button-subtle"
                  onClick={onCancel}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {/* ── Document Scanned Review & Confirmation Modal ──────────────── */}
        {reviewModalOpen && ocrData && (() => {
          const isWebLink = ocrData.ocrEngine === "link-resolver";
          return (
            <div className="ocr-review-overlay" role="dialog" aria-modal="true" aria-labelledby="ocr-review-title">
              <div className="ocr-review-modal">
                <div className="ocr-review-head">
                  <div className="ocr-review-head-left">
                    <h2 id="ocr-review-title">
                      <Sparkles size={19} color="var(--orange-500)" />
                      Product Details Extracted
                      <span className="field-pill field-pill-confident">
                        {ocrData.ocrEngine === "hybrid-invoice-link"
                          ? "⚡ Hybrid: Invoice OCR + Web Link"
                          : isWebLink
                          ? "🔗 Web Link Catalog"
                          : ocrData.ocrEngine === "google-cloud-vision"
                          ? "Google Cloud Vision"
                          : "OCR Engine"}
                      </span>
                    </h2>
                    <p>
                      {isWebLink
                        ? "Review the verified catalog information retrieved from the product page. Purchase records are not on public listings and remain unpopulated unless added manually or from an invoice."
                        : "Review the extracted purchase and product details below before confirming. You can adjust any field directly."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="card-action-btn"
                    onClick={handleCancelReview}
                    aria-label="Close review"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="ocr-review-body">
                  {/* Product Photograph Preview or Missing Notice */}
                  {revImageUrl ? (
                    <div className="ocr-product-photo-preview">
                      <img
                        src={revImageUrl}
                        alt={revName}
                        className="ocr-preview-img"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="ocr-photo-caption">
                        <span className="photo-verified-badge">
                          <CheckCircle2 size={15} /> Product Photograph Attached
                        </span>
                        <small style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                          {revAsin ? `Catalog image for ASIN ${revAsin}` : "Official product photo fetched from listing"}
                        </small>
                      </div>
                    </div>
                  ) : isWebLink ? (
                    <div className="ocr-photo-missing-banner" role="status">
                      <Info size={18} className="flex-shrink-0" />
                      <div>
                        <strong>Product image could not be retrieved</strong>
                        <p style={{ margin: "2px 0 0", fontSize: "12px" }}>
                          The marketplace did not expose a direct product photo, or access was restricted. You can enter an image URL directly into the field below, or continue saving the product passport without a photo.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Duplicate Warning Banner */}
                  {ocrData.duplicates && ocrData.duplicates.length > 0 && (
                    <div className="ocr-banner-duplicate" role="alert">
                      <AlertTriangle size={18} className="flex-shrink-0" />
                      <div>
                        <strong>Possible duplicate product or document detected</strong>
                        <p>{ocrData.duplicates[0].message} You can still confirm and save if this is an intentional addition.</p>
                      </div>
                    </div>
                  )}

                  {/* Extraction Warnings */}
                  {ocrData.warnings && ocrData.warnings.length > 0 && (
                    <div className="ocr-banner-warning" role="alert">
                      <Info size={16} className="flex-shrink-0" />
                      <div>
                        <strong>Extraction notes:</strong>
                        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                          {ocrData.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Status Legend */}
                  <div className="ocr-status-legend">
                    <span style={{ fontWeight: 600 }}>{isWebLink ? "Field extraction:" : "Field confidence:"}</span>
                    <span className="field-pill field-pill-confident">
                      {isWebLink ? "✓ FOUND ON PRODUCT PAGE" : "✓ Confident"}
                    </span>
                    <span className="field-pill field-pill-review">
                      {isWebLink ? "⚠️ NEEDS REVIEW" : "⚠️ Needs review"}
                    </span>
                    <span className="field-pill field-pill-notfound">
                      {isWebLink ? "○ NOT FOUND" : "○ Not found in document"}
                    </span>
                  </div>

                  {/* Attached Original Document Card */}
                  {invoiceFile && (
                    <div className="ocr-attached-file-info">
                      <div className="ocr-attached-file-left">
                        <FileCheck size={20} color="var(--green-600)" />
                        <div>
                          <span>{invoiceFile.name}</span>
                          <small style={{ display: "block", color: "var(--text-muted)", fontSize: "11.5px" }}>
                            {(invoiceFile.size / 1024).toFixed(1)} KB · {invoiceFile.type || "Document"}
                          </small>
                        </div>
                      </div>
                      <span className="ocr-attached-badge">
                        <ShieldCheck size={16} /> Original document will be preserved in secure private storage
                      </span>
                    </div>
                  )}

                  {/* Extracted Fields Form */}
                  <div className="ocr-fields-grid">
                    {/* Product Name */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Product Name *</span>
                        {renderStatusBadge(ocrData.fieldStatus?.product_name, isWebLink)}
                      </div>
                      <input
                        required
                        className={`ocr-field-input ${ocrData.fieldStatus?.product_name === "needs_review" ? "has-review" : ""}`}
                        value={revName}
                        onChange={(e) => setRevName(e.target.value)}
                        placeholder="e.g. Wireless Headphones"
                      />
                    </div>

                    {/* Brand */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Brand</span>
                        {renderStatusBadge(ocrData.fieldStatus?.brand, isWebLink)}
                      </div>
                      <input
                        className={`ocr-field-input ${ocrData.fieldStatus?.brand === "needs_review" ? "has-review" : ""}`}
                        value={revBrand}
                        onChange={(e) => setRevBrand(e.target.value)}
                        placeholder="e.g. Soundcore"
                      />
                    </div>

                    {/* Model */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Model</span>
                        {renderStatusBadge(ocrData.fieldStatus?.model, isWebLink)}
                      </div>
                      <input
                        className={`ocr-field-input ${ocrData.fieldStatus?.model === "needs_review" ? "has-review" : ""}`}
                        value={revModel}
                        onChange={(e) => setRevModel(e.target.value)}
                        placeholder="e.g. Q20i"
                      />
                    </div>

                    {/* Category */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Category</span>
                        {renderStatusBadge(ocrData.fieldStatus?.category, isWebLink)}
                      </div>
                      <input
                        className="ocr-field-input"
                        value={revCategory}
                        onChange={(e) => setRevCategory(e.target.value)}
                        placeholder="e.g. Headphones, Audio, etc."
                      />
                    </div>

                    {/* Seller */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Seller</span>
                        {renderStatusBadge(ocrData.fieldStatus?.seller, isWebLink)}
                      </div>
                      <input
                        className="ocr-field-input"
                        value={revSeller}
                        onChange={(e) => setRevSeller(e.target.value)}
                        placeholder="Store or seller name"
                      />
                    </div>

                    {/* Current Price / Price Paid */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">{isWebLink ? "Current Listing Price (₹)" : "Price Paid (₹)"}</span>
                        {renderStatusBadge(ocrData.fieldStatus?.price, isWebLink)}
                      </div>
                      <input
                        type="number"
                        min={0}
                        className={`ocr-field-input ${ocrData.fieldStatus?.price === "needs_review" ? "has-review" : ""}`}
                        value={revPrice}
                        onChange={(e) => setRevPrice(e.target.value)}
                        placeholder="e.g. 3999"
                      />
                    </div>

                    {/* Warranty Duration */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Warranty Duration</span>
                        {renderStatusBadge(ocrData.fieldStatus?.warranty_duration, isWebLink)}
                      </div>
                      <select
                        className="ocr-field-input"
                        value={revWarrantyMonths}
                        onChange={(e) => {
                          setRevWarrantyMonths(e.target.value);
                          const m = parseInt(e.target.value, 10);
                          if (!Number.isNaN(m) && revPurchaseDate) {
                            setRevWarrantyEnd(calculateWarrantyEnd(revPurchaseDate, m));
                          }
                        }}
                      >
                        <option value="">Not specified / None</option>
                        <option value="6">6 Months</option>
                        <option value="12">1 Year (12 Months)</option>
                        <option value="18">18 Months</option>
                        <option value="24">2 Years (24 Months)</option>
                        <option value="36">3 Years (36 Months)</option>
                        <option value="0">No warranty / Expired</option>
                      </select>
                    </div>

                    {/* Marketplace / Platform */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Marketplace / Platform</span>
                        {renderStatusBadge(ocrData.fieldStatus?.source_marketplace, isWebLink)}
                      </div>
                      <input
                        className="ocr-field-input"
                        value={revPlatform}
                        onChange={(e) => setRevPlatform(e.target.value)}
                        placeholder="Amazon, Flipkart, etc."
                      />
                    </div>

                    {/* Product Web Link */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Product Web Link</span>
                        {revSourceUrl ? (
                          <span className="field-pill field-pill-confident">✓ Linked</span>
                        ) : (
                          <span className="field-pill field-pill-notfound">○ None</span>
                        )}
                      </div>
                      <input
                        className="ocr-field-input"
                        value={revSourceUrl}
                        onChange={(e) => setRevSourceUrl(e.target.value)}
                        placeholder="https://amazon.in/dp/... or store URL"
                      />
                    </div>

                    {/* Product Photo URL */}
                    <div className="ocr-field-card">
                      <div className="ocr-field-header">
                        <span className="ocr-field-label">Product Photo URL</span>
                        {revImageUrl ? (
                          <span className="field-pill field-pill-confident">✓ Image</span>
                        ) : (
                          <span className="field-pill field-pill-notfound">○ None</span>
                        )}
                      </div>
                      <input
                        className="ocr-field-input"
                        value={revImageUrl}
                        onChange={(e) => setRevImageUrl(e.target.value)}
                        placeholder="https://... image link"
                      />
                    </div>

                    {/* If NOT link-only (i.e. Invoice provided), show invoice fields */}
                    {!isWebLink && (
                      <>
                        {/* Serial Number */}
                        <div className="ocr-field-card">
                          <div className="ocr-field-header">
                            <span className="ocr-field-label">Serial Number</span>
                            {renderStatusBadge(ocrData.fieldStatus?.serial_number)}
                          </div>
                          <input
                            className={`ocr-field-input ${ocrData.fieldStatus?.serial_number === "not_found" ? "is-empty" : ""}`}
                            value={revSerial}
                            onChange={(e) => setRevSerial(e.target.value)}
                            placeholder="Optional or from label"
                          />
                        </div>

                        {/* Purchase Date */}
                        <div className="ocr-field-card">
                          <div className="ocr-field-header">
                            <span className="ocr-field-label">Purchase Date</span>
                            {renderStatusBadge(ocrData.fieldStatus?.purchase_date)}
                          </div>
                          <input
                            type="date"
                            className={`ocr-field-input ${ocrData.fieldStatus?.purchase_date === "needs_review" ? "has-review" : ""}`}
                            value={revPurchaseDate}
                            onChange={(e) => {
                              setRevPurchaseDate(e.target.value);
                              const m = parseInt(revWarrantyMonths, 10);
                              if (!Number.isNaN(m) && e.target.value) {
                                setRevWarrantyEnd(calculateWarrantyEnd(e.target.value, m));
                              }
                            }}
                          />
                        </div>

                        {/* Warranty End Date */}
                        <div className="ocr-field-card">
                          <div className="ocr-field-header">
                            <span className="ocr-field-label">Warranty Expiry</span>
                            {renderStatusBadge(ocrData.fieldStatus?.warranty_end_date)}
                          </div>
                          <input
                            type="date"
                            className="ocr-field-input"
                            value={revWarrantyEnd}
                            onChange={(e) => setRevWarrantyEnd(e.target.value)}
                          />
                        </div>

                        {/* Invoice # */}
                        <div className="ocr-field-card">
                          <div className="ocr-field-header">
                            <span className="ocr-field-label">Invoice Number</span>
                            {renderStatusBadge(ocrData.fieldStatus?.invoice_number)}
                          </div>
                          <input
                            className="ocr-field-input"
                            value={revInvoiceNumber}
                            onChange={(e) => setRevInvoiceNumber(e.target.value)}
                            placeholder="e.g. TEST-INV-2026-10427"
                          />
                        </div>

                        {/* Order ID */}
                        <div className="ocr-field-card">
                          <div className="ocr-field-header">
                            <span className="ocr-field-label">Order ID</span>
                            {renderStatusBadge(ocrData.fieldStatus?.order_id)}
                          </div>
                          <input
                            className="ocr-field-input"
                            value={revOrderId}
                            onChange={(e) => setRevOrderId(e.target.value)}
                            placeholder="e.g. TEST-404-1234567"
                          />
                        </div>

                        {/* Buyer / Owner */}
                        <div className="ocr-field-card">
                          <div className="ocr-field-header">
                            <span className="ocr-field-label">Buyer / Owner</span>
                            {renderStatusBadge(ocrData.fieldStatus?.owner_name)}
                          </div>
                          <input
                            className="ocr-field-input"
                            value={revOwnerName}
                            onChange={(e) => setRevOwnerName(e.target.value)}
                            placeholder="Buyer name"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* If Web Link extraction: Distinct section for unavailable purchase/invoice fields */}
                  {isWebLink && (
                    <div className="ocr-link-unextracted-section">
                      <div className="ocr-link-unextracted-header">
                        <Info size={16} color="var(--orange-500)" />
                        <span>Fields not available from this product link:</span>
                      </div>
                      <p className="ocr-link-unextracted-note">
                        Product-page catalog information and personal purchase/invoice records are separate sources. Public listings do not contain your personal order or receipt details. You can enter these manually below or upload an invoice anytime:
                      </p>
                      <div className="ocr-link-unextracted-grid">
                        <div className="ocr-unextracted-row">
                          <span>Purchase Date</span>
                          <span className="unextracted-tag">○ Not available</span>
                        </div>
                        <div className="ocr-unextracted-row">
                          <span>Order ID</span>
                          <span className="unextracted-tag">○ Not available</span>
                        </div>
                        <div className="ocr-unextracted-row">
                          <span>Invoice Number</span>
                          <span className="unextracted-tag">○ Not available</span>
                        </div>
                        <div className="ocr-unextracted-row">
                          <span>Serial Number</span>
                          <span className="unextracted-tag">○ Not available</span>
                        </div>
                        <div className="ocr-unextracted-row">
                          <span>Purchase Price Paid</span>
                          <span className="unextracted-tag">○ Not available</span>
                        </div>
                      </div>

                      <details className="ocr-debug-section" style={{ marginTop: 8 }}>
                        <summary className="ocr-debug-summary">
                          + Optional: Add personal purchase details now (Invoice #, Order ID, Date, Serial #)
                        </summary>
                        <div className="ocr-fields-grid" style={{ marginTop: 12 }}>
                          <div className="ocr-field-card">
                            <span className="ocr-field-label">Purchase Date (Optional)</span>
                            <input
                              type="date"
                              className="ocr-field-input"
                              value={revPurchaseDate}
                              onChange={(e) => {
                                setRevPurchaseDate(e.target.value);
                                const m = parseInt(revWarrantyMonths, 10);
                                if (!Number.isNaN(m) && e.target.value) {
                                  setRevWarrantyEnd(calculateWarrantyEnd(e.target.value, m));
                                }
                              }}
                            />
                          </div>
                          <div className="ocr-field-card">
                            <span className="ocr-field-label">Order ID (Optional)</span>
                            <input
                              className="ocr-field-input"
                              value={revOrderId}
                              onChange={(e) => setRevOrderId(e.target.value)}
                              placeholder="e.g. 404-1234567"
                            />
                          </div>
                          <div className="ocr-field-card">
                            <span className="ocr-field-label">Invoice Number (Optional)</span>
                            <input
                              className="ocr-field-input"
                              value={revInvoiceNumber}
                              onChange={(e) => setRevInvoiceNumber(e.target.value)}
                              placeholder="e.g. INV-12345"
                            />
                          </div>
                          <div className="ocr-field-card">
                            <span className="ocr-field-label">Serial Number (Optional)</span>
                            <input
                              className="ocr-field-input"
                              value={revSerial}
                              onChange={(e) => setRevSerial(e.target.value)}
                              placeholder="e.g. SN-98765"
                            />
                          </div>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Debug Accordion */}
                  <details className="ocr-debug-section" open={showDebugOcr} onToggle={(e) => setShowDebugOcr(e.currentTarget.open)}>
                    <summary className="ocr-debug-summary">
                      ⚙️ Inspect OCR Extraction Details &amp; Raw Text (Debug)
                    </summary>
                    <div className="ocr-debug-content">
                      <strong>Engine:</strong> {ocrData.ocrEngine}<br />
                      <strong>Raw Text:</strong><br />
                      {ocrData.rawText || "(No raw text extracted)"}
                    </div>
                  </details>
                </div>

                <div className="ocr-review-foot">
                  <button
                    type="button"
                    className="button button-subtle"
                    onClick={handleSwitchToManual}
                  >
                    <Edit3 size={15} /> Enter details manually
                  </button>

                  <div className="ocr-review-actions-right">
                    <button
                      type="button"
                      className="button button-subtle"
                      onClick={handleCancelReview}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy || !revName.trim()}
                      className="button button-primary"
                      onClick={() => void handleConfirmReview()}
                    >
                      <CheckCircle2 size={16} /> Confirm &amp; Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
