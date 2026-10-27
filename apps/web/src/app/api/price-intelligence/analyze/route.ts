import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { crossStoreService } from "@/lib/price-intelligence/cross-store-service";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 16 * 1024);
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    const { url, forceRefresh = false, recordObservation = false, priceWatchId, productId } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Valid product 'url' parameter is required." }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return NextResponse.json({ error: "Product URL must use http or https scheme." }, { status: 400 });
    }

    const analysis = await crossStoreService.analyzeProductUrl(trimmedUrl, {
      forceRefresh: Boolean(forceRefresh),
      recordObservation: Boolean(recordObservation),
      priceWatchId: typeof priceWatchId === "string" ? priceWatchId : undefined,
      productId: typeof productId === "string" ? productId : undefined,
    });

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: unknown) {
    if (err instanceof JsonBodyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Failed to analyze product URL";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
