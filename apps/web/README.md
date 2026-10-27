# ProductVault web MVP

Next.js App Router app for managing products and warranty claims. It contains both the frontend and the backend API routes; there is no separate Uvicorn server in this architecture.

## Frontend and backend layout

- Frontend pages and interactive components live in `src/app` and `src/components`.
- Backend HTTP endpoints live in `src/app/api`. They run inside the same Next.js server and handle auth, products, claims, documents, reminders, price watches, the assistant, and integrations.
- Shared server-side Supabase and business logic lives in `src/lib`. Browser code never receives a service-role key.
- For local work, start one server from `apps/web`; it serves both the page and its `/api/...` endpoints. Do not start Uvicorn for this Next.js app.
- When Supabase is configured, the app shows email OTP / Google sign-in before opening the account workspace. If Supabase is not configured, the app falls back to the fictional preview. Sample claim information remains fictional and is not submitted.

## Account-backed API behavior

- Sign in with a six-digit email code or Google; the Next.js callback and Supabase SSR cookies create the session. The auth status endpoint treats a missing session as signed out, not as a service outage. Sign out clears the current browser session.
- Save and edit product passports with brand, model, category, seller, serial number, purchase date, and warranty end date; remove products when linked claims, documents, watches, or reminders would not be lost.
- Create and update manual price watches tied to a saved product. ProductVault does not fetch retailer pages or scrape prices.
- Schedule in-app replenishment reminders for a saved product using a user-entered usage estimate. Reminder records are stored at 9:00 AM Asia/Kolkata and shown in the reminder timeline; no background or email notification is sent.
- Open a product-specific timeline that combines its saved purchase and warranty dates, claim intake records, manual price-watch updates, and in-app reminders.
- Attach invoices, warranty terms, and manuals to a product passport in the private `claim-documents` bucket. The document API returns owner-scoped metadata and issues 60-second signed download links on demand; file bytes and public URLs are not passed to n8n.
- Submit claim intake with private Supabase Storage uploads, server-side file-signature checks, and an idempotent claim/outbox RPC. The local app processor performs bounded OCR, sends extracted text to the configured Groq service, validates source quotes, and saves a review draft; the outbox migration and n8n credential are still pending, so live processing is not verified.
- The protected approval API can persist an exact customer-edited draft for an owned claim only after processing marks it ready for review. It stores the content fingerprint and idempotency key as `draft_only`; it never sends or queues a message.
- The protected `POST /api/integrations/n8n/process` route accepts only an event ID and claim ID, requires a separate server-to-server secret, and reads claim documents through trusted server-side Supabase access. It does not trust browser-supplied owners or storage paths. Claim review results are stored through the atomic result RPC and shown through owner-scoped claim reads.
- If the app-to-n8n handoff is pending, the signed-in owner can retry it through `POST /api/claims/[id]/dispatch`; RLS scopes the event lookup, and the database lease prevents duplicate delivery while already sent or in flight.
- Keep the sample claim review and overview clearly fictional. Sample evidence and approval state are not persisted or sent.

## Local document assistant implementation

The local code includes a read-only document Q&A path intended for a signed-in user with owned products and indexed documents. The answer route rechecks ownership, embeds the question through the `embed-text` Edge Function, calls the owner-scoped vector search RPC for only the selected documents, and resolves model-proposed citation IDs against retrieved rows before returning document/page/section metadata. No-evidence results abstain, and a model-reported conflict is converted to a non-decisive response. The assistant UI is not exposed in the current public demo: its navigation item shows a notice instead of calling private APIs. These vector paths are local code only and have not been verified against Supabase.

The local ingestion route supports native-text PDFs using `pdfjs-dist`, stores page-aware chunks and index versions, and marks image-only, scanned, unreadable, or incomplete files `needs_review`. OCR is not configured. The answer API now has a semantic vector-search path in local code; hybrid ranking is not implemented. Existing indexing remains synchronous and does not yet generate/store vectors, so the vector path requires the local embedding/processing worker and schema to be integrated before it can return indexed evidence. No vector match threshold has been calibrated; similarity is not proof of coverage. Conflict detection depends on the model identifying conflicting passages and is not a guarantee. Chat history is not persisted.

The local document-processing status API is `GET`/`POST /api/products/[id]/documents/[documentId]/processing`. It returns only allowlisted ingestion/job state; reprocessing requests are owner-checked and idempotent, and report `dispatchStatus: "pending"` until a worker dispatches them. Creating a job does not change document ingestion state or start extraction. This route depends on the local-only `20261023000000_rag_embeddings_and_processing_jobs.sql` migration, which has not been applied to Supabase. Queue dispatch and the worker are not implemented by this API.

This code requires the additive migration `supabase/migrations/20261022150000_document_grounded_assistant.sql`, which has **not** been applied to the live Supabase project. No live Supabase or Groq request has verified this path. The endpoint expects server-only `GROQ_API_KEY` and `GROQ_MODEL` settings; model compatibility and provider behavior still need synthetic integration verification. Indexing currently runs synchronously in the request and is a local MVP path, not a durable production job. n8n remains inactive and is not used by chat or indexing.

## Data boundaries

Account-backed API routes require a verified Supabase user session, use the publishable key with the user's session, and apply owner filters; Postgres RLS is the second boundary. Product documents remain private in Supabase Storage and signed download links expire after 60 seconds. Request bodies are bounded and validated. n8n credentials and provider keys stay server-side. See [`docs/n8n-integration.md`](../../docs/n8n-integration.md) for the current workflow state.

The existing migrations create the owner-scoped tables and private `claim-documents` bucket. They were applied to the selected `bankai` project and verified in the dashboard. Do not reset or overwrite the database.

## Not connected yet

- Live RAG enablement and integration verification: vector-search schema is local only; no live migration, Supabase retrieval, Edge Function call, or Groq call has been performed. OCR, actual vector generation/storage integration, and hybrid retrieval are not connected.
- Automated retailer price checks; manual price updates are the working path.
- Background reminder delivery; scheduled reminders are currently an in-app list.
- The sample approval screen remains demo-only until a real processed claim and editable evidence-linked draft are available. Although the protected draft-only approval API is implemented, no claim currently reaches `ready_for_review`; external sending is disabled.

These states are shown honestly in the UI. Do not label an n8n acknowledgement as a completed assessment.

## Configure and run

For account sign-in locally, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_BASE_URL` in `.env.local`; keep that file out of version control. Email delivery and Google OAuth also need the provider setup described in [`docs/auth-provider-setup.md`](../../docs/auth-provider-setup.md). The public preview can still run without Supabase, Groq, or n8n configuration.

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>.

This single command runs the frontend and API together. If Next.js reports that port 3000 is already in use, use the alternate local URL printed by the dev server or stop the other Next.js instance first.

## Verification

```powershell
npm test
npm run lint
npm run build
```

Tests exercise the Next.js API and UI seams with synthetic data and mocked Supabase/Groq boundaries. They do not make live Supabase mutations or prove live Groq behavior, OCR, vector retrieval, n8n, email, or retailer integrations.
