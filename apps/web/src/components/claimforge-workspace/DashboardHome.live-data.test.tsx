import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { DashboardHome } from "./DashboardHome";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("signed-in dashboard data", () => {
  it("shows the signed-in user's saved products and timeline activity instead of fictional sample records", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url === "/api/products"
        ? { products: [{
            id: "product-owned-1",
            name: "Studio Headphones",
            brand: "Acme Audio",
            model: "Studio One",
            category: "Electronics",
            purchase_date: "2026-06-01",
            warranty_end: "2027-06-01",
            price_paid: 8999,
            currency: "INR",
            created_at: "2026-06-01T10:00:00.000Z",
          }] }
        : url === "/api/reminders"
          ? { reminders: [
              { id: "reminder-1", product_id: "product-owned-1", reminder_type: "claim_follow_up", title: "Check claim response", remind_at: "2026-10-30T03:30:00.000Z", status: "scheduled" },
              { id: "reminder-2", product_id: "product-owned-1", reminder_type: "service", title: "Appliance service", remind_at: "2026-10-25T03:30:00.000Z", status: "sent" },
            ] }
          : url === "/api/price-watches"
            ? { watches: [
                { id: "watch-1", product_id: "product-owned-1", current_price: 7999, target_price: 7500, current_price_source: "verified", last_check_status: "verified", last_checked_at: "2026-10-27T12:00:00.000Z", created_at: "2026-10-20T12:00:00.000Z" },
                { id: "watch-2", product_id: "product-owned-1", current_price: 8888, target_price: 5000, current_price_source: "unverified", last_check_status: "not_checked", created_at: "2026-10-26T10:00:00.000Z" },
              ] }
            : url === "/api/claims"
              ? { claims: [{ id: "claim-1", product_id: "product-owned-1", fault_description: "Left earcup stopped working", status: "ready_for_review", created_at: "2026-10-26T12:00:00.000Z" }] }
              : {};
      return { ok: true, json: async () => payload } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <DashboardHome
        isSignedIn
        referenceDate="2026-10-28"
        onStartClaim={vi.fn()}
        onOpenReview={vi.fn()}
        onNavigateTab={vi.fn()}
      />,
    );

    expect((await screen.findAllByText("Studio Headphones")).length).toBeGreaterThan(0);
    const productsSection = container.querySelector(".your-products-section");
    expect(productsSection).not.toBeNull();
    expect(within(productsSection as HTMLElement).queryByText("LG Refrigerator")).not.toBeInTheDocument();
    expect(within(productsSection as HTMLElement).queryByText("Minimalist Sunscreen")).not.toBeInTheDocument();

    const timeline = container.querySelector(".timeline-widget-card");
    expect(timeline).not.toBeNull();
    expect(within(timeline as HTMLElement).getByText("Check claim response")).toBeInTheDocument();
    expect(within(timeline as HTMLElement).getByText(/verified price/i)).toBeInTheDocument();
    expect(within(timeline as HTMLElement).getByText(/price not verified/i)).toBeInTheDocument();
    expect(within(timeline as HTMLElement).queryByText(/₹8,888/)).not.toBeInTheDocument();
    expect(within(timeline as HTMLElement).getByText(/notification sent/i)).toBeInTheDocument();
    expect(within(timeline as HTMLElement).getByText(/warranty expires/i)).toBeInTheDocument();
    expect(within(timeline as HTMLElement).getByText(/claim · ready for review/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/products", expect.objectContaining({ cache: "no-store" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders", expect.objectContaining({ cache: "no-store" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/price-watches", expect.objectContaining({ cache: "no-store" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/claims", expect.objectContaining({ cache: "no-store" }));
  });

  it("hides the previous account's snapshot immediately when the signed-in owner changes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url === "/api/products"
        ? { products: [{ id: "private-product-a", name: "Account A Headphones", category: "Electronics" }] }
        : {};
      return { ok: true, json: async () => payload } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const props = {
      isSignedIn: true,
      ownerKey: "user-a",
      referenceDate: "2026-10-28",
      onStartClaim: vi.fn(),
      onOpenReview: vi.fn(),
      onNavigateTab: vi.fn(),
    };
    const { rerender, container } = render(<DashboardHome {...props} />);
    expect(await screen.findAllByText("Account A Headphones")).not.toHaveLength(0);

    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    await act(async () => {
      rerender(<DashboardHome {...props} ownerKey="user-b" />);
    });

    const productsSection = container.querySelector(".your-products-section");
    expect(within(productsSection as HTMLElement).queryByText("Account A Headphones")).not.toBeInTheDocument();
  });
});
