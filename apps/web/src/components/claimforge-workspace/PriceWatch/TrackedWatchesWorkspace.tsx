import React, { useState } from "react";
import {
  TrendingDown,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Check,
  Eye,
} from "lucide-react";
import { EnrichedPriceWatch, WatchStatus } from "./types";
import { formatINR } from "./priceWatchAdapter";

interface TrackedWatchesWorkspaceProps {
  watches: EnrichedPriceWatch[];
  busy: boolean;
  onUpdatePrice: (id: string, newPrice: number) => Promise<boolean>;
  onRemoveWatch: (id: string) => Promise<boolean>;
  onOpenManualModal: () => void;
  onSelectWatchForComparison?: (watch: EnrichedPriceWatch) => void;
  onFocusDiscoveryInput: () => void;
}

export function TrackedWatchesWorkspace({
  watches,
  busy,
  onUpdatePrice,
  onRemoveWatch,
  onOpenManualModal,
  onSelectWatchForComparison,
  onFocusDiscoveryInput,
}: TrackedWatchesWorkspaceProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WatchStatus>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filter watches by name, brand, or status
  const filteredWatches = watches.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (w.brand && w.brand.toLowerCase().includes(filterQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || w.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: WatchStatus) => {
    switch (status) {
      case "target_reached":
        return (
          <span className="pw2-watch-status-pill target_reached" role="status">
            <CheckCircle2 size={12} />
            <span>Target reached</span>
          </span>
        );
      case "near_target":
        return (
          <span className="pw2-watch-status-pill near_target" role="status">
            <AlertTriangle size={12} />
            <span>Near Target</span>
          </span>
        );
      case "manual":
        return (
          <span className="pw2-watch-status-pill manual">
            <span>Manual Mode</span>
          </span>
        );
      default:
        return (
          <span className="pw2-watch-status-pill watching">
            <Clock size={12} />
            <span>Monitoring</span>
          </span>
        );
    }
  };

  return (
    <section className="pw2-watchlist-section" aria-labelledby="pw2-watchlist-title">
      <div className="pw2-watchlist-header">
        <div className="pw2-watchlist-title-col">
          <h2 id="pw2-watchlist-title" className="pw2-watchlist-title">
            <span>Your Price Watches</span>
            <span className="pw2-watchlist-count-badge">
              {watches.length} {watches.length === 1 ? "Product" : "Products"}
            </span>
          </h2>
          <p className="pw2-watchlist-subtitle">
            Products you&apos;re monitoring for a better deal.
          </p>
        </div>

        <div className="pw2-watchlist-controls">
          <button
            type="button"
            className="pw2-manual-add-trigger"
            onClick={onOpenManualModal}
            aria-label="Add manual price watch"
          >
            <Plus size={15} />
            <span>Add manual watch</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar when watches exist */}
      {watches.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
            <Search
              size={15}
              style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#8C827A" }}
            />
            <input
              type="text"
              placeholder="Search tracked products..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                width: "100%",
                height: "36px",
                padding: "0 0.75rem 0 2.25rem",
                background: "#FFFFFF",
                border: "1px solid #D8CEC4",
                borderRadius: "8px",
                fontSize: "0.875rem",
                color: "#1C1917",
              }}
              aria-label="Search tracked products"
            />
          </div>

          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button
              type="button"
              className={`pw2-preset-pill ${statusFilter === "all" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All ({watches.length})
            </button>
            <button
              type="button"
              className={`pw2-preset-pill ${statusFilter === "target_reached" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("target_reached")}
            >
              At Target ({watches.filter((w) => w.status === "target_reached").length})
            </button>
            <button
              type="button"
              className={`pw2-preset-pill ${statusFilter === "near_target" ? "is-active" : ""}`}
              onClick={() => setStatusFilter("near_target")}
            >
              Near Target ({watches.filter((w) => w.status === "near_target").length})
            </button>
          </div>
        </div>
      )}

      {/* Watchlist Content */}
      {watches.length === 0 ? (
        <div className="pw2-empty-state">
          <div className="pw2-empty-icon">
            <TrendingDown size={28} />
          </div>
          <h3 className="pw2-empty-title">No price watches yet</h3>
          <p className="pw2-empty-text">
            Paste a product link from Amazon, Flipkart, or Croma above to compare prices and set an automated alert.
          </p>
          <button
            type="button"
            className="pw2-empty-cta"
            onClick={onFocusDiscoveryInput}
          >
            Find a product to track
          </button>
        </div>
      ) : filteredWatches.length === 0 ? (
        <div className="pw2-empty-state" style={{ padding: "2.5rem 1.5rem" }}>
          <p className="pw2-empty-text">No tracked products matched your search or status filter.</p>
          <button
            type="button"
            className="pw2-preset-pill"
            onClick={() => {
              setFilterQuery("");
              setStatusFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="pw2-watch-list">
          {filteredWatches.map((watch) => {
            const diff = watch.currentPrice - watch.targetPrice;
            const isTargetReached = watch.currentPrice <= watch.targetPrice;

            return (
              <article key={watch.id} className="pw2-watch-card" aria-label={`Price watch for ${watch.name}`}>
                {/* Product Thumbnail or Fallback Icon */}
                <div className="pw2-watch-avatar">
                  {watch.imageUrl ? (
                    <img
                      src={watch.imageUrl}
                      alt={watch.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <TrendingDown size={22} />
                  )}
                </div>

                {/* Product Title and Store Metadata */}
                <div className="pw2-watch-meta-col">
                  <h3 className="pw2-watch-name" title={watch.name}>
                    {watch.name}
                  </h3>
                  <div className="pw2-watch-sub">
                    {watch.brand && <span style={{ fontWeight: 600 }}>{watch.brand}</span>}
                    {watch.retailerName && <span>· Via {watch.retailerName}</span>}
                    {watch.url && (
                      <a
                        href={watch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pw2-watch-link"
                        aria-label={`Open product link for ${watch.name}`}
                      >
                        <span>Open product link</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
                    {getStatusBadge(watch.status)}
                    {watch.lastCheckedAt && (
                      <span style={{ fontSize: "0.7188rem", color: "#8C827A" }}>
                        Checked {watch.lastCheckedAt.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price Information */}
                <div className="pw2-watch-prices-col">
                  <div className="pw2-watch-price-row">
                    <span className="pw2-watch-current-price">
                      {formatINR(watch.currentPrice)}
                    </span>
                    <span className="pw2-watch-target-tag">
                      Target · {formatINR(watch.targetPrice)}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.8125rem", color: isTargetReached ? "#15803D" : "#78716C" }}>
                    {isTargetReached ? (
                      <span style={{ fontWeight: 600 }}>
                        Deal unlocked ({formatINR(Math.abs(diff))} under target)
                      </span>
                    ) : (
                      <span>{formatINR(diff)} above target</span>
                    )}
                  </div>
                </div>

                {/* Actions Column */}
                <div className="pw2-watch-actions-col">
                  {onSelectWatchForComparison && watch.isDemo && (
                    <button
                      type="button"
                      className="pw2-preset-pill"
                      onClick={() => onSelectWatchForComparison(watch)}
                      title="View multi-store comparison for this item"
                    >
                      <Eye size={13} />
                      <span>Compare</span>
                    </button>
                  )}

                  {/* Quick Inline Price Update Form (Maintains existing PATCH /api/price-watches/[id]) */}
                  <form
                    className="pw2-quick-update-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const input = form.elements.namedItem("manual-price") as HTMLInputElement;
                      const newPrice = Number(input.value);
                      if (!isNaN(newPrice) && newPrice >= 0) {
                        setUpdatingId(watch.id);
                        const saved = await onUpdatePrice(watch.id, newPrice);
                        setUpdatingId(null);
                        if (saved) form.reset();
                      }
                    }}
                  >
                    <label className="visually-hidden" htmlFor={`manual-price-${watch.id}`}>
                      New price for {watch.name}
                    </label>
                    <input
                      id={`manual-price-${watch.id}`}
                      name="manual-price"
                      type="number"
                      min="0"
                      max="99999999"
                      step="0.01"
                      placeholder="New ₹"
                      required
                      className="pw2-quick-update-input"
                      disabled={busy || updatingId === watch.id}
                      aria-label={`New price for ${watch.name}`}
                    />
                    <button
                      type="submit"
                      className="pw2-quick-update-btn"
                      disabled={busy || updatingId === watch.id}
                      aria-label={`Save price for ${watch.name}`}
                    >
                      {updatingId === watch.id ? "Saving..." : "Update"}
                    </button>
                  </form>

                  {/* Remove Button */}
                  <button
                    type="button"
                    className="pw2-delete-btn"
                    onClick={() => setConfirmDeleteId(watch.id)}
                    disabled={busy}
                    aria-label={`Remove price watch for ${watch.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="pw2-manual-modal-overlay"
          onClick={() => setConfirmDeleteId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pw2-delete-dialog-title"
        >
          <div className="pw2-manual-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pw2-modal-header">
              <h3 id="pw2-delete-dialog-title" className="pw2-modal-title">
                Remove Price Watch?
              </h3>
            </div>
            <div className="pw2-modal-body">
              <p style={{ margin: 0, fontSize: "0.9375rem", color: "#57534E", lineHeight: 1.5 }}>
                Are you sure you want to stop monitoring this product? You will no longer receive price updates or alerts.
              </p>
              <div className="pw2-modal-actions">
                <button
                  type="button"
                  className="pw2-preset-pill"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    background: "#DC2626",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  disabled={busy}
                  onClick={async () => {
                    await onRemoveWatch(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }}
                >
                  {busy ? "Removing..." : "Remove Watch"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price History Disclaimer */}
      {watches.length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "#8C827A", textAlign: "center", margin: "0.5rem 0 0 0" }}>
          Price history observations will appear as automated checks are performed by the monitoring engine.
        </p>
      )}
    </section>
  );
}
