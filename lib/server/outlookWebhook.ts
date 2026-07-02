import type { SupabaseClient } from "@supabase/supabase-js";
import { getCalendarSlot } from "./slotData";
import {
  createOutlookEventSubscription,
  getOutlookSlotEvent,
  isOutlookGraphConfigured,
  listGraphSubscriptions,
  outlookEventSubscriptionResource,
  renewGraphSubscription,
  type GraphEvent,
  type GraphSubscription,
} from "./outlookGraph";
import { confirmOutlookInvitationForRegistration } from "./outlookInvitations";
import {
  getCalendarSlotFromSql,
  handleOutlookAttendeeDeclineFromSql,
  hasSlotSqlConfig,
} from "./slotSql";

const OUTLOOK_WEBHOOK_PATH = "/api/outlook/webhook";
const OUTLOOK_SUBSCRIPTION_RENEWAL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const OUTLOOK_SUBSCRIPTION_LIFETIME_MS = 6 * 24 * 60 * 60 * 1000;

type RegistrationPayload = {
  id: string;
  slot_id: string;
  participant_name: string;
  participant_email: string;
  registration_status?: "confirmed" | "waitlist";
  outlook_event_id?: string | null;
};

type OutlookDeclineRpcResult = {
  ok: boolean;
  code?: string;
  registration?: RegistrationPayload & { cancelled_at: string };
  promoted_registration?: RegistrationPayload | null;
};

type OutlookChangeNotification = {
  subscriptionId?: string;
  subscriptionExpirationDateTime?: string;
  changeType?: string;
  resource?: string;
  clientState?: string;
  resourceData?: {
    id?: string;
    "@odata.id"?: string;
  };
};

type OutlookChangeNotificationPayload = {
  value?: OutlookChangeNotification[];
};

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeResource = (resource: string) => resource.replace(/^\/+/, "").toLowerCase();

const subscriptionExpirationDate = () => (
  new Date(Date.now() + OUTLOOK_SUBSCRIPTION_LIFETIME_MS).toISOString()
);

export const getOutlookWebhookClientState = () => (
  process.env.OUTLOOK_WEBHOOK_CLIENT_STATE || process.env.CRON_SECRET || ""
).trim();

export const getOutlookWebhookNotificationUrl = () => {
  const explicitUrl = (process.env.OUTLOOK_WEBHOOK_NOTIFICATION_URL || "").trim();
  if (explicitUrl) return explicitUrl;

  const appBaseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (appBaseUrl) return `${stripTrailingSlash(appBaseUrl)}${OUTLOOK_WEBHOOK_PATH}`;

  return "";
};

export const isOutlookWebhookConfigured = () => (
  isOutlookGraphConfigured() &&
  Boolean(getOutlookWebhookNotificationUrl()) &&
  Boolean(getOutlookWebhookClientState())
);

const findMatchingSubscription = (subscriptions: GraphSubscription[], notificationUrl: string) => {
  const expectedResource = normalizeResource(outlookEventSubscriptionResource());
  return subscriptions.find(subscription => (
    normalizeResource(subscription.resource) === expectedResource &&
    stripTrailingSlash(subscription.notificationUrl) === stripTrailingSlash(notificationUrl)
  ));
};

export const ensureOutlookWebhookSubscription = async () => {
  const notificationUrl = getOutlookWebhookNotificationUrl();
  const clientState = getOutlookWebhookClientState();

  if (!isOutlookGraphConfigured()) {
    return { status: "not_configured" as const, reason: "graph" };
  }
  if (!notificationUrl) {
    return { status: "not_configured" as const, reason: "notification_url" };
  }
  if (!clientState) {
    return { status: "not_configured" as const, reason: "client_state" };
  }

  const subscriptions = await listGraphSubscriptions();
  const existing = findMatchingSubscription(subscriptions, notificationUrl);
  const nextExpirationDateTime = subscriptionExpirationDate();

  if (existing) {
    const expiresAt = Date.parse(existing.expirationDateTime);
    if (Number.isFinite(expiresAt) && expiresAt > Date.now() + OUTLOOK_SUBSCRIPTION_RENEWAL_WINDOW_MS) {
      return { status: "active" as const, subscription: existing };
    }

    const subscription = await renewGraphSubscription(existing.id, nextExpirationDateTime);
    return { status: "renewed" as const, subscription };
  }

  const subscription = await createOutlookEventSubscription({
    notificationUrl,
    clientState,
    expirationDateTime: nextExpirationDateTime,
  });

  return { status: "created" as const, subscription };
};

