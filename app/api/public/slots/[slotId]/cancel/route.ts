import { NextResponse } from "next/server";
import { getSupabaseAdminIfConfigured } from "../../../../../../lib/server/supabaseAdmin";
import { cancelSlotRegistrationFromSql } from "../../../../../../lib/server/slotSql";
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

    if (!result.ok || !result.registration) {
      return NextResponse.json({
        ok: false,
        code: result.code,
        message: messageForCode(result.code),
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slot cancellation error:", error);
    return NextResponse.json({ ok: false, message: "Erreur lors de l'annulation." }, { status: 500 });
  }
}
