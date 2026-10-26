import { describe, expect, it, vi } from "vitest";
import {
  createGteSmallEmbeddingService,
  EmbeddingBoundaryError,
  GTE_SMALL_DIMENSION,
  GTE_SMALL_OPTIONS,
} from "../../../../../supabase/functions/_shared/embeddings";

const validVector = () => Array.from({ length: GTE_SMALL_DIMENSION }, (_, index) => index / GTE_SMALL_DIMENSION);

describe("gte-small embedding boundary", () => {
  it("uses the same pinned model options for document text and question text", async () => {
    const run = vi.fn(async () => validVector());
    const createSession = vi.fn(() => ({ run }));
    const embeddings = createGteSmallEmbeddingService(createSession);

    const documentVectors = await embeddings.embedDocuments(["Synthetic warranty clause."]);
    const queryVector = await embeddings.embedQuery("Does accidental damage qualify?");

    expect(documentVectors).toEqual([validVector()]);
    expect(queryVector).toEqual(validVector());
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(1, "Synthetic warranty clause.", GTE_SMALL_OPTIONS);
    expect(run).toHaveBeenNthCalledWith(2, "Does accidental damage qualify?", GTE_SMALL_OPTIONS);
  });

  it("rejects malformed vectors and hides provider details", async () => {
    const service = createGteSmallEmbeddingService(() => ({
      run: async () => Array.from({ length: 383 }, () => 0),
    }));

    await expect(service.embedQuery("synthetic question")).rejects.toMatchObject({ code: "embedding_invalid_output" });
  });

  it("returns a safe unavailable error when the Edge Runtime model is unavailable", async () => {
    const service = createGteSmallEmbeddingService(() => {
      throw new Error("synthetic provider details must not escape");
    });

    let caught: unknown;
    try {
      await service.embedQuery("synthetic question");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EmbeddingBoundaryError);
    expect((caught as Error).message).toBe("embedding_unavailable");
  });
});
