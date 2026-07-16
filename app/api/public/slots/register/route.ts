import { NextResponse } from "next/server";
import { getCalendarSlot } from "../../../../../lib/server/slotData";
import { getSupabaseAdminIfConfigured } from "../../../../../lib/server/supabaseAdmin";
import { getCalendarSlotFromSql, registerSlotParticipantFromSql } from "../../../../../lib/server/slotSql";
import { sendOutlookInvitationForRegistration } from "../../../../../lib/server/outlookInvitations";
import { normalizeEmail } from "../../../../../lib/slots/validation";

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
    registration_status?: "confirmed" | "waitlist";
    created_at: string;
    token: string;
    outlook_event_id?: string | null;
  };
};

const messageForCode = (code?: string, domain?: string) => {
  if (code === "invalid_name") return "Veuillez saisir une adresse email valide.";
  if (code === "invalid_email") return "Veuillez saisir une adresse email valide.";
  if (code === "domain_not_allowed") return `Le domaine ${domain || "email"} n'est pas autorisé pour cette inscription.`;
  if (code === "slot_not_found") return "Ce créneau n'est plus disponible.";
  if (code === "slot_full") return "Ce créneau est complet.";
  if (code === "already_registered") return "Cette adresse email est déjà inscrite sur ce créneau.";
  return "Inscription impossible.";
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { slotIds?: string[]; participantEmail?: string } | null;
    const slotIds = Array.from(new Set((body?.slotIds || []).filter(slotId => typeof slotId === "string" && slotId.trim())));
    const participantEmail = normalizeEmail(body?.participantEmail || "");
    const participantName = participantEmail;

    if (slotIds.length === 0) {
      return NextResponse.json({ ok: false, message: "Sélectionnez au moins un créneau." }, { status: 400 });
    }

    const supabase = getSupabaseAdminIfConfigured();
    const results = [];

    for (const slotId of slotIds) {
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
        results.push({
          ok: false,
          slotId,
          code: result.code,
          message: messageForCode(result.code, result.domain),
          placesTaken: result.places_taken,
          capacity: result.capacity,
          participantName: result.participant_name,
        });
        continue;
      }

      const slot = supabase ? await getCalendarSlot(supabase, slotId) : await getCalendarSlotFromSql(slotId);
      const outlookInvitation = slot
        ? await sendOutlookInvitationForRegistration({
          supabase,
          slot,
          registration: {
            id: result.registration.id,
            slotId: result.registration.slot_id,
            participantName: result.registration.participant_name,
            participantEmail: result.registration.participant_email,
            registrationStatus: result.registration.registration_status || "confirmed",
            outlookEventId: result.registration.outlook_event_id || null,
          },
        })
        : { status: "failed" as const, error: "Slot not found after registration." };

      results.push({
        ok: true,
        slotId,
        registration: {
          id: result.registration.id,
          participantName: result.registration.participant_name,
          registrationStatus: result.registration.registration_status || "confirmed",
        },
        placesTaken: result.places_taken,
        capacity: result.capacity,
        outlookInvitation,
      });
    }

    const succeeded = results.filter(result => result.ok).length;
    const failed = results.length - succeeded;

    return NextResponse.json({
      ok: succeeded > 0 && failed === 0,
      partialOk: succeeded > 0 && failed > 0,
      succeeded,
      failed,
      results,
    }, { status: succeeded > 0 ? 200 : 400 });
  } catch (error) {
    console.error("Batch slot registration error:", error);
    return NextResponse.json({ ok: false, message: "Erreur lors de l'inscription." }, { status: 500 });
  }
}
