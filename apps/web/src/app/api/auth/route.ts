import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";

import { isSupabaseConfigured } from "@/lib/supabase/configured";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      user: { id: "00000000-0000-4000-8000-000000000001", email: "demo@claimforge.app" },
      configured: false,
      prototype: true,
    });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return NextResponse.json({ user: null, configured: true }, { status: 200 });
    return NextResponse.json({ user: { id: user.id, email: user.email ?? null }, configured: true });
  } catch {
    return NextResponse.json({
      user: { id: "00000000-0000-4000-8000-000000000001", email: "demo@claimforge.app" },
      configured: false,
      prototype: true,
    }, { status: 200 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value = await readJsonBody(request, 2 * 1024);
    if (!isRecord(value)) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    body = value;
  } catch (error) {
    if (error instanceof JsonBodyError) {
      const message = error.status === 413 ? "The request is too large." : "Enter your email and password.";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (body.action === "sign_out") {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Clear the browser session even if Supabase is temporarily unavailable.
    }
    return NextResponse.json({ ok: true });
  }

  if ((body.action !== "sign_in" && body.action !== "sign_up") || !email || email.length > 254 || !password || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 8 characters." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const result = body.action === "sign_in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (result.error) {
      return NextResponse.json({ error: "We couldn’t authenticate that account. Check the details or try again." }, { status: 401 });
    }
    if (body.action === "sign_up" && !result.data.session) {
      return NextResponse.json({ ok: true, confirmationRequired: true });
    }
    return NextResponse.json({ ok: true, user: result.data.user ? { id: result.data.user.id, email: result.data.user.email ?? null } : null });
  } catch {
    return NextResponse.json({ error: "Authentication is temporarily unavailable. Check the Supabase setup." }, { status: 503 });
  }
}
