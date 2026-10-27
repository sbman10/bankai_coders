import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { REMEMBER_DEVICE_COOKIE, SESSION_COOKIE_MAX_AGE_SECONDS } from "@/lib/supabase/session-cookie-policy";

const prototypeUser = { id: "00000000-0000-4000-8000-000000000001", email: "demo@productvault.app" };

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", ...Object.fromEntries(new Headers(headers)) },
  });
}

function appCallbackUrl(): string | null {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password) return null;
    return new URL("/auth/callback", url.origin).toString();
  } catch {
    return null;
  }
}

function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setRememberDeviceCookie(response: NextResponse, keepSignedIn: boolean) {
  response.cookies.set(REMEMBER_DEVICE_COOKIE, keepSignedIn ? "1" : "", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    ...(keepSignedIn ? { maxAge: SESSION_COOKIE_MAX_AGE_SECONDS } : { maxAge: 0 }),
  });
  return response;
}

export async function GET() {
  if (!isSupabaseConfigured()) return json({ user: prototypeUser, configured: false, prototype: true });

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") return json({ error: "Authentication is temporarily unavailable." }, 503);
    return json({ user: user ? { id: user.id, email: user.email ?? null } : null, configured: true });
  } catch {
    return json({ error: "Authentication is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value = await readJsonBody(request, 2 * 1024);
    if (!isRecord(value)) return json({ error: "Invalid authentication request." }, 400);
    body = value;
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return json({ error: error.status === 413 ? "The request is too large." : "Invalid authentication request." }, error.status);
    }
    return json({ error: "Invalid authentication request." }, 400);
  }

  if (body.action === "sign_out") {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) return json({ error: "Could not sign out. Please try again." }, 503);
      return setRememberDeviceCookie(json({ ok: true }), false);
    } catch {
      return json({ error: "Authentication is temporarily unavailable." }, 503);
    }
  }

  if (body.action === "google_sign_in") {
    const keepSignedIn = body.keepSignedIn === true;
    const redirectTo = appCallbackUrl();
    if (!redirectTo) return json({ error: "Google sign-in is not configured yet." }, 503);
    try {
      const supabase = await createClient({ rememberDevice: keepSignedIn });
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (error || !data.url) return json({ error: "Google sign-in is temporarily unavailable." }, 503);
      return setRememberDeviceCookie(json({ url: data.url }), keepSignedIn);
    } catch {
      return json({ error: "Google sign-in is temporarily unavailable." }, 503);
    }
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400);

  if (body.action === "request_email_link") {
    const redirectTo = appCallbackUrl();
    if (!redirectTo) return json({ error: "Email sign-in is not configured yet." }, 503);
    const keepSignedIn = body.keepSignedIn === true;
    try {
      const supabase = await createClient({ rememberDevice: keepSignedIn });
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
      });
      if (error?.status === 429) {
        return json({ error: "Too many sign-in link requests. Please wait before trying again." }, 429, { "Retry-After": "60" });
      }
      if (error) return json({ error: "We couldn’t send a sign-in link right now. Please try again shortly." }, 503);
      return setRememberDeviceCookie(json({ ok: true, message: "If this email can receive a sign-in link, check your inbox." }), keepSignedIn);
    } catch {
      return json({ error: "We couldn’t send a sign-in link right now. Please try again shortly." }, 503);
    }
  }

  return json({ error: "Unsupported authentication action." }, 400);
}
