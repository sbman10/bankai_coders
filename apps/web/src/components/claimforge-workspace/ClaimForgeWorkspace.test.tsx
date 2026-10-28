import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimForgeWorkspace } from "./ClaimForgeWorkspace";

const { upload, remove } = vi.hoisted(() => ({ upload: vi.fn(async () => ({ data: { path: "user-test-1/file.pdf" }, error: null })), remove: vi.fn(async () => ({ error: null })) }));
const mockSupabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-test-1" } }, error: null })) },
  storage: { from: vi.fn(() => ({ upload, remove })) },
}));
const mockNavigation = vi.hoisted(() => {
  const navigation = {
    pathname: "/",
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  };
  navigation.push.mockImplementation((path: string) => {
    navigation.pathname = path;
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  return navigation;
});

vi.mock("@/lib/supabase/client", () => ({ createClient: () => mockSupabase }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    usePathname: () => useSyncExternalStore(
      (notify) => {
        window.addEventListener("popstate", notify);
        return () => window.removeEventListener("popstate", notify);
      },
      () => mockNavigation.pathname,
      () => mockNavigation.pathname,
    ),
    useRouter: () => mockNavigation,
  };
});

beforeEach(() => {
  mockNavigation.pathname = "/";
  mockNavigation.push.mockClear();
  mockNavigation.replace.mockClear();
  mockNavigation.back.mockClear();
  mockNavigation.forward.mockClear();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/auth" && !init?.method) return { ok: true, json: async () => ({ user: { id: "user-test-1", email: "demo@example.com" } }) };
    if (url === "/api/account/profile" && !init?.method) return { ok: true, json: async () => ({ profile: { displayName: "Kapish", hasAvatar: false } }) };
    if (url === "/api/claims" && !init?.method) return { ok: true, json: async () => ({ claims: [] }) };
    if (url === "/api/claims" && init?.method === "POST") return { ok: true, json: async () => ({ claim: { id: "claim-test-1", productId: "product-test-1", status: "received" }, automation: "not_configured" }) };
    if (url === "/api/claims/claim-test-1/dispatch" && init?.method === "POST") return { ok: true, json: async () => ({ automation: "accepted" }) };
    if (url === "/api/products" && !init?.method) return { ok: true, json: async () => ({ products: [] }) };
    if (url === "/api/price-watches" && !init?.method) return { ok: true, json: async () => ({ watches: [] }) };
    if (url === "/api/reminders" && !init?.method) return { ok: true, json: async () => ({ reminders: [] }) };
    if (url === "/api/notifications" && !init?.method) return { ok: true, json: async () => ({ notifications: [], unreadCount: 0 }) };
    if (url === "/api/notifications/notice-1" && init?.method === "PATCH") return { ok: true, json: async () => ({ read: true }) };
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
  it("loads the notification inbox and opens a related workspace page", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth" && !init?.method) return { ok: true, json: async () => ({ user: { id: "user-test-1", email: "demo@example.com" } }) };
      if (url === "/api/account/profile" && !init?.method) return { ok: true, json: async () => ({ profile: { displayName: "Kapish", hasAvatar: false } }) };
      if (url === "/api/claims" && !init?.method) return { ok: true, json: async () => ({ claims: [] }) };
      if (url === "/api/notifications" && !init?.method) return { ok: true, json: async () => ({ notifications: [{ id: "notice-1", kind: "reminder", title: "Warranty expires soon", body: "Review your coverage.", href: "/dashboard/products", created_at: new Date().toISOString(), read_at: null }], unreadCount: 1 }) };
      if (url === "/api/notifications/notice-1" && init?.method === "PATCH") return { ok: true, json: async () => ({ read: true }) };
      return { ok: false, json: async () => ({ error: "Unexpected test request" }) };
    }));
    render(<ClaimForgeWorkspace userEmail="demo@example.com" />);
    const bell = await screen.findByRole("button", { name: "Notifications" });
    await user.click(bell);
    expect(await screen.findByText("Warranty expires soon")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /warranty expires soon/i }));
    expect(mockNavigation.push).toHaveBeenCalledWith("/dashboard/products");
  });

  it("opens the signed-in account menu and its real profile settings page", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace userEmail="kapish@example.com" onSignOut={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /account settings/i }));
    expect(await screen.findByRole("heading", { name: /your account/i })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("kapish@example.com")).toBeDisabled();
  });

  it("opens the fictional preview without public demo badge or checking auth", async () => {
    render(<ClaimForgeWorkspace />);

    // PUBLIC DEMO badge is completely removed from the sidebar
    expect(screen.queryByText(/public demo/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /make the next step/i })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/auth");
    expect(fetch).not.toHaveBeenCalledWith("/api/claims", expect.anything());

    // Intelligent welcome greeting renders without any hardcoded username
    const welcomeHeading = screen.getByRole("heading", { level: 1 });
    expect(welcomeHeading).toHaveTextContent(/good (morning|afternoon|evening)|up late/i);
    expect(welcomeHeading).not.toHaveTextContent(/rohan/i);
  });

  it("keeps Add Product absent from drawer navigation while accessible via contextual CTAs with return navigation", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    // Test A — Sidebar: Confirm Add Product is absent from the hamburger drawer
    const sidebarNav = screen.getByRole("navigation", { name: /workspace/i });
    expect(within(sidebarNav).queryByRole("button", { name: /^add product$/i })).not.toBeInTheDocument();

    // Test B — Dashboard: Click "+ Add Product" CTA on dashboard
    const dashboardAddBtn = screen.getByRole("button", { name: /^add product$/i });
    expect(dashboardAddBtn).toBeInTheDocument();
    await user.click(dashboardAddBtn);

    // Test D — Creation: Dedicated Add Product view is rendered with full options
    expect(await screen.findByRole("heading", { name: /^add product$/i })).toBeInTheDocument();
    expect(screen.getByText(/register a purchase invoice|extract details from an invoice/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to library/i })).toBeInTheDocument();

    // Test E — Return: Click "Back to library" and confirm saved products page opens
    await user.click(screen.getByRole("button", { name: /back to library/i }));
    expect(await screen.findByText(/products with a paper trail/i)).toBeInTheDocument();

    // Test C — My Products: Click "+ Add Product" from My Products header and confirm it opens the same interface
    const libraryAddBtn = screen.getByRole("button", { name: /^add product$/i });
    await user.click(libraryAddBtn);
    expect(await screen.findByRole("heading", { name: /^add product$/i })).toBeInTheDocument();
  });

  it("navigates to the interactive document assistant and product library", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(screen.getByRole("button", { name: /ask documents/i }));

    expect(await screen.findByRole("heading", { name: /ask about your documents/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^products$/i }));
    expect(await screen.findByText(/products with a paper trail/i)).toBeInTheDocument();
  });

  it("restores a directly opened workspace URL and exposes browser history controls", async () => {
    mockNavigation.pathname = "/dashboard/assistant";
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    expect(await screen.findByRole("heading", { name: /ask about your documents/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /go back/i }));
    await user.click(screen.getByRole("button", { name: /go forward/i }));

    expect(mockNavigation.back).toHaveBeenCalledOnce();
    expect(mockNavigation.forward).toHaveBeenCalledOnce();
  });

  it("updates the address when a workspace page is selected", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(screen.getByRole("button", { name: /ask documents/i }));

    expect(mockNavigation.push).toHaveBeenCalledWith("/dashboard/assistant");
  });

  it("navigates to My Claims and fetches claims without runtime error", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(screen.getByRole("button", { name: /my claims/i }));
    expect(fetch).toHaveBeenCalledWith("/api/claims", expect.anything());
    expect(await screen.findByText(/saved claims|no claims yet/i)).toBeInTheDocument();
  });

  it("navigates to Timeline, Price Watch, and Reminders from the prioritized sidebar", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);

    await user.click(screen.getByRole("button", { name: /^timeline$/i }));
    const timelineHeadings = await screen.findAllByText(/your ownership timeline|all product ownership events|ownership history/i);
    expect(timelineHeadings[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^price watch$/i }));
    expect(await screen.findByRole("heading", { name: /^find the best price\.$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^reminders$/i }));
    expect(await screen.findByText(/a nudge on your terms/i)).toBeInTheDocument();
  });

  it("uploads claim documents privately and saves the claim with only document references", async () => {
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

    expect(await screen.findByRole("heading", { name: /your claim is saved/i })).toBeInTheDocument();
    expect(screen.getByText("headphones-invoice.pdf")).toBeInTheDocument();
    expect(screen.getByText(/n8n receives only claim and product identifiers/i)).toBeInTheDocument();
    expect(mockSupabase.storage.from).toHaveBeenCalledWith("claim-documents");
    expect(upload).toHaveBeenCalledTimes(2);
    const claimRequest = vi.mocked(fetch).mock.calls.find(([url, init]) => url === "/api/claims" && init?.method === "POST")?.[1];
    expect(claimRequest).toBeDefined();
    const submitted = JSON.parse(String(claimRequest?.body));
    expect(submitted.documents).toHaveLength(2);
    expect(submitted.documents.map((document: { kind: string }) => document.kind)).toEqual(["invoice", "warranty"]);
    expect(String(claimRequest?.body)).not.toContain("sample invoice");
    expect(String(claimRequest?.body)).not.toContain("sample terms");
  });

  it("lets the signed-in user retry a claim after n8n is configured", async () => {
    const user = userEvent.setup();
    render(<ClaimForgeWorkspace />);
    await user.click(await screen.findByRole("button", { name: /start a claim/i }));
    await user.type(screen.getByLabelText(/product name/i), "Auralis headphones");
    await user.type(screen.getByLabelText(/what went wrong/i), "The left side stopped playing.");
    await user.click(screen.getByRole("button", { name: /save claim/i }));

    await user.click(await screen.findByRole("button", { name: /retry claim processing/i }));

    expect(fetch).toHaveBeenCalledWith("/api/claims/claim-test-1/dispatch", { method: "POST", cache: "no-store" });
    expect(await screen.findByText(/n8n accepted the claim event/i)).toBeInTheDocument();
  });

  it("keeps uploaded documents when the claim request has an ambiguous network failure", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/auth" && !init?.method) return { ok: true, json: async () => ({ user: { id: "user-test-1", email: "demo@example.com" } }) } as Response;
      if (String(input) === "/api/account/profile" && !init?.method) return { ok: true, json: async () => ({ profile: { displayName: "Kapish", hasAvatar: false } }) } as Response;
      if (String(input) === "/api/claims" && !init?.method) return { ok: true, json: async () => ({ claims: [] }) } as Response;
      if (String(input) === "/api/claims" && init?.method === "POST") throw new TypeError("Network connection lost");
      if (["/api/products", "/api/price-watches", "/api/reminders"].includes(String(input)) && !init?.method) return { ok: true, json: async () => ({ products: [], watches: [], reminders: [] }) } as Response;
      return { ok: false, json: async () => ({ error: "Unexpected test request" }) } as Response;
    });

    render(<ClaimForgeWorkspace />);
    await user.click(await screen.findByRole("button", { name: /start a claim/i }));
    await user.type(screen.getByLabelText(/product name/i), "Auralis headphones");
    await user.type(screen.getByLabelText(/what went wrong/i), "The left side stopped playing.");
    await user.upload(screen.getByLabelText(/purchase invoice/i), new File(["invoice"], "invoice.pdf", { type: "application/pdf" }));
    await user.upload(screen.getByLabelText(/warranty terms/i), new File(["terms"], "warranty.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /save claim/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/network|retry/i);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalled();
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
