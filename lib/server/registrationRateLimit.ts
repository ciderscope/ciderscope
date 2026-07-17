import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeSlotRegistrationQuotaFromSql } from "./slotSql";

export const SLOT_REGISTRATION_DAILY_LIMIT = 20;
export const SLOT_REGISTRATION_BATCH_LIMIT = 20;

export const consumeSlotRegistrationQuota = async ({
  supabase,
  participantEmail,
  requested,
}: {
  supabase: SupabaseClient | null;
  participantEmail: string;
  requested: number;
}) => {
  if (supabase) {
    const { data, error } = await supabase.rpc("consume_slot_registration_quota", {
      p_participant_email: participantEmail,
      p_requested: requested,
      p_daily_limit: SLOT_REGISTRATION_DAILY_LIMIT,
    });
    if (error) throw error;
    return data === true;
  }
  return consumeSlotRegistrationQuotaFromSql({
    participantEmail,
    requested,
    dailyLimit: SLOT_REGISTRATION_DAILY_LIMIT,
  });
};
