# Implementation Plan: ProductVault n8n Integration

## Overview

Connect the existing authenticated ProductVault claim-intake path to n8n on `main`, then prove the complete request and result path with synthetic data through the current ngrok HTTPS tunnel. Supabase remains the durable source of truth; Next.js remains the security and document-processing boundary; n8n orchestrates approved events. The first deliverable is claim intake and processing status. RAG answering/indexing, document bytes, OCR text, and embeddings stay out of n8n's critical path.

## Implementation status (2026-10-27)

- The user approved the claim event, processing, idempotency, ownership, and human-approval behavior seams, and approved the existing Groq setup for extracted invoice/warranty text. This plan is now being implemented locally on `main`.
- `POST /api/claims` now calls the additive `create_claim_intake_with_event` RPC, which atomically creates the claim and outbox event. It leases and dispatches only `eventId`, `eventType`, `claimId`, and `productId`; errors leave a pending status and do not invalidate a saved claim. If the migration is absent, the legacy claim RPC remains available and the response says `migration_required`.
- A protected `POST /api/integrations/n8n/process` accepts only event and claim UUIDs and a separate server secret. The app loads same-owner claim documents from private storage, applies bounded native PDF extraction/OCR, sends extracted text to Groq, verifies evidence quotes against source text, and writes only a reviewable result. It never approves or sends a claim.
- Local draft migration: `supabase/migrations/20261027120000_claim_intake_n8n_outbox.sql`. It adds event dispatch/processing state and service-role-only lease/finalize functions. It has not been applied to or parsed against the live `bankai` database.
- n8n workflow `ProductVault App API` (`VhmDra9QWmtcokXe`) now has the authenticated `POST productvault/intake` trigger, immediate 202 acknowledgement, and an IDs-only request to the protected app processor. It remains inactive. The separate `ClaimForge — Product Ownership Assistant` workflow remains unchanged.
- The local outbound n8n auth credential, callback secret, Production webhook URL, active ngrok/app origin, and live schema are not yet verified. No live synthetic end-to-end execution has run.
- RAG answering/indexing remains outside this claim workflow. No automated price checks, reminder delivery, email, or external claim submission is included.

## Recommended architecture

```mermaid
sequenceDiagram
    actor User
    participant Web as ProductVault UI
    participant API as Next.js API
    participant DB as Supabase Postgres + private Storage
    participant N8N as n8n Cloud
    participant Worker as Protected app-side processor

    User->>Web: Submit claim and private evidence
    Web->>API: POST /api/claims (session + idempotency key)
    API->>DB: Validate ownership/files; create claim + durable event
    API->>N8N: POST minimal event (IDs only, Header Auth)
    N8N-->>API: 202 accepted (dispatch acknowledgement only)
    N8N->>Worker: Protected request with eventId + claimId
    Worker->>DB: Read owned claim/files; process privately; persist result
    Web->>DB: Read owner-scoped claim/status/evidence
    User->>Web: Review/edit claim draft
    Web->>DB: Save explicit draft-only approval
```

The first implementation should preserve the current callback only if its final payload can be kept out of n8n execution data. The safer default is to have n8n pass identifiers to a protected Next.js processing endpoint; that endpoint reads private files and persists evidence/status directly in Supabase, while n8n sees only safe status codes. Do not send file bytes, OCR text, retrieved chunks, signed URLs, contact details, or secrets through n8n. Do not add Gemini or another model to n8n based on the attached research transcript; provider choice and data-residency approval remain separate decisions.

## Architecture decisions

1. **Supabase is authoritative.** n8n execution history is operator diagnostics only, never the user's claim/product/status record.
2. **Use the app's authenticated APIs for user actions.** The browser never receives n8n credentials and never calls n8n directly.
3. **Use a durable event/outbox before calling the webhook.** The current claim row can persist even if the immediate webhook call fails. Review `workflow_events` and existing RPCs first; add only the minimal additive schema/RPC needed to atomically record a claim event and safely retry dispatch. Never reset, overwrite, or bulk-push migrations.
4. **Separate dispatch acknowledgement from processing completion.** A 202 response means only “accepted”; the UI remains `received`/`processing` until Supabase records an allowed result.
5. **Keep sensitive processing inside the app boundary.** n8n orchestrates by opaque identifiers. A server-side route/service checks the secret, then independently loads the claim and same-owner documents before processing. No client-provided `userId` is an authority.
6. **Preserve human approval.** No external email, portal submission, complaint, purchase, or settlement action is added. The existing approval route remains draft-only.
7. **Keep this first slice narrow.** Claim intake only. Add reminder delivery as a later, separately approved workflow. Product price entries remain manual; RAG chat and document indexing do not call n8n.
8. **Keep workflows inactive until all gates pass.** Use the n8n Test URL while listening during development; use the Production URL only after publishing/activating a fully verified workflow. The original form workflow stays untouched.

## Phased implementation and acceptance criteria

