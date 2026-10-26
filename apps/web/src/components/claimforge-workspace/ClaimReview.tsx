"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type { ClaimSubmission } from "./types";

export function ClaimReview({ claim, approved, onApprove, onBack }: { claim: ClaimSubmission; approved: boolean; onApprove: () => void; onBack: () => void }) {
  const [copyMessage, setCopyMessage] = useState("");
  const [showAssessmentHelp, setShowAssessmentHelp] = useState(false);
  const sampleDraft = `Hello, I’m requesting support for my ${claim.product}. ${claim.fault}. I purchased it on 12 February 2026 and have attached my invoice and the warranty terms for reference. Please let me know the next steps and any additional information you need.`;

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(sampleDraft);
      setCopyMessage("Draft copied to clipboard.");
    } catch {
      setCopyMessage("Clipboard access is unavailable. You can select and copy the draft text.");
    }
  }

  return (
    <div className="page-content subpage-content">
      <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to overview</button>
      <div className="review-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> {claim.source === "sample" ? "CASE CF—0248 · REVIEW" : claim.source === "connected" ? "SAVED CLAIM · PRIVATE" : "LOCAL PREVIEW · REVIEW"}</div>
          <h1>{claim.source === "connected" ? "Your claim is saved." : "Review your claim."}</h1>
          <p>{claim.source === "connected" ? "Your claim and document references are stored in your account. We’ll show an assessment only after processing is configured." : "Check what was found, where it came from, and what you want to do next."}</p>
        </div>
        <span className="status-pill status-light"><span /> {approved ? "APPROVED FOR DEMO" : claim.source === "sample" ? "READY FOR YOUR REVIEW" : claim.source === "connected" ? (claim.status ?? "RECEIVED").replaceAll("_", " ").toUpperCase() : "DETAILS SAVED LOCALLY"}</span>
      </div>

      <div className="review-grid">
        <div className="review-main">
          <section className="review-card product-summary">
            <div className="review-card-head"><span className="panel-index">01</span><span>PRODUCT & ISSUE</span></div>
            <h2>{claim.product}</h2>
            <p>{claim.fault}</p>
            {claim.failureDate && <p className="reported-date">Issue began · {claim.failureDate}</p>}
          </section>

          {claim.source === "sample" ? (
            <>
              <SampleEvidence claim={claim} />
              <section className="review-card draft-card">
                <div className="review-card-head">
                  <span className="panel-index">03</span><span>CLAIM MESSAGE · SAMPLE DRAFT</span>
                  <button className="icon-button download-button" aria-label={copyMessage ? "Draft copied" : "Copy draft to clipboard"} onClick={copyDraft}><ArrowDownToLine size={16} /></button>
                </div>
                <div className="draft-recipient">TO: MANUFACTURER SUPPORT <span>SUBJECT: Warranty support request — {claim.product}</span></div>
                <p className="draft-message">{sampleDraft}</p>
                <div className="draft-attachment"><FileText size={15} /> {claim.invoiceName}<span>Attached for review</span></div>
                {copyMessage && <p role="status" className="copy-feedback">{copyMessage}</p>}
              </section>
            </>
          ) : claim.source === "connected" ? (
            <section className="review-card local-preview-card">
              <div className="review-card-head"><span className="panel-index">02</span><span>DOCUMENTS & AUTOMATION</span></div>
              <h2>Private files, claim recorded.</h2>
              <p>Invoice and warranty files are stored in your private Supabase bucket. n8n receives only claim and product identifiers.</p>
              <div className="source-list">
                <SourceRow icon="invoice" title="Purchase invoice" detail={claim.invoiceName} />
                <SourceRow icon="terms" title="Warranty terms" detail={claim.warrantyName} />
              </div>
              <p className="automation-state" role="status">{claim.automation === "acknowledged" ? "n8n acknowledged this intake. No document analysis is configured yet." : claim.automation === "failed" ? "The claim is saved, but n8n did not acknowledge the request. It can be retried after the workflow is configured." : claim.automation === "duplicate" ? "This retry matched a previously saved claim, so no second automation event was sent." : "Claim saved. n8n is not configured for this app yet."}</p>
              {claim.claimId && <small className="claim-reference">Claim reference · {claim.claimId}</small>}
            </section>
          ) : (
            <section className="review-card local-preview-card">
              <div className="review-card-head"><span className="panel-index">02</span><span>DOCUMENT ANALYSIS</span></div>
              <h2>Temporary browser preview.</h2>
              <p>Your entered details and selected file names are shown for this session only. No file was uploaded, no claim was saved, and no analysis was run.</p>
              <div className="source-list">
                <SourceRow icon="invoice" title="Purchase invoice" detail={claim.invoiceName} />
                <SourceRow icon="terms" title="Warranty terms" detail={claim.warrantyName} />
              </div>
            </section>
          )}
          {claim.source === "sample" && <RejectionAssistant claim={claim} />}
        </div>

        <aside className="review-aside">
          {claim.source === "sample" ? <ApprovalCard approved={approved} onApprove={onApprove} /> : claim.source === "connected" ? <ConnectedStatusCard /> : <LocalPreviewCard />}
          {claim.source !== "connected" && <div className="reminder-card">
            <div className="reminder-top"><Clock3 size={16} /><span>AFTER YOU APPROVE</span></div>
            <p>You can choose a follow-up reminder if the manufacturer doesn’t reply.</p>
            <span className="reminder-state">NOT SCHEDULED</span>
          </div>}
          {claim.source !== "connected" && <div className="help-card">
            <CircleHelp size={16} /><span>Unsure about a clause?</span>
            <button type="button" aria-expanded={showAssessmentHelp} onClick={() => setShowAssessmentHelp((show) => !show)}>See how this assessment works <ChevronRight size={14} /></button>
            {showAssessmentHelp && <p className="help-explanation">We compare dates and details you supplied with cited wording from the warranty terms. This is a preliminary guide, not a coverage decision.</p>}
          </div>}
        </aside>
      </div>
      <footer className="page-footer"><span>PRODUCT VAULT · YOUR EVIDENCE, YOUR DECISION</span><span>PRELIMINARY INFORMATION · NOT LEGAL ADVICE</span></footer>
    </div>
  );
}

