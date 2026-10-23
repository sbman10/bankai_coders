"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Edit3, ExternalLink, FileText, PackagePlus, Plus, Trash2, TrendingDown, X } from "lucide-react";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

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

type ProductCenterView = "products" | "prices" | "reminders";
type ProductPayload = { name: string; brand: string | null; model: string | null; category: string; seller: string | null; serialNumber: string | null; purchaseDate: string | null; warrantyEnd: string | null };

const headings: Record<ProductCenterView, [string, string, string]> = {
  products: ["YOUR PRODUCT LIBRARY", "Products with a paper trail.", "Keep purchase details and warranty dates together in your private account."],
  prices: ["MANUAL PRICE WATCH", "Know when the price is right.", "Record the price you see and compare it with your target. No retailer scraping is running."],
  reminders: ["PRODUCT-SPECIFIC REMINDERS", "A nudge on your terms.", "Set a reminder using your own estimated usage period. It appears in your ClaimForge timeline."],
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers } });
  const result = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error || "The change could not be saved. Please try again.");
  return result;
}

function productFromRow(row: Record<string, unknown>): Product {
  return {
    id: String(row.id), name: String(row.name), brand: String(row.brand ?? ""), model: String(row.model ?? ""), category: String(row.category ?? "Other"),
    seller: String(row.seller ?? ""), serialNumber: String(row.serial_number ?? ""),
    purchaseDate: String(row.purchase_date ?? ""), warrantyEnd: String(row.warranty_end ?? ""), createdAt: String(row.created_at ?? ""),
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

function productDocumentFromRow(row: Record<string, unknown>): ProductDocument {
  return { id: String(row.id), productId: String(row.product_id), kind: String(row.document_kind), fileName: String(row.original_filename), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), createdAt: String(row.created_at ?? "") };
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

  async function addProduct(payload: ProductPayload) {
    const result = await api<{ product: Record<string, unknown> }>("/api/products", { method: "POST", body: JSON.stringify(payload) });
    setProducts((current) => [productFromRow(result.product), ...current]);
    setNotice("Product saved to your account.");
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
      const result = await api<{ document: Record<string, unknown> }>(`/api/products/${productId}/documents`, {
        method: "POST", body: JSON.stringify({ productId, documentKind: kind, storagePath, fileName: file.name.slice(0, 240), mimeType: file.type, sizeBytes: file.size }),
      });
      setDocuments((current) => [productDocumentFromRow(result.document), ...current]);
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
          <ProductLibrary products={products} busy={busy} onAdd={(payload) => perform(() => addProduct(payload))} onUpdate={(id, payload) => perform(() => updateProduct(id, payload))} onRemove={(id) => perform(() => removeProduct(id))} onTimeline={(id) => { void showProductTimeline(id); }} />
          {timelineProductId && products.some((product) => product.id === timelineProductId) ? <ProductTimeline product={products.find((product) => product.id === timelineProductId)!} claims={claims} watches={watches} reminders={reminders} documents={documents} documentsLoading={documentsLoading} busy={busy} onClose={() => { documentsRequest.current++; setTimelineProductId(null); setDocuments([]); }} onAddDocument={(kind, file) => perform(async () => { await addProductDocument(timelineProductId, kind, file); })} onOpenDocument={(document) => perform(async () => { await prepareDocumentLink(document); })} onRemoveDocument={(document) => perform(async () => { await removeProductDocument(document); })} /> : null}
        </> : null}
        {view === "prices" ? <PriceTracker products={products} watches={watches} busy={busy} onAdd={(watch) => perform(() => addWatch(watch))} onUpdate={(id, price) => perform(() => updateWatch(id, price))} onRemove={(id) => perform(() => removeWatch(id))} /> : null}
        {view === "reminders" ? <ReminderList products={products} reminders={reminders} busy={busy} onAdd={(reminder) => perform(() => addReminder(reminder))} onRemove={(id) => perform(() => removeReminder(id))} /> : null}
      </>}
      <p className="local-data-note"><AlertTriangle size={14} /> Your product records are private to your account. Price checks are manual; reminders currently appear inside ClaimForge.</p>
    </div>
  );
}

