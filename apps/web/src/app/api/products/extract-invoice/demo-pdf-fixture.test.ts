import { describe, expect, it } from "vitest";
import * as fs from "fs";
import { File as NodeFile } from "node:buffer";
import { POST } from "./route";

function createTestPdf(textLines: string[]): Buffer {
  const textStream = textLines
    .map((line, idx) => `1 0 0 1 50 ${750 - idx * 16} Tm (${line.replace(/([\\()])/g, "\\$1")}) Tj`)
    .join("\n");
  const streamContent = `BT\n/F1 10 Tf\n${textStream}\nET`;
  const streamLen = Buffer.byteLength(streamContent);

  const pdf = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
    `4 0 obj << /Length ${streamLen} >> stream\n${streamContent}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "xref",
    "0 6",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000058 00000 n ",
    "0000000115 00000 n ",
    "0000000261 00000 n ",
    "0000000330 00000 n ",
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref",
    "409",
    "%%EOF",
  ].join("\n");
  return Buffer.from(pdf, "utf8");
}

function getDemoInvoiceBuffer(): Buffer {
  const customFixturePath = "C:/Users/gupta/.gemini/antigravity-ide/brain/d2125ba4-a00e-495f-a563-2d4b00e57ad8/.user_uploaded/media_1792989402434.pdf";
  if (fs.existsSync(customFixturePath)) {
    return fs.readFileSync(customFixturePath);
  }

  const demoLines = [
    "AMAZON - DEMO / TEST COPY",
    "Invoice # TEST-INV-2026-10427",
    "Invoice Date 26 October 2026",
    "Order ID TEST-404-1234567-8901234",
    "Order Date 24 October 2026",
    "Sold By: Demo Electronics Seller Pvt. Ltd.",
    "Bill To Kapish Gupta",
    "1 Demo Wireless Headphones - Model TEST-Q20 1 2,499.00 449.82 2,948.82",
    "Grand Total 2,948.82",
    "Brand DemoSound",
    "Model TEST-Q20",
    "Purchase Date 24 October 2026",
    "Warranty 12 months (demo data)",
    "Serial Number TEST-SN-00012345",
    "Marketplace Amazon (demo source)",
  ];
  return createTestPdf(demoLines);
}

describe("Demo PDF invoice file extraction", () => {
  it("extracts all product details accurately from the uploaded demo PDF file", async () => {
    const fileBuffer = getDemoInvoiceBuffer();
    const base64 = fileBuffer.toString("base64");

    const request = new Request("http://localhost:3000/api/products/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileBase64: base64,
        filename: "demo-invoice.pdf",
        mimeType: "application/pdf",
      }),
    });

    const response = await POST(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    // Verify accurate field extraction
    expect(json.invoice.brand).toBe("DemoSound");
    expect(json.invoice.model).toBe("TEST-Q20");
    expect(json.invoice.productName).toContain("Demo Wireless Headphones");
    expect(json.invoice.ownerName).toBe("Kapish Gupta");
    expect(json.invoice.orderId).toBe("TEST-404-1234567-8901234");
    expect(json.invoice.invoiceNumber).toBe("TEST-INV-2026-10427");
    expect(json.invoice.purchaseDate).toBe("2026-10-24");
    expect([2499, 2948.82]).toContain(json.invoice.amount);
    expect(json.invoice.suggestedWarrantyMonths).toBe(12);
    expect(json.invoice.seller).toContain("Demo Electronics Seller");
    expect(json.invoice.purchasePlatform).toBe("Amazon (demo source)");

    // Verify confidence status
    expect(json.fieldStatus.brand).toBe("confident");
    expect(json.fieldStatus.model).toBe("confident");
    expect(json.fieldStatus.order_id).toBe("confident");
    expect(json.fieldStatus.purchase_date).toBe("confident");
    expect(json.fieldStatus.price).toBe("confident");
    expect(json.fieldStatus.warranty_duration).toBe("confident");
  });

  it("extracts all product details accurately when sent via FormData", async () => {
    const fileBuffer = getDemoInvoiceBuffer();
    const file = new NodeFile([fileBuffer], "demo-invoice.pdf", { type: "application/pdf" });
    const formData = {
      get: (key: string) => (key === "invoice" ? file : null),
    } as unknown as FormData;

    const request = {
      headers: new Headers({ "content-type": "multipart/form-data" }),
      formData: async () => formData,
    } as unknown as Request;

    const response = await POST(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.invoice.brand).toBe("DemoSound");
    expect(json.invoice.model).toBe("TEST-Q20");
  });

  it("returns 400 for a corrupted PDF document", async () => {
    const corruptBuffer = Buffer.from("%PDF-1.4 corrupt garbage data not a valid pdf stream");
    const file = new NodeFile([corruptBuffer], "corrupt.pdf", { type: "application/pdf" });
    const formData = {
      get: (key: string) => (key === "invoice" ? file : null),
    } as unknown as FormData;

    const request = {
      headers: new Headers({ "content-type": "multipart/form-data" }),
      formData: async () => formData,
    } as unknown as Request;

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toMatch(/damaged|not a valid document/i);
  });
});
