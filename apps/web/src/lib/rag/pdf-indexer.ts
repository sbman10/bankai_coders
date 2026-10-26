import { createHash } from "node:crypto";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

if (typeof globalThis !== "undefined") {
  // @ts-expect-error global worker for Node environment
  globalThis.pdfjsWorker = pdfjsWorker;
}

if (typeof GlobalWorkerOptions !== "undefined") {
  try {
    GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
  } catch {
    // Ignore if already set
  }
}

export type ExtractedPage = { pageNumber: number; text: string };
export type IndexedChunk = {
  page_number: number;
  section_path: string | null;
  chunk_index: number;
  content: string;
  content_hash: string;
  extraction_confidence: null;
};

const MAX_PDF_PAGES = 100;
const MAX_PAGE_TEXT = 40_000;
const MAX_CHUNK_TEXT = 2_500;

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
}

export async function extractPdfPages(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const task = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: true,
    verbosity: 0,
  });
  try {
    const document = await task.promise;
    if (document.numPages < 1 || document.numPages > MAX_PDF_PAGES) throw new Error("unsupported_page_count");
    const pages: ExtractedPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => {
        if (!("str" in item)) return "";
        return `${item.str}${item.hasEOL ? "\n" : " "}`;
      }).join("")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .trim();
      if (text.length > MAX_PAGE_TEXT) throw new Error("page_text_too_large");
      pages.push({ pageNumber, text });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/**
 * Renders the first N pages of a PDF to PNG buffers for OCR fallback (scanned / image-only PDFs).
 * Uses @napi-rs/canvas if available.
 */
export async function renderPdfPagesToBuffers(bytes: Uint8Array, maxPages = 3): Promise<Buffer[]> {
  try {
    const { createCanvas } = await import("@napi-rs/canvas");
    const task = getDocument({
      data: new Uint8Array(bytes),
      disableFontFace: true,
      verbosity: 0,
    });
    const doc = await task.promise;
    const pageCount = Math.min(doc.numPages, maxPages);
    const buffers: Buffer[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      // @ts-expect-error napi-rs canvas context compatibility with pdfjs
      await page.render({ canvasContext: context, viewport }).promise;
      buffers.push(canvas.toBuffer("image/png"));
    }
    await task.destroy();
    return buffers;
  } catch (err) {
    console.warn("[PDF RENDER] Canvas page rendering not available for scanned fallback:", err);
    return [];
  }
}

function sectionHeading(line: string): { level: number; path: string } | null {
  if (line.length > 120) return null;

  const numbered = line.match(/^(\d+(?:\.\d+)*)(?:[.)])?\s+(.+)$/);
  if (numbered && !/[.!?;:]$/.test(line)) {
    return { level: numbered[1].split(".").length, path: line };
  }

  const namedHeading = /^(coverage|warrant(?:y|ies)|exclusions?|exceptions?|conditions?|definitions?|limitations?|claims? procedure)$/i;
  if (namedHeading.test(line)) return { level: 1, path: line };
  if (line.length >= 4 && line === line.toLocaleUpperCase() && /[A-Z]/.test(line)) {
    return { level: 1, path: line };
  }
  return null;
}

function contentPieces(text: string): string[] {
  const pieces: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_CHUNK_TEXT) {
    const limit = MAX_CHUNK_TEXT;
    const minimumBoundary = Math.floor(limit / 2);
    const prefix = remaining.slice(0, limit + 1);
    const rowBoundary = prefix.lastIndexOf("\n", limit);
    let boundary = -1;

    if (/[|\t]/.test(prefix)) {
      if (rowBoundary >= minimumBoundary) boundary = rowBoundary + 1;
    }

    if (boundary < 0) {
      const sentenceEnd = /[.!?](?:[ \t]+|\n+)/g;
      let match: RegExpExecArray | null;
      while ((match = sentenceEnd.exec(prefix)) !== null) {
        const candidate = match.index + match[0].length;
        if (candidate >= minimumBoundary && candidate <= limit) boundary = candidate;
      }
    }

    if (boundary < 0 && rowBoundary >= minimumBoundary) boundary = rowBoundary + 1;

    if (boundary < 0) {
      boundary = prefix.lastIndexOf(" ", limit);
      if (boundary < minimumBoundary) boundary = limit;
      else boundary += 1;
    }

    pieces.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary);
  }
  if (remaining.length > 0) pieces.push(remaining);
  return pieces;
}

export function chunkExtractedPages(pages: ExtractedPage[]): IndexedChunk[] {
  const chunks: IndexedChunk[] = [];
  const headings: string[] = [];

  for (const page of pages) {
    let buffered = "";
    const emit = (text: string) => {
      const sectionPath = headings.length > 0 ? headings.join(" > ") : null;
      for (const content of contentPieces(text)) {
        chunks.push({
          page_number: page.pageNumber,
          section_path: sectionPath,
          chunk_index: chunks.length,
          content,
          content_hash: createHash("sha256").update(content, "utf8").digest("hex"),
          extraction_confidence: null,
        });
      }
    };
    const flush = () => {
      if (buffered.trim()) emit(buffered);
      buffered = "";
    };

    for (const rawLine of page.text.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      const heading = sectionHeading(line);
      if (heading) {
        flush();
        headings.length = heading.level - 1;
        headings[heading.level - 1] = heading.path;
        continue;
      }

      const combined = buffered ? `${buffered}\n${line}` : line;
      if (combined.length > MAX_CHUNK_TEXT) {
        emit(combined);
        buffered = "";
      } else {
        buffered = combined;
      }
    }
    flush();
  }

  return chunks;
}
