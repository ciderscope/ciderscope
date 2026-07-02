import { NextResponse } from "next/server";
import { getSupabaseAdminIfConfigured } from "../../../../../../lib/server/supabaseAdmin";
import { cancelSlotRegistrationFromSql, hasCancelledSlotRegistrationFromSql } from "../../../../../../lib/server/slotSql";
import { isOutlookGraphConfigured } from "../../../../../../lib/server/outlookGraph";
import { processDueOutlookCancellations } from "../../../../../../lib/server/outlookInvitations";
import { normalizeEmail } from "../../../../../../lib/slots/validation";

export const runtime = "nodejs";

type CancelRpcResult = {
  ok: boolean;
  code?: string;
  registration?: {
    id: string;
    slot_id: string;
    participant_name: string;
    participant_email: string;
    cancelled_at: string;
  };
};

const messageForCode = (code?: string) => {
  if (code === "invalid_email") return "Veuillez saisir une adresse email valide.";
  if (code === "not_registered") return "Aucune inscription active ne correspond à cet email pour ce créneau.";
  return "Annulation impossible.";
};

const hasCancelledSlotRegistrationWithSupabase = async (
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminIfConfigured>>,
  slotId: string,
  participantEmail: string
) => {
  const { data, error } = await supabase
    .from("slot_registrations")
    .select("id")
    .eq("slot_id", slotId)
    .eq("participant_email", participantEmail)
    .eq("status", "cancelled")
    .limit(1);

  if (error) throw error;
  return (data || []).length > 0;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
  try {
    const { slotId } = await context.params;
    const body = await request.json().catch(() => null) as { participantEmail?: string } | null;
    const participantEmail = normalizeEmail(body?.participantEmail || "");
    const supabase = getSupabaseAdminIfConfigured();

    const result = supabase
      ? await supabase.rpc("cancel_slot_registration", {
        p_slot_id: slotId,
        p_participant_email: participantEmail,
      }).then(({ data, error }) => {
        if (error) throw error;
        return data as CancelRpcResult;
      })
      : await cancelSlotRegistrationFromSql({ slotId, participantEmail });

    if (result.ok) {
      let outlookCancellation: { status: "queued" | "processed" } | null = null;
      if (isOutlookGraphConfigured()) {
        try {
          const summary = await processDueOutlookCancellations(10);
          outlookCancellation = { status: summary.cancelled > 0 ? "processed" : "queued" };
        } catch (error) {
          console.error("Outlook cancellation processing error:", error);
          outlookCancellation = { status: "queued" };
        }
      }
      return NextResponse.json({ ok: true, outlookCancellation });
    }

    if (result.code === "not_registered") {
      const alreadyCancelled = supabase
        ? await hasCancelledSlotRegistrationWithSupabase(supabase, slotId, participantEmail)
        : await hasCancelledSlotRegistrationFromSql({ slotId, participantEmail });

      if (alreadyCancelled) {
        return NextResponse.json({ ok: true, alreadyCancelled: true });
      }
    }

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        code: result.code,
        message: messageForCode(result.code),
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Slot cancellation error:", error);
    return NextResponse.json({ ok: false, message: "Erreur lors de l'annulation." }, { status: 500 });
  }
}
