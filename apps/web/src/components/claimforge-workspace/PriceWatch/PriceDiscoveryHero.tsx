import React, { useState, FormEvent, KeyboardEvent } from "react";
import { Search, X, AlertCircle, Loader2 } from "lucide-react";
import { validateProductUrl } from "./priceWatchAdapter";

interface PriceDiscoveryHeroProps {
  onDiscover: (url: string) => Promise<void>;
  isLoading: boolean;
  initialUrl?: string;
}

export function PriceDiscoveryHero({ onDiscover, isLoading, initialUrl = "" }: PriceDiscoveryHeroProps) {
  const [url, setUrl] = useState(initialUrl);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    const trimmed = url.trim();
    if (!trimmed) {
      return;
    }

    setValidationError(null);

    const validation = validateProductUrl(trimmed);
    if (!validation.isValid) {
      setValidationError(validation.error || "Please enter a valid product link from Amazon, Flipkart or Meesho.");
      return;
    }

    try {
      await onDiscover(validation.normalizedUrl);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Could not discover offers for this link.");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <section className="pw2-search-section" aria-label="Product Price Search">
      {/* Standalone Central Heading — No eyebrow, no subtitle, deliberate whitespace */}
      <h1 className="pw2-search-title">
        Find the best price.
      </h1>

      <form className="pw2-search-form" onSubmit={handleSubmit} noValidate>
        {/* Prominent Horizontal Search Field (680-800px max width, ivory/white, clean focus) */}
        <div className={`pw2-search-input-box ${validationError ? "is-error" : ""}`}>
          <Search size={18} className="pw2-search-icon" aria-hidden="true" />
          <input
            type="url"
            className="pw2-search-input"
            placeholder="Paste a product link from Amazon, Flipkart or Meesho"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (validationError) setValidationError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label="Product URL to compare prices"
          />
          {url && !isLoading && (
            <button
              type="button"
              className="pw2-search-clear"
              onClick={() => {
                setUrl("");
                setValidationError(null);
              }}
              aria-label="Clear URL input"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Primary CTA placed beneath the search field, visually centered */}
        <div className="pw2-search-cta-row">
          <button
            type="submit"
            className="pw2-search-submit-btn"
            disabled={isLoading || !url.trim()}
            aria-label="Compare prices"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Comparing stores...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Compare prices</span>
              </>
            )}
          </button>
        </div>

        {/* Validation / API Error Feedback */}
        {validationError && (
          <div className="pw2-search-error-banner" role="alert">
            <AlertCircle size={16} className="pw2-search-error-icon" />
            <span className="pw2-search-error-text">{validationError}</span>
          </div>
        )}

        {/* Discreet indication of supported stores (not attached to heading, no noisy badge strip) */}
        <p className="pw2-supported-stores-note">
          Supported stores: Amazon India · Flipkart · Meesho
        </p>
      </form>
    </section>
  );
}
