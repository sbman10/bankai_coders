/**
 * GET /api/amazon/import/status?jobId=…
 *
 * Lightweight polling endpoint. The browser calls this every ~2.5 s while
 * waiting for the n8n Amazon import callback to write the result.
 *
 * Returns one of:
 *   { status: "pending" }
 *   { status: "complete", product: {...} }
 *   { status: "duplicate", existingProductId: "…" }
 *   { status: "error", message: "…" }
 *
 * We look up the job result by reading from the `amazon_import_jobs` view
 * (or products table filtered by import_job_id). If the row doesn't exist
 * yet, we return "pending". Requires a signed-in user — only their own jobs
 * are visible (enforced by user_id match in the query).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  let userId: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: "Sign in to check import status." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    userId = user.id;
  } catch {
    return NextResponse.json(
      { error: "Authentication is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── Validate jobId ────────────────────────────────────────────────────────
  const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
  if (!UUID_RE.test(jobId)) {
    return NextResponse.json(
      { error: "Provide a valid jobId." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── Query Supabase for the imported product ───────────────────────────────
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, brand, model, category, asin, source_url, image_urls, features, description, created_at",
      )
      .eq("import_job_id", jobId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { status: "error", message: "Could not check import status." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!data) {
      return NextResponse.json(
        { status: "pending" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { status: "complete", product: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", message: "Import status check failed." },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
