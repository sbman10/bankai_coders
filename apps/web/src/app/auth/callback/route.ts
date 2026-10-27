import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function appUrl(authError?: string): URL {
  const configuredBase = process.env.APP_BASE_URL?.trim();
  let base: URL;
  try {
    base = new URL(configuredBase || "http://localhost:3000");
  } catch {
    base = new URL("http://localhost:3000");
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    base = new URL("http://localhost:3000");
  }
  const target = new URL("/", base.origin);
  if (authError) target.searchParams.set("auth_error", "sign_in");
  return target;
}

function redirect(authError?: string) {
  return NextResponse.redirect(appUrl(authError), {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  if (!code || requestUrl.searchParams.has("error")) return redirect("sign_in");

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirect("sign_in");
    return redirect();
  } catch {
    return redirect("sign_in");
  }
}
