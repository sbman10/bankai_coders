/**
 * POST /api/amazon/import/callback
 *
 * Receives normalized product catalog data from the n8n Amazon import workflow
 * after it has called Amazon's Product Advertising API (PA-API).
 *
 * Authentication: shared secret via `x-claimforge-callback-secret` header
 * (same pattern as the claim-processing callback).
 *
 * The route validates the payload, optionally deduplicates against existing
 * products by ASIN, then upserts a Product Passport row in Supabase.
 *
 * On success: { ok: true, productId, duplicate }
 * On duplicate: { ok: true, productId, duplicate: true, existingProductId }
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASIN_RE } from "@/lib/amazon/asin";

export const runtime = "nodejs";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function constantTimeMatches(expected: string, received: string | null): boolean {
  if (!received) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeText(value: unknown, maxLen: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  // Block control characters (except tabs)
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
}

function safeStringArray(value: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((v) => safeText(v, maxItemLen))
    .filter((v): v is string => v !== null);
}

/**
 * Shape the n8n callback is expected to POST.
 * All catalog fields are optional — we never invent missing information.
 * Ownership fields (purchaseDate, serialNumber, warrantyEnd) must NOT be
 * included here; they remain user-provided.
 */
export type AmazonImportPayload = {
  jobId: string;           // UUID from the import trigger
  userId: string;          // Supabase user ID — n8n must echo this back
  asin: string;            // 10-char Amazon ASIN
  marketplace: string;     // e.g. "www.amazon.in"
  // --- Product Passport fields ---
  name: string;            // Required: product title
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  description?: string | null;
  features?: string[];     // Bullet-point feature strings
  imageUrls?: string[];    // HTTPS image URLs (PA-API images)
  sourceUrl?: string | null; // Canonical Amazon product URL
  variations?: string | null; // JSON-encoded variation summary (size/colour etc.)
};

export async function POST(request: Request) {
  // ── 1. Authenticate callback ───────────────────────────────────────────────
  const callbackSecret = process.env.N8N_CALLBACK_SECRET;
  if (!callbackSecret) {
    return NextResponse.json(
      { error: "Amazon import callback is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!constantTimeMatches(callbackSecret, request.headers.get("x-claimforge-callback-secret"))) {
    return NextResponse.json(
      { error: "This callback is not authorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    const raw = await readJsonBody(request, 128 * 1024);
    if (!isRecord(raw)) {
      return NextResponse.json(
        { error: "Callback body must be a JSON object." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    body = raw;
  } catch (err) {
    if (err instanceof JsonBodyError) {
      const message =
        err.status === 413 ? "Callback body is too large." : "Callback body must be valid JSON.";
      return NextResponse.json(
        { error: message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Callback body must be valid JSON." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 3. Validate required fields ────────────────────────────────────────────
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const asin = typeof body.asin === "string" ? body.asin.toUpperCase() : "";

  if (!uuidV4.test(jobId)) {
    return NextResponse.json(
      { error: "Invalid jobId." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!uuidV4.test(userId)) {
    return NextResponse.json(
      { error: "Invalid userId." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!ASIN_RE.test(asin)) {
    return NextResponse.json(
      { error: "Invalid ASIN in callback." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const name = safeText(body.name, 250);
  if (!name) {
    return NextResponse.json(
      { error: "Product name is required and must not be empty." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 4. Sanitize optional catalog fields ───────────────────────────────────
  const brand = safeText(body.brand, 160);
  const model = safeText(body.model, 160);
  const category = safeText(body.category, 100);
  const description = safeText(body.description, 4000);
  const marketplace = safeText(body.marketplace, 80) ?? "www.amazon.in";
  const sourceUrl = safeText(body.sourceUrl, 500);
  const variations = safeText(body.variations, 2000);

  // Validate sourceUrl is a real HTTPS Amazon URL if provided
  if (sourceUrl !== null) {
    try {
      const u = new URL(sourceUrl);
      if (u.protocol !== "https:") {
        return NextResponse.json(
          { error: "sourceUrl must use HTTPS." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "sourceUrl is not a valid URL." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const features = safeStringArray(body.features, 20, 500);
  const imageUrls = safeStringArray(body.imageUrls, 10, 500).filter((u) => {
    try {
      return new URL(u).protocol === "https:";
    } catch {
      return false;
    }
  });

  // ── 5. Deduplicate by ASIN + userId in Supabase ───────────────────────────
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Database is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("user_id", userId)
    .eq("asin", asin)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        existingProductId: existing.id,
        message: "A product with this ASIN already exists in your library.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 6. Insert Product Passport (catalog fields only) ──────────────────────
  // Ownership fields (purchase_date, warranty_end, serial_number) are left null.
  // The user will fill them in on the review/edit screen.
  const row = {
    user_id: userId,
    name,
    brand,
    model,
    category,
    asin,
    marketplace,
    description,
    features: features.length > 0 ? features : null,
    image_urls: imageUrls.length > 0 ? imageUrls : null,
    source_url: sourceUrl,
    variations,
    import_job_id: jobId,
    import_source: "amazon",
    // Ownership fields — always null from import; user-provided only
    purchase_date: null,
    warranty_end: null,
    serial_number: null,
    seller: null,
  };

  const { data: product, error: insertError } = await supabase
    .from("products")
    .insert(row)
    .select("id, name, brand, model, category, asin, source_url, image_urls, features, description, created_at")
    .single();

  if (insertError || !product) {
    return NextResponse.json(
      { error: "The product could not be saved. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, duplicate: false, productId: product.id, product },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
