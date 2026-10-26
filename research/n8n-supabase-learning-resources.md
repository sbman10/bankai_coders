# ProductVault: videos and learning path for Next.js, Supabase, and n8n

**Prepared:** 24 October 2026  
**Purpose:** Help a beginner understand the system well enough to draw it by hand before asking an agent to implement more integrations.  
**Scope:** Curated first-party videos where available, plus clearly labeled independent n8n webhook instruction. No live project was accessed.

## Start with the architecture in one sentence

The browser talks to the Next.js app; Next.js checks who the signed-in user is and handles app-specific decisions; Supabase stores user/product/claim/job data and private files; n8n runs selected background automations when the app calls its secured webhook or on a schedule. The RAG document-processing worker is a separate proposed Supabase Queue + Edge Function path, not the same thing as n8n.

## Hand-draw this before watching

```text
USER / BROWSER
   │ 1. signs in, submits claim, uploads/selects a product document
   ▼
NEXT.JS APP (UI + server-side API routes)
   ├── verifies the Supabase session and validates the request
   ├── reads/writes product, claim, reminder and status records ─────► SUPABASE POSTGRES
   ├── uploads/downloads private invoice and warranty files ────────► SUPABASE STORAGE
   └── sends a small authenticated event (IDs + minimal metadata) ─► n8n WEBHOOK
                                                                         │
                                                                         ├─ validates/routes the event
                                                                         ├─ runs an automation / scheduled follow-up
                                                                         └─ may call a protected app callback with status

SEPARATE RAG INGESTION (proposed, not yet runtime-verified)
SUPABASE QUEUE ─► SUPABASE EDGE FUNCTION ─► private Storage download / extract / chunk / embed
                                              └─► Postgres chunks + vectors + processing status

CHAT ANSWERING (intended)
Browser ─► Next.js answer route ─► owner- and selection-scoped Supabase retrieval ─► Groq ─► cited answer
```

### Draw these trust boundaries in red

- Browser code never receives Supabase secret/service-role keys or the n8n webhook secret.
- A signed-in user can access only their own records/files, enforced by server checks and database/Storage policies.
- n8n should receive IDs and minimum workflow metadata, not invoice bytes, OCR text, long-lived file URLs, or app secrets.
- An n8n acknowledgement means “event received,” not “claim processed” or “claim approved.” External claim submission always needs the user's explicit approval.
- Queue/Edge Function RAG ingestion is not interchangeable with an n8n automation. The former is the intended document-processing worker; n8n handles product/business automations.

## Watch in this order

### 1. Understand the app-to-database/auth relationship

