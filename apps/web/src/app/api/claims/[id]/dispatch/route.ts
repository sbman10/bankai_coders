import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchClaimIntake } from "@/lib/claims/dispatch-claim-intake";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: claimId } = await context.params;
    if (!uuidV4.test(claimId)) return NextResponse.json({ error: "Claim not found." }, { status: 404, headers: noStore });

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to retry claim processing." }, { status: 401, headers: noStore });

    const { data: event, error } = await supabase.from("workflow_events")
      .select("event_id, dispatch_status")
      .eq("claim_id", claimId)
      .eq("event_type", "claim.intake.received")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Claim processing could not be checked." }, { status: 503, headers: noStore });
    if (!event) return NextResponse.json({ error: "Claim not found." }, { status: 404, headers: noStore });

    if (event.dispatch_status === "dispatched") {
      return NextResponse.json({ automation: "accepted" }, { headers: noStore });
    }
    const automation = await dispatchClaimIntake(event.event_id);
    return NextResponse.json({ automation }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Claim processing is temporarily unavailable." }, { status: 503, headers: noStore });
  }
}
