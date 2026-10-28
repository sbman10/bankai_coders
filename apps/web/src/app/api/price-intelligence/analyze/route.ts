import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { crossStoreService } from "@/lib/price-intelligence/cross-store-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before checking a retailer link." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const body = await readJsonBody(request, 16 * 1024);
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Valid product 'url' parameter is required." }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return NextResponse.json({ error: "Product URL must use http or https scheme." }, { status: 400 });
    }

    let retailer: string;
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
        return NextResponse.json({ error: "Use a supported public retailer HTTPS link." }, { status: 400 });
      }
      retailer = crossStoreService.getAdapterForUrl(parsed.toString()).platform;
    } catch {
      return NextResponse.json({ error: "This link is not from a supported retailer." }, { status: 400 });
    }

    const { data: quotaAvailable, error: quotaError } = await supabase.rpc("consume_price_discovery_quota", { p_retailer: retailer });
    if (quotaError && quotaError.code !== "PGRST202" && !quotaError.message?.includes("Could not find the function")) {
      return NextResponse.json({ error: "Price checking is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (quotaAvailable === false) {
      return NextResponse.json({ error: "Daily price-check limit reached for this retailer. Try again tomorrow or keep a manual watch." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    }

    const analysis = await crossStoreService.analyzeProductUrl(trimmedUrl, {
      forceRefresh: false,
      recordObservation: false,
      targetPlatforms: [],
    });

    return NextResponse.json({
      success: true,
      analysis,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: unknown) {
    if (err instanceof JsonBodyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "The retailer price could not be verified. You can keep a manual watch." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
