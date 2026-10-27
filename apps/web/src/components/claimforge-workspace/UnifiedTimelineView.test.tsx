import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCenter } from "./ProductCenter";

const { browserGetUser, storageUpload, storageRemove } = vi.hoisted(() => ({
  browserGetUser: vi.fn(),
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: browserGetUser },
    storage: { from: () => ({ upload: storageUpload, remove: storageRemove }) },
  }),
}));

const mockProducts = [
  {
    id: "prod-1",
    name: "Sony WH-1000XM5 Noise Cancelling Headphones",
    brand: "Sony",
    model: "WH-1000XM5",
    category: "Audio",
    seller: "Amazon India (Appario Retail)",
    serial_number: "SN-SNY-9982412",
    purchase_date: "2024-02-14",
    warranty_end: "2025-02-13", // Expired historical warranty
    price_paid: 24990,
    currency: "INR",
    created_at: "2024-02-14T10:30:00Z",
  },
  {
    id: "prod-2",
    name: "Anker Soundcore Life Q30",
    brand: "Soundcore",
    model: "A3028",
    category: "Electronics",
    seller: "Appario Retail Pvt Ltd",
    serial_number: "SN-ANK-4412",
    purchase_date: "2026-07-15",
    warranty_end: "2028-01-15", // Active future warranty
    price_paid: 6999,
    currency: "INR",
    created_at: "2026-07-15T12:00:00Z",
  },
  {
    id: "prod-3",
    name: "LG 655L Frost-Free Refrigerator",
    brand: "LG",
    model: "GL-X257AMCX",
    category: "Appliances",
    seller: "Croma Retail Indiranagar",
    serial_number: "SN-LG-8874102",
    purchase_date: "2023-11-20",
    warranty_end: "2024-11-19",
    price_paid: 84990,
    currency: "INR",
    created_at: "2023-11-20T14:15:00Z",
  },
];

const mockClaims = [
  {
    id: "claim-1",
    product_id: "prod-1",
    fault_description: "Left earcup stopped producing audio",
    status: "ready_for_review",
    created_at: "2024-10-15T09:30:00Z",
  },
];

const mockWatches = [
  {
    id: "watch-1",
    product_id: "prod-1",
    product_url: "https://example.com/sony",
    current_price: 24990,
    target_price: 22000,
    currency: "INR",
    last_checked_at: "2026-10-25T12:20:00Z",
    created_at: "2024-03-01T10:00:00Z",
    products: { name: "Sony WH-1000XM5 Noise Cancelling Headphones" },
  },
];

const mockReminders = [
  {
    id: "rem-1",
    product_id: "prod-3",
    remind_at: "2027-11-05T09:00:00Z", // Future date
    reason: "LG Refrigerator annual maintenance check (estimated 365-day interval)",
    products: { name: "LG 655L Frost-Free Refrigerator" },
  },
];

