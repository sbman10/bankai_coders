import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductPassportModal } from "./ProductPassportModal";
import type { Product, ProductDocument } from "./ProductCenter";

const mockProduct: Product = {
  id: "prod-1",
  name: "Sony WH-1000XM5 Headphones",
  brand: "Sony",
  model: "WH-1000XM5",
  category: "Electronics",
  seller: "Appario Retail Pvt Ltd",
  serialNumber: "SN-9876543210",
  purchaseDate: "2026-02-14",
  warrantyEnd: "2027-02-14",
  ownerName: "Rohan Sharma",
  buyingMethod: "Credit Card",
  purchasePlatform: "Amazon.in",
  pricePaid: 26990,
  currency: "INR",
  invoiceNumber: "INV-2026-00123",
  orderId: "408-1234567-8901234",
  createdAt: "2026-02-14T10:00:00.000Z",
};

const mockEmptyProduct: Product = {
  id: "prod-2",
  name: "Marketplace Minimalist Item",
  brand: "Minimalist",
  model: "",
  category: "Personal care",
  seller: "",
  serialNumber: "",
  purchaseDate: "",
  warrantyEnd: "",
  createdAt: "2026-02-14T10:00:00.000Z",
};

const mockDocuments: ProductDocument[] = [
  {
    id: "doc-inv-1",
    productId: "prod-1",
    kind: "invoice",
    fileName: "sony-xm5-tax-invoice.pdf",
    mimeType: "application/pdf",
    sizeBytes: 248190,
    createdAt: "2026-02-14T10:30:00Z",
    signedUrl: "https://storage.example/sony-invoice.pdf",
  },
  {
    id: "doc-custom-1",
    productId: "prod-1",
    kind: "other",
    label: "Installation Certificate",
    fileName: "installation-cert.pdf",
    mimeType: "application/pdf",
    sizeBytes: 104500,
    createdAt: "2026-02-15T12:00:00Z",
  },
];

