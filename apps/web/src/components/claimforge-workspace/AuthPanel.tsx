"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";

type AuthAction = "request_email_link" | "google_sign_in";

export function AuthPanel({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [step, setStep] = useState<"email" | "link-sent">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function perform(action: AuthAction) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "google_sign_in"
          ? { action, keepSignedIn }
          : { action, email: email.trim().toLowerCase(), keepSignedIn }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Authentication failed.");
      if (action === "request_email_link") {
        setStep("link-sent");
        setMessage(result.message ?? "If this email can receive a sign-in link, check your inbox.");
      } else if (typeof result.url === "string" && result.url.startsWith("https://")) {
        location.assign(result.url);
      } else {
        throw new Error("Google sign-in could not be started.");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform("request_email_link");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark" aria-hidden="true">pv</span><span className="brand-name">ProductVault<span>YOUR PRODUCT OWNERSHIP DESK</span></span></div>
        <div className="eyebrow"><span className="eyebrow-line" /> PRIVATE WORKSPACE</div>
        <h1>{step === "email" ? "Welcome back." : "Check your inbox."}</h1>
        <p className="auth-copy">Sign in to save product documents and claims privately to your account.</p>
        {!configured ? <div className="auth-notice" role="status"><LockKeyhole size={16} /> Supabase is not configured yet. Add the project URL and publishable key to <code>apps/web/.env.local</code>.</div> : (
          <>
          <form className="auth-form" onSubmit={submit}>
            <label className="field-label" htmlFor="auth-email">Email address</label>
            <div className="auth-input-wrap"><Mail size={16} /><input id="auth-email" className="text-input" type="email" autoComplete="email" required disabled={step === "link-sent"} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <label className="keep-signed-in-choice"><input type="checkbox" checked={keepSignedIn} disabled={step === "link-sent"} onChange={(event) => setKeepSignedIn(event.target.checked)} /><span><strong>Keep me signed in on this device</strong><small>Save your sign-in for 30 days on this device.</small></span></label>
            {error && <p role="alert" className="upload-error">{error}</p>}
            {message && <p role="status" className="auth-message">{message}</p>}
            {step === "email" ? <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : "Send sign-in link"}</button> : <div className="auth-code-actions"><button className="text-button auth-mode" type="button" disabled={busy} onClick={() => void perform("request_email_link")}>{busy ? "Please wait…" : "Resend sign-in link"}</button><button className="text-button auth-mode" type="button" disabled={busy} onClick={() => { setStep("email"); setMessage(""); setError(""); }}>Change email</button></div>}
          </form>
          <div className="auth-divider"><span>or</span></div>
          <button className="button auth-google-button" type="button" disabled={busy} onClick={() => void perform("google_sign_in")}><span aria-hidden="true" className="google-glyph">G</span>Continue with Google</button>
          </>
        )}
        <div className="auth-privacy"><ShieldCheck size={15} /> Private documents. User-owned claims. No messages sent without your approval.</div>
      </section>
    </main>
  );
}