function RejectionAssistant({ claim }: { claim: ClaimSubmission }) {
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState("");

  function prepareDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraft(`Hello,\n\nI am following up about support for my ${claim.product}. I understand the claim was declined for the following reason: “${reason.trim()}”. Please identify the specific warranty term and information relied on in this decision.\n\nI can provide the purchase invoice (${claim.invoiceName}) and the supplied warranty terms (${claim.warrantyName}) for reference. Please let me know whether you need any additional details or inspection to review the matter.\n\nThank you.`);
    setFeedback("");
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setFeedback("Reply draft copied. Review it before sending.");
    } catch {
      setFeedback("Clipboard access is unavailable. Select and copy the draft text.");
    }
  }

  return (
    <section className="review-card rejection-card" aria-labelledby="rejection-title">
      <div className="review-card-head"><span className="panel-index">04</span><span>IF YOUR CLAIM IS DECLINED</span></div>
      <h2 id="rejection-title">Ask for a clearer explanation.</h2>
      <p>Enter the stated reason. Product Vault will prepare a neutral clarification request using your product and document names. It will not assess legal rights or send anything.</p>
      <form onSubmit={prepareDraft} className="rejection-form">
        <label htmlFor="rejection-reason" className="field-label">Reason for rejection</label>
        <textarea id="rejection-reason" className="text-input textarea" required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Paste or summarize the reason given by the seller or manufacturer" rows={3} />
        <button type="submit" className="button button-primary">Prepare clarification draft <ArrowUpRight size={15} /></button>
      </form>
      {draft && <div className="rejection-draft">
        <label htmlFor="editable-reply-draft" className="field-label">Editable reply draft</label>
        <textarea id="editable-reply-draft" className="text-input textarea reply-draft-input" value={draft} onChange={(event) => setDraft(event.target.value)} rows={8} />
        <div className="rejection-draft-actions"><span>This is a factual template, not legal advice.</span><button type="button" className="text-button" onClick={copyDraft}><Clipboard size={14} /> Copy draft</button></div>
        {feedback && <p className="copy-feedback" role="status">{feedback}</p>}
      </div>}
      {!draft && <p className="rejection-disclaimer"><CircleHelp size={14} /> Review every detail yourself. This is not legal advice.</p>}
    </section>
  );
}

