"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export function AuthPanel({ onAuthenticated, configured }: { onAuthenticated: (email: string) => void; configured: boolean }) {
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: mode, email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Sign in failed.");
      if (result.confirmationRequired) {
        setMessage("Check your email to confirm the new account, then sign in.");
      } else {
        onAuthenticated(email);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark" aria-hidden="true">pv</span><span className="brand-name">ProductVault<span>YOUR PRODUCT OWNERSHIP DESK</span></span></div>
        <div className="eyebrow"><span className="eyebrow-line" /> PRIVATE WORKSPACE</div>
        <h1>{mode === "sign_in" ? "Welcome back." : "Create your workspace."}</h1>
        <p className="auth-copy">Sign in to save product documents and claims privately to your account.</p>
        {!configured ? <div className="auth-notice" role="status"><LockKeyhole size={16} /> Supabase is not configured yet. Add the project URL and publishable key to <code>apps/web/.env.local</code>.</div> : (
          <form className="auth-form" onSubmit={submit}>
            <label className="field-label" htmlFor="auth-email">Email address</label>
            <div className="auth-input-wrap"><Mail size={16} /><input id="auth-email" className="text-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <label className="field-label" htmlFor="auth-password">Password</label>
            <input id="auth-password" className="text-input" type="password" autoComplete={mode === "sign_in" ? "current-password" : "new-password"} minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
            {error && <p role="alert" className="upload-error">{error}</p>}
            {message && <p role="status" className="auth-message">{message}</p>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "sign_in" ? "Sign in" : "Create account"}</button>
            <button className="text-button auth-mode" type="button" onClick={() => { setMode(mode === "sign_in" ? "sign_up" : "sign_in"); setMessage(""); setError(""); }}>
              {mode === "sign_in" ? "New to ProductVault? Create an account" : "Already have an account? Sign in"}
            </button>
          </form>
        )}
        <div className="auth-privacy"><ShieldCheck size={15} /> Private documents. User-owned claims. No messages sent without your approval.</div>
      </section>
    </main>
  );
}
