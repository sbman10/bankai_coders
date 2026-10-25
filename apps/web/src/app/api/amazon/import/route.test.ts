import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoist mocks ──────────────────────────────────────────────────────────────
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ── Stable fixtures ───────────────────────────────────────────────────────────
const userId = "a1b2c3d4-0000-4000-8000-000000000001";
const authUser = { id: userId };

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/amazon/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupAuth(user: { id: string } | null = authUser) {
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("N8N_AMAZON_IMPORT_WEBHOOK_URL", "");
  vi.stubEnv("N8N_WEBHOOK_AUTH_TOKEN", "");
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
});

// Must import after mocks are registered
import { POST } from "./route";

describe("POST /api/amazon/import", () => {
  it("extracts ASIN from a valid Amazon URL and returns not_configured when n8n is absent", async () => {
    setupAuth();

    const response = await POST(
      makeRequest({ url: "https://www.amazon.in/Sony-WH-1000XM5/dp/B0CJST1BFX/" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("not_configured");
    expect(body.asin).toBe("B0CJST1BFX");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches to n8n with Bearer auth and never exposes the token to the browser response", async () => {
    setupAuth();
    vi.stubEnv("N8N_AMAZON_IMPORT_WEBHOOK_URL", "https://n8n.example.com/webhook/amazon-import");
    vi.stubEnv("N8N_WEBHOOK_AUTH_TOKEN", "super-secret-token");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const response = await POST(
      makeRequest({ url: "https://www.amazon.in/Sony-WH-1000XM5/dp/B0CJST1BFX/" }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.status).toBe("queued");
    expect(body.asin).toBe("B0CJST1BFX");
    // Token must NOT appear anywhere in the response body
    expect(JSON.stringify(body)).not.toContain("super-secret-token");

    const [, fetchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((fetchInit.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer super-secret-token",
    );
  });

  it("returns 422 with a descriptive error when the URL has no recognisable ASIN", async () => {
    setupAuth();

    const response = await POST(
      makeRequest({ url: "https://www.amazon.in/s?k=headphones" }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/ASIN/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 422 for a completely non-Amazon URL", async () => {
    setupAuth();

    const response = await POST(
      makeRequest({ url: "https://www.flipkart.com/headphones/B0CJST1BFX" }),
    );

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when url field is missing", async () => {
    setupAuth();

    const response = await POST(makeRequest({ someOtherField: "value" }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not signed in", async () => {
    setupAuth(null);

    const response = await POST(
      makeRequest({ url: "https://www.amazon.in/dp/B0CJST1BFX" }),
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the n8n webhook is unreachable", async () => {
    setupAuth();
    vi.stubEnv("N8N_AMAZON_IMPORT_WEBHOOK_URL", "https://n8n.example.com/webhook/amazon-import");
    vi.stubEnv("N8N_WEBHOOK_AUTH_TOKEN", "token");
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await POST(
      makeRequest({ url: "https://www.amazon.in/dp/B0CJST1BFX" }),
    );
    expect(response.status).toBe(503);
  });
});
