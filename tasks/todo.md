# ProductVault n8n integration — task checklist

Plan: [plan.md](plan.md)

## Before implementation

- [x] Review and approve the n8n architecture and claim-only first slice.
- [x] Confirm the proposed public behavior seams before tests are added.
- [x] Confirm the approved app-side Groq document-processing use.
- [ ] Confirm the current ngrok URL and local app port when ready to test.

## Implementation phases

- [x] Phase 0: finalize event/result contracts and secret/retention preflight.
- [x] Phase 1: add a local draft of the durable, idempotent claim-event outbox, bounded retry lease, and owner-authenticated retry action.
- [x] Phase 2: implement a protected app-side claim processor that keeps private documents outside n8n.
- [x] Phase 3: update only the `ProductVault App API` workflow; keep it inactive and preserve the other workflow.
- [x] Checkpoint A: user confirmed claim event contract before workflow implementation.
- [ ] Phase 4: run valid, invalid, unauthorized, duplicate, retry, and completed synthetic cases through ngrok (blocked on live migration/credential/current tunnel).
- [ ] Checkpoint B: review evidence before any production activation.
- [ ] Phase 5: reconcile/apply only reviewed additive live schema changes, configure stable HTTPS secrets, and verify the deployed synthetic path.
- [ ] Phase 6: separately scope reminders or other automations only after claim processing is stable.

## Completion criteria

- [ ] Claim processing status and results are read from Supabase with owner-scoped access.
- [x] The code and workflow define authenticated, idempotent app-to-n8n and n8n-to-app boundaries; live verification remains pending.
- [x] The workflow payload contract contains only event/claim/product identifiers; confirm execution data again in synthetic live testing.
- [ ] Human approval remains required for any external claim communication.
- [ ] The workflow remains inactive until explicitly approved after verification.
- [ ] Tests, type checks, lint, structural workflow validation, and the approved synthetic end-to-end checks pass; unrun checks are reported as unverified.
