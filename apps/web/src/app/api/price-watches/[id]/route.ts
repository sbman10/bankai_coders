import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const fields = "id, product_id, product_url, current_price, target_price, currency, checking_mode, last_checked_at, created_at, products(name, category)";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function bodyOf(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const value = await readJsonBody(request, 4 * 1024);
    return isRecord(value) ? value : NextResponse.json({ error: "Price update must be a JSON object." }, { status: 400 });
  } catch (error) {
    if (error instanceof JsonBodyError) {
      const message = error.status === 413 ? "Price update is too large." : "Price update must be valid JSON.";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: "Price update must be valid JSON." }, { status: 400 });
  }
}

import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { prototypeStore } from "@/lib/store/prototype-store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before updating a price." }, { status: 401 });
    const { id } = await context.params;
    if (!uuid.test(id)) return NextResponse.json({ error: "This price watch could not be found." }, { status: 404 });
    const body = await bodyOf(request);
    if (body instanceof NextResponse) return body;
    const amount = body.currentPrice;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 9_999_999_999.99) {
      return NextResponse.json({ error: "Enter a valid non-negative price." }, { status: 400 });
    }

    const { data, error } = await supabase.from("price_watches").update({
      current_price: Math.round(amount * 100) / 100,
      last_checked_at: new Date().toISOString(),
    }).eq("id", id).eq("user_id", user.id).select(fields).maybeSingle();
    if (error) return NextResponse.json({ error: "The price update could not be saved." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "This price watch could not be found." }, { status: 404 });
    return NextResponse.json({ watch: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const { id } = await context.params;
      const body = await bodyOf(request);
      if (body instanceof NextResponse) return body;
      const amount = Number(body.currentPrice) || 0;
      const watch = prototypeStore.updatePriceWatch(id, amount);
      if (!watch) return NextResponse.json({ error: "This price watch could not be found." }, { status: 404 });
      return NextResponse.json({ watch }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Price-watch storage is not configured yet." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before removing a price watch." }, { status: 401 });
    const { id } = await context.params;
    if (!uuid.test(id)) return NextResponse.json({ error: "This price watch could not be found." }, { status: 404 });
    const { data, error } = await supabase.from("price_watches").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "The price watch could not be removed." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "This price watch could not be found." }, { status: 404 });
    return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const { id } = await context.params;
      const removed = prototypeStore.deletePriceWatch(id);
      if (!removed) return NextResponse.json({ error: "This price watch could not be found." }, { status: 404 });
      return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Price-watch storage is not configured yet." }, { status: 503 });
  }
}
