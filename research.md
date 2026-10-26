# ProductVault research notes

Research snapshot: 19 October 2026. These notes support a student pitch deck and demo; they are not legal advice. Use official sources for factual claims and label the proposed product behavior as a design assumption.

## Pitch-ready evidence

### Consumer grievance context (India)

The Department of Consumer Affairs reported that average monthly complaints registered with the National Consumer Helpline (NCH) rose from **37,062 in 2017 to 112,468 in 2024**. Average monthly digitally registered grievances were **68,831 in FY 2024–25 through December 2024**. The Department reported grievance disposal time at **48 days in 2024**, down from **66.26 days in 2023**. These are broad consumer grievance figures across sectors; they are **not warranty-claim counts**, and should not be presented as ProductVault's addressable market or as proof that warranty issues alone are growing. [PIB / Department of Consumer Affairs, 7 Feb 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2100545&lang=2&reg=48)

An earlier Department release gives a useful sector context: NCH averaged **102,976 dockets per month in 2023–24**, and handles issues across areas including **electronic products** and **consumer durables**. This supports the relevance of a consumer-issue workflow, not a warranty-specific demand estimate. [PIB / Department of Consumer Affairs](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2036345&lang=2&reg=48)

**Suggested visual:** a two-point line or slope chart: “Average NCH monthly complaints registered” at 37,062 (2017) and 112,468 (2024). Add a footnote: “All consumer grievance categories; not warranty-specific.” If including the digital figure, use a separate callout and preserve its period wording (FY24–25, through Dec 2024).

**Do not infer:** unmet warranty claims, market size, success rate, money recovered, or customer savings from NCH grievance totals. The NCH data is for broad registered consumer grievances, and the cited release does not break out warranty claims.

### India consumer-protection context

The Consumer Protection Act, 2019 provides the national statutory framework for consumer interests and dispute settlement. The Act and rules are available from the Department's official [Consumer Protection page](https://consumeraffairs.nic.in/acts-and-rules/consumer-protection/consumer-protection); the Act text is available [here](https://consumeraffairs.nic.in/sites/default/files/CP%20Act%202019.pdf).

The official NCH describes itself as a pre-litigation, alternate grievance-redressal channel. Consumers can lodge grievances through its portal and other channels, attaching relevant documents if available; NCH generates a docket number. [NCH About / process](https://consumerhelpline.gov.in/public/about). Current listed channels include phone **1915**, web, app, WhatsApp, SMS, and UMANG; the portal says the service is available in 17 languages. [NCH Convergence Program](https://www.consumerhelpline.gov.in/public/convergenceprogram)

The Act's product-liability provisions should not be described as an automatic warranty entitlement: the NCH's own Act explainer says “harm” for product-liability purposes excludes harm to the product itself and economic loss related to breach of warranty. [NCH Consumer Protection Act FAQ](https://consumerhelpline.gov.in/public/knowledgebasedetails/Consumer%20Protection%20Act%202019). A particular repair/replacement decision depends on the applicable warranty terms, exclusions, proof, and case facts. Do not claim every in-warranty failure must be repaired or replaced, or that ProductVault decides legal entitlement.

**Suggested visual:** a factual “where consumers can escalate” ladder: seller/manufacturer support → NCH pre-litigation grievance channel → appropriate Consumer Commission if unresolved. NCH describes its own role as pre-litigation and says consumers who are unsatisfied may approach the appropriate Commission. [NCH About](https://consumerhelpline.gov.in/public/about)

## n8n architecture notes for the demo

An n8n **Form Trigger** can provide the intake form and start a workflow when a consumer submits it. Its supported form elements include file upload; published production forms run when submitted. [n8n Form Trigger documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger/)

A **Webhook** can start a workflow from an external event or serve as an API endpoint returning workflow output. n8n documents test and production URLs and supports Basic, Header, or JWT authentication. [n8n Webhook documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)

For a higher-risk action such as sending a claim email, n8n's **human-in-the-loop** capability can pause an AI tool call until a person approves or denies it. [n8n human-in-the-loop documentation](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools/)

**Demo workflow proposal (product assumption, based on these n8n capabilities):**

1. Customer enters product, purchase date, issue, contact details, and uploads invoice plus warranty terms through a form.
2. Workflow extracts document text and structures purchase date, model/serial number, warranty period, and relevant exclusions; preserve page/quote references so the customer can check the evidence.
3. Workflow produces a cautious preliminary assessment: likely within stated period / likely outside stated period / unclear; list supporting clause(s), missing facts, and next evidence needed. Do not present this as a legal ruling or guaranteed outcome.
4. Workflow drafts a concise claim with attachments/evidence checklist and proposed next step.
5. Customer reviews and explicitly approves before the workflow sends anything externally; log submission time, recipient, and response/follow-up status.
6. On no response, send a reminder draft or notification after a user-configured interval; keep escalation to NCH as an option for the customer rather than submitting a complaint automatically.

For an architecture slide, show the real n8n nodes that match the implementation (Form Trigger/Webhook → document extraction and rules → AI-assisted draft → human approval → email/send → wait/reminder/status). Treat document parsing, warranty-term interpretation, storage, reminder schedule, and email provider as implementation choices to verify in the actual prototype; the cited core-node documentation only establishes intake/webhook/approval capabilities.

## Evidence boundaries and wording

- **Sourced fact:** NCH receives large and rising volumes of broad consumer grievances; it covers electronics/consumer durables among other sectors.
- **Not established by cited data:** what share concerns warranties, the number of potentially eligible warranty claims, rejection frequency, average claim value, or ProductVault conversion/success rates.
- **Product hypothesis:** consumers may benefit from organizing proof, matching facts to written terms, drafting communications, and tracking follow-ups. Validate this with user interviews or a small pilot before stating it as a measured finding.
- **Safe demo wording:** “ProductVault helps a customer understand the written warranty terms, organize supporting evidence, and prepare a claim for review.” Avoid “guarantees approval,” “wins claims,” or “automatically enforces consumer rights.”

## Primary references

- [Department of Consumer Affairs — Consumer Protection Act and rules](https://consumeraffairs.nic.in/acts-and-rules/consumer-protection/consumer-protection)
- [Consumer Protection Act, 2019 (official PDF)](https://consumeraffairs.nic.in/sites/default/files/CP%20Act%202019.pdf)
- [National Consumer Helpline — About and grievance process](https://consumerhelpline.gov.in/public/about)
- [National Consumer Helpline — Convergence Program](https://www.consumerhelpline.gov.in/public/convergenceprogram)
- [PIB — NCH scale and average disposal time, 7 Feb 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2100545&lang=2&reg=48)
- [PIB — NCH monthly docket average and sectors](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2036345&lang=2&reg=48)
- [NCH — Consumer Protection Act FAQ](https://consumerhelpline.gov.in/public/knowledgebasedetails/Consumer%20Protection%20Act%202019)
- [n8n Form Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger/)
- [n8n Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n human-in-the-loop for tools](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools/)