### Phase 0 — Contract and environment preflight

- Review `PRD.md`, `docs/n8n-integration.md`, `workflows/warranty-claim-intake.md`, current API tests, migration history, and both n8n workflow definitions.
- Confirm the exact event and result contract, processing boundary, status transitions, retry policy, execution-data retention, and synthetic fixture. Keep the existing ID-only event unless a demonstrated requirement justifies a change.
- Check only whether required environment variables are present; never print or copy their values. Confirm the current ngrok origin and app port at implementation time rather than assuming the previous tunnel is still active.
- Agree behavioral seams before adding tests, as required by the repository TDD rules.

**Acceptance:** reviewed contract names the caller, payload, authentication, durable state, idempotency key, allowed statuses, timeout/retry behavior, and who may write results. No secret or customer document is used.

### Phase 1 — Make claim-event delivery durable

- Replace the best-effort “create claim, then POST webhook” gap with a durable outbox transition tied atomically to claim creation/idempotency. Inspect existing `workflow_events` first; do not create duplicate tables if an additive safe extension is sufficient.
- Add a bounded dispatcher/retry path that delivers only `eventId`, `eventType`, `claimId`, and `productId` to the authenticated n8n webhook. Use a stable event ID and persistent uniqueness; assume retries can duplicate delivery.
- Keep claim creation successful if n8n is temporarily unavailable; expose a truthful processing/dispatch state and a safe retry path.
- Add/adjust the status DTO only as needed so the UI distinguishes claim saved, dispatch pending, processing, review-ready, needs-information, human-help, and retryable failure.

**Acceptance:** one claim submission creates one durable event; retrying the same idempotency key does not create another claim or event; timeout/5xx preserves a retryable outbox row; no private content or token appears in the webhook request or app response.

### Checkpoint A — Review the event contract

- Confirm the outbox contract and status names with the user before implementing the n8n workflow or writing tests at a newly introduced seam.

### Phase 2 — Add the protected app-side processing boundary

- Implement a server-only endpoint/service callable by n8n with a dedicated secret distinct from app-to-n8n Header Auth. Use constant-time secret comparison, strict body/size validation, no-store responses, and no browser CORS dependency.
- Accept only opaque IDs and an event ID. Load the claim and its linked product/documents from trusted Supabase records; verify their relationships server-side. Do not trust a submitted owner ID or arbitrary storage path.
- Process files inside the app boundary using only already-approved extraction/retrieval/model providers. Keep uploaded bytes, extracted text, OCR output, chunks, prompts, and citation content out of n8n payloads and logs.
- Persist results through a narrow atomic database function or existing trusted RPC. Make repeated event delivery idempotent and reject invalid status transitions. Preserve prior valid results when a retry fails.
- Reconcile or revise the existing callback only if it remains necessary. Do not duplicate two authoritative write paths.

**Acceptance:** unauthenticated or malformed worker calls fail without database changes; cross-claim/document references fail; duplicate event IDs do not create duplicate evidence; allowed results appear through owner-scoped claim reads; no path can mark a claim approved/sent.

### Phase 3 — Build the n8n workflow (inactive draft)

- Modify only `claimforge app api` after reading its current version; preserve its workflow ID and unrelated settings. Keep the Product Ownership Assistant export unchanged.
- Workflow shape: authenticated POST Webhook → validate event schema → durable duplicate/idempotency check or trusted app job handoff → immediate 202 acknowledgement → protected app-side processing request → classify success/retryable/permanent failure → record only safe operational outcome.
- Keep retries bounded and safe. Do not rely on an in-workflow Set/Code node as cross-run idempotency; the durable event uniqueness and app state are authoritative.
- Add failure handling appropriate to the selected n8n Cloud plan. Do not silently add an Error Workflow or notification integration; choose that separately if failure notifications are desired.
- Configure workflow-level execution retention to minimize saved data and prune old executions. More importantly, keep sensitive payloads out of workflow items altogether; retention settings alone are not a privacy boundary.

**Acceptance:** exported/current workflow is structurally valid, authenticated, inactive, has no embedded credentials, no document/file nodes, no unapproved external-write node, and a clear 202 response contract. A 202 is never surfaced as “claim processed.”

### Phase 4 — Verify locally through ngrok with synthetic data

- Start the local app on its actual development port and confirm the currently active ngrok HTTPS URL forwards to that port. No computer-control UI is needed; use terminal/API requests.
- First test the n8n Test URL while **Listen for test event** is enabled. Submit a synthetic claim through the website/API; verify the minimal authenticated event is received and the app reports only acknowledgement/pending status.
- Verify n8n can reach the protected app-side endpoint through the ngrok origin; send one valid synthetic event, one invalid/unauthorized request, one duplicate event, one processing failure/retry, and one final review-ready result.
- Confirm the user-facing claim is read from Supabase, citations/evidence map to the submitted synthetic documents, and the explicit approval action remains draft-only.
- Inspect n8n execution data and application logs to confirm no file bytes, signed URLs, OCR text, prompts, secret values, or unnecessary personal data were captured.

