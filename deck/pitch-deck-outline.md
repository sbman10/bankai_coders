# Reforged '26 Pitch Deck Outline

This outline follows the uploaded eight-slide deck: Title, Idea, Technical Architecture, Workflows, USP, Offline Round Feedback, References and Sources, Thank You. Keep each slide visual and make the proof legible; do not fill the deck with paragraphs.

## Slide 1 — Title

**Title:** ClaimForge  
**One-liner:** From confusing warranty terms to a review-ready claim.  
**Subtitle:** AI-assisted warranty claim preparation and follow-up, with the customer in control.  
**Visual:** A clean claim dossier: invoice → highlighted warranty clause → ready-to-review email. Use a product mockup, not a stock robot/hammer image.  
**Footer:** Team name, members, track.

## Slide 2 — Idea: make the pain concrete

**Opening scenario:** “Eight months after buying headphones, one side stops working. Is it covered? What proof does support need? What if they say no?” Label this as the demo scenario, not research evidence.  
**Problem journey visual:** Find receipt → interpret terms → gather evidence → contact support → track response. Show where consumers lose time/friction.  
**Solution:** ClaimForge reads the supplied invoice and terms, shows relevant clauses and missing evidence, drafts a claim, and tracks the user's chosen follow-up.  
**Proof panel:** Add one or two verified real-world facts from `research.md`, each with the source and year in the slide footer. If evidence is unavailable, use a clearly labeled user journey rather than invented percentages.  
**Presenter content:** Target user, pain, why now, and the single outcome the product improves.

## Slide 3 — Technical architecture

**Visual:** Left-to-right system diagram with the user in control:

`User upload + fault description → secure intake → n8n workflow → document extraction → terms/evidence analysis → claim brief + draft → human approval → copyable draft / approved email + reminder`

Show the document store and claim status store as distinct components. Draw an approval gate before any external action. Distinguish deterministic checks (file type, dates, state, approval) from AI tasks (clause extraction, plain-language explanation, drafting). Mark any unchosen provider as “TBD”; do not imply an integration is already built. Cite current n8n docs in references.

## Slide 4 — Workflow / live demo

Use the provided headphone example as a 5-step storyboard:

1. Upload invoice and warranty terms.
2. Confirm extracted device/date and describe “left side stopped working.”
3. See cited warranty term plus missing evidence/uncertainties.
4. Review and edit the claim draft.
5. Approve a copyable/sendable message and optional follow-up reminder.

Show sample UI panels or a swimlane with `Customer`, `ClaimForge`, and `n8n`. Include a visible “Needs your review” gate. If the demo uses synthetic documents, label them sample data.

## Slide 5 — USP

Lead with the specific differentiation: ClaimForge connects warranty evidence to action, with traceable clauses and a user-controlled approval point.  
**Comparison visual:** Generic chatbot (answers, weak case tracking) vs. manual process (user coordinates everything) vs. ClaimForge (evidence-linked brief + draft + reminder). Mark this as a capability comparison, not independently measured competitor research.  
**Trust design:** Every claim fact cites a source; uncertainty is explicit; no claim is sent before approval.  
**Moat / defensibility content:** propose only if supportable (e.g., workflow quality and source-linked case history); label as a hypothesis, not an established moat.

## Slide 6 — Mentoring feedback & improved implementation

The reference deck says this is for the offline round. For an initial submission, follow the event rubric: either retain it as a planned iteration slide with clearly marked “to validate” questions, or omit it only if the official submission instructions allow. Never invent mentor feedback.  
If retaining: use a 2-column `Feedback received` → `What changed` table, with date/mentor context, and cite/describe only actual feedback. Add an open question if no feedback has been received yet.

## Slide 7 — References and sources

Use compact citations for every statistic and product fact. Include official n8n docs, official consumer/warranty sources relevant to the chosen market, and any dataset/source used. Provide title, publisher, date/year, and short URL/QR. Credit open-source libraries and licensed products actually used. Use `research.md` as source-of-truth; don't cite claims that aren't in it.

## Slide 8 — Thank you / call to action

**Closing line:** “Make the next warranty claim clear, evidenced, and easier to pursue.”  
**Visual:** Repeat the claim dossier motif, now with a completed review checklist.  
**Footer:** Team contact/demo QR if available and approved.

## Visual system

- 16:9 landscape. Follow the reference deck's simple section headings and generous whitespace.
- Use a calm, precise visual language: dark ink, warm off-white, and one bright forge-orange accent; reserve red for real error/uncertainty states.
- Use one key message per slide; keep citations readable and near the data they support.
- Prefer a real interface flow, clause annotation, timeline, or source-backed chart over decorative icons.
- Avoid stock imagery of robots, gavels, shields, or fake customer testimonials.
