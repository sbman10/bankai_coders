export type BarcodeProductImage = {
  gtin: string;
  title: string | null;
  imageUrl: string;
};

const UPC_ITEMDB_TRIAL_URL = "https://api.upcitemdb.com/prod/trial/lookup";
const SUPPORTED_GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export function isValidGtin(value: string): boolean {
  if (!/^\d+$/.test(value) || !SUPPORTED_GTIN_LENGTHS.has(value.length)) return false;

  const checkDigit = Number(value.at(-1));
  const body = value.slice(0, -1).split("").reverse();
  const sum = body.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function findGtinCandidates(text: string): string[] {
  const labeled: string[] = [];
  const labelPattern = /\b(?:UPC|EAN|GTIN|barcode)\s*(?:number|no\.?|#|:|-)?\s*[:#-]?\s*([\d\s-]{8,24})/gi;
  for (const match of text.matchAll(labelPattern)) {
    const candidate = match[1].replace(/[\s-]/g, "");
    if (isValidGtin(candidate) && !labeled.includes(candidate)) labeled.push(candidate);
  }

  if (labeled.length) return labeled;

  const scanned: string[] = [];
  for (const match of text.matchAll(/(?<!\d)\d{8,14}(?!\d)/g)) {
    const context = text.slice(Math.max(0, (match.index ?? 0) - 28), match.index ?? 0);
    if (/\b(?:order|invoice|serial|gstin|phone|contact|date|amount|total|transaction)\b[^\n]{0,20}$/i.test(context)) continue;
    if (isValidGtin(match[0]) && !scanned.includes(match[0])) scanned.push(match[0]);
  }
  return scanned;
}

export async function lookupBarcodeProductImage(gtin: string): Promise<BarcodeProductImage | null> {
  if (!isValidGtin(gtin)) return null;

  try {
    const url = new URL(UPC_ITEMDB_TRIAL_URL);
    url.searchParams.set("upc", gtin);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { items?: unknown }).items)) return null;
    const firstItem = (payload as { items: unknown[] }).items[0];
    if (!firstItem || typeof firstItem !== "object") return null;

    const item = firstItem as { title?: unknown; images?: unknown };
    if (!Array.isArray(item.images)) return null;
    const imageUrl = item.images.find((candidate): candidate is string => {
      if (typeof candidate !== "string" || candidate.length > 2048) return false;
      try {
        return new URL(candidate).protocol === "https:";
      } catch {
        return false;
      }
    });
    if (!imageUrl) return null;

    return {
      gtin,
      title: typeof item.title === "string" ? item.title.slice(0, 200) : null,
      imageUrl,
    };
  } catch {
    // Catalog lookup is an optional enrichment. Network, timeout, quota, and
    // response-format failures must never block invoice review or product save.
    return null;
  }
}