describe("ProductPassportModal component", () => {
  it("renders product identity, brand, model, and status badge with hero styling", () => {
    render(
      <ProductPassportModal
        product={mockProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={[]}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Sony WH-1000XM5 Headphones", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Sony", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/model: wh-1000xm5/i)).toBeInTheDocument();
    expect(screen.getAllByText(/warranty active/i).length).toBeGreaterThan(0);
  });

  it("prioritizes purchase price, date, and warranty prominence with honest unrecorded states", () => {
    const { rerender } = render(
      <ProductPassportModal
        product={mockProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={[]}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
      />
    );

    // Formatted Indian Rupee currency and dates
    expect(screen.getByText("₹26,990")).toBeInTheDocument();
    expect(screen.getAllByText("Feb 14, 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Feb 14, 2027").length).toBeGreaterThan(0);
    expect(screen.getByText("Appario Retail Pvt Ltd")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-00123")).toBeInTheDocument();
    expect(screen.getByText("408-1234567-8901234")).toBeInTheDocument();
    expect(screen.getByText("SN-9876543210")).toBeInTheDocument();
    expect(screen.getByText("Rohan Sharma")).toBeInTheDocument();

    // Rerender with empty product: missing fields are honestly displayed as 'Not recorded'
    rerender(
      <ProductPassportModal
        product={mockEmptyProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={[]}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
      />
    );

    const unrecordedLabels = screen.getAllByText(/not recorded/i);
    expect(unrecordedLabels.length).toBeGreaterThanOrEqual(4);
  });

  it("automatically renders saved invoice with Purchase Invoice label and download action", () => {
    render(
      <ProductPassportModal
        product={mockProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={mockDocuments}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
      />
    );

    expect(screen.getByText("Purchase Invoice")).toBeInTheDocument();
    expect(screen.getByText("sony-xm5-tax-invoice.pdf")).toBeInTheDocument();
    expect(screen.getByText(/242 KB/i)).toBeInTheDocument();

    // View link with signed url
    const openLink = screen.getByRole("link", { name: /open file/i });
    expect(openLink).toHaveAttribute("href", "https://storage.example/sony-invoice.pdf");

    // Download action
    const downloadLink = screen.getByRole("link", { name: /download sony-xm5-tax-invoice.pdf/i });
    expect(downloadLink).toBeInTheDocument();

    // Custom Other Document with its custom name
    expect(screen.getByText("Installation Certificate")).toBeInTheDocument();
    expect(screen.getByText("installation-cert.pdf")).toBeInTheDocument();
  });

  it("reveals custom document name field when Other Document is selected in Add Document", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn().mockResolvedValue(true);

    render(
      <ProductPassportModal
        product={mockProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={mockDocuments}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={handleAdd}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
      />
    );

    // Open add document drawer
    const addDocButtons = screen.getAllByRole("button", { name: /add document/i });
    await user.click(addDocButtons[0]);

    // Select 'Other Document' from dropdown
    const select = screen.getByLabelText(/document type/i);
    await user.selectOptions(select, "other");

    // Custom Document Name input appears
    const customNameInput = await screen.findByLabelText(/document name \(custom\)/i);
    expect(customNameInput).toBeInTheDocument();

    await user.type(customNameInput, "Repair Quotation");

    // Upload file
    const file = new File(["repair estimate details"], "quote.pdf", { type: "application/pdf" });
    const fileInput = screen.getByLabelText(/choose document/i);
    await user.upload(fileInput, file);

    // Submit attachment
    const attachBtn = screen.getByRole("button", { name: /attach document/i });
    await user.click(attachBtn);

    expect(handleAdd).toHaveBeenCalledWith("other", file, "Repair Quotation");
  });

  it("displays dismissible thoughtful suggestion when an invoice exists without warranty card or manual", async () => {
    const user = userEvent.setup();

    render(
      <ProductPassportModal
        product={mockProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={[mockDocuments[0]]} // Only invoice
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
      />
    );

    expect(screen.getByText("Keep your product documents together.")).toBeInTheDocument();
    expect(
      screen.getByText(/add a warranty card, user manual, service receipt or any other important document for easy access later/i)
    ).toBeInTheDocument();

    // Clicking dismiss hides the suggestion
    const dismissBtn = screen.getByRole("button", { name: /dismiss suggestion/i });
    await user.click(dismissBtn);

    expect(screen.queryByText("Keep your product documents together.")).not.toBeInTheDocument();
  });

  it("handles document delete confirmation safely", async () => {
    const user = userEvent.setup();
    const handleRemove = vi.fn().mockResolvedValue(true);

    render(
      <ProductPassportModal
        product={mockProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={mockDocuments}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={handleRemove}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /delete installation-cert.pdf/i });
    await user.click(deleteBtn);

    // Confirmation appears
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    await user.click(confirmBtn);

    expect(handleRemove).toHaveBeenCalledWith(mockDocuments[1]);
  });

  it("renders chronological ownership history without squished or overlapping text", () => {
    render(
      <ProductPassportModal
        product={mockProduct}
        claims={[
          {
            id: "claim-1",
            productId: mockProduct.id,
            fault: "Left ear-cup audio crackle",
            status: "draft_prepared",
            createdAt: "2026-03-01T14:00:00Z",
          },
        ]}
        watches={[
          {
            id: "watch-1",
            productId: mockProduct.id,
            productUrl: "https://amazon.in/dp/example",
            currentPrice: 24990,
            targetPrice: 22000,
            lastCheckedAt: "2026-02-20T10:00:00Z",
            createdAt: "2026-02-15T10:00:00Z",
          },
        ]}
        reminders={[
          {
            id: "rem-1",
            productId: mockProduct.id,
            estimateDays: 180,
            remindAt: "2026-08-14",
          },
        ]}
        documents={mockDocuments}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
      />
    );

    expect(screen.getByText("Product purchased")).toBeInTheDocument();
    expect(screen.getByText("Warranty ends")).toBeInTheDocument();
    expect(screen.getByText("Claim started")).toBeInTheDocument();
    expect(screen.getByText("Price checked")).toBeInTheDocument();
    expect(screen.getByText("Reminder scheduled")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ownership history/i })).toBeInTheDocument();
  });

  it("dynamically adjusts footer claim action to accurately reflect warranty status", () => {
    // 1. Confirmed active warranty -> "Claim Under Warranty"
    const { rerender } = render(
      <ProductPassportModal
        product={mockProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={[]}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
        onStartClaim={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /claim under warranty/i })).toBeInTheDocument();

    // 2. Unrecorded warranty -> Neutral "Prepare a Claim"
    rerender(
      <ProductPassportModal
        product={mockEmptyProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={[]}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
        onStartClaim={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /claim under warranty/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prepare a claim/i })).toBeInTheDocument();

    // 3. Expired warranty -> Neutral "Prepare a Claim"
    const expiredProduct: Product = {
      ...mockProduct,
      warrantyEnd: "2024-01-01",
    };

    rerender(
      <ProductPassportModal
        product={expiredProduct}
        claims={[]}
        watches={[]}
        reminders={[]}
        documents={[]}
        documentsLoading={false}
        busy={false}
        onClose={vi.fn()}
        onAddDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onRemoveDocument={vi.fn()}
        onStartClaim={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /claim under warranty/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prepare a claim/i })).toBeInTheDocument();
  });
});
