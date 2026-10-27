import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth })),
}));
vi.mock("@/lib/supabase/configured", () => ({ isSupabaseConfigured: () => true }));

import { GET, POST } from "./route";
import { createClient } from "@/lib/supabase/server";

function post(body: unknown) {
  return new Request("http://localhost:3000/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("email magic-link auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "person@example.com" } }, error: null });
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://auth.example.test/authorize" }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it("returns only the verified user and disables caching for session reads", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store/i);
    expect(await response.json()).toEqual({ user: { id: "user-1", email: "person@example.com" }, configured: true });
  });

  it("treats a missing session as signed out instead of an auth outage", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null, configured: true });
  });

  it("requests a magic link to the fixed app callback and returns a generic confirmation", async () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    const response = await POST(post({ action: "request_email_link", email: " Person@Example.com ", keepSignedIn: true }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, message: expect.any(String) });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: { shouldCreateUser: true, emailRedirectTo: "http://localhost:3000/auth/callback" },
    });
    expect(createClient).toHaveBeenCalledWith({ rememberDevice: true });
    expect(response.headers.get("set-cookie")).toContain("pv_remember_device=1");
  });

  it("rejects malformed magic-link requests before contacting Supabase", async () => {
    const response = await POST(post({ action: "request_email_link", email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("starts Google OAuth with the fixed app callback", async () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    const response = await POST(post({ action: "google_sign_in" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://auth.example.test/authorize" });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback" },
    });
  });

  it("sets a 30-day device preference for the selected email and Google sessions", async () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    const emailResponse = await POST(post({ action: "request_email_link", email: "person@example.com", keepSignedIn: true }));
    expect(createClient).toHaveBeenCalledWith({ rememberDevice: true });
    expect(emailResponse.headers.get("set-cookie")).toContain("pv_remember_device=1");

    vi.clearAllMocks();
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://auth.example.test/authorize" }, error: null });
    const googleResponse = await POST(post({ action: "google_sign_in", keepSignedIn: true }));
    expect(createClient).toHaveBeenCalledWith({ rememberDevice: true });
    expect(googleResponse.headers.get("set-cookie")).toContain("pv_remember_device=1");
  });

  it("signs out through Supabase and rejects unknown actions", async () => {
    expect((await POST(post({ action: "sign_out" }))).status).toBe(200);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });

    const response = await POST(post({ action: "admin" }));
    expect(response.status).toBe(400);
  });
});
