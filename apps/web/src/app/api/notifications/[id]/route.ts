import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store" };

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to update notifications." }, { status: 401, headers: noStore });
    const { id } = await context.params;
    if (!uuid.test(id)) return NextResponse.json({ error: "This notification could not be found." }, { status: 404, headers: noStore });
    const { data, error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).is("read_at", null).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "The notification could not be updated." }, { status: 503, headers: noStore });
    if (!data) return NextResponse.json({ error: "This notification could not be found." }, { status: 404, headers: noStore });
    return NextResponse.json({ read: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Notification storage is not configured yet." }, { status: 503, headers: noStore });
  }
}
