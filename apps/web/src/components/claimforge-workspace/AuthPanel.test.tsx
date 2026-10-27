import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthPanel } from "./AuthPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthPanel", () => {
  it("requests a clickable sign-in link and offers resend or change email", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, message: "If this email can receive a sign-in link, check your inbox." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AuthPanel configured />);

    await user.click(screen.getByRole("checkbox", { name: /keep me signed in on this device/i }));
    await user.type(screen.getByLabelText(/email address/i), "person@example.com");
    await user.click(screen.getByRole("button", { name: /send sign-in link/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/check your inbox/i);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "request_email_link", email: "person@example.com", keepSignedIn: true }),
    }));
    expect(screen.queryByLabelText(/six-digit code/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /resend sign-in link/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth", expect.objectContaining({
      body: JSON.stringify({ action: "request_email_link", email: "person@example.com", keepSignedIn: true }),
    }));
    await user.click(screen.getByRole("button", { name: /change email/i }));
    expect(screen.getByRole("button", { name: /send sign-in link/i })).toBeInTheDocument();
  });

  it("starts Google OAuth without asking for a password", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://auth.example.test/authorize" }) }));
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    const user = userEvent.setup();
    render(<AuthPanel configured />);

    await user.click(screen.getByRole("checkbox", { name: /keep me signed in on this device/i }));
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://auth.example.test/authorize"));
    expect(fetch).toHaveBeenCalledWith("/api/auth", expect.objectContaining({
      body: JSON.stringify({ action: "google_sign_in", keepSignedIn: true }),
    }));
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
