import React, { useState, FormEvent } from "react";
import { Plus, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";

interface ProductOption {
  id: string;
  name: string;
}

interface ManualWatchFormProps {
  products: ProductOption[];
  busy: boolean;
  onAdd: (watch: {
    productId: string;
    productUrl: string;
    currentPrice: number;
    targetPrice: number;
    checkingMode: "manual" | "automated";
  }) => Promise<boolean>;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export function ManualWatchForm({
  products,
  busy,
  onAdd,
  isOpen = true,
  onToggleOpen,
}: ManualWatchFormProps) {
  const [productId, setProductId] = useState("");
  const [url, setUrl] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [checkingMode, setCheckingMode] = useState<"manual" | "automated">("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const saved = await onAdd({
      productId,
      productUrl: url.trim(),
      currentPrice: Number(currentPrice),
      targetPrice: Number(targetPrice),
      checkingMode,
    });
    setIsSubmitting(false);
    if (saved) {
      setUrl("");
      setCurrentPrice("");
      setTargetPrice("");
      setProductId("");
      setCheckingMode("manual");
    }
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8DFD5",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(44, 39, 34, 0.02)",
      }}
    >
      <div
        style={{
          padding: "1rem 1.5rem",
          background: "#FAF7F2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: isOpen ? "1px solid #E8DFD5" : "none",
          cursor: onToggleOpen ? "pointer" : "default",
        }}
        onClick={onToggleOpen}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "#FFFFFF",
              border: "1px solid #E8DFD5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#EA580C",
            }}
          >
            <TrendingDown size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#1C1917" }}>
              Start a manual watch
            </h3>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#78716C" }}>
              Set a target and update the current price when you check a retailer.
            </p>
          </div>
        </div>

        {onToggleOpen && (
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#8C827A",
              cursor: "pointer",
              padding: "0.25rem",
            }}
            aria-label={isOpen ? "Collapse manual watch form" : "Expand manual watch form"}
          >
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
      </div>

      {isOpen && (
        <form className="tool-form" onSubmit={submit} style={{ padding: "1.25rem 1.5rem", margin: 0 }}>
          {products.length === 0 ? (
            <p className="tool-empty" style={{ margin: "0.5rem 0" }}>
              Add a product in Products before creating a price watch.
            </p>
          ) : (
            <div className="tool-fields tool-fields-four" style={{ gap: "1rem" }}>
              <label>
                Product
                <select
                  required
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  style={{
                    background: "#FAF7F2",
                    border: "1px solid #D8CEC4",
                    borderRadius: "8px",
                    height: "40px",
                    padding: "0 0.75rem",
                  }}
                >
                  <option value="">Choose a saved product</option>
                  {products.map((product) => (
                    <option value={product.id} key={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Product link <span className="optional-label">OPTIONAL · HTTPS</span>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://store.example/item"
                  style={{
                    background: "#FAF7F2",
                    border: "1px solid #D8CEC4",
                    borderRadius: "8px",
                    height: "40px",
                    padding: "0 0.75rem",
                  }}
                />
              </label>

              <label>
                Current price (₹)
                <input
                  required
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  value={currentPrice}
                  onChange={(event) => setCurrentPrice(event.target.value)}
                  placeholder="2499"
                  style={{
                    background: "#FAF7F2",
                    border: "1px solid #D8CEC4",
                    borderRadius: "8px",
                    height: "40px",
                    padding: "0 0.75rem",
                  }}
                />
              </label>

              <label>
                Alert below (₹)
                <input
                  required
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  value={targetPrice}
                  onChange={(event) => setTargetPrice(event.target.value)}
                  placeholder="1999"
                  style={{
                    background: "#FAF7F2",
                    border: "1px solid #D8CEC4",
                    borderRadius: "8px",
                    height: "40px",
                    padding: "0 0.75rem",
                  }}
                />
              </label>
              <label>
                Check method
                <select value={checkingMode} onChange={(event) => setCheckingMode(event.target.value as "manual" | "automated")}>
                  <option value="manual">Manual updates</option>
                  <option value="automated">Daily retailer checks</option>
                </select>
                <span className="optional-label">AUTOMATED CHECKS NEED A SUPPORTED RETAILER LINK</span>
              </label>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button
              disabled={busy || isSubmitting || products.length === 0}
              className="button button-primary"
              type="submit"
              style={{
                background: "#EA580C",
                color: "#FFFFFF",
                borderRadius: "8px",
                padding: "0.625rem 1.25rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <Plus size={15} />
              <span>{checkingMode === "automated" ? "Start daily watch" : "Add manual watch"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
