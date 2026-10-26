import { describe, expect, it } from "vitest";
import * as fs from "fs";
import { File as NodeFile } from "node:buffer";
import { POST } from "./route";

describe("Demo PDF invoice file extraction", () => {
  const fixturePath = "C:/Users/gupta/.gemini/antigravity-ide/brain/d2125ba4-a00e-495f-a563-2d4b00e57ad8/.user_uploaded/media_1792989402434.pdf";

  it("extracts all product details accurately from the uploaded demo PDF file", async () => {
    if (!fs.existsSync(fixturePath)) {
      console.warn("Fixture not found at", fixturePath);
      return;
    }

    const fileBuffer = fs.readFileSync(fixturePath);
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
    if (!fs.existsSync(fixturePath)) return;

    const fileBuffer = fs.readFileSync(fixturePath);
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
    console.log("FormData response status:", response.status, "json:", json);
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.invoice.brand).toBe("DemoSound");
  });
});
