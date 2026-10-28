import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpSupport } from "./HelpSupport";

afterEach(() => {
  cleanup();
});

describe("HelpSupport", () => {
  it("renders the help header, eyebrow, and search input", () => {
    const onBack = vi.fn();
    const onNavigate = vi.fn();

    render(<HelpSupport onBack={onBack} onNavigate={onNavigate} />);

    expect(screen.getByRole("heading", { level: 1, name: /how can we help\?/i })).toBeInTheDocument();
    expect(screen.getByText(/help & support/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search help topics/i)).toBeInTheDocument();
  });

  it("filters FAQs dynamically by search query", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigate = vi.fn();

    render(<HelpSupport onBack={onBack} onNavigate={onNavigate} />);

    const searchInput = screen.getByPlaceholderText(/search help topics/i);
    await user.type(searchInput, "OCR");

    expect(screen.getByText(/what file types and sizes are supported/i)).toBeInTheDocument();
    expect(screen.queryByText(/how do i monitor price drops/i)).not.toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByRole("button", { name: /clear search query/i });
    await user.click(clearBtn);

    expect(screen.getByText(/how do i monitor price drops/i)).toBeInTheDocument();
  });

  it("filters FAQs by category pill", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigate = vi.fn();

    render(<HelpSupport onBack={onBack} onNavigate={onNavigate} />);

    const priceWatchPill = screen.getByRole("tab", { name: /^price watch$/i });
    await user.click(priceWatchPill);

    expect(screen.getByText(/how do i monitor price drops on amazon or flipkart\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/what information is tracked in a product passport\?/i)).not.toBeInTheDocument();
  });

  it("expands accordion and triggers contextual navigation", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigate = vi.fn();

    render(<HelpSupport onBack={onBack} onNavigate={onNavigate} />);

    // Click on "How do I monitor price drops on Amazon or Flipkart?"
    const pwQuestion = screen.getByRole("button", { name: /how do i monitor price drops on amazon or flipkart\?/i });
    await user.click(pwQuestion);

    // Contextual button should appear
    const navBtn = screen.getByRole("button", { name: /open price watch/i });
    expect(navBtn).toBeInTheDocument();
    await user.click(navBtn);

    expect(onNavigate).toHaveBeenCalledWith("prices");
  });

  it("displays no-results state when query matches nothing", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigate = vi.fn();

    render(<HelpSupport onBack={onBack} onNavigate={onNavigate} />);

    const searchInput = screen.getByPlaceholderText(/search help topics/i);
    await user.type(searchInput, "xyznonexistentquery123");

    expect(screen.getByRole("heading", { level: 2, name: /no help topics found/i })).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: /clear search filters/i });
    await user.click(resetBtn);

    expect(screen.getByText(/how do i add a product to my workspace\?/i)).toBeInTheDocument();
  });
});
