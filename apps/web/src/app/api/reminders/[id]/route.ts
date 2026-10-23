import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before cancelling a reminder." }, { status: 401 });
    const { id } = await context.params;
    if (!uuid.test(id)) return NextResponse.json({ error: "This reminder could not be found." }, { status: 404 });

    const { data, error } = await supabase.from("reminders").update({ status: "cancelled" })
      .eq("id", id).eq("user_id", user.id).eq("status", "scheduled").select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "The reminder could not be cancelled." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "This reminder could not be found." }, { status: 404 });
    return NextResponse.json({ cancelled: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Reminder storage is not configured yet." }, { status: 503 });
  }
}
