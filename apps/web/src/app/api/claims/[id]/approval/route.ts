import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isRecord, JsonBodyError, readJsonBody } from "@/lib/http/read-json-body";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const approvalFields = "id, claim_id, approved_content, content_sha256, idempotency_key, approved_at, action_status";
type Context = { params: Promise<{ id: string }> };

async function findDuplicate(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, claimId: string, contentHash: string) {
  return supabase.from("claim_approvals").select(approvalFields)
    .eq("user_id", userId).eq("claim_id", claimId).eq("content_sha256", contentHash).maybeSingle();
}

export async function POST(request: Request, context: Context) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in before approving a claim draft." }, { status: 401 });

    const { id: claimId } = await context.params;
    if (!uuidV4.test(claimId)) return NextResponse.json({ error: "This claim could not be found." }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      const value = await readJsonBody(request, 12 * 1024);
      if (!isRecord(value)) return NextResponse.json({ error: "Approval details must be a JSON object." }, { status: 400 });
      body = value;
    } catch (error) {
      if (error instanceof JsonBodyError) {
        const message = error.status === 413 ? "The approved draft is too large." : "Approval details must be valid JSON.";
        return NextResponse.json({ error: message }, { status: error.status });
      }
      return NextResponse.json({ error: "Approval details must be valid JSON." }, { status: 400 });
    }

    const approvedContent = typeof body.approvedContent === "string" ? body.approvedContent : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    if (!approvedContent.trim() || approvedContent.length > 10_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(approvedContent) || !uuidV4.test(idempotencyKey)) {
      return NextResponse.json({ error: "Review the draft and try again with a valid approval request." }, { status: 400 });
    }

    const { data: claim, error: claimError } = await supabase.from("claims").select("id, status, claim_draft")
      .eq("id", claimId).eq("user_id", user.id).maybeSingle();
    if (claimError) return NextResponse.json({ error: "The claim could not be checked." }, { status: 503 });
    if (!claim) return NextResponse.json({ error: "This claim could not be found." }, { status: 404 });
    if (claim.status !== "ready_for_review" || !claim.claim_draft) {
      return NextResponse.json({ error: "This claim does not have a processed draft ready for approval." }, { status: 409 });
    }

    const contentHash = createHash("sha256").update(approvedContent, "utf8").digest("hex");
    const { data: approval, error: insertError } = await supabase.from("claim_approvals").insert({
      user_id: user.id,
      claim_id: claimId,
      approved_content: approvedContent,
      content_sha256: contentHash,
      idempotency_key: idempotencyKey,
      action_status: "draft_only",
    }).select(approvalFields).single();

    if (!insertError && approval) {
      return NextResponse.json({ approval, duplicate: false, externalAction: "not_sent" }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }

    if (insertError?.code === "23505") {
      const { data: prior, error: duplicateError } = await findDuplicate(supabase, user.id, claimId, contentHash);
      if (duplicateError) return NextResponse.json({ error: "The prior approval could not be checked." }, { status: 503 });
      if (prior) return NextResponse.json({ approval: prior, duplicate: true, externalAction: "not_sent" }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
      return NextResponse.json({ error: "This approval key was already used for a different draft." }, { status: 409 });
    }

    return NextResponse.json({ error: "The approved draft could not be saved." }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "Claim approval is not configured yet." }, { status: 503 });
  }
}
