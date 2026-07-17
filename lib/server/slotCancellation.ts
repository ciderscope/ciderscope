import type { SupabaseClient } from "@supabase/supabase-js";
import { getCalendarSlot } from "./slotData";
import {
  cancelSlotRegistrationFromSql,
  getCalendarSlotFromSql,
  type CancelSlotRegistrationResult,
} from "./slotSql";
import {
  cancelOutlookInvitationForRegistration,
  confirmOutlookInvitationForRegistration,
} from "./outlookInvitations";

const cancelSlotRegistrationFromSupabase = async ({
  supabase,
  slotId,
  registrationId,
}: {
  supabase: SupabaseClient;
  slotId: string;
  registrationId: string;
}): Promise<CancelSlotRegistrationResult> => {
  const { data: registration, error: registrationError } = await supabase
    .from("slot_registrations")
    .select("participant_email")
    .eq("id", registrationId)
    .eq("slot_id", slotId)
    .eq("status", "active")
    .maybeSingle();

  if (registrationError) throw registrationError;
  if (!registration) return { ok: false, code: "registration_not_found" };

  const { data, error } = await supabase.rpc("cancel_slot_registration", {
    p_slot_id: slotId,
    p_participant_email: (registration as { participant_email: string }).participant_email,
  });
  if (error) throw error;
  return data as CancelSlotRegistrationResult;
};

export const cancelSlotRegistrationWithInvitations = async ({
  supabase,
  slotId,
  registrationId,
}: {
  supabase: SupabaseClient | null;
  slotId: string;
  registrationId: string;
}) => {
  const slot = supabase
    ? await getCalendarSlot(supabase, slotId)
    : await getCalendarSlotFromSql(slotId);

  if (!slot) {
    return {
      result: { ok: false, code: "slot_not_found" } satisfies CancelSlotRegistrationResult,
      outlookCancellation: null,
      outlookPromotion: null,
    };
  }

  const result = supabase
    ? await cancelSlotRegistrationFromSupabase({ supabase, slotId, registrationId })
    : await cancelSlotRegistrationFromSql({ slotId, registrationId });

  if (!result.ok || !result.registration) {
    return { result, outlookCancellation: null, outlookPromotion: null };
  }

  const outlookCancellation = await cancelOutlookInvitationForRegistration({
    supabase,
    registration: {
      id: result.registration.id,
      outlookEventId: result.registration.outlook_event_id || null,
    },
    slotDate: slot.slotDate,
  });

  const promoted = result.promoted_registration;
  const outlookPromotion = promoted
    ? await confirmOutlookInvitationForRegistration({
      supabase,
      slot,
      registration: {
        id: promoted.id,
        slotId: promoted.slot_id,
        participantName: promoted.participant_name,
        participantEmail: promoted.participant_email,
        registrationStatus: "confirmed",
        outlookEventId: promoted.outlook_event_id || null,
      },
    })
    : null;

  return { result, outlookCancellation, outlookPromotion };
};
