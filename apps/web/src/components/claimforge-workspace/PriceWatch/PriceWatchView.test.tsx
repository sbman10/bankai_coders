import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceWatchView } from "./PriceWatchView";
import { SAMPLE_PRODUCTS } from "./priceWatchDemoData";

describe("PriceWatchView 2.0 Suite", () => {
  const mockOnAdd = vi.fn();
  const mockOnUpdate = vi.fn();
  const mockOnRemove = vi.fn();

  const sampleProducts = [
    {
      id: "prod-1",
      name: "Apple MacBook Air 15\" M3",
      brand: "Apple",
      model: "MacBook Air 15\" M3",
      imageUrl: "https://example.com/macbook.jpg",
    },
    {
      id: "prod-2",
      name: "Sony WH-1000XM5 Headphones",
      brand: "Sony",
      model: "WH-1000XM5",
      imageUrl: "https://example.com/sony.jpg",
    },
  ];

  const sampleWatches = [
    {
      id: "watch-101",
      productId: "prod-1",
      name: "Apple MacBook Air 15\" M3",
      url: "https://amazon.in/dp/B0CX23V253",
      currentPrice: 134900,
      targetPrice: 130000,
      currency: "INR",
      lastCheckedAt: "2026-10-27T10:00:00Z",
      createdAt: "2026-10-25T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAdd.mockResolvedValue(true);
    mockOnUpdate.mockResolvedValue(true);
    mockOnRemove.mockResolvedValue(true);
  });

  afterEach(() => {
    // Clear dangling UI timeouts (e.g. 4000ms success banner) to prevent jsdom teardown leak
    let id = setTimeout(() => {}, 0) as unknown as number;
    while (id > 0) {
      clearTimeout(id);
      id--;
    }
  });

  it("renders the Section A discovery card with eyebrow, headline, and URL input", () => {
    render(
      <PriceWatchView
        products={sampleProducts}
        watches={sampleWatches}
        busy={false}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText(/price intelligence/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /find the right price/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/paste a product link from a supported store/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compare prices/i })).toBeInTheDocument();
  });

  it("validates malformed URLs and provides helpful feedback without network calls", async () => {
    const user = userEvent.setup();
    render(
      <PriceWatchView
        products={sampleProducts}
        watches={sampleWatches}
        busy={false}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const input = screen.getByPlaceholderText(/paste a product link/i);
    await user.type(input, "not-a-valid-url");
    await user.click(screen.getByRole("button", { name: /compare prices/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/please enter a valid web url/i);
  });

  it("discovers a sample product, revealing Section B comparison and Section C alert configurator", async () => {
    const user = userEvent.setup();
    render(
      <PriceWatchView
        products={sampleProducts}
        watches={sampleWatches}
        busy={false}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    // Click 1-click sample chip for MacBook
    const sampleChip = screen.getByTitle(/compare prices for macbook air/i);
    await user.click(sampleChip);

    // Section B Product Identity Card and Metrics appear after discovery
    expect(await screen.findByText(/lowest current offer/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /available store offers/i })).toBeInTheDocument();
    expect(screen.getByText(/highest observed offer/i)).toBeInTheDocument();
    expect(screen.getByText(/potential difference/i)).toBeInTheDocument();
    expect(screen.getByText(/stores compared/i)).toBeInTheDocument();

    // Multi-retailer table rows
    expect(screen.getAllByText("Croma").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Amazon India").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Reliance Digital").length).toBeGreaterThanOrEqual(1);

    // Section C Alert Configurator is revealed
    expect(screen.getByRole("heading", { name: /set your price alert/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start tracking/i })).toBeInTheDocument();
  });

  it("supports sorting retailer offers by price and retailer name", async () => {
    const user = userEvent.setup();
    render(
      <PriceWatchView
        products={sampleProducts}
        watches={sampleWatches}
        busy={false}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    await user.click(screen.getByTitle(/compare prices for macbook air/i));
    const sortSelect = await screen.findByLabelText(/sort retailer offers/i);
    await user.selectOptions(sortSelect, "price_desc");
    expect((sortSelect as HTMLSelectElement).value).toBe("price_desc");

    await user.selectOptions(sortSelect, "retailer");
    expect((sortSelect as HTMLSelectElement).value).toBe("retailer");
  });

  it("activates tracking from alert configurator and enriches tracked products workspace", async () => {
    const user = userEvent.setup();
    render(
      <PriceWatchView
        products={sampleProducts}
        watches={sampleWatches}
        busy={false}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    // Discover product
    await user.click(screen.getByTitle(/compare prices for wh-1000xm5/i));
    await screen.findByRole("heading", { name: /sony wh-1000xm5/i });

    // Set custom target price in configurator
    const targetInput = screen.getByLabelText(/target price in indian rupees/i);
    await user.clear(targetInput);
    await user.type(targetInput, "23000");

    // Click Start Tracking
    const startTrackingBtn = screen.getByRole("button", { name: /start tracking/i });
    await user.click(startTrackingBtn);

    // Watchlist should now display the newly tracked item
    expect(await screen.findByText(/watch activated/i)).toBeInTheDocument();
  });

  it("allows removing a price watch with confirmation dialog", async () => {
    const user = userEvent.setup();
    render(
      <PriceWatchView
        products={sampleProducts}
        watches={sampleWatches}
        busy={false}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    // Find delete button on existing watch
    const deleteBtn = screen.getByLabelText(/remove price watch for apple macbook air/i);
    await user.click(deleteBtn);

    // Modal appears
    expect(screen.getByRole("heading", { name: /remove price watch/i })).toBeInTheDocument();

    // Confirm delete
    const confirmBtn = screen.getByRole("button", { name: "Remove Watch" });
    await user.click(confirmBtn);

    expect(mockOnRemove).toHaveBeenCalledWith("watch-101");
  });

  it("preserves manual watch form entry and calls onAdd with valid values", async () => {
    const user = userEvent.setup();
    render(
      <PriceWatchView
        products={sampleProducts}
        watches={sampleWatches}
        busy={false}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    await user.selectOptions(screen.getByLabelText("Product"), "prod-2");
    await user.type(screen.getByLabelText(/current price/i), "25000");
    await user.type(screen.getByLabelText(/alert below/i), "22000");
    await user.click(screen.getByRole("button", { name: /add manual watch/i }));

    expect(mockOnAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod-2",
        currentPrice: 25000,
        targetPrice: 22000,
      })
    );
  });

  it("discovers live OnePlus product from backend API and displays OnePlus N6 instead of demo MacBook", async () => {
    const user = userEvent.setup();
    const onePlusUrl = "https://www.amazon.in/OnePlus-Midnight-Smoothness-Military-Grade-Durability/dp/B0H3LKPC2K/ref=sr_1_3?sr=8-3";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        analysis: {
          canonicalIdentity: {
            brand: "OnePlus",
            model: "OnePlus N6",
            cleanTitle: "OnePlus N6 | 6GB+128GB | Midnight Green",
            variant: { ram: "6GB", storage: "128GB", color: "Midnight Green" },
            sku: "B0H3LKPC2K",
            imageUrl: "https://m.media-amazon.com/images/I/oneplus.jpg",
          },
          sourceQuote: {
            price: { current: 26999, mrp: 33999, currency: "INR" },
            availability: { status: "IN_STOCK", evidence: "Add to Cart button present" },
          },
          detectedCategory: "Mobiles & Tablets",
        },
      }),
    } as Response);

    render(
      <PriceWatchView
        products={sampleProducts}
        watches={sampleWatches}
        busy={false}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const input = screen.getByPlaceholderText(/paste a product link/i);
    await user.type(input, onePlusUrl);
    await user.click(screen.getByRole("button", { name: /compare prices/i }));

    const comparisonSection = await screen.findByRole("region", {
      name: /Product Identification and Multi-Store Comparison/i,
    });
    expect(within(comparisonSection).getByRole("heading", { name: /OnePlus N6/i })).toBeInTheDocument();
    expect(within(comparisonSection).getByText(/6GB RAM · 128GB Storage · Midnight Green/i)).toBeInTheDocument();
    expect(within(comparisonSection).queryByRole("heading", { name: /Apple MacBook Air/i })).not.toBeInTheDocument();

    fetchSpy.mockRestore();
  });
});
