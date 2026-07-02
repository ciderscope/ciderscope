import {
  formatSlotDateLong,
  SLOT_END_TIME,
  SLOT_LOCATION,
  SLOT_START_TIME,
  SLOT_TIME_LABEL,
} from "../slots/dates";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const OUTLOOK_TIMEZONE = "Romance Standard Time";
const DEFAULT_ORGANIZER_EMAIL = "lucas.semaan@ifpc.eu";
const DEFAULT_BATCH_DELAY_MINUTES = 15;
const OUTLOOK_REMINDER_MINUTES_BEFORE_START = 24 * 60;

type AccessToken = {
  token: string;
  expiresAt: number;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type GraphAttendee = {
  emailAddress: {
    address: string;
    name?: string;
  };
  type: "required";
};

export type GraphEvent = {
  id: string;
  attendees?: GraphAttendee[];
  webLink?: string;
};

export type OutlookSlotEventInput = {
  slotId: string;
  slotDate: string;
  sessionName?: string | null;
  attendees: Array<{
    name: string;
    email: string;
  }>;
};

let cachedToken: AccessToken | null = null;

const requiredConfig = () => ({
  tenantId: process.env.MICROSOFT_GRAPH_TENANT_ID || "",
  clientId: process.env.MICROSOFT_GRAPH_CLIENT_ID || "",
  clientSecret: process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "",
});

export const getOutlookOrganizerEmail = () => (
  process.env.OUTLOOK_ORGANIZER_EMAIL || DEFAULT_ORGANIZER_EMAIL
).trim();

export const getOutlookBatchDelayMinutes = () => {
  const raw = Number.parseInt(process.env.OUTLOOK_INVITE_BATCH_DELAY_MINUTES || "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BATCH_DELAY_MINUTES;
};

export const isOutlookGraphConfigured = () => {
  const config = requiredConfig();
  return Boolean(config.tenantId && config.clientId && config.clientSecret && getOutlookOrganizerEmail());
};

const toLocalDateTime = (slotDate: string, time: string) => `${slotDate}T${time}:00`;

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const slotTitle = (slot: Pick<OutlookSlotEventInput, "slotDate" | "sessionName">) => {
  const label = slot.sessionName?.trim() || formatSlotDateLong(slot.slotDate);
  return `Seance d'analyse sensorielle - ${label}`;
};

const buildOutlookBody = (slot: Pick<OutlookSlotEventInput, "slotDate" | "sessionName">) => {
  const dateLabel = formatSlotDateLong(slot.slotDate);
  const sessionLine = slot.sessionName?.trim()
    ? `<li><strong>Seance :</strong> ${escapeHtml(slot.sessionName.trim())}</li>`
    : "";

  return [
    "<p>Bonjour,</p>",
    "<p>Votre session d'analyse sensorielle est confirmee.</p>",
    "<ul>",
    `<li><strong>Date :</strong> ${escapeHtml(dateLabel)}</li>`,
    `<li><strong>Horaire :</strong> ${SLOT_TIME_LABEL}</li>`,
    `<li><strong>Lieu :</strong> ${escapeHtml(SLOT_LOCATION)}</li>`,
    sessionLine,
    "</ul>",
    "<p>Un rappel Outlook automatique est configure 24 heures avant le creneau.</p>",
    "<p>Merci de confirmer votre presence depuis Outlook.</p>",
  ].filter(Boolean).join("");
};

const normalizeGraphAttendee = (attendee: { name: string; email: string }): GraphAttendee => ({
  emailAddress: {
    address: attendee.email,
    name: attendee.name || attendee.email,
  },
  type: "required",
});

export const buildOutlookEventPayload = (slot: OutlookSlotEventInput) => ({
  subject: slotTitle(slot),
  body: {
    contentType: "HTML",
    content: buildOutlookBody(slot),
  },
  start: {
    dateTime: toLocalDateTime(slot.slotDate, SLOT_START_TIME),
    timeZone: OUTLOOK_TIMEZONE,
  },
  end: {
    dateTime: toLocalDateTime(slot.slotDate, SLOT_END_TIME),
    timeZone: OUTLOOK_TIMEZONE,
  },
  location: {
    displayName: SLOT_LOCATION,
  },
  attendees: slot.attendees.map(normalizeGraphAttendee),
  allowNewTimeProposals: false,
  hideAttendees: true,
  isReminderOn: true,
  reminderMinutesBeforeStart: OUTLOOK_REMINDER_MINUTES_BEFORE_START,
  responseRequested: true,
  showAs: "busy",
  transactionId: `ciderscope-slot-${slot.slotId}`,
});

const getToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const { tenantId, clientId, clientSecret } = requiredConfig();
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph is not configured.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: GRAPH_SCOPE,
  });

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({})) as TokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Microsoft Graph token request failed.");
  }

  cachedToken = {
    token: payload.access_token,
    expiresAt: Date.now() + ((payload.expires_in || 3600) * 1000),
  };
  return cachedToken.token;
};

const graphFetch = async <T>(path: string, init: RequestInit = {}) => {
  const token = await getToken();
  const response = await fetch(`${GRAPH_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
      ...(init.headers || {}),
    },
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: { message?: string } }).error?.message || response.statusText;
    throw new Error(`Microsoft Graph ${response.status}: ${message}`);
  }

  return payload as T;
};

const organizerPath = () => `/users/${encodeURIComponent(getOutlookOrganizerEmail())}`;

export const createOutlookSlotEvent = async (slot: OutlookSlotEventInput) => {
  return graphFetch<GraphEvent>(`${organizerPath()}/events`, {
    method: "POST",
    body: JSON.stringify(buildOutlookEventPayload(slot)),
  });
};

export const getOutlookSlotEvent = async (eventId: string) => {
  return graphFetch<GraphEvent>(
    `${organizerPath()}/events/${encodeURIComponent(eventId)}?$select=id,attendees,webLink`
  );
};

export const updateOutlookSlotAttendees = async (eventId: string, attendees: GraphAttendee[]) => {
  return graphFetch<GraphEvent>(`${organizerPath()}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify({ attendees }),
  });
};

export const cancelOutlookSlotEvent = async (eventId: string, comment: string) => {
  await graphFetch<void>(`${organizerPath()}/events/${encodeURIComponent(eventId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
};