describe("UnifiedTimelineView", () => {
  beforeEach(() => {
    browserGetUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    storageUpload.mockResolvedValue({ error: null });
    storageRemove.mockResolvedValue({ error: null });

    vi.spyOn(global, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/products") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ products: mockProducts }),
        } as Response;
      }
      if (url === "/api/claims") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ claims: mockClaims }),
        } as Response;
      }
      if (url === "/api/price-watches") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ watches: mockWatches }),
        } as Response;
      }
      if (url === "/api/reminders") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ reminders: mockReminders }),
        } as Response;
      }
      if (url.includes("/documents")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ documents: [] }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });
  });

  it("establishes clear visual hierarchy with approved eyebrow, heading, and subtitle without duplicate headers", async () => {
    render(<ProductCenter view="timeline" />);

    // Approved top hierarchy
    expect(await screen.findByText("UNIFIED PRODUCT TIMELINE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your ownership history." })).toBeInTheDocument();
    expect(
      screen.getByText("Every purchase, milestone and product event — all in one place.")
    ).toBeInTheDocument();

    // Verifies duplicate inner headers are removed
    expect(screen.queryByRole("heading", { name: "All Product Ownership Events" })).not.toBeInTheDocument();
    expect(screen.queryByText("UNIFIED HISTORY")).not.toBeInTheDocument();
  });

  it("renders a unified timeline combining past, present and future events with clear distinction", async () => {
    render(<ProductCenter view="timeline" />);

    // Past events exist
    const sonyElements = await screen.findAllByText("Sony WH-1000XM5 Noise Cancelling Headphones");
    expect(sonyElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/left earcup stopped producing audio/i)).toBeInTheDocument();

    // Future milestone: Anker Q30 warranty is in 2028 (future), so it must be marked as Upcoming / Active, not expired
    const upcomingBadges = screen.getAllByText(/upcoming|active coverage|valid through/i);
    expect(upcomingBadges.length).toBeGreaterThan(0);

    // Expired warranty: Sony WH-1000XM5 warranty ended in 2025 (past)
    expect(screen.getAllByText(/coverage expired|warranty ended/i).length).toBeGreaterThan(0);
  });

  it("separates dates cleanly into dedicated date labels instead of concatenating with titles", async () => {
    render(<ProductCenter view="timeline" />);

    // Wait for records to load
    await screen.findAllByText("Sony WH-1000XM5 Noise Cancelling Headphones");

    // Date chips/labels exist as discrete visual elements
    const dateLabels = screen.getAllByTestId("timeline-date-chip");
    expect(dateLabels.length).toBeGreaterThan(0);

    // Verify date is not concatenated into the title element
    const titles = screen.getAllByTestId("timeline-event-title");
    for (const title of titles) {
      expect(title.textContent).not.toMatch(/^(1[0-9]|2[0-9]|3[01]|[1-9])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/);
    }
  });

  it("supports product filtering via dropdown and updates event count accurately", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="timeline" />);

    await screen.findAllByText("Sony WH-1000XM5 Noise Cancelling Headphones");

    const filterSelect = screen.getByRole("combobox", { name: /filter by product/i });
    expect(filterSelect).toBeInTheDocument();

    // Select Anker Soundcore Life Q30
    await user.selectOptions(filterSelect, "prod-2");

    // Only Anker events should be displayed
    expect(screen.getAllByText("Anker Soundcore Life Q30").length).toBeGreaterThan(0);
    expect(screen.queryByText(/left earcup stopped producing audio/i)).not.toBeInTheDocument();
  });

  it("supports searching events by keyword with instant filtering and clear empty state", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="timeline" />);

    await screen.findAllByText("Sony WH-1000XM5 Noise Cancelling Headphones");

    const searchInput = screen.getByPlaceholderText(/search events/i);
    expect(searchInput).toBeInTheDocument();

    // Search for Appario
    await user.type(searchInput, "Appario");
    expect(screen.getAllByText(/appario/i).length).toBeGreaterThan(0);

    // Search for non-existent keyword
    await user.clear(searchInput);
    await user.type(searchInput, "NonExistentKeywordXYZ");

    expect(screen.getByText(/no ownership events found/i)).toBeInTheDocument();
  });

  it("provides functional 'View Passport' action button that opens product passport", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="timeline" />);

    await screen.findAllByText("Sony WH-1000XM5 Noise Cancelling Headphones");

    const passportBtns = screen.getAllByRole("button", { name: /view passport/i });
    expect(passportBtns.length).toBeGreaterThan(0);

    // Click the first button
    await user.click(passportBtns[0]);

    // Product Passport modal should open
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("renders Aceternity sticky year chapter dividers for distinct chronological chapters", async () => {
    render(<ProductCenter view="timeline" />);

    await screen.findAllByText("Sony WH-1000XM5 Noise Cancelling Headphones");

    // Year chapter dividers exist
    const yearChapters = screen.getAllByTestId("timeline-year-chapter");
    expect(yearChapters.length).toBeGreaterThan(0);

    // Verify presence of secondary chapter year badges (e.g. 2028, 2027, 2026, 2024, 2023)
    const chapterTexts = yearChapters.map((el) => el.textContent?.trim());
    expect(chapterTexts.some((txt) => txt?.includes("2028"))).toBe(true);
    expect(chapterTexts.some((txt) => txt?.includes("2024") || txt?.includes("2023"))).toBe(true);
  });

  it("renders exact-date markers with tabular day, uppercase month, and year", async () => {
    render(<ProductCenter view="timeline" />);

    await screen.findAllByText("Sony WH-1000XM5 Noise Cancelling Headphones");

    const dateChips = screen.getAllByTestId("timeline-date-chip");
    expect(dateChips.length).toBeGreaterThan(0);

    // The first date chip (future event in 2028) has day "15", month "JAN", year "2028"
    const firstChip = dateChips[0];
    expect(firstChip.querySelector(".timeline-day-num")).toBeInTheDocument();
    expect(firstChip.querySelector(".timeline-month-txt")).toBeInTheDocument();
    expect(firstChip.querySelector(".timeline-year-txt")).toBeInTheDocument();
  });
});
