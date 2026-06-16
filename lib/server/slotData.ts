import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminSlotListItem, SlotListItem } from "../../types/slots";

type SlotRow = {
  id: string;
  slot_date: string;
  capacity: number;
  session_id: string | null;
  session_name: string;
  created_at: string;
};

type RegistrationRow = {
  id: string;
  slot_id: string;
  participant_name: string;
  participant_email: string;
  created_at: string;
};

export type CalendarSlot = {
  id: string;
  slotDate: string;
  sessionName: string;
};

type ListSlotOptions = {
  start?: string | null;
  end?: string | null;
  admin?: boolean;
};

export const listSlots = async (
  supabase: SupabaseClient,
  { start, end, admin = false }: ListSlotOptions = {}
): Promise<Array<SlotListItem | AdminSlotListItem>> => {
  let query = supabase
    .from("session_slots")
    .select("id, slot_date, capacity, session_id, session_name, created_at")
    .is("deleted_at", null)
    .order("slot_date", { ascending: true });

  if (start) query = query.gte("slot_date", start);
  if (end) query = query.lte("slot_date", end);

  const { data: slots, error: slotsError } = await query;
  if (slotsError) throw slotsError;

  const slotRows = (slots || []) as SlotRow[];
  if (slotRows.length === 0) return [];

  const slotIds = slotRows.map(slot => slot.id);
  const { data: registrations, error: registrationsError } = await supabase
    .from("slot_registrations")
    .select("id, slot_id, participant_name, participant_email, created_at")
    .eq("status", "active")
    .in("slot_id", slotIds)
    .order("created_at", { ascending: true });

  if (registrationsError) throw registrationsError;

  const registrationsBySlot = new Map<string, RegistrationRow[]>();
  ((registrations || []) as RegistrationRow[]).forEach(registration => {
    const list = registrationsBySlot.get(registration.slot_id) || [];
    list.push(registration);
    registrationsBySlot.set(registration.slot_id, list);
  });

  return slotRows.map(slot => {
    const participants = registrationsBySlot.get(slot.id) || [];
    const base = {
      id: slot.id,
      slotDate: slot.slot_date,
      capacity: slot.capacity,
      sessionId: slot.session_id,
      sessionName: slot.session_name,
      placesTaken: participants.length,
    };

    if (admin) {
      return {
        ...base,
        createdAt: slot.created_at,
        participants: participants.map(participant => ({
          id: participant.id,
          participantName: participant.participant_name,
          participantEmail: participant.participant_email,
          createdAt: participant.created_at,
        })),
      } satisfies AdminSlotListItem;
    }

    return {
      ...base,
      participants: participants.map(participant => ({
        id: participant.id,
        participantName: participant.participant_name,
      })),
    } satisfies SlotListItem;
  });
};

export const getCalendarSlot = async (supabase: SupabaseClient, slotId: string): Promise<CalendarSlot | null> => {
  const { data, error } = await supabase
    .from("session_slots")
    .select("id, slot_date, session_name")
    .eq("id", slotId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as { id: string; slot_date: string; session_name: string };
  return {
    id: row.id,
    slotDate: row.slot_date,
    sessionName: row.session_name,
  };
};
