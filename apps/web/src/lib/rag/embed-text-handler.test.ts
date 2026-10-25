import { describe, expect, it, vi } from "vitest";
import { createEmbedTextHandler } from "../../../../../supabase/functions/_shared/embed-text-handler";

const vector = Array.from({ length: 384 }, () => 0.125);

describe("authenticated embedding request boundary", () => {
  it("returns a versioned gte-small query vector for bounded text", async () => {
    const embedQuery = vi.fn(async () => vector);
    const handler = createEmbedTextHandler({ embedQuery });
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
    const handler = createEmbedTextHandler({ embedQuery });
    const response = await handler(new Request("http://edge.local/embed-text", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "synthetic", userId: "attacker-controlled" }),
    }));

    expect(response.status).toBe(400);
    expect(embedQuery).not.toHaveBeenCalled();
  });

  it("does not expose provider details when embedding fails", async () => {
    const handler = createEmbedTextHandler({ embedQuery: async () => { throw new Error("private provider detail"); } });
    const response = await handler(new Request("http://edge.local/embed-text", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "synthetic question" }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "The query embedding is unavailable." });
  });
});
