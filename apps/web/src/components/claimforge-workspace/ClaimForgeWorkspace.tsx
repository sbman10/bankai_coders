"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronRight, FileCheck2, LockKeyhole, MessageCircleQuestion, PackageCheck, ShieldCheck, TrendingDown } from "lucide-react";
import { AuthPanel } from "./AuthPanel";
import { ClaimIntake } from "./ClaimIntake";
import { ClaimReview } from "./ClaimReview";
import { ClaimsList, type SavedClaim } from "./ClaimsList";
import { ProductCenter } from "./ProductCenter";
import { AssistantChat } from "./AssistantChat";
import { WorkspaceHome } from "./WorkspaceHome";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { sampleClaim, type ClaimIntakePayload, type ClaimSubmission } from "./types";

type View = "workspace" | "intake" | "review" | "claims" | "products" | "assistant" | "prices" | "reminders";

export function ClaimForgeWorkspace() {
  const [view, setView] = useState<View>("workspace");
  const [claim, setClaim] = useState<ClaimSubmission>(sampleClaim);
  const [approved, setApproved] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);
  const [claims, setClaims] = useState<SavedClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth").then(async (response) => {
      const result = await response.json();
      if (!active) return;
      setSupabaseConfigured(result.configured !== false);
      setUserEmail(result.user?.email ?? "");
      setAuthReady(true);
      if (result.user) void loadClaims();
    }).catch(() => {
      if (active) {
        setSupabaseConfigured(false);
        setAuthReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  async function loadClaims() {
    setClaimsLoading(true);
    setClaimsError("");
    try {
      const response = await fetch("/api/claims", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Couldn’t load claims.");
      setClaims(result.claims ?? []);
    } catch (error) {
      setClaimsError(error instanceof Error ? error.message : "Couldn’t load claims.");
    } finally {
      setClaimsLoading(false);
    }
  }

  function beginClaim() {
    setApproved(false);
    setView("intake");
  }

  async function submitClaim(nextClaim: ClaimIntakePayload, idempotencyKey: string) {
    const supabase = createBrowserSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Your sign-in expired. Sign in again and retry.");

    const documents: Array<{ kind: "invoice" | "warranty"; storagePath: string; fileName: string; mimeType: string; sizeBytes: number }> = [];
    const uploadedThisAttempt: string[] = [];
    const storage = supabase.storage.from("claim-documents");
    async function cleanUpNewUploads() {
      if (uploadedThisAttempt.length) await storage.remove(uploadedThisAttempt);
    }

    for (const [kind, file] of [["invoice", nextClaim.invoice], ["warranty", nextClaim.warranty]] as const) {
      if (!file) continue;
      const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140) || `${kind}-document`;
      const objectName = `${idempotencyKey}-${kind}-${safeName}`;
      const storagePath = `${user.id}/${objectName}`;
      try {
        const { error } = await storage.upload(storagePath, file, { contentType: file.type, upsert: false });
        if (error) {
          const { data: existing, error: listError } = await storage.list(user.id, { search: objectName, limit: 2 });
          const matchesRetry = !listError && existing?.some((object: { name: string; metadata?: { size?: number | string; mimetype?: string } | null }) =>
            object.name === objectName && Number(object.metadata?.size) === file.size && object.metadata?.mimetype === file.type,
          );
          if (!matchesRetry) {
            await cleanUpNewUploads();
            throw new Error("Upload failed");
          }
        } else {
          uploadedThisAttempt.push(storagePath);
        }
      } catch {
        await cleanUpNewUploads();
        throw new Error(`Could not upload the ${kind} document. Check the private storage setup and retry.`);
      }
      documents.push({ kind, storagePath, fileName: file.name.slice(0, 240), mimeType: file.type, sizeBytes: file.size });
    }

    const response = await fetch("/api/claims", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product: nextClaim.product, fault: nextClaim.fault, failureDate: nextClaim.failureDate || null, documents, idempotencyKey }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status < 500) await cleanUpNewUploads();
      throw new Error(result.error ?? "Could not save this claim.");
    }

    setApproved(false);
    setClaim({
      product: nextClaim.product,
      fault: nextClaim.fault,
      failureDate: nextClaim.failureDate,
      invoiceName: nextClaim.invoice?.name ?? "Invoice not attached",
      warrantyName: nextClaim.warranty?.name ?? "Warranty terms not attached",
      source: "connected",
      claimId: result.claim.id,
      status: result.claim.status,
      automation: result.automation,
    });
    setView("review");
    void loadClaims();
  }

  async function signOut() {
    await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sign_out" }) });
    setUserEmail("");
    setClaims([]);
    setView("workspace");
  }

  if (!authReady) return <main className="auth-page"><p className="auth-copy">Loading your private workspace…</p></main>;
  if (!userEmail) return <AuthPanel configured={supabaseConfigured} onAuthenticated={(email) => { setUserEmail(email); void loadClaims(); }} />;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#home" onClick={() => setView("workspace")}>
          <span className="brand-mark" aria-hidden="true">cf</span>
          <span className="brand-name">claimforge<span>WARRANTY, WITH A WAY FORWARD</span></span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="nav-list" aria-label="Workspace">
          <button className={`nav-item ${view === "workspace" ? "active" : ""}`} onClick={() => setView("workspace")}><span className="nav-icon"><ShieldCheck size={17} /></span>Overview</button>
          <button className={`nav-item ${view === "products" ? "active" : ""}`} onClick={() => setView("products")}><span className="nav-icon"><PackageCheck size={17} /></span>Products</button>
          <button className={`nav-item ${view === "assistant" ? "active" : ""}`} onClick={() => setView("assistant")}><span className="nav-icon"><MessageCircleQuestion size={17} /></span>Ask documents</button>
          <button className={`nav-item ${view === "prices" ? "active" : ""}`}  onClick={() => setView("prices")}><span className="nav-icon"><TrendingDown size={17} /></span>Price watch</button>
          <button className={`nav-item ${view === "reminders" ? "active" : ""}`} onClick={() => setView("reminders")}><span className="nav-icon"><Bell size={17} /></span>Reminders</button>
          <button className={`nav-item ${view === "claims" || view === "review" ? "active" : ""}`} onClick={() => { setView("claims"); void loadClaims(); }}><span className="nav-icon"><FileCheck2 size={17} /></span>My claims<span className="nav-count">{claims.length}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><LockKeyhole size={15} /><span>You choose what gets shared.</span></div>
          <div className="profile-row"><div className="avatar">{userEmail.slice(0, 1).toUpperCase()}</div><div><strong>{userEmail}</strong><button className="text-button signout-button" onClick={signOut}>Sign out</button></div></div>
        </div>
      </aside>

      <main className="main-area" id="home">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{view === "intake" ? "New claim" : view === "review" ? "Claim review" : view === "claims" ? "My claims" : view === "assistant" ? "Ask documents" : "Overview"}</strong></div>
          <div className="topbar-meta"><span className="demo-dot" /> PRIVATE WORKSPACE <span className="topbar-divider" /> <span>EN · INDIA</span></div>
        </header>
        {view === "intake" ? (
          <ClaimIntake onCancel={() => setView("workspace")} onSubmit={submitClaim} />
        ) : view === "review" ? (
          <ClaimReview claim={claim} approved={approved} onApprove={() => setApproved(true)} onBack={() => setView("workspace")} />
        ) : view === "claims" ? (
          <ClaimsList claims={claims} loading={claimsLoading} error={claimsError} onBack={() => setView("workspace")} />
        ) : view === "assistant" ? (
          <AssistantChat />
        ) : view === "products" || view === "prices" || view === "reminders" ? (
          <ProductCenter view={view} />
        ) : (
          <WorkspaceHome onStartClaim={beginClaim} onOpenReview={() => setView("review")} />
        )}
      </main>
    </div>
  );
}
