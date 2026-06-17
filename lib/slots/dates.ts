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

export type WeekDay = {
  date: string;
  day: number;
  weekday: string;
  month: string;
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

export const getWeekStart = (date: Date) => {
  const mondayOffset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
};

export const addDays = (date: Date, days: number) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
};

export const getWeekCalendarDays = (weekStart: Date): WeekDay[] => {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    month: "short",
    timeZone: SLOT_TIMEZONE,
  });

  return Array.from({ length: 7 }, (_, index) => {
    const current = addDays(weekStart, index);
    const parts = formatter.formatToParts(new Date(Date.UTC(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      12
    )));
    const get = (type: string) => parts.find(part => part.type === type)?.value || "";
    return {
      date: toIsoDate(current.getFullYear(), current.getMonth(), current.getDate()),
      day: current.getDate(),
      weekday: get("weekday"),
      month: get("month"),
    };
  });
};

export const weekLabel = (weekStart: Date) => {
  const start = addDays(weekStart, 0);
  const end = addDays(weekStart, 6);
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SLOT_TIMEZONE,
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
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

export const chooseSessionSlotDate = (
  slotDates: string[],
  activeSlotDate: string | null,
  today: string | null | undefined
) => {
  if (activeSlotDate) return activeSlotDate;
  if (slotDates.length === 0) return null;
  if (today) return slotDates.find(date => date >= today) || slotDates[slotDates.length - 1] || null;
  return slotDates[0] || null;
};

export const getTodayInSlotTimezone = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SLOT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
