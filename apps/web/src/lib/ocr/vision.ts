import { ImageAnnotatorClient } from "@google-cloud/vision";
import { isPdf, extractPdfPages } from "../rag/pdf-indexer";
import type { OcrPage, OcrRawResult } from "./types";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

let cachedVisionClient: ImageAnnotatorClient | null = null;

export function isGoogleVisionConfigured(): boolean {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return true;
  if (process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim()) return true;
  if (
    process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() &&
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim() &&
    process.env.GOOGLE_CLOUD_PRIVATE_KEY?.trim()
  ) {
    return true;
  }
  return false;
}

function getVisionClient(): ImageAnnotatorClient {
  if (cachedVisionClient) return cachedVisionClient;

  const options: ConstructorParameters<typeof ImageAnnotatorClient>[0] = {};

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
  } else if (
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim() &&
    process.env.GOOGLE_CLOUD_PRIVATE_KEY?.trim()
  ) {
    options.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
    options.credentials = {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, "\n"),
    };
  } else if (process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim()) {
    options.apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY.trim();
  }

  cachedVisionClient = new ImageAnnotatorClient(options);
  return cachedVisionClient;
}

export async function performDocumentOcr(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string
): Promise<OcrRawResult> {
  const normalizedMime = mimeType.toLowerCase();
  const isPdfDoc = normalizedMime === "application/pdf" || isPdf(bytes);

  if (!SUPPORTED_MIME_TYPES.has(normalizedMime) && !isPdfDoc) {
    throw new Error(
      `Unsupported file type: ${mimeType || "unknown"}. Please upload a PDF, PNG, JPG, or WEBP document.`
    );
  }

  // 1. Try Google Cloud Vision API if credentials are configured
  if (isGoogleVisionConfigured()) {
    try {
      const client = getVisionClient();
      const nodeBuffer = Buffer.from(bytes);

      if (isPdfDoc) {
        // PDF Document Text Detection via batchAnnotateFiles
        const [response] = await client.batchAnnotateFiles({
          requests: [
            {
              inputConfig: {
                content: nodeBuffer,
                mimeType: "application/pdf",
              },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              pages: [1, 2, 3, 4, 5], // Annotate up to the first 5 pages of the invoice
            },
          ],
        });

        const fileResponse = response.responses?.[0];
        const pageResponses = fileResponse?.responses ?? [];
        const pages: OcrPage[] = [];
        let combinedText = "";

        for (let i = 0; i < pageResponses.length; i++) {
          const p = pageResponses[i];
          const pageText = p.fullTextAnnotation?.text || "";
          if (pageText.trim()) {
            pages.push({
              pageNumber: i + 1,
              text: pageText,
              confidence: p.fullTextAnnotation?.pages?.[0]?.confidence ?? undefined,
            });
            combinedText += `${pageText}\n\n`;
          }
        }

        if (combinedText.trim().length > 0) {
          return {
            text: combinedText.trim(),
            pages,
            mimeType: "application/pdf",
            fileName,
            engine: "google-cloud-vision",
          };
        }
      } else {
        // Image Document Text Detection (DOCUMENT_TEXT_DETECTION)
        const [result] = await client.documentTextDetection({
          image: { content: nodeBuffer },
        });

        const fullText = result.fullTextAnnotation?.text || "";
        if (fullText.trim().length > 0) {
          return {
            text: fullText.trim(),
            pages: [
              {
                pageNumber: 1,
                text: fullText.trim(),
                confidence: result.fullTextAnnotation?.pages?.[0]?.confidence ?? undefined,
              },
            ],
            mimeType: normalizedMime,
            fileName,
            engine: "google-cloud-vision",
          };
        }
      }
    } catch (visionErr) {
      // Vision API failed (network, quota, invalid credentials). Log server-side and fall through.
      console.warn("Google Cloud Vision API failed or unavailable, falling back:", visionErr);
    }
  }

  // 2. Fallback for PDF documents: use local extraction
  if (isPdfDoc) {
    try {
      const pages = await extractPdfPages(bytes);
      const text = pages.map((p) => p.text).join("\n\n").trim();
      return {
        text,
        pages: pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
        mimeType: "application/pdf",
        fileName,
        engine: "pdfjs-fallback",
      };
    } catch (pdfErr) {
      const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      console.error("[OCR DEBUG] PDF local text extraction failed:", pdfErr);
      return {
        text: "",
        pages: [],
        mimeType: "application/pdf",
        fileName,
        engine: "pdfjs-fallback",
        debugError: `PDF extraction error: ${errMsg}`,
      };
    }
  }

  // 3. Fallback for Images when Vision API is not configured or failed: local Tesseract OCR
  try {
    const { recognize } = await import("tesseract.js");
    const path = await import("node:path");
    const workerPath = path.resolve(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js");
    const result = await recognize(Buffer.from(bytes), "eng", {
      workerPath,
    });
    const text = result?.data?.text?.trim() || "";
    if (text.length > 0) {
      return {
        text,
        pages: [
          {
            pageNumber: 1,
            text,
            confidence: result.data.confidence,
          },
        ],
        mimeType: normalizedMime,
        fileName,
        engine: "tesseract-fallback",
      };
    }
  } catch (tessErr) {
    console.warn("Tesseract OCR fallback failed or not available:", tessErr);
  }

  // 4. Default empty result if all engines produce no text
  return {
    text: "",
    pages: [],
    mimeType: normalizedMime,
    fileName,
    engine: "text-fallback",
    debugError: isGoogleVisionConfigured()
      ? "Google Vision returned no text."
      : "Google Cloud Vision API is not configured and local OCR fallback produced no text.",
  };
}
