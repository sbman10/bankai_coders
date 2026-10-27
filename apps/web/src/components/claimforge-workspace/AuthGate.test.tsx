import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "./AuthGate";

vi.mock("./ClaimForgeWorkspace", () => ({
  ClaimForgeWorkspace: ({ userEmail, onSignOut }: { userEmail?: string; onSignOut?: () => void }) => <div>
    <span>Workspace {userEmail ?? "demo"}</span>
    {onSignOut && <button type="button" onClick={onSignOut}>Sign out</button>}
  </div>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthGate", () => {
  it("shows the email OTP sign-in when Supabase is configured and the user is signed out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configured: true, user: null }) }));
    render(<AuthGate />);
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("keeps the interactive preview when Supabase is not configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configured: false, prototype: true }) }));
    render(<AuthGate />);
    expect(await screen.findByText("Workspace demo")).toBeInTheDocument();
  });

  it("does not fail open to the demo when checking a configured session fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Unavailable" }) }));
    render(<AuthGate />);
    expect(await screen.findByRole("heading", { name: /couldn’t check your session/i })).toBeInTheDocument();
    expect(screen.queryByText("Workspace demo")).not.toBeInTheDocument();
  });

  it("clears the signed-in UI after successful sign out", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true, user: { id: "user-1", email: "person@example.com" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AuthGate />);
    await user.click(await screen.findByRole("button", { name: /sign out/i }));
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "sign_out" }),
    }));
  });
});
