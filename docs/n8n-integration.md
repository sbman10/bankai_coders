# ClaimForge app, Supabase, and n8n integration

## Current first-MVP path

`Browser → Next.js route → Supabase Auth/RLS → private Supabase Storage + Postgres → n8n Webhook`

The web app uses Supabase Auth sessions through `@supabase/ssr`. Private files upload from the signed-in browser directly to the non-public `claim-documents` bucket, where Storage policies restrict paths to the authenticated user's ID. The app sends claim metadata to `POST /api/claims`; the route authenticates the session, validates fields and storage paths, downloads each referenced private file through the user's session to verify its byte count and PDF/JPEG/PNG signature, and calls the `create_claim_intake` RPC only after verification. That database function atomically creates the product, document metadata, and claim, and reuses a user's idempotency key for retry safety. `GET /api/claims` reads only that user's rows through RLS.

The account's other ownership features also use server routes with the signed-in session and owner-scoped RLS: `/api/products` and `/api/products/[id]` manage product records; `/api/price-watches` and `/api/price-watches/[id]` save manual price observations; `/api/reminders` and `/api/reminders/[id]` schedule or cancel in-app reminders. Product deletion is rejected when it would cascade through linked claim, document, price-watch, or reminder records. Price-watch links are stored only; ClaimForge does not fetch those URLs. Reminder records use a 9:00 AM Asia/Kolkata time and are visible in the app; no background or email notification is configured.

`POST /api/claims/[id]/approval` records an authenticated customer's exact edited draft only after a trusted workflow has set the owned claim to `ready_for_review` and populated `claim_draft`. It stores a SHA-256 content fingerprint and a UUID idempotency key, and marks the record `draft_only`. It never sends or queues an external message. The new additive approval-gate migration also prevents browser clients from setting later action states such as `sent`; only a future trusted server-side integration may do that. Until claim processing is connected, the interactive approval shown in the sample review remains sample-only.

When configured, the Next.js server sends only `eventId`, `eventType`, `claimId`, and `productId` to the n8n webhook. It does not send document binaries, document text, signed/public URLs, or contact details. The authentication header is `x-claimforge-secret`; the value belongs in n8n Header Auth and `apps/web/.env.local` as `N8N_WEBHOOK_AUTH_TOKEN`.

## Supplied workflow export and compatibility

The supplied `ClaimForge — Product Ownership Assistant` export was inspected. It starts from an n8n Form Trigger, routes among product passport, warranty claim, reminder, price watch, and product deletion flows, and stores state in n8n Data Tables and uploaded files in Google Drive. It uses OpenAI model nodes (configured for `gpt-5.4`) for image transcription and structured extraction/drafting. It includes deterministic warranty-date checks, a human review form and explicit approval gate before the email node, plus a 9:00 AM Asia/Kolkata scheduled branch. Price checking and notification branches contain setup-required configuration. The workflow is inactive and remains unchanged.

That export is not a web-app API contract: it has no webhook entry point for the Next.js app, and its data and file stores differ from the app's Supabase records and private bucket. The app must not call its form URL or present its n8n Data Table records as Supabase-backed data. It also does not meet the requested Groq model choice. A compatible app workflow needs an authenticated webhook, Groq credentials/model configuration, short-lived private document access that is excluded from execution data, and a callback to this app. Price and reminder scheduled branches must use the app's user-owned records and a supported provider before being represented as active.

## Processing callback contract (implemented)

The server callback is `POST /api/integrations/n8n/callback`. It accepts JSON with `eventId` (UUIDv4), `claimId` (UUIDv4), `status` (`processing`, `needs_information`, `ready_for_review`, or `needs_human_help`), `assessment` (one of the three cautious labels), `claimDraft` (required for `ready_for_review`), and up to 12 `evidence` items. Each evidence item has `kind` (`fact`, `warranty_clause`, `missing_item`, or `inference`), `content`, optional `sourcePage`, optional `confidence`, and optional `documentId`. Send `x-claimforge-callback-secret`; store its value only in n8n and `N8N_CALLBACK_SECRET` on the server. Do not include document text in execution metadata or callback logs.

The route validates the shared secret in constant time and calls the atomic `apply_claim_processing_result` database function. That function locks the claim row, checks referenced documents belong to the same user and product, records a deduplicated event without document contents, stores evidence, and updates only processing/review fields. It cannot mark a claim approved or sent. The additive migration `supabase/migrations/20261022130000_n8n_claim_result_callback.sql` was applied to the verified `bankai` project and the RPC was confirmed present. The My Claims screen reads the result through owner-scoped RLS, displays evidence and page references, and permits editing/copying a draft. Approval stores the exact text as `draft_only`; no send integration exists.

## Verified Supabase project

