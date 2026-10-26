"use client";

import React, { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Download,
  ExternalLink,
  FileCheck,
  FileQuestion,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { ProductVisual, getBrandSupportLink, type Product, type ProductDocument } from "./ProductCenter";
import "./ProductPassportModal.css";

export type ClaimTimelineRecord = {
  id: string;
  productId: string;
  fault: string;
  status: string;
  createdAt: string;
};

export type PriceWatch = {
  id: string;
  productId: string;
  productUrl?: string;
  currentPrice: number;
  targetPrice: number;
  lastCheckedAt: string | null;
  createdAt: string;
};

export type Reminder = {
  id: string;
  productId: string;
  product?: string;
  estimateDays: number;
  remindAt: string;
};

export type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  kind: "product" | "claim" | "price" | "reminder";
};

export interface ProductPassportModalProps {
  product: Product;
  claims: ClaimTimelineRecord[];
  watches: PriceWatch[];
  reminders: Reminder[];
  documents: ProductDocument[];
  documentsLoading: boolean;
  busy: boolean;
  onClose: () => void;
  onAddDocument: (kind: string, file: File, label?: string) => Promise<boolean>;
  onOpenDocument: (document: ProductDocument) => Promise<boolean>;
  onRemoveDocument: (document: ProductDocument) => Promise<boolean>;
  onStartClaim?: () => void;
}

export const DOCUMENT_TYPE_PRESETS = [
  { value: "invoice", label: "Purchase Invoice", canonicalKind: "invoice", defaultTitle: "Purchase Invoice" },
  { value: "warranty", label: "Warranty Card", canonicalKind: "warranty", defaultTitle: "Warranty Card" },
  { value: "manual", label: "User Manual", canonicalKind: "manual", defaultTitle: "User Manual" },
  { value: "extended_warranty", label: "Extended Warranty / AMC", canonicalKind: "extended_warranty", defaultTitle: "Extended Warranty / AMC" },
  { value: "service_receipt", label: "Service / Repair Receipt", canonicalKind: "service_receipt", defaultTitle: "Service / Repair Receipt" },
  { value: "installation", label: "Installation Document", canonicalKind: "installation", defaultTitle: "Installation Document" },
  { value: "other", label: "Other Document", canonicalKind: "other", defaultTitle: "" },
] as const;

