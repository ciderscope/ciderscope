import { describe, expect, it } from "vitest";
import type { SessionConfig } from "../../types";
import { buildSessionSteps, getOrderedItems, isStepDone, posteToPresentationIndex } from "../sessionSteps";

const baseConfig: SessionConfig = {
  name: "Session test",
  date: "2026-05-13",
  products: [{ code: "A" }, { code: "B" }, { code: "C" }],
  presMode: "fixed",
  questions: [
    { id: "q1", type: "scale", label: "Intensite", scope: "per-product" },
    { id: "q2", type: "classement", label: "Classement", scope: "standalone", codes: [] },
    { id: "q3", type: "text", label: "Commentaire", scope: "global" },
  ],
};

describe("sessionSteps", () => {
  it("builds the canonical analysis steps without randomization", () => {
    const steps = buildSessionSteps(baseConfig);

    expect(steps.map(step => step.type)).toEqual(["product", "product", "product", "ranking", "global"]);
    expect(steps[0]).toMatchObject({ type: "product", product: { code: "A" } });
    expect(steps[3]).toMatchObject({ type: "ranking", question: { codes: ["A", "B", "C"] } });
  });

  it("keeps product steps in the configured product order for fixed sessions", () => {
    const config: SessionConfig = {
      ...baseConfig,
      questions: [
        { id: "q1", type: "scale", label: "Intensite", scope: "per-product", codes: ["C", "A"] },
      ],
    };

    const steps = buildSessionSteps(config);

    expect(steps.map(step => step.type === "product" ? step.product.code : "")).toEqual(["A", "C"]);
  });

  it("uses poste order before juror index for latin presentation", () => {
    const config = { ...baseConfig, presMode: "latin" as const };
    const byPoste = buildSessionSteps(config, {
      jurorName: "Alice",
      jurorList: ["Alice", "Bob"],
      poste: { day: "mardi", num: 2 },
    });

    expect(posteToPresentationIndex({ day: "mardi", num: 2 })).toBe(1);
    expect(byPoste[0]).toMatchObject({ type: "product", product: { code: "B" } });
  });

  it("keeps random ordering stable for the same juror and session", () => {
    const first = getOrderedItems(["A", "B", "C", "D"], "random", "Alice", ["Alice"], "S1");
    const second = getOrderedItems(["A", "B", "C", "D"], "random", "Alice", ["Alice"], "S1");

    expect(second).toEqual(first);
    expect([...first].sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("checks required answers per step type", () => {
    const [productStep, , , rankingStep, globalStep] = buildSessionSteps(baseConfig);

    expect(isStepDone(productStep, { A: { q1: { _: 5, _subs: [], _touched: true } } })).toBe(true);
    expect(isStepDone(productStep, { A: { q1: { _: 5, _subs: [] } } })).toBe(false);
    expect(isStepDone(rankingStep, { _rank: { q2: ["A", "B", "C"] } })).toBe(true);
    expect(isStepDone(rankingStep, { _rank: { q2: ["A", "B"] } })).toBe(false);
    expect(isStepDone(rankingStep, { _rank: { q2: ["A", "B", "B"] } })).toBe(false);
    expect(isStepDone(globalStep, { _global: { q3: "ok" } })).toBe(true);
  });

  it("checks discriminative answers against allowed values", () => {
    const triangular = buildSessionSteps({
      ...baseConfig,
      questions: [
        { id: "tri", type: "triangulaire", label: "Tri", scope: "standalone", codes: ["A", "B", "C"], correctAnswer: "A" },
      ],
    })[0];
    const anona = buildSessionSteps({
      ...baseConfig,
      questions: [
        { id: "an", type: "a-non-a", label: "A/non-A", scope: "standalone", codes: ["101"], refCode: "A", correctAnswer: "101:A" },
      ],
    })[0];

    expect(isStepDone(triangular, { _discrim: { tri: "B" } })).toBe(true);
    expect(isStepDone(triangular, { _discrim: { tri: "D" } })).toBe(false);
    expect(isStepDone(anona, { _discrim: { an: { "101": "A" } } })).toBe(true);
    expect(isStepDone(anona, { _discrim: { an: { "101": "" } } })).toBe(false);
  });

  it("supports multiple-choice QCM completion", () => {
    const [globalStep] = buildSessionSteps({
      ...baseConfig,
      questions: [
        { id: "qcm", type: "qcm", label: "Choix", scope: "global", multiple: true, options: ["A", "B", "C"] },
      ],
    });

    expect(isStepDone(globalStep, { _global: { qcm: ["A", "C"] } })).toBe(true);
    expect(isStepDone(globalStep, { _global: { qcm: [] } })).toBe(false);
    expect(isStepDone(globalStep, { _global: { qcm: ["D"] } })).toBe(false);
  });
});
