/**
 * Utility to verify if real Supabase environment variables are provided.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return Boolean(url && key && url.startsWith("http"));
}
