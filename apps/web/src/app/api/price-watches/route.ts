import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const fields = "id, product_id, product_url, current_price, target_price, currency, checking_mode, last_checked_at, created_at, products(name, category)";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumPrice = 9_999_999_999.99;

function price(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximumPrice) return null;
  return Math.round(value * 100) / 100;
}

function safeProductUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

async function readBody(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const value = await readJsonBody(request, 8 * 1024);
    return isRecord(value) ? value : NextResponse.json({ error: "Price-watch details must be a JSON object." }, { status: 400 });
  } catch (error) {
    if (error instanceof JsonBodyError) {
      const message = error.status === 413 ? "Price-watch details are too large." : "Price-watch details must be valid JSON.";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: "Price-watch details must be valid JSON." }, { status: 400 });
  }
}

import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { prototypeStore } from "@/lib/store/prototype-store";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view your price watches." }, { status: 401 });
    const { data, error } = await supabase.from("price_watches").select(fields)
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Your price watches could not be loaded." }, { status: 503 });
    return NextResponse.json({ watches: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const watches = prototypeStore.getPriceWatches();
      return NextResponse.json({ watches }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Price-watch storage is not configured yet." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before saving a price watch." }, { status: 401 });
    const body = await readBody(request);
    if (body instanceof NextResponse) return body;

    const productId = body.productId;
    const currentPrice = price(body.currentPrice);
    const targetPrice = price(body.targetPrice);
    const productUrl = safeProductUrl(body.productUrl);
    if (typeof productId !== "string" || !uuid.test(productId) || currentPrice === null || targetPrice === null || productUrl === undefined) {
      return NextResponse.json({ error: "Choose a product and enter valid prices and an optional HTTPS product link." }, { status: 400 });
    }

    const { data, error } = await supabase.from("price_watches").insert({
      user_id: user.id,
      product_id: productId,
      product_url: productUrl,
      current_price: currentPrice,
      target_price: targetPrice,
      currency: "INR",
      checking_mode: "manual",
    }).select(fields).single();
    if (error || !data) return NextResponse.json({ error: "Your price watch could not be saved." }, { status: 503 });
    return NextResponse.json({ watch: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const body = await readBody(request);
      if (body instanceof NextResponse) return body;
      const productId = String(body.productId);
      const currentPrice = price(body.currentPrice) ?? 0;
      const targetPrice = price(body.targetPrice) ?? 0;
      const productUrl = safeProductUrl(body.productUrl) ?? "";
      const watch = prototypeStore.createPriceWatch({
        productId,
        productUrl,
        currentPrice,
        targetPrice,
      });
      return NextResponse.json({ watch }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Price-watch storage is not configured yet." }, { status: 503 });
  }
}
