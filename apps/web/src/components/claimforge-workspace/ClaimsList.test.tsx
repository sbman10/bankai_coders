import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaimsList, type SavedClaim } from "./ClaimsList";

const claim: SavedClaim = {
  id: "b4e1c9f0-342f-4f99-9c7f-e7ff2f5e3441",
  product_id: "a5417f3e-19d7-4be3-bb8c-123456789abc",
  fault_description: "The left earcup stopped working.",
  failure_date: "2026-10-20",
  status: "ready_for_review",
  assessment: "likely within stated term",
  claim_draft: "Hello, I am requesting warranty support.",
  created_at: "2026-10-20T08:00:00.000Z",
  products: { name: "Wireless headphones" },
  claim_evidence: [{
    id: "evidence-1",
    evidence_kind: "warranty_clause",
    content: "Warranty coverage lasts 12 months from purchase.",
    source_page: 2,
    confidence: 0.98,
    document_id: "123e4567-e89b-42d3-a456-426614174000",
    created_at: "2026-10-20T08:10:00.000Z",
  }],
  claim_approvals: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("saved claim review", () => {
  it("shows evidence citations and the persisted assessment and draft", async () => {
    render(<ClaimsList claims={[claim]} loading={false} error="" onBack={vi.fn()} />);
    await userEvent.setup().click(screen.getByText(/open evidence and draft/i));

    expect(screen.getByText(/preliminary assessment.*likely within stated term/i)).toBeInTheDocument();
    expect(screen.getByText(/warranty coverage lasts 12 months/i)).toBeInTheDocument();
    expect(screen.getByText(/source document 123e4567 · page 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/editable claim draft/i)).toHaveValue("Hello, I am requesting warranty support.");
  });

  it("records approval for the exact edited draft and makes clear nothing was sent", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ approval: { id: "approval-1", action_status: "draft_only", approved_content: "Updated approved draft" }, externalAction: "not_sent" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ClaimsList claims={[claim]} loading={false} error="" onBack={vi.fn()} />);
    await user.click(screen.getByText(/open evidence and draft/i));
    await user.clear(screen.getByLabelText(/editable claim draft/i));
    await user.type(screen.getByLabelText(/editable claim draft/i), "Updated approved draft");
    await user.click(screen.getByRole("button", { name: /approve this exact draft/i }));

    expect(fetchMock).toHaveBeenCalledWith(`/api/claims/${claim.id}/approval`, expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ approvedContent: "Updated approved draft" });
    expect(await screen.findByText(/approved draft saved\. nothing was sent/i)).toBeInTheDocument();
  });

  it("does not show an approval action before a processed draft is ready", async () => {
    const receivedClaim = { ...claim, status: "received", assessment: null, claim_draft: null };
    render(<ClaimsList claims={[receivedClaim]} loading={false} error="" onBack={vi.fn()} />);
    await userEvent.setup().click(screen.getByText(/open evidence and draft/i));

    expect(screen.queryByRole("button", { name: /approve this exact draft/i })).not.toBeInTheDocument();
    expect(screen.getByText(/analysis is not complete/i)).toBeInTheDocument();
  });
});
