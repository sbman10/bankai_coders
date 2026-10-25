import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "../../supabase/migrations");

function vectorSearchMigration() {
  const files = readdirSync(migrationsDirectory).filter((file) => file.endsWith("_document_vector_search.sql"));
  expect(files).toHaveLength(1);
  return readFileSync(resolve(migrationsDirectory, files[0]), "utf8");
}

describe("local semantic search migration contract", () => {
  it("uses the existing embedding column with a cosine HNSW index", () => {
    const sql = vectorSearchMigration();

    expect(sql).toMatch(/using\s+hnsw\s*\(\s*embedding\s+extensions\.vector_cosine_ops\s*\)/i);
    expect(sql).not.toMatch(/add\s+column[^;]*\bembedding\b/i);
  });

  it("scopes vector results to auth.uid, the selected product/documents, and active index", () => {
    const sql = vectorSearchMigration();

    expect(sql).toMatch(/c\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i);
    expect(sql).toMatch(/d\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i);
    expect(sql).toMatch(/d\.product_id\s*=\s*p_product_id/i);
    expect(sql).toMatch(/c\.document_id\s*=\s*any\(coalesce\(p_document_ids/i);
    expect(sql).toMatch(/d\.ingestion_status\s*=\s*'indexed'/i);
    expect(sql).toMatch(/c\.index_version\s*=\s*d\.index_version/i);
    expect(sql).toMatch(/c\.embedding_model_alias\s*=\s*'gte-small'/i);
    expect(sql).toMatch(/c\.embedding_model_revision\s+is\s+null/i);
    expect(sql).toMatch(/c\.embedding_pooling\s*=\s*'mean'/i);
    expect(sql).toMatch(/c\.embedding_normalized\s+is\s+true/i);
    expect(sql).not.toMatch(/p_user_id/i);
  });

  it("uses cosine distance, bounds result count and excerpt size, and limits RPC execution", () => {
    const sql = vectorSearchMigration();

    expect(sql).toMatch(/operator\(extensions\.<=>\)/i);
    expect(sql).toMatch(/limit\s+least\(greatest\(coalesce\(p_result_limit,\s*8\),\s*1\),\s*8\)/i);
    expect(sql).toMatch(/left\(c\.content,\s*1200\)/i);
    expect(sql).toMatch(/security\s+invoker/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function[^;]*from\s+public,\s*anon/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function[^;]*to\s+authenticated/i);
  });
});
