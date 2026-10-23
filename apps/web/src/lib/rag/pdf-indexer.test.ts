import { describe, expect, it } from "vitest";
import { chunkExtractedPages } from "./pdf-indexer";

describe("chunkExtractedPages", () => {
  it("keeps a clause continued across pages under its heading with per-page provenance", () => {
    const chunks = chunkExtractedPages([
      {
        pageNumber: 4,
        text: "2. COVERAGE\nThe plan covers accidental damage when the device is registered",
      },
      {
        pageNumber: 5,
        text: "within thirty days of purchase. Exceptions apply to intentional damage.",
      },
    ]);

    expect(chunks).toEqual([
      expect.objectContaining({
        page_number: 4,
        section_path: "2. COVERAGE",
        content: "The plan covers accidental damage when the device is registered",
      }),
      expect.objectContaining({
        page_number: 5,
        section_path: "2. COVERAGE",
        content: "within thirty days of purchase. Exceptions apply to intentional damage.",
      }),
    ]);
  });

  it("uses nested headings as section paths and keeps conditions with their clause", () => {
    const chunks = chunkExtractedPages([{
      pageNumber: 2,
      text: "1. COVERAGE\nMechanical failure is covered.\n1.1 Conditions\nCoverage applies only if the product was registered within thirty days and proof of purchase is available.",
    }]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ section_path: "1. COVERAGE", content: "Mechanical failure is covered." });
    expect(chunks[1]).toMatchObject({
      section_path: "1. COVERAGE > 1.1 Conditions",
      content: "Coverage applies only if the product was registered within thirty days and proof of purchase is available.",
    });
  });

  it("preserves table row boundaries and cell order", () => {
    const table = "Benefit | Limit\nAccidental damage | Two repairs per year\nTheft | Not covered";
    const chunks = chunkExtractedPages([{ pageNumber: 7, text: table }]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ page_number: 7, content: table });
  });

  it("skips empty pages without changing later page provenance", () => {
    const chunks = chunkExtractedPages([
      { pageNumber: 1, text: "   " },
      { pageNumber: 3, text: "5. DEFINITIONS\nAccidental damage means sudden physical damage." },
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      page_number: 3,
      section_path: "5. DEFINITIONS",
      content: "Accidental damage means sudden physical damage.",
    });
  });

  it("bounds long chunks at sentence boundaries and preserves all source text", () => {
    const source = Array.from({ length: 80 }, (_, index) => `Clause ${index + 1} provides synthetic warranty coverage.`).join(" ");
    const chunks = chunkExtractedPages([{ pageNumber: 1, text: source }]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 2500)).toBe(true);
    expect(chunks.map((chunk) => chunk.content).join("")).toBe(source);
  });
});
