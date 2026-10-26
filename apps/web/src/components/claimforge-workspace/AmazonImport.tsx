"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Loader2,
  Package,
  PackagePlus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportStep =
  | "url-input"       // User pastes Amazon URL
  | "validating"      // Client-side ASIN extraction + server round-trip
  | "not-configured"  // n8n not set up — offer manual entry pre-filled
  | "waiting"         // Queued; waiting for n8n callback (polling)
  | "review"          // Catalog data returned; user reviews + fills ownership fields
  | "duplicate"       // ASIN already in library
  | "error";          // Recoverable error

type CatalogData = {
  asin: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
  features: string[];
  imageUrls: string[];
  sourceUrl: string | null;
};

type OwnershipFields = {
  purchaseDate: string;
  warrantyEnd: string;
  serialNumber: string;
  seller: string;
};

type Props = {
  onCancel: () => void;
  /** Called when user finishes and saves the Product Passport. */
  onSaved: (productId: string, productName: string) => void;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 24; // ~60 seconds total

// ── Helper: extract ASIN client-side for instant feedback ─────────────────────
// This mirrors the server-side logic in @/lib/amazon/asin.ts — kept intentionally
// simple here since the server is the authoritative validator.
function clientExtractAsin(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const amazonHost = /^(?:www\.)?amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au|co\.jp)$/i;
  if (!amazonHost.test(parsed.hostname)) return null;
  const match = (parsed.pathname + parsed.search).match(
    /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i,
  );
  return match ? match[1].toUpperCase() : null;
}

