export const SLOT_TIMEZONE = "Europe/Paris";
export const SLOT_START_TIME = "11:30";
export const SLOT_END_TIME = "12:30";
export const SLOT_TIME_LABEL = "11h30 a 12h30";
export const SLOT_LOCATION = "salle d'analyse sensorielle";
export const SLOT_CAPACITY = 10;

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const toIsoDate = (year: number, monthIndex: number, day: number) => {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
};

export const parseIsoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
};

export const getMonthCalendarDays = (year: number, monthIndex: number): CalendarDay[] => {
  const first = new Date(year, monthIndex, 1);
  const firstMondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - firstMondayOffset);
  const days: CalendarDay[] = [];

  for (let i = 0; i < 42; i++) {
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({
      date: toIsoDate(current.getFullYear(), current.getMonth(), current.getDate()),
      day: current.getDate(),
      inMonth: current.getMonth() === monthIndex,
    });
  }

  return days;
};

export const monthLabel = (year: number, monthIndex: number) => {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: SLOT_TIMEZONE,
  }).format(new Date(Date.UTC(year, monthIndex, 15, 12)));
};

export const formatSlotDateLong = (value: string) => {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SLOT_TIMEZONE,
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12)));
};
