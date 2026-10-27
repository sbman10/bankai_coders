import { createAdminClient } from "@/lib/supabase/admin";

const claimIntakeEventType = "claim.intake.received";

export type DispatchResult = "accepted" | "pending" | "not_configured";

export async function dispatchClaimIntake(eventId: string): Promise<DispatchResult> {
  const webhookUrl = process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL?.trim();
  const webhookToken = process.env.N8N_WEBHOOK_AUTH_TOKEN?.trim();
  if (!webhookUrl || !webhookToken) return "not_configured";

  let parsedWebhookUrl: URL;
  try {
    parsedWebhookUrl = new URL(webhookUrl);
    if (parsedWebhookUrl.protocol !== "https:" || parsedWebhookUrl.username || parsedWebhookUrl.password) return "pending";
  } catch {
    return "pending";
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return "pending";
  }

  let lease: { leased?: boolean; claim_id?: string; product_id?: string } | null;
  try {
    const result = await admin.rpc("lease_claim_intake_event", { p_event_id: eventId });
    lease = result.data;
    if (result.error) return "pending";
  } catch {
    return "pending";
  }
  if (!lease?.leased || typeof lease.claim_id !== "string" || typeof lease.product_id !== "string") return "pending";

  let succeeded = false;
  let safeErrorCode: "n8n_unavailable" | "n8n_rejected" | "invalid_response" = "n8n_unavailable";
  try {
    const response = await fetch(parsedWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-claimforge-secret": webhookToken },
      body: JSON.stringify({
        eventId,
        eventType: claimIntakeEventType,
        claimId: lease.claim_id,
        productId: lease.product_id,
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      redirect: "error",
    });
    if (response.status === 202) succeeded = true;
    else safeErrorCode = response.ok ? "invalid_response" : "n8n_rejected";
  } catch {
    safeErrorCode = "n8n_unavailable";
  }

  try {
    const { error: finishError } = await admin.rpc("finish_claim_intake_event_dispatch", {
      p_event_id: eventId,
      p_succeeded: succeeded,
      p_safe_error_code: succeeded ? null : safeErrorCode,
    });
    return succeeded && !finishError ? "accepted" : "pending";
  } catch {
    return "pending";
  }
}
