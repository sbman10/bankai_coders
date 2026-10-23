# ClaimForge market-gap, manual-effort, and evidence research brief

**Prepared:** 19 October 2026  
**Product context:** ClaimForge is an India-first concept to help consumers organize product records, understand supplied warranty terms, identify missing evidence, prepare a claim message for review, and track follow-ups. The wider concept includes user-configured price alerts and replenishment reminders. These are product hypotheses; planned integrations do not establish effectiveness.

## How to use this brief

Use the India-specific sources for local context and global academic studies for concepts and methods, not Indian prevalence estimates. Official technical documentation shows what n8n can do; it does not prove user demand or time savings. Treat all ClaimForge impact claims as unmeasured until tested.

## 1. Evidence map

| Evidence | Supports | Does not prove |
|---|---|---|
| India NCH reports | Warranty repair, after-sales, defective-product and recurring-repair issues appear in government grievance categories. | Eligible warranty-claim volume, national prevalence, ClaimForge TAM, or savings. |
| Academic research | Repair journeys, complaint channels and effort can be studied using established concepts and methods. | That ClaimForge currently reduces effort or transfers to Indian warranty cases. |
| Document-AI papers | Document image understanding and extraction are evaluated research tasks. | Perfect extraction on real Indian invoices/manuals or correct eligibility judgments. |
| n8n docs | Workflow orchestration, webhooks, approvals, waiting, logs and errors are supported capabilities. | n8n proves product-market fit or reduces the customer’s total work. |

### India-specific government evidence

