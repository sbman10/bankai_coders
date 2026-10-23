# ClaimForge web MVP

Next.js App Router app for managing products and warranty claims. Supabase Auth sessions are read in server routes through `@supabase/ssr`; browser requests never receive a service-role key.

## Connected behavior

- Sign in, sign up, and sign out through the Next.js auth route.
- Save and edit product passports with brand, model, category, seller, serial number, purchase date, and warranty end date; remove products when linked claims, documents, watches, or reminders would not be lost.
- Create and update manual price watches tied to a saved product. ClaimForge does not fetch retailer pages or scrape prices.
- Schedule in-app replenishment reminders for a saved product using a user-entered usage estimate. Reminder records are stored at 9:00 AM Asia/Kolkata and shown in the reminder timeline; no background or email notification is sent.
- Open a product-specific timeline that combines its saved purchase and warranty dates, claim intake records, manual price-watch updates, and in-app reminders.
- Attach invoices, warranty terms, and manuals to a product passport in the private `claim-documents` bucket. The document API returns owner-scoped metadata and issues 60-second signed download links on demand; file bytes and public URLs are not passed to n8n.
- Submit claim intake with private Supabase Storage uploads and idempotent claim creation. Claim processing is only acknowledged when an n8n endpoint is configured; the current production workflow is inactive and does not return an assessment.
- The protected approval API can persist an exact customer-edited draft for an owned claim only after processing marks it ready for review. It stores the content fingerprint and idempotency key as `draft_only`; it never sends or queues a message.
- Processed claim results can be received through a constant-time authenticated n8n callback, atomically stored with deduplicated workflow events, and shown with document/page citations in My Claims. The callback migration is applied to `bankai`, but no workflow currently sends this result.
- Keep the sample claim review and overview clearly fictional. Sample evidence and approval state are not persisted or sent.

## Local document assistant implementation

The local code now includes a read-only document Q&A path. A signed-in user selects an owned product and its indexed documents; the answer route rechecks ownership, searches only the selected documents, and resolves model-proposed citation IDs against the retrieved rows before returning document/page/section metadata. No-evidence results abstain, and a model-reported conflict is converted to a non-decisive response. The UI distinguishes document facts, user facts, inferences, uncertainty, and source excerpts. Questions and selected excerpts are sent to the configured Groq chat model; the UI discloses this before use.

The local ingestion route supports native-text PDFs using `pdfjs-dist`, stores page-aware chunks and index versions, and marks image-only, scanned, unreadable, or incomplete files `needs_review`. OCR is not configured. Retrieval is PostgreSQL English full-text search, not vector or hybrid search; paraphrase recall is limited. Conflict detection depends on the model identifying conflicting passages and is not a guarantee. Chat history is not persisted.

The local document-processing status API is `GET`/`POST /api/products/[id]/documents/[documentId]/processing`. It returns only allowlisted ingestion/job state; reprocessing requests are owner-checked and idempotent, and report `dispatchStatus: "pending"` until a worker dispatches them. Creating a job does not change document ingestion state or start extraction. This route depends on the local-only `20261023000000_rag_embeddings_and_processing_jobs.sql` migration, which has not been applied to Supabase. Queue dispatch and the worker are not implemented by this API.

This code requires the additive migration `supabase/migrations/20261022150000_document_grounded_assistant.sql`, which has **not** been applied to the live Supabase project. No live Supabase or Groq request has verified this path. The endpoint expects server-only `GROQ_API_KEY` and `GROQ_MODEL` settings; model compatibility and provider behavior still need synthetic integration verification. Indexing currently runs synchronously in the request and is a local MVP path, not a durable production job. n8n remains inactive and is not used by chat or indexing.

## Data boundaries

Product, price-watch, reminder, document, and claim APIs require a verified Supabase user session. They use the publishable key with the user's session and apply owner filters; Postgres RLS is the second boundary. Product documents remain private in Supabase Storage and signed download links expire after 60 seconds. Request bodies are bounded and validated. n8n credentials and provider keys stay server-side. See [`docs/n8n-integration.md`](../../docs/n8n-integration.md) for the current workflow state.

The existing migrations create the owner-scoped tables and private `claim-documents` bucket. They were applied to the selected `bankai` project and verified in the dashboard. Do not reset or overwrite the database.

## Not connected yet

- Live RAG enablement and integration verification: the new schema migration is local only; no live migration, Supabase retrieval, or Groq call has been performed. OCR, vector embeddings, and hybrid retrieval are not implemented.
- Automated retailer price checks; manual price updates are the working path.
- Background reminder delivery; scheduled reminders are currently an in-app list.
- The sample approval screen remains demo-only until a real processed claim and editable evidence-linked draft are available. Although the protected draft-only approval API is implemented, no claim currently reaches `ready_for_review`; external sending is disabled.

These states are shown honestly in the UI. Do not label an n8n acknowledgement as a completed assessment.

## Configure and run

Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the selected project. Keep `.env.local` out of version control. The local `.env.local` contains the Supabase and Groq variable names used by the app, but provider credentials/model compatibility have not been live-tested. The production n8n webhook URL and callback secret remain blank. The workflow is inactive and acknowledgement-only.

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>.

## Verification

```powershell
npm test
npm run lint
npm run build
```

Tests exercise the Next.js API and UI seams with synthetic data and mocked Supabase/Groq boundaries. They do not make live Supabase mutations or prove live Groq behavior, OCR, vector retrieval, n8n, email, or retailer integrations.
