import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const productFields = "id, name, category, brand, model, seller, serial_number, purchase_date, warranty_end, replenishment_days, replenishment_remind_at, created_at, updated_at";

function validDate(value: unknown): value is string | null {
  if (value === null || value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  return value.trim();
}

function productInput(body: Record<string, unknown>, partial = false): Record<string, string | null> | null {
  const name = optionalText(body.name, 160);
  const textFields = [
    ["category", "category", 80], ["brand", "brand", 120], ["model", "model", 120],
    ["seller", "seller", 160], ["serialNumber", "serial_number", 120],
  ] as const;
  const optionalFields = textFields.map(([key, column, max]) => {
    const value = body[key] === undefined && !partial ? null : optionalText(body[key], max);
    return { key, column, value };
  });
  const purchaseDate = body.purchaseDate === undefined && partial ? undefined : body.purchaseDate ?? null;
  const warrantyEnd = body.warrantyEnd === undefined && partial ? undefined : body.warrantyEnd ?? null;
  if (name === undefined || optionalFields.some((field) => field.value === undefined) || !validDate(purchaseDate) || !validDate(warrantyEnd)) return null;
  if (!partial && !name) return null;
  if (partial && name === undefined && optionalFields.every((field) => field.value === undefined) && purchaseDate === undefined && warrantyEnd === undefined) return null;

  const input: Record<string, string | null> = {};
  if (name !== undefined) input.name = name;
  for (const field of optionalFields) if (field.value !== undefined) input[field.column] = field.value;
  if (purchaseDate !== undefined) input.purchase_date = purchaseDate || null;
  if (warrantyEnd !== undefined) input.warranty_end = warrantyEnd || null;
  return input;
}

async function readBody(request: Request): Promise<Record<string, unknown> | NextResponse> {
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

import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { prototypeStore } from "@/lib/store/prototype-store";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view your products." }, { status: 401 });

    const { data, error } = await supabase.from("products").select(productFields)
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Your products could not be loaded." }, { status: 503 });
    return NextResponse.json({ products: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const products = prototypeStore.getProducts();
      return NextResponse.json({ products }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Product storage is not configured yet." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before saving a product." }, { status: 401 });

    const body = await readBody(request);
    if (body instanceof NextResponse) return body;
    const input = productInput(body);
    if (!input) return NextResponse.json({ error: "Enter a product name and valid ownership dates." }, { status: 400 });

    const { data, error } = await supabase.from("products")
      .insert({ ...input, user_id: user.id }).select(productFields).single();
    if (error || !data) return NextResponse.json({ error: "Your product could not be saved." }, { status: 503 });
    return NextResponse.json({ product: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    if (!isSupabaseConfigured()) {
      const body = await readBody(request);
      if (body instanceof NextResponse) return body;
      const input = productInput(body);
      if (!input) return NextResponse.json({ error: "Enter a product name and valid ownership dates." }, { status: 400 });
      const product = prototypeStore.createProduct({
        name: input.name as string,
        brand: input.brand,
        model: input.model,
        category: (input.category as string) || "Other",
        seller: input.seller,
        serial_number: input.serial_number,
        purchase_date: input.purchase_date,
        warranty_end: input.warranty_end,
      });
      return NextResponse.json({ product }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Product storage is not configured yet." }, { status: 503 });
  }
}

