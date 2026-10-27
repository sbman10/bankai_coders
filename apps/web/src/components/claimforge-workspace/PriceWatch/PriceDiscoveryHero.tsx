import React, { useState, FormEvent } from "react";
import { Link2, Search, X, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { validateProductUrl } from "./priceWatchAdapter";
import { SAMPLE_PRODUCTS } from "./priceWatchDemoData";

interface PriceDiscoveryHeroProps {
  onDiscover: (url: string) => Promise<void>;
  isLoading: boolean;
  initialUrl?: string;
}

export function PriceDiscoveryHero({ onDiscover, isLoading, initialUrl = "" }: PriceDiscoveryHeroProps) {
  const [url, setUrl] = useState(initialUrl);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const validation = validateProductUrl(url);
    if (!validation.isValid) {
      setValidationError(validation.error || "Please enter a valid product URL.");
      return;
    }

    try {
      await onDiscover(validation.normalizedUrl);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Could not discover offers for this link.");
    }
  };

  const handleSelectSample = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setValidationError(null);
    void onDiscover(sampleUrl);
  };

  return (
    <section className="pw2-hero-card" aria-labelledby="pw2-hero-title">
      <div className="pw2-hero-header">
        <div className="pw2-eyebrow">
          <span className="pw2-eyebrow-line" />
          <span>PRICE INTELLIGENCE</span>
        </div>
        <h1 id="pw2-hero-title" className="pw2-hero-title">
          Find the right price. Never miss the drop.
        </h1>
        <p className="pw2-hero-subtitle">
          Paste a product link, compare available offers across supported stores, and set an alert for the price you want. Know when the price is right.
        </p>
      </div>

      <form className="pw2-url-form" onSubmit={handleSubmit} noValidate>
        <div className={`pw2-url-input-wrap ${validationError ? "is-error" : ""}`}>
          <Link2 size={20} className="pw2-url-icon" aria-hidden="true" />
          <input
            type="url"
            className="pw2-url-input"
            placeholder="Paste a product link from a supported store (e.g. Amazon, Flipkart, Croma)..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isLoading}
            aria-label="Product URL to compare prices"
            required
          />
          {url && !isLoading && (
            <button
              type="button"
              className="pw2-clear-btn"
              onClick={() => {
                setUrl("");
                setValidationError(null);
              }}
              aria-label="Clear URL input"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="submit"
            className="pw2-submit-btn"
            disabled={isLoading || !url.trim()}
            aria-label="Compare prices across stores"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Comparing stores...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Compare Prices</span>
              </>
            )}
          </button>
        </div>

        {validationError && (
          <div className="pw2-url-feedback is-error" role="alert">
            <AlertCircle size={15} />
            <span>{validationError}</span>
          </div>
        )}

        {/* 1-Click Sample Previews for reviewers and test users */}
        <div className="pw2-sample-bar">
          <span className="pw2-sample-label">Try a preview:</span>
          {SAMPLE_PRODUCTS.map((prod) => (
            <button
              key={prod.id}
              type="button"
              className="pw2-sample-chip"
              onClick={() => handleSelectSample(prod.sourceUrl)}
              disabled={isLoading}
              title={`Compare prices for ${prod.model}`}
            >
              {prod.model}
            </button>
          ))}
        </div>

        <div className="pw2-supported-stores">
          <div className="pw2-store-pills">
            <span>Supported retailers:</span>
            <span className="pw2-store-pill">Amazon India</span>
            <span className="pw2-store-pill">Flipkart</span>
            <span className="pw2-store-pill">Croma</span>
            <span className="pw2-store-pill">Reliance Digital</span>
          </div>

          <div className="pw2-preview-badge" title="Automated multi-retailer engine is in frontend demonstration mode">
            <Sparkles size={12} />
            <span>Multi-store discovery engine</span>
          </div>
        </div>
      </form>
    </section>
  );
}