- The selected existing project is `bankai` (`jjtwjpprnzeokesnulnz`, Tokyo).
- Before applying the schema, the ten ClaimForge public tables were absent.
- The migration `supabase/migrations/20261019213317_claimforge_core.sql` was applied through that project's SQL editor. All ten public tables were verified afterward.
- The migration defines owner-scoped RLS policies, a private 10 MB PDF/JPG/PNG bucket, the keyword search function, and the idempotent claim-intake RPC.
- The additive hardening migration `supabase/migrations/20261020101500_claim_intake_hardening.sql` is applied. Authenticated users can read their own claims and submit only new `received` claims; direct claim status, assessment, or draft updates/deletes are denied. The intake RPC handles simultaneous retries safely.
- Claim/auth JSON bodies are capped at 16 KB and 2 KB. Claim dates, generated private-storage paths, uploaded byte counts, and PDF/JPEG/PNG signatures are validated on the server. Duplicate claim retries do not dispatch a second n8n event.
- Approval requests are capped at 12 KB, require an owned claim with a reviewable processed draft, and are idempotent by both approval key and content fingerprint. A saved approval is draft-only; the app does not expose a send action.
- The processing callback migration `20261022130000_n8n_claim_result_callback.sql` is applied to the verified `bankai` project. The callback can save results only when its server secret is configured and the app is reachable by n8n.
- `apps/web/.env.local` has the browser-safe project URL and publishable key. It is ignored by the project's `.gitignore`; never commit it.
- General user operations use the signed-in Supabase session and RLS. `SUPABASE_SECRET_KEY` is configured locally and used only by the isolated server callback RPC.

## Current n8n workflow state

The separate `claimforge app api` workflow is `VhmDra9QWmtcokXe`:

- `POST claimforge/intake` Webhook → Respond to Webhook.
- Header Auth credential `Header Auth account` is assigned to the Webhook, which expects `x-claimforge-secret`. The local `N8N_WEBHOOK_AUTH_TOKEN` is set, but the credential value could not be independently compared or live-tested while the workflow is inactive.
- The response is an HTTP 202 acknowledgement only. It does not extract documents, update claim status, or create an assessment.
- The workflow is inactive. `N8N_CLAIM_INTAKE_WEBHOOK_URL` remains blank locally because the app is not deployed and n8n Cloud cannot call a local callback endpoint. Do not activate this acknowledgement-only workflow or report claims as processed.
- The `ClaimForge — Product Ownership Assistant` workflow remains unchanged.

## Safe activation checklist

1. Deploy the app to a trusted HTTPS origin so n8n can reach its server-side processing endpoint; deployment is not authorized in this task.
2. Configure a separate callback secret in the app and n8n. Do not reuse the app-to-n8n Header Auth secret.
3. Replace the acknowledgement-only response with a tested, idempotent processing path. Keep private document bytes and extracted text out of n8n execution data; send only minimum identifiers and final safe processing results.
4. Validate the webhook and callback contracts with synthetic data.
5. Keep claim submission and any external message behind the user's explicit approval. This intake workflow does not send email or contact a manufacturer.
6. Activate the production webhook only after those checks. Then set its Production URL in `N8N_CLAIM_INTAKE_WEBHOOK_URL`.

## Environment variables

Copy `.env.example` to `.env.local` for local development. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-facing project configuration values; RLS is the data boundary. Keep all n8n tokens, provider keys, and any future callback secret server-side. Never paste a secret into source code, public slides, screenshots, or chat.

| Variable | Purpose | Current use |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Configured locally |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public project key used with RLS | Configured locally |
| `SUPABASE_SECRET_KEY` | Server-only key for the isolated n8n result callback | Configured locally; never expose to browser code |
| `N8N_CLAIM_INTAKE_WEBHOOK_URL` | Active n8n Production URL | Blank while workflow is inactive |
| `N8N_WEBHOOK_AUTH_TOKEN` | Header Auth secret for the app-to-n8n request | Configured locally; credential is assigned in n8n |
| `N8N_CALLBACK_SECRET` | Authenticates n8n-to-app processing callbacks | Blank locally; configure after an HTTPS app URL is available |
| `GROQ_API_KEY`, `GROQ_MODEL` | Reserved for future processing | Configured locally; no verified processing path uses them yet |

## Current handoff state

The database callback foundation, Next.js callback route, local server credentials, and n8n Header Auth assignment are in place. The credential value has not been live-tested. The n8n workflow remains inactive and acknowledgement-only. The remaining external prerequisite is a reachable HTTPS deployment; then configure a distinct callback secret, build and verify the document-processing path, and activate the workflow. No deployment or real-document test has been performed.

## RAG ingestion callback — future integration only

The local document assistant does not call n8n. Its current PDF indexing endpoint runs synchronously in the app process and reads the private object only after the signed-in user and owned document have been checked. The additive RAG migration is local and has not been applied to the live project. There is no RAG job-start webhook or RAG callback route.

If asynchronous ingestion is added later, agree on its public contract before changing any workflow. The proposed boundary is an authenticated, idempotent job request and callback carrying document/job identifiers, event identity, state, and safe warning codes only. Do not put file bytes, OCR text, extracted chunks, prompts, user contact details, signed URLs, or provider secrets in webhook payloads or n8n execution data. n8n must not be a dependency of the local chat-answer path. The existing `claimforge app api` workflow remains inactive; the original `ClaimForge — Product Ownership Assistant` workflow remains unchanged.
