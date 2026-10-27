"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  FileCheck,
  FileText,
  Info,
  LayoutGrid,
  List,
  LoaderCircle,
  MoreHorizontal,
  PackagePlus,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingDown,
  Upload,
  X,
} from "lucide-react";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import {
  HeadphoneThumb,
  LaptopThumb,
  PhoneThumb,
  RefrigeratorThumb,
  SneakerThumb,
  SunscreenThumb,
  WatchThumb,
} from "./ProductVisuals";
import { TechHeading } from "../TechText";
import { AddProduct, type ProductPayload } from "./AddProduct";
import { ProductPassportModal } from "./ProductPassportModal";
import { Timeline, type TimelineEntry } from "@/components/ui/timeline";
import "./UnifiedTimelineView.css";
import { PriceWatchView } from "./PriceWatch/PriceWatchView";

export type Product = {
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
  reason?: string;
};

type ClaimTimelineRecord = { id: string; productId: string; fault: string; status: string; createdAt: string };
type TimelineEvent = { id: string; date: string; title: string; detail: string; kind: "product" | "claim" | "price" | "reminder" };
export type ProductDocument = { id: string; productId: string; kind: string; label?: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string; signedUrl?: string };

export type ProductCenterView = "products" | "add-product" | "prices" | "reminders" | "timeline";

export { type ProductPayload } from "./AddProduct";

