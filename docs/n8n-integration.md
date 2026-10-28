# ProductVault app, Supabase, and n8n integration

## Current first-MVP path

`Browser → private Supabase Storage → Next.js claim API → Supabase claim/outbox → authenticated n8n Webhook → protected app processor → Supabase claim result`

The web app uses Supabase Auth sessions through `@supabase/ssr`. Claim files upload from the signed-in browser directly to the non-public `claim-documents` bucket, where Storage policies restrict paths to the authenticated user's ID. The app sends claim metadata and file references to `POST /api/claims`; the route authenticates the session, validates fields and storage paths, downloads each referenced private file through the user's session to verify its byte count and PDF/JPEG/PNG signature, and invokes the `create_claim_intake_with_event` RPC. That additive RPC atomically creates the product, document metadata, claim, and unique workflow event, reusing a user's idempotency key on retry. If this new RPC is not installed, the route falls back to the existing claim RPC and reports `migration_required` instead of falsely reporting automation success. A pending handoff can be retried by the signed-in owner through `POST /api/claims/[id]/dispatch`; RLS scopes its event lookup, and the dispatch lease avoids duplicate delivery while an event is already sent or in flight. `GET /api/claims` reads only that user's rows through RLS.

The account's other ownership features use the signed-in session and owner-scoped RLS: `/api/products` and `/api/products/[id]` manage product records; `/api/price-watches` and `/api/price-watches/[id]` manage watches; `/api/reminders` and `/api/reminders/[id]` manage scheduled reminders; `/api/notifications` and `/api/notifications/[id]` provide the in-app inbox; `/api/notification-preferences` manages optional email opt-in. A local, additive migration draft extends reminders, creates notification and delivery outbox tables, and adds idempotent price-check jobs and observation functions. It has not been applied to `bankai` or validated against a database.

## Reminders and price checks — local implementation draft

The local code supports reminder types for warranty expiry, policy expiry, service/maintenance, replenishment, and claim follow-up. Warranty and policy expiry requests schedule 30-day and 7-day in-app reminders at 9:00 AM Asia/Kolkata. The daily server endpoint also creates automatic 30/7-day reminders from a product's warranty end date and cancels stale generated reminders when that date changes. User-created schedules can be edited by rescheduling, snoozed, completed, or cancelled. The header inbox reads durable notifications from Supabase and marks an item read before opening its same-site dashboard destination.

Price watches support manual entry and optional daily checks for links matched by the merged retailer adapters. A protected endpoint claims a bounded batch, runs a forced refresh through the existing scraper, and records an observation only when the retailer link is allowlisted, the offer is in stock, and the scraper confidence meets the configured threshold. A failed or ambiguous result becomes a safe status code; it does not replace a verified price. Manual entries are kept as separate observations and do not overwrite a verified automated price. Scraper checks require `FIRECRAWL_API_KEY`; provider quotas/costs and retailer terms must be reviewed before real use.

`POST /api/integrations/n8n/reminders` is the proposed scheduled entry point. It requires `N8N_REMINDERS_SECRET` in the `x-productvault-scheduler-secret` header, calls service-role-only database routines, and returns aggregate counts only. n8n receives no user identifiers, product links, reminder text, email addresses, or document content. The endpoint sends optional reminder email from the server through Postmark only for users who enabled it. Email delivery uses a durable outbox; ambiguous timeouts become `unknown` and are not blindly resent. Configure `POSTMARK_SERVER_TOKEN` and `POSTMARK_FROM_EMAIL` only after the sender is verified. In-app notifications do not depend on Postmark.

The n8n workflow `ProductVault Reminders & Price Checks` is intended to run once daily at 9:00 AM Asia/Kolkata and call the protected app endpoint. Keep it inactive until the migration is reviewed/applied, the current public HTTPS app URL is confirmed, matching n8n Header Auth and app secrets are configured, and synthetic retry/authorization checks pass. No workflow activation, live database migration, production retailer request, or real customer email has occurred as part of this local implementation.

`POST /api/claims/[id]/approval` records an authenticated customer's exact edited draft only after a trusted workflow has set the owned claim to `ready_for_review` and populated `claim_draft`. It stores a SHA-256 content fingerprint and a UUID idempotency key, and marks the record `draft_only`. It never sends or queues an external message. The new additive approval-gate migration also prevents browser clients from setting later action states such as `sent`; only a future trusted server-side integration may do that. Until claim processing is connected, the interactive approval shown in the sample review remains sample-only.

