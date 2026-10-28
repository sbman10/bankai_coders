import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCenter } from "./ProductCenter";

const { browserGetUser, storageUpload, storageRemove } = vi.hoisted(() => ({ browserGetUser: vi.fn(), storageUpload: vi.fn(), storageRemove: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: browserGetUser }, storage: { from: () => ({ upload: storageUpload, remove: storageRemove }) } }) }));

const productId = "a746fbe1-a663-44ac-88f7-2e99e9022bc5";
const createdProductId = "c91ace88-beb4-447d-bc70-8d9fb23dcd45";
const fetchMock = vi.fn();

function response(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  browserGetUser.mockResolvedValue({ data: { user: { id: "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1" } }, error: null });
  storageUpload.mockResolvedValue({ error: null });
  storageRemove.mockResolvedValue({ error: null });
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body && typeof init.body === "string" ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url === "/api/products/extract-invoice" && method === "POST") {
      return response({
        success: true,
        invoice: {
          productName: "Soundcore Life Q30",
          brand: "Soundcore",
          model: "A3028",
          category: "Electronics",
          ownerName: "Rohan Sharma",
          buyingMethod: "Credit Card",
          purchasePlatform: "Amazon.in",
          seller: "Appario Retail Pvt Ltd",
          amount: 5999,
          currency: "INR",
          purchaseDate: "2026-02-12",
          invoiceNumber: "IN-2026-88192",
          suggestedWarrantyMonths: 18,
        },
      });
    }
    if (url === "/api/price-intelligence/analyze" && method === "POST") {
      return response({
        success: true,
        analysis: {
          canonicalIdentity: {
            brand: "Auralis",
            model: "Sun Shield 50",
            cleanTitle: "Daily sunscreen",
            sku: "B0CX23V253",
          },
          sourceQuote: {
            price: { current: 1200, mrp: 1500, currency: "INR" },
            availability: { status: "IN_STOCK", evidence: "In Stock" },
          },
          detectedCategory: "Personal care",
        },
      });
    }
    if (url === "/api/products" && method === "GET") return response({ products: [{ id: productId, name: "Daily sunscreen", category: "Personal care", purchase_date: null, warranty_end: null }] });
    if (url === "/api/price-watches" && method === "GET") return response({ watches: [] });
    if (url === "/api/reminders" && method === "GET") return response({ reminders: [] });
    if (url === "/api/claims" && method === "GET") return response({ claims: [] });
    if (url === `/api/products/${productId}/documents` && method === "GET") return response({ documents: [] });
    if (url.match(/\/api\/products\/[^/]+\/documents$/) && method === "POST") return response({ document: { id: "doc-1", product_id: body.productId ?? productId, document_kind: body.documentKind, storage_path: body.storagePath, original_filename: body.fileName, mime_type: body.mimeType, size_bytes: body.sizeBytes, created_at: "2026-10-22T08:00:00Z" } }, 201);
    if (url.match(/\/api\/products\/[^/]+\/documents\/[^/]+\/index$/) && method === "POST") return response({ status: "indexed" });
    if (url === `/api/products/${productId}/documents/doc-1` && method === "GET") return response({ url: "https://storage.example/private-download" });
    if (url === `/api/products/${productId}/documents/doc-1` && method === "DELETE") return response({ removed: true });
    if (url === "/api/products" && method === "POST") return response({ product: { id: createdProductId, name: body.name, brand: body.brand, model: body.model, category: body.category, seller: body.seller, serial_number: body.serialNumber, purchase_date: body.purchaseDate, warranty_end: body.warrantyEnd, owner_name: body.ownerName, buying_method: body.buyingMethod, purchase_platform: body.purchasePlatform, price_paid: body.pricePaid } }, 201);
    if (url === `/api/products/${productId}` && method === "PATCH") return response({ product: { id: productId, name: body.name ?? "Daily sunscreen", brand: body.brand, model: body.model, category: body.category ?? "Personal care", seller: body.seller, serial_number: body.serialNumber, purchase_date: body.purchaseDate, warranty_end: body.warrantyEnd } });
    if (url === "/api/price-watches" && method === "POST") return response({ watch: { id: "watch-1", product_id: body.productId, product_url: "", current_price: body.currentPrice, target_price: body.targetPrice, currency: "INR", products: { name: "Daily sunscreen" } } }, 201);
    if (url === "/api/price-watches/watch-1" && method === "PATCH") return response({ watch: { id: "watch-1", product_id: productId, product_url: "", current_price: body.currentPrice, target_price: 1000, currency: "INR", products: { name: "Daily sunscreen" } } });
    if (url === "/api/reminders" && method === "POST") return response({ reminder: { id: "reminder-1", product_id: body.productId, remind_at: `${body.remindAt}T09:00:00+05:30`, reason: `Replenishment reminder based on your estimated ${body.estimateDays}-day usage period.`, products: { name: "Daily sunscreen" } } }, 201);
    return response({ removed: true, cancelled: true }, 200);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("account-backed product tools", () => {
  it("saves a product to the signed-in account", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="add-product" />);

    // Switch to manual entry tab
    await user.click(await screen.findByRole("tab", { name: /add manually/i }));

    await user.type(await screen.findByLabelText(/product name/i), "Toy car");
    await user.type(screen.getByLabelText("Brand"), "Auralis");
    await user.type(screen.getByLabelText("Model"), "Pulse 2");
    await user.type(screen.getByLabelText("Category"), "Toys");
    await user.type(screen.getByLabelText("Seller"), "Example Store");
    await user.type(screen.getByLabelText("Serial number"), "SN-123456");
    await user.click(screen.getByRole("button", { name: /add product/i }));

    expect((await screen.findAllByText("Toy car")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("img", { name: "Toy car category illustration" }).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith("/api/products", expect.objectContaining({ method: "POST" }));
    const createRequest = fetchMock.mock.calls.find(([url, init]) => url === "/api/products" && init?.method === "POST");
    expect(JSON.parse(String(createRequest?.[1]?.body))).toEqual(expect.objectContaining({ brand: "Auralis", model: "Pulse 2", seller: "Example Store", serialNumber: "SN-123456" }));
  });

  it("edits a saved product's product-passport identity fields", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="products" />);

    await user.click(await screen.findByRole("button", { name: /edit daily sunscreen/i }));
    const editForm = within(screen.getByRole("button", { name: "Save" }).closest("form")!);
    await user.type(editForm.getByLabelText("Brand"), "Auralis");
    await user.type(editForm.getByLabelText("Model"), "Sun Shield 50");
    await user.type(editForm.getByLabelText("Seller"), "Chemist");
    await user.type(editForm.getByLabelText("Serial"), "LOT-45");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const updateRequest = fetchMock.mock.calls.find(([url, init]) => url === `/api/products/${productId}` && init?.method === "PATCH");
    expect(JSON.parse(String(updateRequest?.[1]?.body))).toEqual(expect.objectContaining({ brand: "Auralis", model: "Sun Shield 50", seller: "Chemist", serialNumber: "LOT-45" }));
  });

  it("tracks a product from search, updates price, and marks the target as reached", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="prices" />);

    // Search and analyze product
    const searchInput = await screen.findByPlaceholderText(/paste a product link/i);
    await user.type(searchInput, "https://www.amazon.in/dp/B0CX23V253");
    await user.click(screen.getByRole("button", { name: /^compare prices$/i }));

    // Track product from results
    const targetInput = await screen.findByLabelText(/target price in indian rupees/i);
    await user.clear(targetInput);
    await user.type(targetInput, "1000");
    await user.click(screen.getByRole("button", { name: /start tracking/i }));

    expect(await screen.findByText(/watch activated/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/price-watches", expect.objectContaining({ method: "POST" }));

    // Update verified price on watch card
    const updateBtn = screen.getByLabelText(/update price for daily sunscreen/i);
    await user.click(updateBtn);
    const priceInput = screen.getByLabelText(/update price for daily sunscreen/i);
    await user.clear(priceInput);
    await user.type(priceInput, "950");
    await user.click(screen.getByLabelText(/save price update/i));

    expect(await screen.findByText(/deal unlocked/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/price-watches/watch-1", expect.objectContaining({ method: "PATCH" }));
  });

  it("schedules an in-app replenishment reminder from the user's estimate", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="reminders" />);

    await user.selectOptions(await screen.findByLabelText("Saved product"), productId);
    await user.type(screen.getByLabelText(/estimated usage period/i), "45");
    await user.type(screen.getByLabelText(/remind me on/i), "2099-12-10");
    await user.click(screen.getByRole("button", { name: /save reminder/i }));

    expect(await screen.findByText(/based on your 45-day estimate/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders", expect.objectContaining({ method: "POST" }));
  });

  it("shows a product timeline across warranty, claims, price checks, and reminders", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/products") return response({ products: [{ id: productId, name: "Daily sunscreen", category: "Personal care", purchase_date: "2026-01-10", warranty_end: "2027-01-10" }] });
      if (url === "/api/price-watches") return response({ watches: [{ id: "watch-1", product_id: productId, product_url: "", current_price: 950, target_price: 1000, currency: "INR", last_checked_at: "2026-05-10T08:30:00Z", created_at: "2026-05-01T08:30:00Z", products: { name: "Daily sunscreen" } }] });
      if (url === "/api/reminders") return response({ reminders: [{ id: "reminder-1", product_id: productId, remind_at: "2026-06-01T09:00:00+05:30", reason: "Replenishment reminder based on your estimated 45-day usage period.", products: { name: "Daily sunscreen" } }] });
      if (url === "/api/claims") return response({ claims: [{ id: "claim-1", product_id: productId, fault_description: "Pump stopped working", failure_date: "2026-04-20", status: "review", created_at: "2026-04-21T12:00:00Z" }] });
      return response({});
    });

    const user = userEvent.setup();
    render(<ProductCenter view="products" />);
    await user.click(await screen.findByRole("button", { name: /view timeline for daily sunscreen/i }));

    expect(screen.getByRole("heading", { name: /daily sunscreen timeline/i })).toBeInTheDocument();
    expect(screen.getByText("Product purchased")).toBeInTheDocument();
    expect(screen.getByText("Warranty ends")).toBeInTheDocument();
    expect(screen.getByText("Claim started")).toBeInTheDocument();
    expect(screen.getByText(/pump stopped working/i)).toBeInTheDocument();
    expect(screen.getByText(/price checked/i)).toBeInTheDocument();
    expect(screen.getByText(/₹950/i)).toBeInTheDocument();
    expect(screen.getByText(/reminder scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/45-day estimate/i)).toBeInTheDocument();
  });

  it("attaches product documents privately and prepares a short-lived download link", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="products" />);
    await user.click(await screen.findByRole("button", { name: /view timeline for daily sunscreen/i }));
    await user.selectOptions(await screen.findByLabelText("Document type"), "warranty");
    const fileInput = screen.getByLabelText(/choose document/i);
    await user.upload(fileInput, new File(["12 months from purchase"], "warranty.pdf", { type: "application/pdf" }));
    expect(fileInput).toHaveProperty("files.0.name", "warranty.pdf");
    expect((fileInput as HTMLInputElement).form).toHaveClass("passport-document-form");
    const attachButton = screen.getByRole("button", { name: /attach document/i });
    expect(attachButton).toBeEnabled();
    await user.click(attachButton);

    expect(storageUpload).toHaveBeenCalled();
    expect(await screen.findByText("warranty.pdf")).toBeInTheDocument();
    expect(storageUpload).toHaveBeenCalledWith(expect.stringMatching(/^f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1\//), expect.any(File), expect.objectContaining({ contentType: "application/pdf", upsert: false }));
    expect(fetchMock).toHaveBeenCalledWith(`/api/products/${productId}/documents`, expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith(`/api/products/${productId}/documents/doc-1/index`, expect.objectContaining({ method: "POST" }));

    await user.click(screen.getByRole("button", { name: /prepare private link/i }));
    expect(await screen.findByRole("link", { name: /open file/i })).toHaveAttribute("href", "https://storage.example/private-download");
  });

  it("uploads an invoice, autofills details via AI OCR extraction, and creates a passport", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="add-product" />);

    // In automated mode, upload an invoice file
    const fileInput = await screen.findByLabelText(/upload invoice file/i);
    const invoiceFile = new File(["sample amazon invoice"], "amazon-invoice.pdf", { type: "application/pdf" });
    await user.upload(fileInput, invoiceFile);

    // Trigger extraction
    await user.click(screen.getByRole("button", { name: /extract details from invoice/i }));

    // Review modal opens with extracted details
    expect(await screen.findByRole("heading", { name: /product details extracted/i })).toBeInTheDocument();

    const modal = screen.getByRole("dialog");
    const nameInput = within(modal).getByDisplayValue("Soundcore Life Q30") as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();

    const sellerInput = within(modal).getByDisplayValue("Appario Retail Pvt Ltd") as HTMLInputElement;
    expect(sellerInput).toBeInTheDocument();

    // Click Confirm & Save in review dialog
    await user.click(within(modal).getByRole("button", { name: /confirm & save/i }));

    expect((await screen.findAllByText("Soundcore Life Q30")).length).toBeGreaterThanOrEqual(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/products", expect.objectContaining({ method: "POST" }));
    const postCall = fetchMock.mock.calls.find(([u, i]) => u === "/api/products" && i?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual(expect.objectContaining({
      name: "Soundcore Life Q30",
      brand: "Soundcore",
      ownerName: "Rohan Sharma",
      buyingMethod: "Credit Card",
      purchasePlatform: "Amazon.in",
      pricePaid: 5999,
      purchaseDate: "2026-02-12",
    }));
  });

  it("opens review modal with confidence tags, shows duplicate warning, allows editing, and saves on confirm", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body && typeof init.body === "string" ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (url === "/api/products/extract-invoice" && method === "POST") {
        return response({
          success: true,
          ocrEngine: "google-cloud-vision",
          rawText: "Invoice # TEST-INV-2026-10427",
          imageUrl: "https://images.example/headphones.jpg",
          sourceUrl: "https://catalog.example.com/first",
          extracted: {
            brand: "DemoSound",
            product_name: "Demo Wireless Headphones",
            model: "TEST-Q20",
            category: "Electronics",
            serial_number: "TEST-SN-00012345",
            invoice_number: "TEST-INV-2026-10427",
            order_id: "TEST-404-1234567-8901234",
            purchase_date: "2026-10-24",
            seller: "Demo Electronics Seller Pvt. Ltd.",
            price: 2499,
            currency: "INR",
            warranty_duration: "12 months",
            quantity: 1,
            source_marketplace: "Amazon (demo source)",
            owner_name: "Kapish Gupta",
            buying_method: "Credit Card",
          },
          fieldStatus: {
            brand: "confident",
            product_name: "confident",
            model: "confident",
            category: "confident",
            serial_number: "confident",
            invoice_number: "confident",
            order_id: "confident",
            purchase_date: "confident",
            seller: "confident",
            price: "confident",
            warranty_duration: "confident",
          },
          calculatedWarrantyMonths: 12,
          calculatedWarrantyEnd: "2027-10-24",
          duplicates: [
            {
              productId: "existing-1",
              productName: "Previous Demo Headphones",
              matchedField: "order_id",
              matchedValue: "TEST-404-1234567-8901234",
              message: 'An existing product "Previous Demo Headphones" has the same Order ID (TEST-404-1234567-8901234).',
            },
          ],
          warnings: ["Date normalized to ISO format."],
        });
      }
      if (url === "/api/products" && method === "GET") return response({ products: [] });
      if (url === "/api/price-watches" && method === "GET") return response({ watches: [] });
      if (url === "/api/reminders" && method === "GET") return response({ reminders: [] });
      if (url === "/api/claims" && method === "GET") return response({ claims: [] });
      if (url.match(/\/api\/products\/[^/]+\/documents$/) && method === "POST") return response({ document: { id: "doc-ocr-1", product_id: createdProductId, document_kind: "invoice", fileName: "demo-invoice.pdf" } }, 201);
      if (url === "/api/products" && method === "POST") return response({ product: { id: createdProductId, ...body } }, 201);
      return response({});
    });

    const user = userEvent.setup();
    render(<ProductCenter view="add-product" />);

    // Upload the demo invoice
    const fileInput = await screen.findByLabelText(/upload invoice file/i);
    const invoiceFile = new File(["demo invoice content"], "demo-invoice.pdf", { type: "application/pdf" });
    await user.upload(fileInput, invoiceFile);

    // Trigger extraction
    await user.click(screen.getByRole("button", { name: /extract details from invoice/i }));

    // Verify Review Modal opens with Product Details Extracted title
    expect(await screen.findByRole("heading", { name: /product details extracted/i })).toBeInTheDocument();
    expect(screen.getByText(/Google Cloud Vision/i)).toBeInTheDocument();

    // Verify duplicate warning banner is shown
    expect(screen.getByText(/Possible duplicate product or document detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Previous Demo Headphones/i)).toBeInTheDocument();

    // Verify confidence tags
    const confidentTags = screen.getAllByText(/✓ Confident/i);
    expect(confidentTags.length).toBeGreaterThanOrEqual(5);

    // Verify extracted values are in the editable inputs
    const modal = screen.getByRole("dialog");
    const nameInput = within(modal).getByDisplayValue("Demo Wireless Headphones") as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
    const modelInput = within(modal).getByDisplayValue("TEST-Q20") as HTMLInputElement;
    expect(modelInput).toBeInTheDocument();

    // User edits the model in the review dialog
    await user.clear(modelInput);
    await user.type(modelInput, "TEST-Q20-CONFIRMED");

    // User confirms and saves
    const confirmButton = within(modal).getByRole("button", { name: /confirm & save/i });
    await user.click(confirmButton);

    // Verify Product is saved with the user-confirmed data
    expect(fetchMock).toHaveBeenCalledWith("/api/products", expect.objectContaining({ method: "POST" }));
    const saveCall = fetchMock.mock.calls.find(([u, i]) => u === "/api/products" && i?.method === "POST");
    expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual(expect.objectContaining({
      name: "Demo Wireless Headphones",
      brand: "DemoSound",
      model: "TEST-Q20-CONFIRMED",
      imageUrl: "https://images.example/headphones.jpg",
      sourceUrl: "https://catalog.example.com/first",
      orderId: "TEST-404-1234567-8901234",
      invoiceNumber: "TEST-INV-2026-10427",
      ownerName: "Kapish Gupta",
      purchaseDate: "2026-10-24",
      pricePaid: 2499,
      warrantyDurationMonths: 12,
    }));
  });

  it("extracts catalog specs from a product link and explains when the listing image is unavailable", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body && typeof init.body === "string" ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (url === "/api/products/extract-invoice" && method === "POST") {
        return response({
          success: true,
          ocrEngine: "link-resolver",
          imageUrl: null,
          sourceUrl: "https://www.amazon.in/dp/B0D421F3XX",
          asin: "B0D421F3XX",
          extracted: {
            brand: "Soundcore",
            product_name: "Soundcore by Anker Life Q20i",
            model: "Life Q20i",
            category: "Audio",
            price: 4499,
            currency: "INR",
            source_marketplace: "Amazon.in",
          },
          fieldStatus: {
            brand: "confident",
            product_name: "confident",
            model: "confident",
            category: "confident",
            price: "needs_review",
            source_marketplace: "confident",
            owner_name: "not_found",
            purchase_date: "not_found",
          },
          calculatedWarrantyMonths: 12,
        });
      }
      if (url === "/api/products" && method === "GET") return response({ products: [] });
      if (url === "/api/price-watches" && method === "GET") return response({ watches: [] });
      if (url === "/api/reminders" && method === "GET") return response({ reminders: [] });
      if (url === "/api/claims" && method === "GET") return response({ claims: [] });
      if (url === "/api/products" && method === "POST") return response({ product: { id: createdProductId, ...body } }, 201);
      return response({});
    });

    const user = userEvent.setup();
    render(<ProductCenter view="add-product" />);

    // Enter product URL only
    const urlInput = await screen.findByLabelText(/product web link/i);
    await user.type(urlInput, "https://www.amazon.in/dp/B0D421F3XX");

    // Click fetch button
    await user.click(screen.getByRole("button", { name: /fetch details from product link/i }));

    // Review modal opens with link-resolver details and does not claim a photo when the listing returned none.
    expect(await screen.findByRole("heading", { name: /product details extracted/i })).toBeInTheDocument();
    expect(screen.getByText(/Web Link Catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/Product image could not be retrieved/i)).toBeInTheDocument();

    const modal = screen.getByRole("dialog");
    const nameInput = within(modal).getByDisplayValue("Soundcore by Anker Life Q20i") as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();

    // Confirm and save
    await user.click(within(modal).getByRole("button", { name: /confirm & save/i }));

    expect(fetchMock).toHaveBeenCalledWith("/api/products", expect.objectContaining({ method: "POST" }));
    const postCall = fetchMock.mock.calls.find(([u, i]) => u === "/api/products" && i?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual(expect.objectContaining({
      name: "Soundcore by Anker Life Q20i",
      brand: "Soundcore",
      imageUrl: null,
      sourceUrl: "https://www.amazon.in/dp/B0D421F3XX",
      asin: "B0D421F3XX",
    }));
  });

  it("exclusively displays saved products in My Products library without inline creation forms", async () => {
    render(<ProductCenter view="products" />);

    // Renders the Digital Product Passport Library header
    expect(await screen.findByRole("heading", { name: /your products/i })).toBeInTheDocument();
    expect(screen.getByText(/your product library|product passports/i)).toBeInTheDocument();

    // Displays the saved product
    expect(await screen.findByText("Daily sunscreen")).toBeInTheDocument();

    // Renders search and category controls
    expect(screen.getByPlaceholderText(/search by product name, brand, or model/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All (1)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /sort products/i })).toBeInTheDocument();

    // Verifies inline creation form and extraction tools are completely removed
    expect(screen.queryByLabelText(/upload invoice file/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/product web link/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /add manually/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /extract details from invoice/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/account sync/i)).not.toBeInTheDocument();
  });

  it("opens dedicated Product Passport showing actual available details without fabricating missing data", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="products" />);

    // Click to open product passport
    const openPassportBtn = await screen.findByRole("button", { name: /view timeline for daily sunscreen/i });
    await user.click(openPassportBtn);

    // Dedicated Product Passport dialog opens
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Daily sunscreen" })).toBeInTheDocument();

    // Shows actual available data
    expect(within(dialog).getByText("Personal care")).toBeInTheDocument();

    // Missing data is displayed as Not recorded, never fabricated as verified
    const unrecordedFields = within(dialog).getAllByText(/not recorded/i);
    expect(unrecordedFields.length).toBeGreaterThan(0);

    // Contains Verified Documents Vault and Timeline
    expect(within(dialog).getByText(/verified documents vault/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: /daily sunscreen timeline/i })).toBeInTheDocument();
  });

  it("displays thoughtful empty state with CTA to Add Product when no products match search", async () => {
    const user = userEvent.setup();
    const onNavigateView = vi.fn();
    render(<ProductCenter view="products" onNavigateView={onNavigateView} />);

    const searchInput = await screen.findByPlaceholderText(/search by product name, brand, or model/i);
    await user.type(searchInput, "NonExistentGadget123");

    expect(await screen.findByRole("heading", { name: /no products found/i })).toBeInTheDocument();
    const addProductCtas = screen.getAllByRole("button", { name: /add product/i });
    expect(addProductCtas.length).toBeGreaterThanOrEqual(1);

    await user.click(addProductCtas[addProductCtas.length - 1]);
    expect(onNavigateView).toHaveBeenCalledWith("add-product");
  });
});

