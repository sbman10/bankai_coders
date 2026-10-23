# Warranty Claim Intake Workflow (Demo)

**Status:** Draft workflow contract for the first ClaimForge demo.  
**Trigger:** User starts a claim and submits required inputs.  
**Workflow owner:** The user owns the claim and approves all external communication; the system operator owns workflow availability and failure handling.

## Inputs

- Invoice file (PDF or image).
- Warranty terms file or user-provided official warranty URL.
- Product fault description and failure date (or approximate date).
- User contact channel only when needed for an approved outgoing message.

## Workflow

Each step updates the claim record status; n8n execution history is not the only source of user-visible status.

1. **Create claim record.** Assign an opaque claim ID and set status to `received`.
2. **Validate files.** Accept only configured file types and size limits; reject unsupported files with a clear explanation. Preserve original document source identity for citations.
3. **Extract evidence.** Extract product, seller, purchase date, and relevant warranty clauses. Record page/section locations and confidence. Low confidence or disagreement is marked for clarification.
4. **Assess against supplied terms.** Compare purchase date and reported failure against the cited term, exclusions, and requirements. Return `likely within stated term`, `unclear`, or `appears outside stated term`; never a final coverage decision.
5. **Build review brief.** Show extracted facts, cited terms, open questions, missing evidence, and a claim draft. Distinguish source facts from inference.
6. **Human checkpoint.** User reviews/edits and explicitly approves the outgoing content. Until approval, no email, portal submission, or external sharing occurs.
7. **Approved action.** For the pitch demo, prefer generating a copyable email draft; if configured to send, send only the exact approved content and record timestamp and result.
8. **Follow-up.** Offer a reminder date chosen or confirmed by the user. n8n triggers the reminder and records delivery status. Do not send repeated reminders without consent.
9. **Close or escalate.** User can mark resolved, rejected, or needs-human-help. If the warranty basis is unclear or the user wants to challenge a rejection, present a factual summary and official support/consumer resources; do not make legal determinations.

## Failure paths

- Corrupt, unsupported, oversized, or unreadable file → explain which input needs replacement; retain no partial conclusion.
- Missing or conflicting purchase/warranty data → ask a targeted clarification; status `needs_information`.
- No cited clause supports a conclusion → status `unclear`; do not draft assertive coverage language.
- AI/service error → retain claim status, report processing failure, and allow retry without creating duplicate external actions.
- Email/reminder provider failure → show failure and preserve a manual copyable draft; do not silently mark sent.
- User declines approval → stop outgoing action; retain draft only per consent/data-retention policy.

## n8n implementation notes

Use n8n to orchestrate the steps and persist explicit claim status. Separate deterministic validation/approval gates from AI extraction and drafting. Store credentials in n8n credential storage, not workflow text. Configure retry/idempotency so retries cannot send duplicate messages. Log event IDs and outcomes without logging document contents or unnecessary personal data.

## Outputs

- Claim state and event history.
- Extracted facts with source locations and confidence.
- Cited assessment and missing evidence list.
- Editable claim draft.
- Approval decision and, if enabled, external-action result.
- User-approved reminder and delivery result.
