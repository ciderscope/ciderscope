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
const OUTLOOK_REMINDER_MINUTES_BEFORE_START = 24 * 60;
const GRAPH_REQUEST_TIMEOUT_MS = 15_000;
const GRAPH_MAX_ATTEMPTS = 3;
const GRAPH_RETRY_STATUSES = new Set([429, 502, 503, 504]);

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
  status?: {
    response?: string;
    time?: string;
  };
  type: "required";
};

export type GraphEvent = {
  id: string;
  isCancelled?: boolean;
  lastModifiedDateTime?: string;
  subject?: string;
  attendees?: GraphAttendee[];
  webLink?: string;
};

export type GraphSubscription = {
  id: string;
  changeType: string;
  resource: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState?: string;
};

export type OutlookSlotEventInput = {
  slotId: string;
  registrationId?: string;
  slotDate: string;
  sessionName?: string | null;
  waitlisted?: boolean;
  attendees: Array<{
    name: string;
    email: string;
  }>;
};

let cachedToken: AccessToken | null = null;

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = GRAPH_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("Microsoft Graph request timed out.")), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromParent);
  }
};

const retryDelayMs = (response: Response, attempt: number) => {
  const retryAfter = Number.parseInt(response.headers.get("retry-after") || "", 10);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 5_000);
  return Math.min(250 * (2 ** attempt), 2_000);
};

const requiredConfig = () => ({
  tenantId: process.env.MICROSOFT_GRAPH_TENANT_ID || "",
  clientId: process.env.MICROSOFT_GRAPH_CLIENT_ID || "",
  clientSecret: process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "",
});

export const getOutlookOrganizerEmail = () => (
  process.env.OUTLOOK_ORGANIZER_EMAIL || DEFAULT_ORGANIZER_EMAIL
).trim();

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

const buildOutlookBody = (slot: Pick<OutlookSlotEventInput, "slotDate" | "sessionName" | "waitlisted">) => {
  const dateLabel = formatSlotDateLong(slot.slotDate);
  const sessionLine = slot.sessionName?.trim()
    ? `<li><strong>Seance :</strong> ${escapeHtml(slot.sessionName.trim())}</li>`
    : "";
  const intro = slot.waitlisted
    ? [
      "<p>Votre demande d'inscription est en liste d'attente.</p>",
      "<p>Le creneau est complet : cette invitation Outlook est envoyee en statut provisoire et votre presence reste a confirmer par l'equipe si une place se libere.</p>",
    ]
    : [
      "<p>Votre session d'analyse sensorielle est confirmee.</p>",
    ];

  return [
    "<p>Bonjour,</p>",
    ...intro,
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
  subject: slot.waitlisted ? `[Liste d'attente] ${slotTitle(slot)}` : slotTitle(slot),
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
  showAs: slot.waitlisted ? "tentative" : "busy",
  transactionId: `ciderscope-slot-registration-${slot.registrationId || slot.slotId}`,
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

  const response = await fetchWithTimeout(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
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
  for (let attempt = 0; attempt < GRAPH_MAX_ATTEMPTS; attempt++) {
    const token = await getToken();
    const response = await fetchWithTimeout(`${GRAPH_ROOT}${path}`, {
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
    if (response.ok) return payload as T;

    if (response.status === 401 && attempt === 0) {
      cachedToken = null;
      continue;
    }
    if (GRAPH_RETRY_STATUSES.has(response.status) && attempt < GRAPH_MAX_ATTEMPTS - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs(response, attempt)));
      continue;
    }
    const message = (payload as { error?: { message?: string } }).error?.message || response.statusText;
    throw new Error(`Microsoft Graph ${response.status}: ${message}`);
  }
  throw new Error("Microsoft Graph request failed after retries.");
};

const organizerPath = () => `/users/${encodeURIComponent(getOutlookOrganizerEmail())}`;

export const outlookEventSubscriptionResource = () => `users/${getOutlookOrganizerEmail()}/events`;

export const createOutlookSlotEvent = async (slot: OutlookSlotEventInput) => {
  return graphFetch<GraphEvent>(`${organizerPath()}/events`, {
    method: "POST",
    body: JSON.stringify(buildOutlookEventPayload(slot)),
  });
};

export const getOutlookSlotEvent = async (eventId: string) => {
  return graphFetch<GraphEvent>(
    `${organizerPath()}/events/${encodeURIComponent(eventId)}?$select=id,attendees,isCancelled,lastModifiedDateTime,subject,webLink`
  );
};

export const updateOutlookSlotEvent = async (eventId: string, slot: OutlookSlotEventInput) => {
  const payload = { ...buildOutlookEventPayload(slot) };
  delete (payload as { transactionId?: string }).transactionId;

  return graphFetch<GraphEvent>(`${organizerPath()}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

export const cancelOutlookSlotEvent = async (eventId: string, comment: string) => {
  await graphFetch<void>(`${organizerPath()}/events/${encodeURIComponent(eventId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
};

export const listGraphSubscriptions = async () => {
  const payload = await graphFetch<{ value?: GraphSubscription[] }>("/subscriptions");
  return payload.value || [];
};

export const createOutlookEventSubscription = async ({
  notificationUrl,
  clientState,
  expirationDateTime,
}: {
  notificationUrl: string;
  clientState: string;
  expirationDateTime: string;
}) => {
  return graphFetch<GraphSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      changeType: "updated,deleted",
      notificationUrl,
      resource: outlookEventSubscriptionResource(),
      expirationDateTime,
      clientState,
      latestSupportedTlsVersion: "v1_2",
    }),
  });
};

export const renewGraphSubscription = async (subscriptionId: string, expirationDateTime: string) => {
  return graphFetch<GraphSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ expirationDateTime }),
  });
};
