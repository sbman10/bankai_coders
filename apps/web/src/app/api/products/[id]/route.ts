import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { prototypeStore } from "@/lib/store/prototype-store";

const fields = "id, name, category, brand, model, seller, serial_number, purchase_date, warranty_end, replenishment_days, replenishment_remind_at, owner_name, buying_method, purchase_platform, price_paid, currency, invoice_number, order_id, warranty_duration_months, created_at, updated_at";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: unknown): value is string | null {
  if (value === null || value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

async function bodyOf(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const value = await readJsonBody(request, 8 * 1024);
    return isRecord(value) ? value : NextResponse.json({ error: "Product details must be a JSON object." }, { status: 400 });
  } catch (error) {
    if (error instanceof JsonBodyError) {
      const message = error.status === 413 ? "Product details are too large." : "Product details must be valid JSON.";
      return NextResponse.json({ error: message }, { status: error.status });
    }
    return NextResponse.json({ error: "Product details must be valid JSON." }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before editing a product." }, { status: 401 });
    const { id } = await context.params;
    if (!uuid.test(id)) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });

    const body = await bodyOf(request);
    if (body instanceof NextResponse) return body;
    const update: Record<string, string | null> = {};
    for (const [key, column, max] of [["name", "name", 160], ["category", "category", 80], ["brand", "brand", 120], ["model", "model", 120], ["seller", "seller", 160], ["serialNumber", "serial_number", 120]] as const) {
      if (body[key] === undefined) continue;
      if (body[key] !== null && (typeof body[key] !== "string" || body[key].trim().length > max || /[\u0000-\u001f\u007f]/.test(body[key]))) {
        return NextResponse.json({ error: "Check the product details and try again." }, { status: 400 });
      }
      const value = typeof body[key] === "string" ? body[key].trim() : null;
      if (key === "name" && !value) return NextResponse.json({ error: "Product name is required." }, { status: 400 });
      update[column] = value;
    }
    for (const [key, column] of [["purchaseDate", "purchase_date"], ["warrantyEnd", "warranty_end"]] as const) {
      if (body[key] === undefined) continue;
      const value = body[key] === "" ? null : body[key];
      if (!validDate(value)) return NextResponse.json({ error: "Choose valid product dates." }, { status: 400 });
      update[column] = value;
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Change at least one product detail." }, { status: 400 });

    const { data, error } = await supabase.from("products").update(update).eq("id", id).eq("user_id", user.id).select(fields).maybeSingle();
    if (error) return NextResponse.json({ error: "Your product could not be updated." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });
    return NextResponse.json({ product: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const { id } = await context.params;
      const body = await bodyOf(request);
      if (body instanceof NextResponse) return body;
      const update: Record<string, string | null> = {};
      for (const [key, column] of [["name", "name"], ["category", "category"], ["brand", "brand"], ["model", "model"], ["seller", "seller"], ["serialNumber", "serial_number"], ["purchaseDate", "purchase_date"], ["warrantyEnd", "warranty_end"]] as const) {
        if (body[key] !== undefined) update[column] = typeof body[key] === "string" ? (body[key] as string).trim() : null;
      }
      const product = prototypeStore.updateProduct(id, update);
      if (!product) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });
      return NextResponse.json({ product }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Product storage is not configured yet." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before removing a product." }, { status: 401 });
    const { id } = await context.params;
    if (!uuid.test(id)) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });

    const dependencies = ["claims", "product_documents", "price_watches", "reminders"] as const;
    for (const table of dependencies) {
      const { count, error: countError } = await supabase.from(table).select("id", { count: "exact", head: true })
        .eq("product_id", id).eq("user_id", user.id);
      if (countError) return NextResponse.json({ error: "We could not safely check this product's linked records." }, { status: 503 });
      if ((count ?? 0) > 0) return NextResponse.json({ error: "This product has linked claims, documents, watches, or reminders. Remove those first to protect your saved records." }, { status: 409 });
    }

    const { data, error } = await supabase.from("products").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Your product could not be removed." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });
    return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const { id } = await context.params;
      const removed = prototypeStore.deleteProduct(id);
      if (!removed) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });
      return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Product storage is not configured yet." }, { status: 503 });
  }
}