function calculateWarrantyEnd(startDateStr: string, months: number): string {
  if (!startDateStr || !months) return "";
  const d = new Date(`${startDateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.valueOf())) return "";
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function getBrandSupportLink(brand?: string): string | undefined {
  if (!brand) return undefined;
  const b = brand.toLowerCase();
  if (b.includes("sony")) return "https://www.sony.co.in/electronics/support";
  if (b.includes("apple")) return "https://support.apple.com";
  if (b.includes("lg")) return "https://www.lg.com/in/support";
  if (b.includes("samsung")) return "https://www.samsung.com/in/support";
  if (b.includes("titan")) return "https://www.titan.co.in/customer-service";
  if (b.includes("minimalist") || b.includes("beminimalist")) return "https://beminimalist.co/pages/contact-us";
  if (b.includes("soundcore") || b.includes("anker")) return "https://support.soundcore.com";
  if (b.includes("boat")) return "https://support.boat-lifestyle.com";
  if (b.includes("noise")) return "https://www.gonoise.com/pages/support";
  if (b.includes("nike")) return "https://www.nike.com/in/help";
  return undefined;
}

export function ProductVisual({
  product,
  className = "library-card-img",
}: {
  product: Product;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  const resolvedSrc = useMemo(() => {
    // 1. User/Scraped provided direct image URL
    if (product.imageUrl && !imgError) {
      return product.imageUrl;
    }

    // 2. Resolve to genuine product cutouts in /products
    const q = `${product.name} ${product.brand} ${product.model} ${product.category}`.toLowerCase();

    // Soundcore / Anker Q30 / Q20i
    if (
      q.includes("soundcore") ||
      q.includes("life q30") ||
      q.includes("q20") ||
      q.includes("q30") ||
      (q.includes("anker") && (q.includes("headphone") || q.includes("audio")))
    ) {
      return "/products/soundcore_q30.png";
    }

    // Sony WH-1000XM5 / XM4
    if (
      q.includes("wh-1000") ||
      q.includes("1000xm") ||
      (q.includes("sony") && (q.includes("headphone") || q.includes("anc") || q.includes("audio")))
    ) {
      return "/products/sony_wh1000xm5.png";
    }

    // Apple MacBook Air / Pro
    if (
      q.includes("macbook") ||
      (q.includes("apple") && (q.includes("laptop") || q.includes("air") || q.includes("m3") || q.includes("m2")))
    ) {
      return "/products/macbook_air_m3.png";
    }

    // iPhone 15 / Apple iPhone
    if (q.includes("iphone") || (q.includes("apple") && q.includes("phone"))) {
      return "/products/iphone_15.png";
    }

    // LG Refrigerator
    if (q.includes("refrigerator") || q.includes("fridge") || (q.includes("lg") && q.includes("appliance"))) {
      return "/products/lg_refrigerator.png";
    }

    // Minimalist Sunscreen / Care
    if (q.includes("sunscreen") || q.includes("minimalist") || (q.includes("spf") && q.includes("care"))) {
      return "/products/minimalist_sunscreen.png";
    }

    // Titan Watch
    if (q.includes("titan") || (q.includes("watch") && (q.includes("analog") || q.includes("timepiece")))) {
      return "/products/titan_watch.png";
    }

    // Nike Air Max 270 / Sneaker
    if (q.includes("nike") || q.includes("air max") || q.includes("sneaker")) {
      return "/products/nike_air_max_270.png";
    }

    // Office Chair
    if (q.includes("chair") || q.includes("office chair") || q.includes("ergonomic")) {
      return "/products/office_chair.png";
    }

    return null;
  }, [product, imgError]);

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={product.name}
        className={className}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  // Elegant neutral fallback when no genuine asset is available
  return (
    <div className="library-product-fallback-icon" aria-hidden="true">
      <PackagePlus size={42} strokeWidth={1.5} className="fallback-box-icon" />
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
  return { label: "Warranty not recorded", cls: "status-pill status-unrecorded" };
}

const headings: Record<ProductCenterView, [string, string, string]> = {
  products: [
    "YOUR PRODUCT LIBRARY",
    "Your Products",
    "Every product you've saved. Every detail worth keeping.",
  ],
  "add-product": ["NEW PRODUCT REGISTRATION", "Add Product", "Extract details from an invoice, paste a product link, or enter information manually."],
  prices: ["PRICE INTELLIGENCE", "Find the right price. Never miss the drop.", "Paste a product link, compare available offers across supported stores, and set an alert for the price you want. Know when the price is right."],
  reminders: ["PRODUCT-SPECIFIC REMINDERS", "A nudge on your terms.", "Set a reminder using your own estimated usage period. It appears in your ProductVault timeline."],
  timeline: ["UNIFIED PRODUCT TIMELINE", "Your ownership history.", "Every purchase, milestone and product event — all in one place."],
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
  return {
    id: String(row.id ?? ""),
    productId: String(row.product_id ?? ""),
    kind: String(row.document_kind ?? ""),
    label: row.document_label ? String(row.document_label) : undefined,
    fileName: String(row.original_filename ?? ""),
    mimeType: String(row.mime_type ?? ""),
    sizeBytes: Number(row.size_bytes ?? 0),
    createdAt: String(row.created_at ?? ""),
  };
}

function reminderFromRow(row: Record<string, unknown>): Reminder {
  const estimate = String(row.reason ?? "").match(/estimated (\d+)-day/);
  return {
    id: String(row.id), productId: String(row.product_id), product: relationName(row.products),
    estimateDays: estimate ? Number(estimate[1]) : 0, remindAt: String(row.remind_at).slice(0, 10),
    reason: row.reason ? String(row.reason) : undefined,
  };
}

export function ProductCenter({
  view,
  onNavigateView,
  onStartClaim,
}: {
  view: ProductCenterView;
  onNavigateView?: (view: ProductCenterView) => void;
  onStartClaim?: () => void;
}) {
  const [prevView, setPrevView] = useState(view);
  const [activeView, setActiveView] = useState<ProductCenterView>(view);
  if (view !== prevView) {
    setPrevView(view);
    setActiveView(view);
  }

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
      setProducts((productResult?.products || []).map(productFromRow));
      setWatches((watchResult?.watches || []).map(priceWatchFromRow));
      setReminders((reminderResult?.reminders || []).map(reminderFromRow));
      setClaims((claimResult?.claims || []).map(claimFromRow));
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

  async function addProduct(payload: ProductPayload, files?: { invoice?: File | null; warranty?: File | null }): Promise<Product> {
    const result = await api<{ product: Record<string, unknown> }>("/api/products", { method: "POST", body: JSON.stringify(payload) });
    const newProduct = productFromRow(result.product);
    setProducts((current) => [newProduct, ...current]);
    setNotice(`Product "${newProduct.name}" saved to your account.`);
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
    // Automatically open Product Passport for newly created product
    void showProductTimeline(newProduct.id);
    return newProduct;
  }

  async function updateProduct(id: string, payload: ProductPayload) {
    const result = await api<{ product: Record<string, unknown> }>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setProducts((current) => current.map((product) => product.id === id ? productFromRow(result.product) : product));
    setNotice("Product details updated.");
  }

  async function removeProduct(id: string) {
    await api(`/api/products/${id}`, { method: "DELETE" });
    setProducts((current) => current.filter((product) => product.id !== id));
    if (timelineProductId === id) {
      setTimelineProductId(null);
    }
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
      const result = await api<{ documents?: Record<string, unknown>[] }>(`/api/products/${id}/documents`);
      if (requestId === documentsRequest.current) setDocuments((result?.documents || []).map(productDocumentFromRow));
    } catch (cause) {
      if (requestId === documentsRequest.current) setError(cause instanceof Error ? cause.message : "Product documents could not be loaded.");
    } finally {
      if (requestId === documentsRequest.current) setDocumentsLoading(false);
    }
  }

  async function addProductDocument(productId: string, kind: string, file: File, label?: string): Promise<boolean> {
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
        method: "POST",
        body: JSON.stringify({
          productId,
          documentKind: kind,
          documentLabel: label,
          storagePath,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
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

  const heading = headings[activeView];

  // Dedicated Add Product View
  if (activeView === "add-product") {
    return (
      <AddProduct
        busy={busy}
        onAdd={async (payload, files) => {
          let success = false;
          await perform(async () => {
            const newProd = await addProduct(payload, files);
            success = true;
            if (newProd?.id) {
              setTimelineProductId(newProd.id);
            }
          });
          return success;
        }}
        onCancel={() => {
          setActiveView("products");
          if (onNavigateView) onNavigateView("products");
        }}
        onSuccess={() => {
          setActiveView("products");
          if (onNavigateView) onNavigateView("products");
        }}
      />
    );
  }

  // Saved Products, Prices, Reminders, Timeline Views
  return (
    <div className="page-content subpage-content">
      {activeView !== "prices" && (
        <div className="product-page-header-row">
          <div className="product-page-title-block">
            <div className="eyebrow"><span className="eyebrow-line" /> {heading[0]}</div>
            {activeView === "products" ? (
              <TechHeading
                variant="page"
                as="h1"
                text="Your Products"
                fontSize={44}
                height={62}
                accentColor="#EA580C"
                strokeWidth={2.0}
                specks={8}
                className="techttext-heading-title"
              />
            ) : (
              <TechHeading
                variant="page"
                as="h1"
                text={heading[1]}
                fontSize={40}
                height={58}
                accentColor="#EA580C"
                strokeWidth={2.0}
                specks={6}
              />
            )}
            <p className="product-page-subtitle">
              {heading[2]}
              {activeView === "products" && <span className="sr-only"> Products with a paper trail.</span>}
            </p>
          </div>

          {activeView === "products" && onNavigateView && (
            <div className="product-page-header-action">
              <button
                type="button"
                className="button button-primary library-hero-add-btn"
                onClick={() => {
                  setActiveView("add-product");
                  onNavigateView("add-product");
                }}
                aria-label="Add Product"
              >
                <Plus size={16} />
                <span>Add Product</span>
              </button>
            </div>
          )}
        </div>
      )}

      {!ready ? (
        <div className="tool-empty" role="status">Loading your ownership records…</div>
      ) : (
        <>
          {error && (
            <div className="product-feedback product-feedback-error" role="alert">
              <AlertTriangle size={15} />
              {error}
              <button type="button" onClick={() => void load()}>Try again</button>
            </div>
          )}
          {notice && !error && (
            <p role="status" className="product-feedback product-feedback-success">
              <CheckCircle2 size={15} />
              {notice}
            </p>
          )}

          {activeView === "products" ? (
            <ProductLibrary
              products={products}
              busy={busy}
              onUpdate={(id, payload) => perform(() => updateProduct(id, payload))}
              onRemove={(id) => perform(() => removeProduct(id))}
              onOpenPassport={(id) => { void showProductTimeline(id); }}
              onNavigateAddProduct={() => {
                setActiveView("add-product");
                if (onNavigateView) onNavigateView("add-product");
              }}
            />
          ) : null}

          {activeView === "prices" ? (
            <PriceWatchView
              products={products}
              watches={watches}
              busy={busy}
              onAdd={(watch) => perform(() => addWatch(watch))}
              onUpdate={(id, price) => perform(() => updateWatch(id, price))}
              onRemove={(id) => perform(() => removeWatch(id))}
            />
          ) : null}

          {activeView === "reminders" ? (
            <ReminderList
              products={products}
              reminders={reminders}
              busy={busy}
              onAdd={(reminder) => perform(() => addReminder(reminder))}
              onRemove={(id) => perform(() => removeReminder(id))}
            />
          ) : null}

          {activeView === "timeline" ? (
            <UnifiedTimelineView
              products={products}
              claims={claims}
              watches={watches}
              reminders={reminders}
              onSelectProduct={(id) => { void showProductTimeline(id); }}
            />
          ) : null}

          {/* Dedicated Product Passport Modal */}
          {timelineProductId && products.some((product) => product.id === timelineProductId) ? (
            <ProductPassportModal
              product={products.find((product) => product.id === timelineProductId)!}
              claims={claims}
              watches={watches}
              reminders={reminders}
              documents={documents}
              documentsLoading={documentsLoading}
              busy={busy}
              onClose={() => {
                documentsRequest.current++;
                setTimelineProductId(null);
                setDocuments([]);
              }}
              onAddDocument={(kind, file, label) =>
                perform(async () => {
                  await addProductDocument(timelineProductId, kind, file, label);
                })
              }
              onOpenDocument={(document) =>
                perform(async () => {
                  await prepareDocumentLink(document);
                })
              }
              onRemoveDocument={(document) =>
                perform(async () => {
                  await removeProductDocument(document);
                })
              }
              onStartClaim={onStartClaim}
            />
          ) : null}
        </>
      )}
      <p className="local-data-note">
        <AlertTriangle size={14} /> Price checks are manual; reminders currently appear inside ProductVault.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Digital Product Passport Library (Exclusively Displays Saved Products)
// ─────────────────────────────────────────────────────────────────────────────
function ProductLibrary({
  products,
  busy,
  onUpdate,
  onRemove,
  onOpenPassport,
  onNavigateAddProduct,
}: {
  products: Product[];
  busy: boolean;
  onUpdate: (id: string, product: ProductPayload) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onOpenPassport: (id: string) => void;
  onNavigateAddProduct?: () => void;
}) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [displayLayout, setDisplayLayout] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "price-desc" | "price-asc" | "warranty">("newest");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);

  // Close overflow menu when clicking outside
  useEffect(() => {
    function handleClickOutside() {
      setMenuOpenId(null);
    }
    if (menuOpenId) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpenId]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    products.forEach((p) => {
      const cat = p.category?.trim() || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts);
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Filter by Category
    if (selectedCategory !== "All") {
      list = list.filter((p) => (p.category?.trim() || "Other").toLowerCase() === selectedCategory.toLowerCase());
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.model || "").toLowerCase().includes(q) ||
        (p.seller || "").toLowerCase().includes(q) ||
        (p.serialNumber || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    }

    // Predictable sorting: handles missing prices and dates predictably
    list.sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "price-desc" || (sortBy as string) === "price") {
        const aHas = a.pricePaid !== undefined && a.pricePaid !== null;
        const bHas = b.pricePaid !== undefined && b.pricePaid !== null;
        if (aHas && bHas) return (b.pricePaid ?? 0) - (a.pricePaid ?? 0);
        if (aHas) return -1;
        if (bHas) return 1;
        return 0;
      }
      if (sortBy === "price-asc") {
        const aHas = a.pricePaid !== undefined && a.pricePaid !== null;
        const bHas = b.pricePaid !== undefined && b.pricePaid !== null;
        if (aHas && bHas) return (a.pricePaid ?? 0) - (b.pricePaid ?? 0);
        if (aHas) return -1;
        if (bHas) return 1;
        return 0;
      }
      if (sortBy === "warranty") {
        const aHas = Boolean(a.warrantyEnd);
        const bHas = Boolean(b.warrantyEnd);
        if (aHas && bHas) return (a.warrantyEnd || "").localeCompare(b.warrantyEnd || "");
        if (aHas) return -1;
        if (bHas) return 1;
        return 0;
      }
      if (sortBy === "oldest") {
        return (a.createdAt || a.purchaseDate || "").localeCompare(b.createdAt || b.purchaseDate || "");
      }
      // default: newest
      return (b.createdAt || b.purchaseDate || "").localeCompare(a.createdAt || a.purchaseDate || "");
    });

    return list;
  }, [products, selectedCategory, searchQuery, sortBy]);

  return (
    <section className="library-main-section" aria-label="Product Library Collection">
      {/* Cohesive Library Toolbar: Primary Controls Row + Secondary Category Filter Row */}
      {products.length > 0 && (
        <div className="library-toolbar-card">
          <div className="library-primary-toolbar">
            <div className="library-search-field">
              <Search size={15} className="library-search-icon" />
              <input
                type="search"
                className="library-search-input"
                placeholder="Search by product name, brand, or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search saved products"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="library-toolbar-controls">
              <span className="library-items-count-badge">
                {filteredProducts.length} {filteredProducts.length === 1 ? "ITEM" : "ITEMS"}
              </span>

              <select
                className="library-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "name" | "price-desc" | "price-asc" | "warranty")}
                aria-label="Sort products"
              >
                <option value="newest">Sort: Newest Added</option>
                <option value="oldest">Sort: Oldest Added</option>
                <option value="name">Sort: Name (A-Z)</option>
                <option value="price-desc">Sort: Price (High to Low)</option>
                <option value="price-asc">Sort: Price (Low to High)</option>
                <option value="warranty">Sort: Warranty Expiry</option>
              </select>

              <div className="library-layout-toggle" role="group" aria-label="View layout switcher">
                <button
                  type="button"
                  className={`layout-toggle-btn ${displayLayout === "grid" ? "active" : ""}`}
                  onClick={() => setDisplayLayout("grid")}
                  aria-label="Grid layout"
                  title="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  className={`layout-toggle-btn ${displayLayout === "list" ? "active" : ""}`}
                  onClick={() => setDisplayLayout("list")}
                  aria-label="List layout"
                  title="List view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="library-category-row" role="tablist" aria-label="Filter products by department">
            {categories.map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                className={`category-filter-pill ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <span>{cat}</span>
                <span className="filter-pill-count">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State: No Saved Products */}
      {products.length === 0 ? (
        <div className="library-empty-container">
          <div className="library-empty-icon-wrap">
            <PackagePlus size={36} />
          </div>
          <h3>Your product library is empty</h3>
          <p>Add your first product to start tracking warranties, purchase documents, and digital product passports.</p>
          {onNavigateAddProduct && (
            <button
              type="button"
              className="button button-primary library-empty-btn"
              onClick={onNavigateAddProduct}
            >
              <Plus size={15} /> Add a Product
            </button>
          )}
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Empty State: No Search/Category Matches */
        <div className="library-empty-container">
          <div className="library-empty-icon-wrap">
            <PackagePlus size={36} />
          </div>
          <h3>No products found</h3>
          <p>
            No products matched &quot;{searchQuery}&quot; in {selectedCategory}. Check your spelling or clear search filters.
          </p>
          <div className="library-empty-actions">
            {searchQuery && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
              >
                Clear Filters
              </button>
            )}
            {onNavigateAddProduct && (
              <button
                type="button"
                className="button button-primary library-empty-btn"
                onClick={onNavigateAddProduct}
              >
                <Plus size={15} /> Add Product
              </button>
            )}
          </div>
        </div>
      ) : displayLayout === "grid" ? (
        /* Target Desktop 4-Column Responsive Grid */
        <div className="library-products-grid">
          {filteredProducts.map((product) => {
            const badge = getProductStatusBadge(product);
            const isMenuOpen = menuOpenId === product.id;

            return (
              <article
                className="library-card-ref"
                key={product.id}
                onClick={() => onOpenPassport(product.id)}
                role="article"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onOpenPassport(product.id);
                  }
                }}
              >
                {/* Header: Small status badge on left, 3-dot overflow menu on right */}
                <div className="library-card-header">
                  <span className={badge.cls}>
                    <span className="status-dot" />
                    {badge.label}
                  </span>

                  <div className="product-card-menu-container" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="product-menu-dots-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(isMenuOpen ? null : product.id);
                      }}
                      aria-label={`Options for ${product.name}`}
                      aria-expanded={isMenuOpen}
                    >
                      <MoreHorizontal size={15} />
                    </button>

                    <div
                      className={`product-card-dropdown ${isMenuOpen ? "is-open" : ""}`}
                      aria-label={`Actions for ${product.name}`}
                    >
                      <button
                        type="button"
                        className="card-dropdown-item"
                        aria-label={`Edit ${product.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          setEditing(product);
                        }}
                      >
                        <Edit3 size={13} />
                        <span>Edit details</span>
                      </button>

                      <button
                        type="button"
                        className="card-dropdown-item"
                        aria-label={`View passport for ${product.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          onOpenPassport(product.id);
                        }}
                      >
                        <Clock3 size={13} />
                        <span>View timeline</span>
                      </button>

                      <button
                        type="button"
                        className="card-dropdown-item card-dropdown-danger"
                        aria-label={`Remove ${product.name}`}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(null);
                          setConfirmDeleteProduct(product);
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete product</span>
                      </button>
                    </div>
                  </div>
                </div>

                {editing?.id === product.id ? (
                  <div onClick={(e) => e.stopPropagation()}>
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
                      <div className="product-edit-actions">
                        <button className="button button-primary" type="submit" disabled={busy}>Save</button>
                        <button className="button button-outline" type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <>
                    {/* Centered Product Visual Cutout - No giant beige circle */}
                    <div className="library-card-stage">
                      <ProductVisual product={product} className="library-card-img" />
                    </div>

                    {/* Information Area with 2-line clamp */}
                    <div className="library-card-info">
                      <h3 className="library-product-title" title={product.name}>
                        {product.name}
                      </h3>

                      {(product.brand || product.model) && (
                        <p className="library-product-brand-model">
                          {[product.brand, product.model].filter(Boolean).join(" · ")}
                        </p>
                      )}

                      <div className="library-product-meta-row">
                        {product.pricePaid ? (
                          <span className="library-price-tag">
                            ₹{product.pricePaid.toLocaleString("en-IN")}
                          </span>
                        ) : null}

                        {product.purchasePlatform ? (
                          <span className="library-platform-tag">
                            Via {product.purchasePlatform}
                          </span>
                        ) : product.seller ? (
                          <span className="library-seller-tag">
                            {product.seller}
                          </span>
                        ) : product.purchaseDate ? (
                          <span className="library-date-tag">
                            {formatDate(product.purchaseDate)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Footer: View Product Passport with arrow */}
                    <div className="library-card-footer">
                      <button
                        type="button"
                        className="library-card-passport-btn"
                        aria-label={`View timeline for ${product.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPassport(product.id);
                        }}
                      >
                        <FileText size={13} className="passport-file-icon" />
                        <span>View Product Passport</span>
                        <ChevronRight size={14} className="passport-arrow-icon" />
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        /* List Layout */
        <div className="library-products-list">
          {filteredProducts.map((product) => {
            const badge = getProductStatusBadge(product);
            const isMenuOpen = menuOpenId === product.id;

            return (
              <article
                className="library-row-ref"
                key={product.id}
                onClick={() => onOpenPassport(product.id)}
                role="article"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onOpenPassport(product.id);
                  }
                }}
              >
                <div className="library-row-thumb">
                  <ProductVisual product={product} className="library-row-img" />
                </div>

                {editing?.id === product.id ? (
                  <div className="library-row-edit" onClick={(e) => e.stopPropagation()}>
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
                      <div className="product-edit-actions">
                        <button className="button button-primary" type="submit" disabled={busy}>Save</button>
                        <button className="button button-outline" type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <>
                    <div className="library-row-info">
                      <div className="library-row-title-badge">
                        <h3 className="library-row-title" title={product.name}>
                          {product.name}
                        </h3>
                        <span className={badge.cls}>
                          <span className="status-dot" />
                          {badge.label}
                        </span>
                      </div>

                      <p className="library-row-meta">
                        {product.brand && <span>{product.brand}</span>}
                        {product.model && <span> · {product.model}</span>}
                        {product.purchasePlatform && <span> · Via {product.purchasePlatform}</span>}
                        {product.seller && !product.purchasePlatform && <span> · {product.seller}</span>}
                        {product.pricePaid ? <span> · ₹{product.pricePaid.toLocaleString("en-IN")}</span> : null}
                        {product.purchaseDate && <span> · Added {formatDate(product.purchaseDate)}</span>}
                      </p>
                    </div>

                    <div className="library-row-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="library-card-passport-btn library-row-btn"
                        aria-label={`View timeline for ${product.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPassport(product.id);
                        }}
                      >
                        <FileText size={13} />
                        <span>Product Passport</span>
                        <ChevronRight size={13} />
                      </button>

                      <div className="product-card-menu-container">
                        <button
                          type="button"
                          className="product-menu-dots-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(isMenuOpen ? null : product.id);
                          }}
                          aria-label={`Options for ${product.name}`}
                          aria-expanded={isMenuOpen}
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        <div
                          className={`product-card-dropdown ${isMenuOpen ? "is-open" : ""}`}
                          aria-label={`Actions for ${product.name}`}
                        >
                          <button
                            type="button"
                            className="card-dropdown-item"
                            aria-label={`Edit ${product.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(null);
                              setEditing(product);
                            }}
                          >
                            <Edit3 size={13} />
                            <span>Edit details</span>
                          </button>

                          <button
                            type="button"
                            className="card-dropdown-item"
                            aria-label={`View passport for ${product.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(null);
                              onOpenPassport(product.id);
                            }}
                          >
                            <Clock3 size={13} />
                            <span>View timeline</span>
                          </button>

                          <button
                            type="button"
                            className="card-dropdown-item card-dropdown-danger"
                            aria-label={`Remove ${product.name}`}
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(null);
                              setConfirmDeleteProduct(product);
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Delete product</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteProduct && (
        <div
          className="library-confirm-overlay"
          onClick={() => setConfirmDeleteProduct(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div className="library-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="library-confirm-icon">
              <AlertTriangle size={24} />
            </div>
            <h3 id="confirm-delete-title">Delete Product?</h3>
            <p>
              Are you sure you want to remove <strong>{confirmDeleteProduct.name}</strong> from your Product Library?
              This will permanently delete its Product Passport and attached records.
            </p>
            <div className="library-confirm-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setConfirmDeleteProduct(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                disabled={busy}
                onClick={async () => {
                  await onRemove(confirmDeleteProduct.id);
                  setConfirmDeleteProduct(null);
                }}
              >
                {busy ? "Deleting..." : "Delete Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// Usage & Replenishment Reminder Subpage
// ─────────────────────────────────────────────────────────────────────────────
function ReminderList({
  products,
  reminders,
  busy,
  onAdd,
  onRemove,
}: {
  products: Product[];
  reminders: Reminder[];
  busy: boolean;
  onAdd: (reminder: { productId: string; estimateDays: number; remindAt: string }) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [productId, setProductId] = useState("");
  const [estimateDays, setEstimateDays] = useState("");
  const [remindAt, setRemindAt] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onAdd({ productId, estimateDays: Number(estimateDays), remindAt });
    if (saved) { setEstimateDays(""); setRemindAt(""); }
  }

  return (
    <>
      <form className="tool-form" onSubmit={submit}>
        <div className="tool-form-title">
          <span className="tool-icon"><Bell size={17} /></span>
          <div>
            <h2>Set a replenishment reminder</h2>
            <p>Choose the date yourself, guided by your estimated usage period.</p>
          </div>
        </div>
        {products.length === 0 ? (
          <p className="tool-empty">Add a product in Products before scheduling a reminder.</p>
        ) : (
          <div className="tool-fields tool-fields-three">
            <label>
              Saved product
              <select required value={productId} onChange={(event) => setProductId(event.target.value)}>
                <option value="">Choose a product</option>
                {products.map((product) => (
                  <option value={product.id} key={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label>
              Estimated usage period (days)
              <input required type="number" min="1" max="3650" value={estimateDays} onChange={(event) => setEstimateDays(event.target.value)} placeholder="45" />
            </label>
            <label>
              Remind me on
              <input required type="date" min={todayInIndia()} value={remindAt} onChange={(event) => setRemindAt(event.target.value)} />
            </label>
          </div>
        )}
        <div className="tool-form-actions">
          <button disabled={busy || products.length === 0} className="button button-primary" type="submit">
            <Plus size={15} /> Save reminder
          </button>
        </div>
      </form>
      <section className="tool-list" aria-labelledby="reminders-title">
        <div className="tool-list-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR REMINDER TIMELINE</div>
            <h2 id="reminders-title">Upcoming nudges</h2>
          </div>
          <span className="quiet-count">IN-APP</span>
        </div>
        {reminders.length === 0 ? (
          <div className="tool-empty">No reminders yet. Add one using your own estimated usage period.</div>
        ) : (
          reminders.map((reminder) => (
            <article className="reminder-row" key={reminder.id}>
              <div className="reminder-date">
                <span>{new Date(`${reminder.remindAt}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span>
                <strong>{new Date(`${reminder.remindAt}T12:00:00`).getDate()}</strong>
              </div>
              <div className="watch-main">
                <strong>{reminder.product}</strong>
                <span>{reminder.estimateDays ? `Based on your ${reminder.estimateDays}-day estimate · ` : "Based on your estimate · "}{formatDate(reminder.remindAt)}</span>
              </div>
              <button className="tool-icon-button" aria-label={`Cancel reminder for ${reminder.product}`} disabled={busy} onClick={() => onRemove(reminder.id)}>
                <Trash2 size={15} />
              </button>
            </article>
          ))
        )}
      </section>
    </>
  );
}

function formatDate(value: string) {
  if (!value) return "";
  const parts = value.slice(0, 10).split("-");
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

type TimelineEventItem = {
  id: string;
  date: string;
  title: string;
  detail: string;
  kind: "purchase" | "registration" | "warranty-active" | "warranty-expired" | "claim" | "price" | "reminder";
  typeLabel: string;
  statusTag?: string;
  isFuture: boolean;
  productName: string;
  productId: string;
  category?: string;
  imageUrl?: string;
  seller?: string;
};

function getTimelineMarkerIcon(kind: TimelineEventItem["kind"]) {
  switch (kind) {
    case "purchase":
      return <ShoppingBag size={14} aria-hidden="true" />;
    case "registration":
      return <FileCheck size={14} aria-hidden="true" />;
    case "warranty-active":
      return <ShieldCheck size={14} aria-hidden="true" />;
    case "warranty-expired":
      return <ShieldAlert size={14} aria-hidden="true" />;
    case "claim":
      return <FileText size={14} aria-hidden="true" />;
    case "price":
      return <TrendingDown size={14} aria-hidden="true" />;
    case "reminder":
      return <Bell size={14} aria-hidden="true" />;
    default:
      return <Clock3 size={14} aria-hidden="true" />;
  }
}

function getNodeColor(kind: TimelineEventItem["kind"]) {
  switch (kind) {
    case "purchase":
      return "#EA580C"; // Burnt orange
    case "registration":
      return "#D97706"; // Amber
    case "warranty-active":
      return "#059669"; // Emerald
    case "warranty-expired":
      return "#78716C"; // Stone slate
    case "claim":
      return "#2563EB"; // Royal blue
    case "price":
      return "#0284C7"; // Cyan
    case "reminder":
      return "#7C3AED"; // Violet
    default:
      return "#EA580C";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Timeline Subpage
// ─────────────────────────────────────────────────────────────────────────────
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
  onSelectProduct: (productId: string) => void;
}) {
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const today = todayInIndia();
  const events: TimelineEventItem[] = [];

  for (const product of products) {
    if (product.purchaseDate) {
      events.push({
        id: `purchase-${product.id}`,
        date: product.purchaseDate.slice(0, 10),
        title: "Product purchased",
        detail: [
          product.seller ? `From ${product.seller}` : "",
          product.pricePaid ? `₹${product.pricePaid.toLocaleString("en-IN")}` : "",
          product.buyingMethod || product.purchasePlatform || "",
        ].filter(Boolean).join(" · ") || product.category,
        kind: "purchase",
        typeLabel: "Purchase",
        isFuture: false,
        productName: product.name,
        productId: product.id,
        category: product.category,
        imageUrl: product.imageUrl,
        seller: product.seller,
      });
    }

    if (product.createdAt) {
      const regDate = product.createdAt.slice(0, 10);
      const isDistinct = !product.purchaseDate || regDate !== product.purchaseDate.slice(0, 10);
      if (isDistinct) {
        events.push({
          id: `registration-${product.id}`,
          date: regDate,
          title: "Product registered",
          detail: `Added to ProductVault digital library · ${[product.brand, product.model || product.category].filter(Boolean).join(" ")}`,
          kind: "registration",
          typeLabel: "Registration",
          isFuture: false,
          productName: product.name,
          productId: product.id,
          category: product.category,
          imageUrl: product.imageUrl,
          seller: product.seller,
        });
      }
    }

    if (product.warrantyEnd) {
      const wEnd = product.warrantyEnd.slice(0, 10);
      const isFuture = wEnd >= today;
      events.push({
        id: `warranty-${product.id}`,
        date: wEnd,
        title: isFuture ? "Active warranty coverage" : "Warranty coverage ended",
        detail: isFuture
          ? (product.warrantyDurationMonths
              ? `Standard manufacturer ${product.warrantyDurationMonths}-month coverage valid through ${formatDate(wEnd)}`
              : `Standard manufacturer coverage valid through ${formatDate(wEnd)}`)
          : `Standard manufacturer coverage expired on ${formatDate(wEnd)}`,
        kind: isFuture ? "warranty-active" : "warranty-expired",
        typeLabel: "Warranty",
        statusTag: isFuture ? "Upcoming Milestone" : "Coverage Expired",
        isFuture,
        productName: product.name,
        productId: product.id,
        category: product.category,
        imageUrl: product.imageUrl,
        seller: product.seller,
      });
    }
  }

  for (const claim of claims) {
    const prod = products.find((p) => p.id === claim.productId);
    events.push({
      id: `claim-${claim.id}`,
      date: claim.createdAt.slice(0, 10),
      title: "Warranty claim filed",
      detail: `${claim.fault} · Status: ${claim.status.replaceAll("_", " ")}`,
      kind: "claim",
      typeLabel: "Claim",
      statusTag: claim.status.replaceAll("_", " "),
      isFuture: false,
      productName: prod?.name ?? "Product",
      productId: claim.productId,
      category: prod?.category ?? "Electronics",
      imageUrl: prod?.imageUrl,
      seller: prod?.seller,
    });
  }

  for (const watch of watches) {
    const prod = products.find((p) => p.id === watch.productId);
    const date = (watch.lastCheckedAt || watch.createdAt || "").slice(0, 10);
    if (date) {
      const isTargetReached = watch.currentPrice <= watch.targetPrice;
      events.push({
        id: `watch-${watch.id}`,
        date,
        title: watch.lastCheckedAt ? "Price checked" : "Price watch activated",
        detail: `Target ₹${watch.targetPrice.toLocaleString("en-IN")} · Current ₹${watch.currentPrice.toLocaleString("en-IN")}${isTargetReached ? " (Target reached!)" : ""}`,
        kind: "price",
        typeLabel: "Price Watch",
        statusTag: isTargetReached ? "Target reached" : "Tracking",
        isFuture: false,
        productName: prod?.name ?? watch.name,
        productId: watch.productId,
        category: prod?.category ?? "Electronics",
        imageUrl: prod?.imageUrl,
        seller: prod?.seller,
      });
    }
  }

  for (const reminder of reminders) {
    const prod = products.find((p) => p.id === reminder.productId);
    const remDate = reminder.remindAt.slice(0, 10);
    const isFuture = remDate >= today;
    events.push({
      id: `reminder-${reminder.id}`,
      date: remDate,
      title: isFuture ? "Upcoming replenishment reminder" : "Replenishment reminder",
      detail: reminder.reason || (reminder.estimateDays ? `Estimated ${reminder.estimateDays}-day usage interval` : "In-app reminder"),
      kind: "reminder",
      typeLabel: "Reminder",
      statusTag: isFuture ? "Upcoming Reminder" : "Completed",
      isFuture,
      productName: prod?.name ?? reminder.product,
      productId: reminder.productId,
      category: prod?.category ?? "Other",
      imageUrl: prod?.imageUrl,
      seller: prod?.seller,
    });
  }

  const uniqueEvents = Array.from(new Map(events.map((e) => [e.id, e])).values());
  uniqueEvents.sort((a, b) => b.date.localeCompare(a.date));

  const filteredEvents = uniqueEvents.filter((e) => {
    if (filterProductId !== "all" && e.productId !== filterProductId) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchDetail = e.detail.toLowerCase().includes(q);
      const matchProd = e.productName.toLowerCase().includes(q);
      const matchSeller = e.seller ? e.seller.toLowerCase().includes(q) : false;
      const matchStatus = e.statusTag ? e.statusTag.toLowerCase().includes(q) : false;
      return matchTitle || matchDetail || matchProd || matchSeller || matchStatus;
    }
    return true;
  });

  // Group events by date string (YYYY-MM-DD) for authentic Aceternity exact-date chronology
  const dateGroupsMap = new Map<string, TimelineEventItem[]>();
  for (const event of filteredEvents) {
    const d = event.date.slice(0, 10);
    const existing = dateGroupsMap.get(d) || [];
    existing.push(event);
    dateGroupsMap.set(d, existing);
  }

  const sortedDates = Array.from(dateGroupsMap.keys()).sort((a, b) => b.localeCompare(a));
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const timelineEntries: TimelineEntry[] = sortedDates.map((dateStr, index) => {
    const dayEvents = dateGroupsMap.get(dateStr)!;
    const [y, m, d] = dateStr.split("-");
    const monthIdx = parseInt(m, 10) - 1;
    const dayNum = parseInt(d, 10);

    const prevYear = index > 0 ? sortedDates[index - 1].split("-")[0] : null;
    const yearChapter = y !== prevYear ? y : undefined;

    const hasUpcoming = dayEvents.some((e) => e.isFuture);
    const hasExpiredWarranty = dayEvents.some((e) => e.kind === "warranty-expired");
    const milestoneTag = hasUpcoming ? "Upcoming Milestone" : hasExpiredWarranty ? "Coverage Expired" : undefined;

    const primaryEvent = dayEvents[0];
    const nodeIcon = getTimelineMarkerIcon(primaryEvent.kind);
    const nodeColor = getNodeColor(primaryEvent.kind);

    return {
      id: `date-group-${dateStr}`,
      title: primaryEvent.title,
      yearChapter,
      date: {
        day: isNaN(dayNum) ? d : String(dayNum).padStart(2, "0"),
        month: monthNames[monthIdx] || m,
        year: y,
        formatted: formatDate(dateStr),
      },
      statusBadge: milestoneTag ? (
        <span
          className={`timeline-status-badge ${hasUpcoming ? "badge-upcoming" : "badge-expired"}`}
        >
          {milestoneTag}
        </span>
      ) : undefined,
      nodeIcon,
      nodeColor,
      content: (
        <div className="timeline-day-cards-flow">
          {dayEvents.map((event) => {
            const prod = products.find((p) => p.id === event.productId) || {
              id: event.productId,
              name: event.productName,
              brand: "",
              model: "",
              category: event.category || "Other",
              seller: event.seller || "",
              serialNumber: "",
              purchaseDate: "",
              warrantyEnd: "",
              createdAt: "",
            };

            return (
              <article
                className="timeline-card"
                key={event.id}
                aria-label={`${event.title} - ${event.productName}`}
              >
                <header className="timeline-card-header">
                  <div className="timeline-product-pill">
                    <div className="timeline-product-thumb">
                      <ProductVisual product={prod} className="w-full h-full object-cover" />
                    </div>
                    <span className="timeline-product-name">{event.productName}</span>
                  </div>

                  <span className="timeline-type-tag">{event.typeLabel}</span>
                </header>

                <div className="timeline-card-body">
                  <h3 className="timeline-event-title" data-testid="timeline-event-title">
                    {event.title}
                  </h3>
                  <p className="timeline-event-detail">{event.detail}</p>
                </div>

                <footer className="timeline-card-footer">
                  <button
                    type="button"
                    className="timeline-action-btn"
                    onClick={() => onSelectProduct(event.productId)}
                    aria-label={`View Passport for ${event.productName}`}
                  >
                    <Eye size={13} aria-hidden="true" />
                    <span>View Passport</span>
                    <ChevronRight size={13} aria-hidden="true" />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      ),
    };
  });

  return (
    <section className="unified-timeline-view" aria-label="Unified product timeline">
      {/* Event Toolbar */}
      <div className="timeline-toolbar">
        <div className="timeline-toolbar-controls">
          <div className="timeline-search-box">
            <Search size={14} className="timeline-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="timeline-search-input"
              placeholder="Search events by keyword, product, or seller…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search events"
            />
            {searchQuery && (
              <button
                type="button"
                className="timeline-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          {products.length > 0 && (
            <div className="timeline-product-select-wrap">
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

        <div className="timeline-counter-badge" role="status">
          <strong>{filteredEvents.length}</strong> {filteredEvents.length === 1 ? "event" : "events"}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="timeline-empty-card">
          <div className="timeline-empty-icon" aria-hidden="true">
            <Search size={24} />
          </div>
          <h3>No ownership events found</h3>
          <p>
            {searchQuery
              ? `No events match "${searchQuery}". Try a different keyword or reset filters.`
              : "No events recorded for the selected product yet."}
          </p>
          {(searchQuery || filterProductId !== "all") && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setSearchQuery("");
                setFilterProductId("all");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <Timeline data={timelineEntries} />
      )}
    </section>
  );
}
