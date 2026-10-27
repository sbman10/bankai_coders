import type { CanonicalProductIdentity, CanonicalProductVariant } from "../platforms/platform.types";

export type MatchStatus =
  | "VERIFIED"
  | "STRONG_MATCH"
  | "POSSIBLE"
  | "POSSIBLE_MATCH"
  | "LOW_CONFIDENCE"
  | "REJECT"
  | "MISMATCH";

export interface MatchResult {
  isMatch: boolean;
  confidenceScore: number; // 0 to 100
  matchStatus: MatchStatus;
  rejectionReason?: string;
  matchedAttributes: string[];
  variantDifference?: string[];
}

/**
 * Tokenizes a string into lowercase alphanumeric words, filtering out common stopwords.
 */
function tokenize(text: string): Set<string> {
  const stopwords = new Set(["the", "and", "with", "for", "by", "in", "of", "to", "at", "a", "an", "online", "buy"]);
  // Normalize "8 gb" -> "8gb", "128 gb" -> "128gb", etc.
  const normalized = text.toLowerCase().replace(/(\d+)\s+(gb|tb|mb|ml|g|kg)\b/gi, "$1$2");
  const tokens = normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopwords.has(t));
  return new Set(tokens);
}

/**
 * Computes Jaccard similarity between two token sets (0.0 to 1.0).
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection++;
    }
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Normalizes variant strings for reliable comparison (e.g. "128 gb" -> "128GB").
 */
function normalizeSpec(val: string | null | undefined): string | null {
  if (!val) return null;
  return val.trim().toLowerCase().replace(/\s+/g, "");
}

