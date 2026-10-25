/**
 * POST /api/amazon/import
 *
 * Accepts a raw Amazon product URL from the browser, extracts and validates the
 * ASIN entirely server-side, then dispatches a server-to-server request to the
 * configured n8n webhook. Amazon API credentials and the n8n auth token never
 * leave the server environment.
 *
 * On success returns { jobId, asin, status: "queued" }.
 * The browser polls /api/amazon/import/status?jobId=… or waits for the
 * n8n callback to write the result to Supabase and return it via
 * POST /api/amazon/import/callback.
 *
 * If n8n is not configured, a graceful "not_configured" response is returned
 * so the UI can offer the manual-entry fallback immediately.
 */

import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";
import { extractAsin, extractMarketplace } from "@/lib/amazon/asin";

export const runtime = "nodejs";

/** Maximum raw URL length we will parse — prevents excessively large inputs. */
const MAX_URL_LENGTH = 2048;

function buildWebhookPayload(
  asin: string,
  marketplace: string,
  userId: string,
  jobId: string,
  callbackUrl: string,
) {
  return {
    jobId,
    asin,
    marketplace,
    userId,
    callbackUrl,
    requestedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  // ── 1. Auth: require a signed-in user ─────────────────────────────────────
  let userId: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: "Sign in before importing from Amazon." },
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

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    const raw = await readJsonBody(request, 4 * 1024);
    if (!isRecord(raw)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    body = raw;
  } catch (err) {
    if (err instanceof JsonBodyError) {
      const message =
        err.status === 413
          ? "Request body is too large."
          : "Request body must be valid JSON.";
      return NextResponse.json(
        { error: message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 3. Validate the Amazon URL ─────────────────────────────────────────────
  const rawUrl = body.url;
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return NextResponse.json(
      { error: "Provide an Amazon product URL." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (rawUrl.length > MAX_URL_LENGTH) {
    return NextResponse.json(
      { error: "The URL is too long. Paste the product page URL directly from Amazon." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const asin = extractAsin(rawUrl);
  if (!asin) {
    return NextResponse.json(
      {
        error:
          "Could not find a valid ASIN in that URL. Make sure you paste the Amazon product page URL (it should contain /dp/ followed by a 10-character product code).",
      },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  const marketplace = extractMarketplace(rawUrl);

  // ── 4. Check if n8n Amazon import workflow is configured ──────────────────
  const webhookUrl = process.env.N8N_AMAZON_IMPORT_WEBHOOK_URL?.trim();
  const authToken = process.env.N8N_WEBHOOK_AUTH_TOKEN?.trim();

  if (!webhookUrl || !authToken) {
    // Workflow not yet connected — return the ASIN so the UI can pre-fill manual entry
    return NextResponse.json(
      {
        status: "not_configured",
        asin,
        marketplace,
        message:
          "Amazon import automation is not connected yet. You can add the product manually with the ASIN pre-filled.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Validate webhook URL (must be HTTPS, no embedded credentials)
  let parsedWebhook: URL;
  try {
    parsedWebhook = new URL(webhookUrl);
    if (parsedWebhook.protocol !== "https:" || parsedWebhook.username || parsedWebhook.password) {
      throw new Error("invalid webhook URL");
    }
  } catch {
    return NextResponse.json(
      { error: "Amazon import automation is misconfigured. Contact support." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 5. Generate a job ID and build the callback URL ────────────────────────
  const jobId = crypto.randomUUID();
  const appBase = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const callbackUrl = `${appBase}/api/amazon/import/callback`;

  // ── 6. Dispatch to n8n — server-to-server, credentials never reach browser ─
  const payload = buildWebhookPayload(asin, marketplace, userId, jobId, callbackUrl);

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(parsedWebhook.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
      // Timeout via AbortSignal — n8n must acknowledge quickly; the full
      // catalog lookup happens asynchronously and posts back to callbackUrl.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut
          ? "Amazon import timed out. Please try again."
          : "Amazon import could not be started. Please try again.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!n8nResponse.ok) {
    return NextResponse.json(
      { error: "Amazon import workflow returned an error. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 7. Return job reference to browser ────────────────────────────────────
  return NextResponse.json(
    { status: "queued", jobId, asin, marketplace },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
