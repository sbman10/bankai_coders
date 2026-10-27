// supabase/functions/_shared/embeddings.ts
var GTE_SMALL_MODEL_ALIAS = "gte-small";
var GTE_SMALL_MODEL_REPOSITORY = "Supabase/gte-small";
var GTE_SMALL_DIMENSION = 384;
var GTE_SMALL_OPTIONS = { mean_pool: true, normalize: true };
var EmbeddingBoundaryError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "EmbeddingBoundaryError";
  }
};
function isValidGteSmallVector(value) {
  return Array.isArray(value) && value.length === GTE_SMALL_DIMENSION && value.every((component) => typeof component === "number" && Number.isFinite(component));
}
function createGteSmallEmbeddingService(createSession) {
  async function embedTexts(texts) {
    if (texts.length < 1 || texts.length > 32 || texts.some((text) => typeof text !== "string" || !text.trim() || text.length > 1e4)) {
      throw new EmbeddingBoundaryError("embedding_input_invalid");
    }
    let session;
    try {
      session = createSession();
    } catch {
      throw new EmbeddingBoundaryError("embedding_unavailable");
    }
    const vectors = [];
    for (const text of texts) {
      let output;
      try {
        output = await session.run(text, GTE_SMALL_OPTIONS);
      } catch {
        throw new EmbeddingBoundaryError("embedding_unavailable");
      }
      if (!isValidGteSmallVector(output)) throw new EmbeddingBoundaryError("embedding_invalid_output");
      vectors.push(output);
    }
    return vectors;
  }
  return {
    embedDocuments: (texts) => embedTexts(texts),
    embedQuery: async (text) => (await embedTexts([text]))[0]
  };
}
function createSupabaseGteSmallEmbeddingService() {
  const runtime = globalThis;
  return createGteSmallEmbeddingService(() => {
    const Session = runtime.Supabase?.ai?.Session;
    if (!Session) throw new Error("Supabase Edge Runtime AI session is unavailable.");
    return new Session(GTE_SMALL_MODEL_ALIAS);
  });
}

// supabase/functions/_shared/embed-text-handler.ts
var MAX_BODY_BYTES = 8 * 1024;
var MAX_TEXT_LENGTH = 400;
var MAX_DOCUMENT_BATCH = 32;
function json(body, status) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function createEmbedTextHandler(embedder, verifyUser2) {
  return async function handleEmbedText(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    try {
      if (!await verifyUser2(request)) return json({ error: "Sign in to use document search." }, 401);
    } catch {
      return json({ error: "Sign in to use document search." }, 401);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json({ error: "Provide a bounded JSON request." }, 400);
    }
    let rawBody;
    try {
      rawBody = await request.text();
    } catch {
      return json({ error: "Provide a valid JSON request." }, 400);
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "The embedding request is too large." }, 413);
    }
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Provide a valid JSON request." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("text" in body || "texts" in body)) {
      return json({ error: "Provide only a bounded text value." }, 400);
    }
    try {
      const metadata = {
        modelAlias: GTE_SMALL_MODEL_ALIAS,
        modelRepository: GTE_SMALL_MODEL_REPOSITORY,
        modelRevision: null,
        dimension: GTE_SMALL_DIMENSION,
        pooling: "mean",
        normalized: true
      };
      if ("texts" in body) {
        if (!Array.isArray(body.texts) || body.texts.length < 1 || body.texts.length > MAX_DOCUMENT_BATCH || body.texts.some((text) => typeof text !== "string" || !text.trim() || new TextEncoder().encode(text).length > MAX_TEXT_LENGTH) || !embedder.embedDocuments) return json({ error: "Provide only bounded document passages." }, 400);
        const embeddings2 = await embedder.embedDocuments(body.texts);
        if (embeddings2.length !== body.texts.length || embeddings2.some((vector) => !isValidGteSmallVector(vector))) {
          return json({ error: "Document embeddings are unavailable." }, 503);
        }
        return json({ embeddings: embeddings2, ...metadata }, 200);
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

// supabase/functions/embed-text/index.ts
var embeddings = createSupabaseGteSmallEmbeddingService();
async function verifyUser(request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const key = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY");
  if (!projectUrl || !key) return false;
  const response = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { authorization, apikey: key },
    signal: AbortSignal.timeout(5e3)
  });
  if (!response.ok) return false;
  const user = await response.json();
  return typeof user?.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id);
}
Deno.serve(createEmbedTextHandler(embeddings, verifyUser));
