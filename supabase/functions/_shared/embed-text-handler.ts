import {
  GTE_SMALL_DIMENSION,
  GTE_SMALL_MODEL_ALIAS,
  GTE_SMALL_MODEL_REPOSITORY,
  isValidGteSmallVector,
} from "./embeddings";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_TEXT_LENGTH = 400;
const MAX_DOCUMENT_BATCH = 32;

type QueryEmbedder = {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments?(texts: string[]): Promise<number[][]>;
};

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createEmbedTextHandler(embedder: QueryEmbedder, verifyUser: (request: Request) => Promise<boolean>) {
  return async function handleEmbedText(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    try {
      if (!(await verifyUser(request))) return json({ error: "Sign in to use document search." }, 401);
    } catch {
      return json({ error: "Sign in to use document search." }, 401);
    }
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
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
      !("text" in body || "texts" in body)) {
      return json({ error: "Provide only a bounded text value." }, 400);
    }

    try {
      const metadata = {
        modelAlias: GTE_SMALL_MODEL_ALIAS,
        modelRepository: GTE_SMALL_MODEL_REPOSITORY,
        modelRevision: null,
        dimension: GTE_SMALL_DIMENSION,
        pooling: "mean",
        normalized: true,
      };
      if ("texts" in body) {
        if (!Array.isArray(body.texts) || body.texts.length < 1 || body.texts.length > MAX_DOCUMENT_BATCH ||
          body.texts.some((text) => typeof text !== "string" || !text.trim() || new TextEncoder().encode(text).length > MAX_TEXT_LENGTH) ||
          !embedder.embedDocuments) return json({ error: "Provide only bounded document passages." }, 400);
        const embeddings = await embedder.embedDocuments(body.texts);
        if (embeddings.length !== body.texts.length || embeddings.some((vector) => !isValidGteSmallVector(vector))) {
          return json({ error: "Document embeddings are unavailable." }, 503);
        }
        return json({ embeddings, ...metadata }, 200);
      }
      if (typeof body.text !== "string" || !body.text.trim() || new TextEncoder().encode(body.text).length > MAX_TEXT_LENGTH) {
        return json({ error: "Provide only a bounded text value." }, 400);
      }
      const embedding = await embedder.embedQuery(body.text);
      if (!isValidGteSmallVector(embedding)) return json({ error: "The query embedding is unavailable." }, 503);
      return json({ embedding, ...metadata }, 200);
    } catch {
      return json({ error: "The query embedding is unavailable." }, 503);
    }
  };
}
