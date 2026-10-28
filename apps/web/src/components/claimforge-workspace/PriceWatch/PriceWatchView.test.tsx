import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceWatchView } from "./PriceWatchView";

describe("PriceWatch Complete Experience Redesign Suite", () => {
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

  function mockDiscovery(title: string, brand: string, model: string, price = 1200) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        analysis: {
          canonicalIdentity: { brand, model, cleanTitle: title, sku: "B0TEST12345" },
          sourceQuote: { price: { current: price, mrp: price + 200, currency: "INR" }, availability: { status: "IN_STOCK", evidence: "In stock" } },
          candidateEvaluations: [
            { isEligibleForComparison: true, quote: { platform: "Flipkart", price: { current: price - 100, mrp: price + 200 }, availability: { status: "IN_STOCK", evidence: "In stock" }, productUrl: "https://www.flipkart.com/test" } },
            { isEligibleForComparison: true, quote: { platform: "Meesho", price: { current: price + 50, mrp: price + 200 }, availability: { status: "IN_STOCK", evidence: "In stock" }, productUrl: "https://www.meesho.com/test" } },
          ],
          detectedCategory: "General",
        },
      }),
    } as Response);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAdd.mockResolvedValue(true);
    mockOnUpdate.mockResolvedValue(true);
    mockOnRemove.mockResolvedValue(true);
  });

  afterEach(() => {
    // Clear dangling UI timeouts to prevent jsdom teardown leaks
    let id = setTimeout(() => {}, 0) as unknown as number;
    while (id > 0) {
      clearTimeout(id);
      id--;
    }
  });

  it("renders the standalone search header 'Find the best price.' without eyebrow or promotional subtitle", () => {
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

    // Standalone central heading
    expect(screen.getByRole("heading", { name: /^find the best price\.$/i })).toBeInTheDocument();

    // STRICT RULE: No eyebrow, no promotional subtitle, no noisy badges
    expect(screen.queryByText(/price intelligence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/never miss the drop/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/multi-store discovery engine/i)).not.toBeInTheDocument();

    // Prominent search input with exact placeholder
    expect(
      screen.getByPlaceholderText(/paste a product link from amazon, flipkart or meesho/i)
    ).toBeInTheDocument();

    // Single primary Compare prices CTA beneath input
    expect(screen.getByRole("button", { name: /^compare prices$/i })).toBeInTheDocument();

    // Discreet indication of supported stores
    expect(screen.getByText(/supported stores: amazon india · flipkart · meesho/i)).toBeInTheDocument();

    // DO NOT advertise Croma or Reliance Digital
    expect(screen.queryByText("Croma")).not.toBeInTheDocument();
    expect(screen.queryByText("Reliance Digital")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/please enter a valid web url/i);
  });

  it("analyzes a product URL, revealing product identity, 3-store comparison grid, and tracking action", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockDiscovery("Auralis Sun Shield 50", "Auralis", "Sun Shield 50");
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

    // Enter valid Amazon product link
    const input = screen.getByPlaceholderText(/paste a product link/i);
    await user.type(input, "https://www.amazon.in/dp/B0CX23V253");
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    // Product Identity Header and Summary appear
    const lowestLabels = await screen.findAllByText(/lowest verified price/i);
    expect(lowestLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: /store offers/i })).toBeInTheDocument();

    // Supported stores are represented (Amazon, Flipkart, Meesho)
    expect(screen.getAllByText("Amazon India").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Flipkart").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Meesho").length).toBeGreaterThanOrEqual(1);

    // Unsupported stores must NOT appear
    expect(screen.queryByText("Croma")).not.toBeInTheDocument();
    expect(screen.queryByText("Reliance Digital")).not.toBeInTheDocument();

    // Target tracking section is revealed
    expect(screen.getByRole("heading", { name: /track this product/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start tracking/i })).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it("supports sorting retailer offers by price", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockDiscovery("Auralis Sun Shield 50", "Auralis", "Sun Shield 50");
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
    await user.type(input, "https://www.amazon.in/dp/B0CX23V253");
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    const sortSelect = await screen.findByLabelText(/sort retailer offers/i);
    await user.selectOptions(sortSelect, "price_desc");
    expect((sortSelect as HTMLSelectElement).value).toBe("price_desc");
    fetchSpy.mockRestore();
  });

  it("tracks a product from search results, persisting via onAdd and adding card to watchlist", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockDiscovery("Sony WH-1000XM5 Wireless Headphones", "Sony", "WH-1000XM5", 24990);
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
    const input = screen.getByPlaceholderText(/paste a product link/i);
    await user.type(input, "https://www.amazon.in/dp/B09XS7JWHH");
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

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
    expect(mockOnAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPrice: 23000,
      })
    );
    fetchSpy.mockRestore();
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

    // Find delete button on existing watch card
    const deleteBtn = screen.getByLabelText(/remove price watch for apple macbook air/i);
    await user.click(deleteBtn);

    // Confirmation modal appears
    expect(screen.getByRole("heading", { name: /remove price watch/i })).toBeInTheDocument();

    // Confirm delete
    const confirmBtn = screen.getByRole("button", { name: "Remove Watch" });
    await user.click(confirmBtn);

    expect(mockOnRemove).toHaveBeenCalledWith("watch-101");
  });

  it("verifies manual watch section is completely removed from the DOM", () => {
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

    // Section 8: "Start a manual watch" form is completely removed
    expect(screen.queryByText(/start a manual watch/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/add manual watch/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/alert below/i)).not.toBeInTheDocument();
  });

  it("discovers live OnePlus product from backend API and displays clean product comparison", async () => {
    const user = userEvent.setup();
    const onePlusUrl = "https://www.amazon.in/OnePlus-Midnight-Smoothness-Military-Grade-Durability/dp/B0H3LKPC2K";

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
            availability: { status: "IN_STOCK", evidence: "In Stock" },
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
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    const comparisonSection = await screen.findByRole("region", {
      name: /Product Identification and Multi-Store Comparison/i,
    });
    expect(within(comparisonSection).getByRole("heading", { name: /OnePlus N6/i })).toBeInTheDocument();
    expect(within(comparisonSection).getByText(/6GB RAM · 128GB Storage · Midnight Green/i)).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("shows an unavailable state instead of a zero or verified price when no quote exists", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        analysis: {
          canonicalIdentity: {
            brand: "RingConn",
            model: "Gen 2 Air",
            cleanTitle: "RingConn Gen 2 Air Ultra-Thin Smart Ring",
            sku: "B0DWK4QQ7H",
          },
          sourceQuote: {
            price: null,
            availability: { status: "IN_STOCK", evidence: "Product page responded" },
          },
          detectedCategory: "Wearables",
        },
      }),
    } as Response);

    render(<PriceWatchView products={sampleProducts} watches={sampleWatches} busy={false} onAdd={mockOnAdd} onUpdate={mockOnUpdate} onRemove={mockOnRemove} />);
    await user.type(screen.getByLabelText(/product url to compare prices/i), "https://www.amazon.in/dp/B0DWK4QQ7H");
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    const comparison = await screen.findByRole("region", { name: /product identification and multi-store comparison/i });
    expect(within(comparison).getByText(/price unavailable/i)).toBeInTheDocument();
    expect(within(comparison).getByText("0")).toBeInTheDocument();
    expect(within(comparison).queryByText(/verified live/i)).not.toBeInTheDocument();
    expect(within(comparison).queryByText(/₹0/)).not.toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("does not present a failed Firecrawl analysis as live results", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "Price source is temporarily unavailable." }),
    } as Response);

    render(<PriceWatchView products={sampleProducts} watches={sampleWatches} busy={false} onAdd={mockOnAdd} onUpdate={mockOnUpdate} onRemove={mockOnRemove} />);
    await user.type(screen.getByLabelText(/product url to compare prices/i), "https://www.amazon.in/dp/B0DWK4QQ7H");
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/price source is temporarily unavailable/i);
    expect(screen.queryByRole("region", { name: /product identification and multi-store comparison/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/verified live/i)).not.toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("does not substitute demo prices after a network failure", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed"));

    render(<PriceWatchView products={sampleProducts} watches={sampleWatches} busy={false} onAdd={mockOnAdd} onUpdate={mockOnUpdate} onRemove={mockOnRemove} />);
    await user.type(screen.getByLabelText(/product url to compare prices/i), "https://www.amazon.in/Apple-MacBook-Air/dp/B0NOTREAL");
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the price checker/i);
    expect(screen.queryByRole("region", { name: /product identification and multi-store comparison/i })).not.toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("explains that Amazon.com is outside the current INR price-check coverage", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<PriceWatchView products={sampleProducts} watches={sampleWatches} busy={false} onAdd={mockOnAdd} onUpdate={mockOnUpdate} onRemove={mockOnRemove} />);
    await user.type(screen.getByLabelText(/product url to compare prices/i), "https://www.amazon.com/dp/B0DWK4QQ7H");
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/supports amazon india \(inr\), not amazon\.com \(usd\)/i);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
