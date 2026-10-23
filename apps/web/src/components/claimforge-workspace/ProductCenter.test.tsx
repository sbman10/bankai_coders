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
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (url === "/api/products" && method === "GET") return response({ products: [{ id: productId, name: "Daily sunscreen", category: "Personal care", purchase_date: null, warranty_end: null }] });
    if (url === "/api/price-watches" && method === "GET") return response({ watches: [] });
    if (url === "/api/reminders" && method === "GET") return response({ reminders: [] });
    if (url === "/api/claims" && method === "GET") return response({ claims: [] });
    if (url === `/api/products/${productId}/documents` && method === "GET") return response({ documents: [] });
    if (url === `/api/products/${productId}/documents` && method === "POST") return response({ document: { id: "doc-1", product_id: productId, document_kind: body.documentKind, storage_path: body.storagePath, original_filename: body.fileName, mime_type: body.mimeType, size_bytes: body.sizeBytes, created_at: "2026-10-22T08:00:00Z" } }, 201);
    if (url === `/api/products/${productId}/documents/doc-1` && method === "GET") return response({ url: "https://storage.example/private-download" });
    if (url === `/api/products/${productId}/documents/doc-1` && method === "DELETE") return response({ removed: true });
    if (url === "/api/products" && method === "POST") return response({ product: { id: createdProductId, name: body.name, brand: body.brand, model: body.model, category: body.category, seller: body.seller, serial_number: body.serialNumber, purchase_date: body.purchaseDate, warranty_end: body.warrantyEnd } }, 201);
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
    render(<ProductCenter view="products" />);

    await user.type(await screen.findByLabelText(/product name/i), "Desk lamp");
    await user.type(screen.getByLabelText("Brand"), "Auralis");
    await user.type(screen.getByLabelText("Model"), "Pulse 2");
    await user.type(screen.getByLabelText(/category/i), "Home");
    await user.type(screen.getByLabelText("Seller"), "Example Store");
    await user.type(screen.getByLabelText("Serial number"), "SN-123456");
    await user.click(screen.getByRole("button", { name: /add product/i }));

    expect(await screen.findByText("Desk lamp")).toBeInTheDocument();
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

  it("updates a manual price and marks the target as reached", async () => {
    const user = userEvent.setup();
    render(<ProductCenter view="prices" />);

    await user.selectOptions(await screen.findByLabelText("Product"), productId);
    await user.type(screen.getByLabelText(/current price/i), "1200");
    await user.type(screen.getByLabelText(/alert below/i), "1000");
    await user.click(screen.getByRole("button", { name: /add manual watch/i }));
    await user.clear(await screen.findByLabelText(/new price for daily sunscreen/i));
    await user.type(screen.getByLabelText(/new price for daily sunscreen/i), "950");
    await user.click(screen.getByRole("button", { name: /save price for daily sunscreen/i }));

    expect(await screen.findByText(/target reached/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /prepare private link/i }));
    expect(await screen.findByRole("link", { name: /open file/i })).toHaveAttribute("href", "https://storage.example/private-download");
  });
});
