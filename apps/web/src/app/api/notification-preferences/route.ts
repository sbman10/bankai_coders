import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view notification settings." }, { status: 401, headers: noStore });
    const { data, error } = await supabase.from("notification_preferences").select("reminder_email_enabled").eq("user_id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Your notification settings could not be loaded." }, { status: 503, headers: noStore });
    return NextResponse.json({ reminderEmailEnabled: Boolean(data?.reminder_email_enabled) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Notification settings are not configured yet." }, { status: 503, headers: noStore });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to update notification settings." }, { status: 401, headers: noStore });
    let body: unknown;
    try {
      body = await readJsonBody(request, 2 * 1024);
    } catch (error) {
      const status = error instanceof JsonBodyError ? error.status : 400;
      return NextResponse.json({ error: "Send valid notification settings." }, { status, headers: noStore });
    }
    if (!isRecord(body) || typeof body.reminderEmailEnabled !== "boolean") {
      return NextResponse.json({ error: "Choose whether to enable reminder emails." }, { status: 400, headers: noStore });
    }
    const { data, error } = await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      reminder_email_enabled: body.reminderEmailEnabled,
    }, { onConflict: "user_id" }).select("reminder_email_enabled").single();
    if (error || !data) return NextResponse.json({ error: "Your notification settings could not be saved." }, { status: 503, headers: noStore });
    return NextResponse.json({ reminderEmailEnabled: data.reminder_email_enabled }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Notification settings are not configured yet." }, { status: 503, headers: noStore });
  }
}
