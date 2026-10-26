# ProductVault — slide copy and visual direction

Use this alongside [the deck outline](pitch-deck-outline.md). It follows the uploaded Reforged '26 format exactly. The deck is 16:9. Copy below is intentionally short enough to place on slides; keep fuller explanations for speaker notes.

## Slide 1 — Title

**ProductVault**  
**Turn warranty paperwork into a claim you can act on.**  
AI-assisted claim preparation and follow-up, with the customer in control.

`[Team name] · [Team members] · [Track]`

**Visual:** Three connected artifact cards: invoice, highlighted warranty clause, review-ready claim. Avoid fake product screenshots; use a clearly marked concept mockup if the app is not built.

## Slide 2 — Idea

**Headline:** A device fails. The next steps are scattered across paperwork, policy pages, and support channels.

**Demo case (illustrative):** “Eight months after purchase, one side of my headphones stops working. What does the warranty say, what proof is missing, and how do I make the claim?”

**Current effort:** Find proof of purchase → locate and interpret the terms → gather evidence → contact support → remember to follow up.

**ProductVault:** Upload the invoice and warranty terms. Get source-linked facts, a plain-language view of relevant clauses, a missing-evidence checklist, and an editable claim draft.

**Real-world context chart:**

- 2017: 37,062 average monthly complaints registered with India's National Consumer Helpline.
- 2024: 112,468 average monthly complaints registered.
- Derived comparison: about **3.0×** the 2017 monthly average.

Use a two-point slope chart with a y-axis starting at zero (or clearly labeled values). Caption it: **“Broad consumer grievances across sectors; not warranty-specific.”** Source: [PIB / Department of Consumer Affairs, 7 Feb 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2100545&lang=2&reg=48). This establishes context only; do not call it ProductVault demand, warranty-claim growth, or market size.

**Presenter note:** The specific headphone journey is a demo scenario, not a research interview or customer testimonial. The workflow-friction framing is a product hypothesis to validate.

## Slide 3 — Technical architecture

**Headline:** Evidence in. Cited claim brief out. Customer approval before anything is sent.

**Diagram labels:**

`Customer form + invoice + warranty terms` → `n8n intake` → `File validation + text extraction` → `Evidence and clause mapping` → `Cautious assessment + missing items` → `Editable claim draft` → `Customer approval` → `Email or copyable draft` → `User-approved reminder`

Add a small sidecar: `Claim status + source references`.

**Mark the boundary:**

- Deterministic: input validation, date comparison, required-field checks, claim status, approval gate, idempotent send.
- AI-assisted: extract clauses, explain relevant wording, draft a message.
- Human-owned: confirm facts, edit the claim, approve any external communication.

**Implementation honesty:** Label the architecture **“Proposed demo architecture”** until built. Show only the n8n nodes/services actually used in the live demo. n8n's Form Trigger supports a file-upload intake form; its human-in-the-loop feature can pause an action for approval. Cite the [Form Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger/) and [human-in-the-loop](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools/) docs.

## Slide 4 — Workflows / demo storyboard

**Headline:** One headphone failure, from upload to a reviewed next step.

Show five numbered UI frames or a three-lane swimlane (`Customer / ProductVault / n8n`):

1. **Describe:** “Headphones; left side stopped working.”
2. **Upload:** Invoice and warranty terms.
3. **Check:** Confirm extracted purchase date/model; inspect cited warranty wording and any uncertainty.
4. **Prepare:** Review evidence checklist and editable claim draft.
5. **Approve:** Customer approves a copyable message or configured send; optionally chooses a follow-up reminder.

**Demo result card (avoid invented outcomes):** `Status: Needs your review` · `Evidence: invoice + warranty terms` · `Next: verify details, then approve draft`.

Do not state the sample headphones are eligible unless the actual sample warranty and invoice substantiate it. If synthetic, label every screen/document **“Sample data.”**

## Slide 5 — USP

**Headline:** ProductVault connects the warranty wording to the next action.

Use three proof points as a row of cards:

- **Evidence-linked:** Show the clause and document location behind each warranty-related statement.
- **Action-ready:** Turn the review into a missing-items checklist and editable claim draft.
- **Customer-controlled:** Keep sending and follow-up behind explicit user approval.

**Simple visual:** `Documents → cited case brief → approved next step`.

Frame these as the proposed product design. Do not claim better success rates, money recovered, faster resolution, or superiority to named competitors without comparative evidence. If comparing with “manual process” or “generic chatbot,” label it as a conceptual capability comparison, not benchmark results.

## Slide 6 — Mentoring feedback and improved implementation

The template says this slide is **“To be submitted in Offline Round.”** For the first submission, follow the event instructions. Do not invent mentor feedback.

When actual mentoring feedback exists, use:

| Feedback received | Change made | Evidence in demo |
|---|---|---|
| `[Exact feedback, mentor/session/date]` | `[Specific product or workflow change]` | `[Updated screen, workflow, or test result]` |

Until then, keep this slide as a clearly marked placeholder if required, or ask the organizer whether it should be omitted. The content should be factual and traceable.

## Slide 7 — References and sources

Put compact numbered footnotes beside slide claims and list full references here:

1. PIB / Department of Consumer Affairs, “National Consumer Helpline…,” 7 Feb 2025 — broad NCH complaint volumes and disposal time. [Source](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2100545&lang=2&reg=48)
2. National Consumer Helpline, “About NCH” — pre-litigation grievance channel and consumer process. [Source](https://consumerhelpline.gov.in/public/about)
3. Department of Consumer Affairs, Consumer Protection Act and rules. [Source](https://consumeraffairs.nic.in/acts-and-rules/consumer-protection/consumer-protection)
4. n8n documentation, Form Trigger. [Source](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger/)
5. n8n documentation, human-in-the-loop for tools. [Source](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools/)
6. `[Add any libraries, models, datasets, or licensed assets actually used in the prototype.]`

Credit only tools and assets actually used. Check the final slide citations against [research.md](../research.md); that file records the evidence boundaries and additional official references.

## Slide 8 — Thank you

**ProductVault**  
**Make the next warranty claim clear, evidenced, and easier to pursue.**

`[Team/contact] · [Demo QR, if live and approved]`

**Visual:** Reuse the three-card motif from Slide 1, now with a checked “reviewed by customer” marker. Do not imply claim approval or resolution.

## Design consistency

- Match the reference deck's section headings and 16:9 canvas; use one main idea per slide.
- A restrained palette can help the product feel trustworthy: dark ink, warm off-white, and one forge-orange accent. Keep orange for focus; use red only for actual errors.
- Prefer interface crops, annotated source clauses, a clean workflow diagram, or the sourced slope chart over decorative stock icons.
- Keep sources readable near the claim or graphic they support. Preserve period labels and caveats when charts are copied.
