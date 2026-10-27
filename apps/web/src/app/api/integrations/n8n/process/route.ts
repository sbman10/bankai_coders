import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { processClaimIntake } from "@/lib/claims/process-claim";

export const runtime = "nodejs";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

function constantTimeMatches(expected: string, received: string | null): boolean {
  if (!received) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export async function POST(request: Request) {
  const secret = process.env.N8N_CALLBACK_SECRET?.trim();
  if (!secret || !process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Claim processing is not configured yet." }, { status: 503, headers: noStore });
  }
  if (!constantTimeMatches(secret, request.headers.get("x-claimforge-callback-secret"))) {
    return NextResponse.json({ error: "This request is not authorized." }, { status: 401, headers: noStore });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 2 * 1024);
  } catch (error) {
    const status = error instanceof JsonBodyError ? error.status : 400;
    const message = status === 413 ? "The request is too large." : "Send valid JSON claim identifiers.";
    return NextResponse.json({ error: message }, { status, headers: noStore });
  }
  if (!isRecord(body) || Object.keys(body).length !== 2 ||
    typeof body.eventId !== "string" || !uuidV4.test(body.eventId) ||
    typeof body.claimId !== "string" || !uuidV4.test(body.claimId)) {
    return NextResponse.json({ error: "Send only a valid event ID and claim ID." }, { status: 400, headers: noStore });
  }

  try {
    const result = await processClaimIntake({ eventId: body.eventId, claimId: body.claimId });
    return NextResponse.json({ ok: true, duplicate: result.duplicate, status: result.status }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Claim processing is temporarily unavailable.", retryable: true }, { status: 503, headers: noStore });
  }
}
