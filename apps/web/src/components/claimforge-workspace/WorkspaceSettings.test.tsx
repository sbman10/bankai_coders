import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSettings } from "./WorkspaceSettings";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ profile: { displayName: "Alex", hasAvatar: false } }),
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WorkspaceSettings", () => {
  it("renders the settings header, eyebrow, and back navigation", async () => {
    const onBack = vi.fn();
    const onToggleTheme = vi.fn();
    const onNavigate = vi.fn();

    render(
      <WorkspaceSettings
        isDarkTheme={false}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText(/manage your workspace preferences/i)).toBeInTheDocument();
    expect(screen.getByText(/^workspace$/i)).toBeInTheDocument();

    const backBtn = screen.getByRole("button", { name: /back to dashboard/i });
    await userEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });

  it("allows switching appearance mode and triggers onToggleTheme", async () => {
    const onBack = vi.fn();
    const onToggleTheme = vi.fn();
    const onNavigate = vi.fn();

    render(
      <WorkspaceSettings
        isDarkTheme={false}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );

    const darkCard = screen.getByRole("radio", { name: /dark contrast/i });
    expect(darkCard).toBeInTheDocument();
    await userEvent.click(darkCard);
    expect(onToggleTheme).toHaveBeenCalledWith(true);

    const lightCard = screen.getByRole("radio", { name: /warm beige/i });
    await userEvent.click(lightCard);
    expect(onToggleTheme).toHaveBeenCalledWith(false);
  });

  it("displays honest notification alert behaviors and workspace capabilities", () => {
    const onBack = vi.fn();
    const onToggleTheme = vi.fn();
    const onNavigate = vi.fn();

    render(
      <WorkspaceSettings
        isDarkTheme={false}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByText(/warranty expiration & amc nudges/i)).toBeInTheDocument();
    expect(screen.getByText(/price watch target alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/12 products across 4 categories/i)).toBeInTheDocument();
    expect(screen.getByText(/mandatory human-in-the-loop review/i)).toBeInTheDocument();
  });

  it("shows local interactive workspace notice when user is not signed in", () => {
    const onBack = vi.fn();
    const onToggleTheme = vi.fn();
    const onNavigate = vi.fn();

    render(
      <WorkspaceSettings
        isDarkTheme={false}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByRole("heading", { level: 3, name: /local interactive workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/pre-loaded sample products, invoices, price watches/i)).toBeInTheDocument();
  });

  it("renders profile settings with 'Your account' heading when signed in", async () => {
    const onBack = vi.fn();
    const onToggleTheme = vi.fn();
    const onNavigate = vi.fn();

    render(
      <WorkspaceSettings
        userEmail="alex@example.com"
        isDarkTheme={false}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );

    expect(await screen.findByRole("heading", { name: /your account/i })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("alex@example.com")).toBeDisabled();
    expect(await screen.findByDisplayValue("Alex")).toBeInTheDocument();
  });
});
