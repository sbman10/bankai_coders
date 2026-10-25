import {
  GTE_SMALL_DIMENSION,
  GTE_SMALL_MODEL_ALIAS,
  GTE_SMALL_MODEL_REPOSITORY,
  isValidGteSmallVector,
} from "./embeddings";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_TEXT_LENGTH = 2_000;

type QueryEmbedder = { embedQuery(text: string): Promise<number[]> };

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createEmbedTextHandler(embedder: QueryEmbedder) {
  return async function handleEmbedText(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json({ error: "Provide a bounded JSON request." }, 400);
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return json({ error: "Provide a valid JSON request." }, 400);
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "The embedding request is too large." }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Provide a valid JSON request." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !("text" in body) || typeof body.text !== "string" ||
      body.text.trim().length < 1 || body.text.length > MAX_TEXT_LENGTH) {
      return json({ error: "Provide only a bounded text value." }, 400);
    }

    try {
      const embedding = await embedder.embedQuery(body.text);
      if (!isValidGteSmallVector(embedding)) return json({ error: "The query embedding is unavailable." }, 503);
      return json({
        embedding,
        modelAlias: GTE_SMALL_MODEL_ALIAS,
        modelRepository: GTE_SMALL_MODEL_REPOSITORY,
        modelRevision: null,
        dimension: GTE_SMALL_DIMENSION,
        pooling: "mean",
        normalized: true,
      }, 200);
    } catch {
      return json({ error: "The query embedding is unavailable." }, 503);
    }
  };
}
