import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !publishableKey) {
      // Return safe prototype client when Supabase credentials are not configured yet
      return {
        auth: {
          getUser: async () => ({
            data: { user: { id: "00000000-0000-4000-8000-000000000001", email: "demo@claimforge.app" } },
            error: null,
          }),
          signOut: async () => ({ error: null }),
        },
        storage: {
          from: () => ({
            upload: async () => ({ data: { path: "demo-storage-path" }, error: null }),
            remove: async () => ({ error: null }),
            list: async () => ({ data: [], error: null }),
          }),
        },
      } as unknown as ReturnType<typeof createBrowserClient>;
    }

    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
}
