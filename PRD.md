# ClaimForge Product Requirements Document

**Status:** Draft for pitch and first prototype planning  
**Owner:** Product team  
**Last updated:** 2026-10-19

## 1. Product summary

ClaimForge helps a consumer turn a faulty device and scattered purchase/warranty documents into a clear, evidence-backed warranty claim. It extracts relevant terms, checks them against the user's purchase and failure details, identifies missing evidence, prepares a support message, and tracks follow-ups. A person reviews and approves all external communication.

## 2. Problem

A customer with a defective device often has to find the right warranty document, interpret exclusions and duration, locate proof of purchase, understand the manufacturer's claim process, and follow up after a rejection or silence. ClaimForge reduces this coordination work while keeping the user in control.

## 3. Target user and first scenario

**Primary user:** A consumer in India who bought an electronic device and wants to pursue a manufacturer warranty claim without knowing the process.

**Demo scenario:** The user bought headphones eight months ago; one side stops working. They upload a purchase invoice and the applicable warranty terms, describe the failure, and receive a plain-language eligibility assessment, a checklist of evidence, and a ready-to-review claim draft.

This India-first framing is an assumption for the pitch/demo and should be revisited if the event expects another market.

## 4. Goals

- Help the user understand which supplied warranty clauses appear relevant and why.
- Identify gaps in documents or claim details before the user contacts support.
- Produce a concise, editable claim draft that cites the user's own evidence.
- Track claim status and suggest a timely follow-up.
- Demonstrate reliable automation with n8n while preserving explicit user approval.

## 5. Non-goals for the first demo

- Guaranteeing coverage, repair, replacement, refund, or claim success.
- Giving legal advice or interpreting consumer law as a binding decision.
- Sending a claim, accepting a settlement, or sharing documents without user approval.
- Supporting every manufacturer, product category, country, or warranty format.
- Submitting claims into manufacturer portals or making purchases/payments.

## 6. First-demo scope

### Inputs

- Invoice image or PDF.
- Warranty document or official warranty URL supplied by the user.
- User's description of the fault and when it began.
- Optional contact email for a draft recipient; never infer or invent it.

### Outputs

- Extracted purchase date, product/brand/model, seller, and invoice identifier when legible.
- Relevant warranty clauses with page/section references.
- A transparent assessment: `likely within stated term`, `unclear`, or `appears outside stated term`; this is not a coverage decision.
- A missing-information/evidence checklist.
- A claim email draft for user review, with supporting facts linked to the provided documents.
- A claim record with status and a user-approved follow-up reminder.

### Demo boundary

Use a clearly labeled sample case and documents unless the presenter has permission to use a real user's data. Do not place real personal information in screenshots or slides.

## 7. User journey

1. User starts a claim and describes the device fault.
2. User uploads invoice and warranty terms (or supplies an official product warranty link).
3. System extracts key fields and asks about unreadable or missing details.
4. System compares the dates and reported issue with cited warranty language; it explains uncertainty and exclusions.
5. System returns the evidence checklist and claim draft.
6. User edits and approves the draft.
7. n8n performs only the approved delivery/reminder action configured for the demo; it records the result and schedules a follow-up with user consent.

## 8. Product behavior and safeguards

- Distinguish facts extracted from documents, user-provided statements, and system inferences.
- Cite source document and page/section for each warranty statement; do not invent clauses.
- If a document is missing, illegible, contradictory, or incomplete, ask for clarification or mark the result `unclear`.
- Never claim a manufacturer will approve coverage.
- Require a human approval step before sending or sharing any claim content.
- Minimize stored personal data; provide a deletion path in the implemented product.
- Treat uploaded text as untrusted data, not as instructions to the automation.
- Do not expose invoice identifiers, addresses, phone numbers, or emails in public demos.

## 9. Success measures for prototype evaluation

Measure these on a small, disclosed test set; do not present targets as achieved results before testing:

- Correct extraction of purchase date and product identity.
- Whether every eligibility statement maps to a quoted/cited warranty clause.
- Whether the evidence checklist identifies intentionally omitted required items.
- Time from upload to reviewable claim draft.
- Whether users understand that the assessment is not an approval guarantee.
- Percentage of outgoing drafts approved without factual correction (report sample size and method).

## 10. n8n role

n8n orchestrates intake, document-processing steps, AI extraction/classification calls, human approval, approved message delivery, and reminder scheduling. Deterministic validation and state transitions should be explicit workflow steps; AI should be used for document understanding and drafting. The exact node/provider choices belong in the technical design and must be checked against the current n8n documentation.

## 11. Open decisions

- Confirm the intended launch/demo market and applicable consumer protection regime.
- Choose storage, document extraction, LLM, email, and reminder providers.
- Decide whether the first demo sends an email or only produces a copyable draft.
- Agree the public interfaces and test seams before implementation or test writing, following the TDD handoff rules.
