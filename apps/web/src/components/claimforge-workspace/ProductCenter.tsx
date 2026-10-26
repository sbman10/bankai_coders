"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Clock3, Edit3, ExternalLink, FileCheck, FileText, Info, LayoutGrid, List, LoaderCircle, PackagePlus, Plus, ShieldCheck, ShoppingBag, Sparkles, Trash2, TrendingDown, Upload, X } from "lucide-react";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { InvoiceExtractionResponse, FieldConfidence } from "@/lib/ocr/types";
import { HeadphoneThumb, LaptopThumb, PhoneThumb, RefrigeratorThumb, SneakerThumb, SunscreenThumb, WatchThumb } from "./ProductVisuals";

type Product = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  seller: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyEnd: string;
  ownerName?: string;
  buyingMethod?: string;
  purchasePlatform?: string;
  pricePaid?: number;
  currency?: string;
  invoiceNumber?: string;
  orderId?: string;
  warrantyDurationMonths?: number;
  imageUrl?: string;
  imageUrls?: string[];
  sourceUrl?: string;
  asin?: string;
  createdAt: string;
};

type PriceWatch = {
  id: string;
  productId: string;
  name: string;
  url: string;
  currentPrice: number;
  targetPrice: number;
  currency: string;
  lastCheckedAt: string;
  createdAt: string;
};

type Reminder = {
  id: string;
  productId: string;
  product: string;
  estimateDays: number;
  remindAt: string;
};

type ClaimTimelineRecord = { id: string; productId: string; fault: string; status: string; createdAt: string };
type TimelineEvent = { id: string; date: string; title: string; detail: string; kind: "product" | "claim" | "price" | "reminder" };
type ProductDocument = { id: string; productId: string; kind: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string; signedUrl?: string };

