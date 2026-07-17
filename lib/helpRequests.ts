import type { HelpRequest, JurorAnswers } from "../types";

const MAX_HELP_REQUESTS_PER_JUROR = 20;

const isHelpRequest = (value: unknown): value is HelpRequest => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return typeof request.id === "string"
    && typeof request.requestedAt === "string"
    && typeof request.stepIndex === "number"
    && Number.isFinite(request.stepIndex);
};

export const getHelpRequests = (answers: JurorAnswers | null | undefined): HelpRequest[] => {
  const value = answers?._helpRequests;
  return Array.isArray(value) ? value.filter(isHelpRequest) : [];
};

export const createHelpRequest = (stepIndex: number): HelpRequest => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return {
    id: `${Date.now()}-${randomPart}`,
    requestedAt: new Date().toISOString(),
    stepIndex,
  };
};

export const appendHelpRequest = (answers: JurorAnswers, request: HelpRequest): JurorAnswers => {
  const previous = getHelpRequests(answers).slice(-(MAX_HELP_REQUESTS_PER_JUROR - 1));
  return {
    ...answers,
    _helpRequests: [...previous, request],
  };
};

export const acknowledgeHelpRequest = (
  answers: JurorAnswers | null | undefined,
  requestId: string,
  acknowledgedAt = new Date().toISOString()
): JurorAnswers => {
  const source = answers || {};
  const requests = getHelpRequests(source);
  return {
    ...source,
    _helpRequests: requests.map(request => (
      request.id === requestId
        ? { ...request, acknowledgedAt: request.acknowledgedAt || acknowledgedAt }
        : request
    )),
  };
};
