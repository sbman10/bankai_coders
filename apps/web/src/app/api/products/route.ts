import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

const productFields = "id, name, category, brand, model, seller, serial_number, purchase_date, warranty_end, replenishment_days, replenishment_remind_at, owner_name, buying_method, purchase_platform, price_paid, currency, invoice_number, order_id, warranty_duration_months, image_url, source_url, asin, created_at, updated_at";

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

function productInput(body: Record<string, unknown>, partial = false): Record<string, unknown> | null {
  const name = optionalText(body.name, 160);
  const textFields = [
    ["category", "category", 80], ["brand", "brand", 120], ["model", "model", 120],
    ["seller", "seller", 160], ["serialNumber", "serial_number", 120],
    ["ownerName", "owner_name", 120], ["buyingMethod", "buying_method", 80],
    ["purchasePlatform", "purchase_platform", 80], ["currency", "currency", 10],
    ["invoiceNumber", "invoice_number", 120], ["orderId", "order_id", 120],
    ["imageUrl", "image_url", 1000], ["sourceUrl", "source_url", 1000], ["asin", "asin", 20],
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

  const input: Record<string, unknown> = {};
  if (name !== undefined) input.name = name;
  for (const field of optionalFields) if (field.value !== undefined) input[field.column] = field.value;
  if (purchaseDate !== undefined) input.purchase_date = purchaseDate || null;
  if (warrantyEnd !== undefined) input.warranty_end = warrantyEnd || null;

  if (typeof body.pricePaid === "number" && !Number.isNaN(body.pricePaid)) {
    input.price_paid = body.pricePaid;
  }
  if (typeof body.warrantyDurationMonths === "number" && !Number.isNaN(body.warrantyDurationMonths)) {
    input.warranty_duration_months = Math.round(body.warrantyDurationMonths);
  }

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
        brand: input.brand as string | null | undefined,
        model: input.model as string | null | undefined,
        category: (input.category as string) || "Other",
        seller: input.seller as string | null | undefined,
        serial_number: input.serial_number as string | null | undefined,
        purchase_date: input.purchase_date as string | null | undefined,
        warranty_end: input.warranty_end as string | null | undefined,
        owner_name: input.owner_name as string | null | undefined,
        buying_method: input.buying_method as string | null | undefined,
        purchase_platform: input.purchase_platform as string | null | undefined,
        price_paid: input.price_paid as number | null | undefined,
        currency: (input.currency as string) || "INR",
        invoice_number: input.invoice_number as string | null | undefined,
        order_id: input.order_id as string | null | undefined,
        warranty_duration_months: input.warranty_duration_months as number | null | undefined,
        image_url: input.image_url as string | null | undefined,
        source_url: input.source_url as string | null | undefined,
        asin: input.asin as string | null | undefined,
      });
      return NextResponse.json({ product }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Product storage is not configured yet." }, { status: 503 });
  }
}

