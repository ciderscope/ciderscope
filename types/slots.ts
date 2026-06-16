export type SlotRegistrationStatus = "active" | "cancelled";

export type PublicSlotParticipant = {
  id: string;
  participantName: string;
};

export type AdminSlotParticipant = PublicSlotParticipant & {
  participantEmail: string;
  createdAt: string;
};

export type SlotListItem = {
  id: string;
  slotDate: string;
  capacity: number;
  sessionId: string | null;
  sessionName: string;
  placesTaken: number;
  participants: PublicSlotParticipant[];
};

export type AdminSlotListItem = Omit<SlotListItem, "participants"> & {
  participants: AdminSlotParticipant[];
  createdAt: string;
};

export type EmailDomain = {
  id: string;
  domain: string;
  createdAt: string;
};
