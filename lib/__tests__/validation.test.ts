import { describe, expect, it } from "vitest";
import type { SessionConfig } from "../../types";
import { validateQuestion, validateSession } from "../validation";

describe("validation", () => {
  it("flags duplicate question ids before answers can be overwritten", () => {
    const config: SessionConfig = {
      name: "Validation",
      date: "2026-05-13",
      presMode: "fixed",
      products: [{ code: "A" }],
      questions: [
        { id: "q1", type: "text", label: "Commentaire", scope: "global" },
        { id: "q1", type: "qcm", label: "Choix", scope: "global", options: ["Oui", "Non"] },
      ],
    };

    expect(validateSession(config).some(error => error.includes("question en doublon"))).toBe(true);
  });

  it("flags unknown per-product target codes", () => {
    expect(
      validateQuestion(
        { id: "q1", type: "scale", label: "Intensite", scope: "per-product", codes: ["MISSING"] },
        ["A", "B"]
      ).some(error => error.includes("MISSING"))
    ).toBe(true);
  });

  it("flags duplicate and invalid choice definitions", () => {
    expect(
      validateQuestion(
        { id: "q1", type: "qcm", label: "Choix", scope: "global", options: ["Oui", "Oui"], correctAnswer: "Peut-etre" },
        []
      ).filter(error => error.includes("QCM")).length
    ).toBeGreaterThanOrEqual(2);
  });
});
