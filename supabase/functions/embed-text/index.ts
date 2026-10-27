import { createEmbedTextHandler } from "../_shared/embed-text-handler.ts";
import { createSupabaseGteSmallEmbeddingService } from "../_shared/embeddings.ts";

const embeddings = createSupabaseGteSmallEmbeddingService();

async function verifyUser(request: Request): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const key = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY");
  if (!projectUrl || !key) return false;
  const response = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { authorization, apikey: key },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return false;
  const user = await response.json();
  return typeof user?.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id);
}

Deno.serve(createEmbedTextHandler(embeddings, verifyUser));
