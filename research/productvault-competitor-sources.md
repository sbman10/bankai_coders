# ProductVault competitor evidence notes

Research date: 2026-10-27
Scope: first-party public pages only. These sources describe what each company advertises; they do not independently verify feature quality, adoption, availability, security, or performance.

## Itemtopia

Itemtopia positions itself as home and personal inventory software, with business/property workflows. Its public pages describe item records connected to rooms/locations, photos, receipts, warranties, manuals, serial numbers, values, maintenance/service history, reminders, and shared access. It also advertises AI answers about belongings, insurance-oriented reports, QR/barcode labels, offline access, and Business Pro use for properties, teams, and equipment. [Itemtopia home inventory](https://www.itemtopia.com/home-inventory-app/), [Itemtopia product overview](https://www.itemtopia.com/home-3), [Itemtopia inventory features](https://www.itemtopia.com/inventory-app-for-receipts-and-warranties/)

**Implication for ProductVault:** Room/location organization, attachments, service history, reminders, household sharing, reports, and AI questions are not defensible as unique features by themselves. Itemtopia’s stated center is a broad inventory of possessions and places, including business/property use.

## Fabric

Fabric is a broad AI workspace rather than a dedicated ownership-inventory product. It has a warranty-specific experience that advertises a searchable library for warranties, manuals, and receipts; AI coverage answers with citations; searchable service-history annotations; expiry reminders; and password-protected sharing. Its wider workspace also advertises AI search/assistant, files, notes, connected data, and scheduled jobs. [Fabric warranty workspace](https://fabric.so/for-your/warranties), [Fabric overview](https://fabric.so/info/about), [Fabric plans/features](https://fabric.so/pricing-and-plans-for-individuals)

**Implication for ProductVault:** Document search, cited warranty Q&A, and expiry reminders already overlap with Fabric’s stated capabilities. ProductVault should differentiate through a structured product passport and a workflow that takes a user from purchase/import to maintained ownership record, evidence-backed eligibility review, and a user-approved next action—not by claiming that warranty Q&A or reminders are unique.

## Product Wallet

Product Wallet’s public pages describe a consumer product vault and a retailer/brand/insurer-facing white-label offering. Advertised consumer features include scan/photo/barcode/receipt capture, receipt extraction, warranty dates and reminders, searchable manuals, proof-of-ownership records, household sharing, insurance exports, and recall alerts. The enterprise page advertises APIs and mobile SDKs, preloaded wallets, webhook events, and multi-tenant white-labeling. Its pages also show early-access/waitlist messaging, so do not present advertised capabilities as universally available without confirming the actual product status. [Product Wallet features](https://productwallet.app/features), [Product Wallet home](https://productwallet.app/), [Product Wallet enterprise](https://productwallet.app/enterprise)

**Implication for ProductVault:** A digital product vault, OCR/receipt intake, warranty reminders, manuals, household records, and B2B white-label/API positioning overlap. ProductVault’s strongest differentiator should be workflow depth and evidence-grounded decisions, not the vault concept alone.

## ProductVault’s proposed positioning

Position ProductVault as a **product ownership and protection workflow**:

1. **Before buying:** let a user ask a question against a selected seller, warranty, service-plan, or insurance document; return sourced terms and clearly label uncertainty. This relies on evidence the user selects or a verified source, and must not imply a guaranteed coverage decision.
2. **At purchase:** import a commerce link or invoice; extract product and purchase facts for review; create a passport only after user confirmation.
3. **During ownership:** keep documents, warranty/insurance terms, service events, reminders, repair costs, price watch, and replenishment estimates linked to the product.
4. **When something fails:** retrieve only the user's selected, indexed documents; produce an evidence checklist and editable claim draft with citations; user approves any external submission.
5. **For businesses:** offer a separately scoped B2B workspace/API for retailers, warranty administrators, or insurers only after a concrete partner workflow is validated. Do not assert savings or competitive superiority before measuring them.

Potential concise claim: **“A product passport that helps people understand, maintain, and act on the protection they bought.”** This is a positioning proposal, not a verified market claim.

## n8n’s role and honest differentiation

Use n8n as an orchestration layer for **asynchronous, non-critical-path** events: receipt extraction job dispatch, status notifications, reminder delivery, price-check scheduling, and retry/alert workflows. The Next.js server remains the security and product API boundary; Supabase remains source of truth for user-owned product, document, job, and event state. Keep uploads in private Supabase Storage; n8n should receive minimal IDs and short-lived scoped access only if required, never long-lived public document URLs or unnecessary extracted text. The app must tolerate webhook retries and duplicate delivery through idempotency. Keep claim drafting/retrieval and ownership checks in the application backend; do not let an n8n workflow bypass RLS or make unapproved external submissions.

**n8n differentiation to show:** reduced manual follow-up and coordination through visible automated event handling (job status, reminders, escalation/retry, scheduled checks), while a human confirms extracted facts and any consequential action. Do not describe n8n itself as the differentiator; the differentiated outcome is a reliable ownership workflow built around its orchestration.

## Claims to avoid

- “Itemtopia is only a static inventory” or “has no AI/claims/maintenance/sharing.” Its first-party pages advertise AI, service history, claims-related records, sharing, and reports.
- “Fabric only stores PDFs” or lacks warranty-specific RAG/reminders. Its warranty pages advertise cited Q&A and expiry reminders.
- “Product Wallet is just a document wallet” or lacks B2B automation. Its enterprise page advertises white-label APIs/SDKs and webhook events.
- “ProductVault is 10x faster/cheaper/better,” “competitors cannot do X,” or unmeasured legal/claims success, accuracy, OCR cost, and time-saved numbers.
- Calling coverage answers legal determinations. They are document-grounded guidance with uncertainty; the provider/insurer makes the coverage decision.

## Sources

- [Itemtopia — Home Inventory App](https://www.itemtopia.com/home-inventory-app/)
- [Itemtopia — Home overview](https://www.itemtopia.com/home-3)
- [Itemtopia — Receipts, warranties, service records](https://www.itemtopia.com/inventory-app-for-receipts-and-warranties/)
- [Fabric — Warranty workspace](https://fabric.so/for-your/warranties)
- [Fabric — About](https://fabric.so/info/about)
- [Fabric — Plans and features](https://fabric.so/pricing-and-plans-for-individuals)
- [Product Wallet — Home](https://productwallet.app/)
- [Product Wallet — Features](https://productwallet.app/features)
- [Product Wallet — Enterprise](https://productwallet.app/enterprise)
