import { createHash, randomBytes } from "node:crypto";
import type { JurorAnswers, SessionConfig } from "../../types";

export const PARTICIPANT_TOKEN_BYTES = 32;
export const MAX_JUROR_NAME_LENGTH = 80;
export const MAX_ANSWER_PAYLOAD_BYTES = 512_000;
const MAX_JSON_DEPTH = 32;
const MAX_JSON_NODES = 50_000;

export const normalizeJurorName = (value: string) => value.trim().replace(/\s+/g, " ");

export const isValidJurorName = (value: string) => {
  const normalized = normalizeJurorName(value);
  return normalized.length > 0 && normalized.length <= MAX_JUROR_NAME_LENGTH;
};

export const createParticipantToken = () => randomBytes(PARTICIPANT_TOKEN_BYTES).toString("base64url");

export const hashParticipantToken = (token: string) => (
  createHash("sha256").update(token, "utf8").digest("hex")
);

export const isValidParticipantToken = (token: string) => /^[A-Za-z0-9_-]{40,100}$/.test(token);

const hasSafeJsonShape = (value: unknown) => {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes++;
    if (nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) return false;
    if (!current.value || typeof current.value !== "object") continue;
    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as Record<string, unknown>);
    children.forEach(child => stack.push({ value: child, depth: current.depth + 1 }));
  }
  return true;
};

export const isAnswerPayloadSizeValid = (data: JurorAnswers) => {
  if (!hasSafeJsonShape(data)) return false;
  try {
    return Buffer.byteLength(JSON.stringify(data), "utf8") <= MAX_ANSWER_PAYLOAD_BYTES;
  } catch {
    return false;
  }
};

/** Remove answer keys from the configuration delivered to participant browsers. */
export const sanitizeParticipantConfig = (config: SessionConfig): SessionConfig => ({
  ...config,
  password: undefined,
  questions: config.questions.map(question => ({
    ...question,
    correctAnswer: undefined,
    correctOrder: undefined,
    betLevels: question.betLevels?.map(level => ({
      ...level,
      correctAnswer: "",
    })),
  })),
});
