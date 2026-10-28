import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { crossStoreService } from "@/lib/price-intelligence/cross-store-service";
import type { NormalizedProductQuote } from "@/lib/platforms/platform.types";

export const runtime = "nodejs";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };
const secretHeader = "x-productvault-scheduler-secret";

interface ClaimedPriceCheck {
  check_id: string;
  user_id: string;
  price_watch_id: string;
  product_id: string | null;
  product_url: string;
  target_price: number | null;
  check_key: string;
}

interface ClaimedEmailDelivery {
  delivery_id: string;
  user_id: string;
  recipient: string;
  notification_title: string;
  notification_body: string;
  notification_href: string | null;
}

function matchesSecret(expected: string, received: string | null) {
  if (!received) return false;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function safeRetailerUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    crossStoreService.getAdapterForUrl(url.toString());
    return true;
  } catch {
    return false;
  }
}

function safeErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("not configured") || message.includes("firecrawl_api_key")) return "PRICE_SOURCE_NOT_CONFIGURED";
  if (message.includes("unsupported") || message.includes("not supported")) return "UNSUPPORTED_RETAILER";
  if (message.includes("validation") || message.includes("wrong product")) return "PRICE_IDENTITY_UNVERIFIED";
  return "PRICE_CHECK_FAILED";
}

function validQuote(quote: NormalizedProductQuote | null | undefined) {
  return Boolean(
    quote && quote.price && Number.isFinite(quote.price.current) && quote.price.current >= 0 &&
    quote.availability.status === "IN_STOCK" && quote.rawConfidence >= 0.8 &&
    quote.productUrl && safeRetailerUrl(quote.productUrl)
  );
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function safeAppUrl(path: string) {
  const base = process.env.APP_BASE_URL?.trim();
  if (!base || !path.startsWith("/dashboard/") || path.startsWith("//")) return null;
  try {
    const url = new URL(base);
    if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password) return null;
    const resolved = new URL(path, url);
    if (!resolved.pathname.startsWith("/dashboard/")) return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

async function deliverEmails(admin: ReturnType<typeof createAdminClient>) {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.POSTMARK_FROM_EMAIL?.trim();
  if (!token || !from) return { sent: 0, failed: 0, skipped: "not_configured" as const };

  const { data, error } = await admin.rpc("claim_notification_email_deliveries", { p_now: new Date().toISOString(), p_limit: 6 });
  if (error || !data) return { sent: 0, failed: 0, skipped: "temporarily_unavailable" as const };
  const deliveries = data as ClaimedEmailDelivery[];
  let sent = 0;
  let failed = 0;

  for (let offset = 0; offset < deliveries.length; offset += 3) {
    const group = deliveries.slice(offset, offset + 3);
    const outcomes = await Promise.all(group.map(async (delivery) => {
      try {
        const actionUrl = delivery.notification_href ? safeAppUrl(delivery.notification_href) : null;
        const response = await fetch("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Postmark-Server-Token": token },
          body: JSON.stringify({
            From: from,
            To: delivery.recipient,
            Subject: delivery.notification_title,
            TextBody: delivery.notification_body,
            HtmlBody: `<p>${htmlEscape(delivery.notification_body)}</p>${actionUrl ? `<p><a href="${htmlEscape(actionUrl)}">Open ProductVault</a></p>` : ""}`,
            MessageStream: "outbound",
            Metadata: { productvault_delivery_id: delivery.delivery_id },
          }),
          signal: AbortSignal.timeout(8000),
        });
        const result = await response.json().catch(() => null) as { ErrorCode?: number; MessageID?: string } | null;
        if (response.ok && result?.ErrorCode === 0 && result.MessageID) {
          const finish = await admin.rpc("finish_notification_email_delivery", {
            p_delivery_id: delivery.delivery_id, p_status: "sent", p_provider_message_id: result.MessageID, p_safe_error_code: null,
          });
          if (finish.error) return "failed" as const;
          return "sent" as const;
        }
        // An explicit HTTP response means Postmark rejected this attempt; retry only bounded failures.
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        const finish = await admin.rpc("finish_notification_email_delivery", {
          p_delivery_id: delivery.delivery_id,
          p_status: retryable ? "failed" : "unknown",
          p_provider_message_id: null,
          p_safe_error_code: retryable ? "POSTMARK_TEMPORARY_FAILURE" : "POSTMARK_REJECTED",
        });
        return finish.error ? "failed" as const : "failed" as const;
      } catch {
        // A timeout may mean the provider accepted the email but the response was lost. Never auto-resend it.
        await admin.rpc("finish_notification_email_delivery", {
          p_delivery_id: delivery.delivery_id, p_status: "unknown", p_provider_message_id: null, p_safe_error_code: "DELIVERY_RESULT_UNKNOWN",
        });
        return "failed" as const;
      }
    }));
    sent += outcomes.filter((outcome) => outcome === "sent").length;
    failed += outcomes.filter((outcome) => outcome === "failed").length;
  }

  return { sent, failed, skipped: null };
}