export class ProductMatcher {
  /**
   * Evaluates whether a candidate product matches the canonical reference product.
   * STRICT VARIANT REJECTION: Any conflicting Model, Generation, RAM, Storage,
   * Volume, Size, Capacity, Connectivity, Color, or Pack instantly rejects the match.
   */
  evaluateMatch(
    reference: CanonicalProductIdentity,
    candidate: {
      title: string;
      brand?: string | null;
      model?: string | null;
      modelNumber?: string | null;
      sku?: string | null;
      category?: string | null;
      variant?: CanonicalProductVariant;
    }
  ): MatchResult {
    const matchedAttributes: string[] = [];
    const variantDifference: string[] = [];
    const candVariant = candidate.variant || {};
    const refVariant = reference.variant || {};

    // ─────────────────────────────────────────────────────────────────────────
    // 1. BRAND CONFLICT CHECK
    // ─────────────────────────────────────────────────────────────────────────
    if (reference.brand && candidate.brand) {
      const refB = reference.brand.trim().toLowerCase();
      const candB = candidate.brand.trim().toLowerCase();
      if (refB !== candB && !refB.includes(candB) && !candB.includes(refB)) {
        return {
          isMatch: false,
          confidenceScore: 0,
          matchStatus: "MISMATCH",
          rejectionReason: `Brand conflict: '${reference.brand}' vs '${candidate.brand}'`,
          matchedAttributes: [],
        };
      }
      matchedAttributes.push("brand");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. MODEL CONFLICT & MODIFIER CHECK
    // ─────────────────────────────────────────────────────────────────────────
    if (reference.model && candidate.model) {
      const refM = reference.model.trim().toLowerCase();
      const candM = candidate.model.trim().toLowerCase();

      // If neither contains the other, that's an outright model conflict (e.g. G102 vs G304, M2 vs M3, S23 vs S24)
      if (refM !== candM && !refM.includes(candM) && !candM.includes(refM)) {
        return {
          isMatch: false,
          confidenceScore: 0,
          matchStatus: "MISMATCH",
          rejectionReason: `Model conflict: '${reference.model}' vs '${candidate.model}'`,
          matchedAttributes: [],
        };
      }

      // Check model modifiers: pro, max, plus, ultra, mini, lite, fe, se, ti, super, neo
      const modifiers = ["pro", "max", "plus", "ultra", "mini", "lite", "fe", "se", "ti", "super", "neo"];
      for (const mod of modifiers) {
        const refHas = new RegExp(`\\b${mod}\\b`, "i").test(refM);
        const candHas = new RegExp(`\\b${mod}\\b`, "i").test(candM);
        if (refHas !== candHas) {
          return {
            isMatch: false,
            confidenceScore: 0,
            matchStatus: "MISMATCH",
            rejectionReason: `Model variant modifier mismatch (${mod}): '${reference.model}' vs '${candidate.model}'`,
            matchedAttributes: [],
          };
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. STRICT VARIANT INCOMPATIBILITY GATES (Any mismatch = immediate rejection)
    // ─────────────────────────────────────────────────────────────────────────

    // A. Storage mismatch
    const refStorage = normalizeSpec(refVariant.storage);
    const candStorage = normalizeSpec(candVariant.storage);
    if (refStorage && candStorage && refStorage !== candStorage) {
      return {
        isMatch: false,
        confidenceScore: 0,
        matchStatus: "MISMATCH",
        rejectionReason: `Storage mismatch: '${refVariant.storage}' vs '${candVariant.storage}'`,
        matchedAttributes: [],
      };
    }
    if (refStorage && candStorage && refStorage === candStorage) {
      matchedAttributes.push("storage");
    }

    // B. RAM mismatch
    const refRam = normalizeSpec(refVariant.ram);
    const candRam = normalizeSpec(candVariant.ram);
    if (refRam && candRam && refRam !== candRam) {
      return {
        isMatch: false,
        confidenceScore: 0,
        matchStatus: "MISMATCH",
        rejectionReason: `RAM mismatch: '${refVariant.ram}' vs '${candVariant.ram}'`,
        matchedAttributes: [],
      };
    }
    if (refRam && candRam && refRam === candRam) {
      matchedAttributes.push("ram");
    }

    // C. Volume / Weight mismatch (e.g. 100ml vs 200ml)
    const refVol = normalizeSpec(refVariant.volume_or_weight);
    const candVol = normalizeSpec(candVariant.volume_or_weight);
    if (refVol && candVol && refVol !== candVol) {
      return {
        isMatch: false,
        confidenceScore: 0,
        matchStatus: "MISMATCH",
        rejectionReason: `Volume/weight mismatch: '${refVariant.volume_or_weight}' vs '${candVariant.volume_or_weight}'`,
        matchedAttributes: [],
      };
    }
    if (refVol && candVol && refVol === candVol) {
      matchedAttributes.push("volume_or_weight");
    }

    // D. Pack Size mismatch (e.g. Pack of 1 vs Pack of 2)
    if (
      refVariant.pack_size !== undefined &&
      refVariant.pack_size !== null &&
      candVariant.pack_size !== undefined &&
      candVariant.pack_size !== null &&
      refVariant.pack_size !== candVariant.pack_size
    ) {
      return {
        isMatch: false,
        confidenceScore: 0,
        matchStatus: "MISMATCH",
        rejectionReason: `Pack size mismatch: '${refVariant.pack_size}' vs '${candVariant.pack_size}'`,
        matchedAttributes: [],
      };
    }
    if (refVariant.pack_size && candVariant.pack_size && refVariant.pack_size === candVariant.pack_size) {
      matchedAttributes.push("pack_size");
    }

    // E. Size mismatch (e.g. Clothing M vs XL, or TV 55" vs 65")
    const refSize = normalizeSpec(refVariant.size);
    const candSize = normalizeSpec(candVariant.size);
    if (refSize && candSize && refSize !== candSize) {
      return {
        isMatch: false,
        confidenceScore: 0,
        matchStatus: "MISMATCH",
        rejectionReason: `Size mismatch: '${refVariant.size}' vs '${candVariant.size}'`,
        matchedAttributes: [],
      };
    }
    if (refSize && candSize && refSize === candSize) {
      matchedAttributes.push("size");
    }

    // F. Capacity mismatch (e.g. 9kg vs 8kg, 9kg vs 5.5kg)
    const refCapacity = normalizeSpec(refVariant.capacity);
    const candCapacity = normalizeSpec(candVariant.capacity);
    if (refCapacity && candCapacity && refCapacity !== candCapacity) {
      return {
        isMatch: false,
        confidenceScore: 0,
        matchStatus: "MISMATCH",
        rejectionReason: `Capacity mismatch: '${refVariant.capacity}' vs '${candVariant.capacity}'`,
        matchedAttributes: [],
      };
    }
    if (refCapacity && candCapacity && refCapacity === candCapacity) {
      matchedAttributes.push("capacity");
    }

    // G. Connectivity mismatch (e.g. WiFi Enabled vs Non-WiFi)
    const refConn = normalizeSpec(refVariant.connectivity);
    const candConn = normalizeSpec(candVariant.connectivity);
    if (refConn && candConn && refConn !== candConn) {
      return {
        isMatch: false,
        confidenceScore: 0,
        matchStatus: "MISMATCH",
        rejectionReason: `Connectivity mismatch: '${refVariant.connectivity}' vs '${candVariant.connectivity}'`,
        matchedAttributes: [],
      };
    }
    if (refConn && candConn && refConn === candConn) {
      matchedAttributes.push("connectivity");
    }

    // H. Appliance Load Type mismatch (e.g. Front Load vs Top Load)
    const refType = normalizeSpec(refVariant.appliance_type);
    const candType = normalizeSpec(candVariant.appliance_type);
    if (refType && candType && refType !== candType) {
      return {
        isMatch: false,
        confidenceScore: 0,
        matchStatus: "MISMATCH",
        rejectionReason: `Appliance type mismatch: '${refVariant.appliance_type}' vs '${candVariant.appliance_type}'`,
        matchedAttributes: [],
      };
    }
    if (refType && candType && refType === candType) {
      matchedAttributes.push("appliance_type");
    }

    // I. Color / Shade Mismatch Gate (e.g. Red vs Blue in Fashion & Beauty)
    const refColor = normalizeSpec(refVariant.color);
    const candColor = normalizeSpec(candVariant.color);
    if (refColor && candColor && refColor !== candColor) {
      const refWords = refColor.replace(/[^a-z]/g, " ").split(/\s+/).filter((w) => w.length > 2);
      const candWords = candColor.replace(/[^a-z]/g, " ").split(/\s+/).filter((w) => w.length > 2);
      const hasCommonColor = refWords.some((w) => candWords.includes(w));
      if (!hasCommonColor && refWords.length > 0 && candWords.length > 0) {
        if (reference.category === "Fashion & Apparel" || reference.category === "Beauty & Personal Care") {
          return {
            isMatch: false,
            confidenceScore: 0,
            matchStatus: "MISMATCH",
            rejectionReason: `Color/shade mismatch: '${refVariant.color}' vs '${candVariant.color}'`,
            matchedAttributes: [],
            variantDifference: ["color"],
          };
        }
        variantDifference.push("color");
      }
    }
    if (refColor && candColor && refColor === candColor) {
      matchedAttributes.push("color");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CONFIDENCE SCORING ENGINE
    // ─────────────────────────────────────────────────────────────────────────
    let score = 0;

    // Check SKU / Model Number exact match (+30)
    if (
      reference.modelNumber &&
      candidate.modelNumber &&
      normalizeSpec(reference.modelNumber) === normalizeSpec(candidate.modelNumber)
    ) {
      score += 30;
      matchedAttributes.push("model_number");
    }

    // Exact Brand Match (+30)
    if (matchedAttributes.includes("brand")) {
      score += 30;
    }

    // Model Name Match (+35 for exact, +20 for partial containment)
    if (reference.model && candidate.model) {
      const refM = reference.model.trim().toLowerCase();
      const candM = candidate.model.trim().toLowerCase();
      if (refM === candM) {
        score += 35;
        matchedAttributes.push("model");
        // For categories without RAM/storage (audio, peripherals, consumer electronics),
        // exact brand + exact model constitutes full primary specification (+15)
        if (matchedAttributes.includes("brand") && !refVariant.storage && !refVariant.ram) {
          score += 15;
        }
      } else if (refM.includes(candM) || candM.includes(refM)) {
        score += 20;
        matchedAttributes.push("model_partial");
      }
    }

    // Exact Storage or Volume (+15)
    if (matchedAttributes.includes("storage") || matchedAttributes.includes("volume_or_weight")) {
      score += 15;
    }

    // Exact RAM Match (+15)
    if (matchedAttributes.includes("ram")) {
      score += 15;
    }

    // Exact Size or Pack Match (+15)
    if (matchedAttributes.includes("size") || matchedAttributes.includes("pack_size")) {
      score += 15;
    }

    // Exact Capacity Match (+20)
    if (matchedAttributes.includes("capacity")) {
      score += 20;
    }

    // Exact Connectivity or Appliance Type Match (+10)
    if (matchedAttributes.includes("connectivity") || matchedAttributes.includes("appliance_type")) {
      score += 10;
    }

    // Exact Color (+10)
    if (matchedAttributes.includes("color")) {
      score += 10;
    }

    // Title Token Overlap (up to +15)
    const refTokens = tokenize(reference.cleanTitle);
    const candTokens = tokenize(candidate.title);
    const titleSim = jaccardSimilarity(refTokens, candTokens);
    score += Math.round(titleSim * 15);

    // Category Compatibility (+10)
    if (
      reference.category &&
      candidate.category &&
      (reference.category === candidate.category || reference.category === "General" || candidate.category === "General")
    ) {
      score += 10;
      matchedAttributes.push("category");
    }

    // Cap score at 100
    const finalScore = Math.min(100, Math.max(0, score));

    // Threshold evaluation:
    // >= 90 → STRONG_MATCH / VERIFIED (Auto-comparable)
    // 75–89 → POSSIBLE_MATCH (Do not auto-compare)
    // < 75  → LOW_CONFIDENCE / REJECT
    if (finalScore >= 90) {
      return {
        isMatch: true,
        confidenceScore: finalScore,
        matchStatus: "STRONG_MATCH",
        matchedAttributes,
        variantDifference: variantDifference.length > 0 ? variantDifference : undefined,
      };
    }

    if (finalScore >= 75) {
      return {
        isMatch: false, // Not eligible for auto-comparison
        confidenceScore: finalScore,
        matchStatus: "POSSIBLE_MATCH",
        rejectionReason: `Confidence score (${finalScore}%) is possible (75-89%) but not verified (>=90%) for auto-comparison`,
        matchedAttributes,
        variantDifference: variantDifference.length > 0 ? variantDifference : undefined,
      };
    }

    return {
      isMatch: false,
      confidenceScore: finalScore,
      matchStatus: "LOW_CONFIDENCE",
      rejectionReason: `Confidence score (${finalScore}%) is below acceptable threshold (75%)`,
      matchedAttributes,
      variantDifference: variantDifference.length > 0 ? variantDifference : undefined,
    };
  }
}

export const defaultProductMatcher = new ProductMatcher();
