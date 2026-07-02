import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClaimedOutlookCancellation,
  ClaimedOutlookInvitation,
} from "./outlookInvitationTypes";
import {
  cancelOutlookSlotEvent,
  createOutlookSlotEvent,
  getOutlookBatchDelayMinutes,
  getOutlookSlotEvent,
  isOutlookGraphConfigured,
  updateOutlookSlotAttendees,
  type GraphAttendee,
} from "./outlookGraph";
import { getSupabaseAdminIfConfigured } from "./supabaseAdmin";
import {
  claimDueOutlookCancellationsFromSql,
  claimDueOutlookInvitationsFromSql,
  getSlotOutlookEventIdFromSql,
  hasSlotSqlConfig,
  markOutlookCancellationsDoneFromSql,
  markOutlookCancellationsFailedFromSql,
  markOutlookInvitationsFailedFromSql,
  markOutlookInvitationsSentFromSql,
} from "./slotSql";
import { formatSlotDateLong } from "../slots/dates";
import { normalizeEmail } from "../slots/validation";

type ProcessSummary = {
  configured: boolean;
  claimed: number;
  sent: number;
  failed: number;
  errors: string[];
};

type CancellationSummary = {
  configured: boolean;
  claimed: number;
  cancelled: number;
  failed: number;
  errors: string[];
};

const asStringOrNull = (value: unknown) => typeof value === "string" && value ? value : null;

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const mapClaimedInvitation = (value: unknown): ClaimedOutlookInvitation => {
  const item = value as Record<string, unknown>;
  const slot = item.slot as Record<string, unknown>;
  return {
    id: String(item.id),
    slotId: String(item.slotId),
    participantName: String(item.participantName),
    participantEmail: String(item.participantEmail),
    outlookEventId: asStringOrNull(item.outlookEventId),
    attempts: Number(item.attempts || 0),
    slot: {
      id: String(slot.id),
      slotDate: String(slot.slotDate),
      sessionName: String(slot.sessionName || ""),
      outlookEventId: asStringOrNull(slot.outlookEventId),
    },
  };
};

const mapClaimedCancellation = (value: unknown): ClaimedOutlookCancellation => {
  const item = value as Record<string, unknown>;
  const slot = item.slot as Record<string, unknown>;
  return {
    id: String(item.id),
    slotId: String(item.slotId),
    participantName: String(item.participantName),
    participantEmail: String(item.participantEmail),
    outlookEventId: String(item.outlookEventId),
    attempts: Number(item.attempts || 0),
    slot: {
      id: String(slot.id),
      slotDate: String(slot.slotDate),
      sessionName: String(slot.sessionName || ""),
      outlookEventId: asStringOrNull(slot.outlookEventId),
    },
  };
};

const parseArray = <T>(value: unknown, mapper: (item: unknown) => T) => {
  if (!Array.isArray(value)) return [];
  return value.map(mapper);
};

const claimInvitations = async (supabase: SupabaseClient | null, limit: number) => {
  if (supabase) {
    const { data, error } = await supabase.rpc("claim_due_outlook_invitations", { p_limit: limit });
    if (error) throw error;
    return parseArray(data, mapClaimedInvitation);
  }
  if (!hasSlotSqlConfig()) return [];
  return claimDueOutlookInvitationsFromSql(limit);
};

const claimCancellations = async (supabase: SupabaseClient | null, limit: number) => {
  if (supabase) {
    const { data, error } = await supabase.rpc("claim_due_outlook_cancellations", { p_limit: limit });
    if (error) throw error;
    return parseArray(data, mapClaimedCancellation);
  }
  if (!hasSlotSqlConfig()) return [];
  return claimDueOutlookCancellationsFromSql(limit);
};

const retryAtFor = (items: Array<{ attempts: number }>) => {
  const attempts = Math.max(1, ...items.map(item => item.attempts || 1));
  const minutes = Math.min(360, Math.max(15, attempts * 15));
  return new Date(Date.now() + minutes * 60_000).toISOString();
};

