import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelOutlookInvitationForRegistration: vi.fn(),
  cancelSlotRegistrationFromSql: vi.fn(),
  confirmOutlookInvitationForRegistration: vi.fn(),
  getCalendarSlotFromSql: vi.fn(),
}));

vi.mock("../server/slotData", () => ({
  getCalendarSlot: vi.fn(),
}));

vi.mock("../server/slotSql", () => ({
  cancelSlotRegistrationFromSql: mocks.cancelSlotRegistrationFromSql,
  getCalendarSlotFromSql: mocks.getCalendarSlotFromSql,
}));

vi.mock("../server/outlookInvitations", () => ({
  cancelOutlookInvitationForRegistration: mocks.cancelOutlookInvitationForRegistration,
  confirmOutlookInvitationForRegistration: mocks.confirmOutlookInvitationForRegistration,
}));

import { cancelSlotRegistrationWithInvitations } from "../server/slotCancellation";

describe("admin slot registration cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCalendarSlotFromSql.mockResolvedValue({
      id: "slot-1",
      slotDate: "2026-07-22",
      sessionName: "Test triangulaire",
    });
    mocks.cancelOutlookInvitationForRegistration.mockResolvedValue({ status: "cancelled", eventId: "event-1" });
    mocks.confirmOutlookInvitationForRegistration.mockResolvedValue({ status: "sent", eventId: "event-2" });
  });

  it("cancels the participant invitation and confirms the promoted waitlisted participant", async () => {
    mocks.cancelSlotRegistrationFromSql.mockResolvedValue({
      ok: true,
      registration: {
        id: "registration-1",
        slot_id: "slot-1",
        participant_name: "Alice",
        participant_email: "alice@ifpc.eu",
        registration_status: "confirmed",
        cancelled_at: "2026-07-17T10:00:00.000Z",
        outlook_event_id: "event-1",
      },
      promoted_registration: {
        id: "registration-2",
        slot_id: "slot-1",
        participant_name: "Bob",
        participant_email: "bob@ifpc.eu",
        registration_status: "confirmed",
        outlook_event_id: "event-2",
      },
    });

    const outcome = await cancelSlotRegistrationWithInvitations({
      supabase: null,
      slotId: "slot-1",
      registrationId: "registration-1",
    });

    expect(mocks.cancelSlotRegistrationFromSql).toHaveBeenCalledWith({
      slotId: "slot-1",
      registrationId: "registration-1",
    });
    expect(mocks.cancelOutlookInvitationForRegistration).toHaveBeenCalledWith({
      supabase: null,
      registration: { id: "registration-1", outlookEventId: "event-1" },
      slotDate: "2026-07-22",
    });
    expect(mocks.confirmOutlookInvitationForRegistration).toHaveBeenCalledWith({
      supabase: null,
      slot: {
        id: "slot-1",
        slotDate: "2026-07-22",
        sessionName: "Test triangulaire",
      },
      registration: {
        id: "registration-2",
        slotId: "slot-1",
        participantName: "Bob",
        participantEmail: "bob@ifpc.eu",
        registrationStatus: "confirmed",
        outlookEventId: "event-2",
      },
    });
    expect(outcome.outlookCancellation?.status).toBe("cancelled");
    expect(outcome.outlookPromotion?.status).toBe("sent");
  });

  it("does not promote another participant when no waitlisted registration is returned", async () => {
    mocks.cancelSlotRegistrationFromSql.mockResolvedValue({
      ok: true,
      registration: {
        id: "registration-3",
        slot_id: "slot-1",
        participant_name: "Chloé",
        participant_email: "chloe@ifpc.eu",
        registration_status: "waitlist",
        cancelled_at: "2026-07-17T10:00:00.000Z",
        outlook_event_id: null,
      },
    });

    const outcome = await cancelSlotRegistrationWithInvitations({
      supabase: null,
      slotId: "slot-1",
      registrationId: "registration-3",
    });

    expect(outcome.result.ok).toBe(true);
    expect(mocks.cancelOutlookInvitationForRegistration).toHaveBeenCalledTimes(1);
    expect(mocks.confirmOutlookInvitationForRegistration).not.toHaveBeenCalled();
    expect(outcome.outlookPromotion).toBeNull();
  });

  it("does not touch Outlook when the registration is no longer active", async () => {
    mocks.cancelSlotRegistrationFromSql.mockResolvedValue({
      ok: false,
      code: "registration_not_found",
    });

    const outcome = await cancelSlotRegistrationWithInvitations({
      supabase: null,
      slotId: "slot-1",
      registrationId: "registration-missing",
    });

    expect(outcome.result).toEqual({ ok: false, code: "registration_not_found" });
    expect(mocks.cancelOutlookInvitationForRegistration).not.toHaveBeenCalled();
    expect(mocks.confirmOutlookInvitationForRegistration).not.toHaveBeenCalled();
  });
});
