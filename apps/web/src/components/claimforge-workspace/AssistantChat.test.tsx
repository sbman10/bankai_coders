import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantChat } from "./AssistantChat";

const productId = "7d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const documentId = "8d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const chunkId = "9d87b716-e870-4a40-a6b8-fcd6f6b0d6ee";
const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("document assistant", () => {
  it("lets a user ask from selected indexed documents and inspect the trusted citation", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/products") {
        return Response.json({ products: [{ id: productId, name: "Synthetic headphones" }] });
      }
      if (url === `/api/products/${productId}/documents`) {
        return Response.json({ documents: [
          { id: documentId, product_id: productId, document_kind: "warranty", original_filename: "synthetic-policy.pdf", ingestion_status: "indexed", ingestion_warning_code: null },
          { id: "aa87b716-e870-4a40-a6b8-fcd6f6b0d6ee", product_id: productId, document_kind: "manual", original_filename: "unreadable-scan.png", ingestion_status: "needs_review", ingestion_warning_code: "ocr_required" },
        ] });
      }
      if (url === "/api/assistant/answer" && init?.method === "POST") {
        return Response.json({
          status: "conditional",
          answer: "The supplied terms appear to cover manufacturing defects within the stated period, subject to the listed exclusions.",
          documentFacts: ["The terms state a one-year period for manufacturing defects."],
          userFactsUsed: [],
          inferences: [],
          citations: [{ chunkId, documentId, documentName: "synthetic-policy.pdf", page: 2, section: "Coverage", excerpt: "Synthetic policy excerpt for the test." }],
          missingInformation: [],
          followUpQuestions: [],
        });
      }
      if (url.endsWith("/index") && init?.method === "POST") return Response.json({ status: "indexed" });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AssistantChat />);

    await screen.findByRole("option", { name: "Synthetic headphones" });
    await screen.findByLabelText("synthetic-policy.pdf, warranty, ready for questions");
    expect(screen.getByText("unreadable-scan.png")).toBeInTheDocument();
    expect(screen.getByText(/needs review/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText("synthetic-policy.pdf, warranty, ready for questions"));
    await user.type(screen.getByRole("textbox", { name: /ask about your documents/i }), "Does this cover a speaker failure?");
    await user.click(screen.getByRole("button", { name: "Ask ProductVault" }));

    expect(await screen.findByText(/appear to cover manufacturing defects/i)).toBeInTheDocument();
    const citation = screen.getByText("synthetic-policy.pdf · Page 2 · Coverage").closest("details");
    expect(citation).not.toBeNull();
    expect(within(citation as HTMLElement).getByText("Synthetic policy excerpt for the test.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/assistant/answer", expect.objectContaining({ method: "POST" }));
  });
});
