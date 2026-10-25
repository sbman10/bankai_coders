export const GTE_SMALL_MODEL_ALIAS = "gte-small" as const;
export const GTE_SMALL_MODEL_REPOSITORY = "Supabase/gte-small" as const;
export const GTE_SMALL_DIMENSION = 384;
export const GTE_SMALL_OPTIONS = { mean_pool: true, normalize: true } as const;

export type GteSmallSession = {
  run(text: string, options: typeof GTE_SMALL_OPTIONS): Promise<unknown>;
};

export class EmbeddingBoundaryError extends Error {
  constructor(readonly code: "embedding_unavailable" | "embedding_invalid_output" | "embedding_input_invalid") {
    super(code);
    this.name = "EmbeddingBoundaryError";
  }
}

export function isValidGteSmallVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === GTE_SMALL_DIMENSION &&
    value.every((component) => typeof component === "number" && Number.isFinite(component));
}

export function createGteSmallEmbeddingService(createSession: () => GteSmallSession) {
  async function embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length < 1 || texts.length > 32 || texts.some((text) => typeof text !== "string" || !text.trim() || text.length > 10_000)) {
      throw new EmbeddingBoundaryError("embedding_input_invalid");
    }

    let session: GteSmallSession;
    try {
      session = createSession();
    } catch {
      throw new EmbeddingBoundaryError("embedding_unavailable");
    }

    const vectors: number[][] = [];
    for (const text of texts) {
      let output: unknown;
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
    embedDocuments: (texts: string[]) => embedTexts(texts),
    embedQuery: async (text: string) => (await embedTexts([text]))[0],
  };
}

export function createSupabaseGteSmallEmbeddingService() {
  const runtime = globalThis as typeof globalThis & {
    Supabase?: { ai?: { Session?: new (model: string) => GteSmallSession } };
  };
  return createGteSmallEmbeddingService(() => {
    const Session = runtime.Supabase?.ai?.Session;
    if (!Session) throw new Error("Supabase Edge Runtime AI session is unavailable.");
    return new Session(GTE_SMALL_MODEL_ALIAS);
  });
}
