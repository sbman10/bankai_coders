# ProductVault Product Requirements Document

**Status:** Draft for pitch and MVP planning
**Owner:** Product team
**Last updated:** 2026-10-28

## 1. Product summary

ProductVault is a product and coverage assistant that helps people make informed decisions before and after they buy. Before purchase, a user can ask plain-language questions about a product’s warranty, protection plan, or an insurance policy/service—for example, exclusions, waiting periods, required documents, and how claims are filed. Answers must be grounded in the relevant documents or official source material, with citations and clear uncertainty.

After purchase, ProductVault helps the user keep product details and documents together, track prices manually or through a verified retailer check, receive warranty/policy/service/replenishment/claim reminders, and understand and prepare a warranty claim. The user remains in control of all external communication and claim submissions.

**Product promise:** Turn product ownership into peace of mind—from understanding coverage before you buy to managing products and claims afterward.

## 2. Problem

Before buying, people may struggle to compare dense warranty, protection-plan, or insurance terms. Marketing summaries can omit exclusions, waiting periods, deductibles, claim limits, and required evidence. After buying, receipts and policy documents become scattered, while price changes, replenishment dates, service needs, and claim steps are easy to forget.

ProductVault reduces this work by organizing source documents, answering questions with traceable evidence, and helping the user take the next step without presenting an AI answer as a binding coverage decision.

## 3. Target users and scenarios

**Primary user:** A consumer who wants to understand the terms attached to a product or service before committing, and manage the purchase afterward.

**Pre-purchase scenario:** A user is considering headphones with an extended protection plan, or an insurance service. They provide or select the relevant policy/terms and ask: “Does accidental damage appear to be covered?”, “Is there a waiting period?”, or “What documents would I need to make a claim?” ProductVault gives a cited explanation or says the supplied evidence is insufficient.

**Post-purchase demo scenario:** A user bought headphones eight months ago; one side stops working. They upload the invoice and applicable warranty terms, describe the fault, and receive relevant cited terms, an evidence checklist, and a reviewable claim draft.

**Everyday ownership scenario:** A user records a sunscreen purchase, its price, and an estimated 1.5-month usage period. ProductVault can show the manually recorded price and remind the user in-app when it may be time to replenish it.

The India-first market framing is an assumption for the pitch/demo. Terms, regulations, and appropriate sources may differ by country and insurance product; the launch market must be confirmed before broader rollout.

## 4. Goals

- Let users ask pre-purchase questions about supplied product warranty, protection-plan, and insurance/service policy documents.
- Ground policy explanations in retrieved source text and show the document name plus page/section for each material statement.
- Make uncertainty visible; ask a focused follow-up or abstain when evidence is missing, incomplete, illegible, or conflicting.
- Help users organize purchased products, receipts, warranty/policy documents, and key dates in one ownership record.
- Support manually entered prices, optional verified retailer checks, and user-owned reminders for warranty/policy expiry, service, replenishment, and claim follow-up.
- Provide a durable owner-scoped in-app notification inbox; send email reminders only after explicit opt-in and provider configuration.
- Help users understand post-purchase claim steps, identify missing evidence, and prepare an editable claim draft.
- Preserve explicit human approval before any claim, complaint, settlement response, or personal document is sent externally.
- Demonstrate how n8n can orchestrate selected events while Supabase remains the durable source of truth for app data.

## 5. Non-goals

- Guaranteeing that a product, repair, treatment, loss, or event is covered or that a claim will succeed.
- Giving legal, financial, or insurance-broker advice, recommending a policy as suitable, or making a binding interpretation of a contract.
- Replacing the insurer, warranty provider, regulator, lawyer, or official claims process.
- Inventing or assuming policy terms when no applicable source is available.
- Automatically buying products, changing/cancelling policies, submitting claims, accepting settlements, or sharing user documents.
- Supporting every country, insurer, manufacturer, policy format, or product category in the first demo.
- Automated web price scraping or claiming a live price without a verified source and timestamp.
- Treating n8n execution logs as the user’s product, claim, document, or policy record.

## 6. First-demo and MVP scope

### 6.1 Pre-purchase: policy and coverage Q&A

**Inputs**