const markInvitationsSent = async (
  supabase: SupabaseClient | null,
  registrationIds: string[],
  slotId: string,
  eventId: string
) => {
  if (registrationIds.length === 0) return;

  if (supabase) {
    const { error: slotError } = await supabase
      .from("session_slots")
      .update({
        outlook_event_id: eventId,
        outlook_event_created_at: new Date().toISOString(),
        outlook_event_updated_at: new Date().toISOString(),
      })
      .eq("id", slotId);
    if (slotError) throw slotError;

    const { error: eventError } = await supabase
      .from("slot_registrations")
      .update({
        outlook_event_id: eventId,
        outlook_invite_last_error: null,
      })
      .in("id", registrationIds);
    if (eventError) throw eventError;

    const { error: activeError } = await supabase
      .from("slot_registrations")
      .update({
        outlook_invite_status: "sent",
        outlook_invite_sent_at: new Date().toISOString(),
      })
      .in("id", registrationIds)
      .eq("status", "active");
    if (activeError) throw activeError;

    const { error } = await supabase
      .from("slot_registrations")
      .update({
        outlook_invite_status: "cancel_pending",
        outlook_invite_due_at: new Date().toISOString(),
      })
      .in("id", registrationIds)
      .eq("status", "cancelled");
    if (error) throw error;
    return;
  }

  await markOutlookInvitationsSentFromSql({ registrationIds, slotId, eventId });
};

const markInvitationsFailed = async (
  supabase: SupabaseClient | null,
  items: ClaimedOutlookInvitation[],
  message: string
) => {
  const registrationIds = items.map(item => item.id);
  if (registrationIds.length === 0) return;

  if (supabase) {
    const { error } = await supabase
      .from("slot_registrations")
      .update({
        outlook_invite_status: "failed",
        outlook_invite_due_at: retryAtFor(items),
        outlook_invite_last_error: message.slice(0, 500),
      })
      .in("id", registrationIds);
    if (error) throw error;
    return;
  }

  await markOutlookInvitationsFailedFromSql(registrationIds, message);
};

const markCancellationsDone = async (
  supabase: SupabaseClient | null,
  registrationIds: string[]
) => {
  if (registrationIds.length === 0) return;

  if (supabase) {
    const { error } = await supabase
      .from("slot_registrations")
      .update({
        outlook_invite_status: "cancelled",
        outlook_invite_last_error: null,
      })
      .in("id", registrationIds);
    if (error) throw error;
    return;
  }

  await markOutlookCancellationsDoneFromSql(registrationIds);
};

const markCancellationsFailed = async (
  supabase: SupabaseClient | null,
  items: ClaimedOutlookCancellation[],
  message: string
) => {
  const registrationIds = items.map(item => item.id);
  if (registrationIds.length === 0) return;

  if (supabase) {
    const { error } = await supabase
      .from("slot_registrations")
      .update({
        outlook_invite_status: "cancel_failed",
        outlook_invite_due_at: retryAtFor(items),
        outlook_invite_last_error: message.slice(0, 500),
      })
      .in("id", registrationIds);
    if (error) throw error;
    return;
  }

  await markOutlookCancellationsFailedFromSql(registrationIds, message);
};

const groupBy = <T>(items: T[], keyFor: (item: T) => string) => {
  const grouped = new Map<string, T[]>();
  items.forEach(item => {
    const key = keyFor(item);
    grouped.set(key, [...(grouped.get(key) || []), item]);
  });
  return grouped;
};

const attendeeKey = (attendee: GraphAttendee) => normalizeEmail(attendee.emailAddress.address);

const mergeAttendees = (
  existing: GraphAttendee[],
  additions: ClaimedOutlookInvitation[]
) => {
  const byEmail = new Map<string, GraphAttendee>();
  existing.forEach(attendee => byEmail.set(attendeeKey(attendee), attendee));
  additions.forEach(addition => {
    const email = normalizeEmail(addition.participantEmail);
    byEmail.set(email, {
      emailAddress: {
        address: email,
        name: addition.participantName || email,
      },
      type: "required",
    });
  });
  return Array.from(byEmail.values());
};

const removeAttendees = (
  existing: GraphAttendee[],
  cancellations: ClaimedOutlookCancellation[]
) => {
  const cancelled = new Set(cancellations.map(item => normalizeEmail(item.participantEmail)));
  return existing.filter(attendee => !cancelled.has(attendeeKey(attendee)));
};

