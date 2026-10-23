import { beforeEach, describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "./route";

const userId = "f9d28d2e-50c4-4c1c-a23c-60a5af4eb3f1";
const rpc = vi.fn();
const download = vi.fn();
const originalWebhookUrl = process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL;
const originalWebhookToken = process.env.N8N_WEBHOOK_AUTH_TOKEN;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/claims", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    product: "Wireless headphones",
    fault: "The left side stopped working.",
    failureDate: null,
    idempotencyKey: "a5417f3e-19d7-4be3-bb8c-123456789abc",
    documents: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { claim_id: "claim-1", product_id: "product-1", duplicate: false }, error: null });
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    rpc,
    storage: { from: vi.fn(() => ({ download })) },
  });
  download.mockResolvedValue({ data: null, error: { message: "not used" } });
});

afterEach(() => {
  if (originalWebhookUrl === undefined) delete process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL;
  else process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL = originalWebhookUrl;
  if (originalWebhookToken === undefined) delete process.env.N8N_WEBHOOK_AUTH_TOKEN;
  else process.env.N8N_WEBHOOK_AUTH_TOKEN = originalWebhookToken;
  vi.unstubAllGlobals();
});

describe("claim intake validation", () => {
  it("rejects impossible calendar dates before touching the database", async () => {
    const response = await POST(makeRequest(validBody({ failureDate: "2026-02-31" })));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects document paths outside the signed-in user's generated file key", async () => {
    const response = await POST(makeRequest(validBody({
      documents: [{
        kind: "invoice",
        storagePath: `${userId}/../other-user/invoice.pdf`,
        fileName: "invoice.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }],
    })));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a file whose bytes do not match its declared PDF type", async () => {
    const bytes = new TextEncoder().encode("not actually a PDF");
    download.mockResolvedValue({
      data: {
        size: bytes.byteLength,
        slice: () => ({ arrayBuffer: async () => bytes.buffer }),
      },
      error: null,
    });
    const response = await POST(makeRequest(validBody({
      documents: [{
        kind: "invoice",
        storagePath: `${userId}/123e4567-e89b-42d3-a456-426614174000-invoice.pdf`,
        fileName: "invoice.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
      }],
    })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "An uploaded document does not match its declared file type. Please replace it and try again." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("caps JSON request bodies before database writes", async () => {
    const response = await POST(makeRequest(validBody({ fault: "x".repeat(20_000) })));

    expect(response.status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not dispatch a second automation event for an idempotent claim retry", async () => {
    process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL = "https://example.n8n.cloud/webhook/test";
    process.env.N8N_WEBHOOK_AUTH_TOKEN = "test-only-secret";
    rpc.mockResolvedValue({ data: { claim_id: "claim-1", product_id: "product-1", duplicate: true }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest(validBody()));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.automation).toBe("duplicate");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps automation not configured when only the server token is present", async () => {
    delete process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL;
    process.env.N8N_WEBHOOK_AUTH_TOKEN = "test-only-secret";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest(validBody()));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.automation).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call a webhook when only the URL is present", async () => {
    process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL = "https://example.n8n.cloud/webhook/test";
    delete process.env.N8N_WEBHOOK_AUTH_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest(validBody()));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.automation).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
