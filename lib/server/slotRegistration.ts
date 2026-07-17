import type { SupabaseClient } from "@supabase/supabase-js";
import { getCalendarSlot } from "./slotData";
import { getCalendarSlotFromSql, registerSlotParticipantFromSql } from "./slotSql";
import { sendOutlookInvitationForRegistration } from "./outlookInvitations";

export type RegisterSlotResult = {
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
export const registrationMessageForCode = (code?: string, domain?: string) => {
  if (code === "invalid_name" || code === "invalid_email") return "Veuillez saisir une adresse email valide.";
  if (code === "domain_not_allowed") return `Le domaine ${domain || "email"} n'est pas autorisé pour cette inscription.`;
  if (code === "slot_not_found") return "Ce créneau n'est plus disponible.";
  if (code === "slot_full") return "Ce créneau est complet.";
  if (code === "already_registered") return "Cette adresse email est déjà inscrite sur ce créneau.";
  return "Inscription impossible.";
};

export const registerSlotWithInvitation = async ({
  supabase,
  slotId,
  participantName,
  participantEmail,
}: {
  supabase: SupabaseClient | null;
  slotId: string;
  participantName: string;
  participantEmail: string;
}) => {
  const result = supabase
    ? await supabase.rpc("register_slot_participant", {
      p_slot_id: slotId,
      p_participant_name: participantName,
      p_participant_email: participantEmail,
    }).then(({ data, error }) => {
      if (error) throw error;
      return data as RegisterSlotResult;
    })
    : await registerSlotParticipantFromSql({ slotId, participantName, participantEmail });

  if (!result.ok || !result.registration) return { result, outlookInvitation: null };

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

  return { result, outlookInvitation };
};
