# ProductVault: Judge Preparation and Study Manual

**Snapshot:** 28 October 2026 · **Market framing:** India-first, as selected by the founder  
**Purpose:** prepare to explain the product, architecture, feasibility, limitations, and honest implementation status to judges.

> This describes the repository and status notes available at this snapshot. Code present locally is not automatically committed, deployed, live-configured, or verified end to end.

## 1. Product in one minute

ProductVault is a personal product-ownership workspace. A person adds a product before or after purchase, keeps purchase proof and product documents together, and uses those records to answer practical questions over time. The product direction connects four moments: **decide** (understand supplied terms before buying), **record** (save a purchase and its proof), **maintain** (remember expiry, service, replenishment, and price events), and **act** (understand claim requirements and prepare a draft for the user to review).

The concrete problem is fragmentation. A receipt may be in email, a warranty PDF in downloads, the product in an online store account, and a service date in somebody’s memory. When a product fails, the customer has to reconstruct what they bought, when, what terms apply, and what evidence a seller or manufacturer may ask for. The Government of India’s consumer handbook recommends documenting a complaint, identifying the seller/manufacturer, and gathering proof of purchase. This supports the kind of work ProductVault aims to organize; it is not evidence that ProductVault has already reduced effort or improved outcomes. [Department of Consumer Affairs, Consumer Handbook](https://consumerhelpline.gov.in/public/assets/docs/consumerhandbooks/Consumer_Handbook.pdf)

**India-first means the initial product, language, retailer, and support assumptions should be validated for Indian consumers.** It does not mean the current code covers every Indian retailer, insurer, language, or policy. The PRD still treats geography as a pitch/demo assumption and warns that terms vary by product and country. See [PRD.md](../PRD.md).

### Two judge-ready user scenarios

1. **Before buying:** “I’m comparing headphones and an extended protection plan. If one side stops working after eight months, what do the terms I selected say? What facts are still missing?” The intended answer is a sourced explanation with page references, uncertainty, and a follow-up where needed—not a promise that the provider will pay.
2. **After buying:** “My headphones have failed. Where is the invoice, which warranty terms did I save, what evidence appears missing, and what draft could I send?” ProductVault is intended to assemble this information and a draft. The user remains responsible for reviewing and approving any external message.

## 2. How the system works

### Architecture at a glance

~~~mermaid
flowchart LR
  U[User / browser] -->|sign in, add products, ask| N[Next.js app and server routes]
  N <-->|session, owner-scoped records| S[(Supabase Auth + Postgres)]
  U -->|private invoice / policy upload| ST[(Private Supabase Storage)]
  ST -->|authenticated download for indexing| N
  N -->|PDF text extraction + bounded OCR| X[Text and provenance]
  X -->|request embeddings| EF[Supabase Edge Function: embed-text]
  EF -->|gte-small, 384 dimensions| N
  N -->|chunks, page metadata, vectors| S
  U -->|product + selected document IDs + question| N
  N -->|owner- and selection-scoped retrieval| S
  S -->|retrieved passages and trusted IDs| N
  N -->|bounded evidence prompt| G[Groq answer model]
  G -->|answer proposal + citation IDs| N
  N -->|validate IDs; render trusted source labels/pages| U
  N -->|claim event IDs only| W[n8n workflow, currently inactive]
  W -->|protected app-side processing request| N
  N -->|claim state and draft| S
  N -->|future scheduled reminder request| W
~~~

The diagram combines current code and intended handoffs. The n8n arrows are not proof that a production workflow is active. The RAG status document reports the bankai schema and embedding function as live, but the complete user path remains unverified. See [RAG integration status](rag-live-integration.md) and [n8n integration status](n8n-integration.md).

### The flow in ordinary language

1. **Sign in.** Supabase Auth supplies the identity/session; Next.js uses the Supabase SSR integration and cookie-backed sessions. Supabase explains how SSR frameworks expose sessions on server and client while using cookies. [Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side)
2. **Add a product.** The UI supports invoice extraction, link/manual entry, correction/review of extracted fields, and a product passport with attached documents. An invoice may not contain a product photograph; product metadata can help resolve an image, but an exact match is not guaranteed. Call an approximate image illustrative unless verified.
3. **Store proof privately.** Product/document metadata belongs in Supabase Postgres and document files in the private Supabase Storage bucket. Private buckets enforce access policies; a signed URL is limited-time access, not a reason to make sensitive files public. [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) · [Storage bucket access models](https://supabase.com/docs/guides/storage/buckets/fundamentals)
4. **Index a selected document.** The server checks session ownership and downloads through the user-scoped path. Native PDF text is extracted page by page; sparse/image-only pages use bounded Tesseract OCR. Chunks carry page/section provenance. The embedding function uses gte-small (384 dimensions), and Postgres stores searchable vectors using pgvector. The current code path is synchronous, so a browser interruption or long document can interrupt processing; a durable worker is not connected.
5. **Ask a vault question.** The user chooses a product and up to six ready/indexed documents. The server verifies ownership and selection, retrieves passages using vector plus English keyword search, and gives the evidence to Groq. The route validates returned citation IDs and renders source/page data from stored metadata. If evidence is insufficient or conflicting, the intended behavior is to qualify or abstain. This is **not general chat**: current AssistantChat supports selected ProductVault-document questions only.
6. **Prepare a claim.** Claim intake and protected app-side processing code exist. The intended design sends only event identifiers to n8n; the app processor obtains the user-owned documents itself, extracts text, requests a Groq draft, and stores a reviewable result in Supabase. A human approval gate prevents the AI from sending a claim on its own. The workflow and end-to-end handoff are inactive/unverified, so do not present this as a completed automated workflow.
7. **Automate reminders and prices later.** The local working tree contains reminder, inbox, price-observation, and scheduler endpoint code. The associated migration is uncommitted/unapplied; its n8n workflow is inactive and has a placeholder endpoint. Price checks require a configured provider key and retailer validation. These are not live services yet.

### Stack by layer

| Layer | Role | Status and study note |
|---|---|---|
| Frontend | Next.js App Router, React, TypeScript | Dashboard, product passport, document selection, assistant, and interactive controls. App Router is file-system based; server components are the default and client components provide browser interaction. [Next.js App Router](https://nextjs.org/docs/app) · [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) |
| App server/API | Next.js Route Handlers | Validate requests, verify sessions, enforce ownership, call Supabase/Groq, and receive protected integration callbacks. A Route Handler is a request handler under the app directory. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) |
| Identity | Supabase Auth and @supabase/ssr | User identity and cookie session. RLS can use authenticated identity to enforce ownership. Founder reports Google sign-in works; this manual did not independently retest it. [Supabase Auth](https://supabase.com/docs/guides/auth) · [SSR Auth](https://supabase.com/docs/guides/auth/server-side) |
| Database | Supabase Postgres | Durable product, document metadata, claim, reminder, and status records. It is the intended source of truth; n8n execution logs are not the product history. |
| Files | Supabase Storage private bucket | Invoices and warranty files stay private, with access governed by Storage RLS policies. [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) |
| Retrieval | pgvector and Postgres search functions | Stores/searches embeddings with owner and document metadata. pgvector adds vector storage and similarity search to PostgreSQL. [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns) · [pgvector](https://github.com/pgvector/pgvector) |
| Embeddings | Supabase Edge Function calling Supabase/gte-small | English embedding model; its model card reports 384 dimensions and 512-token sequence length. [Model card](https://huggingface.co/Supabase/gte-small) |
| OCR and parsing | PDF text extraction, Tesseract OCR, invoice field parser | OCR converts pixels into text; chunking and embeddings make text retrievable. Local RAG code caps OCR at 10 PDF pages and marks low-confidence/unreadable documents for review. Vercel runtime/language packaging is not verified. [Tesseract](https://github.com/tesseract-ocr/tesseract) |
| Answer generation | Groq chat completions | Drafts explanations from retrieved snippets. Citation validation, ownership, and abstention are application responsibilities. Structured output can guarantee a format, not factual correctness. [Groq Chat Completions](https://console.groq.com/docs/text-chat) · [Structured outputs](https://console.groq.com/docs/structured-outputs) |
| Workflow automation | n8n Cloud | Intended for selected event and schedule workflows, such as claim handoff and daily reminders. Webhooks can start a workflow and return a response; test and production URLs behave differently. [n8n Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) |
| Hosting | Vercel is the planned target | The architecture targets Next.js on Vercel, but a deployed production environment was not verified for this manual. Runtime and processing limits remain release checks. |

**Why both Supabase and n8n?** Supabase stores canonical records, files, status, and access rules. n8n orchestrates selected event/scheduled work. It should receive the minimum data needed (prefer identifiers), while the app checks ownership and performs document/AI work. This avoids treating n8n as a second database and limits private text in automation execution data. n8n recommends not saving unnecessary data and pruning old executions. [n8n execution-data management](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/manage-execution-data/)

## 3. Exact status: code, live-reported, and pending

**Code present** means implementation exists in the checked-out repository. It does not prove it is committed, deployed, configured, or working against a live service. **Live-reported** means a project status note records a live action; this manual did not repeat the database/browser test. **User-reported** is from the founder, not independent verification. **Pending/unverified** must not be presented as working in a pitch.

The local checkout is now on main at 9486e5f, aligned with origin/main and including PRs #14 and #15. It still contains substantial uncommitted reminder/price-watch changes. The merged commits add workspace, price-watch, notification-center, and support UI, but do not prove the backend integrations are live. This manual is a code/status snapshot; do not assume local uncommitted code is on GitHub or deployed. The RAG status note's statement that SUPABASE_SECRET_KEY is missing conflicts with a later presence-only environment check. Treat that sentence in the note as stale; no secret values belong in a pitch or this document.

| Capability | Status at this snapshot | Safe wording |
|---|---|---|
| Product workspace/passport | Product CRUD, link/manual intake, invoice extraction/review, document attachment, product details/timeline are in app code. The latest workspace visual changes are merged into local main. | “The prototype has the product-ownership workspace in code; deployment and all external sources are not claimed as verified.” |
| Sign-in | Supabase session integration is in code. Founder reports Google sign-in works. | “Supabase Auth is our identity layer; Google sign-in worked in the founder’s setup.” Do not claim an independent security audit. |
| User/document isolation | Core/RAG policies and private bucket are in migrations; project docs say core and RAG schemas were applied to bankai. Negative cross-user tests and fresh complete flow remain outstanding. | “We designed owner-scoped RLS and private files. Repeatable cross-user denial tests remain a release gate.” |
| RAG schema/embed function | rag-live-integration.md reports schema/vector index/search RPC and embed-text as live in bankai; it notes pgvector 0.8.2. This is documentation-reported. | “The schema and embedding endpoint are deployed according to our integration record; the complete upload-to-answer journey is not verified.” |
| PDF/OCR indexing and cited answers | Application code is present; docs describe page extraction, bounded Tesseract OCR, embeddings, hybrid retrieval, Groq, citation-ID validation, and abstention. Signed-in upload → cited answer is not verified end to end. | “The code demonstrates the designed pipeline; we have not proved the whole signed-in live journey.” |
| Multimodal RAG | PDF/image inputs may be OCRed into text. This is not image-vector or general visual retrieval. | “We currently mean OCR-assisted, text-based RAG—not full multimodal retrieval.” |
| General chatbot mode | Absent; current AssistantChat is selected-document-only. | “The first assistant mode is grounded in selected documents. General chat is later scope.” |
| Claim preparation | Intake, processor, approval-gate code exist. App API workflow inactive; processor points to an old ngrok address and outgoing auth not verified. E2E unverified. | “Claim preparation boundaries are in code, but automated processing is not enabled; there is no automatic submission.” |
| n8n App API | Inactive. Inbound auth is assigned per read-only workflow inspection; processor uses an old ngrok host. | “n8n is an integration target, not an active production automation.” |
| Reminders/inbox | Types, APIs, notifications, processing endpoint, and tests are in current local uncommitted changes. Migration is local/unapplied. Scheduler workflow inactive, URL placeholder, secret not configured. | “Reminder support is implemented locally as a draft; it is not live-enabled.” |
| Price checks | Local adapter/observation logic exists. Firecrawl is not configured; retailer access/terms and matching need validation. No production checks have run. | “Manual tracking remains fallback; automated checks are under validation.” |
| Email alerts | Postmark token/sender are not configured. | “Production email delivery is not enabled.” |
| Durable processing | Queue/worker design is described but the actual queue-driven worker and atomic publish path are unconnected. Indexing is synchronous. | “Large or interrupted processing is an acknowledged reliability gap.” |
| B2B/company accounts | No verified org membership, role, tenant-sharing, or admin workflow. | “B2B is a discovery direction; consumer ownership permissions are not company-wide access.” |

### Demo safety

Before the pitch, run a synthetic native-text invoice and warranty PDF through a signed-in account and verify private upload, index status, vector rows, a relevant cited answer, and an insufficient-evidence answer. Repeat with a second test account and an unselected document. If that cannot be done, demo clearly labelled sample data and state live E2E validation is pending. Redact names, addresses, invoice IDs, phone numbers, and emails. Do not activate n8n or apply the uncommitted reminder migration just to improve a pitch claim.

## 4. Feasibility and limitations

**A bounded prototype is technically feasible.** Web framework, authentication, private storage, OCR/text extraction, embeddings, Postgres vector search, and a language model over retrieved text are established components. ProductVault has code and some documented live pieces. A narrow demo can be evaluated with synthetic receipts and terms.

**Production quality is not yet proven.** Risks include OCR on faint, rotated, low-resolution, complex-layout, or regional-language documents; policy version/applicability; retrieval recall and citation support; uploaded prompt injection; isolation; synchronous processing; changing retailer pages and terms; stale/ambiguous prices; provider limits/costs; and data residency. Feasibility is a test plan, not proof these issues are solved.

India-specific consumer guidance makes the workflow worth investigating: the Consumer Affairs handbook tells consumers to keep receipts, check terms, and document complaints; NCH's consumer-durable workflow asks for product identity, purchase date, fault, complaint history, and expected relief. This supports the problem shape, **not** product demand, willingness to pay, or market size. [Consumer handbook](https://consumeraffairs.nic.in/sites/default/files/file-uploads/consumer_information/Consumer%20Handbook.pdf) · [NCH consumer durable guide](https://consumeraffairs.nic.in/sites/default/files/file-uploads/consumer_information/NCH.pdf)

Limitations to state:

- The model can misunderstand a clause. Show source pages and uncertainty; consequential terms should be confirmed with the provider.
- “Cited” does not automatically mean “correct.” Citation IDs/page locations are checked, but semantic support still needs evaluation and human review.
- OCR fails on difficult scans. Current RAG OCR is bounded; incomplete documents should be marked for review.
- Indexing is synchronous and may be interrupted. The durable worker is not connected.
- The assistant is selected-document-only; general chat is absent.
- A draft is not legal advice, an approval, or a claim submission.
- Images/prices depend on match quality, source permission, retailer stability, and availability.
- n8n is inactive; reminders are not enabled. One workflow still references an old ngrok endpoint.
- Migration history must be reconciled before bulk migration push because some SQL was applied via Supabase SQL Editor without recording migration history.

### What to prove next

1. Freeze a demo scope: a couple product categories, English docs, synthetic data, selected-source answers, manual price tracking, and claim draft only.
2. Prove signed-in upload → ready status → supported cited answer → honest abstention.
3. Run two-account access-denial and selected-document-exclusion tests for files, rows, and vector search.
4. Evaluate a small labelled set for extraction, retrieval, citation support, abstention, and task time; report sample size/method and no unmeasured percentages.
5. Make indexing durable, add retry/failure recovery, and publish a new index atomically.
6. Complete and test n8n auth, stable URL, minimum payload, idempotency, status handling, and execution-data minimization before activation.
7. Validate retailer adapters and opt-in email separately after migration-history reconciliation and database permission tests.

## 5. Competitors: overlap without superiority claims

Competitor descriptions below are their own official product claims, not independent testing; availability can change. “Fabric” is ambiguous: fabric.so currently describes an AI workspace for notes, research, projects, code, and agents—not a consumer ownership vault. If a judge means a different Fabric, confirm which company before comparing.

| Product | What its official page describes | Implication |
|---|---|---|
| Itemtopia | Home/personal inventory by room; connects belongings to receipts, warranties, documents, serial/model numbers, repairs, service history, reminders, and sharing. [Official page](https://www.itemtopia.com/home-inventory-app/) | Strong direct overlap in inventory, documents, maintenance, reminders. ProductVault must not claim those basics are unique. Its intended distinction is a purchase/policy workflow: selected-term Q&A plus claim preparation. That distinction is a hypothesis; pre-purchase general mode is not implemented. |
| Product Wallet | Advertises AI identification, receipt capture, warranty reminders, searchable manuals, proof of ownership, household sharing, insurance integrations, and recalls. Its site invites early-access signups, so distinguish advertising from independently verified availability. [Official site](https://productwallet.app/) · [Features](https://productwallet.app/features) | Direct overlap in receipts, warranties, manuals, reminders. ProductVault explores source-grounded policy Q&A and claim preparation with the ownership timeline. OCR/reminders are not unique USPs. |
| Fabric (fabric.so) | Official page describes a local-first AI workspace for research, notes, projects, code, and agents. [Official page](https://fabric.so/marketplace) | Not like-for-like based on the page reviewed. Do not claim ProductVault is better at ownership management. Clarify if judge means another Fabric. |
| Cover Your Assets (additional direct comparator) | Describes AI home inventory, receipts/serials, coverage questions, insurance reports, and API/SDK. [Official page](https://www.coveryourassets.ai/) | Shows AI inventory and coverage Q&A are also being explored. ProductVault needs evidence of an integrated workflow and reliable India-specific support, not “nobody else does this.” |

**Safe differentiation statement:** “We connect a product record to its documents and next action: explain only the terms the user selects, show the source, keep key dates visible, and help prepare—not automatically submit—a claim. The integrated workflow and India-first validation are our direction; we still need user testing to show that it is meaningfully easier than separate tools.”

Avoid “only one,” “no competitor has it,” “we outperform,” “users save X hours,” or “we increase claim success” without comparative research and measured evidence.

## 6. Copyability and intellectual property

### “Why can’t this be copied?”

**The product idea can be copied.** A broad idea such as “store receipts and ask AI about warranties” is not, by itself, a moat. IP India states copyright protects original expression, not ideas, procedures, methods, or concepts. [IP India copyright FAQ](https://www.ipindia.gov.in/page-content/faqs-1)

What could become harder to copy is execution: reliable product-to-document records, user trust and consent, accurate source-linked answers, robust retries/integrations, retailer and policy coverage, quality measurement, and distribution/partnerships. These are potential advantages to build, not established ProductVault assets today. Do not call data or “AI” a moat without lawful data access, actual users, quality evidence, and defensible operations.

### What IP is actually claimed?

- **Copyright:** original authored code, UI artwork, text, diagrams and other fixed expression may be protected, subject to ownership, contributor agreements, and open-source licences. It does not protect the general idea. Keep authorship/assignment records and confirm team/university contributions.
- **Trademark:** ProductVault and its logo could be assessed as marks. No trademark registration/search was verified for this manual. Search the IP India registry and consult an IP professional before calling the name registered or clear. [IP India trademark basics](https://ipindia.gov.in/basics-of-trademarks)
- **Patent:** no application or granted patent was found in reviewed materials. IP India describes novelty, inventive step, and industrial applicability and lists exclusions. Do not claim patentability without prior-art/legal review. [IP India patent basics](https://ipindia.gov.in/basics-of-patents) · [Patents Act Section 3](https://ipindia.gov.in/acts/patent-act-1970/section-3)
- **Trade secrets:** potentially valuable confidential methods/information need actual secrecy and reasonable protective steps. A public demo or disclosed algorithm is not automatically a trade secret. [WIPO overview](https://www.wipo.int/en/web/trade-secrets/) · [WIPO protection practices](https://www.wipo.int/en/web/trade-secrets/protection)
- **Customer records:** invoices/policies are users’ sensitive information, not ProductVault IP. Do not reuse them for training, demos, or cross-user learning without a clear legal basis, consent, and controls.

**Better answer:** “We own the code and brand assets we authored, subject to team and licence checks. We have not claimed a patent or registered mark. Our long-term defensibility would come from execution, trust, quality, integrations, and distribution; the idea itself is not exclusive.” This is educational, not legal advice.

## 7. Likely judge questions and rehearsal answers

Answer the question directly, then add one detail. When a feature is unfinished, say what is local, live-reported, and still to test.

### Product and user

**1. What is ProductVault?**  
A product-ownership workspace tying purchases to proof, documents, and next actions. The product passport is central; RAG and automation still need end-to-end validation.

**2. What problem are you solving?**  
Purchase details are split across receipts, store accounts, warranty PDFs, and memory. We are testing whether keeping them with the product record makes finding evidence and next steps simpler.

**3. Who is the first user?**  
India-first consumers managing purchases such as electronics and appliances is our initial assumption. We still need interviews and usability testing to identify the strongest segment.

**4. Why pre-purchase policy questions?**  
Terms matter before buying and later during ownership. The user can ask about selected terms; the system should explain wording and uncertainty, not decide whether to buy or guarantee coverage. General chat is not implemented.

**5. Why include claims?**  
Claim preparation needs product identity, proof, terms, fault description, and missing details. Linking records can reduce searching. ProductVault prepares a draft; it does not make the provider’s decision or submit automatically.

**6. Why not folders or spreadsheets?**  
They store files/dates. ProductVault’s intended value is connecting files and dates to a product and retrieving selected terms with source references. That needs usability comparison.

**7. Stand-out use case?**  
“My headphones failed eight months after purchase. Show the invoice and selected warranty clause, identify details I may need, and prepare a draft.” The integrated journey is the hypothesis; the live automated flow is not yet verified.

**8. Is it only for warranties?**  
No. The direction includes service/insurance terms, lifecycle dates, reminders, price observations, and claim preparation. But roadmap items are not all live; assistant is selected-doc-only, and reminder/price work is local.

### Technology, AI, and privacy

**9. What is the stack?**  
Next.js App Router, React and TypeScript; Supabase Auth, Postgres, private Storage and pgvector; GTE-small embeddings; Groq for answer drafting; Tesseract/PDF extraction; n8n for selected automation. n8n is inactive today.

**10. Why Next.js for frontend and backend?**  
It allows the UI and server Route Handlers in one TypeScript codebase. Server routes verify Supabase sessions, validate inputs, check ownership, and keep secrets off the browser. There is no separate Uvicorn/Python service in this architecture.

**11. What does Supabase do?**  
Identity, Postgres data, private file storage, and vector-search foundation. RLS and Storage policies are central protection layers; we still need repeatable negative access tests.

**12. How do you prevent cross-user access?**  
The app checks the session/owner and database/storage policies are owner-scoped. Retrieval also takes selected product/document IDs. We must prove this across every relevant route using two accounts before claiming production assurance.

**13. Explain RAG simply.**  
Retrieve relevant document passages first, then ask a model to explain those passages. Here, selected documents become page-aware text chunks and embeddings; the question searches only the user's chosen files; the app maps accepted citations back to stored page metadata.

**14. Is this multimodal?**  
Not broadly. PDFs/images may be OCRed into text, but it does not yet search image pixels or support general visual retrieval. The accurate term is OCR-assisted text RAG.

**15. Why GTE-small?**  
It is a compact English embedding model with 384 dimensions and a 512-token sequence limit, matching the chosen schema. That makes it practical for a prototype, not proven best for Indian policies or multilingual documents. [Model card](https://huggingface.co/Supabase/gte-small)

**16. Why Groq?**  
It is the configured chat-completion provider for answer/draft generation. The model drafts from retrieved evidence; it does not own data or verify coverage. The app checks structure and citation IDs. Structured output is not factual proof. [Groq docs](https://console.groq.com/docs/text-chat) · [Structured outputs](https://console.groq.com/docs/structured-outputs)

**17. What does n8n do?**  
It is intended to orchestrate event-triggered/scheduled work. A webhook or schedule starts a workflow; the app remains responsible for user authorization and durable records. Current relevant workflows are inactive.

**18. Why not have n8n process invoices?**  
Current design keeps files and extracted policy text in the app path and sends n8n minimal event IDs. This limits sensitive content in execution logs and keeps Supabase the source of truth.

**19. Does the chatbot answer general questions?**  
Not currently. It answers questions over selected indexed ProductVault documents. General mode is pending and must be clearly separated from policy interpretation if added.

**20. Are citations trustworthy?**  
The app accepts only IDs retrieved for the request and renders document/page from stored metadata. That verifies citation linkage, not whether every generated statement is semantically supported. Human-reviewed tests remain needed.

### Feasibility and business

**21. Is it feasible?**  
A bounded English prototype is feasible. Production reliability requires solving OCR, evidence quality, isolation, and recovery. Live upload-to-answer, cross-user denial, durable processing, and OCR runtime are still release checks.

**22. How will you measure success?**  
On a disclosed test set: key-field extraction, citation support, retrieval relevance, abstention on missing/conflicting evidence, user task completion/time, and correction rate. We have no verified percentage targets and will not invent them.

**23. How are you different from Itemtopia?**  
Itemtopia already offers inventory, receipts, warranties, service history, reminders and sharing. We don't claim those basics are unique. We explore selected-policy Q&A and claim preparation attached to the product lifecycle; this needs user validation and is not fully live.

**24. How are you different from Product Wallet?**  
Product Wallet advertises AI identification, receipt capture, warranties, manuals, reminders, sharing, insurance and recall features. There is overlap. ProductVault explores a source-grounded policy/claim workflow for an India-first product record, which still needs validation.

**25. What about Fabric?**  
The name is ambiguous. The fabric.so page reviewed describes an AI workspace for research, notes, projects, code and agents, not a like-for-like ownership product. We should clarify which Fabric if asked.

**26. Why can’t a competitor copy it?**  
They can copy a broad idea; we claim no exclusivity. Our task is to build reliable evidence-linked workflows, trust, integrations and quality. Those are potential execution advantages, not current legal protection.

**27. What is your IP?**  
Original code/design/text may be protected subject to ownership/licences. We have not claimed a patent or registered trademark. Ideas alone are not protected by copyright; trademark clearance and legal advice are still needed.

**28. Are you an insurance/legal advisor?**  
No. It explains user-provided terms and organizes evidence; it cannot bind an insurer/manufacturer or guarantee a claim. Users should confirm consequential terms with the provider.

**29. What if OCR or the model is wrong?**  
Expose uncertainty, let users correct fields, cite sources, and abstain when evidence is unreadable or contradictory. We still need representative-document tests; guardrails do not mean zero errors.

**30. How do you handle wrong/stale prices?**  
Store timestamp, retailer/source, availability, and match status; ambiguous/failed checks must not replace verified observations. Automated checks are not live-enabled now; manual tracking is the fallback.

**31. Can it submit a claim automatically?**  
No. Intended flow is a draft and explicit human review before external communication. The current n8n workflow is inactive.

**32. How will you make money?**  
Consumer premium or B2B/white-label are hypotheses. Pricing, partnerships, and willingness to pay are not validated. First show a measurable workflow benefit for a clear user group.

**33. What's the B2B opportunity?**  
A retailer/service provider might improve support or claim readiness through product-linked records. But org roles, consented sharing and tenant isolation are not implemented; consumer RLS is not company access.

**34. Biggest risk?**  
Trust: wrong policy explanations or exposed personal documents. We use selected-source retrieval, provenance, uncertainty, private files, and human approval as design controls, but full validation remains pending.

**35. What comes next?**  
Prove signed-in synthetic upload-to-cited-answer and two-user isolation. Make indexing durable and test OCR on representative Indian documents. Then finish claim handoff; only later enable reminders/prices/emails after migration, credentials, retailer review and synthetic tests.

## 8. Pitch strategy and demo discipline

### One explanation to remember

> “ProductVault ties a product to its purchase proof, documents, and next actions. The assistant retrieves only from documents the user selects and points back to their source. It can help prepare a claim, but a human stays in control. The prototype has pieces of this pipeline; we are still validating the complete live journey and automation.”

### Demo sequence

1. Use a synthetic invoice and warranty with one clear clause.
2. Show product creation, attached file, processing state, then ask one supported question.
3. Open the cited page and ask one question the document cannot answer; show uncertainty/abstention.
4. Say if any step is sample data, local-only code, or non-live workflow.
5. Do not show real customer documents, secret values, raw database dashboards, or unsanitized execution logs.
6. If the live test is not ready, present a labelled prototype walkthrough and explain the next verification step.

### Claims to avoid

“Guaranteed covered,” “claim approved,” “legal advice,” “fully private,” “zero risk,” “production ready,” “real-time price tracking,” “full multimodal RAG,” “complete n8n integration,” “patent pending,” “registered trademark,” “cannot be copied,” or any unmeasured time/accuracy/adoption/claim-success percentage.

## 9. Primary sources for continued study

### ProductVault source of truth

- [PRD](../PRD.md)
- [RAG integration status](rag-live-integration.md)
- [n8n integration status](n8n-integration.md)
- [Assistant answer route](../apps/web/src/app/api/assistant/answer/route.ts)
- [Document indexing route](../apps/web/src/app/api/products/%5Bid%5D/documents/%5BdocumentId%5D/index/route.ts)
- [Invoice extraction route](../apps/web/src/app/api/products/extract-invoice/route.ts)
- [Claim processor](../apps/web/src/lib/claims/process-claim.ts)
- [Reminders scheduler route (local draft)](../apps/web/src/app/api/integrations/n8n/reminders/route.ts)

### Official technology references

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase private Storage access](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns)
- [Supabase RAG permissions](https://supabase.com/docs/guides/ai/rag-with-permissions)
- [Supabase/gte-small model card](https://huggingface.co/Supabase/gte-small)
- [Groq Chat Completions](https://console.groq.com/docs/text-chat)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
- [n8n Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n execution data minimization/pruning](https://docs.n8n.io/deploy/host-n8n/configure-n8n/scaling/manage-execution-data/)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)

### Official problem, competitor, and IP references

- [India Department of Consumer Affairs, Consumer Handbook](https://consumerhelpline.gov.in/public/assets/docs/consumerhandbooks/Consumer_Handbook.pdf)
- [National Consumer Helpline consumer-durable guide](https://consumeraffairs.nic.in/sites/default/files/file-uploads/consumer_information/NCH.pdf)
- [Itemtopia official home inventory page](https://www.itemtopia.com/home-inventory-app/)
- [Product Wallet official site](https://productwallet.app/) and [features](https://productwallet.app/features)
- [fabric.so official page](https://fabric.so/marketplace)
- [Cover Your Assets official page](https://www.coveryourassets.ai/)
- [IP India copyright FAQ](https://www.ipindia.gov.in/page-content/faqs-1)
- [IP India trademark basics](https://ipindia.gov.in/basics-of-trademarks)
- [IP India patent basics](https://ipindia.gov.in/basics-of-patents)
- [Indian Patents Act Section 3](https://ipindia.gov.in/acts/patent-act-1970/section-3)
- [WIPO trade secrets overview](https://www.wipo.int/en/web/trade-secrets/)
- [WIPO trade-secret protection practices](https://www.wipo.int/en/web/trade-secrets/protection)