When configured, the Next.js server sends only `eventId`, `eventType`, `claimId`, and `productId` to the n8n webhook. It does not send document binaries, document text, signed/public URLs, or contact details. The authentication header is `x-claimforge-secret`; its value belongs in the inbound n8n Header Auth credential and `apps/web/.env.local` as `N8N_WEBHOOK_AUTH_TOKEN`.

After the 202 acknowledgement, the workflow calls `POST /api/integrations/n8n/process` with only `eventId` and `claimId`, authenticated by a separate n8n templated custom-auth credential that sends `x-claimforge-callback-secret`. The app validates the secret in constant time, leases the event through a service-role-only RPC, then loads the claim, product, and same-owner private documents from Supabase. It extracts native PDF text, applies bounded OCR to unreadable pages/images, and sends bounded extracted text plus the user-reported fault to the existing server-side Groq configuration. It validates the structured result, checks each evidence quote against trusted extracted text, and stores verified evidence/page references and the editable draft through the existing result RPC. OCR text and prompts never enter n8n. No approval or external sending occurs automatically.

## Supplied workflow export and compatibility

The supplied `ClaimForge — Product Ownership Assistant` export was inspected. It starts from an n8n Form Trigger, routes among product passport, warranty claim, reminder, price watch, and product deletion flows, and stores state in n8n Data Tables and uploaded files in Google Drive. It uses OpenAI model nodes (configured for `gpt-5.4`) for image transcription and structured extraction/drafting. It includes deterministic warranty-date checks, a human review form and explicit approval gate before the email node, plus a 9:00 AM Asia/Kolkata scheduled branch. Price checking and notification branches contain setup-required configuration. The workflow is inactive and remains unchanged.

That export is not a web-app API contract: it has no webhook entry point for the Next.js app, and its data and file stores differ from the app's Supabase records and private bucket. The app must not call its form URL or present its n8n Data Table records as Supabase-backed data. The current app workflow uses an authenticated webhook and an ID-only request to the app's private processor; Groq and document extraction stay in the app. Price and reminder scheduled branches remain separate and inactive.

## Legacy result callback contract

The server callback is `POST /api/integrations/n8n/callback`. It accepts JSON with `eventId` (UUIDv4), `claimId` (UUIDv4), `status` (`processing`, `needs_information`, `ready_for_review`, or `needs_human_help`), `assessment` (one of the three cautious labels), `claimDraft` (required for `ready_for_review`), and up to 12 `evidence` items. Each evidence item has `kind` (`fact`, `warranty_clause`, `missing_item`, or `inference`), `content`, optional `sourcePage`, optional `confidence`, and optional `documentId`. Send `x-claimforge-callback-secret`; store its value only in n8n and `N8N_CALLBACK_SECRET` on the server. Do not include document text in execution metadata or callback logs.

This route remains available for the previous callback contract, but the updated ProductVault workflow does not call it; the protected processor persists its result directly so document-derived result text does not pass back through n8n. The route validates the shared secret in constant time and calls the atomic `apply_claim_processing_result` database function. That function locks the claim row, checks referenced documents belong to the same user and product, deduplicates result events, and updates only processing/review fields. It cannot mark a claim approved or sent.

## Verified Supabase project

- The selected existing project is `bankai` (`jjtwjpprnzeokesnulnz`, Tokyo).
- Before applying the schema, the ten ProductVault public tables were absent.
- The migration `supabase/migrations/20261019213317_claimforge_core.sql` was applied through that project's SQL editor. All ten public tables were verified afterward.
- The migration defines owner-scoped RLS policies, a private 10 MB PDF/JPG/PNG bucket, the keyword search function, and the idempotent claim-intake RPC.
- The additive hardening migration `supabase/migrations/20261020101500_claim_intake_hardening.sql` is applied. Authenticated users can read their own claims and submit only new `received` claims; direct claim status, assessment, or draft updates/deletes are denied. The intake RPC handles simultaneous retries safely.
- Claim/auth JSON bodies are capped at 16 KB and 2 KB. Claim dates, generated private-storage paths, uploaded byte counts, and PDF/JPEG/PNG signatures are validated on the server. Duplicate claim retries do not dispatch a second n8n event.
- Approval requests are capped at 12 KB, require an owned claim with a reviewable processed draft, and are idempotent by both approval key and content fingerprint. A saved approval is draft-only; the app does not expose a send action.
- The processing callback migration `20261022130000_n8n_claim_result_callback.sql` is applied to the verified `bankai` project. The callback can save results only when its server secret is configured and the app is reachable by n8n.
- `supabase/migrations/20261027120000_claim_intake_n8n_outbox.sql` is a local draft only; it has not been applied to `bankai` or verified against a database.
- `apps/web/.env.local` has the browser-safe project URL and publishable key. It is ignored by the project's `.gitignore`; never commit it.
- General user operations use the signed-in Supabase session and RLS. `SUPABASE_SECRET_KEY` is configured locally and used only by the isolated server callback RPC.