function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: ImportStep }) {
  const steps: { id: ImportStep | "done"; label: string }[] = [
    { id: "url-input", label: "Paste URL" },
    { id: "validating", label: "Validate" },
    { id: "waiting", label: "Fetching" },
    { id: "review", label: "Review" },
  ];

  const activeIndex = steps.findIndex((s) =>
    s.id === step ||
    (s.id === "validating" && step === "not-configured") ||
    (s.id === "validating" && step === "duplicate") ||
    (s.id === "validating" && step === "error"),
  );

  return (
    <div className="ai-step-indicator" aria-label="Import progress">
      {steps.map((s, idx) => {
        const isActive = idx === activeIndex;
        const isDone = idx < activeIndex;
        return (
          <div key={s.id} className="ai-step-item">
            <div
              className={`ai-step-circle ${isDone ? "done" : isActive ? "active" : "pending"}`}
              aria-current={isActive ? "step" : undefined}
            >
              {isDone ? <Check size={13} /> : idx + 1}
            </div>
            <span className={`ai-step-label ${isActive ? "active" : ""}`}>{s.label}</span>
            {idx < steps.length - 1 && (
              <div className={`ai-step-connector ${isDone ? "done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AmazonImport({ onCancel, onSaved }: Props) {
  const [step, setStep] = useState<ImportStep>("url-input");
  const [url, setUrl] = useState("");
  const asinPreview = clientExtractAsin(url);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [duplicateProductId, setDuplicateProductId] = useState<string | null>(null);

  const [ownership, setOwnership] = useState<OwnershipFields>({
    purchaseDate: "",
    warrantyEnd: "",
    serialNumber: "",
    seller: "",
  });
  const [ownershipErrors, setOwnershipErrors] = useState<Partial<OwnershipFields>>({});
  const [saving, setSaving] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Focus URL input on mount
  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!url.trim()) return;
    setErrorMsg(null);
    setStep("validating");

    let res: Response;
    try {
      res = await fetch("/api/amazon/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
    } catch {
      setErrorMsg("Could not connect to the server. Check your connection and try again.");
      setStep("error");
      return;
    }

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok) {
      setErrorMsg(typeof data.error === "string" ? data.error : "Something went wrong.");
      setStep("error");
      return;
    }

    if (data.status === "not_configured") {
      // n8n not wired up — pre-fill manual entry with the ASIN
      setCatalog({
        asin: String(data.asin ?? ""),
        name: "",
        brand: null,
        model: null,
        category: null,
        description: null,
        features: [],
        imageUrls: [],
        sourceUrl: url.trim(),
      });
      setStep("not-configured");
      return;
    }

    if (data.status === "duplicate") {
      setDuplicateProductId(String(data.existingProductId ?? ""));
      setStep("duplicate");
      return;
    }

    if (data.status === "queued" && typeof data.jobId === "string") {
      setJobId(data.jobId);
      pollCount.current = 0;
      setStep("waiting");
      startPolling(data.jobId as string);
      return;
    }

    setErrorMsg("Unexpected response from server.");
    setStep("error");
  }

  function startPolling(jId: string) {
    if (pollCount.current >= POLL_MAX_ATTEMPTS) {
      setErrorMsg(
        "Amazon import is taking longer than expected. We'll notify you when it's ready — or you can add the product manually.",
      );
      setStep("error");
      return;
    }

    pollRef.current = setTimeout(async () => {
      pollCount.current += 1;
      try {
        const res = await fetch(`/api/amazon/import/status?jobId=${encodeURIComponent(jId)}`);
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;

        if (data.status === "complete" && data.product) {
          const p = data.product as Record<string, unknown>;
          setCatalog({
            asin: String(p.asin ?? ""),
            name: String(p.name ?? ""),
            brand: p.brand ? String(p.brand) : null,
            model: p.model ? String(p.model) : null,
            category: p.category ? String(p.category) : null,
            description: p.description ? String(p.description) : null,
            features: Array.isArray(p.features) ? p.features.map(String) : [],
            imageUrls: Array.isArray(p.image_urls) ? p.image_urls.map(String) : [],
            sourceUrl: p.source_url ? String(p.source_url) : null,
          });
          setStep("review");
          return;
        }

        if (data.status === "duplicate") {
          setDuplicateProductId(String(data.existingProductId ?? ""));
          setStep("duplicate");
          return;
        }

        if (data.status === "error") {
          setErrorMsg(String(data.message ?? "Amazon import failed."));
          setStep("error");
          return;
        }

        // Still pending — keep polling
        startPolling(jId);
      } catch {
        startPolling(jId); // retry on transient network error
      }
    }, POLL_INTERVAL_MS);
  }

  function validateOwnership(): boolean {
    const errors: Partial<OwnershipFields> = {};
    if (ownership.purchaseDate && !isValidDate(ownership.purchaseDate)) {
      errors.purchaseDate = "Enter a valid date (YYYY-MM-DD)";
    }
    if (ownership.warrantyEnd && !isValidDate(ownership.warrantyEnd)) {
      errors.warrantyEnd = "Enter a valid date (YYYY-MM-DD)";
    }
    setOwnershipErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!catalog || !validateOwnership()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: catalog.name || `Amazon product ${catalog.asin}`,
          brand: catalog.brand ?? undefined,
          model: catalog.model ?? undefined,
          category: catalog.category ?? undefined,
          purchaseDate: ownership.purchaseDate || null,
          warrantyEnd: ownership.warrantyEnd || null,
          serialNumber: ownership.serialNumber || null,
          seller: ownership.seller || null,
        }),
      });

      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setErrorMsg(typeof data.error === "string" ? data.error : "Could not save the product.");
        setSaving(false);
        return;
      }

      const saved = data.product as Record<string, unknown>;
      onSaved(String(saved.id), String(saved.name ?? catalog.name));
    } catch {
      setErrorMsg("Could not connect to save the product. Please try again.");
      setSaving(false);
    }
  }

  function handleRetry() {
    setStep("url-input");
    setErrorMsg(null);
    setJobId(null);
    setCatalog(null);
    pollCount.current = 0;
    if (pollRef.current) clearTimeout(pollRef.current);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section
      className="amazon-import-container"
      aria-label="Import product from Amazon"
    >
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <button className="ai-back-btn" onClick={onCancel} aria-label="Cancel import">
            <ArrowLeft size={16} />
          </button>
          <div className="ai-title-wrap">
            <h1 className="ai-title">Import from Amazon</h1>
            <p className="ai-subtitle">
              Paste an Amazon.in product URL to pre-fill your Product Passport from official catalog data.
            </p>
          </div>
        </div>
        <StepIndicator step={step} />
      </div>

      {/* ── Step: URL input ──────────────────────────────────────────────── */}
      {step === "url-input" && (
        <div className="ai-card ai-url-card">
          <div className="ai-url-icon-wrap">
            <PackagePlus size={24} />
          </div>
          <h2 className="ai-card-heading">Paste the Amazon product URL</h2>
          <p className="ai-card-body">
            Open the product page on Amazon.in and copy the URL from your browser&apos;s address bar.
            We extract the product code (ASIN) and retrieve catalog information through Amazon&apos;s official API.
          </p>

          <div className="ai-url-input-group">
            <div className={`ai-url-input-wrap ${asinPreview ? "has-asin" : ""}`}>
              <Search size={16} className="ai-url-search-icon" />
              <input
                id="amazon-url-input"
                ref={urlInputRef}
                type="url"
                className="ai-url-input"
                placeholder="https://www.amazon.in/dp/XXXXXXXXXX"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
                aria-label="Amazon product URL"
                autoComplete="off"
                spellCheck={false}
              />
              {url && (
                <button
                  className="ai-url-clear-btn"
                  onClick={() => { setUrl(""); urlInputRef.current?.focus(); }}
                  aria-label="Clear URL"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Live ASIN preview */}
            {asinPreview && (
              <div className="ai-asin-preview" aria-live="polite">
                <CheckCircle2 size={14} className="ai-asin-check" />
                <span>ASIN detected: <strong>{asinPreview}</strong></span>
              </div>
            )}
            {url && !asinPreview && url.length > 10 && (
              <div className="ai-asin-missing" aria-live="polite">
                <AlertCircle size={14} />
                <span>No product code found yet. Make sure the URL contains <code>/dp/</code>.</span>
              </div>
            )}
          </div>

          <div className="ai-url-actions">
            <button
              className="ai-import-btn"
              onClick={handleImport}
              disabled={!url.trim()}
              aria-label="Import product from Amazon"
            >
              <Sparkles size={16} />
              Import product
            </button>
            <button className="ai-manual-link" onClick={onCancel}>
              Add manually instead
            </button>
          </div>

          <div className="ai-trust-note">
            <ShieldCheck size={14} />
            <span>
              Your Amazon credentials are never required. We use Amazon&apos;s official Product Advertising API
              through our server — no credentials ever reach your browser.
            </span>
          </div>
        </div>
      )}

      {/* ── Step: Validating / loading ───────────────────────────────────── */}
      {(step === "validating" || step === "waiting") && (
        <div className="ai-card ai-loading-card">
          <div className="ai-loading-animation">
            <div className="ai-loading-ring">
              <Loader2 size={36} className="ai-spinner" />
            </div>
            <div className="ai-loading-dots">
              <span /><span /><span />
            </div>
          </div>
          <h2 className="ai-card-heading">
            {step === "validating" ? "Validating your URL…" : "Retrieving product data…"}
          </h2>
          <p className="ai-card-body">
            {step === "validating"
              ? "Extracting the product code and sending a secure request to our import service."
              : "Our import workflow is fetching catalog information from Amazon's official API. This usually takes 5–15 seconds."}
          </p>
          {step === "waiting" && (
            <div className="ai-loading-steps">
              <div className="ai-loading-step done"><Check size={12} /> URL validated</div>
              <div className="ai-loading-step done"><Check size={12} /> Request queued</div>
              <div className="ai-loading-step active">
                <Loader2 size={12} className="ai-spin-sm" /> Fetching from Amazon API…
              </div>
              <div className="ai-loading-step pending">Normalizing data</div>
              <div className="ai-loading-step pending">Ready for review</div>
            </div>
          )}
          <button className="ai-cancel-link" onClick={onCancel}>Cancel import</button>
        </div>
      )}

      {/* ── Step: Not configured — offer manual entry ────────────────────── */}
      {step === "not-configured" && catalog && (
        <div className="ai-card ai-notice-card">
          <div className="ai-notice-icon warning">
            <AlertTriangle size={22} />
          </div>
          <h2 className="ai-card-heading">Amazon import is not connected yet</h2>
          <p className="ai-card-body">
            The automated Amazon product lookup hasn&apos;t been configured for this workspace.
            We found your product code — you can add the product manually and we&apos;ll pre-fill what we know.
          </p>
          <div className="ai-asin-badge">
            <strong>ASIN:</strong> {catalog.asin}
            {catalog.sourceUrl && (
              <a
                href={catalog.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ai-amazon-link"
                aria-label="Open on Amazon"
              >
                <ExternalLink size={13} /> Open on Amazon
              </a>
            )}
          </div>
          <div className="ai-notice-actions">
            <button className="ai-import-btn" onClick={onCancel}>
              <Edit3 size={15} /> Add manually (ASIN pre-filled)
            </button>
            <button className="ai-manual-link" onClick={handleRetry}>Try a different URL</button>
          </div>
        </div>
      )}

      {/* ── Step: Duplicate detected ─────────────────────────────────────── */}
      {step === "duplicate" && (
        <div className="ai-card ai-notice-card">
          <div className="ai-notice-icon info">
            <Package size={22} />
          </div>
          <h2 className="ai-card-heading">This product is already in your library</h2>
          <p className="ai-card-body">
            A product with this ASIN already exists in your ProductVault library.
            Would you like to view it, or import a different product?
          </p>
          <div className="ai-notice-actions">
            {duplicateProductId && (
              <button
                className="ai-import-btn"
                onClick={() => onSaved(duplicateProductId, "Existing product")}
              >
                <ArrowRight size={15} /> View existing product
              </button>
            )}
            <button className="ai-manual-link" onClick={handleRetry}>Import a different product</button>
            <button className="ai-cancel-link" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Step: Error ──────────────────────────────────────────────────── */}
      {step === "error" && (
        <div className="ai-card ai-notice-card">
          <div className="ai-notice-icon error">
            <AlertCircle size={22} />
          </div>
          <h2 className="ai-card-heading">Import could not be completed</h2>
          <p className="ai-card-body">{errorMsg ?? "An unexpected error occurred."}</p>
          <div className="ai-notice-actions">
            <button className="ai-import-btn" onClick={handleRetry}>
              Try again
            </button>
            <button className="ai-manual-link" onClick={onCancel}>Add manually instead</button>
          </div>
        </div>
      )}

      {/* ── Step: Review imported data + fill ownership ──────────────────── */}
      {step === "review" && catalog && (
        <div className="ai-review-layout">
          {/* Left: catalog data (read-only / confirmed from Amazon) */}
          <div className="ai-catalog-panel">
            <div className="ai-panel-label">
              <Sparkles size={14} />
              <span>FROM AMAZON CATALOG</span>
              <span className="ai-panel-badge">Read-only · not editable</span>
            </div>

            {/* Product image */}
            {catalog.imageUrls[0] && (
              <div className="ai-product-image-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={catalog.imageUrls[0]}
                  alt={catalog.name}
                  className="ai-product-image"
                  loading="lazy"
                />
              </div>
            )}

            <h2 className="ai-product-name">{catalog.name}</h2>

            <dl className="ai-catalog-fields">
              {catalog.brand && (
                <>
                  <dt>Brand</dt>
                  <dd>{catalog.brand}</dd>
                </>
              )}
              {catalog.model && (
                <>
                  <dt>Model</dt>
                  <dd>{catalog.model}</dd>
                </>
              )}
              {catalog.category && (
                <>
                  <dt>Category</dt>
                  <dd>{catalog.category}</dd>
                </>
              )}
              <dt>ASIN</dt>
              <dd>
                <code className="ai-asin-code">{catalog.asin}</code>
                {catalog.sourceUrl && (
                  <a
                    href={catalog.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ai-amazon-link-sm"
                  >
                    <ExternalLink size={11} />
                  </a>
                )}
              </dd>
            </dl>

            {catalog.description && (
              <div className="ai-description">
                <p className="ai-description-label">Description</p>
                <p className="ai-description-text">{catalog.description}</p>
              </div>
            )}

            {catalog.features.length > 0 && (
              <div className="ai-features">
                <p className="ai-features-label">Key features</p>
                <ul className="ai-features-list">
                  {catalog.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ai-catalog-note">
              <AlertCircle size={13} />
              <span>
                Catalog data is sourced from Amazon&apos;s Product Advertising API. We display it as-is — we do not verify specifications independently.
              </span>
            </div>
          </div>

          {/* Right: ownership fields (user-provided) */}
          <div className="ai-ownership-panel">
            <div className="ai-panel-label ai-panel-label-orange">
              <Edit3 size={14} />
              <span>YOUR OWNERSHIP DETAILS</span>
              <span className="ai-panel-badge ai-panel-badge-orange">You fill this in</span>
            </div>

            <p className="ai-ownership-intro">
              Amazon doesn&apos;t know when you bought this or your warranty terms.
              Fill in what you have — all fields are optional and can be added later.
            </p>

            <div className="ai-field-group">
              <label className="ai-field-label" htmlFor="ai-purchase-date">
                Purchase date
                <span className="ai-optional-tag">optional</span>
              </label>
              <input
                id="ai-purchase-date"
                type="date"
                className={`ai-field-input ${ownershipErrors.purchaseDate ? "ai-field-error" : ""}`}
                value={ownership.purchaseDate}
                onChange={(e) =>
                  setOwnership((o) => ({ ...o, purchaseDate: e.target.value }))
                }
                aria-describedby={ownershipErrors.purchaseDate ? "ai-purchase-date-err" : undefined}
              />
              {ownershipErrors.purchaseDate && (
                <span id="ai-purchase-date-err" className="ai-field-error-msg" role="alert">
                  {ownershipErrors.purchaseDate}
                </span>
              )}
            </div>

            <div className="ai-field-group">
              <label className="ai-field-label" htmlFor="ai-warranty-end">
                Warranty expiry date
                <span className="ai-optional-tag">optional</span>
              </label>
              <input
                id="ai-warranty-end"
                type="date"
                className={`ai-field-input ${ownershipErrors.warrantyEnd ? "ai-field-error" : ""}`}
                value={ownership.warrantyEnd}
                onChange={(e) =>
                  setOwnership((o) => ({ ...o, warrantyEnd: e.target.value }))
                }
                aria-describedby={ownershipErrors.warrantyEnd ? "ai-warranty-end-err" : undefined}
              />
              {ownershipErrors.warrantyEnd && (
                <span id="ai-warranty-end-err" className="ai-field-error-msg" role="alert">
                  {ownershipErrors.warrantyEnd}
                </span>
              )}
            </div>

            <div className="ai-field-group">
              <label className="ai-field-label" htmlFor="ai-seller">
                Seller / Store
                <span className="ai-optional-tag">optional</span>
              </label>
              <input
                id="ai-seller"
                type="text"
                className="ai-field-input"
                placeholder="e.g. Reliance Digital"
                value={ownership.seller}
                onChange={(e) => setOwnership((o) => ({ ...o, seller: e.target.value }))}
                maxLength={160}
              />
            </div>

            <div className="ai-field-group">
              <label className="ai-field-label" htmlFor="ai-serial">
                Serial number
                <span className="ai-optional-tag">optional</span>
              </label>
              <input
                id="ai-serial"
                type="text"
                className="ai-field-input"
                placeholder="Found on box or device"
                value={ownership.serialNumber}
                onChange={(e) => setOwnership((o) => ({ ...o, serialNumber: e.target.value }))}
                maxLength={120}
              />
            </div>

            {errorMsg && (
              <div className="ai-save-error" role="alert">
                <AlertCircle size={15} />
                {errorMsg}
              </div>
            )}

            <div className="ai-ownership-actions">
              <button
                className="ai-import-btn ai-save-btn"
                onClick={handleSave}
                disabled={saving}
                aria-label="Save Product Passport"
              >
                {saving ? (
                  <><Loader2 size={15} className="ai-spin-sm" /> Saving…</>
                ) : (
                  <><CheckCircle2 size={15} /> Save Product Passport</>
                )}
              </button>
              <button className="ai-manual-link" onClick={handleRetry}>
                Start over
              </button>
            </div>

            <p className="ai-save-note">
              Purchase date, serial number, and warranty expiry are private to your account.
              They are never sent to Amazon.
            </p>
          </div>
        </div>
      )}

      {/* Not-configured: also render ownership panel so user can still proceed manually */}
      {step === "not-configured" && catalog && (
        <div className="ai-manual-note">
          <ShieldCheck size={14} />
          <span>
            Nothing is sent to Amazon. Your product details are stored privately in your ProductVault workspace.
          </span>
        </div>
      )}
    </section>
  );
}
