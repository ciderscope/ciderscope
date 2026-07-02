import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cancelOutlookSlotEvent,
  createOutlookSlotEvent,
  isOutlookGraphConfigured,
} from "./outlookGraph";
import {
  hasSlotSqlConfig,
  markOutlookCancellationDoneFromSql,
  markOutlookCancellationFailedFromSql,
  markOutlookInvitationFailedFromSql,
  markOutlookInvitationSentFromSql,
} from "./slotSql";
import { formatSlotDateLong } from "../slots/dates";
import { normalizeEmail } from "../slots/validation";

type OutlookSlot = {
  id: string;
  slotDate: string;
  sessionName?: string | null;
};

type OutlookRegistration = {
  id: string;
  slotId: string;
  participantName: string;
  participantEmail: string;
  outlookEventId?: string | null;
};

type OutlookActionResult =
  | { status: "sent"; eventId: string }
  | { status: "cancelled"; eventId: string }
  | { status: "skipped"; reason: string }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const truncateError = (message: string) => message.slice(0, 500);

const updateRegistration = async (
  supabase: SupabaseClient | null,
  registrationId: string,
  values: Record<string, unknown>
) => {
  if (!supabase) return false;
  const { error } = await supabase
    .from("slot_registrations")
    .update(values)
    .eq("id", registrationId);
  if (error) throw error;
  return true;
};

const markInvitationSent = async (
  supabase: SupabaseClient | null,
  registrationId: string,
  eventId: string
) => {
  const values = {
    outlook_invite_status: "sent",
    outlook_event_id: eventId,
    outlook_invite_sent_at: new Date().toISOString(),
    outlook_invite_due_at: null,
    outlook_invite_last_error: null,
  };

  if (await updateRegistration(supabase, registrationId, values)) return;
  if (hasSlotSqlConfig()) {
    await markOutlookInvitationSentFromSql({ registrationId, eventId });
  }
};

const markInvitationFailed = async (
  supabase: SupabaseClient | null,
  registrationId: string,
  message: string
) => {
  const values = {
    outlook_invite_status: "failed",
    outlook_invite_due_at: null,
    outlook_invite_last_error: truncateError(message),
  };

  if (await updateRegistration(supabase, registrationId, values)) return;
  if (hasSlotSqlConfig()) {
    await markOutlookInvitationFailedFromSql(registrationId, message);
  }
};

const markCancellationDone = async (
  supabase: SupabaseClient | null,
  registrationId: string
) => {
  const values = {
    outlook_invite_status: "cancelled",
    outlook_invite_due_at: null,
    outlook_invite_last_error: null,
  };

  if (await updateRegistration(supabase, registrationId, values)) return;
  if (hasSlotSqlConfig()) {
    await markOutlookCancellationDoneFromSql(registrationId);
  }
};

const markCancellationFailed = async (
  supabase: SupabaseClient | null,
  registrationId: string,
  message: string
) => {
  const values = {
    outlook_invite_status: "cancel_failed",
    outlook_invite_due_at: null,
    outlook_invite_last_error: truncateError(message),
  };

  if (await updateRegistration(supabase, registrationId, values)) return;
  if (hasSlotSqlConfig()) {
    await markOutlookCancellationFailedFromSql(registrationId, message);
  }
};

export const sendOutlookInvitationForRegistration = async ({
  supabase,
  slot,
  registration,
}: {
  supabase: SupabaseClient | null;
  slot: OutlookSlot;
  registration: OutlookRegistration;
}): Promise<OutlookActionResult> => {
  if (!isOutlookGraphConfigured()) {
    await markInvitationFailed(supabase, registration.id, "Microsoft Graph is not configured.").catch(markError => {
      console.error("Outlook invitation status update error:", markError);
    });
    return { status: "not_configured" };
  }

  try {
    const event = await createOutlookSlotEvent({
      slotId: slot.id,
      registrationId: registration.id,
      slotDate: slot.slotDate,
      sessionName: slot.sessionName,
      attendees: [{
        name: registration.participantName,
        email: normalizeEmail(registration.participantEmail),
      }],
    });
    await markInvitationSent(supabase, registration.id, event.id);
    return { status: "sent", eventId: event.id };
  } catch (error) {
    const message = errorMessage(error);
    await markInvitationFailed(supabase, registration.id, message).catch(markError => {
      console.error("Outlook invitation status update error:", markError);
    });
    return { status: "failed", error: message };
  }
};

export const cancelOutlookInvitationForRegistration = async ({
  supabase,
  registration,
  slotDate,
}: {
  supabase: SupabaseClient | null;
  registration: Pick<OutlookRegistration, "id" | "outlookEventId">;
  slotDate?: string | null;
}): Promise<OutlookActionResult> => {
  const eventId = registration.outlookEventId;
  if (!eventId) {
    await markCancellationDone(supabase, registration.id);
    return { status: "skipped", reason: "no_outlook_event" };
  }
  if (!isOutlookGraphConfigured()) {
    await markCancellationFailed(supabase, registration.id, "Microsoft Graph is not configured.").catch(markError => {
      console.error("Outlook cancellation status update error:", markError);
    });
    return { status: "not_configured" };
  }

  try {
    const dateLabel = slotDate ? ` du ${formatSlotDateLong(slotDate)}` : "";
    await cancelOutlookSlotEvent(eventId, `Votre inscription au creneau Senso${dateLabel} est annulee.`);
    await markCancellationDone(supabase, registration.id);
    return { status: "cancelled", eventId };
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes("Microsoft Graph 404")) {
      await markCancellationDone(supabase, registration.id);
      return { status: "cancelled", eventId };
    }

    await markCancellationFailed(supabase, registration.id, message).catch(markError => {
      console.error("Outlook cancellation status update error:", markError);
    });
    return { status: "failed", error: message };
  }
};

export const cancelOutlookInvitationsForRegistrations = async ({
  supabase,
  registrations,
  slotDate,
}: {
  supabase: SupabaseClient | null;
  registrations: Array<Pick<OutlookRegistration, "id" | "outlookEventId">>;
  slotDate?: string | null;
}) => {
  const results = [];
  const seenEvents = new Set<string>();

  for (const registration of registrations) {
    const eventId = registration.outlookEventId || "";
    if (eventId && seenEvents.has(eventId)) {
      await markCancellationDone(supabase, registration.id);
      results.push({ status: "skipped" as const, reason: "duplicate_event" });
      continue;
    }
    if (eventId) seenEvents.add(eventId);
    results.push(await cancelOutlookInvitationForRegistration({ supabase, registration, slotDate }));
  }

  return {
    cancelled: results.filter(result => result.status === "cancelled").length,
    failed: results.filter(result => result.status === "failed").length,
    skipped: results.filter(result => result.status === "skipped").length,
    notConfigured: results.filter(result => result.status === "not_configured").length,
  };
};
