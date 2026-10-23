import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalClaimWebhook = process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL;
const originalWebhookToken = process.env.N8N_WEBHOOK_AUTH_TOKEN;

afterEach(() => {
  if (originalClaimWebhook === undefined) {
    delete process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL;
  } else {
    process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL = originalClaimWebhook;
  }
  if (originalWebhookToken === undefined) {
    delete process.env.N8N_WEBHOOK_AUTH_TOKEN;
  } else {
    process.env.N8N_WEBHOOK_AUTH_TOKEN = originalWebhookToken;
  }
});

describe("n8n integration status", () => {
  it("reports that claim processing is not configured without exposing secrets", async () => {
    delete process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL;
    delete process.env.N8N_WEBHOOK_AUTH_TOKEN;

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      configured: false,
      message: "Claim automation is not configured yet.",
    });
  });

  it("does not report configured until both HTTPS URL and Header Auth are present", async () => {
    process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL = "https://example.n8n.cloud/webhook/test";
    delete process.env.N8N_WEBHOOK_AUTH_TOKEN;

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      configured: false,
      message: "Claim automation is not configured yet.",
    });
  });

  it("reports configured for an HTTPS endpoint with a token without returning the token", async () => {
    process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL = "https://example.n8n.cloud/webhook/test";
    process.env.N8N_WEBHOOK_AUTH_TOKEN = "test-only-secret";

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      configured: true,
      message: "An authenticated HTTPS n8n webhook is configured. Workflow behavior is not yet verified.",
    });
    expect(JSON.stringify(body)).not.toContain("test-only-secret");
  });
});
