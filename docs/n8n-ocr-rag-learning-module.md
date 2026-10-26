# ClaimForge: Learn n8n, OCR, and RAG End to End

**Audience:** beginner building the ClaimForge MVP  
**Purpose:** understand how the Next.js app, Supabase, n8n, OCR, and document-grounded chat fit together before editing workflows.  
**Research checked:** 26 October 2026. Provider plans, product UI, and docs can change; recheck before implementation.

> Read this as two things kept separate: **what the checked-in app currently does** and **the target flow we are learning/designing**. Do not describe a proposed step as connected until it passes an end-to-end test.

## 1. Start with this mental model

- **Next.js is the app/API boundary.** The browser talks to server routes. A route verifies the signed-in user, validates the request, checks ownership, and calls the appropriate service. Next.js Route Handlers implement HTTP methods such as `GET` and `POST` using Web `Request`/`Response` APIs. [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- **Supabase is the product-data boundary.** Auth identifies the user; Postgres stores records and status; Row Level Security (RLS) limits rows; private Storage holds invoices and policy files. Supabase Storage relies on RLS policies for object permissions. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- **n8n is the workflow orchestrator.** It receives an event, runs connected nodes in order/branches, calls external services, and can return a response or later call a callback endpoint. A Webhook node is a trigger that starts a workflow when another service sends a request. [n8n Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- **OCR converts pixels into text.** It is needed for scans/photos or pages where normal PDF text extraction produces no usable text.
- **RAG retrieves evidence before an LLM answers.** It does not train the model on a policy. It finds relevant passages from the selected documents, then asks a model to answer using those passages and cite their trusted source metadata. Supabase describes vector embeddings and semantic search as a way to retrieve by meaning, with optional keyword + semantic hybrid search. [Supabase semantic search](https://supabase.com/docs/guides/ai/semantic-search) · [Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)

## 2. What the repo currently shows

Checked the source and docs in `apps/web` and `docs`:

- `POST /api/claims` is the app-side intake boundary. The integration guide says it authenticates the signed-in user, verifies references to private uploads, writes claim/product/document rows through the database RPC, and then may dispatch minimal metadata to n8n when configured.
- `GET /api/integrations/n8n` is only a configuration-status endpoint. It does not prove that a workflow is processing claims.
- `POST /api/integrations/n8n/callback` exists and validates a shared callback secret plus a constrained claim-result payload before calling a database RPC. n8n cannot reach a machine running only on localhost; it needs a reachable HTTPS endpoint for this callback.
- The `claimforge app api` workflow is documented as **inactive** and as Webhook → HTTP 202 acknowledgement only. That means “received”, not “processed”. Do not activate it as if it generated an assessment.
- The supplied `ClaimForge — Product Ownership Assistant` workflow is a separate form-based flow. It is not the app API and should remain unchanged unless explicitly redesigned.
- The current PDF indexing route downloads an owned private PDF server-side, extracts native PDF text and page numbers, chunks it, and flags unusable/empty content for review. Non-PDF/scanned OCR handling is not connected; it returns an `ocr_required`/review path.
- The answer route checks the signed-in user, product/document selection, and citation IDs. The local ADR describes current retrieval as English full-text search and says OCR, embeddings, hybrid retrieval, and durable asynchronous indexing are not implemented. The RAG migration is draft/local-only.

**Important implementation gap:** the checked-in RAG ADR is proposed and describes a Vercel Cron route that would dispatch/consume Supabase Queue jobs, with embedding delegated to a Supabase Edge Function. The current checkout has no worker or embedding function code, and the queue/job migration is local draft only. Earlier conversation notes described a different Supabase-scheduled worker implementation, but those files are absent from this checkout. Treat the checked-in code as authoritative for what exists; reconcile the desired worker design before implementing it. Neither RAG ingestion nor chat answering should be silently routed through n8n.

## 3. n8n basics, from beginner to advanced

### The basic building blocks

1. **Trigger:** starts an execution. For ClaimForge, the key triggers are a Webhook (app event) and Schedule Trigger (recurring reminders/reconciliation). Schedule Trigger requires a published workflow and depends on workflow/instance timezone. [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) · [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/)
2. **Node:** one operation, for example validate fields, call an API, extract PDF text, branch on a result, or return a webhook response.
3. **Item/data:** JSON (and sometimes binary data) passed from node to node. Keep each step’s payload small and intentional.
4. **Connection/branch:** defines what runs next. Use deterministic conditions for eligibility/status rules; use AI only for interpretation and draft wording.
5. **Credential:** secret-backed connection to an external service. Store it in n8n’s credential store; never paste secrets into node text, browser code, workflow exports, or chat.
6. **Execution:** one runtime instance of a workflow, with success, failure, running, or waiting state. n8n lets authorized users inspect and retry saved executions. This is useful for debugging, and also means workflow inputs/outputs may be retained in execution data depending on configuration. [Executions](https://docs.n8n.io/workflows/executions/all-executions/)

### Test URL vs production URL

- **Test URL:** n8n registers it while you choose “Listen for test event”/execute for testing. Use a synthetic request.
- **Production URL:** registered when the workflow is published/activated. It is the endpoint the app server calls after the workflow is ready.
- Configure the webhook with authentication. ClaimForge’s app server should call n8n; the browser must never receive the webhook secret. Webhook responses can be configured directly or via Respond to Webhook. [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) · [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/)

### Synchronous vs asynchronous response

- **Synchronous:** app waits for the workflow and gets the final result in the same HTTP request. It is simple but long OCR/LLM work can time out.
- **Asynchronous (recommended for document processing):** n8n quickly returns `202 Accepted` plus an event/job ID. The app shows `processing`. Later n8n calls the authenticated Next.js callback with the result/status. `202` means accepted for work; it is not evidence that work succeeded.
- For ClaimForge, the integration guide currently documents this acknowledgment pattern, but its actual workflow does not yet process the claim. The callback route exists; the workflow-to-callback path is not verified.

### Reliability concepts you need

- **Idempotency:** give an event/job a stable ID. If a request or callback is delivered twice, the second delivery must not create a duplicate claim or repeat a side effect.
- **Retry policy:** retry temporary network/provider failures with a cap and backoff; send invalid input or permanent failures to a safe terminal state for review.
- **Error workflow:** n8n can route failed executions to a separate Error Trigger workflow for operational alerts. Avoid putting private document text in alerts. [n8n error handling](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully/)
- **Human-in-the-loop:** model output is a draft/recommendation. A user must review the exact text and explicitly approve before any external claim email or document sharing. Workflow retries must not bypass that gate.
- **Execution privacy:** invoices/policy text are sensitive. Send IDs and minimal status fields across the app↔n8n boundary; configure execution retention intentionally; avoid logging binaries, OCR output, prompts, signed URLs, contacts, and secrets. A retry may reuse saved execution data, so treat the execution log as data storage.

## 4. Claim-intake flow: end to end

```mermaid
sequenceDiagram
  actor User
  participant UI as ClaimForge UI
  participant API as Next.js API
  participant DB as Supabase Auth/Postgres
  participant Store as Private Supabase Storage
  participant N8N as n8n Claim Intake
  participant CB as Next.js Callback

  User->>UI: Describe fault + upload invoice/warranty
  UI->>Store: Upload files under signed-in user's private path
  UI->>API: POST /api/claims + file paths + idempotency key
  API->>DB: Verify session, owner, metadata, and idempotency
  API->>DB: Create claim/product/document rows
  API->>N8N: Authenticated POST with eventId, claimId, productId only
  N8N-->>API: 202 accepted (ack only in current workflow)
  API-->>UI: Claim received / processing state
  Note over N8N: Future: fetch only approved temporary document access,
  Note over N8N: extract/analyze, validate, prepare evidence + draft
  N8N->>CB: Authenticated callback: status + safe evidence + draft
  CB->>DB: Validate secret, schema, ownership links, dedupe event
  UI->>API: Poll/read claim from owner-scoped Supabase
  API-->>UI: Assessment/evidence/draft for review
  User->>UI: Edit and explicitly approve draft
  Note over UI,N8N: No external send is currently connected; approval is not send.
```

### Current boundary payloads

The integration doc specifies app → n8n metadata fields: `eventId`, `eventType`, `claimId`, `productId`. Callback fields include `eventId`, `claimId`, status, cautious assessment label, claim draft, and bounded evidence entries with source page/document IDs. Never send the file itself, extracted text, signed URL, or secret as ordinary workflow data. The callback secret is a separate server-to-server credential.

## 5. OCR and RAG: how they fit

### Document ingestion path (one-time per selected document/version)

1. **Upload:** browser sends invoice/warranty document to a private Supabase Storage bucket. The database stores safe metadata and the storage path; the object stays private.
2. **Read text PDF:** server downloads via the authenticated owner path and attempts native PDF text extraction, preserving page numbers. This is not OCR.
3. **Detect scan/quality issue:** if pages have no usable text, mark the document as needing review/OCR. Don’t label it ready just because extraction returned a result.
4. **OCR fallback (future):** an approved OCR service processes only pages requiring it and returns text plus page/quality/layout metadata. Provider and processing region are still open in the ADR; don’t send real customer files to a provider before approval.
5. **Chunk:** split the extracted text into coherent passages, keeping headings, exclusions, definitions, exceptions, tables, and page/section provenance together. Each chunk has a source document ID, page/section, index version, and content hash.
6. **Embed (future):** convert each chunk into a 384-number vector using the same `gte-small` model/options used for question vectors. Supabase docs show gte-small and `vector(384)`; model inputs must fit the model’s limit. Embeddings are not policy truth and do not measure whether a claim is covered. [Supabase gte-small semantic-search guide](https://supabase.com/docs/guides/functions/examples/semantic-search) · [Vector columns](https://supabase.com/docs/guides/ai/vector-columns)
7. **Publish index:** make a new index version searchable only when all required extraction/chunk/embedding stages pass. A partial version should remain `needs_review`/failed, never “ready”.

### Question-answer path (per user question)

1. User chooses an owned product and explicitly selects indexed documents.
2. Next.js verifies session, product ownership, selected document ownership/readiness, and request size.
3. Embed the question with the same model, retrieve only chunks from the selected documents owned by that user, ideally combine vector similarity and full-text matches.
4. Send only retrieved evidence and question to the answer model. Treat question and document passages as untrusted input, never instructions.
5. Validate model response against a schema. Citations must reference retrieved chunk IDs; page, section, and document labels come from trusted database metadata, not model-written citation text.
6. Return one of `supported`, `conditional`, `insufficient_evidence`, or `conflicting_terms`; ask a follow-up/abstain when evidence is incomplete or contradictory. No answer is an insurer’s binding decision.

**n8n’s role in this path:** it may orchestrate an approved background ingestion task if the architecture is explicitly chosen, but it should not be on every chat answer’s critical path. For the current proposed design, answer retrieval stays in the authenticated Next.js/Supabase path. Queue + worker choices are unresolved in project docs.

## 6. Recommended n8n workflow shape for a later integration

```text
Webhook (POST, Header Auth)
  → Validate event envelope and required IDs
  → Respond 202 quickly (async mode)
  → Load/verify job using a protected server API
  → Obtain limited document access only if the approved design allows it
  → Extract text / OCR through the selected provider
  → Deterministic checks (required fields, dates, file/page quality)
  → AI interpretation/draft (strict structured output, cited evidence)
  → Validate/normalize output; route uncertainty to human review
  → Authenticated callback to Next.js
  → Error branch: safe error code + eventId only
```

Do not wire the final email/send node until the exact user approval state and send policy are implemented and tested. Do not let n8n Data Tables or Google Drive become a second source of truth for records already owned by Supabase.

## 7. How to learn it in a practical order

1. **n8n basics:** create Manual Trigger → Edit Fields → IF → Respond. Practice item JSON, expressions, and branches with fake headphone data. Start with [n8n quickstarts](https://docs.n8n.io/try-it-out/).
2. **Webhook:** build `POST /claimforge/intake` with Header Auth. Use test URL and synthetic JSON; inspect the incoming item. Then add Respond to Webhook and return a small `202` JSON acknowledgment. Read [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) and [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/).
3. **App-server call:** learn to call a webhook from a Next.js Route Handler using a server-only secret, timeout, request validation, and idempotency key. Do not place the secret in a client component. Read [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
4. **Callbacks:** POST synthetic status to the existing local callback route; understand callback auth, allowed fields, duplicate event handling, and why localhost cannot be reached by n8n Cloud.
5. **Files:** test Extract From File on a synthetic text PDF. Learn binary data vs JSON. This node extracts PDF file data to JSON; it is not a complete OCR/layout understanding service. [Extract From File](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.extractfromfile/).
6. **Reliability/privacy:** create a safe error workflow; test duplicate events, timeouts, retry behavior, failure state, and execution retention using synthetic data. [n8n errors](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully/) · [Execution history/retry](https://docs.n8n.io/workflows/executions/all-executions/).
7. **RAG:** first understand extraction → chunking → embeddings → retrieval → grounded generation. Follow Supabase’s [semantic search](https://supabase.com/docs/guides/ai/semantic-search), [hybrid search](https://supabase.com/docs/guides/ai/hybrid-search), and [RAG with permissions](https://supabase.com/docs/guides/ai/rag-with-permissions) guides; use a synthetic sample policy only.
8. **Advanced operations:** learn Schedule Trigger only for truly recurring work; confirm timezone and publication. Learn queue/worker separately from workflow execution. Supabase Queues are a durable Postgres-native message queue; they are not the same thing as n8n execution history. [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/) · [Supabase Queues](https://supabase.com/docs/guides/queues)

## 8. Practice exercises (do not use real customer data)

- Send a fake intake body with a valid synthetic event ID and verify the webhook returns the expected acknowledgement.
- Send the same event twice; confirm app/database idempotency prevents duplicate claim creation.
- Remove one required field; verify a safe validation error and no claim is created.
- Simulate a failed callback, then retry with the same event ID; verify no duplicate evidence rows.
- Give the RAG assistant a synthetic document with a clear clause, a missing clause, and a conflicting clause; verify it cites only retrieved chunks or abstains.
- Put a prompt-injection instruction inside a synthetic policy paragraph; verify the assistant treats it only as document text.
- Test an empty/scanned PDF; verify state is `needs_review` until OCR is approved and succeeds.

## 9. Source links (official / first-party)

- n8n: [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/), [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/), [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/), [Extract From File](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.extractfromfile/), [Error handling](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully/), [Executions](https://docs.n8n.io/workflows/executions/all-executions/).
- Next.js: [Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
- Supabase: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Edge Functions](https://supabase.com/docs/guides/functions), [Queues](https://supabase.com/docs/guides/queues), [Semantic search](https://supabase.com/docs/guides/ai/semantic-search), [Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search), [Vector columns](https://supabase.com/docs/guides/ai/vector-columns), [RAG with permissions](https://supabase.com/docs/guides/ai/rag-with-permissions).

## 10. Vocabulary cheat sheet

- **Webhook:** an HTTP endpoint that starts a workflow when called.
- **Node:** one step in the visual workflow.
- **Execution:** one run of the workflow.
- **Credential:** stored secret/auth configuration for an external service.
- **Binary data:** file bytes (PDF/image), not ordinary JSON text.
- **OCR:** recognizing text/layout in images or scanned pages.
- **Chunk:** a source-preserving passage used for retrieval.
- **Embedding:** numeric representation used to find semantically similar text.
- **RAG:** retrieve relevant source passages, then generate an answer grounded in them.
- **Idempotency:** making retries/duplicate events safe.
- **Callback:** a later HTTP request that reports an asynchronous result.
- **RLS:** Postgres policies that scope records to authorized users.
- **Abstention:** explicitly saying available evidence is not enough to answer safely.