async function processPriceChecks(admin: ReturnType<typeof createAdminClient>) {
  if (!process.env.FIRECRAWL_API_KEY?.trim()) return { attempted: 0, verified: 0, failed: 0, skipped: "not_configured" as const };
  const claimed = await admin.rpc("claim_due_price_watch_checks", { p_now: new Date().toISOString(), p_limit: 2 });
  if (claimed.error || !claimed.data) return { attempted: 0, verified: 0, failed: 0, skipped: "temporarily_unavailable" as const };

  const checks = claimed.data as ClaimedPriceCheck[];
  let verified = 0;
  let failed = 0;
  for (const check of checks) {
    try {
      if (!safeRetailerUrl(check.product_url)) throw new Error("UNSUPPORTED_RETAILER");
      const analysis = await crossStoreService.analyzeProductUrl(check.product_url, {
        forceRefresh: true,
        targetPlatforms: [],
        timeoutMs: 7000,
      });
      const quote = analysis.sourceQuote;
      if (!validQuote(quote) || !quote.price) throw new Error("PRICE_IDENTITY_UNVERIFIED");
      const result = await admin.rpc("record_verified_price_watch_observation", {
        p_check_id: check.check_id,
        p_user_id: check.user_id,
        p_price: quote.price.current,
        p_mrp: quote.price.mrp,
        p_currency: quote.price.currency,
        p_platform: quote.platform,
        p_product_url: quote.productUrl,
        p_title: quote.title,
        p_availability: quote.availability.status,
        p_availability_evidence: quote.availability.evidence,
        p_seller: quote.seller,
        p_match_confidence: Math.round(quote.rawConfidence * 100),
        p_check_key: check.check_key,
      });
      if (result.error) throw new Error("PRICE_PERSISTENCE_FAILED");
      verified += 1;
    } catch (error) {
      const failure = await admin.rpc("fail_price_watch_check", {
        p_check_id: check.check_id,
        p_user_id: check.user_id,
        p_safe_error_code: safeErrorCode(error),
      });
      failed += 1;
      if (failure.error) continue;
    }
  }
  return { attempted: checks.length, verified, failed, skipped: null };
}

export async function POST(request: Request) {
  const secret = process.env.N8N_REMINDERS_SECRET?.trim();
  if (!secret || !process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Reminder processing is not configured yet." }, { status: 503, headers: noStore });
  }
  if (!matchesSecret(secret, request.headers.get(secretHeader))) {
    return NextResponse.json({ error: "This request is not authorized." }, { status: 401, headers: noStore });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 2 * 1024);
  } catch (error) {
    const status = error instanceof JsonBodyError ? error.status : 400;
    return NextResponse.json({ error: status === 413 ? "The request is too large." : "Send a valid reminder batch request." }, { status, headers: noStore });
  }
  if (!isRecord(body) || Object.keys(body).some((key) => key !== "batchSize") ||
    (body.batchSize !== undefined && (!Number.isInteger(body.batchSize) || Number(body.batchSize) < 1 || Number(body.batchSize) > 250))) {
    return NextResponse.json({ error: "Send only a valid batch size." }, { status: 400, headers: noStore });
  }

  try {
    const admin = createAdminClient();
    const reminders = await admin.rpc("enqueue_due_reminders", {
      p_now: new Date().toISOString(), p_limit: Number(body.batchSize ?? 100),
    });
    if (reminders.error) return NextResponse.json({ error: "Reminder processing is temporarily unavailable." }, { status: 503, headers: noStore });

    const [priceChecks, emails] = await Promise.all([processPriceChecks(admin), deliverEmails(admin)]);
    return NextResponse.json({
      ok: true,
      reminders: reminders.data ?? {},
      priceChecks,
      emailDeliveries: emails,
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Reminder processing is temporarily unavailable." }, { status: 503, headers: noStore });
  }
}
