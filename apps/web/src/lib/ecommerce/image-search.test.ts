import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cleanSearchQuery,
  searchProductImage,
  clearImageSearchCache,
} from "./image-search";

describe("Product Image Search", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearImageSearchCache();
  });

  describe("cleanSearchQuery", () => {
    it("cleans invoice noise, quantities, and parenthetical attributes", () => {
      const dirty = "boAt Rockerz 450 Bluetooth On-Ear Headphones (Luscious Black, 15H Playback) Qty: 1 HSN: 8518";
      const cleaned = cleanSearchQuery(dirty);
      expect(cleaned).toContain("boAt Rockerz 450");
      expect(cleaned).not.toContain("Luscious Black");
      expect(cleaned).not.toContain("Qty");
      expect(cleaned).not.toContain("HSN");
    });

    it("combines brand, name, and model without repeating brand", () => {
      const cleaned = cleanSearchQuery({
        brand: "Kobo",
        name: "Kobo Adjustable Dumbbell Pad",
        model: "K-24",
      });
      expect(cleaned).toBe("Kobo Adjustable Dumbbell Pad K-24");
    });

    it("handles null or undefined attributes gracefully", () => {
      const cleaned = cleanSearchQuery({
        name: "Adjustable dumbbell pad",
        brand: null,
        model: undefined,
      });
      expect(cleaned).toBe("Adjustable dumbbell pad");
    });
  });

  describe("searchProductImage", () => {
    it("returns top image from primary image search HTML", async () => {
      const mockHtml = `
        <div class="imgpt">
          <a class="iusc" m="{&quot;murl&quot;:&quot;https://m.media-amazon.com/images/I/71cRONPYuVL._SL1500_.jpg&quot;,&quot;t&quot;:&quot;Kobo Dumbbell Pad&quot;}"></a>
        </div>
      `;

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      } as unknown as Response);

      const result = await searchProductImage("Kobo Adjustable dumbbell pad");
      expect(result).not.toBeNull();
      expect(result?.imageUrl).toBe("https://m.media-amazon.com/images/I/71cRONPYuVL._SL1500_.jpg");
    });

    it("uses in-memory cache for repeated lookups without extra network calls", async () => {
      const mockHtml = `
        <div class="imgpt">
          <a class="iusc" m="{&quot;murl&quot;:&quot;https://m.media-amazon.com/images/I/71cRONPYuVL._SL1500_.jpg&quot;}"></a>
        </div>
      `;

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      } as unknown as Response);

      const first = await searchProductImage("Kobo Adjustable dumbbell pad");
      const second = await searchProductImage("Kobo Adjustable dumbbell pad");

      expect(first?.imageUrl).toBe(second?.imageUrl);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("falls back to Wikimedia Commons if primary search returns no images", async () => {
      const emptyHtml = `<html><body>No results</body></html>`;
      const wikiJson = {
        query: {
          pages: {
            "123": {
              title: "File:Aluminium Dumbbell.jpg",
              imageinfo: [
                {
                  thumburl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Aluminium_Dumbbell.jpg",
                },
              ],
            },
          },
        },
      };

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => emptyHtml,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => wikiJson,
        } as unknown as Response);

      const result = await searchProductImage("dumbbell");
      expect(result).not.toBeNull();
      expect(result?.imageUrl).toContain("Aluminium_Dumbbell.jpg");
    });

    it("returns null safely without throwing when network times out or fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network timeout"));

      const result = await searchProductImage("nonexistent product query");
      expect(result).toBeNull();
    });
  });
});

