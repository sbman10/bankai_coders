import React, { useState } from "react";
import {
  ExternalLink,
  ShieldCheck,
  Package,
  CheckCircle,
  AlertCircle,
  Tag,
  ArrowUpDown,
} from "lucide-react";
import { DiscoveredProduct, RetailerOffer } from "./types";
import { formatINR } from "./priceWatchAdapter";

interface ProductComparisonViewProps {
  product: DiscoveredProduct;
}

export function ProductComparisonView({ product }: ProductComparisonViewProps) {
  const [imgError, setImgError] = useState(false);
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc">("price_asc");

  // Filter valid in-stock or active offers
  const validOffers = product.offers.filter((o) => o.price > 0);
  const inStockOffers = validOffers.filter((o) => o.availability !== "out_of_stock");

  // Determine true lowest valid price offer
  const lowestOffer = inStockOffers.length > 0
    ? [...inStockOffers].sort((a, b) => a.price - b.price)[0]
    : validOffers.length > 0
    ? [...validOffers].sort((a, b) => a.price - b.price)[0]
    : undefined;

  // Sorted offers based on user preference
  const sortedOffers = [...validOffers].sort((a, b) => {
    if (sortBy === "price_asc") return a.price - b.price;
    return b.price - a.price;
  });

  // Approved store coverage tracking
  const presentRetailers = new Set(product.offers.map((o) => o.retailerName.toLowerCase()));
  const missingRetailers = ["Amazon India", "Flipkart", "Meesho"].filter(
    (name) => !presentRetailers.has(name.toLowerCase()) && !presentRetailers.has(name.split(" ")[0].toLowerCase())
  );

  return (
    <section className="pw2-comparison-section" aria-label="Product Identification and Multi-Store Comparison">
      {/* 5A. Product Identity Header Card */}
      <div className="pw2-product-identity-card">
        <div className="pw2-product-image-frame">
          {product.imageUrl && !imgError ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="pw2-product-img"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="pw2-product-img-fallback" aria-hidden="true">
              <Package size={36} strokeWidth={1.5} color="#8C827A" />
            </div>
          )}
        </div>

        <div className="pw2-product-meta-col">
          <div className="pw2-product-badge-row">
            {product.brand && (
              <span className="pw2-brand-tag">{product.brand}</span>
            )}
            <span className="pw2-source-tag">Via {product.sourceRetailer}</span>
            {product.verifiedTimestamp && (
              <span className="pw2-live-tag">
                <CheckCircle size={12} />
                <span>{product.verifiedTimestamp}</span>
              </span>
            )}
          </div>

          <h2 className="pw2-product-name" title={product.title}>
            {product.title}
          </h2>

          {product.variant && (
            <p className="pw2-product-specs">{product.variant}</p>
          )}

          {/* 5B. Matching Safety & Confidence Disclaimer */}
          {product.matchingConfidenceNote && (
            <div className="pw2-safety-note" role="note">
              <ShieldCheck size={14} className="pw2-safety-icon" />
              <span>{product.matchingConfidenceNote}</span>
            </div>
          )}
        </div>
      </div>

      {/* 6. Succinct Price Comparison Summary Strip (Integrated, not oversized KPI dashboard) */}
      <div className="pw2-summary-bar">
        <div className="pw2-summary-item">
          <span className="pw2-summary-label">Lowest verified price</span>
          <span className="pw2-summary-value-accent">
            {lowestOffer ? formatINR(lowestOffer.price) : "Price unavailable"}
          </span>
          {lowestOffer && (
            <span className="pw2-summary-sub">At {lowestOffer.retailerName}</span>
          )}
        </div>

        <div className="pw2-summary-divider" aria-hidden="true" />

        <div className="pw2-summary-item">
          <span className="pw2-summary-label">Verified store offers</span>
          <span className="pw2-summary-value">{validOffers.length}</span>
          <span className="pw2-summary-sub">
            {validOffers.length === 1 ? "Single store verified" : validOffers.length > 1 ? "Across checked stores" : "No verified store offers"}
          </span>
        </div>

        {product.potentialSavings > 0 && validOffers.length > 1 && (
          <>
            <div className="pw2-summary-divider" aria-hidden="true" />
            <div className="pw2-summary-item">
              <span className="pw2-summary-label">Price spread</span>
              <span className="pw2-summary-value">{formatINR(product.potentialSavings)}</span>
              <span className="pw2-summary-sub">Between lowest & highest valid offer</span>
            </div>
          </>
        )}
      </div>

      {/* 5C. Store Comparison Grid */}
      <div className="pw2-store-grid-wrap">
        <div className="pw2-store-grid-header">
          <h3 className="pw2-store-grid-title">
            Store offers ({validOffers.length})
          </h3>

          {validOffers.length > 1 && (
            <div className="pw2-sort-controls">
              <ArrowUpDown size={13} />
              <label htmlFor="pw2-sort-select">Sort by:</label>
              <select
                id="pw2-sort-select"
                className="pw2-sort-dropdown"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "price_asc" | "price_desc")}
                aria-label="Sort retailer offers"
              >
                <option value="price_asc">Price: Lowest first</option>
                <option value="price_desc">Price: Highest first</option>
              </select>
            </div>
          )}
        </div>

        {validOffers.length === 0 ? (
          <div className="pw2-offers-empty">
            <AlertCircle size={22} className="pw2-empty-alert-icon" />
            <p className="pw2-offers-empty-title">No verified offers found</p>
            <p className="pw2-offers-empty-text">
              We could not verify in-stock listings for this exact product model at this moment. Please check the product link or try again shortly.
            </p>
          </div>
        ) : (
          <div className="pw2-store-cards-grid">
            {sortedOffers.map((offer) => {
      const isLowest = lowestOffer?.id === offer.id;
              const isOutOfStock = offer.availability === "out_of_stock";

              return (
                <div
                  key={offer.id}
                  className={`pw2-store-card ${isLowest ? "is-lowest" : ""} ${isOutOfStock ? "is-unavailable" : ""}`}
                >
                  {/* Card Header: Store name & Lowest badge */}
                  <div className="pw2-store-card-header">
                    <div className="pw2-store-identity">
                      <span className="pw2-store-retailer-name">{offer.retailerName}</span>
                      <span className="pw2-store-retailer-domain">{offer.storeDomain}</span>
                    </div>

                    {isLowest && (
                      <span className="pw2-lowest-badge">
                        Lowest verified price
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Preview */}
                  <div className="pw2-store-card-thumb">
                    {product.imageUrl && !imgError ? (
                      <img
                        src={product.imageUrl}
                        alt={`${offer.retailerName} offer`}
                        className="pw2-store-thumb-img"
                        loading="lazy"
                      />
                    ) : (
                      <Package size={24} color="#8C827A" />
                    )}
                  </div>

                  {/* Price Hierarchy */}
                  <div className="pw2-store-pricing">
                    <div className="pw2-store-price-main">
                      <span className="pw2-store-price-amount">
                        {formatINR(offer.price)}
                      </span>
                      {offer.originalPrice && offer.originalPrice > offer.price && (
                        <span className="pw2-store-mrp-strikethrough">
                          {formatINR(offer.originalPrice)}
                        </span>
                      )}
                    </div>

                    {/* Availability Status */}
                    <div className="pw2-store-stock-row">
                      <span className={`pw2-stock-status-dot ${offer.availability}`} />
                      <span className="pw2-stock-status-text">
                        {offer.availabilityText || (isOutOfStock ? "Out of stock" : "In Stock")}
                      </span>
                    </div>

                    {/* Last Checked */}
                    <span className="pw2-store-last-checked">
                      {offer.lastCheckedAt}
                    </span>
                  </div>

                  {/* Link CTA */}
                  <div className="pw2-store-card-footer">
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pw2-store-visit-link"
                      aria-label={`View ${offer.retailerName} listing for ${formatINR(offer.price)}`}
                    >
                      <span>View on {offer.retailerName.split(" ")[0]}</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5E. Partial Results Notice if some stores could not be verified */}
        {missingRetailers.length > 0 && validOffers.length > 0 && (
          <p className="pw2-partial-notice">
            Note: {missingRetailers.join(" and ")} listings could not be verified for this exact variant or were unavailable.
          </p>
        )}
      </div>
    </section>
  );
}