function ProductLibrary({ products, busy, onAdd, onUpdate, onRemove, onTimeline }: { products: Product[]; busy: boolean; onAdd: (product: ProductPayload) => Promise<boolean>; onUpdate: (id: string, product: ProductPayload) => Promise<boolean>; onRemove: (id: string) => Promise<boolean>; onTimeline: (id: string) => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("");
  const [seller, setSeller] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onAdd({ name: name.trim(), brand: brand.trim() || null, model: model.trim() || null, category: category.trim() || "Other", seller: seller.trim() || null, serialNumber: serialNumber.trim() || null, purchaseDate: purchaseDate || null, warrantyEnd: warrantyEnd || null });
    if (saved) { setName(""); setBrand(""); setModel(""); setCategory(""); setSeller(""); setSerialNumber(""); setPurchaseDate(""); setWarrantyEnd(""); }
  }

  return <>
    <form className="tool-form" onSubmit={submit}>
      <div className="tool-form-title"><span className="tool-icon"><PackagePlus size={17} /></span><div><h2>Add a product</h2><p>Save a product and its key ownership dates.</p></div></div>
      <div className="tool-fields tool-fields-four">
        <label>Product name<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Wireless headphones" /></label>
        <label>Brand<input maxLength={120} value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="e.g. Auralis" /></label>
        <label>Model<input maxLength={120} value={model} onChange={(event) => setModel(event.target.value)} placeholder="e.g. Pulse 2" /></label>
        <label>Category<input maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Audio, personal care…" /></label>
        <label>Seller<input maxLength={160} value={seller} onChange={(event) => setSeller(event.target.value)} placeholder="Store or retailer" /></label>
        <label>Serial number<input maxLength={120} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Optional" /></label>
        <label>Purchase date<input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label>
        <label>Warranty end<input type="date" value={warrantyEnd} onChange={(event) => setWarrantyEnd(event.target.value)} /></label>
      </div>
      <div className="tool-form-actions"><button disabled={busy} className="button button-primary" type="submit"><Plus size={15} /> Add product</button></div>
    </form>

    <section className="tool-list" aria-labelledby="products-list-title">
      <div className="tool-list-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> PRODUCT PASSPORTS</div><h2 id="products-list-title">Your saved products</h2></div><span className="quiet-count">{products.length} ITEMS</span></div>
      {products.length === 0 ? <div className="tool-empty">Your library is empty. Add a product above to start its passport.</div> : products.map((product) => <article className="product-row" key={product.id}>
        <div className="product-avatar"><PackagePlus size={18} /></div>
        {editing?.id === product.id ? <form className="product-edit-form" onSubmit={async (event) => { event.preventDefault(); const saved = await onUpdate(product.id, { name: editing.name, brand: editing.brand || null, model: editing.model || null, category: editing.category, seller: editing.seller || null, serialNumber: editing.serialNumber || null, purchaseDate: editing.purchaseDate || null, warrantyEnd: editing.warrantyEnd || null }); if (saved) setEditing(null); }}>
          <label>Name<input required maxLength={160} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
          <label>Brand<input maxLength={120} value={editing.brand} onChange={(event) => setEditing({ ...editing, brand: event.target.value })} /></label>
          <label>Model<input maxLength={120} value={editing.model} onChange={(event) => setEditing({ ...editing, model: event.target.value })} /></label>
          <label>Category<input maxLength={80} value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} /></label>
          <label>Seller<input maxLength={160} value={editing.seller} onChange={(event) => setEditing({ ...editing, seller: event.target.value })} /></label>
          <label>Serial<input maxLength={120} value={editing.serialNumber} onChange={(event) => setEditing({ ...editing, serialNumber: event.target.value })} /></label>
          <label>Purchased<input type="date" value={editing.purchaseDate} onChange={(event) => setEditing({ ...editing, purchaseDate: event.target.value })} /></label>
          <label>Warranty end<input type="date" value={editing.warrantyEnd} onChange={(event) => setEditing({ ...editing, warrantyEnd: event.target.value })} /></label>
          <button className="inline-action-button" type="submit" disabled={busy}>Save</button><button className="inline-action-button" type="button" onClick={() => setEditing(null)}>Cancel</button>
        </form> : <>
          <div className="product-row-main"><strong>{product.name}</strong><span>{[product.brand, product.model].filter(Boolean).join(" · ") || product.category}{product.brand || product.model ? ` · ${product.category}` : ""}</span></div>
          <div className="product-date"><span>PURCHASED</span><strong>{formatDate(product.purchaseDate) || "Not added"}</strong></div>
          <div className="product-date"><span>WARRANTY ENDS</span><strong>{formatDate(product.warrantyEnd) || "Not added"}</strong></div>
          <div className="product-row-actions"><button className="tool-icon-button" aria-label={`View timeline for ${product.name}`} title="View product timeline" onClick={() => onTimeline(product.id)}><Clock3 size={15} /></button><button className="tool-icon-button" aria-label={`Edit ${product.name}`} onClick={() => setEditing(product)}><Edit3 size={15} /></button>
          <button className="tool-icon-button" aria-label={`Remove ${product.name}`} disabled={busy} onClick={() => onRemove(product.id)}><Trash2 size={15} /></button></div>
        </>}
      </article>)}
    </section>
  </>;
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
