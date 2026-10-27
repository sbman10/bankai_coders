# ProductVault document search: current integration

**Status (27 October 2026):** The bankai database schema and `embed-text` Edge Function are live. The application path is implemented on `rag-live-integration`; a signed-in, end-to-end upload and answer against bankai has not yet been verified.

## Data flow

1. A signed-in user saves a product in Supabase and uploads an invoice or warranty file to the private `claim-documents` Storage bucket. The file is attached to that user's product in `product_documents`.
2. The app calls `POST /api/products/[id]/documents/[documentId]/index` after attachment. The server rechecks the user and document owner, then downloads the private file using that user's session.
3. Native-text PDFs are extracted page by page. Empty or unreadable pages stop publication and show `needs_review`. Text is split into bounded chunks with page/section provenance. Images and scanned PDFs still need a reviewed OCR path.
4. The signed-in server client sends bounded text batches to bankai's `embed-text` Edge Function. It uses `gte-small` (384 dimensions, mean pooling, normalized output). The server validates every vector and writes a new index generation to `document_chunks`; only then does it mark the document indexed. A failed re-index keeps the previous published generation available.
5. The chatbot requires the user to choose a product and up to six indexed documents. Its server route verifies ownership and readiness, embeds the question, searches only the selected documents with vector and English keyword RPCs, and sends the returned excerpts to Groq. Citation IDs are checked against those retrieved chunks before document name/page/section is shown. Missing or conflicting evidence produces an abstention or qualification.

Supabase is the source of truth. n8n is not in the document-answer path and its claim workflow is unchanged.

## Live bankai state and migration caution

The document-grounded, embedding/job, vector-search, and product-passport additive migrations were applied to bankai through the SQL Editor. A read-only verification in that session found pgvector 0.8.2, the vector column and HNSW index, the owner-scoped search RPC, and the job table. The `embed-text` function is deployed with the platform JWT check enabled and an additional signed-in-user check in its handler.

SQL Editor application did **not** populate `supabase_migrations.schema_migrations`. Do not run a bulk `supabase db push` against bankai until the remote migration history is reconciled; it could replay schema changes. Keep the SQL files in Git as the reviewed source of the applied schema.

## Local configuration and remaining verification

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY` in the ignored `apps/web/.env.local` for local testing. `GROQ_API_KEY` and `GROQ_MODEL` are needed to generate answers. Never put secret keys in `NEXT_PUBLIC_` variables or commit `.env.local`.

Before calling this production-ready, perform one signed-in synthetic PDF upload and cited-answer check against bankai; verify another user's and an unselected document's chunks never appear. The current synchronous indexing request is vulnerable to browser interruption and large files; the scheduled Queue/Edge worker is still an unconnected design. OCR for scanned/image documents and the separate general-chat mode are also pending. Do not treat a product without an indexed document as having searchable vector content.