**The Right Way to do Auth with the Next.js App Router** — [Watch on YouTube](https://youtu.be/v6UvgfSIjQ0). Supabase's own troubleshooting article recommends this video for implementing Supabase Auth with Next.js. Focus on the request/session boundary and server-side authorization; some details may predate the current Next.js 16 naming/conventions, so use current docs for implementation specifics. Duration was not verified from a first-party listing.

- Current companion guide: [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs)
- What to draw: browser session cookie → Next.js server route → Supabase Auth identity → owner-scoped database query/RLS.
- Why first: understand why the backend checks identity and why a browser-provided `user_id` is not trustworthy.

### 2. Learn the n8n workflow mental model

**n8n Quick Start Tutorial: Build Your First Workflow [2025]** — [Watch on YouTube](https://www.youtube.com/watch?v=4cQWJViybAQ). Published by n8n; it covers triggers, data/items, conditional logic, mapping, testing, activation, and production executions. The listed chapters run about 14 minutes total.

Useful chapters: [00:57 Form Trigger](https://www.youtube.com/watch?v=4cQWJViybAQ&t=57s), [03:18 output data/items](https://www.youtube.com/watch?v=4cQWJViybAQ&t=198s), [05:33 conditional logic](https://www.youtube.com/watch?v=4cQWJViybAQ&t=333s), [06:36 mapping](https://www.youtube.com/watch?v=4cQWJViybAQ&t=396s), [14:46 testing](https://www.youtube.com/watch?v=4cQWJViybAQ&t=886s). The chapter listing places activation at 12:45; chapter timestamps can shift as YouTube updates metadata.

- Official written practice (about 15 minutes): [Build your first n8n workflow](https://docs.n8n.io/build-your-first-workflow/). It uses a Schedule Trigger, HTTP Request, Edit Fields, and a Data Table. This is especially useful for understanding a recurring reminder workflow.
- What to draw: Trigger → nodes that transform/route JSON → external action → execution record.

### 3. Learn webhook request/response for the website integration

**Webhooks on n8n: The Complete Beginner's Guide** — [Watch on YouTube](https://www.youtube.com/watch?v=GH6vvqpcbqA). Independent instructor Matheus Battisti (Hora de Codar), not n8n itself. Its chapter list covers webhook basics, receiving request data, authentication, and Respond to Webhook; listed content reaches about 32 minutes. It is a practical supplement, not the authority for current node settings.

- Official reference to keep open: [n8n Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/). It documents the test vs production URL, Header Auth/JWT options, HTTP method, and response modes.
- Draw this specifically: browser → Next.js route → authenticated POST → n8n Webhook → validation/automation → immediate `202 accepted` response → later status update/callback if configured.
- Important ProductVault detail: n8n currently has an inactive app API workflow that only acknowledges receipt. Do not draw it as completing the claim-processing path.

### 4. Understand private invoice/warranty storage

**Storage Buckets** — [Watch the video embedded in the official Supabase Storage guide](https://www.youtube.com/watch?v=ch2UGHMreB0). Supabase links this video from its Storage guide. The guide identifies private buckets and access control; video duration was not verified.

- Official companion: [Supabase Storage Quickstart](https://supabase.com/docs/guides/storage/quickstart) and [Buckets: private vs public access](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- What to draw: file bytes → private Storage bucket; document metadata/path → Postgres; authorized server downloads only when processing is needed.
- ProductVault rule: keep uploaded invoices and warranty terms private; do not send file binaries or permanent public URLs through n8n.

### 5. Understand what an Edge Function is (for the separate RAG worker)

**Supabase Edge Functions Explained** — [Watch on YouTube](https://www.youtube.com/watch?v=za_loEtS4gs). Published by Supabase on 20 May 2025. The video illustrates a function downloading a file from Storage, processing it server-side, and saving a result; it also explains deployment and isolated execution. A third-party listing reports 6:05, but duration was not confirmed by the first-party page.

- Official companion: [Supabase Edge Functions overview](https://supabase.com/docs/guides/functions) and [Supabase Edge Functions architecture](https://supabase.com/docs/guides/functions/architecture).
- What to draw: Queue message with job/document IDs → Edge Function → private file download → extract/chunk/embed → Postgres status/chunks.
- This is the proposed RAG ingestion path. It has not been verified against a live Queue/database yet.

## There is no single official end-to-end video

I did not find one first-party tutorial showing **Next.js + Supabase Auth/DB/private Storage + n8n secured webhook + asynchronous callback + Supabase Queue/Edge Function RAG** as one complete ProductVault system. The watch order above teaches each boundary separately. Treat the official docs as authoritative for current configuration, because videos can use older interfaces or framework versions.

## Beginner exercise for the notebook

After each video, draw one box and answer these questions in your own words:

1. Who starts this action: the browser, a webhook, a schedule, or a queue?
2. Which service owns the data after the action finishes?
3. Which identity/credential proves the caller is allowed?
4. Is the response immediate, or does the actual work finish later?
5. What information must never be sent or logged?

Then trace two different examples:

- **Claim intake:** browser form → Next.js validates user → Postgres saves claim → Next.js calls n8n webhook with IDs → n8n acknowledges → app shows status from Postgres.
- **Warranty PDF indexing (planned):** browser uploads to private Storage → app creates job → queue → Edge Function extracts/chunks/embeds → Postgres status/chunks → chatbot later retrieves only selected owned chunks.

## Sources

- Supabase's troubleshooting article links to its recommended Next.js App Router auth video: [Supabase Knowledge Base](https://supabase.com/kb/troubleshooting/how-do-you-troubleshoot-nextjs---supabase-auth-issues-riMCZV).
- Supabase Auth Quickstart: [Next.js App Router setup](https://supabase.com/docs/guides/auth/quickstarts/nextjs).
- n8n's first-party video: [n8n Quick Start Tutorial [2025]](https://www.youtube.com/watch?v=4cQWJViybAQ); official text guide: [Build your first workflow](https://docs.n8n.io/build-your-first-workflow/).
- n8n webhook behavior and response modes: [Webhook node documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/).
- Supabase Storage video is embedded from the official guide: [Storage guide](https://supabase.com/docs/guides/storage); video [direct link](https://www.youtube.com/watch?v=ch2UGHMreB0). Private bucket behavior: [Storage fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- Supabase Edge Function video is embedded from the official guide: [Edge Functions guide](https://supabase.com/docs/guides/functions); video [direct link](https://www.youtube.com/watch?v=za_loEtS4gs). Architecture: [Edge Functions architecture](https://supabase.com/docs/guides/functions/architecture).
- Independent webhook tutorial details/chapter summary: [Matheus Battisti's video](https://www.youtube.com/watch?v=GH6vvqpcbqA). It is included as an optional teaching aid; current n8n behavior should be checked against n8n docs.