export function formatPassportDate(value?: string | null): string {
  if (!value) return "";
  const parts = value.slice(0, 10).split("-");
  if (parts.length < 3) return value;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getDocumentDisplayMeta(doc: ProductDocument): {
  title: string;
  tag: string;
  isInvoice: boolean;
  isImage: boolean;
} {
  const isImage = doc.mimeType?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(doc.fileName);
  const isInvoice = doc.kind === "invoice";

  if (doc.label && doc.label.trim()) {
    return {
      title: doc.label.trim(),
      tag: isInvoice ? "Purchase Invoice" : doc.kind.replaceAll("_", " "),
      isInvoice,
      isImage,
    };
  }

  switch (doc.kind) {
    case "invoice":
      return { title: "Purchase Invoice", tag: "Invoice", isInvoice: true, isImage };
    case "warranty":
      return { title: "Warranty Card", tag: "Warranty", isInvoice: false, isImage };
    case "manual":
      return { title: "User Manual", tag: "Manual", isInvoice: false, isImage };
    case "extended_warranty":
      return { title: "Extended Warranty / AMC", tag: "Extended Warranty", isInvoice: false, isImage };
    case "service_receipt":
      return { title: "Service / Repair Receipt", tag: "Service", isInvoice: false, isImage };
    case "installation":
      return { title: "Installation Document", tag: "Installation", isInvoice: false, isImage };
    default:
      return { title: "Other Document", tag: "Document", isInvoice: false, isImage };
  }
}

export function getProductPassportStatusBadge(product: Product) {
  if (product.warrantyEnd) {
    const today = new Date().toISOString().slice(0, 10);
    if (product.warrantyEnd < today) {
      return { label: "Warranty Expired", cls: "status-pill status-expired", isExpired: true, isActive: false, isExpiringSoon: false };
    }
    const daysLeft = Math.ceil((new Date(product.warrantyEnd).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) {
      return { label: `Renew in ${daysLeft} days`, cls: "status-pill status-renew", isExpiringSoon: true, isActive: true, isExpired: false };
    }
    return { label: "Warranty Active", cls: "status-pill status-active", isActive: true, isExpired: false, isExpiringSoon: false };
  }
  if (product.category?.toLowerCase().includes("personal") || product.category?.toLowerCase().includes("care")) {
    return { label: "Restock Soon", cls: "status-pill status-restock", isRestock: true, isActive: false, isExpired: false, isExpiringSoon: false };
  }
  return { label: "Warranty not recorded", cls: "status-pill status-unrecorded", isUnrecorded: true, isActive: false, isExpired: false, isExpiringSoon: false };
}

export function ProductPassportModal({
  product,
  claims,
  watches,
  reminders,
  documents,
  documentsLoading,
  busy,
  onClose,
  onAddDocument,
  onOpenDocument,
  onRemoveDocument,
  onStartClaim,
}: ProductPassportModalProps) {
  const modalTitleId = useId();

  // Add Document state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("invoice");
  const [customName, setCustomName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete document confirmation tracking
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Suggestion banner dismissal (per-product session storage)
  const [isSuggestionDismissed, setIsSuggestionDismissed] = useState(false);

  // Upload success feedback
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);

  // Keyboard escape listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Derived Status
  const statusBadge = getProductPassportStatusBadge(product);

  // Derive honest warranty-action button label
  const isWarrantyConfirmedActive = Boolean(statusBadge.isActive || statusBadge.isExpiringSoon);
  const claimButtonLabel = isWarrantyConfirmedActive
    ? "Claim Under Warranty"
    : "Prepare a Claim";

  // Check for existing invoice among saved documents
  const hasInvoiceDoc = documents.some((doc) => doc.kind === "invoice");
  const hasWarrantyDoc = documents.some((doc) => doc.kind === "warranty" || doc.kind === "extended_warranty");
  const hasManualDoc = documents.some((doc) => doc.kind === "manual");

  // Show suggestion if an invoice exists (or any doc) but missing warranty or manual
  const shouldShowSuggestion =
    !isSuggestionDismissed &&
    (hasInvoiceDoc || documents.length > 0) &&
    (!hasWarrantyDoc || !hasManualDoc);

  // Build Chronological Ownership Events
  const events: TimelineEvent[] = [];
  if (product.seller || product.serialNumber) {
    events.push({
      id: `details-${product.id}`,
      date: product.purchaseDate || product.createdAt,
      title: "Product details registered",
      detail: [
        product.seller ? `Seller: ${product.seller}` : "",
        product.serialNumber ? `Serial: ${product.serialNumber}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "product",
    });
  }
  if (product.purchaseDate) {
    events.push({
      id: `purchase-${product.id}`,
      date: product.purchaseDate,
      title: "Product purchased",
      detail: product.category ? `Category: ${product.category}` : "Recorded in your product library",
      kind: "product",
    });
  }
  if (product.warrantyEnd) {
    events.push({
      id: `warranty-${product.id}`,
      date: product.warrantyEnd,
      title: "Warranty ends",
      detail: statusBadge.isExpired
        ? `Warranty coverage ended on ${formatPassportDate(product.warrantyEnd)}`
        : `Warranty coverage valid through ${formatPassportDate(product.warrantyEnd)}`,
      kind: "product",
    });
  }
  for (const claim of claims.filter((item) => item.productId === product.id)) {
    events.push({
      id: `claim-${claim.id}`,
      date: claim.createdAt,
      title: "Claim started",
      detail: `${claim.fault} · Status: ${claim.status.replaceAll("_", " ")}`,
      kind: "claim",
    });
  }
  for (const watch of watches.filter((item) => item.productId === product.id)) {
    const date = watch.lastCheckedAt || watch.createdAt;
    if (date) {
      events.push({
        id: `price-${watch.id}`,
        date,
        title: watch.lastCheckedAt ? "Price checked" : "Price watch created",
        detail: `Current: ₹${watch.currentPrice.toLocaleString("en-IN")} · Target: ₹${watch.targetPrice.toLocaleString("en-IN")}${watch.lastCheckedAt ? " · Manual update" : ""}`,
        kind: "price",
      });
    }
  }
  for (const reminder of reminders.filter((item) => item.productId === product.id)) {
    events.push({
      id: `reminder-${reminder.id}`,
      date: reminder.remindAt,
      title: "Reminder scheduled",
      detail: reminder.estimateDays
        ? `Based on your ${reminder.estimateDays}-day estimate · in-app reminder`
        : "Based on your estimate · in-app reminder",
      kind: "reminder",
    });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));

  // Support link URL
  const supportUrl = product.sourceUrl || getBrandSupportLink(product.brand);

  // File dropzone handlers
  function handleFileSelect(file: File) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setUploadError("Please choose a PDF, JPG, or PNG document.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Document must be under 10 MB.");
      return;
    }
    setUploadError("");
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    setUploadError("");

    if (!selectedFile) {
      setUploadError("Please select a document file to attach.");
      return;
    }

    if (selectedType === "other" && !customName.trim()) {
      setUploadError("Please enter a custom document name (e.g. Installation Certificate).");
      return;
    }

    const typePreset = DOCUMENT_TYPE_PRESETS.find((p) => p.value === selectedType);
    const canonicalKind = typePreset?.canonicalKind || "other";
    const resolvedLabel = selectedType === "other" ? customName.trim() : typePreset?.label;

    setIsUploading(true);
    try {
      const success = await onAddDocument(canonicalKind, selectedFile, resolvedLabel);
      if (success) {
        setSelectedFile(null);
        setCustomName("");
        setIsAddOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setUploadSuccessToast("Document attached successfully to your passport.");
        setTimeout(() => setUploadSuccessToast(null), 3500);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "The document could not be attached.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      className="passport-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <div className="passport-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* ── 1. PRODUCT IDENTITY HEADER ───────────────────────────────────── */}
        <header className="passport-modal-header">
          <div className="passport-header-identity">
            <div className="passport-hero-thumb">
              <ProductVisual product={product} className="passport-cutout-img" />
            </div>
            <div className="passport-hero-info">
              <span className="passport-hero-brand">
                {product.brand ? product.brand : "DIGITAL PRODUCT PASSPORT"}
              </span>
              <h2 id={modalTitleId} className="passport-hero-title">
                {product.name}
              </h2>
              <div className="passport-hero-meta-row">
                {product.model && (
                  <span className="passport-hero-model">Model: {product.model}</span>
                )}
                <span className={statusBadge.cls}>
                  <span className="status-dot" />
                  {statusBadge.label}
                </span>
              </div>
            </div>
          </div>
          <div className="passport-header-actions">
            <button
              type="button"
              className="passport-close-btn"
              onClick={onClose}
              aria-label="Close passport"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── SCROLLABLE PASSPORT BODY ──────────────────────────────────────── */}
        <div className="passport-modal-scroll-body">
          {/* ── 2. PURCHASE DETAILS SECTION ─────────────────────────────────── */}
          <section className="passport-section passport-purchase-section" aria-label="Purchase facts">
            <div className="passport-section-head">
              <div className="passport-section-title-wrap">
                <div className="passport-section-eyebrow">
                  <span className="eyebrow-line" /> PURCHASE DETAILS
                </div>
                <h3 className="passport-section-title">Purchase &amp; Warranty</h3>
              </div>
            </div>

            {/* 3 Prominent Highlight Cards */}
            <div className="passport-highlights-grid">
              {/* Purchase Price */}
              <div className="passport-highlight-card">
                <div className="highlight-label-row">
                  <Tag size={12} />
                  <span>Purchase Price</span>
                </div>
                <div className="highlight-value">
                  {product.pricePaid !== undefined && product.pricePaid !== null ? (
                    `₹${product.pricePaid.toLocaleString("en-IN")}`
                  ) : (
                    <span className="passport-fact-unrecorded">Not recorded</span>
                  )}
                </div>
                <div className="highlight-subtext">
                  {product.buyingMethod
                    ? `Payment: ${product.buyingMethod}`
                    : product.purchasePlatform
                    ? `Platform: ${product.purchasePlatform}`
                    : "Verified purchase currency: INR"}
                </div>
              </div>

              {/* Purchase Date */}
              <div className="passport-highlight-card">
                <div className="highlight-label-row">
                  <Calendar size={12} />
                  <span>Purchase Date</span>
                </div>
                <div className="highlight-value">
                  {product.purchaseDate ? (
                    formatPassportDate(product.purchaseDate)
                  ) : (
                    <span className="passport-fact-unrecorded">Not recorded</span>
                  )}
                </div>
                <div className="highlight-subtext">
                  {product.purchaseDate
                    ? "Recorded purchase date"
                    : "Add invoice or date to record"}
                </div>
              </div>

              {/* Warranty Coverage */}
              <div className="passport-highlight-card">
                <div className="highlight-label-row">
                  <ShieldCheck size={12} />
                  <span>Warranty Valid Until</span>
                </div>
                <div className="highlight-value">
                  {product.warrantyEnd ? (
                    formatPassportDate(product.warrantyEnd)
                  ) : (
                    <span className="passport-fact-unrecorded">Not recorded</span>
                  )}
                </div>
                <div className="highlight-subtext">
                  <span className={statusBadge.cls} style={{ fontSize: 11, padding: "2px 6px" }}>
                    {statusBadge.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Secondary Metadata Fact Grid */}
            <div className="passport-facts-card">
              <div className="passport-fact-item">
                <span className="passport-fact-label">Store / Seller</span>
                <span className="passport-fact-value">
                  {product.seller || product.purchasePlatform || (
                    <span className="passport-fact-unrecorded">Not recorded</span>
                  )}
                </span>
              </div>

              <div className="passport-fact-item">
                <span className="passport-fact-label">Invoice Number</span>
                <span className="passport-fact-value font-mono">
                  {product.invoiceNumber || (
                    <span className="passport-fact-unrecorded">Not recorded</span>
                  )}
                </span>
              </div>

              <div className="passport-fact-item">
                <span className="passport-fact-label">Order ID</span>
                <span className="passport-fact-value font-mono">
                  {product.orderId || (
                    <span className="passport-fact-unrecorded">Not recorded</span>
                  )}
                </span>
              </div>

              <div className="passport-fact-item">
                <span className="passport-fact-label">Serial Number</span>
                <span className="passport-fact-value font-mono">
                  {product.serialNumber ? (
                    product.serialNumber
                  ) : (
                    <span className="passport-fact-unrecorded">Not recorded</span>
                  )}
                </span>
              </div>

              <div className="passport-fact-item">
                <span className="passport-fact-label">Registered Owner</span>
                <span className="passport-fact-value">
                  {product.ownerName || (
                    <span className="passport-fact-unrecorded">Private Account</span>
                  )}
                </span>
              </div>

              <div className="passport-fact-item">
                <span className="passport-fact-label">Category</span>
                <span className="passport-fact-value">{product.category || "Other"}</span>
              </div>
            </div>
          </section>

          {/* ── 3. YOUR DOCUMENTS SECTION ───────────────────────────────────── */}
          <section className="passport-section passport-documents-section" aria-label="Product documents">
            <div className="passport-section-head">
              <div className="passport-section-title-wrap">
                <div className="passport-section-eyebrow">
                  <span className="eyebrow-line" /> YOUR DOCUMENTS
                </div>
                <h3 className="passport-section-title">Verified Documents Vault</h3>
              </div>

              <div className="passport-docs-header-right">
                <span className="passport-docs-count-pill">
                  {documents.length} {documents.length === 1 ? "SAVED FILE" : "SAVED FILES"}
                </span>
                <button
                  type="button"
                  className="passport-add-doc-trigger"
                  onClick={() => setIsAddOpen((prev) => !prev)}
                  aria-expanded={isAddOpen}
                >
                  <Plus size={14} />
                  <span>Add Document</span>
                </button>
              </div>
            </div>

            {/* Thoughtful Document Suggestion Banner */}
            {shouldShowSuggestion && (
              <div className="passport-suggestion-banner" role="complementary" aria-label="Document suggestion">
                <div className="passport-suggestion-left">
                  <Sparkles size={16} className="passport-suggestion-icon" />
                  <div className="passport-suggestion-text-wrap">
                    <strong className="passport-suggestion-heading">Keep your product documents together.</strong>
                    <span className="passport-suggestion-desc">
                      Add a warranty card, user manual, service receipt or any other important document for easy access later.
                    </span>
                  </div>
                </div>
                <div className="passport-suggestion-actions">
                  <button
                    type="button"
                    className="passport-suggestion-add-btn"
                    onClick={() => {
                      if (!hasWarrantyDoc) {
                        setSelectedType("warranty");
                      } else if (!hasManualDoc) {
                        setSelectedType("manual");
                      } else {
                        setSelectedType("service_receipt");
                      }
                      setIsAddOpen(true);
                    }}
                  >
                    + Add Document
                  </button>
                  <button
                    type="button"
                    className="passport-suggestion-dismiss-btn"
                    onClick={() => setIsSuggestionDismissed(true)}
                    aria-label="Dismiss suggestion"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Subtle Upload Success Feedback */}
            {uploadSuccessToast && (
              <div className="passport-upload-success-toast" role="status" aria-live="polite">
                <FileCheck size={16} color="#059669" />
                <span>{uploadSuccessToast}</span>
              </div>
            )}

            {/* Add Document Form / Drawer */}
            {(isAddOpen || documents.length === 0) && (
              <form className="passport-document-form passport-add-drawer" onSubmit={handleAddSubmit}>
                <div className="passport-drawer-head">
                  <div>
                    <h4 className="passport-drawer-title">Attach Document to Passport</h4>
                    <p className="passport-drawer-subtitle">
                      Choose document category, select your file (PDF, JPG, PNG up to 10 MB), and save securely.
                    </p>
                  </div>
                  {documents.length > 0 && (
                    <button
                      type="button"
                      className="passport-close-btn"
                      onClick={() => setIsAddOpen(false)}
                      aria-label="Close add document form"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <div className="passport-form-grid">
                  <div className="passport-form-group">
                    <label htmlFor="doc-type-select" className="passport-form-label">
                      Document type
                    </label>
                    <select
                      id="doc-type-select"
                      className="passport-form-select"
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                    >
                      {DOCUMENT_TYPE_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Name field shown when "Other Document" is chosen */}
                  {selectedType === "other" && (
                    <div className="passport-form-group">
                      <label htmlFor="custom-doc-name" className="passport-form-label">
                        Document Name (Custom)
                      </label>
                      <input
                        id="custom-doc-name"
                        type="text"
                        className="passport-form-input"
                        placeholder="e.g. Installation Certificate, Repair Quotation..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </div>
                  )}
                </div>

                {/* Dropzone with accessible file input */}
                <div className="passport-form-group">
                  <label htmlFor="passport-file-input" className="passport-file-label">
                    <span className="passport-form-label" style={{ display: "block", marginBottom: 6 }}>
                      Choose document
                    </span>
                    {!selectedFile ? (
                      <div
                        className={`passport-dropzone ${isDragging ? "active" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <UploadCloud size={24} className="passport-dropzone-icon" />
                        <span className="passport-dropzone-text">
                          Click to choose file, or drag and drop here
                        </span>
                        <span className="passport-dropzone-sub">
                          PDF, JPG, or PNG · Up to 10 MB · Private to your account
                        </span>
                      </div>
                    ) : (
                      <div className="passport-selected-file-card">
                        <div className="passport-selected-file-info">
                          <FileCheck size={18} color="#059669" />
                          <div>
                            <div className="passport-selected-file-name">{selectedFile.name}</div>
                            <div className="passport-selected-file-size">
                              {formatFileSize(selectedFile.size)} · {selectedFile.type || "file"}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="passport-btn-secondary"
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          style={{ padding: "4px 8px", fontSize: 11 }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </label>
                  <input
                    id="passport-file-input"
                    ref={fileInputRef}
                    name="passport-file"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>

                {uploadError && (
                  <div className="upload-error" role="alert" style={{ fontSize: 12 }}>
                    <AlertCircle size={14} />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div className="passport-drawer-actions">
                  {documents.length > 0 && (
                    <button
                      type="button"
                      className="passport-btn-secondary"
                      onClick={() => {
                        setIsAddOpen(false);
                        setSelectedFile(null);
                        setUploadError("");
                      }}
                      disabled={isUploading}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="passport-btn-primary"
                    disabled={isUploading || !selectedFile}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={14} className="spinner" />
                        <span>Attaching document…</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Attach document</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Documents Listing */}
            {documentsLoading ? (
              <div className="passport-empty-docs">
                <Loader2 size={20} className="spinner" />
                <span>Loading your private product documents…</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="passport-empty-docs">
                <FileQuestion size={28} strokeWidth={1.5} color="#A8A29E" />
                <strong style={{ color: "#1C1917" }}>No documents attached yet</strong>
                <span>
                  Keep your purchase invoice, warranty card, or user manual safe and easily accessible here.
                </span>
                <button
                  type="button"
                  className="passport-add-doc-trigger"
                  onClick={() => setIsAddOpen(true)}
                  style={{ marginTop: 6 }}
                >
                  <Plus size={14} />
                  <span>Attach your first document</span>
                </button>
              </div>
            ) : (
              <div className="passport-docs-list">
                {documents.map((doc) => {
                  const meta = getDocumentDisplayMeta(doc);
                  const isDeleting = deletingDocId === doc.id;

                  return (
                    <div key={doc.id} className="passport-doc-row">
                      <div className="passport-doc-row-left">
                        <div
                          className={`passport-doc-type-icon ${
                            meta.isInvoice ? "icon-invoice" : meta.isImage ? "icon-image" : ""
                          }`}
                        >
                          {meta.isInvoice ? (
                            <FileCheck size={18} />
                          ) : meta.isImage ? (
                            <ImageIcon size={18} />
                          ) : (
                            <FileText size={18} />
                          )}
                        </div>

                        <div className="passport-doc-text">
                          <div className="passport-doc-title-row">
                            <span className="passport-doc-label">{meta.title}</span>
                            <span
                              className={`passport-doc-tag ${meta.isInvoice ? "tag-invoice" : ""}`}
                            >
                              {meta.tag}
                            </span>
                          </div>
                          <span className="passport-doc-meta">
                            <strong>{doc.fileName}</strong> · {formatFileSize(doc.sizeBytes)}
                            {doc.createdAt ? ` · Added ${formatPassportDate(doc.createdAt)}` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="passport-doc-actions">
                        {/* Open/View Action */}
                        {doc.signedUrl ? (
                          <a
                            className="passport-doc-action-btn"
                            href={doc.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open file"
                          >
                            <span>Open file</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="passport-doc-action-btn"
                            disabled={busy}
                            onClick={() => onOpenDocument(doc)}
                            aria-label="Prepare private link"
                          >
                            <span>Prepare private link</span>
                            <ExternalLink size={12} />
                          </button>
                        )}

                        {/* Download Action */}
                        {doc.signedUrl ? (
                          <a
                            className="passport-doc-action-btn"
                            href={doc.signedUrl}
                            download={doc.fileName}
                            aria-label={`Download ${doc.fileName}`}
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="passport-doc-action-btn"
                            disabled={busy}
                            onClick={async () => {
                              await onOpenDocument(doc);
                            }}
                            aria-label={`Download ${doc.fileName}`}
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </button>
                        )}

                        {/* Delete Action with Confirmation */}
                        {isDeleting ? (
                          <div className="passport-delete-confirm">
                            <span>Delete?</span>
                            <button
                              type="button"
                              className="passport-confirm-delete-btn"
                              disabled={busy}
                              onClick={async () => {
                                await onRemoveDocument(doc);
                                setDeletingDocId(null);
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              className="passport-cancel-delete-btn"
                              onClick={() => setDeletingDocId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="passport-doc-delete-btn"
                            disabled={busy}
                            onClick={() => setDeletingDocId(doc.id)}
                            aria-label={`Delete ${doc.fileName}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── 4. OWNERSHIP HISTORY (TIMELINE) ─────────────────────────────── */}
          <section className="passport-section passport-history-section" aria-label="Ownership history">
            <div className="passport-section-head">
              <div className="passport-section-title-wrap">
                <div className="passport-section-eyebrow">
                  <span className="eyebrow-line" /> OWNERSHIP HISTORY
                </div>
                <h3 className="passport-section-title" id="product-timeline-title">
                  Ownership history <span className="sr-only">{product.name} timeline</span>
                </h3>
              </div>
            </div>

            <div className="passport-timeline-wrap">
              {events.length === 0 ? (
                <div className="passport-empty-docs">
                  <span>No timeline events recorded yet.</span>
                </div>
              ) : (
                <div className="passport-timeline-track">
                  {events.map((event) => (
                    <div key={event.id} className="passport-timeline-node">
                      <div className={`passport-timeline-dot dot-${event.kind}`} />
                      <div className="passport-timeline-topline">
                        <span className="passport-timeline-date">
                          {formatPassportDate(event.date.slice(0, 10))}
                        </span>
                        <strong className="passport-timeline-title">{event.title}</strong>
                      </div>
                      <div className="passport-timeline-detail">{event.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── 5. FOOTER ACTIONS ────────────────────────────────────────────── */}
        <footer className="passport-modal-footer">
          <div>
            {supportUrl ? (
              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="passport-footer-support-link"
              >
                <span>Visit Official Manufacturer Support</span>
                <ExternalLink size={13} />
              </a>
            ) : (
              <span style={{ fontSize: 12, color: "#78716C" }}>
                Product records stored securely in your private account.
              </span>
            )}
          </div>

          <div className="passport-footer-buttons">
            {onStartClaim && (
              <button
                type="button"
                className="passport-claim-action-btn"
                onClick={() => {
                  onClose();
                  onStartClaim();
                }}
              >
                <span>{claimButtonLabel}</span>
                <ArrowRight size={14} />
              </button>
            )}
            <button type="button" className="passport-close-action-btn" onClick={onClose}>
              Close Passport
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default ProductPassportModal;