type ProductCenterView = "products" | "prices" | "reminders" | "timeline";
type ProductPayload = {
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

function calculateWarrantyEnd(startDateStr: string, months: number): string {
  if (!startDateStr || !months) return "";
  const d = new Date(`${startDateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.valueOf())) return "";
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function renderProductThumbnail(product: Product) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt={product.name}
        className="product-thumb-img"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = "none";
        }}
      />
    );
  }
  const query = `${product.name} ${product.brand} ${product.model} ${product.category}`.toLowerCase();
  if (query.includes("headphone") || query.includes("audio") || query.includes("earphone") || query.includes("soundcore") || query.includes("wh-1000xm") || query.includes("airpod") || query.includes("anc")) {
    return <HeadphoneThumb className="product-thumb-svg" />;
  }
  if (query.includes("refrigerator") || query.includes("fridge") || query.includes("appliance") || query.includes("lg")) {
    return <RefrigeratorThumb className="product-thumb-svg" />;
  }
  if (query.includes("watch") || query.includes("titan") || query.includes("timepiece") || query.includes("analog")) {
    return <WatchThumb className="product-thumb-svg" />;
  }
  if (query.includes("sunscreen") || query.includes("cream") || query.includes("lotion") || query.includes("serum") || query.includes("personal care") || query.includes("spf")) {
    return <SunscreenThumb className="product-thumb-svg" />;
  }
  if (query.includes("sneaker") || query.includes("shoe") || query.includes("footwear") || query.includes("nike") || query.includes("running")) {
    return <SneakerThumb className="product-thumb-svg" />;
  }
  if (query.includes("iphone") || query.includes("phone") || query.includes("pixel") || query.includes("mobile") || query.includes("samsung")) {
    return <PhoneThumb className="product-thumb-svg" />;
  }
  if (query.includes("macbook") || query.includes("laptop") || query.includes("computer") || query.includes("notebook") || query.includes("pc")) {
    return <LaptopThumb className="product-thumb-svg" />;
  }
  return (
    <div className="product-thumb-fallback">
      <PackagePlus size={36} />
    </div>
  );
}

function getProductStatusBadge(product: Product) {
  if (product.warrantyEnd) {
    const today = new Date().toISOString().slice(0, 10);
    if (product.warrantyEnd < today) {
      return { label: "Warranty Expired", cls: "status-pill status-expired" };
    }
    const daysLeft = Math.ceil((new Date(product.warrantyEnd).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) {
      return { label: `Renew in ${daysLeft} days`, cls: "status-pill status-renew" };
    }
    return { label: "Warranty Active", cls: "status-pill status-active" };
  }
  if (product.category?.toLowerCase().includes("personal") || product.category?.toLowerCase().includes("care")) {
    return { label: "Restock Soon", cls: "status-pill status-restock" };
  }
  if (product.purchasePlatform) {
    return { label: `Via ${product.purchasePlatform}`, cls: "status-pill status-platform" };
  }
  return { label: "Added Manually", cls: "status-pill status-manual" };
}

const headings: Record<ProductCenterView, [string, string, string]> = {
  products: ["YOUR PRODUCT LIBRARY", "Products with a paper trail.", "Keep purchase details and warranty dates together in your private account."],
  prices: ["MANUAL PRICE WATCH", "Know when the price is right.", "Record the price you see and compare it with your target. No retailer scraping is running."],
  reminders: ["PRODUCT-SPECIFIC REMINDERS", "A nudge on your terms.", "Set a reminder using your own estimated usage period. It appears in your ProductVault timeline."],
  timeline: ["UNIFIED PRODUCT TIMELINE", "Your complete ownership history.", "Chronological events across all your products, warranties, reminders, and price watches."],
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers } });
  const result = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error || "The change could not be saved. Please try again.");
  return result;
}

function productFromRow(row: Record<string, unknown>): Product {
  const imageUrl = row.image_url
    ? String(row.image_url)
    : Array.isArray(row.image_urls) && row.image_urls[0]
    ? String(row.image_urls[0])
    : undefined;

  return {
    id: String(row.id),
    name: String(row.name),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    category: String(row.category ?? "Other"),
    seller: String(row.seller ?? ""),
    serialNumber: String(row.serial_number ?? ""),
    purchaseDate: String(row.purchase_date ?? ""),
    warrantyEnd: String(row.warranty_end ?? ""),
    ownerName: row.owner_name ? String(row.owner_name) : undefined,
    buyingMethod: row.buying_method ? String(row.buying_method) : undefined,
    purchasePlatform: row.purchase_platform ? String(row.purchase_platform) : undefined,
    pricePaid: row.price_paid !== null && row.price_paid !== undefined ? Number(row.price_paid) : undefined,
    currency: row.currency ? String(row.currency) : "INR",
    invoiceNumber: row.invoice_number ? String(row.invoice_number) : undefined,
    orderId: row.order_id ? String(row.order_id) : undefined,
    warrantyDurationMonths: row.warranty_duration_months !== null && row.warranty_duration_months !== undefined ? Number(row.warranty_duration_months) : undefined,
    imageUrl,
    imageUrls: Array.isArray(row.image_urls) ? (row.image_urls as string[]) : (imageUrl ? [imageUrl] : undefined),
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    asin: row.asin ? String(row.asin) : undefined,
    createdAt: String(row.created_at ?? ""),
  };
}

function relationName(value: unknown): string {
  if (Array.isArray(value)) value = value[0];
  return typeof value === "object" && value !== null && "name" in value ? String(value.name) : "Product";
}

function priceWatchFromRow(row: Record<string, unknown>): PriceWatch {
  return {
    id: String(row.id), productId: String(row.product_id), name: relationName(row.products), url: String(row.product_url ?? ""),
    currentPrice: Number(row.current_price ?? 0), targetPrice: Number(row.target_price ?? 0), currency: String(row.currency ?? "INR"),
    lastCheckedAt: String(row.last_checked_at ?? ""), createdAt: String(row.created_at ?? ""),
  };
}

function claimFromRow(row: Record<string, unknown>): ClaimTimelineRecord {
  return { id: String(row.id), productId: String(row.product_id), fault: String(row.fault_description ?? "Claim details added"), status: String(row.status ?? "received"), createdAt: String(row.created_at ?? "") };
}

function productDocumentFromRow(row?: Record<string, unknown>): ProductDocument {
  if (!row) {
    return { id: "", productId: "", kind: "", fileName: "", mimeType: "", sizeBytes: 0, createdAt: "" };
  }
  return { id: String(row.id ?? ""), productId: String(row.product_id ?? ""), kind: String(row.document_kind ?? ""), fileName: String(row.original_filename ?? ""), mimeType: String(row.mime_type ?? ""), sizeBytes: Number(row.size_bytes ?? 0), createdAt: String(row.created_at ?? "") };
}

function reminderFromRow(row: Record<string, unknown>): Reminder {
  const estimate = String(row.reason ?? "").match(/estimated (\d+)-day/);
  return {
    id: String(row.id), productId: String(row.product_id), product: relationName(row.products),
    estimateDays: estimate ? Number(estimate[1]) : 0, remindAt: String(row.remind_at).slice(0, 10),
  };
}

export function ProductCenter({ view }: { view: ProductCenterView }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [watches, setWatches] = useState<PriceWatch[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [claims, setClaims] = useState<ClaimTimelineRecord[]>([]);
  const [timelineProductId, setTimelineProductId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const documentsRequest = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setReady(false);
    setError("");
    try {
      const [productResult, watchResult, reminderResult, claimResult] = await Promise.all([
        api<{ products: Record<string, unknown>[] }>("/api/products"),
        api<{ watches: Record<string, unknown>[] }>("/api/price-watches"),
        api<{ reminders: Record<string, unknown>[] }>("/api/reminders"),
        api<{ claims: Record<string, unknown>[] }>("/api/claims"),
      ]);
      setProducts(productResult.products.map(productFromRow));
      setWatches(watchResult.watches.map(priceWatchFromRow));
      setReminders(reminderResult.reminders.map(reminderFromRow));
      setClaims(claimResult.claims.map(claimFromRow));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your account items could not be loaded.");
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function addProduct(payload: ProductPayload, files?: { invoice?: File | null; warranty?: File | null }) {
    const result = await api<{ product: Record<string, unknown> }>("/api/products", { method: "POST", body: JSON.stringify(payload) });
    const newProduct = productFromRow(result.product);
    setProducts((current) => [newProduct, ...current]);
    setNotice("Product saved to your account.");
    if (files?.invoice) {
      try {
        await addProductDocument(newProduct.id, "invoice", files.invoice);
      } catch {
        // best effort background upload
      }
    }
    if (files?.warranty) {
      try {
        await addProductDocument(newProduct.id, "warranty_card", files.warranty);
      } catch {
        // best effort background upload
      }
    }
  }

  async function updateProduct(id: string, payload: ProductPayload) {
    const result = await api<{ product: Record<string, unknown> }>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setProducts((current) => current.map((product) => product.id === id ? productFromRow(result.product) : product));
    setNotice("Product details updated.");
  }

  async function removeProduct(id: string) {
    await api(`/api/products/${id}`, { method: "DELETE" });
    setProducts((current) => current.filter((product) => product.id !== id));
    setNotice("Product removed.");
  }

  async function addWatch(payload: { productId: string; productUrl: string; currentPrice: number; targetPrice: number }) {
    const result = await api<{ watch: Record<string, unknown> }>("/api/price-watches", { method: "POST", body: JSON.stringify(payload) });
    setWatches((current) => [priceWatchFromRow(result.watch), ...current]);
    setNotice("Manual price watch saved.");
  }

  async function updateWatch(id: string, currentPrice: number) {
    const result = await api<{ watch: Record<string, unknown> }>(`/api/price-watches/${id}`, { method: "PATCH", body: JSON.stringify({ currentPrice }) });
    setWatches((current) => current.map((watch) => watch.id === id ? priceWatchFromRow(result.watch) : watch));
    setNotice("Price update saved.");
  }

  async function removeWatch(id: string) {
    await api(`/api/price-watches/${id}`, { method: "DELETE" });
    setWatches((current) => current.filter((watch) => watch.id !== id));
    setNotice("Price watch removed.");
  }

  async function addReminder(payload: { productId: string; estimateDays: number; remindAt: string }) {
    const result = await api<{ reminder: Record<string, unknown> }>("/api/reminders", { method: "POST", body: JSON.stringify(payload) });
    setReminders((current) => [...current, reminderFromRow(result.reminder)].sort((a, b) => a.remindAt.localeCompare(b.remindAt)));
    setNotice("In-app reminder scheduled.");
  }

  async function removeReminder(id: string) {
    await api(`/api/reminders/${id}`, { method: "DELETE" });
    setReminders((current) => current.filter((reminder) => reminder.id !== id));
    setNotice("Reminder cancelled.");
  }

  async function showProductTimeline(id: string) {
    const requestId = ++documentsRequest.current;
    setTimelineProductId(id);
    setDocuments([]);
    setDocumentsLoading(true);
    try {
      const result = await api<{ documents: Record<string, unknown>[] }>(`/api/products/${id}/documents`);
      if (requestId === documentsRequest.current) setDocuments(result.documents.map(productDocumentFromRow));
    } catch (cause) {
      if (requestId === documentsRequest.current) setError(cause instanceof Error ? cause.message : "Product documents could not be loaded.");
    } finally {
      if (requestId === documentsRequest.current) setDocumentsLoading(false);
    }
  }

  async function addProductDocument(productId: string, kind: string, file: File): Promise<boolean> {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) throw new Error("Choose a PDF, JPG, or PNG document.");
    if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Each document must be between 1 byte and 10 MB.");
    const supabase = createBrowserSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Your sign-in expired. Sign in again and retry.");
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9._-]+$/g, "").slice(0, 139) || "product-document";
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const storage = supabase.storage.from("claim-documents");
    const { error: uploadError } = await storage.upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error("Could not upload to private storage. Check the storage setup and retry.");
    try {
      const result = await api<{ document?: Record<string, unknown> }>(`/api/products/${productId}/documents`, {
        method: "POST", body: JSON.stringify({ productId, documentKind: kind, storagePath, fileName: file.name.slice(0, 240), mimeType: file.type, sizeBytes: file.size }),
      });
      if (result?.document) {
        setDocuments((current) => [productDocumentFromRow(result.document), ...current]);
      }
      setNotice("Document attached to the product passport.");
      return true;
    } catch (cause) {
      await storage.remove([storagePath]);
      throw cause;
    }
  }

  async function prepareDocumentLink(document: ProductDocument) {
    const result = await api<{ url: string }>(`/api/products/${document.productId}/documents/${document.id}`);
    setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, signedUrl: result.url } : item));
    setNotice("Private document link ready for 60 seconds.");
  }

  async function removeProductDocument(document: ProductDocument) {
    await api(`/api/products/${document.productId}/documents/${document.id}`, { method: "DELETE" });
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    setNotice("Document removed from private storage and the product passport.");
  }

  async function perform(action: () => Promise<void>): Promise<boolean> {
    setError(""); setNotice(""); setBusy(true);
    try { await action(); return true; } catch (cause) { setError(cause instanceof Error ? cause.message : "The change could not be saved."); return false; }
    finally { setBusy(false); }
  }

  const heading = headings[view];
  return (
    <div className="page-content subpage-content">
      <div className="eyebrow"><span className="eyebrow-line" /> {heading[0]}</div>
      <div className="product-page-heading"><div><h1>{heading[1]}</h1><p>{heading[2]}</p></div><span className="local-mode-pill account-mode-pill">ACCOUNT SYNC</span></div>
      {!ready ? <div className="tool-empty" role="status">Loading your account items…</div> : <>
        {error && <div className="product-feedback product-feedback-error" role="alert"><AlertTriangle size={15} />{error}<button type="button" onClick={() => void load()}>Try again</button></div>}
        {notice && !error && <p role="status" className="product-feedback product-feedback-success"><CheckCircle2 size={15} />{notice}</p>}
        {view === "products" ? <>
          <ProductLibrary products={products} busy={busy} onAdd={(payload, files) => perform(() => addProduct(payload, files))} onUpdate={(id, payload) => perform(() => updateProduct(id, payload))} onRemove={(id) => perform(() => removeProduct(id))} onTimeline={(id) => { void showProductTimeline(id); }} />
          {timelineProductId && products.some((product) => product.id === timelineProductId) ? <ProductTimeline product={products.find((product) => product.id === timelineProductId)!} claims={claims} watches={watches} reminders={reminders} documents={documents} documentsLoading={documentsLoading} busy={busy} onClose={() => { documentsRequest.current++; setTimelineProductId(null); setDocuments([]); }} onAddDocument={(kind, file) => perform(async () => { await addProductDocument(timelineProductId, kind, file); })} onOpenDocument={(document) => perform(async () => { await prepareDocumentLink(document); })} onRemoveDocument={(document) => perform(async () => { await removeProductDocument(document); })} /> : null}
        </> : null}
        {view === "prices" ? <PriceTracker products={products} watches={watches} busy={busy} onAdd={(watch) => perform(() => addWatch(watch))} onUpdate={(id, price) => perform(() => updateWatch(id, price))} onRemove={(id) => perform(() => removeWatch(id))} /> : null}
        {view === "reminders" ? <ReminderList products={products} reminders={reminders} busy={busy} onAdd={(reminder) => perform(() => addReminder(reminder))} onRemove={(id) => perform(() => removeReminder(id))} /> : null}
        {view === "timeline" ? <UnifiedTimelineView products={products} claims={claims} watches={watches} reminders={reminders} onSelectProduct={(id) => { void showProductTimeline(id); }} /> : null}
      </>}
      <p className="local-data-note"><AlertTriangle size={14} /> Your product records are private to your account. Price checks are manual; reminders currently appear inside ProductVault.</p>
    </div>
  );
}

function ProductLibrary({
  products,
  busy,
  onAdd,
  onUpdate,
  onRemove,
  onTimeline,
}: {
  products: Product[];
  busy: boolean;
  onAdd: (product: ProductPayload, attachedFiles?: { invoice?: File | null; warranty?: File | null }) => Promise<boolean>;
  onUpdate: (id: string, product: ProductPayload) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onTimeline: (id: string) => void;
}) {
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

  const [editing, setEditing] = useState<Product | null>(null);
  const [displayLayout, setDisplayLayout] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    products.forEach((p) => {
      const cat = p.category?.trim() || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") return products;
    return products.filter((p) => (p.category?.trim() || "Other").toLowerCase() === selectedCategory.toLowerCase());
  }, [products, selectedCategory]);

  // Document Scanned Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [ocrData, setOcrData] = useState<InvoiceExtractionResponse | null>(null);
  const [showDebugOcr, setShowDebugOcr] = useState(false);

  // Review editable fields
  const [revName, setRevName] = useState("");
  const [revBrand, setRevBrand] = useState("");
  const [revModel, setRevModel] = useState("");
  const [revCategory, setRevCategory] = useState("Electronics");
  const [revSerial, setRevSerial] = useState("");
  const [revPurchaseDate, setRevPurchaseDate] = useState("");
  const [revWarrantyMonths, setRevWarrantyMonths] = useState("12");
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

  function renderStatusBadge(status?: FieldConfidence) {
    if (status === "confident") {
      return <span className="field-pill field-pill-confident">✓ Confident</span>;
    }
    if (status === "needs_review") {
      return <span className="field-pill field-pill-review">⚠️ Needs Review</span>;
    }
    return <span className="field-pill field-pill-notfound">○ Not Found</span>;
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

      const nameVal = String(ext.product_name ?? inv.productName ?? "").trim();
      const brandVal = String(ext.brand ?? inv.brand ?? "").trim();
      const modelVal = String(ext.model ?? inv.model ?? "").trim();
      const catVal = String(ext.category ?? inv.category ?? "Electronics").trim();
      const serialVal = String(ext.serial_number ?? "").trim();
      const dateVal = String(ext.purchase_date ?? inv.purchaseDate ?? "").trim();
      const monthsVal = String(data.calculatedWarrantyMonths ?? inv.suggestedWarrantyMonths ?? 12);
      const endVal = String(data.calculatedWarrantyEnd ?? (dateVal ? calculateWarrantyEnd(dateVal, Number(monthsVal)) : "")).trim();
      const priceVal = ext.price !== null && ext.price !== undefined ? String(ext.price) : (inv.amount !== null && inv.amount !== undefined ? String(inv.amount) : "");
      const currVal = String(ext.currency ?? inv.currency ?? "INR").trim();
      const sellerVal = String(ext.seller ?? inv.seller ?? "").trim();
      const ownerVal = String(ext.owner_name ?? inv.ownerName ?? "").trim();
      const methodVal = String(ext.buying_method ?? inv.buyingMethod ?? "").trim();
      const platVal = String(ext.source_marketplace ?? inv.purchasePlatform ?? "").trim();
      const invNoVal = String(ext.invoice_number ?? inv.invoiceNumber ?? "").trim();
      const ordIdVal = String(ext.order_id ?? inv.orderId ?? "").trim();
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

      // Populate base form in background
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
    const saved = await onAdd({
      name: revName.trim(),
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
      imageUrl: revImageUrl.trim() || null,
      sourceUrl: revSourceUrl.trim() || null,
      asin: revAsin.trim() || null,
    }, {
      invoice: invoiceFile,
      warranty: warrantyFile,
    });

    if (saved) {
      setReviewModalOpen(false);
      setOcrData(null);
      setName(""); setBrand(""); setModel(""); setCategory(""); setSeller("");
      setSerialNumber(""); setPurchaseDate(""); setWarrantyEnd("");
      setOwnerName(""); setBuyingMethod(""); setPurchasePlatform("");
      setPricePaid(""); setInvoiceNumber(""); setOrderId(""); setWarrantyMonths("12");
      setProductUrl(""); setRevImageUrl(""); setRevSourceUrl(""); setRevAsin("");
      setInvoiceFile(null); setWarrantyFile(null); setScanSuccess(false); setScanSummary(null);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onAdd({
      name: name.trim(),
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
      imageUrl: null,
      sourceUrl: null,
      asin: null,
    }, {
      invoice: invoiceFile,
      warranty: warrantyFile,
    });

    if (saved) {
      setName(""); setBrand(""); setModel(""); setCategory(""); setSeller("");
      setSerialNumber(""); setPurchaseDate(""); setWarrantyEnd("");
      setOwnerName(""); setBuyingMethod(""); setPurchasePlatform("");
      setPricePaid(""); setInvoiceNumber(""); setOrderId(""); setWarrantyMonths("12");
      setProductUrl(""); setRevImageUrl(""); setRevSourceUrl(""); setRevAsin("");
      setInvoiceFile(null); setWarrantyFile(null); setScanSuccess(false); setScanSummary(null);
    }
  }

  return (
    <>
      <div className="add-product-container">
        {/* Mode Selector Tabs — 2 Main Options */}
        <div className="add-product-modes" role="tablist" aria-label="Add product methods">
          <button
            type="button"
            role="tab"
            aria-selected={entryMode === "automated"}
            className={`passport-mode-tab ${entryMode === "automated" ? "active" : ""}`}
            onClick={() => setEntryMode("automated")}
          >
            <Sparkles size={16} />
            <span>Add through invoice and product link</span>
            <span className="mode-badge-ai">AI Automation</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={entryMode === "manual"}
            className={`passport-mode-tab ${entryMode === "manual" ? "active" : ""}`}
            onClick={() => setEntryMode("manual")}
          >
            <Edit3 size={15} />
            <span>Add manually</span>
          </button>
        </div>

        {entryMode === "automated" ? (
          <div className="tool-form passport-tool-form">
            <div className="tool-form-title">
              <span className="tool-icon"><Sparkles size={18} /></span>
              <div>
                <h2>Add through invoice and product link</h2>
                <p>Add only invoice, only product link, or both together. Invoices provide verified owner, date, and price; links retrieve official product photography and catalog specs.</p>
              </div>
            </div>

            {/* Dual Input Area */}
            <div className="automated-inputs-grid">
              {/* Option Box 1: Invoice File */}
              <div className="automated-box">
                <div className="automated-box-header">
                  <div className="automated-box-icon"><FileText size={18} /></div>
                  <div className="automated-box-titles">
                    <strong>1. Purchase Invoice / Receipt</strong>
                    <p>PDF, PNG, JPG up to 10 MB. Extracts buyer name, price paid, purchase date, order #, and seller.</p>
                  </div>
                </div>

                <div className="invoice-file-picker">
                  <label className="invoice-file-label" style={{ width: "100%", justifyContent: "center" }}>
                    <Upload size={14} />
                    <span>{invoiceFile ? invoiceFile.name : "Choose Invoice Document"}</span>
                    <input
                      type="file"
                      aria-label="Upload invoice file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setInvoiceFile(f);
                      }}
                    />
                  </label>
                  {invoiceFile && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      <span className="file-selected-pill">✓ {invoiceFile.name} ({(invoiceFile.size / 1024).toFixed(0)} KB)</span>
                      <button
                        type="button"
                        className="text-link-xs"
                        style={{ color: "var(--red-500)", border: "none", background: "none", cursor: "pointer" }}
                        onClick={() => setInvoiceFile(null)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Option Box 2: Product Link */}
              <div className="automated-box">
                <div className="automated-box-header">
                  <div className="automated-box-icon"><ShoppingBag size={18} /></div>
                  <div className="automated-box-titles">
                    <strong>2. Product Web Link</strong>
                    <p>Amazon, Flipkart, Meesho, or store URL. Fetches product photograph, title, brand, and model.</p>
                  </div>
                </div>

                <div className="automated-link-input-wrap">
                  <ExternalLink size={16} className="automated-link-icon" />
                  <input
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://www.amazon.in/dp/... or store URL"
                    aria-label="Product Web Link"
                  />
                </div>

                {productUrl.trim() && (
                  <div className="automated-detected-pill">
                    {productUrl.toLowerCase().includes("amazon")
                      ? "🛒 Amazon.in Link"
                      : productUrl.toLowerCase().includes("flipkart")
                      ? "🛒 Flipkart Link"
                      : productUrl.toLowerCase().includes("meesho")
                      ? "🛒 Meesho Link"
                      : "🌐 Web Link"}
                  </div>
                )}
              </div>
            </div>

            {/* Explanatory hint banner */}
            <div className="automated-hint-banner">
              <Info size={16} className="flex-shrink-0" color="var(--orange-500)" />
              <span>
                <strong>Flexible automation:</strong> You can provide only an invoice, only a product link, or both together. When both are added, official product photographs and verified invoice ownership details are automatically fused.
              </span>
            </div>

            {/* Scanning Indicator */}
            {scanning && (
              <div className="scanning-indicator" role="status">
                <LoaderCircle size={18} className="animate-spin" />
                <span>
                  {invoiceFile && productUrl.trim()
                    ? "Scanning invoice OCR & retrieving product photograph from link…"
                    : invoiceFile
                    ? "Scanning invoice document with OCR…"
                    : "Fetching product photograph & catalog details from link…"}
                </span>
              </div>
            )}

            {scanError && (
              <p className="product-feedback product-feedback-error" role="alert">
                <AlertTriangle size={15} /> {scanError}
              </p>
            )}

            {scanSuccess && scanSummary && (
              <div className="invoice-scan-summary" role="status">
                <div className="scan-summary-title">
                  <CheckCircle2 size={16} />
                  <span>Product details detected successfully! Review and confirm below:</span>
                </div>
                <div className="scan-summary-tags">
                  {scanSummary.ownerName && <span className="extracted-pill">👤 Buyer: {scanSummary.ownerName}</span>}
                  {scanSummary.platform && <span className="extracted-pill">🛒 Platform: {scanSummary.platform}</span>}
                  {scanSummary.seller && <span className="extracted-pill">🏪 Seller: {scanSummary.seller}</span>}
                  {scanSummary.amount && <span className="extracted-pill">💰 Paid: ₹{scanSummary.amount.toLocaleString("en-IN")}</span>}
                  {scanSummary.buyingMethod && <span className="extracted-pill">💳 Payment: {scanSummary.buyingMethod}</span>}
                  {scanSummary.date && <span className="extracted-pill">📅 Date: {formatDate(scanSummary.date)}</span>}
                  {scanSummary.hasImage && <span className="extracted-pill">📸 Photo Attached</span>}
                </div>
                {ocrData && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="button button-subtle"
                      onClick={() => setReviewModalOpen(true)}
                    >
                      <Sparkles size={14} /> Open Review &amp; Confirmation Dialog
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Actions Bar */}
            <div className="automated-actions-bar">
              <button
                type="button"
                disabled={scanning || (!invoiceFile && !productUrl.trim())}
                className="button button-primary automated-start-btn"
                onClick={() => void handleAutomatedExtract()}
              >
                {invoiceFile && productUrl.trim() ? (
                  <>
                    <Sparkles size={16} /> Extract Invoice &amp; Fetch Product Link
                  </>
                ) : invoiceFile ? (
                  <>
                    <FileText size={16} /> Extract Details from Invoice
                  </>
                ) : productUrl.trim() ? (
                  <>
                    <ExternalLink size={16} /> Fetch Details from Product Link
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Extract Details (Upload Invoice or Add Link)
                  </>
                )}
              </button>

              <button
                type="button"
                className="button button-subtle"
                onClick={() => setEntryMode("manual")}
              >
                <Edit3 size={14} /> Enter manually instead
              </button>
            </div>
          </div>
        ) : (
          <form className="tool-form passport-tool-form" onSubmit={submit}>
            <div className="tool-form-title">
              <span className="tool-icon"><PackagePlus size={18} /></span>
              <div>
                <h2>Add product passport manually</h2>
                <p>Enter your product identity, ownership dates, and purchase details.</p>
              </div>
            </div>

            {/* Product Identity */}
            <div className="form-subheading">
              <span className="eyebrow"><span className="eyebrow-line" /> PRODUCT DETAILS</span>
            </div>
            <div className="tool-fields tool-fields-four">
              <label>Product name<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Wireless headphones" /></label>
              <label>Brand<input maxLength={120} value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="e.g. Auralis" /></label>
              <label>Model<input maxLength={120} value={model} onChange={(event) => setModel(event.target.value)} placeholder="e.g. Pulse 2" /></label>
              <label>Category<input maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Audio, personal care…" /></label>
            </div>

            {/* Purchase & Financial Details */}
            <div className="form-subheading">
              <span className="eyebrow"><span className="eyebrow-line" /> PURCHASE &amp; TRANSACTION DETAILS</span>
            </div>
            <div className="tool-fields tool-fields-four">
              <label>Owner / Buyer name<input maxLength={120} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="e.g. Rohan Sharma" /></label>
              <label>Buying method<input maxLength={80} value={buyingMethod} onChange={(event) => setBuyingMethod(event.target.value)} placeholder="Credit Card, UPI, COD…" /></label>
              <label>Store / Platform<input maxLength={80} value={purchasePlatform} onChange={(event) => setPurchasePlatform(event.target.value)} placeholder="Amazon.in, Flipkart, Meesho, Store…" /></label>
              <label>Seller<input maxLength={160} value={seller} onChange={(event) => setSeller(event.target.value)} placeholder="Store or retailer" /></label>
              <label>Amount paid (₹)<input type="number" min={0} value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} placeholder="e.g. 5999" /></label>
              <label>Invoice / Order #<input maxLength={120} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="e.g. IN-2026-88192" /></label>
              <label>Serial number<input maxLength={120} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Optional" /></label>
            </div>

            {/* Warranty & Timeline Linking */}
            <div className="form-subheading">
              <span className="eyebrow"><span className="eyebrow-line" /> TIMELINE &amp; WARRANTY DATES</span>
            </div>
            <div className="tool-fields tool-fields-three">
              <label>Purchase date<input type="date" value={purchaseDate} onChange={(event) => handlePurchaseDateChange(event.target.value)} /></label>
              <label>Warranty duration
                <select value={warrantyMonths} onChange={(event) => handleWarrantyMonthsChange(event.target.value)}>
                  <option value="6">6 Months</option>
                  <option value="12">1 Year (12 Months)</option>
                  <option value="18">18 Months</option>
                  <option value="24">2 Years (24 Months)</option>
                  <option value="36">3 Years (36 Months)</option>
                  <option value="0">No warranty</option>
                </select>
              </label>
              <label>Warranty end<input type="date" value={warrantyEnd} onChange={(event) => setWarrantyEnd(event.target.value)} /></label>
            </div>

            {/* Document Attachments */}
            <div className="form-subheading">
              <span className="eyebrow"><span className="eyebrow-line" /> ATTACH DOCUMENTS (OPTIONAL)</span>
            </div>
            <div className="tool-fields tool-fields-two">
              <label className="passport-doc-input">
                <span>Warranty Form / Policy Document</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => setWarrantyFile(e.target.files?.[0] ?? null)}
                />
                {warrantyFile && <small className="file-selected-pill">✓ {warrantyFile.name}</small>}
              </label>
              <label className="passport-doc-input">
                <span>Purchase Invoice</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                />
                {invoiceFile && <small className="file-selected-pill">✓ {invoiceFile.name}</small>}
              </label>
            </div>

            <div className="tool-form-actions">
              <button disabled={busy} className="button button-primary" type="submit">
                <Plus size={15} /> Add product
              </button>
            </div>
          </form>
        )}

        {/* ── Document Scanned Review & Confirmation Modal ──────────────── */}
        {reviewModalOpen && ocrData && (
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
                        : ocrData.ocrEngine === "link-resolver"
                        ? "🔗 Web Link Catalog"
                        : ocrData.ocrEngine === "google-cloud-vision"
                        ? "Google Cloud Vision"
                        : "OCR Engine"}
                    </span>
                  </h2>
                  <p>Review the extracted purchase and product details below before confirming. You can adjust any field directly.</p>
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
                {/* Product Photograph Preview */}
                {revImageUrl && (
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
                        {revAsin ? `Catalog image for ASIN ${revAsin}` : "Official product photo fetched from link"}
                      </small>
                    </div>
                  </div>
                )}

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
                  <span style={{ fontWeight: 600 }}>Field confidence:</span>
                  <span className="field-pill field-pill-confident">✓ Confidently extracted</span>
                  <span className="field-pill field-pill-review">⚠️ Needs review</span>
                  <span className="field-pill field-pill-notfound">○ Not found in document</span>
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
                      {renderStatusBadge(ocrData.fieldStatus?.product_name)}
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
                      {renderStatusBadge(ocrData.fieldStatus?.brand)}
                    </div>
                    <input
                      className={`ocr-field-input ${ocrData.fieldStatus?.brand === "needs_review" ? "has-review" : ""}`}
                      value={revBrand}
                      onChange={(e) => setRevBrand(e.target.value)}
                      placeholder="e.g. DemoSound"
                    />
                  </div>

                  {/* Model */}
                  <div className="ocr-field-card">
                    <div className="ocr-field-header">
                      <span className="ocr-field-label">Model</span>
                      {renderStatusBadge(ocrData.fieldStatus?.model)}
                    </div>
                    <input
                      className={`ocr-field-input ${ocrData.fieldStatus?.model === "needs_review" ? "has-review" : ""}`}
                      value={revModel}
                      onChange={(e) => setRevModel(e.target.value)}
                      placeholder="e.g. TEST-Q20"
                    />
                  </div>

                  {/* Category */}
                  <div className="ocr-field-card">
                    <div className="ocr-field-header">
                      <span className="ocr-field-label">Category</span>
                      {renderStatusBadge(ocrData.fieldStatus?.category)}
                    </div>
                    <input
                      className="ocr-field-input"
                      value={revCategory}
                      onChange={(e) => setRevCategory(e.target.value)}
                      placeholder="Electronics, Appliances…"
                    />
                  </div>

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

                  {/* Price Paid */}
                  <div className="ocr-field-card">
                    <div className="ocr-field-header">
                      <span className="ocr-field-label">Price Paid (₹)</span>
                      {renderStatusBadge(ocrData.fieldStatus?.price)}
                    </div>
                    <input
                      type="number"
                      min={0}
                      className={`ocr-field-input ${ocrData.fieldStatus?.price === "needs_review" ? "has-review" : ""}`}
                      value={revPrice}
                      onChange={(e) => setRevPrice(e.target.value)}
                      placeholder="e.g. 2499"
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

                  {/* Warranty Duration */}
                  <div className="ocr-field-card">
                    <div className="ocr-field-header">
                      <span className="ocr-field-label">Warranty Duration</span>
                      {renderStatusBadge(ocrData.fieldStatus?.warranty_duration)}
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
                      <option value="6">6 Months</option>
                      <option value="12">1 Year (12 Months)</option>
                      <option value="18">18 Months</option>
                      <option value="24">2 Years (24 Months)</option>
                      <option value="36">3 Years (36 Months)</option>
                      <option value="0">No warranty / Expired</option>
                    </select>
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

                  {/* Seller */}
                  <div className="ocr-field-card">
                    <div className="ocr-field-header">
                      <span className="ocr-field-label">Seller</span>
                      {renderStatusBadge(ocrData.fieldStatus?.seller)}
                    </div>
                    <input
                      className="ocr-field-input"
                      value={revSeller}
                      onChange={(e) => setRevSeller(e.target.value)}
                      placeholder="Store or seller name"
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

                  {/* Marketplace / Platform */}
                  <div className="ocr-field-card">
                    <div className="ocr-field-header">
                      <span className="ocr-field-label">Marketplace / Platform</span>
                      {renderStatusBadge(ocrData.fieldStatus?.source_marketplace)}
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
                </div>

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
        )}
      </div>


      <section className="tool-list" aria-labelledby="products-list-title">
        <div className="tool-list-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> PRODUCT PASSPORTS</div>
            <h2 id="products-list-title">Your saved products</h2>
          </div>
          <span className="quiet-count">{products.length} ITEMS</span>
        </div>

        {/* Category Filter Pills & Layout Switcher */}
        {products.length > 0 && (
          <div className="library-controls-bar">
            <div className="category-filter-list" role="tablist" aria-label="Filter products by department">
              {categories.map(([cat, count]) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat} ({count})
                </button>
              ))}
            </div>

            <div className="layout-switcher" aria-label="View layout switcher">
              <button
                type="button"
                className={`layout-btn ${displayLayout === "grid" ? "active" : ""}`}
                onClick={() => setDisplayLayout("grid")}
                aria-label="Grid layout"
                title="Grid view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                className={`layout-btn ${displayLayout === "list" ? "active" : ""}`}
                onClick={() => setDisplayLayout("list")}
                aria-label="List layout"
                title="List view"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        )}

        {products.length === 0 ? (
          <div className="tool-empty">Your library is empty. Add a product above to start its passport.</div>
        ) : displayLayout === "grid" ? (
          <div className="products-grid-layout">
            {filteredProducts.map((product) => {
              const badge = getProductStatusBadge(product);
              return (
                <article className="product-card" key={product.id}>
                  <div className="product-card-top">
                    <span className={badge.cls}>
                      <span className="status-dot" />
                      {badge.label}
                    </span>
                    <div className="product-card-actions">
                      <button
                        type="button"
                        className="card-action-btn"
                        aria-label={`View timeline for ${product.name}`}
                        title="View timeline & documents"
                        onClick={() => onTimeline(product.id)}
                      >
                        <Clock3 size={15} />
                      </button>
                      <button
                        type="button"
                        className="card-action-btn"
                        aria-label={`Edit ${product.name}`}
                        title="Edit product"
                        onClick={() => setEditing(product)}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        className="card-action-btn card-action-delete"
                        aria-label={`Remove ${product.name}`}
                        title="Remove product"
                        disabled={busy}
                        onClick={() => onRemove(product.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {editing?.id === product.id ? (
                    <form
                      className="product-edit-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const saved = await onUpdate(product.id, {
                          name: editing.name,
                          brand: editing.brand || null,
                          model: editing.model || null,
                          category: editing.category,
                          seller: editing.seller || null,
                          serialNumber: editing.serialNumber || null,
                          purchaseDate: editing.purchaseDate || null,
                          warrantyEnd: editing.warrantyEnd || null,
                        });
                        if (saved) setEditing(null);
                      }}
                    >
                      <label>Name<input required maxLength={160} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
                      <label>Brand<input maxLength={120} value={editing.brand} onChange={(event) => setEditing({ ...editing, brand: event.target.value })} /></label>
                      <label>Model<input maxLength={120} value={editing.model} onChange={(event) => setEditing({ ...editing, model: event.target.value })} /></label>
                      <label>Category<input maxLength={80} value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} /></label>
                      <label>Seller<input maxLength={160} value={editing.seller} onChange={(event) => setEditing({ ...editing, seller: event.target.value })} /></label>
                      <label>Serial<input maxLength={120} value={editing.serialNumber} onChange={(event) => setEditing({ ...editing, serialNumber: event.target.value })} /></label>
                      <label>Purchased<input type="date" value={editing.purchaseDate} onChange={(event) => setEditing({ ...editing, purchaseDate: event.target.value })} /></label>
                      <label>Warranty end<input type="date" value={editing.warrantyEnd} onChange={(event) => setEditing({ ...editing, warrantyEnd: event.target.value })} /></label>
                      <button className="inline-action-button" type="submit" disabled={busy}>Save</button>
                      <button className="inline-action-button" type="button" onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <div className="product-card-visual" onClick={() => onTimeline(product.id)}>
                        <div className="product-thumb-box">
                          {renderProductThumbnail(product)}
                        </div>
                      </div>

                      <div className="product-card-body">
                        <strong className="product-card-name" title={product.name}>
                          {product.name}
                        </strong>
                        <p className="product-card-meta">
                          {product.purchasePlatform
                            ? `Via ${product.purchasePlatform}${product.pricePaid ? ` · ₹${product.pricePaid.toLocaleString("en-IN")}` : ""}`
                            : product.brand || product.model
                            ? [product.brand, product.model].filter(Boolean).join(" · ")
                            : `Added ${formatDate(product.purchaseDate) || "Recently"}`}
                        </p>
                      </div>

                      <div className="product-card-footer">
                        <button
                          type="button"
                          className="card-docs-btn"
                          onClick={() => onTimeline(product.id)}
                          title="View documents & timeline"
                        >
                          <FileText size={14} />
                          <span>View Documents & Timeline</span>
                          <ArrowRight size={13} className="docs-arrow" />
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          filteredProducts.map((product) => (
            <article className="product-row" key={product.id}>
              <div className="product-avatar">
                {renderProductThumbnail(product)}
              </div>
              {editing?.id === product.id ? (
                <form
                  className="product-edit-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const saved = await onUpdate(product.id, {
                      name: editing.name,
                      brand: editing.brand || null,
                      model: editing.model || null,
                      category: editing.category,
                      seller: editing.seller || null,
                      serialNumber: editing.serialNumber || null,
                      purchaseDate: editing.purchaseDate || null,
                      warrantyEnd: editing.warrantyEnd || null,
                    });
                    if (saved) setEditing(null);
                  }}
                >
                  <label>Name<input required maxLength={160} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
                  <label>Brand<input maxLength={120} value={editing.brand} onChange={(event) => setEditing({ ...editing, brand: event.target.value })} /></label>
                  <label>Model<input maxLength={120} value={editing.model} onChange={(event) => setEditing({ ...editing, model: event.target.value })} /></label>
                  <label>Category<input maxLength={80} value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} /></label>
                  <label>Seller<input maxLength={160} value={editing.seller} onChange={(event) => setEditing({ ...editing, seller: event.target.value })} /></label>
                  <label>Serial<input maxLength={120} value={editing.serialNumber} onChange={(event) => setEditing({ ...editing, serialNumber: event.target.value })} /></label>
                  <label>Purchased<input type="date" value={editing.purchaseDate} onChange={(event) => setEditing({ ...editing, purchaseDate: event.target.value })} /></label>
                  <label>Warranty end<input type="date" value={editing.warrantyEnd} onChange={(event) => setEditing({ ...editing, warrantyEnd: event.target.value })} /></label>
                  <button className="inline-action-button" type="submit" disabled={busy}>Save</button>
                  <button className="inline-action-button" type="button" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <div className="product-row-main">
                    <strong>{product.name}</strong>
                    <span>
                      {[product.brand, product.model].filter(Boolean).join(" · ") || product.category}
                      {product.brand || product.model ? ` · ${product.category}` : ""}
                      {product.purchasePlatform ? ` · Via ${product.purchasePlatform}` : ""}
                      {product.pricePaid ? ` · ₹${product.pricePaid.toLocaleString("en-IN")}` : ""}
                    </span>
                  </div>
                  <div className="product-date">
                    <span>PURCHASED</span>
                    <strong>{formatDate(product.purchaseDate) || "Not added"}</strong>
                  </div>
                  <div className="product-date">
                    <span>WARRANTY ENDS</span>
                    <strong>{formatDate(product.warrantyEnd) || "Not added"}</strong>
                  </div>
                  <div className="product-row-actions">
                    <button
                      className="tool-icon-button"
                      aria-label={`View timeline for ${product.name}`}
                      title="View product timeline"
                      onClick={() => onTimeline(product.id)}
                    >
                      <Clock3 size={15} />
                    </button>
                    <button
                      className="tool-icon-button"
                      aria-label={`Edit ${product.name}`}
                      title="Edit product"
                      onClick={() => setEditing(product)}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      className="tool-icon-button"
                      aria-label={`Remove ${product.name}`}
                      title="Remove product"
                      disabled={busy}
                      onClick={() => onRemove(product.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}

function ProductTimeline({ product, claims, watches, reminders, documents, documentsLoading, busy, onClose, onAddDocument, onOpenDocument, onRemoveDocument }: { product: Product; claims: ClaimTimelineRecord[]; watches: PriceWatch[]; reminders: Reminder[]; documents: ProductDocument[]; documentsLoading: boolean; busy: boolean; onClose: () => void; onAddDocument: (kind: string, file: File) => Promise<boolean>; onOpenDocument: (document: ProductDocument) => Promise<boolean>; onRemoveDocument: (document: ProductDocument) => Promise<boolean> }) {
  const [documentKind, setDocumentKind] = useState("invoice");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState("");
  const documentInput = useRef<HTMLInputElement>(null);
  const events: TimelineEvent[] = [];
  if (product.seller || product.serialNumber) events.push({ id: `details-${product.id}`, date: product.purchaseDate || product.createdAt, title: "Product details saved", detail: [product.seller ? `Seller: ${product.seller}` : "", product.serialNumber ? `Serial: ${product.serialNumber}` : ""].filter(Boolean).join(" · "), kind: "product" });
  if (product.purchaseDate) events.push({ id: `purchase-${product.id}`, date: product.purchaseDate, title: "Product purchased", detail: product.category, kind: "product" });
  if (product.warrantyEnd) events.push({ id: `warranty-${product.id}`, date: product.warrantyEnd, title: "Warranty ends", detail: "Date saved in your product passport", kind: "product" });
  for (const claim of claims.filter((item) => item.productId === product.id)) {
    events.push({ id: `claim-${claim.id}`, date: claim.createdAt, title: "Claim started", detail: `${claim.fault} · Status: ${claim.status.replaceAll("_", " ")}`, kind: "claim" });
  }
  for (const watch of watches.filter((item) => item.productId === product.id)) {
    const date = watch.lastCheckedAt || watch.createdAt;
    if (date) events.push({ id: `price-${watch.id}`, date, title: watch.lastCheckedAt ? "Price checked" : "Price watch created", detail: `Current ₹${watch.currentPrice.toLocaleString("en-IN")} · target ₹${watch.targetPrice.toLocaleString("en-IN")}${watch.lastCheckedAt ? " · Manual update" : ""}`, kind: "price" });
  }
  for (const reminder of reminders.filter((item) => item.productId === product.id)) {
    events.push({ id: `reminder-${reminder.id}`, date: reminder.remindAt, title: "Reminder scheduled", detail: reminder.estimateDays ? `Based on your ${reminder.estimateDays}-day estimate · in-app reminder` : "Based on your estimate · in-app reminder", kind: "reminder" });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));

  return <section className="product-timeline" aria-labelledby="product-timeline-title">
    <div className="product-timeline-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> OWNERSHIP HISTORY</div><h2 id="product-timeline-title">{product.name} timeline</h2><p>Warranty, claims, manual price checks, and reminders for this saved product.</p></div><button className="tool-icon-button" aria-label="Close product timeline" onClick={onClose}><X size={16} /></button></div>
    {events.length === 0 ? <div className="tool-empty">No timeline events yet. Add ownership dates, a claim, price watch, or reminder to build this product’s history.</div> : <ol className="product-timeline-events">{events.map((event) => <li className={`product-timeline-event timeline-${event.kind}`} key={event.id}>
      <span className="timeline-marker" aria-hidden="true" />
      <div className="timeline-event-copy"><span className="timeline-event-date">{formatDate(event.date.slice(0, 10))}</span><strong>{event.title}</strong><span>{event.detail}</span></div>
    </li>)}</ol>}
    <div className="passport-documents">
      <div className="passport-documents-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> PRODUCT DOCUMENTS</div><h3>Keep the paper trail together</h3></div><span className="quiet-count">PRIVATE FILES</span></div>
      <form className="passport-document-form" onSubmit={async (event) => { event.preventDefault(); setDocumentError(""); if (!documentFile) { setDocumentError("Choose a document to attach."); return; } try { if (await onAddDocument(documentKind, documentFile)) { setDocumentFile(null); if (documentInput.current) documentInput.current.value = ""; } } catch (cause) { setDocumentError(cause instanceof Error ? cause.message : "The document could not be attached."); } }}>
        <label>Document type<select value={documentKind} onChange={(event) => setDocumentKind(event.target.value)}><option value="invoice">Invoice</option><option value="warranty">Warranty terms</option><option value="manual">Product manual</option><option value="other">Other</option></select></label>
        <label className="passport-file-label">Choose document<input ref={documentInput} name="passport-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} /></label>
        <button className="button button-primary" type="submit" disabled={busy}><Plus size={14} /> Attach document</button>
      </form>
      <p className="passport-document-note">PDF, JPG, or PNG · up to 10 MB · stored in your private account.</p>
      {documentError && <p className="upload-error" role="alert">{documentError}</p>}
      {documentsLoading ? <p className="auth-copy" role="status">Loading private documents…</p> : documents.length === 0 ? <p className="tool-empty">No documents attached yet.</p> : <ul className="passport-document-list">{documents.map((document) => <li key={document.id}>
        <span className="tool-icon"><FileText size={15} /></span><span className="passport-document-main"><strong>{document.fileName}</strong><span>{document.kind.replaceAll("_", " ")} · {(document.sizeBytes / 1024).toFixed(0)} KB</span></span>
        {document.signedUrl ? <a className="inline-action-button" href={document.signedUrl} target="_blank" rel="noreferrer">Open file <ExternalLink size={13} /></a> : <button className="inline-action-button" type="button" disabled={busy} onClick={() => onOpenDocument(document)}>Prepare private link</button>}
        <button className="tool-icon-button" type="button" aria-label={`Remove ${document.fileName}`} disabled={busy} onClick={() => onRemoveDocument(document)}><Trash2 size={14} /></button>
      </li>)}</ul>}
    </div>
  </section>;
}

function PriceTracker({ products, watches, busy, onAdd, onUpdate, onRemove }: { products: Product[]; watches: PriceWatch[]; busy: boolean; onAdd: (watch: { productId: string; productUrl: string; currentPrice: number; targetPrice: number }) => Promise<boolean>; onUpdate: (id: string, price: number) => Promise<boolean>; onRemove: (id: string) => Promise<boolean> }) {
  const [productId, setProductId] = useState("");
  const [url, setUrl] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onAdd({ productId, productUrl: url.trim(), currentPrice: Number(currentPrice), targetPrice: Number(targetPrice) });
    if (saved) { setUrl(""); setCurrentPrice(""); setTargetPrice(""); }
  }

  return <>
    <form className="tool-form" onSubmit={submit}>
      <div className="tool-form-title"><span className="tool-icon"><TrendingDown size={17} /></span><div><h2>Start a manual watch</h2><p>Set a target and update the current price when you check a retailer.</p></div></div>
      {products.length === 0 ? <p className="tool-empty">Add a product in Products before creating a price watch.</p> : <div className="tool-fields tool-fields-four">
        <label>Product<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Choose a saved product</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
        <label>Product link <span className="optional-label">OPTIONAL · HTTPS</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://store.example/item" /></label>
        <label>Current price (₹)<input required type="number" min="0" max="9999999999.99" step="0.01" value={currentPrice} onChange={(event) => setCurrentPrice(event.target.value)} placeholder="2499" /></label>
        <label>Alert below (₹)<input required type="number" min="0" max="9999999999.99" step="0.01" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="1999" /></label>
      </div>}
      <div className="tool-form-actions"><button disabled={busy || products.length === 0} className="button button-primary" type="submit"><Plus size={15} /> Add manual watch</button></div>
    </form>
    <section className="tool-list" aria-labelledby="price-watch-title">
      <div className="tool-list-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> PRICE WATCHES</div><h2 id="price-watch-title">Your tracked items</h2></div><span className="quiet-count">MANUAL MODE</span></div>
      {watches.length === 0 ? <div className="tool-empty">No watches yet. Automated price checks need a supported data source/API.</div> : watches.map((watch) => <article className="watch-row" key={watch.id}>
        <div className="product-avatar"><TrendingDown size={18} /></div><div className="watch-main"><strong>{watch.name}</strong>{watch.url && <a href={watch.url} target="_blank" rel="noreferrer">Open product link</a>}<span>Target · ₹{watch.targetPrice.toLocaleString("en-IN")}</span></div>
        <div className="watch-price"><span>CURRENT PRICE</span><strong>₹{watch.currentPrice.toLocaleString("en-IN")}</strong></div>
        {watch.currentPrice <= watch.targetPrice ? <span className="target-reached" role="status"><CheckCircle2 size={14} /> Target reached</span> : <form className="update-price-form" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const input = form.elements.namedItem("manual-price") as HTMLInputElement; const price = Number(input.value); if (price >= 0 && await onUpdate(watch.id, price)) form.reset(); }}>
          <label className="visually-hidden" htmlFor={`manual-price-${watch.id}`}>New price for {watch.name}</label><input id={`manual-price-${watch.id}`} name="manual-price" required type="number" min="0" max="9999999999.99" step="0.01" placeholder="New ₹" /><button disabled={busy} type="submit" aria-label={`Save price for ${watch.name}`}>Update</button>
        </form>}
        <button className="tool-icon-button" aria-label={`Remove price watch for ${watch.name}`} disabled={busy} onClick={() => onRemove(watch.id)}><Trash2 size={15} /></button>
      </article>)}
    </section>
  </>;
}

function ReminderList({ products, reminders, busy, onAdd, onRemove }: { products: Product[]; reminders: Reminder[]; busy: boolean; onAdd: (reminder: { productId: string; estimateDays: number; remindAt: string }) => Promise<boolean>; onRemove: (id: string) => Promise<boolean> }) {
  const [productId, setProductId] = useState("");
  const [estimateDays, setEstimateDays] = useState("");
  const [remindAt, setRemindAt] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onAdd({ productId, estimateDays: Number(estimateDays), remindAt });
    if (saved) { setEstimateDays(""); setRemindAt(""); }
  }

  return <>
    <form className="tool-form" onSubmit={submit}>
      <div className="tool-form-title"><span className="tool-icon"><Bell size={17} /></span><div><h2>Set a replenishment reminder</h2><p>Choose the date yourself, guided by your estimated usage period.</p></div></div>
      {products.length === 0 ? <p className="tool-empty">Add a product in Products before scheduling a reminder.</p> : <div className="tool-fields tool-fields-three">
        <label>Saved product<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Choose a product</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
        <label>Estimated usage period (days)<input required type="number" min="1" max="3650" value={estimateDays} onChange={(event) => setEstimateDays(event.target.value)} placeholder="45" /></label>
        <label>Remind me on<input required type="date" min={todayInIndia()} value={remindAt} onChange={(event) => setRemindAt(event.target.value)} /></label>
      </div>}
      <div className="tool-form-actions"><button disabled={busy || products.length === 0} className="button button-primary" type="submit"><Plus size={15} /> Save reminder</button></div>
    </form>
    <section className="tool-list" aria-labelledby="reminders-title">
      <div className="tool-list-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR REMINDER TIMELINE</div><h2 id="reminders-title">Upcoming nudges</h2></div><span className="quiet-count">IN-APP</span></div>
      {reminders.length === 0 ? <div className="tool-empty">No reminders yet. Add one using your own estimated usage period.</div> : reminders.map((reminder) => <article className="reminder-row" key={reminder.id}>
        <div className="reminder-date"><span>{new Date(`${reminder.remindAt}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span><strong>{new Date(`${reminder.remindAt}T12:00:00`).getDate()}</strong></div>
        <div className="watch-main"><strong>{reminder.product}</strong><span>{reminder.estimateDays ? `Based on your ${reminder.estimateDays}-day estimate · ` : "Based on your estimate · "}{formatDate(reminder.remindAt)}</span></div>
        <span className="reminder-preview-status">IN-APP REMINDER</span>
        <button className="tool-icon-button" aria-label={`Cancel reminder for ${reminder.product}`} disabled={busy} onClick={() => onRemove(reminder.id)}><Trash2 size={15} /></button>
      </article>)}
    </section>
  </>;
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function UnifiedTimelineView({
  products,
  claims,
  watches,
  reminders,
  onSelectProduct,
}: {
  products: Product[];
  claims: ClaimTimelineRecord[];
  watches: PriceWatch[];
  reminders: Reminder[];
  onSelectProduct: (id: string) => void;
}) {
  const [filterProductId, setFilterProductId] = useState<string>("all");

  const events: (TimelineEvent & { productName: string; productId: string })[] = [];

  for (const product of products) {
    if (product.purchaseDate) {
      events.push({
        id: `purchase-${product.id}`,
        date: product.purchaseDate,
        title: `${product.name} purchased`,
        detail: [
          product.purchasePlatform ? `Via ${product.purchasePlatform}` : (product.seller ? `From ${product.seller}` : ""),
          product.pricePaid ? `₹${product.pricePaid.toLocaleString("en-IN")}` : "",
          product.buyingMethod ? `Paid via ${product.buyingMethod}` : "",
          product.category,
        ].filter(Boolean).join(" · "),
        kind: "product",
        productName: product.name,
        productId: product.id,
      });
    }
    if (product.warrantyEnd) {
      events.push({
        id: `warranty-${product.id}`,
        date: product.warrantyEnd,
        title: `${product.name} warranty expires`,
        detail: "Official manufacturer coverage deadline",
        kind: "product",
        productName: product.name,
        productId: product.id,
      });
    }
    if (product.createdAt) {
      events.push({
        id: `passport-${product.id}`,
        date: product.createdAt.slice(0, 10),
        title: `${product.name} passport created`,
        detail: [product.brand, product.model, product.serialNumber ? `SN: ${product.serialNumber}` : ""].filter(Boolean).join(" · "),
        kind: "product",
        productName: product.name,
        productId: product.id,
      });
    }
  }

  for (const claim of claims) {
    const prod = products.find((p) => p.id === claim.productId);
    events.push({
      id: `claim-${claim.id}`,
      date: claim.createdAt.slice(0, 10),
      title: `${prod?.name ?? "Product"} claim started`,
      detail: `${claim.fault} · Status: ${claim.status.replaceAll("_", " ")}`,
      kind: "claim",
      productName: prod?.name ?? "Product",
      productId: claim.productId,
    });
  }

  for (const watch of watches) {
    const prod = products.find((p) => p.id === watch.productId);
    const date = (watch.lastCheckedAt || watch.createdAt).slice(0, 10);
    events.push({
      id: `watch-${watch.id}`,
      date,
      title: `${prod?.name ?? watch.name} price watch`,
      detail: `Current ₹${watch.currentPrice.toLocaleString("en-IN")} · Target ₹${watch.targetPrice.toLocaleString("en-IN")}`,
      kind: "price",
      productName: prod?.name ?? watch.name,
      productId: watch.productId,
    });
  }

  for (const reminder of reminders) {
    const prod = products.find((p) => p.id === reminder.productId);
    events.push({
      id: `reminder-${reminder.id}`,
      date: reminder.remindAt.slice(0, 10),
      title: `${prod?.name ?? reminder.product} reminder scheduled`,
      detail: reminder.estimateDays ? `Estimated ${reminder.estimateDays}-day usage period` : "In-app reminder",
      kind: "reminder",
      productName: prod?.name ?? reminder.product,
      productId: reminder.productId,
    });
  }

  // Deduplicate and sort chronologically (newest first)
  const uniqueEvents = Array.from(new Map(events.map((e) => [e.id, e])).values());
  uniqueEvents.sort((a, b) => b.date.localeCompare(a.date));

  const filteredEvents = filterProductId === "all"
    ? uniqueEvents
    : uniqueEvents.filter((e) => e.productId === filterProductId);

  return (
    <section className="product-timeline unified-timeline-full" aria-labelledby="unified-timeline-title">
      <div className="product-timeline-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> UNIFIED HISTORY</div>
          <h2 id="unified-timeline-title">All Product Ownership Events</h2>
          <p>Chronological history across purchases, warranty cards, service plans, reminders, and price watches.</p>
        </div>
        {products.length > 0 && (
          <div className="timeline-filter-select-wrap">
            <label htmlFor="timeline-product-filter" className="sr-only">Filter by product</label>
            <select
              id="timeline-product-filter"
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              className="timeline-product-select"
            >
              <option value="all">All Products ({uniqueEvents.length} events)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="tool-empty">No ownership events found. Add your products, price watches, or reminders to build your timeline.</div>
      ) : (
        <ol className="product-timeline-events">
          {filteredEvents.map((event) => (
            <li className={`product-timeline-event timeline-${event.kind}`} key={event.id}>
              <span className="timeline-marker" aria-hidden="true" />
              <div className="timeline-event-copy">
                <span className="timeline-event-date">{formatDate(event.date)}</span>
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
              </div>
              <button
                type="button"
                className="tool-icon-button"
                title={`Open passport for ${event.productName}`}
                onClick={() => onSelectProduct(event.productId)}
              >
                <ExternalLink size={13} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

