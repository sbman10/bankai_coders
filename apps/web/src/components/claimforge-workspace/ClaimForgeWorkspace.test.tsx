import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimForgeWorkspace } from "./ClaimForgeWorkspace";

const mockSupabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-test-1" } }, error: null })) },
  storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })) })) },
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/auth" && !init?.method) return { ok: true, json: async () => ({ user: { id: "user-test-1", email: "demo@example.com" } }) };
    if (url === "/api/claims" && !init?.method) return { ok: true, json: async () => ({ claims: [] }) };
    if (url === "/api/claims" && init?.method === "POST") return { ok: true, json: async () => ({ claim: { id: "claim-test-1", status: "received" }, automation: "not_configured" }) };
    if (url === "/api/auth" && init?.method === "POST") return { ok: true, json: async () => ({ ok: true }) };
    return { ok: false, json: async () => ({ error: "Unexpected test request" }) };
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ClaimForge customer workflow", () => {
  it("opens the fictional public demo without checking auth or requesting private data", async () => {
    render(<ClaimForgeWorkspace />);

    expect(await screen.findAllByText(/public demo/i)).not.toHaveLength(0);
    expect(screen.getByRole("heading", { name: /make the next step/i })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/auth");
    expect(fetch).not.toHaveBeenCalledWith("/api/claims", expect.anything());
  });

  it("explains that private document Q&A is unavailable in the public demo", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(screen.getByRole("button", { name: /ask documents/i }));

    expect(await screen.findByRole("heading", { name: /private account features are turned off/i })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/products", expect.anything());
    expect(fetch).not.toHaveBeenCalledWith("/api/assistant/answer", expect.anything());

    await user.click(screen.getByRole("button", { name: /^products$/i }));
    expect(screen.getByRole("heading", { name: /private account features are turned off/i })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/products", expect.anything());
  });

  it("creates a browser-only claim preview without uploading files or saving a claim", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(await screen.findByRole("button", { name: /start a claim/i }));
    await user.type(screen.getByLabelText(/product name/i), "Auralis headphones");
    await user.type(
      screen.getByLabelText(/what went wrong/i),
      "The left side stopped playing yesterday.",
    );
    await user.upload(
      screen.getByLabelText(/purchase invoice/i),
      new File(["sample invoice"], "headphones-invoice.pdf", {
        type: "application/pdf",
      }),
    );
    await user.upload(
      screen.getByLabelText(/warranty terms/i),
      new File(["sample terms"], "warranty-terms.pdf", {
        type: "application/pdf",
      }),
    );
    await user.click(screen.getByRole("button", { name: /save claim/i }));

    expect(await screen.findByRole("heading", { name: /review your claim/i })).toBeInTheDocument();
    expect(screen.getByText("headphones-invoice.pdf")).toBeInTheDocument();
    expect(screen.getByText(/no file was uploaded, no claim was saved/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/claims", expect.objectContaining({ method: "POST" }));
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });

  it("shows evidence citations next to the preliminary assessment", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(await screen.findByRole("button", { name: /open full review/i }));
    expect(screen.getByText(/likely within stated term/i)).toBeInTheDocument();
    expect(screen.getByText(/invoice · page 1/i)).toBeInTheDocument();
    expect(screen.getAllByText(/warranty terms · page 2/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/not a coverage decision/i),
    ).toBeInTheDocument();
  });

  it("records explicit approval before marking the demo draft ready", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(await screen.findByRole("button", { name: /review claim/i }));
    expect(
      screen.getAllByRole("status").some((item) => /not approved yet/i.test(item.textContent ?? "")),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: /approve draft/i }));

    expect(
      (await screen.findAllByRole("status")).some((item) => /approved for demo/i.test(item.textContent ?? "")),
    ).toBe(true);
    expect(screen.getAllByText(/no message was sent/i).length).toBeGreaterThan(0);
  });

  it("prepares an editable factual clarification draft after a rejection", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(await screen.findByRole("button", { name: /open full review/i }));
    await user.type(screen.getByLabelText(/reason for rejection/i), "Physical damage is excluded");
    await user.click(screen.getByRole("button", { name: /prepare clarification draft/i }));

    const draft = await screen.findByRole("textbox", { name: /editable reply draft/i });
    expect((draft as HTMLTextAreaElement).value).toContain("Physical damage is excluded");
    expect(screen.getAllByText(/not legal advice/i).length).toBeGreaterThan(0);
  });

  it("rejects an unsupported claim document type", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ClaimForgeWorkspace />);

    await user.click(await screen.findByRole("button", { name: /start a claim/i }));
    await user.upload(screen.getByLabelText(/purchase invoice/i), new File(["bad file"], "invoice.exe", { type: "application/octet-stream" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/pdf, jpg, or png/i);
  });

  it("rejects a claim document larger than 10 MB", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(await screen.findByRole("button", { name: /start a claim/i }));
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "invoice.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/purchase invoice/i), oversized);

    expect(await screen.findByRole("alert")).toHaveTextContent(/10 mb/i);
  });
});
