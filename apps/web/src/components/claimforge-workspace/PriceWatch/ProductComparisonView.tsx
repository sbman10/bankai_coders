import React, { useState } from "react";
import {
  ExternalLink,
  ShieldCheck,
  Package,
  TrendingDown,
  TrendingUp,
  Tag,
  Store,
  ArrowUpDown,
  CheckCircle,
} from "lucide-react";
import { DiscoveredProduct, RetailerOffer } from "./types";
import { formatINR } from "./priceWatchAdapter";

interface ProductComparisonViewProps {
  product: DiscoveredProduct;
}

export function ProductComparisonView({ product }: ProductComparisonViewProps) {
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "retailer">("price_asc");

  // Sorted offers based on user preference
  const sortedOffers = [...product.offers].sort((a, b) => {
    if (sortBy === "price_asc") return a.price - b.price;
    if (sortBy === "price_desc") return b.price - a.price;
    return a.retailerName.localeCompare(b.retailerName);
  });

  return (
    <section className="pw2-comparison-container" aria-label="Product Identification and Multi-Store Comparison">
      {/* B1. Product Identity Card */}
      <div className="pw2-product-card">
        <div className="pw2-product-image-box">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="pw2-product-img"
              loading="lazy"
              onError={(e) => {
                // Graceful fallback if external image fails
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <Package size={44} strokeWidth={1.5} color="#8C827A" />
          )}
        </div>

        <div className="pw2-product-details">
          <div className="pw2-product-meta-top">
            <span className="pw2-brand-badge">{product.brand}</span>
            <span className="pw2-source-tag">Identified via {product.sourceRetailer}</span>
            <span className="pw2-verified-tag">
              <CheckCircle size={12} />
              <span>{product.verifiedTimestamp}</span>
            </span>
          </div>

          <h2 className="pw2-product-title" title={product.title}>
            {product.title}
          </h2>

          {product.variant && (
            <p className="pw2-product-variant">{product.variant}</p>
          )}

          {product.matchingConfidenceNote && (
            <div className="pw2-match-disclaimer">
              <ShieldCheck size={14} color="#15803D" />
              <span>{product.matchingConfidenceNote}</span>
            </div>
          )}
        </div>
      </div>

      {/* B2. Price Intelligence Summary Metric Strip */}
      <div className="pw2-metric-strip">
        <div className="pw2-metric-card is-lowest">
          <span className="pw2-metric-label">Lowest Current Offer</span>
          <span className="pw2-metric-value">{formatINR(product.lowestPrice)}</span>
          <span className="pw2-metric-hint">
            Available at {product.offers.find((o) => o.isLowestPrice)?.retailerName || "Retailer"}
          </span>
        </div>

        <div className="pw2-metric-card">
          <span className="pw2-metric-label">Highest Observed Offer</span>
          <span className="pw2-metric-value">{formatINR(product.highestPrice)}</span>
          <span className="pw2-metric-hint">Among comparable verified listings</span>
        </div>

        <div className="pw2-metric-card">
          <span className="pw2-metric-label">Potential Difference</span>
          <span className="pw2-metric-value">{formatINR(product.potentialSavings)}</span>
          <span className="pw2-metric-hint">Spread across monitored retailers</span>
        </div>

        <div className="pw2-metric-card">
          <span className="pw2-metric-label">Stores Compared</span>
          <span className="pw2-metric-value">{product.storesCount}</span>
          <span className="pw2-metric-hint">Active retailers with stock checked</span>
        </div>
      </div>

      {/* B3. Retailer Comparison Table */}
      <div className="pw2-table-card">
        <div className="pw2-table-header">
          <div className="pw2-table-title-wrap">
            <Store size={18} color="#EA580C" />
            <h3 className="pw2-table-title">Available Store Offers ({product.offers.length})</h3>
          </div>

          <div className="pw2-table-sort-wrap">
            <ArrowUpDown size={14} />
            <label htmlFor="pw2-sort-select">Sort by:</label>
            <select
              id="pw2-sort-select"
              className="pw2-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "price_asc" | "price_desc" | "retailer")}
              aria-label="Sort retailer offers"
            >
              <option value="price_asc">Price: Lowest First</option>
              <option value="price_desc">Price: Highest First</option>
              <option value="retailer">Retailer Name (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="pw2-table-wrap">
          <table className="pw2-table" aria-label="Retailer price comparison table">
            <thead>
              <tr>
                <th scope="col">Retailer</th>
                <th scope="col">Current Price</th>
                <th scope="col">Availability</th>
                <th scope="col">Last Checked</th>
                <th scope="col" style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedOffers.map((offer) => {
                const isLowest = offer.isLowestPrice ?? (offer.price === product.lowestPrice);

                return (
                  <tr
                    key={offer.id}
                    className={`pw2-table-row ${isLowest ? "is-lowest" : ""}`}
                  >
                    <td>
                      <div className="pw2-store-cell">
                        <div className="pw2-store-badge-icon">
                          {offer.retailerName.charAt(0)}
                        </div>
                        <div className="pw2-store-name-col">
                          <span className="pw2-store-name">{offer.retailerName}</span>
                          <span className="pw2-store-domain">{offer.storeDomain}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="pw2-price-cell">
                        <span className="pw2-price-current">{formatINR(offer.price)}</span>
                        {offer.originalPrice && offer.originalPrice > offer.price && (
                          <span className="pw2-price-original">{formatINR(offer.originalPrice)}</span>
                        )}
                        {isLowest && (
                          <span className="pw2-lowest-pill">Lowest</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="pw2-availability-cell">
                        <span className={`pw2-stock-dot ${offer.availability}`} />
                        <span>{offer.availabilityText || (offer.availability === "in_stock" ? "In Stock" : "Limited Stock")}</span>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: "0.8125rem", color: "#78716C" }}>
                        {offer.lastCheckedAt}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pw2-visit-btn"
                        aria-label={`Visit ${offer.retailerName} offer for ${formatINR(offer.price)}`}
                      >
                        <span>Visit Store</span>
                        <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