- A policy, warranty, protection-plan document, or official URL supplied or explicitly selected by the user.
- The product/service or plan the user is asking about.
- The user's question; optional context needed to interpret the question, clearly labeled as user-provided.

**Outputs**

- A concise plain-language response tied to the supplied material.
- Source citations with document name and page/section where available.
- A typed evidence outcome such as `supported by supplied terms`, `conditional`, `insufficient evidence`, or `conflicting terms`.
- A focused follow-up when a key fact is missing, such as purchase date, location, plan tier, or event details.
- A clear separation between quoted/extracted policy facts, user-provided facts, and ProductVault's explanation or inference.

**Rules**

- Do not decide or promise that a future event will be covered. Explain what the source says and what remains conditional or unknown.
- If the user has not supplied or selected an applicable source, ask for one or direct them to verify with the provider; do not fabricate an answer from generic model knowledge.
- For insurance questions, explain wording and claim steps only. Do not recommend purchase, estimate a likelihood of approval, or give a binding coverage determination.

### 6.2 Post-purchase: product ownership and claim preparation

**Inputs**

- Product name, brand/model, category, purchase date, and seller when known.
- Invoice image/PDF and warranty or protection document/official URL, as available.
- User's description of a fault/event and when it occurred.
- Optional manually entered price and expected replenishment/service date.

**Outputs**

- Product ownership record with linked documents and important dates.
- Extracted purchase and product facts only where legible, with review/correction for uncertain fields.
- Relevant cited clauses and an evidence/next-step checklist.
- A transparent claim-assessment explanation, not an approval decision.
- Editable support/claim draft and a claim record.
- In-app reminders for warranty/policy expiry, user-set service and replenishment dates, and claim follow-up.
- Price checks only from supported retailer adapters and only label an observation verified when its retailer, availability, price, and product match pass validation. Manual entries remain labeled as manual.
- Manually recorded price history; entries must show their user-entered source/date and must not be presented as live market data.

### 6.3 Demo boundary

Use clearly labeled fictional/sample documents unless permission has been given to use real personal data. Redact names, addresses, invoice identifiers, phone numbers, and emails in screenshots and presentations.

## 7. User journeys

### Journey A: Ask before buying

1. User chooses a product, protection plan, warranty, or insurance/service policy to understand.
2. User uploads or selects the relevant document or official source.
3. User asks a question in the policy assistant.
4. ProductVault retrieves only the selected, available sources and checks whether they support an answer.
5. ProductVault returns an explanation with citations and an evidence outcome, or asks a clarifying question/abstains.
6. User verifies important terms with the provider before purchase; ProductVault does not make the purchase decision.
7. If the user buys the product/service, they may add it to their ownership records.

### Journey B: Prepare a post-purchase claim

1. User creates or selects a product and describes the fault/event.
2. User uploads an invoice and applicable warranty/policy terms to private storage, or selects existing documents.
3. ProductVault extracts legible details and asks the user to correct or clarify uncertain data.
4. ProductVault explains the relevant source terms and missing evidence, with citations.
5. ProductVault prepares an editable claim draft and records its status.
6. User reviews and explicitly approves any external communication immediately before it is sent. If sending is not configured, the user copies the draft.
7. Claim status and follow-up reminders are shown from the app's saved records.

### Journey C: Manage a product over time

1. User records a purchase and optionally enters its price, expected usage duration, or service date.
2. ProductVault adds documents and dates to that product's ownership record.
3. The app shows manually tracked price entries and schedules in-app reminders based on the user's dates.
4. The user edits or dismisses reminders and maintains their own product record.

## 8. Product behavior, evidence, and safeguards

- Restrict retrieval and product/document access to the signed-in owner and the sources selected for that question.
- Bind citations to stored/retrieved document chunks; do not show model-invented page numbers, section labels, or quotes.
- Distinguish document facts, user statements, and system inferences in both stored data and the interface.
- Return `insufficient evidence` or ask a follow-up when documents are missing, unreadable, stale, contradictory, or not applicable to the user's plan/location/date.
- Show source identity and version/date when available. Do not assume a product page or policy URL is current unless that has been checked.
- Treat uploaded files and extracted text as untrusted content, never as instructions to the system or workflow.
- Keep invoices and policy documents private. Do not send file bytes, OCR text, retrieved policy passages, long-lived public URLs, or secrets to n8n.
- Minimize personal data and provide a deletion path in the implemented product.
- Require recorded, explicit user approval immediately before any external claim/complaint communication. AI output alone cannot authorize sending.
- Make clear that explanations are informational and are not a binding insurer/manufacturer decision or legal/financial advice.
- Keep demo data fictional or properly consented and redacted.

