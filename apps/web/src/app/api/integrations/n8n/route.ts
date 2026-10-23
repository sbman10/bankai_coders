import { NextResponse } from "next/server";

export function GET() {
  const webhookUrl = process.env.N8N_CLAIM_INTAKE_WEBHOOK_URL?.trim();
  const hasToken = Boolean(process.env.N8N_WEBHOOK_AUTH_TOKEN);
  let validHttpsUrl = false;
  if (webhookUrl) {
    try {
      const parsed = new URL(webhookUrl);
      validHttpsUrl = parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
      validHttpsUrl = false;
    }
  }
  const configured = validHttpsUrl && hasToken;

  return NextResponse.json({
    configured,
    message: configured
      ? "An authenticated HTTPS n8n webhook is configured. Workflow behavior is not yet verified."
      : "Claim automation is not configured yet.",
  });
}
