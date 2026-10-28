import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const fields = "id, product_id, claim_id, reminder_type, title, remind_at, channel, reason, status, created_at, updated_at, coverage_expires_at, coverage_label, products(name, category)";
const baseFields = "id, product_id, claim_id, remind_at, channel, reason, status, created_at, products(name, category)";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reminderTypes = new Set(["warranty_expiry", "policy_expiry", "service", "replenishment", "claim_follow_up"]);

function enrichReminderRow(row: Record<string, unknown>) {
  return {
    reminder_type: row.reminder_type ?? "replenishment",
    title: row.title ?? (row.reason ? String(row.reason).slice(0, 120) : "Reminder"),
    updated_at: row.updated_at ?? row.created_at,
    coverage_expires_at: row.coverage_expires_at ?? null,
    coverage_label: row.coverage_label ?? null,
    ...row,
  };
}

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

function subtractDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return parsed.toISOString().slice(0, 10);
}

function atNineInIndia(date: string) {
  return `${date}T09:00:00+05:30`;
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

function belongsToOwnerError(error: { code?: string } | null) {
  return error?.code === "23503" || error?.code === "42501";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view reminders." }, { status: 401 });
    let { data, error } = await supabase.from("reminders").select(fields)
      .eq("user_id", user.id).in("status", ["scheduled", "sent"])
      .order("remind_at", { ascending: true }).limit(100);
    if (error) {
      // Fallback query if new columns have not been migrated yet
      const fallback = await supabase.from("reminders").select(baseFields)
        .eq("user_id", user.id).in("status", ["scheduled", "sent"])
        .order("remind_at", { ascending: true }).limit(100);
      if (!fallback.error && fallback.data) {
        data = fallback.data.map((r) => enrichReminderRow(r as Record<string, unknown>)) as typeof data;
        error = null;
      } else {
        console.error("[GET /api/reminders error]:", error);
        return NextResponse.json({ error: "Your reminders could not be loaded." }, { status: 503 });
      }
    }
    return NextResponse.json({ reminders: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Reminder storage is not configured yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before saving a reminder." }, { status: 401 });
    const body = await readBody(request);
    if (body instanceof NextResponse) return body;

    // Older clients sent only estimateDays; preserve that replenishment contract.
    const type = typeof body.type === "string" ? body.type : "replenishment";
    const productId = body.productId;
    const claimId = body.claimId;
    const estimateDays = body.estimateDays;
    const isCoverage = type === "warranty_expiry" || type === "policy_expiry";
    const coverageExpiresAt = body.expiresAt;
    const remindAt = body.remindAt;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const coverageLabel = typeof body.coverageLabel === "string" ? body.coverageLabel.trim() : "";

    if (!reminderTypes.has(type) ||
      (productId !== undefined && (typeof productId !== "string" || !uuid.test(productId))) ||
      (claimId !== undefined && (typeof claimId !== "string" || !uuid.test(claimId))) ||
      (productId && claimId) ||
      (type === "claim_follow_up" ? !claimId : !productId) ||
      (type === "replenishment" && estimateDays !== undefined && (!Number.isInteger(estimateDays) || Number(estimateDays) < 1 || Number(estimateDays) > 3650)) ||
      (isCoverage && (!validDate(coverageExpiresAt) || coverageExpiresAt < todayInIndia() || coverageLabel.length > 100)) ||
      (!isCoverage && (!validDate(remindAt) || remindAt < todayInIndia())) ||
      title.length > 120 || reason.length > 500) {
      return NextResponse.json({ error: "Choose an owned product or claim, a valid reminder type, and a valid future date." }, { status: 400 });
    }

    if (isCoverage) {
      const expires = coverageExpiresAt as string;
      const dates = ([30, 7] as const).map((days) => subtractDays(expires, days)).filter((date) => date >= todayInIndia());
      if (dates.length === 0) {
        return NextResponse.json({ error: "The 30-day and 7-day reminders have already passed." }, { status: 400 });
      }
      const rpcResult = await supabase.rpc("create_coverage_expiry_reminders", {
        p_product_id: productId,
        p_reminder_type: type,
        p_expires_at: expires,
        p_coverage_label: coverageLabel || null,
        p_title: title || null,
        p_reason: reason || null,
      });
      if (!rpcResult.error) {
        return NextResponse.json({ reminders: rpcResult.data ?? [] }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
      }
      // If RPC is missing, fall through to create single standard reminder
    }

    const defaultReason = type === "replenishment" && Number.isInteger(estimateDays)
      ? `Replenishment reminder based on your estimated ${estimateDays}-day usage period.`
      : reason || `${type.replaceAll("_", " ")} reminder.`;

    const reminderDate = atNineInIndia((isCoverage ? subtractDays(coverageExpiresAt as string, 30) : remindAt) as string);
    const fullPayload = {
      user_id: user.id,
      product_id: productId ?? null,
      claim_id: claimId ?? null,
      reminder_type: type,
      title: title || defaultReason.slice(0, 120),
      remind_at: reminderDate,
      coverage_expires_at: isCoverage ? (coverageExpiresAt as string) : null,
      coverage_label: coverageLabel || null,
      channel: "in_app",
      reason: reason || defaultReason,
      status: "scheduled",
    };

    let { data, error } = await supabase.from("reminders").insert(fullPayload).select(fields).single();
    if (error) {
      // Fallback: insert base columns if new columns don't exist
      const basePayload = {
        user_id: user.id,
        product_id: productId ?? null,
        claim_id: claimId ?? null,
        remind_at: reminderDate,
        channel: "in_app",
        reason: reason || defaultReason,
        status: "scheduled",
      };
      const fallbackInsert = await supabase.from("reminders").insert(basePayload).select(baseFields).single();
      if (!fallbackInsert.error && fallbackInsert.data) {
        data = enrichReminderRow(fallbackInsert.data as Record<string, unknown>) as typeof data;
        error = null;
      }
    }

    if (error || !data) return NextResponse.json({ error: belongsToOwnerError(error) ? "That product or claim could not be found in your account." : "Your reminder could not be saved." }, { status: belongsToOwnerError(error) ? 404 : 503 });
    return NextResponse.json({ reminder: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Reminder storage is not configured yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
