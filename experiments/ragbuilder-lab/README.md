# RagBuilder lab

An isolated playground for comparing RAG pipeline choices for ProductVault. This is an experiment only; RagBuilder is not a dependency of the Next.js app.

## Installed environment

- Python: 3.11.16, local to this lab
- RagBuilder: 0.1.6, installed in `.venv311`
- Usage analytics: disabled in the lab `.env`

Activate it from PowerShell:

```powershell
cd "$HOME\Desktop\claimforge\experiments\ragbuilder-lab"
.\.venv311\Scripts\Activate.ps1
```

Use only public warranty policies or synthetic/redacted samples under `data/`. Do not put invoices, personal documents, API keys, or Supabase credentials here.

## ProductVault experiment order

Keep the embedding model fixed at `gte-small` and compare one variable at a time:

1. Chunking: policy heading/section-aware chunks versus recursive fixed-size chunks.
2. Retrieval: dense vector search versus hybrid vector + keyword retrieval.
3. Context size: candidate count and final top-k.
4. Reranking: only test if relevant clauses are missed or poor passages rank too high.
5. Answer checks: correct supporting section/page, grounded response, and abstention when evidence is missing or conflicting.

Build a small manually reviewed question set from the policy text. For each question record the expected answer, supporting page/section, and whether the system should abstain. Compare settings against that same set and inspect failures; do not select a pipeline by one aggregate score alone.

## Important compatibility note

RagBuilder’s default examples use OpenAI embeddings/models. ProductVault has selected Supabase `gte-small` and Groq. Before treating its comparison as representative, configure adapters that use those same production models. Supabase documents that document and query vectors must use the same embedding model. If RagBuilder cannot use the Supabase embedding path, use it to explore chunking/retrieval concepts, then validate the winning choices against ProductVault’s real Supabase search path.

The upstream repository currently marks itself as no longer actively maintained. Keep this isolated and review its output before adopting anything in production.
