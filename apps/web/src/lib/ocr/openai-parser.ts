import OpenAI from "openai";
import type { ExtractedProductFields } from "./types";
import { parseDateToIso } from "./validator";

const SYSTEM_PROMPT = `
You are ClaimForge's strict document data extraction specialist.
Extract product ownership and invoice fields from the provided document text into JSON.

CRITICAL ANTI-HALLUCINATION RULES:
1. Extract ONLY facts explicitly supported by the text.
2. NEVER guess, assume, fabricate, or infer missing information.
3. If warranty is NOT explicitly written in the document, you MUST set "warranty_duration" to null. Never assume standard 1-year or brand warranty.
4. If purchase date is not explicitly present, set "purchase_date" to null. Format dates as ISO YYYY-MM-DD.
5. If serial number is not in the text, set "serial_number" to null.
6. If model number is not explicitly in the text or product title, set "model" to null. If the product title contains a model designation or model code (such as "Q20i" in "Soundcore by Anker Q20i" or "WH-1000XM4" in "Sony WH-1000XM4"), extract that model designation into "model".
7. If brand is not in the text, set "brand" to null.
8. For "seller", extract the merchant/company selling the item (e.g. "Appario Retail Private Ltd"). Do NOT confuse with the customer/buyer ("owner_name").
9. For "invoice_number", extract the explicit invoice number/tax invoice ID (e.g. "IN-881920"), NOT the order ID.
10. For "price", extract the total purchase price paid by the customer (Grand Total / Total Amount / Net Payable). NEVER extract the tax amount (GST, CGST, SGST, IGST), discount, or shipping charges as the price. Extract the numeric value only without currency symbols.
11. If the document has a "Product details for testing" or similar table, extract those exact values.

JSON Schema to return:
{
  "brand": string | null,
  "product_name": string | null,
  "model": string | null,
  "category": string | null,
  "serial_number": string | null,
  "invoice_number": string | null,
  "order_id": string | null,
  "purchase_date": string | null,
  "seller": string | null,
  "price": number | null,
  "currency": string | null,
  "warranty_duration": string | null,
  "warranty_start_date": string | null,
  "warranty_end_date": string | null,
  "quantity": number | null,
  "source_marketplace": string | null,
  "owner_name": string | null,
  "buying_method": string | null
}
`.trim();

function getAiClient(): { client: OpenAI; model: string } | null {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() }),
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  if (process.env.GROQ_API_KEY?.trim()) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY.trim(),
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
    };
  }

  return null;
}

const EXCLUDED_SPEC_TOKENS = new Set([
  "ANC", "ENC", "TWS", "USB", "HD", "RGB", "LED", "OLED", "AMOLED", "LCD",
  "RAM", "SSD", "HDD", "GB", "TB", "MB", "W", "V", "HZ", "FPS",
  "4K", "8K", "2K", "5G", "4G", "3G", "LTE", "BT", "WIFI",
  "IP67", "IP68", "IPX4", "IPX5", "IPX7", "IPX8", "IP55", "IP54",
  "40H", "50H", "60H", "30H", "20H", "10H", "60HZ", "90HZ", "120HZ", "144HZ", "240HZ",
  "GEN", "GEN1", "GEN2", "GEN3", "GEN4", "GEN5",
  "PRO", "PLUS", "MAX", "MINI", "ULTRA", "LITE", "SLIM", "SE",
  "WIRELESS", "BLUETOOTH", "HEADPHONES", "EARPHONES", "EARBUDS", "SPEAKER", "SPEAKERS",
  "OVER-EAR", "ON-EAR", "IN-EAR", "TRUE", "SMART", "ACTIVE", "NOISE", "CANCELLING"
]);

