import type {
  CanonicalProductIdentity,
  CanonicalProductVariant,
  SupportedStorePlatform,
} from "../platforms/platform.types";

/**
 * Common known brands to assist in high-confidence brand extraction when headers/byline are ambiguous.
 */
const KNOWN_BRANDS = [
  "Apple",
  "Samsung",
  "Realme",
  "Xiaomi",
  "Redmi",
  "OnePlus",
  "Google",
  "Sony",
  "Soundcore",
  "boAt",
  "Boat",
  "Logitech",
  "Noise",
  "JBL",
  "Sennheiser",
  "Bose",
  "Marshall",
  "Lenovo",
  "HP",
  "Dell",
  "Asus",
  "Acer",
  "LG",
  "Philips",
  "Panasonic",
  "Whirlpool",
  "IFB",
  "Bosch",
  "Haier",
  "Godrej",
  "Voltas",
  "Daikin",
  "Lloyd",
  "Blue Star",
  "Carrier",
  "Nivea",
  "L'Oreal",
  "Garnier",
  "Cetaphil",
  "Neutrogena",
  "Mamaearth",
  "Puma",
  "Nike",
  "Adidas",
  "Levi's",
  "Zara",
  "H&M",
];

export function extractVariantAttributes(title: string, specText?: string): CanonicalProductVariant {
  if (isBlockedOrErrorTitle(title)) {
    return {};
  }
  const combined = `${title} ${specText || ""}`;
  const variant: CanonicalProductVariant = {};

  // 1. RAM: e.g. "8GB RAM", "12 GB RAM", "8 GB RAM", "16GB RAM"
  const ramMatch = combined.match(/\b(\d+)\s*GB\s+RAM\b/i) || combined.match(/\bRAM\s*:\s*(\d+)\s*GB\b/i);
  if (ramMatch) {
    variant.ram = `${ramMatch[1]}GB`;
  }

  // 2. Storage / ROM: e.g. "128GB Storage", "256 GB ROM", "512GB SSD", "1TB", "1 TB"
  const tbMatch = combined.match(/\b(1|2)\s*TB\b/i);
  if (tbMatch) {
    variant.storage = `${tbMatch[1]}TB`;
  } else {
    const storageMatch =
      combined.match(/\b(\d+)\s*GB\s*(?:ROM|Storage|SSD|Internal\s*Storage)\b/i) ||
      combined.match(/\bStorage\s*:\s*(\d+)\s*GB\b/i) ||
      combined.match(/(?:,\s*|\/|\()\s*(\d+)\s*GB(?:\s*(?:Storage|ROM|\)|,))/i);
    if (storageMatch) {
      variant.storage = `${storageMatch[1]}GB`;
    }
  }

  // Combined RAM/Storage pattern: e.g. "8GB/128GB" or "8GB + 128GB" or "(8GB RAM, 128GB Storage)"
  if (!variant.ram || !variant.storage) {
    const dualMatch = combined.match(/\b(\d+)\s*GB\s*(?:\/|\+|\s+and\s+)\s*(\d+)\s*GB\b/i);
    if (dualMatch) {
      if (!variant.ram) variant.ram = `${dualMatch[1]}GB`;
      if (!variant.storage) variant.storage = `${dualMatch[2]}GB`;
    }
  }

  // 3. Volume or Weight: e.g. "100ml", "100 ml", "200ml", "500g", "1kg", "1.5 kg"
  const volWeightMatch =
    combined.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|kg|gm|ltr|litre|litres|g)\b/i) ||
    combined.match(/\b(?:Volume|Weight|Net Quantity)\s*:\s*(\d+(?:\.\d+)?)\s*(ml|l|g|kg|gm)\b/i);
  if (volWeightMatch && volWeightMatch[1] && volWeightMatch[2]) {
    const amount = volWeightMatch[1];
    const unit = volWeightMatch[2].toLowerCase();
    // Cellular 4G, 5G, and RAM/Storage numbers must never be extracted as grams
    if (
      !(
        unit === "g" &&
        (amount === "4" || amount === "5" || amount === "6" || amount === "8" || amount === "12" || amount === "16" || amount === "64" || amount === "128" || amount === "256" || amount === "512")
      )
    ) {
      variant.volume_or_weight = `${amount}${unit}`;
    }
  }

  // 4. Pack Size: e.g. "Pack of 2", "Pack of 3", "Set of 4", "(Pack of 1)"
  const packMatch = combined.match(/\b(?:Pack|Set)\s+of\s+(\d+)\b/i);
  if (packMatch) {
    variant.pack_size = parseInt(packMatch[1], 10);
  }

  // 5. Clothing or Footwear Size: e.g. "Size: M", "Size: XL", "Size: 42"
  const clothingSizeMatch =
    combined.match(/\b(?:Size|size)\s*:\s*(XS|S|M|L|XL|XXL|XXXL|\d{2})\b/i) ||
    combined.match(/\b(?:Size\s+)?\((XS|S|M|L|XL|XXL|XXXL)\)\b/i);
  if (clothingSizeMatch) {
    variant.size = clothingSizeMatch[1].toUpperCase();
  }

  // 6. Capacity (Washing Machines & Home Appliances): e.g. "9 kg", "9Kg", "8.5 kg", "5.5 kg"
  const titleCapacityMatch = title.match(/\b(\d+(?:\.\d+)?)\s*kg(?![a-zA-Z])/i);
  if (titleCapacityMatch) {
    variant.capacity = `${titleCapacityMatch[1]} kg`;
  } else {
    const capacityMatch = combined.match(/\b(\d+(?:\.\d+)?)\s*kg(?![a-zA-Z])/i);
    if (capacityMatch) {
      variant.capacity = `${capacityMatch[1]} kg`;
    } else if (variant.volume_or_weight && /(\d+(?:\.\d+)?)\s*kg/i.test(variant.volume_or_weight)) {
      const m = variant.volume_or_weight.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (m) variant.capacity = `${m[1]} kg`;
    }
  }

  // 7. Connectivity: e.g. "WiFi Enabled" vs "Non-WiFi" (Title takes precedence over other variant chips)
  if (/\b(Wi-?Fi\s+Enabled|WiFi\s+Enabled)\b/i.test(title) && !/\b(Non-Wi-?Fi|without\s+Wi-?Fi)\b/i.test(title)) {
    variant.connectivity = "WiFi Enabled";
  } else if (/\b(Non-Wi-?Fi|Non\s+WiFi|without\s+Wi-?Fi)\b/i.test(title)) {
    variant.connectivity = "Non-WiFi";
  } else if (/\b(Wi-?Fi\s+Enabled|WiFi\s+Enabled)\b/i.test(combined) && !/\b(Non-Wi-?Fi|without\s+Wi-?Fi)\b/i.test(combined)) {
    variant.connectivity = "WiFi Enabled";
  } else if (/\b(Non-Wi-?Fi|Non\s+WiFi|without\s+Wi-?Fi)\b/i.test(combined)) {
    variant.connectivity = "Non-WiFi";
  }

  // 8. Appliance Load Type: e.g. "Front Load" vs "Top Load"
  if (/\bFront\s*Load\b/i.test(title)) {
    variant.appliance_type = "Front Load";
  } else if (/\bTop\s*Load\b/i.test(title)) {
    variant.appliance_type = "Top Load";
  } else if (/\bFront\s*Load\b/i.test(combined)) {
    variant.appliance_type = "Front Load";
  } else if (/\bTop\s*Load\b/i.test(combined)) {
    variant.appliance_type = "Top Load";
  }

  // 9. Display Screen Size: e.g. "65 inch", "55 Inch", "15.6 inch" (Only from title)
  if (!variant.size) {
    const displaySizeMatch = title.match(/\b(\d{2}(?:\.\d+)?)\s*(?:inch|inches)\b/i);
    if (displaySizeMatch) {
      variant.size = `${displaySizeMatch[1]} inch`;
    }
  }

  // 10. Color: scan for common color names or pattern "Color: [Name]"
  const colorSpecMatch = combined.match(/\b(?:Color|Colour)\s*:\s*([A-Za-z\s]+?)(?:,|\.|\n|;|\)|$)/i);
  if (colorSpecMatch) {
    variant.color = colorSpecMatch[1].trim();
  } else {
    const commonColors = [
      "Midnight Green",
      "Emerald Green",
      "Forest Green",
      "Mint Green",
      "Nordic Blue",
      "Haze Blue",
      "Submarine Blue",
      "Midnight Blue",
      "Space Grey",
      "Phantom Black",
      "Cosmic Green",
      "Peacock Green",
      "Peacock Blue",
      "Submarine Blue",
      "Midnight Green",
      "Cosmic Black",
      "Titan Black",
      "Onyx Black",
      "Alpine Green",
      "Sierra Blue",
      "Titan Grey",
      "Chromatic Gray",
      "Gray Onyx",
      "Onyx Grey",
      "Mocha",
      "Anthracite Grey",
      "Blue Marble",
      "Silver Ray",
      "Emerald Forest",
      "Black",
      "White",
      "Blue",
      "Silver",
      "Gold",
      "Red",
      "Green",
      "Grey",
      "Gray",
      "Purple",
    ];
    for (const c of commonColors) {
      const rx = new RegExp(`\\b${c}\\b`, "i");
      if (rx.test(combined)) {
        variant.color = c;
        break;
      }
    }
  }

  return variant;
}

