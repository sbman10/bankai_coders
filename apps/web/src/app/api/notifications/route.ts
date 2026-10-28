import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const fields = "id, reminder_id, price_watch_id, product_id, claim_id, kind, title, body, href, created_at, read_at";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view notifications." }, { status: 401, headers: noStore });

    const [inbox, unread] = await Promise.all([
      supabase.from("notifications").select(fields).eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    ]);
    if (inbox.error || unread.error) return NextResponse.json({ error: "Your notifications could not be loaded." }, { status: 503, headers: noStore });
    return NextResponse.json({ notifications: inbox.data ?? [], unreadCount: unread.count ?? 0 }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Notification storage is not configured yet." }, { status: 503, headers: noStore });
  }
}
