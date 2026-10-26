import { describe, expect, it } from "vitest";
import { resolveProductLink } from "./link-resolver";

describe("resolveProductLink", () => {
  it("resolves Amazon India URL with ASIN and slug title", async () => {
    const url = "https://www.amazon.in/soundcore-Anker-Bluetooth-Headphones-Cancellation/dp/B0CKW4D336";
    const res = await resolveProductLink(url);

    expect(res.asin).toBe("B0CKW4D336");
    expect(res.marketplace).toBe("Amazon.in");
    expect(res.sourceUrl).toBe("https://www.amazon.in/dp/B0CKW4D336");
    expect(res.title).toContain("Soundcore");
    expect(res.brand).toBe("Soundcore");
    expect(res.category).toBe("Audio");
  });

  it("handles Flipkart URLs properly", async () => {
    const url = "https://www.flipkart.com/boat-airdopes-131-bluetooth-headset/p/itmfb12345";
    const res = await resolveProductLink(url);

    expect(res.marketplace).toBe("Flipkart");
    expect(res.title).toContain("Boat");
    expect(res.brand).toBe("Boat");
    expect(res.category).toBe("Audio");
  });

  it("returns safe defaults for invalid or empty URL", async () => {
    const res = await resolveProductLink("");
    expect(res.asin).toBeNull();
    expect(res.title).toBeNull();
    expect(res.category).toBe("Electronics");
  });

  it("uses fallbackKeywords if slug is absent", async () => {
    const url = "https://www.amazon.in/dp/B0CX21C8S2";
    const res = await resolveProductLink(url, "Sony WH-1000XM5 Noise Cancelling");

    expect(res.asin).toBe("B0CX21C8S2");
    expect(res.brand).toBe("Sony");
    expect(res.category).toBe("Audio");
  });
});