export function isBlockedOrErrorTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  return (
    lower.includes("amazon-adsystem") ||
    lower.includes("aax-") ||
    lower.includes("is blocked") ||
    lower.includes("was blocked") ||
    lower.includes("blocked by client") ||
    lower.includes("net::err_") ||
    lower.includes("access denied") ||
    lower.includes("robot check") ||
    lower.includes("automated access") ||
    lower.includes("page not found") ||
    lower.includes("looking for something?") ||
    lower.includes("something went wrong") ||
    lower.includes("we're sorry") ||
    lower.includes("403 forbidden") ||
    lower.includes("404 not found") ||
    lower.includes("500 internal") ||
    lower === "amazon.in" ||
    lower === "amazon" ||
    lower === "online shopping"
  );
}

export function cleanProductTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  if (isBlockedOrErrorTitle(rawTitle)) return "";
  return rawTitle
    .replace(/^Amazon\.in\s*:?\s*/i, "")
    .replace(/: Amazon\.in$/i, "")
    .replace(/\s*:?\s*Buy .* at Flipkart.*$/i, "")
    .replace(/: Flipkart\.com$/i, "")
    .replace(/\|\s*Online at Best Price.*$/i, "")
    .replace(/\s*\.\.\.\s*more$/i, "")
    .replace(/\s*\.\.\.$/, "")
    .replace(/[\u200E\u200F\u00A0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectBrandFromTitle(title: string, explicitBrand?: string | null): string | null {
  if (
    explicitBrand &&
    explicitBrand.trim() &&
    explicitBrand.toLowerCase() !== "generic" &&
    explicitBrand.toLowerCase() !== "null" &&
    explicitBrand.toLowerCase() !== "undefined" &&
    !explicitBrand.includes("http") &&
    !explicitBrand.includes("[") &&
    !explicitBrand.includes("]") &&
    !explicitBrand.includes("(") &&
    !explicitBrand.includes(")") &&
    !explicitBrand.includes("<") &&
    !explicitBrand.includes(">") &&
    !explicitBrand.includes("\n") &&
    explicitBrand.trim().length <= 40
  ) {
    return explicitBrand.trim();
  }
  const clean = cleanProductTitle(title);
  for (const b of KNOWN_BRANDS) {
    const rx = new RegExp(`(?:^|\\b)${escapeRegExp(b)}(?:\\b|$)`, "i");
    if (rx.test(clean)) {
      return b;
    }
  }
  // Fallback to first word if capitalized
  const firstWord = clean.split(/\s+/)[0];
  if (firstWord && /^[A-Z][a-zA-Z0-9]+$/.test(firstWord)) {
    return firstWord;
  }
  return null;
}

export function extractModelFromTitle(title: string, brand?: string | null): string | null {
  const clean = cleanProductTitle(title);
  let text = clean;

  // If title has pipe separators e.g. "OnePlus N6 | 6GB+128GB | ...", take the first segment
  if (text.includes("|")) {
    text = text.split("|")[0].trim();
  }

  // Remove trailing variant and marketing details in parentheses
  text = text.replace(/\s*\([^)]*\)/g, "");

  let pureModel = text;
  if (brand) {
    const rx = new RegExp(`^${escapeRegExp(brand)}\\s*`, "i");
    pureModel = text.replace(rx, "").trim();
  }

  // Strip leading capacity (e.g. "9 kg with", "9Kg") and star rating (e.g. "5 Star,") from model candidate
  pureModel = pureModel
    .replace(/^\d+(?:\.\d+)?\s*kg\s*(?:with\s*)?/i, "")
    .replace(/^\d+\s*Star\s*,?\s*/i, "")
    .trim();

  // Now cut off after first comma or hyphen
  pureModel = pureModel.replace(/\s*,\s*.*$/, "").replace(/\s*-\s*.*$/, "").trim();

  // Strip generic product category descriptors from the end of pureModel
  pureModel = pureModel
    .replace(/\b(?:bluetooth|wired|wireless|optical|laser|gaming|mouse|mice|keyboard|earbuds|earphones?|headphones?|headset|on-ear|over-ear|in-ear|tws|smartphone|smartphones|mobiles?|phones?|laptop|notebook|washing\s*machine|smartwatch|television|smart\s*tv|tv)\b.*$/i, "")
    .trim();

  const words = pureModel.split(/\s+/).filter(Boolean);
  const modelCandidate = words.slice(0, 3).join(" ").trim();

  return modelCandidate || pureModel || text || null;
}
