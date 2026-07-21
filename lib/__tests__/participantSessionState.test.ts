import { describe, expect, it } from "vitest";
import {
  clearStoredParticipantSession,
  isParticipantSessionDayExpired,
  PARTICIPANT_SESSION_DAY_KEY,
} from "../participantSessionState";

describe("participant session persistence", () => {
  it("expires a stored session only when its recorded day has changed", () => {
    expect(isParticipantSessionDayExpired("session-1", "2026-07-21", "2026-07-21")).toBe(false);
    expect(isParticipantSessionDayExpired("session-1", "2026-07-20", "2026-07-21")).toBe(true);
    expect(isParticipantSessionDayExpired("session-1", null, "2026-07-21")).toBe(false);
    expect(isParticipantSessionDayExpired(null, "2026-07-20", "2026-07-21")).toBe(false);
  });

  it("clears participant navigation without touching tokens or the offline queue", () => {
    const values = new Map<string, string>([
      ["senso_curSessId", "session-1"],
      ["senso_cj", "Camille"],
      ["senso_cs", "3"],
      ["senso_screen", "form"],
      [PARTICIPANT_SESSION_DAY_KEY, "2026-07-20"],
      ["senso_participant_token_v1:session-1:Camille", "token"],
      ["senso_pending_v1", "[]"],
    ]);

    clearStoredParticipantSession({ removeItem: key => values.delete(key) });

    expect(values.has("senso_curSessId")).toBe(false);
    expect(values.has("senso_cj")).toBe(false);
    expect(values.has("senso_cs")).toBe(false);
    expect(values.has("senso_screen")).toBe(false);
    expect(values.has(PARTICIPANT_SESSION_DAY_KEY)).toBe(false);
    expect(values.get("senso_participant_token_v1:session-1:Camille")).toBe("token");
    expect(values.get("senso_pending_v1")).toBe("[]");
  });
});
