import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const fields = "id, product_id, claim_id, remind_at, channel, reason, status, created_at, products(name, category)";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function readBody(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const value = await readJsonBody(request, 4 * 1024);
    return isRecord(value) ? value : NextResponse.json({ error: "Reminder details must be a JSON object." }, { status: 400 });
  } catch (error) {
    if (error instanceof JsonBodyError) {
      const message = error.status === 413 ? "Reminder details are too large." : "Reminder details must be valid JSON.";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: "Reminder details must be valid JSON." }, { status: 400 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view reminders." }, { status: 401 });
    const { data, error } = await supabase.from("reminders").select(fields)
      .eq("user_id", user.id).eq("status", "scheduled").order("remind_at", { ascending: true }).limit(100);
    if (error) return NextResponse.json({ error: "Your reminders could not be loaded." }, { status: 503 });
    return NextResponse.json({ reminders: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Reminder storage is not configured yet." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before saving a reminder." }, { status: 401 });
    const body = await readBody(request);
    if (body instanceof NextResponse) return body;
    const { productId, estimateDays, remindAt } = body;
    if (typeof productId !== "string" || !uuid.test(productId) || !Number.isInteger(estimateDays) || Number(estimateDays) < 1 || Number(estimateDays) > 3650 || !validDate(remindAt) || remindAt < todayInIndia()) {
      return NextResponse.json({ error: "Choose a saved product, a valid usage estimate, and a future reminder date." }, { status: 400 });
    }

    const { data, error } = await supabase.from("reminders").insert({
      user_id: user.id,
      product_id: productId,
      remind_at: `${remindAt}T09:00:00+05:30`,
      channel: "in_app",
      reason: `Replenishment reminder based on your estimated ${estimateDays}-day usage period.`,
      status: "scheduled",
    }).select(fields).single();
    if (error || !data) return NextResponse.json({ error: "Your reminder could not be saved." }, { status: 503 });
    return NextResponse.json({ reminder: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Reminder storage is not configured yet." }, { status: 503 });
  }
}
