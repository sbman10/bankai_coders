import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { POST } from "./route";

const oldSecret = process.env.N8N_REMINDERS_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.N8N_REMINDERS_SECRET = "test-only-secret";
  process.env.SUPABASE_SECRET_KEY = "test-only-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  delete process.env.POSTMARK_SERVER_TOKEN;
  delete process.env.POSTMARK_FROM_EMAIL;
  delete process.env.FIRECRAWL_API_KEY;
});

afterAll(() => {
  if (oldSecret === undefined) delete process.env.N8N_REMINDERS_SECRET;
  else process.env.N8N_REMINDERS_SECRET = oldSecret;
});

describe("POST /api/integrations/n8n/reminders", () => {
  it("rejects an incorrect scheduler secret before touching the database", async () => {
    const response = await POST(new Request("https://app.example/api/integrations/n8n/reminders", {
      method: "POST",
      headers: { "x-productvault-scheduler-secret": "wrong" },
      body: JSON.stringify({ batchSize: 10 }),
    }));

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("does not expose recipients or message content in the aggregate response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { notifications_created: 2 }, error: null });
    createAdminClient.mockReturnValue({ rpc });
    const response = await POST(new Request("https://app.example/api/integrations/n8n/reminders", {
      method: "POST",
      headers: { "x-productvault-scheduler-secret": "test-only-secret", "content-type": "application/json" },
      body: JSON.stringify({ batchSize: 10 }),
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.reminders).toEqual({ notifications_created: 2 });
    expect(JSON.stringify(payload)).not.toContain("@gmail.com");
    expect(JSON.stringify(payload)).not.toContain("warranty details");
  });
});