1. **NCH Annual Report 2018–19.** Lists “charging for repair / not repaired under warranty” and recurring repair problems among grievance types, and describes a suggested escalation path from company/dealer/service centre to company head office and then Consumer Forum. This shows these categories were present in historical NCH reporting; it is not a current prevalence estimate. Do not quote the small chart’s category percentages unless you inspect the figure and confirm label-to-slice mapping. [Official NCH report PDF](https://consumerhelpline.gov.in/public/assets/docs/annual-reports/Annual_Report_2018-19.pdf)

2. **NCH Annual Report 2019–20, consumer durables and electronic products.** Describes service delays, unavailable after-sales service, defective products, repair charges/work not done under warranty, and recurring issues after repair. It says this sector ranked fourth in NCH grievance counts for that period. This is dated, administrative sector context, not a warranty-only count or a consumer survey. [Official NCH report PDF](https://consumerhelpline.gov.in/assets/annual-reports/Annual%20Report%202019-20.pdf)

3. **Current NCH route.** The official portal describes grievance registration and says consumers may attach necessary documents if available. NCH identifies itself as a pre-litigation grievance mechanism and lists web, phone, app and other contact routes. This supports the relevance of organizing records and navigating a process; it does not mean every case has the same required documents or guaranteed outcome. [NCH process](https://consumerhelpline.gov.in/public/about) · [Contact options](https://consumerhelpline.gov.in/public/index.php/contact) · [Convergence program](https://consumerhelpline.gov.in/public/index.php/convergenceprogram)

4. **Legal boundary.** The Consumer Protection Act, 2019 is the statutory framework. Do not present ClaimForge as deciding legal entitlement or guaranteeing repair/replacement; an individual assessment depends on the actual warranty terms and facts. [Department of Consumer Affairs: Act and rules](https://consumeraffairs.nic.in/acts-and-rules/consumer-protection/consumer-protection) · [Act PDF](https://consumeraffairs.nic.in/sites/default/files/CP%20Act%202019.pdf) · [NCH Act FAQ](https://consumerhelpline.gov.in/public/knowledgebasedetails/Consumer%20Protection%20Act%202019)

### Recent India-wide administrative context (not warranty-specific)

- PIB reported that between 25 April 2025 and 31 July 2026, NCH addressed 166,189 refund-related grievances across 35 sectors. This indicates use of the broad consumer grievance mechanism, but the release concerns refund-related cases across sectors, not warranty claim volume or time spent preparing a warranty claim. [PIB, 9 September 2026](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294484)
- PIB reported that during 25 April 2025–31 January 2026, NCH handled 788 refund-related grievances in the Electronic Products sector, with about ₹1.45 crore in facilitated refunds. These are sector-level refund grievance figures, not warranty cases, eligible claims, or ClaimForge's addressable market. [PIB, 17 February 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2229099)
### India-specific non-government research: limitations apply

- **Nagarani & Nirmal Dev (2025), “Consumer Compliance and Redressal Mechanisms in Online Shopping: A Study on Electronic Products in Chennai City.”** Repository abstract reports a survey of 200 consumers, with 29% concerned about warranty claims and 21% using official complaint channels. Treat as a small local, repository-hosted survey; inspect the paper for sampling, questionnaire, survey dates, and publication status. It is not nationally representative and must not be used for TAM or national prevalence. [Institutional repository record and full-text link](https://ir.vistas.ac.in/id/eprint/14890/)

- **Counterpoint Research (15 Sep 2025), smartphone repair survey.** Reports 4 in 10 surveyed India smartphone users needed multiple service-centre visits and 61% reported first-visit resolution. Commissioned by Xiaomi India; the stated survey covered 28 cities in Aug–Sep 2025. Useful as attributed industry research on repair friction, but not about warranty claim preparation. [Counterpoint survey](https://counterpointresearch.com/en/insights/survey-4-in-10-india-smartphone-consumers-require-repeat-visits%20for-repairs)

### Global academic work

- **Stretton, Niessen-Wade, Wensing & Bocken (2026), “Perspectives from the broken electronics repair system: Barriers and enablers along the repair journey.”** Scoping review plus interviews examines social, technical and financial barriers along electronics repair journeys. Useful for mapping journey stages and research questions; not India-specific and not a measure of warranty claim time. [Publisher DOI](https://doi.org/10.1016/j.rcradv.2025.200304) · [Maastricht University record](https://cris.maastrichtuniversity.nl/en/publications/perspectives-from-the-broken-electronics-repair-system-barriers-a/)

- **Lu, Gursoy, Chi & Xiao (2018), “Developing a consumer complaining and recovery effort scale.”** A measurement-method lead for complaint/recovery effort. Review its items and method before adapting; hospitality/service research is not automatically validated for Indian electronics claims. [Publisher DOI](https://doi.org/10.1177/1096348015597033)

- **“Complaint behaviour in multichannel retailing: a cross-stage approach” (2021).** Survey/scenario research on sequential complaint-channel choices after service and recovery failures. Its 577 apparel shoppers are not a warranty sample. [Publisher record / DOI](https://doi.org/10.1108/IJRDM-03-2020-0089)

- **Warranty operations paper (2019), DOI 10.1016/j.ejor.2018.12.034.** Useful for manufacturer-side warranty pathways/policies, not evidence about consumer time burden or ClaimForge’s impact. [Publisher DOI record](https://doi.org/10.1016/j.ejor.2018.12.034)

- **Document-AI benchmarks.** DocVQA evaluates questions about document images and highlights structural understanding; LayoutLMv3 evaluates document-AI tasks including receipt understanding and document visual question answering. These identify relevant evaluation tasks, not production accuracy on Indian invoices/warranty booklets. [DocVQA paper](https://arxiv.org/abs/2007.00398) · [LayoutLMv3 paper](https://arxiv.org/abs/2204.08387)

## 2. Connect the problem to the manual-work hypothesis

### Manual journey to observe

With a realistic faulty-device scenario and safely redacted documents, observe how a user:

1. Finds the invoice and identifies product/model and purchase date.
2. Finds the right warranty terms and locates duration, exclusions and claim instructions.
3. Compares dates and reported fault with those terms; notes uncertainty.
4. Works out what evidence and contact route may be needed.
5. Drafts a clear initial message and references the right evidence.
6. Tracks status, response, next action and follow-up date.
7. For optional features, sets a price alert from an available source or estimates a replenishment date from their own usage estimate.

NCH sources establish that related grievance categories appear in government records. Repair and complaint literature helps frame questions. The frequency, time burden and priority of each step for ClaimForge’s target users remain open research questions.

### Product mechanism (hypothesis, not measured result)

ClaimForge could reduce repeated searching and re-entry by collecting documents/details once; extracting candidate facts; showing each fact beside its source page/section; checking explicit date rules deterministically; asking about missing or illegible information; generating an editable evidence-linked message; and tracking user-approved follow-ups. Separate scheduled flows could check opted-in price conditions and user-entered replenishment estimates.

OCR/AI could reduce transcription/search effort but add review and correction work. Measure net effort including corrections, not just model runtime.

### Practical time-savings test

1. Recruit people who recently handled an electronics warranty/after-sales issue; document criteria and sample size.
2. Give each participant the same scenario, task instructions and redacted documents for a manual and a ClaimForge-assisted run. Counterbalance order where practical.
3. Time **active task work** separately from **elapsed waiting**. Waiting for a company reply is not saved by document automation unless the product changes that wait.
4. Log minutes by step: document search, term interpretation, fact entry, evidence checklist, draft, corrections, status tracking and reminder setup.
5. Also score completion, factual errors, clause citation accuracy, edits, uncertainty comprehension and whether the user understands that the assessment is not an approval decision.
6. Compute per-task difference as manual active minutes minus assisted active minutes. Report sample size, median/spread, conditions, corrections and errors. Negative results are possible; include them.
7. Describe a small test only as a prototype result for its tested users/tasks. Do not claim broad causal savings or market-wide impact.

Keep these metrics distinct:
- **Extraction quality:** accuracy of fields and source citations.
- **Workflow completion:** tasks reaching a reviewable draft.
- **User effort:** active manual vs assisted time, including correction.
- **External outcome:** claim acceptance/resolution, which depends on other parties and needs a suitable study design before attributing to ClaimForge.

## 3. Research locations and search strings

### India primary sources and data

- **NCH reports and portal:** search official annual reports for warranty, after-sales, consumer durables, electronic products, repair, grievance. Begin with the linked 2018–19 and 2019–20 reports, then check the [NCH portal](https://consumerhelpline.gov.in/) for newer publications.
- **Department of Consumer Affairs:** use its [Acts and Rules page](https://consumeraffairs.nic.in/acts-and-rules) and underlying text for legal claims.
- **e-Jagriti:** official case/process information for escalation context, not a proxy for warranty volume. [e-Jagriti](https://e-jagriti.gov.in/)
- **Shodhganga / university repositories:** discover local Indian studies; verify full text, method, sample and publication record. [Shodhganga](https://shodhganga.inflibnet.ac.in/)

### Academic discovery tools

Use these for discovery, then verify against the publisher, DOI, author manuscript or repository record:
- [Google Scholar](https://scholar.google.com/) — broad search and cited-by trails.
- [Crossref](https://search.crossref.org/) — verify bibliographic/DOI metadata.
- [OpenAlex](https://openalex.org/) and [Semantic Scholar](https://www.semanticscholar.org/) — discovery and citation trails.
- [DOAJ](https://doaj.org/) — open-access journal discovery; inclusion alone is not a quality guarantee.
- Publisher platforms: [ACM DL](https://dl.acm.org/), [IEEE Xplore](https://ieeexplore.ieee.org/), [ScienceDirect](https://www.sciencedirect.com/), [SAGE](https://journals.sagepub.com/) and [Emerald](https://www.emerald.com/).

For market signals, supplement research with [Google Trends](https://trends.google.com/trends/), official grievance reports, manufacturer support pages and interviews. Search interest is not market size.

### Copyable searches

**India warranty/after-sales**
- site:consumerhelpline.gov.in warranty "consumer durables" annual report
- India electronics warranty claim consumer complaint study after-sales service
- India consumer complaint warranty repair electronics survey methodology
- India warranty claim invoice proof of purchase consumer process manufacturer

**Complaint journey and effort**
- "consumer complaining effort" scale complaint recovery
- "complaint behaviour" multichannel retailing customer journey
- "consumer complaint process" effort information access service recovery
- electronics repair journey barriers consumer study

**Document processing**
- invoice receipt OCR information extraction benchmark paper
- document visual question answering DocVQA receipt understanding
- warranty document clause extraction OCR evaluation
- document AI evidence grounding page-level extraction evaluation

**n8n**
Search its official docs for Form Trigger, Webhook, Wait, human-in-the-loop, Schedule Trigger, execution history, error workflows and security. Verify current behavior and plan availability.

## 4. n8n role: capability evidence, not a savings claim

- **Intake:** Form Trigger can start a form workflow and supports file upload. A Next.js app may instead call an authenticated webhook. [Form Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger/)
- **App handoff:** Webhook starts a flow and can return output; documentation covers test/production URLs and authentication. Keep credentials server-side and protect the production endpoint. [Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- **Extraction/AI:** use a parser/OCR and model only after validating supported file types and privacy. Return structured facts with exact source text and page/section. Benchmark on representative invoices and warranty documents. Treat uploads as data, not instructions.
- **Rules and branches:** make date/status checks explicit and deterministic; route uncertainty/conflicts for human review. See [n8n workflow docs](https://docs.n8n.io/).
- **Approval:** n8n supports human approval patterns and Gmail send-and-wait-for-approval. For ClaimForge, show the evidence and draft in the app, then invoke send only after a recorded user approval. Do not conflate Gmail recipient approval with the ClaimForge customer UI unless that UI is implemented. [Human-in-the-loop](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools/) · [Gmail approval operation](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.gmail/message-operations/)
- **Follow-up:** Wait and Schedule Trigger can support paused and time-based flows; verify persistence/semantics for the chosen hosting setup. [Wait](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/) · [Schedule Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/)
- **Operations:** inspect executions and retry failed flows; store claim status in the app/database as the business record. [Execution history](https://docs.n8n.io/workflows/executions/all-executions/) · [Error handling](https://docs.n8n.io/flow-logic/error-handling/)
- **Privacy:** execution payloads can contain personal/document data. Configure retention, redaction and binary-data handling; minimize invoice contents and personal identifiers in logs. [Execution settings](https://docs.n8n.io/hosting/configuration/environment-variables/executions/) · [Redaction](https://docs.n8n.io/hosting/securing/redact-execution-data/) · [Security audit](https://docs.n8n.io/hosting/securing/security-audit/)

**Slide-friendly flow:**  
Customer submits product, fault and files → ClaimForge app/server validates and stores references → n8n orchestrates extraction → deterministic checks plus AI-assisted evidence summary → app shows cited review → customer approves → n8n sends only the approved message or schedules opted-in follow-up → app records status.

Price tracking and replenishment should appear as separate **planned** scheduled flows: user preference → supported price source or user-entered usage estimate → scheduled check/date → notification. Do not imply universal retailer APIs or automatic consumption detection until implemented.

## 5. Deck-safe wording

**Problem:** “India’s National Consumer Helpline reports after-sales, repair, defective-product and ‘not repaired under warranty’ grievances in consumer durables and electronics. ClaimForge tests whether one guided workspace can make a buyer’s document, evidence, draft and follow-up steps easier to manage.” Cite the dated NCH report; keep “tests whether” until user research supports stronger wording.

**Automation:** “n8n coordinates document intake, extraction, checks, customer review and opted-in follow-ups; the customer reviews evidence and approves any external message.”

**Before measuring:** “Designed to reduce repeated searching and re-entry; prototype time savings are being measured.” Do not add a percentage before testing.

Avoid: guarantees of approval; “AI decides coverage”; unsourced time-saved percentages; and NCH totals framed as warranty demand or TAM.

## 6. Source and interview checklist

For every slide claim, record source title/publisher/date, stable link, geography/period, population/sample/method, the exact supported claim, limitations, and whether it is fact, hypothesis or prototype result. Record access date.

For interviews, ask people to walk through their last real repair/warranty issue. With consent, inspect redacted artifacts. Ask what they searched, repeated, abandoned and found most effortful. Avoid leading with “Would you use our AI?”; first understand existing behavior.