**Acceptance:** the full synthetic path is observed in both directions; expected 401/400/idempotent outcomes are verified; Supabase shows the expected owner-scoped result; no external message is sent; ngrok reachability is stated as temporary test-only.

### Checkpoint B — Approval before activation

- Show the tested workflow, contract, logs/retention choices, and remaining limitations. Do not activate the production webhook until the user explicitly approves activation after reviewing this evidence.

### Phase 5 — Production readiness (separate from ngrok demo)

- Use a stable deployed HTTPS app origin; replace the temporary ngrok callback origin with the deployment URL and verify its route/auth protections.
- Set separate app→n8n and n8n→app secrets in server environment and n8n credentials. Rotate any exposed or reused secrets. Keep them out of Git, workflow JSON, browser code, logs, and chat.
- Verify migration history against the live `bankai` schema before applying any new migration. Apply only the reviewed additive migration; never reset or bulk-push.
- Run the same synthetic end-to-end cases against the production deployment, then request explicit activation approval. Only after activation should the app use the Production webhook URL.

**Acceptance:** production URL and credentials are verified without revealing values; workflow is active only after approval; a real end-to-end synthetic execution is observed; rollback/deactivation steps are documented.

### Phase 6 — Later automations, only after claim path is stable

- Consider an n8n Schedule Trigger for reminders only if notification scope/channel, user consent, opt-out, timezone, dedupe, retries, and delivery status are explicitly decided. MVP reminders are currently in-app only.
- Keep automated price scraping, pre-purchase web research, and rejection/appeal drafting out of this release. Each requires its own source, privacy, provider, accuracy, and approval plan.
- Keep RAG ingestion/answering on the authenticated app/Supabase path. Do not duplicate document OCR/chunking/embedding in n8n.

**Acceptance:** each later workflow gets an independent contract, user-approved test seams, synthetic test cases, and activation gate.

## Behavioral seams to confirm before TDD implementation

1. Authenticated claim submission stores the claim and creates exactly one durable event; same idempotency key returns the existing claim/event.
2. n8n receives only the four approved identifiers/event fields, protected by Header Auth; an acknowledgement means accepted, not processed.
3. The protected worker rejects wrong secrets, malformed payloads, invalid claim/document associations, and illegal status transitions without writes.
4. Repeated valid event delivery produces one durable result/evidence set; retryable failures remain retryable and never erase an earlier published result.
5. Claim status/results are read from Supabase under the signed-in owner; another user cannot read them.
6. No external claim communication occurs before explicit, recorded user approval; the current result remains draft-only.
7. ngrok verification uses synthetic documents/events only and does not trigger external email, claim portals, or purchase actions.

These are proposed seams, not tests already written. Confirm them before the implementation phase begins.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Claim persists but direct webhook call fails | Claim appears saved without processing | Durable outbox, bounded retries, explicit pending/error status |
| n8n retries after timeout | Duplicate processing or evidence | Stable event ID, database uniqueness, idempotent state transitions |
| Claim documents leak into workflow history | Sensitive personal data exposure | IDs-only orchestration; app-side private processing; minimal execution retention and pruning |
| 202 is mistaken for completed processing | Misleading user status | Distinct accepted vs processed state in API/UI |
| ngrok URL changes or laptop sleeps | Callback becomes unreachable | Verify tunnel at test time; treat as temporary demo transport only |
| OCR/model policy or region is not approved | Privacy/compliance risk | Keep processing provider as an explicit gate; no Gemini assumption from the attached draft |
| Live schema differs from migrations | Production schema damage | Reconcile migration history and inspect target before additive SQL; no reset/bulk push |
| n8n acknowledgement-only flow is activated | Claims never process | Keep inactive until valid callback/processing path and all acceptance checks pass |

## Decisions confirmed and remaining setup

- Confirmed: n8n receives identifiers only; private document extraction, OCR, Groq assessment, and result writes stay in the app/Supabase boundary.
- Confirmed: claim intake/processing is the first slice; reminders and other automations remain separate.
- Confirmed: the existing Groq setup may receive extracted invoice and warranty text for this review.
- Confirmed: approved behavioral seams are the tests' scope; no external claim communication occurs.
- Still required for live verification: apply/reconcile the additive migration in `bankai`, create and assign the separate outbound credential in n8n, configure the matching local callback secret and the app-to-n8n Production URL, then verify the current app port and ngrok URL.
- No dedicated error workflow/notification was requested; none is included.

## Official references

- n8n Webhook test vs production URLs, authentication options, and publication behavior: [Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/).
- n8n response behavior and use of the Respond to Webhook node: [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/).
- n8n execution data minimization and pruning: [Manage execution data](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/manage-execution-data/).

## Task List

See `tasks/todo.md`. All implementation tasks remain unchecked pending review and approval of this plan.
