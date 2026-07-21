export const PARTICIPANT_SESSION_DAY_KEY = "senso_session_day";

const PARTICIPANT_SESSION_KEYS = [
  "senso_curSessId",
  "senso_cj",
  "senso_cs",
  PARTICIPANT_SESSION_DAY_KEY,
] as const;

type SessionStorageCleaner = Pick<Storage, "removeItem">;

export const isParticipantSessionDayExpired = (
  sessionId: string | null,
  savedDay: string | null,
  currentDay: string
) => Boolean(sessionId && savedDay && savedDay !== currentDay);

export const clearStoredParticipantSession = (
  storage: SessionStorageCleaner,
  { clearScreen = true }: { clearScreen?: boolean } = {}
) => {
  PARTICIPANT_SESSION_KEYS.forEach(key => storage.removeItem(key));
  if (clearScreen) storage.removeItem("senso_screen");
};