export const isValidOutlookWebhookClientState = (clientState?: string | null) => {
  const expected = getOutlookWebhookClientState();
  return Boolean(expected && clientState && clientState === expected);
};

const extractEventId = (notification: OutlookChangeNotification) => {
  if (notification.resourceData?.id) return notification.resourceData.id;

  const resource = notification.resource || notification.resourceData?.["@odata.id"] || "";
  const match = resource.match(/\/events\/([^/?#]+)/i) || resource.match(/events\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
};

const getDeclinedAttendee = (event: GraphEvent) => {
  return event.attendees?.find(attendee => (
    (attendee.status?.response || "").toLowerCase() === "declined"
  )) || null;
};

const handleOutlookDecline = async (
  supabase: SupabaseClient | null,
  eventId: string
) => {
  const result = supabase
    ? await supabase.rpc("handle_outlook_attendee_decline", {
      p_outlook_event_id: eventId,
    }).then(({ data, error }) => {
      if (error) throw error;
      return data as OutlookDeclineRpcResult;
    })
    : hasSlotSqlConfig()
      ? await handleOutlookAttendeeDeclineFromSql(eventId)
      : { ok: false, code: "database_not_configured" };

  if (!result.ok || !result.promoted_registration) return { result, promotion: null };

  const slotId = result.promoted_registration.slot_id;
  const slot = supabase ? await getCalendarSlot(supabase, slotId) : await getCalendarSlotFromSql(slotId);
  const promotion = slot
    ? await confirmOutlookInvitationForRegistration({
      supabase,
      slot,
      registration: {
        id: result.promoted_registration.id,
        slotId,
        participantName: result.promoted_registration.participant_name,
        participantEmail: result.promoted_registration.participant_email,
        registrationStatus: "confirmed",
        outlookEventId: result.promoted_registration.outlook_event_id || null,
      },
    })
    : null;

  return { result, promotion };
};

export const processOutlookWebhookPayload = async (
  supabase: SupabaseClient | null,
  payload: OutlookChangeNotificationPayload
) => {
  const notifications = payload.value || [];
  const processed = [];

  for (const notification of notifications) {
    if (!isValidOutlookWebhookClientState(notification.clientState)) {
      processed.push({ status: "invalid_client_state" as const });
      continue;
    }

    const eventId = extractEventId(notification);
    if (!eventId) {
      processed.push({ status: "skipped" as const, reason: "missing_event_id" });
      continue;
    }

    if ((notification.changeType || "").toLowerCase() === "deleted") {
      processed.push({ status: "skipped" as const, eventId, reason: "deleted_event" });
      continue;
    }

    const event = await getOutlookSlotEvent(eventId);
    if (event.isCancelled) {
      processed.push({ status: "skipped" as const, eventId, reason: "event_cancelled" });
      continue;
    }

    const declinedAttendee = getDeclinedAttendee(event);
    if (!declinedAttendee) {
      processed.push({ status: "skipped" as const, eventId, reason: "no_decline" });
      continue;
    }

    const decline = await handleOutlookDecline(supabase, eventId);
    processed.push({
      status: decline.result.ok ? "cancelled" as const : "failed" as const,
      eventId,
      code: decline.result.code,
      promoted: Boolean(decline.result.promoted_registration),
      promotionStatus: decline.promotion?.status || null,
    });
  }

  return {
    received: notifications.length,
    processed,
  };
};
