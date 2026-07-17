import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOutlookSlotEvent: vi.fn(),
  handleOutlookAttendeeDeclineFromSql: vi.fn(),
}));

vi.mock("../server/outlookGraph", () => ({
  createOutlookEventSubscription: vi.fn(),
  getOutlookSlotEvent: mocks.getOutlookSlotEvent,
  isOutlookGraphConfigured: vi.fn(() => true),
  listGraphSubscriptions: vi.fn(() => []),
  outlookEventSubscriptionResource: vi.fn(() => "users/organizer@example.com/events"),
  renewGraphSubscription: vi.fn(),
}));

vi.mock("../server/outlookInvitations", () => ({
  confirmOutlookInvitationForRegistration: vi.fn(),
}));

vi.mock("../server/slotData", () => ({
  getCalendarSlot: vi.fn(),
}));

vi.mock("../server/slotSql", () => ({
  getCalendarSlotFromSql: vi.fn(),
  handleOutlookAttendeeDeclineFromSql: mocks.handleOutlookAttendeeDeclineFromSql,
  hasSlotSqlConfig: vi.fn(() => true),
}));

import { processOutlookWebhookPayload } from "../server/outlookWebhook";

describe("Outlook decline webhook", () => {
  const previousClientState = process.env.OUTLOOK_WEBHOOK_CLIENT_STATE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OUTLOOK_WEBHOOK_CLIENT_STATE = "expected-state";
  });

  afterEach(() => {
    if (previousClientState === undefined) delete process.env.OUTLOOK_WEBHOOK_CLIENT_STATE;
    else process.env.OUTLOOK_WEBHOOK_CLIENT_STATE = previousClientState;
  });

  it("cancels the registration when the attendee declines the Outlook event", async () => {
    mocks.getOutlookSlotEvent.mockResolvedValue({
      id: "event-123",
      attendees: [{
        emailAddress: { address: "participant@ifpc.eu" },
        status: { response: "declined" },
        type: "required",
      }],
    });
    mocks.handleOutlookAttendeeDeclineFromSql.mockResolvedValue({
      ok: true,
      registration: { id: "registration-123" },
      promoted_registration: null,
    });

    const result = await processOutlookWebhookPayload(null, {
      value: [{
        changeType: "updated",
        clientState: "expected-state",
        resourceData: { id: "event-123" },
      }],
    });

    expect(mocks.handleOutlookAttendeeDeclineFromSql).toHaveBeenCalledWith("event-123");
    expect(result).toEqual({
      received: 1,
      processed: [{
        status: "cancelled",
        eventId: "event-123",
        code: undefined,
        promoted: false,
        promotionStatus: null,
      }],
    });
  });

  it("keeps the registration when the attendee has not declined", async () => {
    mocks.getOutlookSlotEvent.mockResolvedValue({
      id: "event-456",
      attendees: [{
        emailAddress: { address: "participant@ifpc.eu" },
        status: { response: "accepted" },
        type: "required",
      }],
    });

    const result = await processOutlookWebhookPayload(null, {
      value: [{
        changeType: "updated",
        clientState: "expected-state",
        resourceData: { id: "event-456" },
      }],
    });

    expect(mocks.handleOutlookAttendeeDeclineFromSql).not.toHaveBeenCalled();
    expect(result.processed).toEqual([{
      status: "skipped",
      eventId: "event-456",
      reason: "no_decline",
    }]);
  });

  it("deduplicates repeated notifications for the same event", async () => {
    mocks.getOutlookSlotEvent.mockResolvedValue({
      id: "event-789",
      attendees: [{
        emailAddress: { address: "participant@ifpc.eu" },
        status: { response: "declined" },
        type: "required",
      }],
    });
    mocks.handleOutlookAttendeeDeclineFromSql.mockResolvedValue({
      ok: true,
      registration: { id: "registration-789" },
      promoted_registration: null,
    });

    const notification = {
      changeType: "updated",
      clientState: "expected-state",
      resourceData: { id: "event-789" },
    };
    const result = await processOutlookWebhookPayload(null, { value: [notification, notification] });

    expect(mocks.handleOutlookAttendeeDeclineFromSql).toHaveBeenCalledTimes(1);
    expect(result.processed[1]).toEqual({
      status: "skipped",
      eventId: "event-789",
      reason: "duplicate_notification",
    });
  });
});
