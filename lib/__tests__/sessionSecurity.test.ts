import { describe, expect, it } from "vitest";
import type { JurorAnswers, SessionConfig } from "../../types";
import {
  createParticipantToken,
  hashParticipantToken,
  isAnswerPayloadSizeValid,
  isValidParticipantToken,
  sanitizeParticipantConfig,
} from "../server/sessionSecurity";

describe("participant session security", () => {
  it("creates an opaque token and stores only its SHA-256 hash", () => {
    const token = createParticipantToken();
    expect(isValidParticipantToken(token)).toBe(true);
    expect(hashParticipantToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashParticipantToken(token)).not.toContain(token);
  });

  it("removes corrections from the participant questionnaire", () => {
    const config: SessionConfig = {
      name: "Séance",
      date: "2026-07-17",
      password: "local",
      presMode: "fixed",
      products: [{ code: "101" }],
      questions: [{
        id: "q1",
        type: "classement",
        label: "Classez",
        scope: "standalone",
        correctAnswer: "101",
        correctOrder: ["101"],
      }],
    };

    const sanitized = sanitizeParticipantConfig(config);
    expect(sanitized.password).toBeUndefined();
    expect(sanitized.questions[0].correctAnswer).toBeUndefined();
    expect(sanitized.questions[0].correctOrder).toBeUndefined();
  });

  it("rejects oversized or excessively nested answer payloads", () => {
    expect(isAnswerPayloadSizeValid({ sample: { q1: "ok" } })).toBe(true);
    expect(isAnswerPayloadSizeValid({ sample: { q1: "x".repeat(600_000) } })).toBe(false);

    let nested: Record<string, unknown> = {};
    const root = nested;
    for (let depth = 0; depth < 40; depth++) {
      nested.child = {};
      nested = nested.child as Record<string, unknown>;
    }
    expect(isAnswerPayloadSizeValid(root as JurorAnswers)).toBe(false);
  });
});
