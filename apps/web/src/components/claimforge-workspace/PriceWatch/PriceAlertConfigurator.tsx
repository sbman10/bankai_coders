import React, { useState } from "react";
import { Bell, Check, Loader2, ShieldAlert, ArrowRight, Bookmark } from "lucide-react";
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
  const lowest = product.lowestPrice;
  const suggested5Percent = Math.round(lowest * 0.95);
  const suggested10Percent = Math.round(lowest * 0.90);
  const suggested15Percent = Math.round(lowest * 0.85);

  const [targetPrice, setTargetPrice] = useState<string>(suggested5Percent.toString());
  const [buffer, setBuffer] = useState<string>("500");
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
      alertScope: "any_store",
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
    <section className="pw2-alert-section" aria-labelledby="pw2-alert-heading">
      <div className="pw2-alert-container">
        <div className="pw2-alert-header">
          <div className="pw2-alert-title-wrap">
            <Bookmark size={20} className="pw2-alert-icon" />
            <h2 id="pw2-alert-heading" className="pw2-alert-title">
              Track this product
            </h2>
          </div>
          <p className="pw2-alert-subtitle">
            Set a target price and track price changes across verified store offers in your watchlist.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="pw2-alert-form">
          <div className="pw2-alert-inputs-row">
            {/* Target Price Input */}
            <div className="pw2-alert-field">
              <label htmlFor="pw2-target-price-input" className="pw2-alert-label">
                <span>Target price</span>
                <span className="pw2-alert-label-current">Current best: {formatINR(lowest)}</span>
              </label>

              <div className="pw2-alert-currency-box">
                <span className="pw2-alert-currency-symbol">₹</span>
                <input
                  id="pw2-target-price-input"
                  type="number"
                  min="1"
                  max="99999999"
                  step="1"
                  required
                  className="pw2-alert-input"
                  value={targetPrice}
                  onChange={(e) => {
                    setTargetPrice(e.target.value);
                    if (saveError) setSaveError(null);
                  }}
                  placeholder={suggested5Percent.toString()}
                  aria-label="Target price in Indian Rupees"
                />
              </div>

              {/* Quick Presets */}
              <div className="pw2-alert-presets">
                <button
                  type="button"
                  className={`pw2-preset-btn ${numTarget === suggested5Percent ? "is-active" : ""}`}
                  onClick={() => handlePresetClick(suggested5Percent)}
                >
                  -5% ({formatINR(suggested5Percent)})
                </button>
                <button
                  type="button"
                  className={`pw2-preset-btn ${numTarget === suggested10Percent ? "is-active" : ""}`}
                  onClick={() => handlePresetClick(suggested10Percent)}
                >
                  -10% ({formatINR(suggested10Percent)})
                </button>
                <button
                  type="button"
                  className={`pw2-preset-btn ${numTarget === suggested15Percent ? "is-active" : ""}`}
                  onClick={() => handlePresetClick(suggested15Percent)}
                >
                  -15% ({formatINR(suggested15Percent)})
                </button>
              </div>

              {numTarget > lowest && (
                <p className="pw2-alert-warning-text">
                  Your target ({formatINR(numTarget)}) is above the current verified price ({formatINR(lowest)}).
                </p>
              )}
            </div>

            {/* Near Target Buffer */}
            <div className="pw2-alert-field pw2-alert-field-buffer">
              <label htmlFor="pw2-buffer-input" className="pw2-alert-label">
                <span>Near-target alert threshold</span>
                <span className="pw2-alert-label-current">Optional</span>
              </label>

              <div className="pw2-alert-currency-box">
                <span className="pw2-alert-currency-symbol">₹</span>
                <input
                  id="pw2-buffer-input"
                  type="number"
                  min="0"
                  max="50000"
                  step="50"
                  className="pw2-alert-input"
                  value={buffer}
                  onChange={(e) => setBuffer(e.target.value)}
                  placeholder="500"
                  aria-label="Near-target price buffer in Rupees"
                />
              </div>
              <p className="pw2-alert-hint">
                Highlights offers within {formatINR(numBuffer || 0)} of your target.
              </p>
            </div>
          </div>

          {saveError && (
            <div className="pw2-alert-error" role="alert">
              <ShieldAlert size={16} />
              <span>{saveError}</span>
            </div>
          )}

          <div className="pw2-alert-action-row">
            <button
              type="submit"
              className="pw2-start-tracking-cta"
              disabled={isSaving || !isValidTarget}
              aria-label="Start tracking price for this product"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving watch...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check size={16} />
                  <span>Watch activated!</span>
                </>
              ) : (
                <>
                  <span>Start tracking</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
