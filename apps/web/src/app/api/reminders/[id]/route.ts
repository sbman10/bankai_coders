import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { prototypeStore } from "@/lib/store/prototype-store";

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function readBody(request: Request) {
  try {
    const body = await readJsonBody(request, 4 * 1024);
    return isRecord(body) ? body : null;
  } catch (error) {
    if (error instanceof JsonBodyError) return null;
    return null;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before updating a reminder." }, { status: 401 });
    const { id } = await context.params;
    if (!uuid.test(id)) return NextResponse.json({ error: "This reminder could not be found." }, { status: 404 });
    const body = await readBody(request);
    if (!body || !["edit", "snooze", "complete", "cancel"].includes(String(body.action))) {
      return NextResponse.json({ error: "Choose a valid reminder action." }, { status: 400 });
    }

    const action = String(body.action);
    let updates: Record<string, unknown>;
    if (action === "complete" || action === "cancel") {
      updates = { status: action === "complete" ? "completed" : "cancelled", ...(action === "complete" ? { completed_at: new Date().toISOString() } : {}) };
    } else {
      const remindAt = body.remindAt;
      if (!validDate(remindAt) || remindAt < todayInIndia()) {
        return NextResponse.json({ error: "Choose a valid future reminder date." }, { status: 400 });
      }
      updates = { remind_at: `${remindAt}T09:00:00+05:30`, status: "scheduled" };
      if (action === "edit") {
        if (body.title !== undefined) {
          if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120) return NextResponse.json({ error: "Reminder title must be 1 to 120 characters." }, { status: 400 });
          updates.title = body.title.trim();
        }
        if (body.reason !== undefined) {
          if (typeof body.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 500) return NextResponse.json({ error: "Reminder details must be 1 to 500 characters." }, { status: 400 });
          updates.reason = body.reason.trim();
        }
      }
    }

    let { data, error } = await supabase.from("reminders").update(updates)
      .eq("id", id).eq("user_id", user.id).in("status", ["scheduled", "sent"])
      .select("id, reminder_type, title, remind_at, reason, status").maybeSingle();
    if (error) {
      const safeUpdates = { ...updates };
      delete safeUpdates.title;
      delete safeUpdates.completed_at;
      const fallback = await supabase.from("reminders").update(safeUpdates)
        .eq("id", id).eq("user_id", user.id).in("status", ["scheduled", "sent"])
        .select("id, remind_at, reason, status").maybeSingle();
      if (!fallback.error && fallback.data) {
        data = {
          reminder_type: "replenishment",
          title: fallback.data.reason ? String(fallback.data.reason).slice(0, 120) : "Reminder",
          ...fallback.data,
        };
        error = null;
      }
    }
    if (error) return NextResponse.json({ error: "The reminder could not be updated." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "This reminder could not be found." }, { status: 404 });
    return NextResponse.json({ reminder: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Reminder storage is not configured yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before cancelling a reminder." }, { status: 401 });
    const { id } = await context.params;
    if (!uuid.test(id)) return NextResponse.json({ error: "This reminder could not be found." }, { status: 404 });

    const { data, error } = await supabase.from("reminders").update({ status: "cancelled" })
      .eq("id", id).eq("user_id", user.id).in("status", ["scheduled", "sent"]).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "The reminder could not be cancelled." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "This reminder could not be found." }, { status: 404 });
    return NextResponse.json({ cancelled: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const { id } = await context.params;
      const removed = prototypeStore.deleteReminder(id);
      if (!removed) return NextResponse.json({ error: "This reminder could not be found." }, { status: 404 });
      return NextResponse.json({ cancelled: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Reminder storage is not configured yet." }, { status: 503 });
  }
}