export const processDueOutlookInvitations = async (limit = 100): Promise<ProcessSummary> => {
  const summary: ProcessSummary = { configured: isOutlookGraphConfigured(), claimed: 0, sent: 0, failed: 0, errors: [] };
  if (!summary.configured) return summary;

  const supabase = getSupabaseAdminIfConfigured();
  const claimed = await claimInvitations(supabase, limit);
  summary.claimed = claimed.length;

  const bySlot = groupBy(claimed, item => item.slotId);
  for (const items of bySlot.values()) {
    const slot = items[0].slot;
    const eventId = slot.outlookEventId || items.find(item => item.outlookEventId)?.outlookEventId || null;
    const registrationIds = items.map(item => item.id);

    try {
      if (eventId) {
        const event = await getOutlookSlotEvent(eventId);
        const attendees = mergeAttendees(event.attendees || [], items);
        await updateOutlookSlotAttendees(eventId, attendees);
        await markInvitationsSent(supabase, registrationIds, slot.id, eventId);
        summary.sent += items.length;
        continue;
      }

      const event = await createOutlookSlotEvent({
        slotId: slot.id,
        slotDate: slot.slotDate,
        sessionName: slot.sessionName,
        attendees: items.map(item => ({
          name: item.participantName,
          email: normalizeEmail(item.participantEmail),
        })),
      });
      await markInvitationsSent(supabase, registrationIds, slot.id, event.id);
      summary.sent += items.length;
    } catch (error) {
      const message = errorMessage(error);
      summary.failed += items.length;
      summary.errors.push(message);
      await markInvitationsFailed(supabase, items, message).catch(updateError => {
        summary.errors.push(errorMessage(updateError));
      });
    }
  }

  return summary;
};

export const processDueOutlookCancellations = async (limit = 100): Promise<CancellationSummary> => {
  const summary: CancellationSummary = { configured: isOutlookGraphConfigured(), claimed: 0, cancelled: 0, failed: 0, errors: [] };
  if (!summary.configured) return summary;

  const supabase = getSupabaseAdminIfConfigured();
  const claimed = await claimCancellations(supabase, limit);
  summary.claimed = claimed.length;

  const byEvent = groupBy(claimed, item => item.outlookEventId);
  for (const items of byEvent.values()) {
    const eventId = items[0].outlookEventId;
    const registrationIds = items.map(item => item.id);

    try {
      const event = await getOutlookSlotEvent(eventId);
      const attendees = removeAttendees(event.attendees || [], items);
      await updateOutlookSlotAttendees(eventId, attendees);
      await markCancellationsDone(supabase, registrationIds);
      summary.cancelled += items.length;
    } catch (error) {
      const message = errorMessage(error);
      if (message.includes("Microsoft Graph 404")) {
        await markCancellationsDone(supabase, registrationIds);
        summary.cancelled += items.length;
        continue;
      }

      summary.failed += items.length;
      summary.errors.push(message);
      await markCancellationsFailed(supabase, items, message).catch(updateError => {
        summary.errors.push(errorMessage(updateError));
      });
    }
  }

  return summary;
};

export const getSlotOutlookEventId = async (slotId: string, supabase: SupabaseClient | null) => {
  if (supabase) {
    const { data, error } = await supabase
      .from("session_slots")
      .select("outlook_event_id")
      .eq("id", slotId)
      .maybeSingle();
    if (error) throw error;
    return ((data as { outlook_event_id?: string | null } | null)?.outlook_event_id) || null;
  }
  if (!hasSlotSqlConfig()) return null;
  return getSlotOutlookEventIdFromSql(slotId);
};

export const cancelWholeOutlookSlotEvent = async (eventId: string, slotDate: string) => {
  if (!isOutlookGraphConfigured()) return { attempted: false };
  await cancelOutlookSlotEvent(
    eventId,
    `Le creneau Senso du ${formatSlotDateLong(slotDate)} est annule.`
  );
  return { attempted: true };
};

export const getOutlookQueuedResponse = () => ({
  status: "queued" as const,
  batchDelayMinutes: getOutlookBatchDelayMinutes(),
});
