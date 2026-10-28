import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";
import { crossStoreService } from "@/lib/price-intelligence/cross-store-service";

const fields = "id, product_id, product_url, current_price, target_price, currency, checking_mode, current_price_source, manual_price, manual_price_entered_at, last_check_status, last_check_error_code, next_check_at, last_checked_at, created_at, products(name, category)";
const baseFields = "id, product_id, product_url, current_price, target_price, currency, checking_mode, last_checked_at, created_at, products(name, category)";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumPrice = 9_999_999_999.99;

function enrichRow(row: Record<string, unknown>) {
  return {
    current_price_source: row.current_price_source ?? "manual",
    manual_price: row.manual_price ?? row.current_price,
    manual_price_entered_at: row.manual_price_entered_at ?? row.created_at,
    last_check_status: row.last_check_status ?? "not_checked",
    last_check_error_code: row.last_check_error_code ?? null,
    next_check_at: row.next_check_at ?? null,
    ...row,
  };
}

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
    let { data, error } = await supabase.from("price_watches").select(fields)
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) {
      // Fallback query if new columns have not been migrated yet
      const fallback = await supabase.from("price_watches").select(baseFields)
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (!fallback.error && fallback.data) {
        data = fallback.data.map((r) => enrichRow(r as Record<string, unknown>)) as typeof data;
        error = null;
      } else {
        console.error("[GET /api/price-watches error]:", error);
        return NextResponse.json({ error: "Your price watches could not be loaded." }, { status: 503 });
      }
    }
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
    const checkingMode = body.checkingMode === undefined ? "manual" : body.checkingMode;
    if (typeof productId !== "string" || !uuid.test(productId) || currentPrice === null || targetPrice === null || productUrl === undefined || !["manual", "automated"].includes(String(checkingMode))) {
      return NextResponse.json({ error: "Choose a product and enter valid prices and an optional HTTPS product link." }, { status: 400 });
    }
    if (checkingMode === "automated" && (!productUrl || (() => {
      try { return !crossStoreService.getAdapterForUrl(productUrl).canHandle(productUrl); }
      catch { return true; }
    })())) {
      return NextResponse.json({ error: "Daily checks are available only for links from supported retailers. You can keep this as a manual watch." }, { status: 400 });
    }

    let watchId: string | null = null;
    const { data: rpcWatchId, error: rpcError } = await supabase.rpc("create_price_watch_with_initial_observation", {
      p_product_id: productId,
      p_product_url: productUrl,
      p_current_price: currentPrice,
      p_target_price: targetPrice,
      p_checking_mode: checkingMode,
    });
    if (!rpcError && typeof rpcWatchId === "string") {
      watchId = rpcWatchId;
    } else {
      // Fallback: direct insert if migration RPC is not yet present
      const insertRes = await supabase.from("price_watches").insert({
        user_id: user.id,
        product_id: productId,
        product_url: productUrl,
        current_price: currentPrice,
        target_price: targetPrice,
        currency: "INR",
        checking_mode: checkingMode,
      }).select("id").single();
      if (insertRes.error || !insertRes.data) {
        console.error("[POST /api/price-watches insert fallback error]:", insertRes.error);
        return NextResponse.json({
          error: insertRes.error?.code === "23503" || insertRes.error?.message?.includes("Product not found")
            ? "That product could not be found in your account."
            : "Your price watch could not be saved."
        }, { status: insertRes.error?.code === "23503" ? 404 : 503 });
      }
      watchId = insertRes.data.id;
    }

    let { data, error: readError } = await supabase.from("price_watches").select(fields)
      .eq("id", watchId).eq("user_id", user.id).single();
    if (readError) {
      const baseRead = await supabase.from("price_watches").select(baseFields)
        .eq("id", watchId).eq("user_id", user.id).single();
      if (!baseRead.error && baseRead.data) {
        data = enrichRow(baseRead.data as Record<string, unknown>) as typeof data;
        readError = null;
      }
    }
    if (readError || !data) return NextResponse.json({ error: "Your saved price watch could not be loaded." }, { status: 503 });
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
