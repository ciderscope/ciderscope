import { SLOT_END_TIME, SLOT_LOCATION, SLOT_START_TIME, SLOT_TIMEZONE } from "./dates";

type IcsSlot = {
  id: string;
  slotDate: string;
  sessionName?: string | null;
};

type IcsRegistration = {
  id: string;
  participantEmail: string;
};

const escapeIcsText = (value: string) => {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
};

const compactUtc = (date: Date) => {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
};

const compactLocal = (slotDate: string, time: string) => {
  return `${slotDate.replace(/-/g, "")}T${time.replace(":", "")}00`;
};

export const buildSlotIcs = (slot: IcsSlot, registration: IcsRegistration, now = new Date()) => {
  const title = slot.sessionName
    ? `Seance d'analyse sensorielle - ${slot.sessionName}`
    : "Seance d'analyse sensorielle";
  const description = [
    "Inscription confirmee.",
    `Horaire: ${SLOT_START_TIME} a ${SLOT_END_TIME}.`,
    `Lieu: ${SLOT_LOCATION}.`,
    slot.sessionName ? `Seance: ${slot.sessionName}.` : "",
  ].filter(Boolean).join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IFPC//CiderScope//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    `TZID:${SLOT_TIMEZONE}`,
    `X-LIC-LOCATION:${SLOT_TIMEZONE}`,
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:ciderscope-slot-${slot.id}-${registration.id}@ifpc.eu`,
    `DTSTAMP:${compactUtc(now)}`,
    `DTSTART;TZID=${SLOT_TIMEZONE}:${compactLocal(slot.slotDate, SLOT_START_TIME)}`,
    `DTEND;TZID=${SLOT_TIMEZONE}:${compactLocal(slot.slotDate, SLOT_END_TIME)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(SLOT_LOCATION)}`,
    `ATTENDEE;CN=${escapeIcsText(registration.participantEmail)}:MAILTO:${registration.participantEmail}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel seance sensorielle dans 24 heures",
    "TRIGGER:-P1D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel seance sensorielle dans 1 heure",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
};
