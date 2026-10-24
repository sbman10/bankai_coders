"use client";

import { useState } from "react";
import { Bell, ChevronRight, FileCheck2, LockKeyhole, MessageCircleQuestion, PackageCheck, ShieldCheck, TrendingDown } from "lucide-react";
import { ClaimIntake } from "./ClaimIntake";
import { ClaimReview } from "./ClaimReview";
import { WorkspaceHome } from "./WorkspaceHome";
import { sampleClaim, type ClaimIntakePayload, type ClaimSubmission } from "./types";

type View = "workspace" | "intake" | "review" | "claims" | "products" | "assistant" | "prices" | "reminders";

export function ClaimForgeWorkspace() {
  const [view, setView] = useState<View>("workspace");
  const [claim, setClaim] = useState<ClaimSubmission>(sampleClaim);
  const [approved, setApproved] = useState(false);


  function beginClaim() {
    setApproved(false);
    setView("intake");
  }

  async function submitClaim(nextClaim: ClaimIntakePayload) {
    setApproved(false);
    setClaim({
      product: nextClaim.product,
      fault: nextClaim.fault,
      failureDate: nextClaim.failureDate,
      invoiceName: nextClaim.invoice?.name ?? "Invoice not attached",
      warrantyName: nextClaim.warranty?.name ?? "Warranty terms not attached",
      source: "local-preview",
    });
    setView("review");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#home" onClick={() => setView("workspace")}>
          <span className="brand-mark" aria-hidden="true">cf</span>
          <span className="brand-name">claimforge<span>WARRANTY, WITH A WAY FORWARD</span></span>
        </a>
        <div className="workspace-label">PUBLIC DEMO</div>
        <nav className="nav-list" aria-label="Workspace">
          <button className={`nav-item ${view === "workspace" ? "active" : ""}`} onClick={() => setView("workspace")}><span className="nav-icon"><ShieldCheck size={17} /></span>Overview</button>
          <button className={`nav-item ${view === "products" ? "active" : ""}`} onClick={() => setView("products")}><span className="nav-icon"><PackageCheck size={17} /></span>Products</button>
          <button className={`nav-item ${view === "assistant" ? "active" : ""}`} onClick={() => setView("assistant")}><span className="nav-icon"><MessageCircleQuestion size={17} /></span>Ask documents</button>
          <button className={`nav-item ${view === "prices" ? "active" : ""}`}  onClick={() => setView("prices")}><span className="nav-icon"><TrendingDown size={17} /></span>Price watch</button>
          <button className={`nav-item ${view === "reminders" ? "active" : ""}`} onClick={() => setView("reminders")}><span className="nav-icon"><Bell size={17} /></span>Reminders</button>
          <button className={`nav-item ${view === "claims" || view === "review" ? "active" : ""}`} onClick={() => setView("claims")}><span className="nav-icon"><FileCheck2 size={17} /></span>My claims</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><LockKeyhole size={15} /><span>Demo only · nothing is uploaded or saved.</span></div>
        </div>
      </aside>

      <main className="main-area" id="home">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{view === "intake" ? "New claim" : view === "review" ? "Claim review" : view === "claims" ? "My claims" : view === "assistant" ? "Ask documents" : "Overview"}</strong></div>
          <div className="topbar-meta"><span className="demo-dot" /> PUBLIC DEMO <span className="topbar-divider" /> <span>EN · INDIA</span></div>
        </header>
        {view === "intake" ? (
          <ClaimIntake onCancel={() => setView("workspace")} onSubmit={submitClaim} />
        ) : view === "review" ? (
          <ClaimReview claim={claim} approved={approved} onApprove={() => setApproved(true)} onBack={() => setView("workspace")} />
        ) : view === "claims" || view === "assistant" || view === "products" || view === "prices" || view === "reminders" ? (
          <PublicDemoNotice onBack={() => setView("workspace")} />
        ) : (
          <WorkspaceHome onStartClaim={beginClaim} onOpenReview={() => setView("review")} />
        )}
      </main>
    </div>
  );
}

function PublicDemoNotice({ onBack }: { onBack: () => void }) {
  return (
    <section className="page-content subpage-content" aria-labelledby="public-demo-notice-title">
      <button className="back-link" onClick={onBack}>Back to overview</button>
      <div className="eyebrow"><span className="eyebrow-line" /> PUBLIC DEMO</div>
      <h1 id="public-demo-notice-title">Private account features are turned off.</h1>
      <p className="page-lede">Products, saved claims, document Q&amp;A, price watches, reminders, and private uploads need an account-owned workspace. This public demo does not connect those features to shared data.</p>
      <p className="local-data-note">You can explore the fictional sample case and create a temporary claim preview. Nothing you enter or select is uploaded or saved.</p>
    </section>
  );
}