function cleanCapture(val: string | undefined | null): string | null {
  if (!val) return null;
  const cleaned = val.replace(/^[:\-#.\s]+|[:\-#.\s]+$/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function parseOcrHeuristically(text: string): ExtractedProductFields {
  const result: ExtractedProductFields = {
    brand: null,
    product_name: null,
    model: null,
    category: null,
    serial_number: null,
    invoice_number: null,
    order_id: null,
    purchase_date: null,
    seller: null,
    price: null,
    currency: "INR",
    warranty_duration: null,
    warranty_start_date: null,
    warranty_end_date: null,
    quantity: 1,
    source_marketplace: null,
    owner_name: null,
    buying_method: null,
  };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let invoiceDateFallback: string | null = null;

  // 1. Check for dedicated testing or key-value summary table
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Brand
    const brandMatch = line.match(/^Brand\s*[:\-]\s*(.+)$/i) || line.match(/^Brand\s+([A-Za-z0-9\-_]+)$/i);
    if (brandMatch && !result.brand) {
      result.brand = cleanCapture(brandMatch[1]);
    }

    // Model
    const modelMatch = line.match(/^Model\s*(?:#|Number|No\.?|Code)?\s*[:\-]\s*(.+)$/i) || line.match(/^Model\s+([A-Za-z0-9\-_]+)$/i);
    if (modelMatch && !result.model) {
      result.model = cleanCapture(modelMatch[1]);
    }

    // Serial Number
    const snMatch = line.match(/^Serial\s*(?:Number|No\.?|SN)?\s*[:\-]\s*(.+)$/i) || line.match(/^Serial\s*Number\s+([A-Za-z0-9\-_]+)$/i);
    if (snMatch && !result.serial_number) {
      result.serial_number = cleanCapture(snMatch[1]);
    }

    // Warranty
    const warMatch = line.match(/^Warranty\s*(?:Period)?\s*[:\-]\s*(.+)$/i) || line.match(/^Warranty\s+([0-9]+\s*(?:month|year)s?[^\n\r]*)/i);
    if (warMatch && !result.warranty_duration) {
      result.warranty_duration = cleanCapture(warMatch[1]);
    }

    // Marketplace
    const mpMatch = line.match(/^Marketplace\s*[:\-]\s*(.+)$/i) || line.match(/^Marketplace\s+([A-Za-z0-9\-_() ]+)$/i);
    if (mpMatch && !result.source_marketplace) {
      result.source_marketplace = cleanCapture(mpMatch[1]);
    }

    // Purchase Date / Order Date
    const pdMatch = line.match(/^(?:Purchase\s*Date|Date\s*of\s*Purchase|Order\s*Date)\s*[:\-]?\s*(.+)$/i);
    if (pdMatch && !result.purchase_date) {
      const parsed = parseDateToIso(cleanCapture(pdMatch[1]) || "");
      if (parsed) result.purchase_date = parsed;
    }

    // Invoice Date (fallback if purchase date not found)
    const invDateMatch = line.match(/^(?:Tax\s*Invoice\s*Date|Invoice\s*Date)\s*[:\-]?\s*(.+)$/i);
    if (invDateMatch && !invoiceDateFallback) {
      const parsed = parseDateToIso(cleanCapture(invDateMatch[1]) || "");
      if (parsed) invoiceDateFallback = parsed;
    }

    // Order ID
    const ordMatch = line.match(/^(?:Order\s*(?:ID|Number|No\.?|#))\s*[:\-]?\s*([A-Za-z0-9\-_/]+)/i);
    if (ordMatch && !result.order_id) {
      result.order_id = cleanCapture(ordMatch[1]);
    }

    // Invoice #
    const invMatch = line.match(/(?:Tax\s*Invoice|Invoice|Bill|Receipt)\s*(?:Number|No\.?|#|Details|ID)?\s*[:\-]\s*([A-Za-z0-9\-_/]+)/i);
    if (invMatch && !result.invoice_number) {
      result.invoice_number = cleanCapture(invMatch[1]);
    }

    // Sold By (single-line)
    const soldMatch = line.match(/^(?:Sold\s*By|Seller|Retailer|Merchant)\s*[:\-]?\s*(.+)$/i);
    if (soldMatch && !result.seller) {
      const val = cleanCapture(soldMatch[1]);
      if (val && !/^(?:gstin|pan|cin)\b/i.test(val)) {
        result.seller = val;
      }
    }

    // Bill To
    const billMatch = line.match(/^(?:Bill\s*To|Buyer|Customer(?:\s*Name)?)\s*[:\-]?\s*(.+)$/i);
    if (billMatch && !result.owner_name) {
      result.owner_name = cleanCapture(billMatch[1]);
    }
  }

  // 2. Look for two-line key/value pairs (e.g. "Sold By :" on line i and "Appario Retail..." on line i+1)
  for (let i = 0; i < lines.length - 1; i++) {
    const cleanLabel = lines[i].replace(/[:\-#.\s]+$/, "").trim().toLowerCase();
    const nextVal = cleanCapture(lines[i + 1]);
    if (!nextVal) continue;

    if (
      (cleanLabel === "order id" || cleanLabel === "order #" || cleanLabel === "order no" || cleanLabel === "order number") &&
      !result.order_id
    ) {
      result.order_id = nextVal;
    }

    if (
      (cleanLabel === "invoice #" ||
        cleanLabel === "invoice" ||
        cleanLabel === "invoice number" ||
        cleanLabel === "tax invoice number" ||
        cleanLabel === "tax invoice no" ||
        cleanLabel === "invoice no" ||
        cleanLabel === "invoice details") &&
      !result.invoice_number
    ) {
      result.invoice_number = nextVal;
    }

    if ((cleanLabel === "order date" || cleanLabel === "purchase date" || cleanLabel === "date of purchase") && !result.purchase_date) {
      const p = parseDateToIso(nextVal);
      if (p) result.purchase_date = p;
    }

    if (cleanLabel === "invoice date" && !invoiceDateFallback) {
      const p = parseDateToIso(nextVal);
      if (p) invoiceDateFallback = p;
    }

    if ((cleanLabel === "sold by" || cleanLabel === "seller" || cleanLabel === "retailer" || cleanLabel === "merchant") && !result.seller) {
      if (!/^(?:gstin|pan|cin)\b/i.test(nextVal)) {
        result.seller = nextVal;
      }
    }

    if (
      (cleanLabel === "bill to" || cleanLabel === "buyer" || cleanLabel === "customer name" || cleanLabel === "customer" || cleanLabel.startsWith("billing address")) &&
      !result.owner_name
    ) {
      result.owner_name = nextVal;
    }
  }

  if (!result.purchase_date && invoiceDateFallback) {
    result.purchase_date = invoiceDateFallback;
  }

  // Fallback for invoice number from text block
  if (!result.invoice_number) {
    const invBlock = text.match(/(?:Tax\s*Invoice|Invoice)\s*(?:Number|No\.?|#|Details|ID)?\s*[:\-]?\s*([A-Za-z0-9]{1,10}[-_/][A-Za-z0-9\-_/]+)/i);
    if (invBlock) {
      result.invoice_number = cleanCapture(invBlock[1]);
    }
  }

  // 3. Price extraction with strict tax exclusion and hierarchy
  // Rule: Invoice Value > Grand Total (last/max amount on Total line) > Subtotal > Unit Price / Amount
  // NEVER extract Tax Amount (GST, CGST, SGST, IGST) or Shipping as product price!
  let invoiceValuePrice: number | null = null;
  let grandTotalPrice: number | null = null;
  let subtotalPrice: number | null = null;
  let unitOrAmountPrice: number | null = null;

  // A. Check for explicit "Invoice Value"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const clean = line.replace(/[:\-#.\s]+$/, "").trim().toLowerCase();
    if (clean === "invoice value" || clean === "invoice total" || clean === "total invoice value") {
      const sameLineMatch = line.match(/(?:invoice\s*value|invoice\s*total)\s*[:\-]?\s*(?:inr|rs\.?|₹|\s)*([0-9,]+(?:\.[0-9]{1,2})?)/i);
      if (sameLineMatch) {
        const v = parseFloat(sameLineMatch[1].replace(/,/g, ""));
        if (!Number.isNaN(v) && v > 0) invoiceValuePrice = v;
      } else if (i < lines.length - 1) {
        const nextMatch = lines[i + 1].match(/^(?:inr|rs\.?|₹|\s)*([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (nextMatch) {
          const v = parseFloat(nextMatch[1].replace(/,/g, ""));
          if (!Number.isNaN(v) && v > 0) invoiceValuePrice = v;
        }
      }
    }
  }

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Skip lines containing tax, GST, cess, discount, shipping, round off
    if (
      lower.includes("tax") ||
      lower.includes("gst") ||
      lower.includes("cgst") ||
      lower.includes("sgst") ||
      lower.includes("igst") ||
      lower.includes("vat") ||
      lower.includes("cess") ||
      lower.includes("discount") ||
      lower.includes("shipping") ||
      lower.includes("round off") ||
      lower.includes("tcs")
    ) {
      continue;
    }

    // B. Check for Grand Total / Total line
    const isTotalLine = /(?:grand\s*total|invoice\s*total|total\s*(?:amount\s*paid|payable|amount)|net\s*payable|amount\s*payable|total\s*value|^\s*total)\b/i.test(line);
    if (isTotalLine && !grandTotalPrice) {
      // Find all currency/number amounts on this line
      const numbersOnLine = [...line.matchAll(/(?:inr|rs\.?|₹|[n■\s])*\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi)]
        .map((m) => parseFloat(m[1].replace(/,/g, "")))
        .filter((n) => !Number.isNaN(n) && n > 0);

      if (numbersOnLine.length > 0) {
        // In tables like "TOTAL: ₹686.29 ₹4,499.00", the total purchase amount is the LAST number on the line
        grandTotalPrice = numbersOnLine[numbersOnLine.length - 1];
      }
    }

    // C. Check for Subtotal / Net Amount
    const subMatch = line.match(/(?:item\s*subtotal|subtotal|sub\s*total|net\s*amount)\s*[:\-]?\s*(?:inr|rs\.?|₹|[n■\s])*\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
    if (subMatch && !subtotalPrice) {
      const val = parseFloat(subMatch[1].replace(/,/g, ""));
      if (!Number.isNaN(val) && val > 0) {
        subtotalPrice = val;
      }
    }

    // D. Check for Unit Price / Price / Gross Amount / Amount
    const unitMatch = line.match(/(?:unit\s*price|gross\s*amount|price|^\s*amount)\s*[:\-]?\s*(?:inr|rs\.?|₹|[n■\s])*\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
    if (unitMatch && !unitOrAmountPrice) {
      const val = parseFloat(unitMatch[1].replace(/,/g, ""));
      if (!Number.isNaN(val) && val > 0) {
        unitOrAmountPrice = val;
      }
    }
  }

  // Precedence: Invoice Value > Grand Total > Subtotal > Unit Price / Amount
  result.price = invoiceValuePrice ?? grandTotalPrice ?? subtotalPrice ?? unitOrAmountPrice ?? null;

  // 4. Product description / item line
  if (!result.product_name) {
    // A. Multi-line table item starting with row number e.g. "1" on its own line followed by item description
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      if (/^(?:1|01)$/.test(line)) {
        const nextLine = lines[i + 1];
        const lowerNext = nextLine.toLowerCase();
        if (
          /[a-zA-Z]{3,}/.test(nextLine) &&
          !lowerNext.includes("description") &&
          !lowerNext.includes("unit price") &&
          !lowerNext.includes("tax invoice") &&
          !lowerNext.includes("authorized") &&
          !lowerNext.includes("order number")
        ) {
          const descLines: string[] = [];
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const curLine = lines[j];
            if (
              /^hsn\b/i.test(curLine) ||
              curLine.includes("₹") ||
              /^(?:inr|rs\.?)\b/i.test(curLine) ||
              /^[0-9,.]+\s+[0-9,.]+/.test(curLine) ||
              /^shipping\b/i.test(curLine) ||
              /^total\b/i.test(curLine)
            ) {
              break;
            }
            descLines.push(curLine);
          }

          if (descLines.length > 0) {
            const fullDesc = descLines.join(" ").replace(/\s+/g, " ").trim();
            const cleanDesc = fullDesc.replace(/\|\s*[A-Z0-9]{10}\b.*$/i, "").trim();
            result.product_name = cleanDesc || fullDesc;
            break;
          }
        }
      }
    }
  }

  if (!result.product_name) {
    // B. Standalone line with row number: e.g. "1 soundcore by Anker Q20i..."
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const itemMatch = line.match(/^\s*(?:1|01)\s+([a-zA-Z][^\n\r]+)/);
      if (itemMatch) {
        const candidate = itemMatch[1].trim();
        const lower = candidate.toLowerCase();
        if (!lower.includes("description") && !lower.includes("unit price") && candidate.length >= 5) {
          result.product_name = candidate.replace(/\|\s*[A-Z0-9]{10}\b.*$/i, "").trim();
          break;
        }
      }
    }
  }

  if (!result.product_name) {
    for (const line of lines) {
      // C. Pipe-delimited row: e.g. "1 | Soundcore by Anker Q20i ... | 1 | 4,236.44 | 686.29 | 4,999.00"
      const pipeMatch = line.match(/^\s*(?:\|\s*)?\d+\s*\|\s*([^|]+?)\s*\|/);
      if (pipeMatch) {
        const candidate = pipeMatch[1].trim();
        const lower = candidate.toLowerCase();
        // Ensure it's not a table header like "Description | Qty | Price"
        if (
          !lower.includes("description") &&
          !lower.includes("item name") &&
          !lower.includes("particulars") &&
          !lower.includes("product name") &&
          candidate.length >= 3
        ) {
          result.product_name = candidate;
          break;
        }
      }
    }
  }

  if (!result.product_name) {
    // D. Space-delimited item row: e.g. "1 Demo Wireless Headphones — Model TEST-Q20 1 ■2,499.00"
    const itemRowMatch = text.match(/^\s*\d+\s+([A-Za-z0-9\s—\-_/()&+,.]+?)(?:\s*—\s*Model\s*([A-Za-z0-9\-_]+))?\s+\d+\s+(?:INR|Rs\.?|₹|[n■\s])*[0-9,.]+/im);
    if (itemRowMatch) {
      const candidate = itemRowMatch[1].trim();
      if (!candidate.toLowerCase().includes("item description")) {
        result.product_name = candidate;
        if (itemRowMatch[2] && !result.model) {
          result.model = itemRowMatch[2].trim();
        }
      }
    }
  }

  if (!result.product_name) {
    // E. Labeled line: "Description:", "Item Description:", "Product:", "Product Name:"
    const descMatch = text.match(/(?:Item\s*Description|Product\s*Name|Description|Product|Item)\s*[:\-]\s*([^\n\r]+)/i);
    if (descMatch) {
      const candidate = descMatch[1].trim();
      const lower = candidate.toLowerCase();
      if (!lower.includes("unit price") && !lower.includes("tax total") && !lower.includes("qty") && candidate.length >= 3) {
        result.product_name = candidate;
      }
    }
  }

  // 5. Brand detection
  const KNOWN_BRANDS = [
    "Soundcore", "Anker", "Sony", "Apple", "Samsung", "LG", "Titan", "Boat",
    "Noise", "Minimalist", "Nike", "Adidas", "OnePlus", "Xiaomi", "Dell",
    "HP", "Lenovo", "Asus", "Acer", "Bose", "Sennheiser", "JBL", "Puma",
    "Philips", "Panasonic", "Whirlpool", "Bosch", "Godrej", "Realme", "DemoSound",
  ];
  if (!result.brand) {
    for (const b of KNOWN_BRANDS) {
      if (result.product_name?.toLowerCase().includes(b.toLowerCase()) || text.toLowerCase().includes(b.toLowerCase())) {
        result.brand = b;
        break;
      }
    }
  }

  // 6. Model Extraction
  if (!result.model) {
    // A. Explicit Model label in text
    const explicitModel = text.match(/(?:Model\s*(?:Number|No\.?|#|Code)?|Model)\s*[:\-]\s*([A-Za-z0-9\-_/]+)/i);
    if (explicitModel) {
      const val = cleanCapture(explicitModel[1]);
      if (val && val.length >= 2) {
        result.model = val;
      }
    }
  }

  if (!result.model && result.product_name) {
    // B. Check pattern "[Brand] by [ParentBrand] [Model]" e.g. "soundcore by Anker Q20i" -> "Anker Q20i"
    const byBrandModelMatch = result.product_name.match(/(?:by\s+([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?))/i);
    if (byBrandModelMatch) {
      const candidate = byBrandModelMatch[1].trim();
      if (!EXCLUDED_SPEC_TOKENS.has(candidate.toUpperCase()) && candidate.length >= 2) {
        result.model = candidate;
      }
    }
  }

  if (!result.model && result.product_name && result.brand) {
    // C. Check pattern "[Brand] [Model]" e.g. "Sony WH-1000XM4" or "Soundcore Q20i"
    const brandModelMatch = result.product_name.match(
      new RegExp(`(?:^|\\s)${result.brand}\\s+(?:by\\s+[A-Za-z0-9]+\\s+)?([A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)?)`, "i")
    );
    if (brandModelMatch) {
      const candidate = brandModelMatch[1].trim();
      if (!EXCLUDED_SPEC_TOKENS.has(candidate.toUpperCase()) && candidate.length >= 2) {
        result.model = candidate;
      }
    }
  }

  if (!result.model && result.product_name) {
    // D. Scan alphanumeric model codes in product name (e.g. Q20i, WH-1000XM4, TEST-Q20)
    const tokens = result.product_name.split(/[\s,()|/]+/).filter(Boolean);
    for (const token of tokens) {
      const upper = token.toUpperCase();
      if (EXCLUDED_SPEC_TOKENS.has(upper)) continue;
      if (result.brand && upper === result.brand.toUpperCase()) continue;

      // Model code with letters and numbers (e.g. Q20i, A3004, M2)
      const hasLetterAndDigit = /^[A-Za-z]{1,4}[0-9]{1,4}[A-Za-z0-9\-_]*$/.test(token) && /[0-9]/.test(token) && /[A-Za-z]/.test(token);
      // Hyphenated model (e.g. WH-1000XM4, TEST-Q20)
      const isHyphenatedModel = /^[A-Za-z0-9]{2,6}[-_][A-Za-z0-9]{2,8}$/.test(token);

      if (hasLetterAndDigit || isHyphenatedModel) {
        result.model = token;
        break;
      }
    }
  }

  // 7. Buying / Payment Method
  if (!result.buying_method) {
    const lower = text.toLowerCase();
    if (lower.includes("credit card")) result.buying_method = "Credit Card";
    else if (lower.includes("debit card")) result.buying_method = "Debit Card";
    else if (lower.includes("upi") || lower.includes("google pay") || lower.includes("phonepe") || lower.includes("paytm")) result.buying_method = "UPI";
    else if (lower.includes("net banking")) result.buying_method = "Net Banking";
    else if (lower.includes("cash on delivery") || lower.includes("cod")) result.buying_method = "Cash on Delivery";
    else if (lower.includes("emi")) result.buying_method = "EMI";
  }

  // 8. Explicit Warranty Detection
  if (!result.warranty_duration) {
    const warMatch = text.match(/(?:Manufacturer\s*Warranty|Standard\s*Warranty|Warranty(?:\s*Period)?)\s*[:\-]?\s*([0-9]+\s*(?:month|year)s?[^\n\r]*)/i)
      || text.match(/([0-9]+\s*(?:month|year)s?\s*(?:standard|limited|brand|manufacturer|\s)*warranty[^\n\r]*)/i);
    if (warMatch) {
      result.warranty_duration = warMatch[1].trim();
    }
  }

  // 9. Detect marketplace from text if not explicitly in table
  if (!result.source_marketplace) {
    const lower = text.toLowerCase();
    if (lower.includes("amazon") || lower.includes("amzn") || lower.includes("appario")) result.source_marketplace = "Amazon.in";
    else if (lower.includes("flipkart") || lower.includes("truecom")) result.source_marketplace = "Flipkart";
    else if (lower.includes("meesho")) result.source_marketplace = "Meesho";
  }

  // 10. Category
  const combined = `${result.product_name || ""} ${result.brand || ""} ${text}`.toLowerCase();
  if (combined.includes("headphone") || combined.includes("audio") || combined.includes("earbud") || combined.includes("speaker") || combined.includes("laptop") || combined.includes("phone")) {
    result.category = "Electronics";
  } else if (combined.includes("fridge") || combined.includes("refrigerator") || combined.includes("washing machine") || combined.includes("microwave")) {
    result.category = "Appliances";
  } else if (combined.includes("watch") || combined.includes("timepiece") || combined.includes("strap")) {
    result.category = "Accessories";
  } else if (combined.includes("shoe") || combined.includes("shirt") || combined.includes("sneaker")) {
    result.category = "Fashion";
  } else {
    result.category = "Other";
  }

  return result;
}

export async function parseOcrWithOpenAi(text: string): Promise<ExtractedProductFields> {
  const ai = getAiClient();
  if (!ai) {
    // No OpenAI/Groq API key configured: use deterministic heuristic parser
    return parseOcrHeuristically(text);
  }

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.model,
      temperature: 0.0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Here is the OCR extracted document text:\n\n${text.slice(0, 15000)}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return parseOcrHeuristically(text);
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;

    return {
      brand: typeof parsed.brand === "string" ? parsed.brand.trim() : null,
      product_name: typeof parsed.product_name === "string" ? parsed.product_name.trim() : null,
      model: typeof parsed.model === "string" ? parsed.model.trim() : null,
      category: typeof parsed.category === "string" ? parsed.category.trim() : null,
      serial_number: typeof parsed.serial_number === "string" ? parsed.serial_number.trim() : null,
      invoice_number: typeof parsed.invoice_number === "string" ? parsed.invoice_number.trim() : null,
      order_id: typeof parsed.order_id === "string" ? parsed.order_id.trim() : null,
      purchase_date: typeof parsed.purchase_date === "string" ? parsed.purchase_date.trim() : null,
      seller: typeof parsed.seller === "string" ? parsed.seller.trim() : null,
      price: typeof parsed.price === "number" ? parsed.price : (typeof parsed.price === "string" ? parseFloat(parsed.price) || null : null),
      currency: typeof parsed.currency === "string" ? parsed.currency.trim() : "INR",
      warranty_duration: typeof parsed.warranty_duration === "string" ? parsed.warranty_duration.trim() : null,
      warranty_start_date: typeof parsed.warranty_start_date === "string" ? parsed.warranty_start_date.trim() : null,
      warranty_end_date: typeof parsed.warranty_end_date === "string" ? parsed.warranty_end_date.trim() : null,
      quantity: typeof parsed.quantity === "number" ? parsed.quantity : 1,
      source_marketplace: typeof parsed.source_marketplace === "string" ? parsed.source_marketplace.trim() : null,
      owner_name: typeof parsed.owner_name === "string" ? parsed.owner_name.trim() : null,
      buying_method: typeof parsed.buying_method === "string" ? parsed.buying_method.trim() : null,
    };
  } catch (err) {
    console.warn("OpenAI extraction failed, falling back to heuristic parser:", err);
    return parseOcrHeuristically(text);
  }
}

export async function extractFieldsFromText(text: string): Promise<ExtractedProductFields> {
  if (!text || text.trim().length === 0) {
    return {
      brand: null,
      product_name: null,
      model: null,
      category: null,
      serial_number: null,
      invoice_number: null,
      order_id: null,
      purchase_date: null,
      seller: null,
      price: null,
      currency: "INR",
      warranty_duration: null,
      warranty_start_date: null,
      warranty_end_date: null,
      quantity: null,
      source_marketplace: null,
      owner_name: null,
      buying_method: null,
    };
  }

  return parseOcrWithOpenAi(text);
}
