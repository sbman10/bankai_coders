import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { performDocumentOcr, isGoogleVisionConfigured } from "./vision";

describe("performDocumentOcr", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("checks whether Google Cloud Vision is configured", () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
    delete process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
    delete process.env.GOOGLE_CLOUD_PRIVATE_KEY;

    expect(isGoogleVisionConfigured()).toBe(false);

    process.env.GOOGLE_CLOUD_VISION_API_KEY = "test-api-key";
    expect(isGoogleVisionConfigured()).toBe(true);
  });

  it("falls back gracefully for PDF when Vision credentials are not provided", async () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;

    // Simulate empty buffer
    const emptyBuffer = new Uint8Array([0, 1, 2, 3]);
    const result = await performDocumentOcr(emptyBuffer, "invoice.pdf", "application/pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.fileName).toBe("invoice.pdf");
    expect(result.engine).toBe("pdfjs-fallback");
  });

  it("rejects unsupported mime types with clear error", async () => {
    const buffer = new Uint8Array([1, 2, 3]);
    await expect(performDocumentOcr(buffer, "test.exe", "application/x-msdownload")).rejects.toThrow(
      /unsupported file type/i
    );
  });
});
