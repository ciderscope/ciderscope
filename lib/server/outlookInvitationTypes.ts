export type OutlookSlotInfo = {
  id: string;
  slotDate: string;
  sessionName: string;
  outlookEventId: string | null;
};

export type ClaimedOutlookInvitation = {
  id: string;
  slotId: string;
  participantName: string;
  participantEmail: string;
  outlookEventId: string | null;
  attempts: number;
  slot: OutlookSlotInfo;
};

export type ClaimedOutlookCancellation = {
  id: string;
  slotId: string;
  participantName: string;
  participantEmail: string;
  outlookEventId: string;
  attempts: number;
  slot: OutlookSlotInfo;
};
