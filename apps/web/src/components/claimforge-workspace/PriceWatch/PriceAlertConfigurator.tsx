import React, { useState } from "react";
import { Bell, Check, Loader2, Sparkles, ShieldAlert, ArrowRight } from "lucide-react";
import { DiscoveredProduct, PriceAlertConfig } from "./types";
import { formatINR } from "./priceWatchAdapter";

interface PriceAlertConfiguratorProps {
  product: DiscoveredProduct;
  onStartTracking: (config: PriceAlertConfig) => Promise<boolean>;
  isSaving: boolean;
}

export function PriceAlertConfigurator({
  product,
  onStartTracking,
  isSaving,
}: PriceAlertConfiguratorProps) {
  // Pre-calculate convenient suggested targets based on lowest current offer
  const lowest = product.lowestPrice;
  const suggested5Percent = Math.round(lowest * 0.95);
  const suggested10Percent = Math.round(lowest * 0.90);
  const suggested15Percent = Math.round(lowest * 0.85);

  const [targetPrice, setTargetPrice] = useState<string>(suggested5Percent.toString());
  const [buffer, setBuffer] = useState<string>("500");
  const [alertScope, setAlertScope] = useState<"any_store" | "specific_store">("any_store");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const numTarget = Number(targetPrice);
  const numBuffer = Number(buffer) || 0;
  const isValidTarget = !isNaN(numTarget) && numTarget > 0;

  const handlePresetClick = (amount: number) => {
    setTargetPrice(amount.toString());
    setSaveError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTarget) {
      setSaveError("Please enter a valid target price greater than ₹0.");
      return;
    }

    setSaveError(null);
    const success = await onStartTracking({
      targetPrice: numTarget,
      nearTargetBuffer: numBuffer,
      alertScope,
      notifyInApp: true,
      notifyEmail: false,
      notifyWhatsApp: false,
    });

    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  };

  return (
    <section className="pw2-alert-card" aria-labelledby="pw2-alert-heading">
      <div className="pw2-alert-header">
        <div className="pw2-alert-title-wrap">
          <Bell size={20} className="pw2-alert-icon" />
          <h2 id="pw2-alert-heading" className="pw2-alert-title">
            Set your price alert
          </h2>
        </div>
        <p className="pw2-alert-subtitle">
          Choose your ideal price. Get notified when a verified offer matches your conditions.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="pw2-alert-grid">
          {/* Left Column: Target Price & Range Buffer */}
          <div className="pw2-alert-col">
            <div className="pw2-field-group">
              <label htmlFor="pw2-target-price-input" className="pw2-field-label">
                <span>Alert me when the price reaches:</span>
                <span className="pw2-field-label-hint">Current best: {formatINR(lowest)}</span>
              </label>

              <div className="pw2-currency-input-wrap">
                <span className="pw2-currency-symbol">₹</span>
                <input
                  id="pw2-target-price-input"
                  type="number"
                  min="1"
                  max="99999999"
                  step="1"
                  required
                  className="pw2-currency-input"
                  value={targetPrice}
                  onChange={(e) => {
                    setTargetPrice(e.target.value);
                    if (saveError) setSaveError(null);
                  }}
                  placeholder={suggested5Percent.toString()}
                  aria-label="Target price in Indian Rupees"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="pw2-preset-pills">
                <button
                  type="button"
                  className={`pw2-preset-pill ${numTarget === suggested5Percent ? "is-active" : ""}`}
                  onClick={() => handlePresetClick(suggested5Percent)}
                >
                  -5% ({formatINR(suggested5Percent)})
                </button>
                <button
                  type="button"
                  className={`pw2-preset-pill ${numTarget === suggested10Percent ? "is-active" : ""}`}
                  onClick={() => handlePresetClick(suggested10Percent)}
                >
                  -10% ({formatINR(suggested10Percent)})
                </button>
                <button
                  type="button"
                  className={`pw2-preset-pill ${numTarget === suggested15Percent ? "is-active" : ""}`}
                  onClick={() => handlePresetClick(suggested15Percent)}
                >
                  -15% ({formatINR(suggested15Percent)})
                </button>
              </div>

              {numTarget > lowest && (
                <p className="pw2-helper-text" style={{ color: "#B45309" }}>
                  Note: Your target ({formatINR(numTarget)}) is already higher than the current best offer ({formatINR(lowest)}).
                </p>
              )}
            </div>

            {/* Optional Near-Target Range Buffer */}
            <div className="pw2-field-group">
              <label htmlFor="pw2-buffer-input" className="pw2-field-label">
                <span>Near-target alert buffer (optional)</span>
                <span className="pw2-field-label-hint">Default: ₹500</span>
              </label>

              <div className="pw2-currency-input-wrap">
                <span className="pw2-currency-symbol">₹</span>
                <input
                  id="pw2-buffer-input"
                  type="number"
                  min="0"
                  max="50000"
                  step="50"
                  className="pw2-currency-input"
                  style={{ height: "42px", fontSize: "1rem" }}
                  value={buffer}
                  onChange={(e) => setBuffer(e.target.value)}
                  placeholder="500"
                  aria-label="Near-target price buffer in Rupees"
                />
              </div>

              <p className="pw2-helper-text">
                {numBuffer > 0 ? (
                  <>
                    We&apos;ll tag observations between <strong>{formatINR(numTarget)}</strong> and{" "}
                    <strong>{formatINR(numTarget + numBuffer)}</strong> as <em>&quot;Near Target&quot;</em> so you know when a drop is close.
                  </>
                ) : (
                  "Only alerts exactly at or below your target price."
                )}
              </p>
            </div>
          </div>

          {/* Right Column: Notification Channel & Scope Preview */}
          <div className="pw2-alert-col">
            <div className="pw2-notification-card">
              <div className="pw2-notification-card-title">Notification Channels</div>

              <div className="pw2-channel-item">
                <div className="pw2-channel-info">
                  <Bell size={16} color="#15803D" />
                  <span>ProductVault In-App Watchlist</span>
                </div>
                <span className="pw2-channel-badge-active">Active</span>
              </div>

              <div className="pw2-channel-item">
                <div className="pw2-channel-info">
                  <span style={{ color: "#8C827A" }}>✉</span>
                  <span>Instant Email Notification</span>
                </div>
                <span className="pw2-channel-badge-upcoming">Upcoming 2.0</span>
              </div>

              <div className="pw2-channel-item">
                <div className="pw2-channel-info">
                  <span style={{ color: "#8C827A" }}>💬</span>
                  <span>WhatsApp Deal Alert</span>
                </div>
                <span className="pw2-channel-badge-upcoming">Upcoming 2.0</span>
              </div>
            </div>

            <div className="pw2-field-group">
              <span className="pw2-field-label">Monitoring Scope</span>
              <div style={{ display: "flex", gap: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={alertScope === "any_store"}
                    onChange={() => setAlertScope("any_store")}
                  />
                  <span>Any verified store (Recommended)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {saveError && (
          <div className="pw2-url-feedback is-error" style={{ marginTop: "1rem" }} role="alert">
            <ShieldAlert size={15} />
            <span>{saveError}</span>
          </div>
        )}

        <div className="pw2-alert-footer">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "#78716C" }}>
            <Sparkles size={14} color="#EA580C" />
            <span>Adding to your active watches will monitor this product across all verified stores.</span>
          </div>

          <button
            type="submit"
            className="pw2-start-tracking-btn"
            disabled={isSaving || !isValidTarget}
            aria-label="Start tracking price for this product"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Saving Watch...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check size={18} />
                <span>Watch Activated!</span>
              </>
            ) : (
              <>
                <span>Start Tracking</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
