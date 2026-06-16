import { describe, expect, it } from "vitest";
import { formatSlotDateLong } from "../slots/dates";
import { buildSlotIcs } from "../slots/ics";
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
});

describe("slot ICS generation", () => {
  it("generates a calendar invitation at the fixed slot time", () => {
    const ics = buildSlotIcs(
      { id: "slot-1", slotDate: "2026-06-18", sessionName: "Pomme" },
      { id: "registration-1", participantEmail: "jury@ifpc.eu" },
      new Date("2026-06-16T09:00:00Z")
    );

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20260618T113000");
    expect(ics).toContain("DTEND;TZID=Europe/Paris:20260618T123000");
    expect(ics).toContain("LOCATION:salle d'analyse sensorielle");
    expect(ics).toContain("UID:ciderscope-slot-slot-1-registration-1@ifpc.eu");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("TRIGGER:-PT1H");
  });
});
