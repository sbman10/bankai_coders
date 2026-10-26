import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractFieldsFromText } from "./openai-parser";

describe("extractFieldsFromText", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("extracts all fields accurately from the demo Amazon invoice text using deterministic fallback when no OpenAI key is set", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;

    const demoInvoiceText = `
AMAZON — DEMO / TEST COPY
NOT A REAL AMAZON INVOICE • FOR SOFTWARE TESTING ONLY
Invoice #
TEST-INV-2026-10427
Invoice Date
26 October 2026
Order ID
TEST-404-1234567-8901234
Order Date
24 October 2026
Sold By
Demo Electronics Seller Pvt. Ltd.
123 Test Market, New Delhi, Delhi 110001
GSTIN: 07AAAAA0000A1Z5
Bill To
Kapish Gupta
42 Demo Street
New Delhi, Delhi 1100XX
India
# Item Description Qty Unit Price Tax Total
1 Demo Wireless Headphones — Model TEST-Q20 1 ■2,499.00 ■449.82 ■2,948.82
Item subtotal ■2,499.00
GST (18%) ■449.82
Shipping ■0.00
Grand Total ■2,948.82
Product details for ClaimForge testing
Brand DemoSound
Model TEST-Q20
Purchase Date 24 October 2026
Warranty 12 months (demo data)
Serial Number TEST-SN-00012345
Marketplace Amazon (demo source)
    `.trim();

    const result = await extractFieldsFromText(demoInvoiceText);
    expect(result.brand).toBe("DemoSound");
    expect(result.product_name).toContain("Demo Wireless Headphones");
    expect(result.model).toBe("TEST-Q20");
    expect(result.serial_number).toBe("TEST-SN-00012345");
    expect(result.order_id).toBe("TEST-404-1234567-8901234");
    expect(result.invoice_number).toBe("TEST-INV-2026-10427");
    expect(result.purchase_date).toBe("2026-10-24");
    expect(result.seller).toContain("Demo Electronics Seller");
    expect(result.owner_name).toBe("Kapish Gupta");
    expect([2499, 2948.82]).toContain(result.price);
    expect(result.warranty_duration).toContain("12 months");
    expect(result.source_marketplace).toContain("Amazon");
  });

  it("strictly leaves missing fields as null without guessing (anti-hallucination)", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;

    const sparseInvoiceText = `
Retail Invoice
Order ID: ORD-998811
Date: 15/08/2026
Product: USB-C Cable
Amount: 499
    `.trim();

    const result = await extractFieldsFromText(sparseInvoiceText);
    expect(result.order_id).toBe("ORD-998811");
    expect(result.price).toBe(499);
    // Anti-hallucination: these must remain null!
    expect(result.warranty_duration).toBeNull();
    expect(result.serial_number).toBeNull();
    expect(result.brand).toBeNull();
  });

  it("extracts Soundcore Q20i invoice with model Q20i, seller, invoice number, and avoids taking tax amount as price", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;

    const soundcoreInvoiceText = `
Tax Invoice / Bill of Supply
Sold By :
Appario Retail Private Ltd
Ground Floor, Building 1, Logistics Park, Haryana 122001
GSTIN: 06AAAAA0000A1Z2

Billing Address :
Kapish Gupta
Flat 101, Green Heights
New Delhi, Delhi 1100XX

Order Number: 404-9876543-1234567
Order Date: 12.03.2026
Invoice Number : IN-881920
Invoice Date : 12.03.2026

# | Description | Qty | Unit Price | Tax Amount | Total
1 | Soundcore by Anker Q20i Wireless Over-Ear Bluetooth Headphones with Hybrid ANC | 1 | 4,236.44 | 686.29 | 4,999.00

Item Subtotal: ₹4,236.44
IGST (18%): ₹686.29
Tax Amount: ₹686.29
Grand Total: ₹4,999.00
    `.trim();

    const result = await extractFieldsFromText(soundcoreInvoiceText);
    console.log("ACTUAL EXTRACTED RESULT:", {
      brand: result.brand,
      model: result.model,
      product: result.product_name,
      seller: result.seller,
      invoice_number: result.invoice_number,
      order_id: result.order_id,
      price: result.price,
    });
    expect(result.brand).toBe("Soundcore");
    expect(result.model).toContain("Q20i");
    expect(result.product_name).toContain("Soundcore by Anker Q20i");
    expect(result.seller).toContain("Appario Retail");
    expect(result.invoice_number).toBe("IN-881920");
    expect(result.order_id).toBe("404-9876543-1234567");
    expect(result.price).toBe(4999);
    expect(result.price).not.toBe(686.29);
  });

  it("extracts exact Valuecart invoice with Anker Q20i model, full product name, customer Ayushi Gupta, and price 4499", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;

    const invoiceText = `
Tax Invoice/Bill of Supply/Cash Memo
(Original for Recipient)
For VALUECART PRIVATE LIMITED:
Authorized Signatory
Order Number: 404-9226303-3588325 Invoice Number : DEL5-38993
Order Date: 19.05.2025 Invoice Details : HR-DEL5-574574913-2526
Invoice Date : 19.05.2025
Sl.
No Description Unit
Price Discount Qty Net
Amount
Tax
Rate
Tax
Type
Tax
Amount
Total
Amount
1
soundcore by Anker Q20i Wireless Bluetooth Over-Ear
Headphones with Hybrid Active Noise Cancelling, 40h
Playtime in ANC Mode, Hi-Res Audio, Deep Bass,
Personalization via App (Black) | B0C3HCD34R (
A3004H11,B0C3HCD34R ) 
HSN:85183011
₹3,812.71 ₹0.00 1 ₹3,812.71 18% IGST ₹686.29 ₹4,499.00
Shipping Charges ₹66.95 -₹66.95 ₹0.00 18% IGST ₹0.00 ₹0.00
TOTAL: ₹686.29 ₹4,499.00
Amount in Words:
Four Thousand Four Hundred Ninety-nine only
Whether tax is payable under reverse charge - No
Payment Transaction ID: 
BlslzYjeF4cDjShwjAXmsm0mos0BGWnPCuQ
Date & Time: 19/05/2025, 14:08:14
hrs
Invoice Value: 
4,499.00
Mode of Payment: 
UPI
Sold By :
VALUECART PRIVATE LIMITED 
*
 Rect/Killa Nos. 38//8/2 min, 192//22/1,196//2/1/1,
Gurgaon, Haryana, 122413
PAN No: AAFCV5265N
GST Registration No: 06AAFCV5265N1ZS
Billing Address :
Ayushi Gupta
E-1/3, Radio Colony, Kingsway Camp
NEW DELHI, DELHI, 110009
    `.trim();

    const result = await extractFieldsFromText(invoiceText);
    expect(result.brand).toBe("Soundcore");
    expect(result.product_name).toContain("soundcore by Anker Q20i");
    expect(result.model).toBe("Anker Q20i");
    expect(result.price).toBe(4499);
    expect(result.seller).toBe("VALUECART PRIVATE LIMITED");
    expect(result.invoice_number).toBe("DEL5-38993");
    expect(result.order_id).toBe("404-9226303-3588325");
    expect(result.purchase_date).toBe("2025-05-19");
    expect(result.owner_name).toBe("Ayushi Gupta");
    expect(result.buying_method).toBe("UPI");
  });
});
