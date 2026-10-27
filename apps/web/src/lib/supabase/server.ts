import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { applySessionCookieLifetime, REMEMBER_DEVICE_COOKIE } from "./session-cookie-policy";

export async function createClient(options: { rememberDevice?: boolean } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Add the public project URL and publishable key.");
  }

  const cookieStore = await cookies();
  const rememberDevice = options.rememberDevice ?? cookieStore.get(REMEMBER_DEVICE_COOKIE)?.value === "1";

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          applySessionCookieLifetime(cookiesToSet, rememberDevice).forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot write cookies. Route handlers can, and are the only
          // place this project refreshes the session.
        }
      },
    },
  });
}
