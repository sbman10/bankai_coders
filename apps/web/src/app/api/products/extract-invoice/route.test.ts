import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/products/extract-invoice", () => {
  it("extracts product and purchase details from an Amazon invoice text", async () => {
    const invoiceText = `
TAX INVOICE / BILL OF SUPPLY / CASH MEMORANDUM
Sold By: Appario Retail Private Ltd
Billing Address:
Rohan Sharma
Flat 402, Green Glen Layout, Bengaluru 560103
Order Number: 402-8829102-3928192
Order Date: 12.02.2026
Invoice Number: IN-2026-88192
Payment Method: Credit Card (Visa ending in 4092)

Description: Soundcore by Anker Life Q30 Hybrid Active Noise Cancelling Headphones (Model: A3028)
Qty: 1
Gross Amount: INR 5,999.00
Total Amount: INR 5,999.00
Manufacturer Warranty: 18 months standard limited warranty
    `;

    const request = new Request("http://localhost:3000/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: invoiceText }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.invoice.productName).toContain("Soundcore");
    expect(json.invoice.brand).toBe("Soundcore");
    expect(json.invoice.seller).toContain("Appario");
    expect(json.invoice.ownerName).toBe("Rohan Sharma");
    expect(json.invoice.purchasePlatform).toBe("Amazon.in");
    expect(json.invoice.buyingMethod).toBe("Credit Card");
    expect(json.invoice.amount).toBe(5999);
    expect(json.invoice.currency).toBe("INR");
    expect(json.invoice.purchaseDate).toBe("2026-02-12");
    expect(json.invoice.invoiceNumber).toBe("IN-2026-88192");
    expect(json.invoice.suggestedWarrantyMonths).toBe(18);
  });

  it("extracts Flipkart invoice with UPI payment and seller details", async () => {
    const invoiceText = `
Tax Invoice / Bill of Supply
Flipkart Internet Private Limited
Retailer / Seller: TrueCom Retail India
Customer Name: Rohan Sharma
Order ID: OD384729182749102
Invoice No: FK-BLR-2026-901
Date of Purchase: 2026-01-15
Mode of Payment: UPI (Google Pay)

Item: Titan Neo Analog Watch with Brown Leather Strap
Price: Rs. 4,250
1 Year Manufacturer Warranty Included
    `;

    const request = new Request("http://localhost:3000/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: invoiceText }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.invoice.brand).toBe("Titan");
    expect(json.invoice.purchasePlatform).toBe("Flipkart");
    expect(json.invoice.buyingMethod).toBe("UPI");
    expect(json.invoice.amount).toBe(4250);
    expect(json.invoice.purchaseDate).toBe("2026-01-15");
    expect(json.invoice.suggestedWarrantyMonths).toBe(12);
  });

  it("extracts all fields accurately from the user's demo Amazon invoice fixture", async () => {
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

    const request = new Request("http://localhost:3000/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: demoInvoiceText }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.invoice.brand).toBe("DemoSound");
    expect(json.invoice.model).toBe("TEST-Q20");
    expect(json.invoice.productName).toContain("Demo Wireless Headphones");
    expect(json.invoice.ownerName).toBe("Kapish Gupta");
    expect(json.invoice.orderId).toBe("TEST-404-1234567-8901234");
    expect(json.invoice.invoiceNumber).toBe("TEST-INV-2026-10427");
    expect(json.invoice.purchaseDate).toBe("2026-10-24");
    expect([2499, 2948.82]).toContain(json.invoice.amount);
    expect(json.invoice.suggestedWarrantyMonths).toBe(12);
    expect(json.fieldStatus.brand).toBe("confident");
    expect(json.fieldStatus.model).toBe("confident");
    expect(json.fieldStatus.order_id).toBe("confident");
    expect(json.fieldStatus.invoice_number).toBe("confident");
    expect(json.fieldStatus.purchase_date).toBe("confident");
    expect(json.extracted.serial_number).toBe("TEST-SN-00012345");
  });

  it("handles empty or sparse text gracefully without throwing errors", async () => {
    const request = new Request("http://localhost:3000/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Receipt for general purchase" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.invoice.productName).toBeDefined();
    expect(json.invoice.currency).toBe("INR");
  });

  it("rejects invalid request body or unsupported payload", async () => {
    const request = new Request("http://localhost:3000/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("resolves link-only input when only a product URL is provided", async () => {
    const mockHtml = `
      <span id="productTitle">soundcore by Anker Q20i Hybrid Active Noise Cancelling Headphones</span>
      <a id="bylineInfo">Visit the Soundcore Store</a>
      <img id="landingImage" src="https://m.media-amazon.com/images/I/soundcore.jpg" />
      <span class="a-price-whole">4,499</span>
      <table id="productDetails_techSpec_section_1">
        <tr><th>Brand Name</th><td>Soundcore</td></tr>
        <tr><th>Model Number</th><td>Q20i</td></tr>
      </table>
    `;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: RequestInfo | URL) => {
      if (String(url).includes("amazon")) {
        return new Response(mockHtml, { status: 200 });
      }
      return originalFetch(url);
    };

    try {
      const request = new Request("http://localhost:3000/api/products/extract-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl: "https://www.amazon.in/soundcore-Anker-Bluetooth-Headphones-Cancellation/dp/B0CKW4D336",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.ocrEngine).toBe("link-resolver");
      expect(json.asin).toBe("B0CKW4D336");
      expect(json.extracted.brand).toBe("Soundcore");
      expect(json.extracted.model).toBe("Q20i");
      expect(json.invoice.productName).toContain("soundcore by Anker Q20i");

      // Verify ZERO hallucinated purchase info
      expect(json.extracted.purchase_date).toBeNull();
      expect(json.extracted.order_id).toBeNull();
      expect(json.extracted.invoice_number).toBeNull();
      expect(json.extracted.serial_number).toBeNull();
      expect(json.fieldStatus.purchase_date).toBe("not_found");
      expect(json.fieldStatus.order_id).toBe("not_found");
      expect(json.fieldStatus.invoice_number).toBe("not_found");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fuses invoice text and product link in hybrid mode", async () => {
    const mockHtml = `
      <span id="productTitle">soundcore by Anker Q20i Hybrid Active Noise Cancelling Headphones</span>
      <a id="bylineInfo">Visit the Soundcore Store</a>
      <img id="landingImage" src="https://m.media-amazon.com/images/I/soundcore.jpg" />
      <table id="productDetails_techSpec_section_1">
        <tr><th>Brand Name</th><td>Soundcore</td></tr>
      </table>
    `;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: RequestInfo | URL) => {
      if (String(url).includes("amazon")) {
        return new Response(mockHtml, { status: 200 });
      }
      return originalFetch(url);
    };

    try {
      const request = new Request("http://localhost:3000/api/products/extract-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `
TAX INVOICE
Invoice Number: DEL5-12345
Order ID: 404-9876543-1234567
Order Date: 2026-05-19
Customer: Ayushi Gupta
Payment: UPI
Amount: 4499.00
Seller: Valuecart India Private Ltd
          `.trim(),
          productUrl: "https://www.amazon.in/soundcore-Anker-Bluetooth-Headphones-Cancellation/dp/B0CKW4D336",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.ocrEngine).toBe("hybrid-invoice-link");
      expect(json.asin).toBe("B0CKW4D336");
      // Verified invoice facts take priority
      expect(json.extracted.invoice_number).toBe("DEL5-12345");
      expect(json.extracted.order_id).toBe("404-9876543-1234567");
      expect(json.extracted.owner_name).toBe("Ayushi Gupta");
      expect(json.extracted.price).toBe(4499);
      // Link enriched details
      expect(json.extracted.brand).toBe("Soundcore");
      expect(json.imageUrl).toBe("https://m.media-amazon.com/images/I/soundcore.jpg");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 400 for unsupported or invalid marketplace URL", async () => {
    const request = new Request("http://localhost:3000/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productUrl: "https://unsupported-store.com/item/12345",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Please enter a valid Amazon, Flipkart or Meesho product URL.");
  });

  it("returns 422 when marketplace page cannot be accessed", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("Not Found", { status: 404 });

    try {
      const request = new Request("http://localhost:3000/api/products/extract-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl: "https://www.amazon.in/dp/B0NONEXIST99",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(422);
      const json = await response.json();
      expect(json.error).toBe("We couldn't retrieve this product page. Please check the URL or enter the product details manually.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