## 9. MVP success measures

Measure on a small, disclosed test set; report sample size and method. Do not present unmeasured targets as achieved results.

**Pre-purchase Q&A**

- Whether each material answer statement is supported by the cited selected source.
- Citation correctness for document/page/section metadata.
- Whether the system abstains or asks a useful follow-up when evidence is missing or conflicting.
- Whether users understand the difference between a source-grounded explanation and a coverage guarantee/recommendation.

**Post-purchase claims and ownership**

- Correct extraction of purchase date and product identity on the test set.
- Whether the evidence checklist identifies intentionally omitted required information.
- Time from document upload to a reviewable result/draft.
- Whether users catch and correct uncertain extracted facts before approval.
- Whether a user can add/edit/delete a product, update a manual price entry, and set/cancel an in-app reminder.
- Whether any external communication is blocked until explicit user approval.

## 10. n8n and system responsibilities

- **Next.js:** user interface and server-side API boundary. It verifies the signed-in session, validates requests, checks ownership, and controls when an automation may be called.
- **Supabase:** durable source of truth for user-scoped products, documents' metadata, claims, reminders, and processing/status records; private Storage holds document files. Database and Storage policies must enforce owner access.
- **n8n:** intended orchestration for selected website-triggered events and scheduled business reminders. A website action should call an authenticated n8n Webhook through the Next.js server route. Recurring tasks can begin from a Schedule Trigger. n8n receives only minimum identifiers/metadata and may call a protected app callback for safe status updates if configured.
- **Status and logs:** the app reads claim/product/reminder state from Supabase. n8n execution logs help operators diagnose workflow runs; they do not replace app records and should not contain document content or secrets.
- **RAG document Q&A/ingestion:** answering is intended to stay on the authenticated Next.js path with owner- and selection-scoped retrieval. Document ingestion/embedding worker design is separate and remains proposed until the queue, Edge Function, and database flow are verified. Do not put the chatbot's critical answer path in n8n.

**Current implementation truth (2026-10-28):** the signed-in dashboard now reads owner-scoped products, reminders, price watches, and claims from the same app APIs used by the product library and timeline; the fictional sample dashboard remains for signed-out preview only. Claim intake and protected app-side claim processing code are present, but the related n8n workflow remains inactive and end-to-end execution is unverified. The local reminders feature code includes the five reminder categories, a Supabase notification inbox, opt-in preference APIs, a protected daily processing endpoint, and a retailer-check path using the merged adapters. Its additive migration and scheduled n8n workflow are not yet live-verified; the workflow has not been activated, no production retailer check has run, and Postmark is not configured. The RAG migration/worker remains not live-verified. Treat these as local implementation pending database/workflow setup and synthetic end-to-end checks, not as production-ready services.

## 11. Open decisions

- Confirm launch geography and what policy/service categories the prototype may discuss.
- Decide how users provide sources: upload, official URL, or both; define source freshness/version checks.
- Confirm whether the initial pre-purchase assistant answers only from user-selected material or also from a vetted public-source catalog.
- Select approved OCR, embedding, and language-model providers, and document processing/data-residency constraints.
- Decide whether the first demo creates a copyable claim draft only or supports an explicitly approved delivery action.
- Confirm Postmark sender verification and credentials before enabling opt-in email reminders.
- Review and apply the local reminders/price-check migration to the intended Supabase project; verify migration history and RLS before using the new APIs against production.
- Configure and validate the inactive daily n8n scheduler with the current public HTTPS app URL and matching Header Auth secret; do not activate before synthetic tests.
- Confirm scraper usage/cost and retailer terms for each supported adapter before automated checks run for real users.
- Define and verify n8n webhook authentication, payload contract, idempotency, callback authorization, and safe execution-data retention before activating a workflow.
- Agree public behavior seams before implementation or test writing; keep the MVP limited to confirmed product behavior.
