import React, { useState, useMemo } from "react";
import "./PriceWatch.css";
import { PriceDiscoveryHero } from "./PriceDiscoveryHero";
import { ProductComparisonView } from "./ProductComparisonView";
import { PriceAlertConfigurator } from "./PriceAlertConfigurator";
import { TrackedWatchesWorkspace } from "./TrackedWatchesWorkspace";
import { DiscoveredProduct, EnrichedPriceWatch, PriceAlertConfig, WatchStatus } from "./types";
import {
  discoverProductFromUrl,
  determineWatchStatus,
} from "./priceWatchAdapter";

export interface ExistingProduct {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
}

export interface ExistingWatch {
  id: string;
  productId: string;
  name: string;
  url: string;
  currentPrice: number;
  targetPrice: number;
  currency: string;
  lastCheckedAt?: string;
  createdAt: string;
}

interface PriceWatchViewProps {
  products: ExistingProduct[];
  watches: ExistingWatch[];
  busy: boolean;
  onAdd: (watch: {
    productId: string;
    productUrl: string;
    currentPrice: number;
    targetPrice: number;
  }) => Promise<boolean>;
  onUpdate: (id: string, price: number) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

export function PriceWatchView({
  products,
  watches,
  busy,
  onAdd,
  onUpdate,
  onRemove,
}: PriceWatchViewProps) {
  // Discovery State
  const [discoveredProduct, setDiscoveredProduct] = useState<DiscoveredProduct | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSavingAlert, setIsSavingAlert] = useState(false);
  const [sessionDemoWatches, setSessionDemoWatches] = useState<EnrichedPriceWatch[]>([]);

  // URL Discovery Handler
  const handleDiscover = async (url: string) => {
    setIsDiscovering(true);
    try {
      const result = await discoverProductFromUrl(url);
      setDiscoveredProduct(result);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Alert Tracking Handler
  const handleStartTracking = async (config: PriceAlertConfig): Promise<boolean> => {
    if (!discoveredProduct) return false;
    setIsSavingAlert(true);

    try {
      // Find matching saved product in library if one exists with similar name
      const matchingSavedProduct = products.find(
        (p) =>
          p.name.toLowerCase().includes(discoveredProduct.brand.toLowerCase()) ||
          discoveredProduct.title.toLowerCase().includes(p.name.toLowerCase())
      );
      const targetProductId = matchingSavedProduct
        ? matchingSavedProduct.id
        : products.length > 0
        ? products[0].id
        : `sample-${Date.now()}`;

      // If user has products in their library, persist to real API
      if (products.length > 0) {
        try {
          await onAdd({
            productId: targetProductId,
            productUrl: discoveredProduct.sourceUrl,
            currentPrice: discoveredProduct.lowestPrice,
            targetPrice: config.targetPrice,
          });
        } catch {
          // Fall back to session watch if API rejected (e.g. offline)
        }
      }

      // Add to session watches for immediate feedback
      const newWatch: EnrichedPriceWatch = {
        id: `watch-${Date.now()}`,
        productId: targetProductId,
        name: discoveredProduct.title,
        url: discoveredProduct.sourceUrl,
        currentPrice: discoveredProduct.lowestPrice,
        targetPrice: config.targetPrice,
        currency: "INR",
        lastCheckedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        brand: discoveredProduct.brand,
        model: discoveredProduct.model,
        imageUrl: discoveredProduct.imageUrl,
        retailerName: discoveredProduct.sourceRetailer,
        storesComparedCount: discoveredProduct.storesCount,
        nearTargetBuffer: config.nearTargetBuffer,
        status: determineWatchStatus(
          discoveredProduct.lowestPrice,
          config.targetPrice,
          config.nearTargetBuffer
        ),
        isDemo: true,
      };

      setSessionDemoWatches((prev) => [newWatch, ...prev]);
      return true;
    } finally {
      setIsSavingAlert(false);
    }
  };

  // Combine real database watches and session watches with rich UI metadata
  const allEnrichedWatches = useMemo<EnrichedPriceWatch[]>(() => {
    const realWatches: EnrichedPriceWatch[] = watches.map((w) => {
      const relatedProduct = products.find((p) => p.id === w.productId);
      const status: WatchStatus = determineWatchStatus(w.currentPrice, w.targetPrice);

      return {
        ...w,
        brand: relatedProduct?.brand,
        model: relatedProduct?.model,
        imageUrl: relatedProduct?.imageUrl,
        status,
        isDemo: false,
      };
    });

    return [...sessionDemoWatches, ...realWatches];
  }, [watches, products, sessionDemoWatches]);

  // Price update handler: updates in real API or local session
  const handleUpdatePrice = async (id: string, price: number): Promise<boolean> => {
    const isRealWatch = watches.some((w) => w.id === id);
    if (isRealWatch) {
      return await onUpdate(id, price);
    }

    setSessionDemoWatches((current) =>
      current.map((w) => {
        if (w.id === id) {
          const newStatus = determineWatchStatus(price, w.targetPrice, w.nearTargetBuffer);
          return {
            ...w,
            currentPrice: price,
            status: newStatus,
            lastCheckedAt: new Date().toISOString(),
          };
        }
        return w;
      })
    );
    return true;
  };

  // Remove watch handler: removes from real API or local session
  const handleRemoveWatch = async (id: string): Promise<boolean> => {
    const isRealWatch = watches.some((w) => w.id === id);
    if (isRealWatch) {
      return await onRemove(id);
    }

    setSessionDemoWatches((current) => current.filter((w) => w.id !== id));
    return true;
  };

  // Smooth scroll and focus to discovery input
  const handleFocusDiscovery = () => {
    const input = document.querySelector<HTMLInputElement>(".pw2-search-input");
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="pw2-root" aria-label="Price Watch Intelligence Experience">
      {/* Search-First Top Section: Standalone "Find the best price.", horizontal input, centered Compare prices CTA */}
      <PriceDiscoveryHero
        onDiscover={handleDiscover}
        isLoading={isDiscovering}
      />

      {/* Comparison Results & Target Tracking: Revealed when product is identified */}
      {discoveredProduct && (
        <>
          <ProductComparisonView product={discoveredProduct} />

          <PriceAlertConfigurator
            product={discoveredProduct}
            onStartTracking={handleStartTracking}
            isSaving={isSavingAlert}
          />
        </>
      )}

      {/* Image-Led Product Cards Workspace */}
      <TrackedWatchesWorkspace
        watches={allEnrichedWatches}
        busy={busy}
        onUpdatePrice={handleUpdatePrice}
        onRemoveWatch={handleRemoveWatch}
        onFocusDiscoveryInput={handleFocusDiscovery}
      />
    </div>
  );
}