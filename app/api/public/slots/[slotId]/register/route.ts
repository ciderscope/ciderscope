import { NextResponse } from "next/server";
import { getCalendarSlot } from "../../../../../../lib/server/slotData";
import { buildSlotIcs } from "../../../../../../lib/slots/ics";
import { getSupabaseAdminIfConfigured } from "../../../../../../lib/server/supabaseAdmin";
import { getCalendarSlotFromSql, registerSlotParticipantFromSql } from "../../../../../../lib/server/slotSql";
import { normalizeEmail } from "../../../../../../lib/slots/validation";

export const runtime = "nodejs";

type RegisterRpcResult = {
  ok: boolean;
  code?: string;
  domain?: string;
  places_taken?: number;
  capacity?: number;
  participant_name?: string;
  registration?: {
    id: string;
    slot_id: string;
    participant_name: string;
    participant_email: string;
    created_at: string;
    token: string;
  };
};

const messageForCode = (code?: string, domain?: string) => {
  if (code === "invalid_name") return "Veuillez saisir votre nom.";
  if (code === "invalid_email") return "Veuillez saisir une adresse email valide.";
  if (code === "domain_not_allowed") return `Le domaine ${domain || "email"} n'est pas autorisé pour cette inscription.`;
  if (code === "slot_not_found") return "Ce créneau n'est plus disponible.";
  if (code === "slot_full") return "Ce créneau est complet.";
  if (code === "already_registered") return "Cette adresse email est déjà inscrite sur ce créneau.";
  return "Inscription impossible.";
};

export async function POST(
  request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
  try {
    const { slotId } = await context.params;
    const body = await request.json().catch(() => null) as { participantName?: string; participantEmail?: string } | null;
    const participantName = body?.participantName || "";
    const participantEmail = normalizeEmail(body?.participantEmail || "");
    const supabase = getSupabaseAdminIfConfigured();

    const result = supabase
      ? await supabase.rpc("register_slot_participant", {
        p_slot_id: slotId,
        p_participant_name: participantName,
        p_participant_email: participantEmail,
      }).then(({ data, error }) => {
        if (error) throw error;
        return data as RegisterRpcResult;
      })
      : await registerSlotParticipantFromSql({ slotId, participantName, participantEmail });

    if (!result.ok || !result.registration) {
      return NextResponse.json({
        ok: false,
        code: result.code,
        message: messageForCode(result.code, result.domain),
        placesTaken: result.places_taken,
        capacity: result.capacity,
        participantName: result.participant_name,
      }, { status: result.code === "already_registered" ? 409 : 400 });
    }

    const slot = supabase ? await getCalendarSlot(supabase, slotId) : await getCalendarSlotFromSql(slotId);
    const calendar = slot ? {
      filename: `seance-${slot.slotDate}.ics`,
      content: buildSlotIcs(slot, {
        id: result.registration.id,
        participantEmail: result.registration.participant_email,
      }),
    } : null;

    return NextResponse.json({
      ok: true,
      registration: {
        id: result.registration.id,
        participantName: result.registration.participant_name,
      },
      calendar,
    });
  } catch (error) {
    console.error("Slot registration error:", error);
    return NextResponse.json({ ok: false, message: "Erreur lors de l'inscription." }, { status: 500 });
  }
}