## Current n8n workflow state

The workflow `ProductVault App API` is `VhmDra9QWmtcokXe`:

- `POST productvault/intake` Webhook → HTTP 202 response and protected app-side processor request.
- The existing inbound `Header Auth account` is assigned to the Webhook and expects `x-claimforge-secret`.
- The processing node is configured for a separate templated custom-auth credential using `x-claimforge-callback-secret`, but no such credential is available through the connected MCP. It must be created manually in n8n and assigned to the node.
- The processing node currently points to the previously used ngrok host `https://regress-outer-ambiance.ngrok-free.dev`; no app server or ngrok process is running in this environment, so the current host/port and reachability are unverified.
- The workflow remains inactive. `N8N_CLAIM_INTAKE_WEBHOOK_URL` remains blank locally, and `N8N_CALLBACK_SECRET` must be configured locally to match the separate n8n credential. The workflow has not been executed end-to-end.
- The `ClaimForge — Product Ownership Assistant` workflow remains unchanged.

## Safe activation checklist

1. Review and apply the additive outbox migration to the verified `bankai` project after confirming migration history. Do not reset or bulk-push migrations.
2. Create a new n8n templated custom-auth credential with header `x-claimforge-callback-secret`; use a value distinct from the inbound app-to-n8n secret and store the same value in `N8N_CALLBACK_SECRET` locally.
3. Verify the current local app port and ngrok host, then update the HTTP Request URL if the host differs. Keep the workflow inactive during setup.
4. Test while the n8n Test URL is listening. Use synthetic claims for valid, invalid, unauthorized, duplicate, and retry cases; confirm only IDs and safe statuses appear in execution data.
5. Keep claim submission and external communication behind explicit user approval. This workflow does not send email or contact a manufacturer.
6. Activate the production webhook only after those checks and explicit user approval. Then set its Production URL in `N8N_CLAIM_INTAKE_WEBHOOK_URL`.

## Environment variables

Copy `.env.example` to `.env.local` for local development. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-facing project configuration values; RLS is the data boundary. Keep all n8n tokens, provider keys, and any future callback secret server-side. Never paste a secret into source code, public slides, screenshots, or chat.

| Variable | Purpose | Current use |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Configured locally |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public project key used with RLS | Configured locally |
| `SUPABASE_SECRET_KEY` | Server-only key for trusted claim processing and result writes | Configured locally; never expose to browser code |
| `N8N_CLAIM_INTAKE_WEBHOOK_URL` | Active n8n Production URL | Blank while workflow is inactive |
| `N8N_WEBHOOK_AUTH_TOKEN` | Header Auth secret for the app-to-n8n request | Configured locally; credential is assigned in n8n |
| `N8N_CALLBACK_SECRET` | Authenticates n8n-to-app processing requests | Blank locally; set to the value stored in the separate n8n credential |
| `GROQ_API_KEY`, `GROQ_MODEL` | Server-side claim review and document assistant model | Configured locally; document-to-Groq processing has not been live-tested |
| `N8N_REMINDERS_SECRET` | Protects the scheduled n8n-to-app reminders endpoint | Required before workflow setup; keep server-side |
| `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL` | Optional opt-in reminder email delivery | Not configured here; configure after sender verification |
| `FIRECRAWL_API_KEY` | Existing scraper request credential used for scheduled price checks | Required for automated checks; usage/cost and retailer terms need review |

## Current handoff state

The authenticated claim upload path and protected app-side processing code are in place locally. The n8n workflow has the new processing branch and remains inactive. The live bankai outbox migration is unapplied; the outbound n8n credential and matching local secret are not configured; and no synthetic end-to-end execution has been run. No deployment or real-customer document test has been performed.

## RAG ingestion callback — future integration only

The local document assistant does not call n8n. Its current PDF indexing endpoint runs synchronously in the app process and reads the private object only after the signed-in user and owned document have been checked. The additive RAG migration is local and has not been applied to the live project. There is no RAG job-start webhook or RAG callback route.

If asynchronous ingestion is added later, agree on its public contract before changing any workflow. The proposed boundary is an authenticated, idempotent job request and callback carrying document/job identifiers, event identity, state, and safe warning codes only. Do not put file bytes, OCR text, extracted chunks, prompts, user contact details, signed URLs, or provider secrets in webhook payloads or n8n execution data. n8n must not be a dependency of the local chat-answer path. The `ProductVault App API` claim workflow remains inactive; the original `ClaimForge — Product Ownership Assistant` workflow remains unchanged.
