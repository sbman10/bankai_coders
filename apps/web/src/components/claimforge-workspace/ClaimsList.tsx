"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Clipboard, FileCheck2 } from "lucide-react";

export type SavedClaim = {
  id: string;
  product_id: string;
  fault_description: string;
  failure_date: string | null;
  status: string;
  assessment: string | null;
  claim_draft: string | null;
  created_at: string;
  products: { name: string } | { name: string }[] | null;
  claim_evidence?: Array<{
    id: string;
    document_id: string | null;
    evidence_kind: "fact" | "warranty_clause" | "missing_item" | "inference";
    content: string;
    source_page: number | null;
    confidence: number | null;
    created_at: string;
  }>;
  claim_approvals?: Array<{
    id: string;
    approved_content: string;
    approved_at: string;
    action_status: "draft_only" | "queued" | "sent" | "failed";
  }>;
};

export function ClaimsList({ claims, loading, error, onBack }: { claims: SavedClaim[]; loading: boolean; error: string; onBack: () => void }) {
  return (
    <div className="page-content subpage-content">
      <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to overview</button>
      <div className="review-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR SAVED CLAIMS</div><h1>Claim history.</h1><p>Claim status and results are read from your private Supabase account.</p></div></div>
      {error && <p role="alert" className="upload-error">{error}</p>}
      {loading ? <p className="auth-copy">Loading your claims…</p> : claims.length ? <div className="claims-list">
        {claims.map((claim) => <SavedClaimCard claim={claim} key={claim.id} />)}
      </div> : <div className="claims-empty"><FileCheck2 size={21} /><h2>No claims saved yet</h2><p>Your claim records will appear here after you submit them.</p></div>}
    </div>
  );
}

function SavedClaimCard({ claim }: { claim: SavedClaim }) {
  const product = Array.isArray(claim.products) ? claim.products[0]?.name : claim.products?.name;
  const approvals = [...(claim.claim_approvals ?? [])].sort((a, b) => b.approved_at.localeCompare(a.approved_at));
  const savedApproval = approvals[0];
  const [draft, setDraft] = useState(savedApproval?.approved_content ?? claim.claim_draft ?? "");
  const [approvedContent, setApprovedContent] = useState(savedApproval?.approved_content ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const hasReviewDraft = claim.status === "ready_for_review" && Boolean(claim.claim_draft || savedApproval?.approved_content);

  async function approveDraft() {
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/claims/${claim.id}/approval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvedContent: draft, idempotencyKey: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save approval.");
      setApprovedContent(draft);
      setFeedback("Approved draft saved. Nothing was sent.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save approval.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setFeedback("Draft copied. Review it before sending.");
    } catch {
      setFeedback("Clipboard access is unavailable. Select and copy the draft text.");
    }
  }

  return <article className="saved-claim saved-claim-expanded">
    <div className="saved-claim-icon"><FileCheck2 size={18} /></div>
    <div className="saved-claim-content">
      <div className="saved-claim-top"><strong>{product ?? "Product claim"}</strong><span className="saved-claim-status">{claim.status.replaceAll("_", " ")}</span></div>
      <p>{claim.fault_description}</p>
      <span><Clock3 size={13} /> Received {new Date(claim.created_at).toLocaleDateString()}</span>
      {claim.assessment && <p className="saved-claim-assessment">Preliminary assessment · {claim.assessment}. This is not a coverage decision.</p>}
      <details className="saved-claim-details">
        <summary>Open evidence and draft</summary>
        {claim.claim_evidence?.length ? <section className="saved-evidence" aria-label="Claim evidence">
          <h2>Evidence from your documents</h2>
          {claim.claim_evidence.map((item) => <div className="saved-evidence-item" key={item.id}>
            <span className={`evidence-kind evidence-kind-${item.evidence_kind}`}>{evidenceLabel(item.evidence_kind)}</span>
            <p>{item.content}</p>
            <span className="saved-evidence-source">{item.document_id ? `Source document ${item.document_id.slice(0, 8)}` : "Source not attached"}{item.source_page ? ` · page ${item.source_page}` : " · page not identified"}</span>
          </div>)}
        </section> : <p className="saved-claim-not-ready" role="status">No document-linked evidence is available yet.</p>}
        {hasReviewDraft ? <section className="saved-draft" aria-label="Claim draft review">
          <label htmlFor={`claim-draft-${claim.id}`}>Editable claim draft</label>
          <textarea id={`claim-draft-${claim.id}`} value={draft} maxLength={10_000} onChange={(event) => setDraft(event.target.value)} />
          <div className="saved-draft-actions">
            <button type="button" className="text-button" onClick={copyDraft}><Clipboard size={14} /> Copy draft</button>
            <button type="button" className="button button-primary" disabled={busy || !draft.trim()} onClick={approveDraft}>{busy ? "Saving…" : "Approve this exact draft"}</button>
          </div>
          {approvedContent && <p className="approved-draft-state"><CheckCircle2 size={14} /> Approved version saved. Nothing was sent.{draft !== approvedContent ? " The current edits are a newer, unapproved version." : ""}</p>}
          <p className="saved-claim-not-ready">Approval records this exact version only. Sending is not connected; nothing will be sent.</p>
          {feedback && <p className="copy-feedback" role="status">{feedback}</p>}
        </section> : claim.status === "ready_for_review" ? <p className="saved-claim-not-ready">A review draft is not available yet.</p> : <p className="saved-claim-not-ready" role="status">Claim analysis is not complete. No approval action is available yet.</p>}
      </details>
    </div>
  </article>;
}

function evidenceLabel(kind: NonNullable<SavedClaim["claim_evidence"]>[number]["evidence_kind"]): string {
  if (kind === "fact") return "Extracted fact";
  if (kind === "warranty_clause") return "Warranty wording";
  if (kind === "missing_item") return "Missing evidence";
  return "AI interpretation";
}
