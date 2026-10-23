import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  LockKeyhole,
  Plus,
  Sparkles,
} from "lucide-react";

export function WorkspaceHome({ onStartClaim, onOpenReview }: { onStartClaim: () => void; onOpenReview: () => void }) {
  return (
    <div className="page-content">
      <div className="page-intro">
        <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR WARRANTY DESK</div><h1>Make the next step<br className="desktop-break" /> feel simple.</h1><p className="page-lede">The right documents. A clearer answer. A claim you’re ready to stand behind.</p></div>
        <button className="button button-primary" onClick={onStartClaim}><Plus size={17} /> Start a claim</button>
      </div>

      <section className="case-hero" aria-labelledby="current-case-title">
        <div className="case-copy">
          <div className="case-kicker"><span className="status-pill"><span /> IN REVIEW</span><span className="case-number">CASE CF—0248</span></div>
          <p className="product-type">WIRELESS HEADPHONES <span>·</span> PURCHASED 8 MONTHS AGO</p>
          <h2 id="current-case-title">Auralis Pulse 2</h2>
          <p className="case-problem">Left earcup has stopped playing audio</p>
          <div className="hero-divider" />
          <div className="progress-copy"><span>CLAIM PREPARATION</span><strong>03 <i>/</i> 04</strong></div>
          <div className="progress-track" aria-label="Claim preparation step 3 of 4"><span /></div>
          <div className="hero-foot"><span><Check size={13} /> Documents reviewed</span><span><Clock3 size={14} /> Draft ready for your review</span></div>
        </div>
        <div className="product-art" aria-label="Illustration of wireless headphones" role="img">
          <div className="art-index">PRODUCT<br />01 / 01</div>
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <HeadphoneDrawing />
          <div className="art-caption">AURALIS <span>—</span> PULSE 2</div>
          <div className="art-corner">01</div>
        </div>
      </section>

      <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> THE CASE, AT A GLANCE</div><h2>Everything in its right place.</h2></div><button className="text-button" onClick={onOpenReview}>Open full review <ArrowUpRight size={15} /></button></div>

      <div className="overview-grid">
        <section className="evidence-panel" aria-labelledby="evidence-title">
          <div className="panel-heading"><div><span className="panel-index">01</span><h3 id="evidence-title">Evidence on file</h3></div><span className="quiet-count">02 DOCUMENTS</span></div>
          <div className="document-row"><div className="file-icon invoice"><FileText size={19} /></div><div className="document-copy"><strong>Purchase invoice</strong><span>Reliance Digital · 12 Feb 2026</span></div><span className="document-state"><CheckCircle2 size={15} /> Read</span></div>
          <div className="document-row"><div className="file-icon terms"><FileCheck2 size={19} /></div><div className="document-copy"><strong>Warranty terms</strong><span>Auralis support · 2 pages</span></div><span className="document-state"><CheckCircle2 size={15} /> Read</span></div>
          <div className="panel-note"><LockKeyhole size={14} /> Documents are private to this workspace.</div>
        </section>

        <section className="assessment-panel" aria-labelledby="assessment-title">
          <div className="assessment-top"><span className="panel-index">02</span><span className="assessment-tag"><Sparkles size={13} /> PRELIMINARY READ</span></div>
          <h3 id="assessment-title">Likely within stated term</h3>
          <p>Purchase date appears to fall within the one-year warranty period stated in the supplied terms.</p>
          <div className="citation"><span className="citation-mark">“</span><span>Warranty coverage: 12 months from the original date of purchase.</span><small>WARRANTY TERMS · PAGE 2</small></div>
          <div className="assessment-foot"><CircleHelp size={14} /> Based on supplied documents. Not a coverage decision.</div>
        </section>
      </div>

      <section className="draft-strip" aria-label="Claim draft status"><div className="draft-icon"><FileText size={19} /></div><div className="draft-copy"><span>READY WHEN YOU ARE</span><strong>Your claim draft is ready to review.</strong><small>Nothing is sent until you approve it.</small></div><button className="button button-dark" onClick={onOpenReview}>Review claim <ArrowUpRight size={15} /></button></section>
      <footer className="page-footer"><span>CLAIMFORGE · YOUR EVIDENCE, YOUR DECISION</span><span>DEMO CASE · ALL PERSONAL DETAILS ARE FICTIONAL</span></footer>
    </div>
  );
}

function HeadphoneDrawing() {
  return (
    <svg className="headphone-drawing" viewBox="0 0 260 250" role="presentation" aria-hidden="true">
      <path d="M61 137V105C61 53 91 25 131 25s70 28 70 80v32" fill="none" stroke="#e8e2d1" strokeWidth="15" strokeLinecap="round" />
      <path d="M63 123h25c9 0 15 7 15 16v58c0 9-6 15-15 15H68c-11 0-19-8-19-19v-50c0-11 5-20 14-20Zm132 0h-25c-9 0-15 7-15 16v58c0 9 6 15 15 15h20c11 0 19-8 19-19v-50c0-11-5-20-14-20Z" fill="#c7a66e" stroke="#e8e2d1" strokeWidth="5" strokeLinejoin="round" />
      <path d="M76 138v54m108-54v54" stroke="#536b5b" strokeWidth="5" strokeLinecap="round" />
      <circle cx="130" cy="28" r="5" fill="#c7a66e" />
    </svg>
  );
}
