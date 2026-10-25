import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmazonImport } from "./AmazonImport";

const mockOnCancel = vi.fn();
const mockOnSaved = vi.fn();

beforeEach(() => {
  mockOnCancel.mockClear();
  mockOnSaved.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AmazonImport component", () => {
  it("renders the Amazon product URL input and updates live ASIN preview", async () => {
    const user = userEvent.setup();
    render(<AmazonImport onCancel={mockOnCancel} onSaved={mockOnSaved} />);

    expect(screen.getByRole("heading", { name: /import from amazon/i })).toBeInTheDocument();
    const input = screen.getByLabelText(/amazon product url/i);
    expect(input).toBeInTheDocument();

    await user.type(input, "https://www.amazon.in/dp/B0CX21C8S2");

    expect(screen.getByText("B0CX21C8S2")).toBeInTheDocument();
  });

  it("handles the not-configured n8n state gracefully and shows manual fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: "not_configured",
          asin: "B0CX21C8S2",
          marketplace: "amazon.in",
          message: "n8n workflow is not yet configured",
        }),
      })),
    );

    const user = userEvent.setup();
    render(<AmazonImport onCancel={mockOnCancel} onSaved={mockOnSaved} />);

    const input = screen.getByLabelText(/amazon product url/i);
    await user.type(input, "https://www.amazon.in/dp/B0CX21C8S2");

    const submitBtn = screen.getByRole("button", { name: /import product/i });
    await user.click(submitBtn);

    expect(await screen.findByRole("heading", { name: /amazon import is not connected yet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add manually \(asin pre-filled\)/i })).toBeInTheDocument();
  });

  it("renders duplicate product warning when ASIN is already registered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/amazon/import") {
          return {
            ok: true,
            json: async () => ({
              status: "duplicate",
              asin: "B0CX21C8S2",
              existingProductId: "prod-existing-123",
            }),
          };
        }
        return { ok: false, json: async () => ({ error: "Not found" }) };
      }),
    );

    const user = userEvent.setup();
    render(<AmazonImport onCancel={mockOnCancel} onSaved={mockOnSaved} />);

    const input = screen.getByLabelText(/amazon product url/i);
    await user.type(input, "https://www.amazon.in/dp/B0CX21C8S2");

    const submitBtn = screen.getByRole("button", { name: /import product/i });
    await user.click(submitBtn);

    expect(await screen.findByRole("heading", { name: /this product is already in your library/i })).toBeInTheDocument();
  });

  it("calls onCancel when back or cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<AmazonImport onCancel={mockOnCancel} onSaved={mockOnSaved} />);

    const cancelBtn = screen.getByRole("button", { name: /add manually instead/i });
    await user.click(cancelBtn);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});
