import React, { useState } from "react";
import {
  ExternalLink,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Package,
  Edit3,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { EnrichedPriceWatch, WatchStatus } from "./types";
import { formatINR } from "./priceWatchAdapter";

interface TrackedWatchesWorkspaceProps {
  watches: EnrichedPriceWatch[];
  busy: boolean;
  onUpdatePrice: (id: string, newPrice: number) => Promise<boolean>;
  onRemoveWatch: (id: string) => Promise<boolean>;
  onSelectWatchForComparison?: (watch: EnrichedPriceWatch) => void;
  onFocusDiscoveryInput: () => void;
}

export function TrackedWatchesWorkspace({
  watches,
  busy,
  onUpdatePrice,
  onRemoveWatch,
  onFocusDiscoveryInput,
}: TrackedWatchesWorkspaceProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WatchStatus>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>("");
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

  // Filter watches by name or status
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
          <span className="pw2-status-pill is-target-reached" role="status">
            <CheckCircle2 size={12} />
            <span>Target reached</span>
          </span>
        );
      case "near_target":
        return (
          <span className="pw2-status-pill is-near-target" role="status">
            <AlertTriangle size={12} />
            <span>Near target</span>
          </span>
        );
      case "unavailable":
        return (
          <span className="pw2-status-pill is-unavailable" role="status">
            <span>Price unavailable</span>
          </span>
        );
      default:
        return (
          <span className="pw2-status-pill is-monitoring" role="status">
            <Clock size={12} />
            <span>Monitoring</span>
          </span>
        );
    }
  };

  const handleStartEdit = (watch: EnrichedPriceWatch) => {
    setEditingTargetId(watch.id);
    setEditPriceValue(watch.currentPrice.toString());
  };

  const handleSavePrice = async (watchId: string) => {
    const num = Number(editPriceValue);
    if (!isNaN(num) && num >= 0) {
      setIsUpdatingPrice(true);
      await onUpdatePrice(watchId, num);
      setIsUpdatingPrice(false);
      setEditingTargetId(null);
    }
  };

  const watchToDelete = watches.find((w) => w.id === confirmDeleteId);

  return (
    <section className="pw2-watchlist-section" aria-labelledby="pw2-watchlist-title">
      {/* 7A. Section Heading — Standalone, quiet count badge, NO eyebrow, NO marketing subtitle */}
      <div className="pw2-watchlist-header">
        <h2 id="pw2-watchlist-title" className="pw2-watchlist-title">
          <span>Your price watches</span>
          {watches.length > 0 && (
            <span className="pw2-watchlist-count-tag" aria-label={`${watches.length} tracked items`}>
              {watches.length}
            </span>
          )}
        </h2>

        {/* Optional Search / Filter when 3 or more watches exist */}
        {watches.length >= 3 && (
          <div className="pw2-watchlist-filter-bar">
            <div className="pw2-filter-input-wrap">
              <Search size={14} className="pw2-filter-search-icon" aria-hidden="true" />
              <input
                type="text"
                placeholder="Filter saved watches..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pw2-filter-search-input"
                aria-label="Filter saved watches"
              />
            </div>
            <div className="pw2-filter-pills">
              <button
                type="button"
                className={`pw2-filter-pill ${statusFilter === "all" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All ({watches.length})
              </button>
              <button
                type="button"
                className={`pw2-filter-pill ${statusFilter === "target_reached" ? "is-active" : ""}`}
                onClick={() => setStatusFilter("target_reached")}
              >
                At target ({watches.filter((w) => w.status === "target_reached").length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 7B & 7C. Image-Led Watch Cards Grid */}
      {watches.length === 0 ? (
        /* Empty State — Purposeful, not an oversized placeholder box */
        <div className="pw2-watchlist-empty-card">
          <div className="pw2-empty-icon-wrap" aria-hidden="true">
            <Package size={28} strokeWidth={1.5} color="#8C827A" />
          </div>
          <h3 className="pw2-empty-heading">No tracked products yet</h3>
          <p className="pw2-empty-description">
            Paste a product link from Amazon, Flipkart or Meesho above to compare live store prices and track price drops.
          </p>
          <button
            type="button"
            className="pw2-empty-action-btn"
            onClick={onFocusDiscoveryInput}
          >
            Find a product to track
          </button>
        </div>
      ) : filteredWatches.length === 0 ? (
        <div className="pw2-watchlist-empty-card">
          <p className="pw2-empty-description">No price watches match your filter.</p>
          <button
            type="button"
            className="pw2-filter-pill is-active"
            style={{ marginTop: "0.5rem" }}
            onClick={() => {
              setFilterQuery("");
              setStatusFilter("all");
            }}
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="pw2-watchlist-card-grid">
          {filteredWatches.map((watch) => {
            const diff = watch.currentPrice - watch.targetPrice;
            const isTargetReached = watch.currentPrice <= watch.targetPrice;
            const isEditing = editingTargetId === watch.id;

            return (
              <article
                key={watch.id}
                className={`pw2-watch-item-card ${isTargetReached ? "is-target-reached" : ""}`}
                aria-label={`Price watch for ${watch.name}`}
              >
                {/* Product Image Frame */}
                <div className="pw2-watch-image-container">
                  {watch.imageUrl ? (
                    <img
                      src={watch.imageUrl}
                      alt={watch.name}
                      className="pw2-watch-img"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="pw2-watch-fallback-icon" aria-hidden="true">
                      <Package size={36} strokeWidth={1.5} color="#A8A199" />
                    </div>
                  )}

                  {/* Top Overlay Badges */}
                  <div className="pw2-watch-top-badges">
                    {watch.retailerName && (
                      <span className="pw2-watch-retailer-tag">
                        {watch.retailerName}
                      </span>
                    )}
                    {getStatusBadge(watch.status)}
                  </div>
                </div>

                {/* Content Area */}
                <div className="pw2-watch-body">
                  <h3 className="pw2-watch-title" title={watch.name}>
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
                    {watch.currentPriceSource === "verified" ? (
                      <span className="pw2-watch-status-pill watching">Verified retailer price</span>
                    ) : watch.currentPriceSource === "unverified" ? (
                      <span className="pw2-watch-status-pill manual">Initial estimate · awaiting retailer check</span>
                    ) : (
                      <span className="pw2-watch-status-pill manual">User-entered price</span>
                    )}
                    {watch.lastCheckedAt && (
                      <span style={{ fontSize: "0.7188rem", color: "#8C827A" }}>
                        Checked {watch.lastCheckedAt.slice(0, 10)}
                      </span>
                    )}
                    {watch.checkingMode === "automated" && watch.lastCheckStatus && watch.lastCheckStatus !== "success" ? (
                      <span style={{ fontSize: "0.7188rem", color: "#9A3412" }}>
                        {watch.lastCheckStatus === "failed" ? "Latest retailer check unavailable" : "Waiting for the next retailer check"}
                      </span>
                    ) : null}
                  </div>
                  <div className="pw2-watch-pricing-block">
                    <div className="pw2-watch-price-row">
                      <span className="pw2-watch-current-val">{formatINR(watch.currentPrice)}</span>
                      <span className="pw2-watch-target-label">Target · {formatINR(watch.targetPrice)}</span>
                    </div>
                    <div className="pw2-watch-diff-row">
                      {watch.currentPriceSource === "unverified" ? (
                        <span>Target comparison will start after a verified retailer check.</span>
                      ) : isTargetReached ? (
                        <span className="pw2-diff-tag is-unlocked">
                          Deal unlocked ({formatINR(Math.abs(diff))} under target)
                        </span>
                      ) : (
                        <span className="pw2-diff-tag is-above">{formatINR(diff)} above target</span>
                      )}
                    </div>
                  </div>

                  {/* Meaningful Last Checked info */}
                  {watch.lastCheckedAt && (
                    <div className="pw2-watch-checked-time">
                      Checked {watch.lastCheckedAt.slice(0, 10)}
                    </div>
                  )}

                  {/* Inline Target/Price Editor (revealed only on click, not permanently cluttering) */}
                  {isEditing && (
                    <form
                      className="pw2-watch-inline-editor"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSavePrice(watch.id);
                      }}
                    >
                      <label htmlFor={`edit-price-${watch.id}`} className="pw2-editor-label">
                        Update verified price:
                      </label>
                      <div className="pw2-editor-input-row">
                        <span className="pw2-editor-currency">₹</span>
                        <input
                          id={`edit-price-${watch.id}`}
                          name="manual-price"
                          type="number"
                          min="0"
                          step="1"
                          required
                          className="pw2-editor-input"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          aria-label={`Update price for ${watch.name}`}
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="pw2-editor-save-btn"
                          disabled={isUpdatingPrice}
                          aria-label="Save price update"
                        >
                          {isUpdatingPrice ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          type="button"
                          className="pw2-editor-cancel-btn"
                          onClick={() => setEditingTargetId(null)}
                          aria-label="Cancel editing"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </form>
                  )}

                  {/* 7E. Purposeful Card Actions */}
                  <div className="pw2-watch-footer-actions">
                    <div className="pw2-watch-left-actions">
                      {watch.url && (
                        <a
                          href={watch.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pw2-watch-action-link"
                          aria-label={`Open store listing for ${watch.name}`}
                        >
                          <span>Store link</span>
                          <ExternalLink size={12} />
                        </a>
                      )}

                      {!isEditing && (
                        <button
                          type="button"
                          className="pw2-watch-action-btn"
                          onClick={() => handleStartEdit(watch)}
                          aria-label={`Update price for ${watch.name}`}
                        >
                          <Edit3 size={12} />
                          <span>Update</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="pw2-watch-delete-btn"
                      onClick={() => setConfirmDeleteId(watch.id)}
                      aria-label={`Remove price watch for ${watch.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Removing a Watch */}
      {confirmDeleteId && watchToDelete && (
        <div
          className="pw2-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pw2-delete-dialog-title"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="pw2-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pw2-delete-dialog-title" className="pw2-modal-title">
              Remove price watch?
            </h3>
            <p className="pw2-modal-body">
              Are you sure you want to stop tracking <strong>{watchToDelete.name}</strong>? You can always search and track this product again later.
            </p>
            <div className="pw2-modal-actions">
              <button
                type="button"
                className="pw2-modal-cancel-btn"
                onClick={() => setConfirmDeleteId(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pw2-modal-confirm-btn"
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
      )}
      {/* Price History Disclaimer */}
      {watches.length > 0 && (
        <p style={{ fontSize: "0.75rem", color: "#8C827A", textAlign: "center", margin: "0.5rem 0 0 0" }}>
          Automated prices are marked verified only when the retailer and product variant can be matched. Manual updates remain separate from verified retailer observations.
        </p>
      )}
    </section>
  );
}
