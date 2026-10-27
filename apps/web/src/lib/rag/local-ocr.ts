import path from "node:path";

/** OCR stays on this server; document bytes are not sent to a cloud OCR API. */
export async function ocrImage(bytes: Uint8Array): Promise<{ text: string; confidence: number | null }> {
  const { recognize } = await import("tesseract.js");
  const workerPath = path.resolve(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js");
  const result = await recognize(Buffer.from(bytes), "eng", { workerPath });
  const text = result.data.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
  const score = result.data.confidence;
  return { text, confidence: Number.isFinite(score) ? Math.max(0, Math.min(1, score / 100)) : null };
}
