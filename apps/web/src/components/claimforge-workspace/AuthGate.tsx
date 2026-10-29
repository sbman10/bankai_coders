"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthPanel } from "./AuthPanel";
import { ClaimForgeWorkspace } from "./ClaimForgeWorkspace";

type User = { id: string; email: string | null };
type AuthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "demo" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User };

export function AuthGate() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [signOutError, setSignOutError] = useState("");

  const refresh = useCallback(() => {
    setState({ status: "loading" });
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Sign-in is temporarily unavailable.");
        if (result.configured === false) setState({ status: "demo" });
        else if (result.user?.id) setState({ status: "signed-in", user: result.user });
        else setState({ status: "signed-out" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Sign-in is temporarily unavailable." });
      });
    return () => controller.abort();
  }, [reload]);

  async function signOut() {
    setSignOutError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sign_out" }),
        cache: "no-store",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Could not sign out. Please try again.");
      }
      setState({ status: "signed-out" });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  }

  if (state.status === "loading") return <main className="auth-loading" aria-label="Loading account"><span className="auth-loading-mark">pv</span><p>Opening your private workspace…</p></main>;
  if (state.status === "error") return <main className="auth-loading"><section className="auth-card"><h1>We couldn’t check your session.</h1><p role="alert" className="upload-error">{state.message}</p><button className="button button-primary auth-submit" type="button" onClick={refresh}>Try again</button></section></main>;
  if (state.status === "signed-out") return <AuthPanel configured />;
  if (state.status === "demo") return <ClaimForgeWorkspace />;
  return <>
    {signOutError && <div className="auth-inline-error" role="alert">{signOutError}</div>}
    <ClaimForgeWorkspace userEmail={state.user.email ?? undefined} userId={state.user.id} onSignOut={signOut} />
  </>;
}