function SampleEvidence({ claim }: { claim: ClaimSubmission }) {
  return (
    <section className="review-card" aria-labelledby="review-evidence-title">
      <div className="review-card-head"><span className="panel-index">02</span><span id="review-evidence-title">EVIDENCE & ASSESSMENT</span></div>
      <div className="review-verdict"><div><span className="verdict-label">PRELIMINARY ASSESSMENT</span><h2>Likely within stated term</h2></div><span className="verdict-marker"><CheckCircle2 size={19} /></span></div>
      <p className="review-explainer">The purchase date appears to fall within the one-year term described in the warranty document. This is an interpretation of the supplied wording, not a coverage decision.</p>
      <div className="source-list">
        <SourceRow icon="invoice" title="Purchase invoice" detail={`${claim.invoiceName} · Invoice · page 1`} />
        <SourceRow icon="terms" title="Warranty terms" detail={`${claim.warrantyName} · Warranty terms · page 2`} type="SOURCE CLAUSE" />
      </div>
      <blockquote className="review-quote">“Warranty coverage: 12 months from the original date of purchase.”<cite>WARRANTY TERMS · PAGE 2</cite></blockquote>
    </section>
  );
}

function SourceRow({ icon, title, detail, type }: { icon: "invoice" | "terms"; title: string; detail: string; type?: string }) {
  const Icon = icon === "invoice" ? FileText : FileCheck2;
  return <div className="source-row"><Icon size={17} /><div><strong>{title}</strong><span>{detail}</span></div>{type && <span className="source-type">{type}</span>}</div>;
}

function ApprovalCard({ approved, onApprove }: { approved: boolean; onApprove: () => void }) {
  return (
    <div className="approval-card">
      <div className="approval-ornament"><ShieldCheck size={20} /><span>YOUR DECISION</span></div>
      <h2>{approved ? "You’re in control." : "Ready to take the next step?"}</h2>
      <p>{approved ? "Your approval is recorded in this local demo. No message was sent." : "Review the draft above. Approve only if the details look right to you."}</p>
      <div className="approval-rule" />
      {approved ? <div className="approved-state" role="status"><CheckCircle2 size={17} /> Approved for demo <span>No message was sent</span></div> : <><div className="approval-status" role="status"><span className="approval-dot" /> Not approved yet</div><button className="button button-light" onClick={onApprove}>Approve draft <ArrowUpRight size={15} /></button></>}
      <small>Product Vault never sends or shares a claim without your explicit approval.</small>
    </div>
  );
}

function LocalPreviewCard() {
  return <div className="approval-card"><div className="approval-ornament"><ShieldCheck size={20} /><span>HUMAN REVIEW</span></div><h2>No decision made yet.</h2><p>Analysis and draft generation are not connected in this local preview. Nothing has been sent.</p></div>;
}

function ConnectedStatusCard() {
  return <div className="approval-card"><div className="approval-ornament"><ShieldCheck size={20} /><span>YOUR DECISION</span></div><h2>Nothing will be sent.</h2><p>This intake only saves your claim and asks n8n to acknowledge it. External communication still requires your explicit approval.</p><div className="approval-status"><span className="approval-dot" /> No external action taken</div></div>;
}
