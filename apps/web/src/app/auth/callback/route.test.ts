import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth })) }));

import { GET } from "./route";

describe("authentication callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = "http://localhost:3000";
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges the authorization code and redirects to the fixed app home", async () => {
    const response = await GET(new Request("http://localhost:3000/auth/callback?code=one-time-code"));

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("does not accept a browser-supplied destination and shows a safe provider error", async () => {
    const response = await GET(new Request("http://localhost:3000/auth/callback?error=access_denied&next=https://evil.test"));

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/?auth_error=sign_in");
  });

  it("returns to the fixed app with an error when the code exchange fails", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("provider detail") });
    const response = await GET(new Request("http://localhost:3000/auth/callback?code=bad-code"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/?auth_error=sign_in");
  });

  it("does not use the incoming Host as a redirect target when the app URL is missing", async () => {
    delete process.env.APP_BASE_URL;
    const response = await GET(new Request("https://attacker.example/auth/callback?code=valid-code"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
});
