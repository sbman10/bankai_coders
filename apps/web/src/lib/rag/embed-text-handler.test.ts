import { describe, expect, it, vi } from "vitest";
import { createEmbedTextHandler } from "../../../../../supabase/functions/_shared/embed-text-handler";

const vector = Array.from({ length: 384 }, () => 0.125);

describe("authenticated embedding request boundary", () => {
  it("rejects callers without a verified user before processing document text", async () => {
    const embedQuery = vi.fn();
    const handler = createEmbedTextHandler({ embedQuery }, async () => false);
    const response = await handler(new Request("http://edge.local/embed-text", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Synthetic question" }),
    }));

    expect(response.status).toBe(401);
    expect(embedQuery).not.toHaveBeenCalled();
  });
  it("embeds a bounded batch of document passages with the same model metadata", async () => {
    const embedDocuments = vi.fn(async () => [vector, vector]);
    const handler = createEmbedTextHandler({ embedQuery: vi.fn(), embedDocuments }, async () => true);
    const response = await handler(new Request("http://edge.local/embed-text", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: ["Warranty lasts one year.", "Proof of purchase is required."] }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ embeddings: [vector, vector], modelAlias: "gte-small", dimension: 384 });
    expect(embedDocuments).toHaveBeenCalledWith(["Warranty lasts one year.", "Proof of purchase is required."]);
  });
  it("returns a versioned gte-small query vector for bounded text", async () => {
    const embedQuery = vi.fn(async () => vector);
    const handler = createEmbedTextHandler({ embedQuery }, async () => true);
    const response = await handler(new Request("http://edge.local/embed-text", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Synthetic warranty question?" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      embedding: vector,
      modelAlias: "gte-small",
      modelRepository: "Supabase/gte-small",
      modelRevision: null,
      dimension: 384,
      pooling: "mean",
      normalized: true,
    });
    expect(embedQuery).toHaveBeenCalledWith("Synthetic warranty question?");
  });

  it("rejects unexpected fields and does not call the model", async () => {
    const embedQuery = vi.fn();
    const handler = createEmbedTextHandler({ embedQuery }, async () => true);
    const response = await handler(new Request("http://edge.local/embed-text", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "synthetic", userId: "attacker-controlled" }),
    }));

    expect(response.status).toBe(400);
    expect(embedQuery).not.toHaveBeenCalled();
  });

  it("does not expose provider details when embedding fails", async () => {
    const handler = createEmbedTextHandler({ embedQuery: async () => { throw new Error("private provider detail"); } }, async () => true);
    const response = await handler(new Request("http://edge.local/embed-text", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "synthetic question" }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "The query embedding is unavailable." });
  });
});
