import { describe, expect, it } from "vitest";
import { chooseSessionSlotDate, formatSlotDateLong } from "../slots/dates";
import { buildOutlookEventPayload } from "../server/outlookGraph";
import { getEmailDomain, isValidDomain, normalizeDomain, normalizeEmail } from "../slots/validation";

describe("slot validation helpers", () => {
  it("normalizes emails and domains before comparison", () => {
    expect(normalizeEmail("  LUCAS.SEMAAN@IFPC.EU  ")).toBe("lucas.semaan@ifpc.eu");
    expect(getEmailDomain("  LUCAS.SEMAAN@IFPC.EU  ")).toBe("ifpc.eu");
    expect(normalizeDomain("@IFPC.EU")).toBe("ifpc.eu");
    expect(isValidDomain("ifpc.eu")).toBe(true);
    expect(isValidDomain("not a domain")).toBe(false);
  });
});

describe("slot date helpers", () => {
  it("formats a civil slot date in France without shifting the day", () => {
    expect(formatSlotDateLong("2026-06-18")).toContain("18 juin 2026");
  });

  it("uses today's active slot before future or past scheduled dates", () => {
    expect(chooseSessionSlotDate(["2026-06-16", "2026-06-17", "2026-06-18"], "2026-06-17", "2026-06-17"))
      .toBe("2026-06-17");
  });

  it("uses the next scheduled slot, then the last past slot, for admin display", () => {
    expect(chooseSessionSlotDate(["2026-06-16", "2026-06-18"], null, "2026-06-17"))
      .toBe("2026-06-18");
    expect(chooseSessionSlotDate(["2026-06-10", "2026-06-11"], null, "2026-06-17"))
      .toBe("2026-06-11");
    expect(chooseSessionSlotDate([], null, "2026-06-17")).toBeNull();
  });
});

describe("Outlook event generation", () => {
  it("builds a physical Outlook invitation for the slot", () => {
    const event = buildOutlookEventPayload({
      slotId: "slot-1",
      slotDate: "2026-06-18",
      sessionName: "Pomme",
      attendees: [{ name: "Jury IFPC", email: "jury@ifpc.eu" }],
    });

    expect(event.start).toEqual({ dateTime: "2026-06-18T11:30:00", timeZone: "Romance Standard Time" });
    expect(event.end).toEqual({ dateTime: "2026-06-18T12:30:00", timeZone: "Romance Standard Time" });
    expect(event.location.displayName).toBe("salle d'analyse sensorielle");
    expect(event.hideAttendees).toBe(true);
    expect(event.isReminderOn).toBe(true);
    expect(event.reminderMinutesBeforeStart).toBe(1440);
    expect(event.attendees).toHaveLength(1);
    expect(event).not.toHaveProperty("isOnlineMeeting");
  });
});
