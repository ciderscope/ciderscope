import { describe, expect, it } from "vitest";
import type { SessionConfig } from "../../types";
import {
  analyzeSessionMergeCompatibility,
  guessSessionProductMappings,
  transformJurorAnswersForSessionMerge,
  type SessionProductMapping,
} from "../sessionMerge";

const targetConfig: SessionConfig = {
  name: "Séance principale",
  date: "2026-08-04",
  presMode: "latin",
  products: [
    { code: "101", label: "Brut fruité" },
    { code: "202", label: "Brut sec" },
  ],
  questions: [
    { id: "target-scale", type: "scale", label: "Intensité", scope: "per-product", min: 0, max: 10 },
    { id: "target-rank", type: "classement", label: "Classement", scope: "standalone", codes: ["101", "202"], correctOrder: ["202", "101"] },
    { id: "target-anona", type: "a-non-a", label: "A/non-A", scope: "standalone", codes: ["101", "202"], refCode: "101", correctAnswer: "101:A,202:non-A" },
  ],
};

const sourceConfig: SessionConfig = {
  name: "Séance à absorber",
  date: "2026-08-06",
  presMode: "latin",
  products: [
    { code: "784", label: "  brut   fruité " },
    { code: "219", label: "Brut sec" },
  ],
  questions: [
    { id: "source-scale", type: "scale", label: "Intensité", scope: "per-product", min: 0, max: 10 },
    { id: "source-rank", type: "classement", label: "Classement", scope: "standalone", codes: ["784", "219"], correctOrder: ["219", "784"] },
    { id: "source-anona", type: "a-non-a", label: "A/non-A", scope: "standalone", codes: ["784", "219"], refCode: "784", correctAnswer: "784:A,219:non-A" },
  ],
};

describe("session merge", () => {
  it("pré-associe les produits par code puis par description", () => {
    const guesses = guessSessionProductMappings(targetConfig, {
      ...sourceConfig,
      products: [
        { code: "101", label: "Autre libellé" },
        { code: "219", label: "Brut sec" },
      ],
    });

    expect(guesses).toEqual([
      { sourceCode: "101", targetCode: "101", reason: "code" },
      { sourceCode: "219", targetCode: "202", reason: "description" },
    ]);
  });

  it("considère les structures comme identiques après traduction des codes et des ids de question", () => {
    const mappings = guessSessionProductMappings(targetConfig, sourceConfig);
    const result = analyzeSessionMergeCompatibility(targetConfig, sourceConfig, mappings);

    expect(result.compatible).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.questionMappings).toEqual([
      { sourceQuestionId: "source-scale", targetQuestionId: "target-scale" },
      { sourceQuestionId: "source-rank", targetQuestionId: "target-rank" },
      { sourceQuestionId: "source-anona", targetQuestionId: "target-anona" },
    ]);
  });

  it("bloque la fusion dès qu'une question diffère réellement", () => {
    const incompatible = {
      ...sourceConfig,
      questions: sourceConfig.questions.map((question, index) => (
        index === 0 ? { ...question, max: 9 } : question
      )),
    };
    const mappings = guessSessionProductMappings(targetConfig, incompatible);
    const result = analyzeSessionMergeCompatibility(targetConfig, incompatible, mappings);

    expect(result.compatible).toBe(false);
    expect(result.errors).toContain("La question 1 « Intensité » n'a pas une structure strictement identique.");
  });

  it("traduit toutes les formes de réponses pertinentes", () => {
    const mappings = guessSessionProductMappings(targetConfig, sourceConfig) as SessionProductMapping[];
    const compatibility = analyzeSessionMergeCompatibility(targetConfig, sourceConfig, mappings);
    const transformed = transformJurorAnswersForSessionMerge({
      "784": { "source-scale": 8 },
      "219": { "source-scale": 4 },
      _rank: { "source-rank": ["219", "784"] },
      _discrim: { "source-anona": { "784": "A", "219": "non-A" } },
      _global: { "source-global": "inchangé" },
      _completedSteps: {
        "product:784": true,
        "ranking:source-rank": true,
        "discrim:source-anona": true,
      },
      _timing: { "product:784": 1200, "ranking:source-rank": 400 },
      _finished: true,
    }, sourceConfig, mappings, compatibility.questionMappings);

    expect(transformed).toEqual({
      "101": { "target-scale": 8 },
      "202": { "target-scale": 4 },
      _rank: { "target-rank": ["202", "101"] },
      _discrim: { "target-anona": { "101": "A", "202": "non-A" } },
      _global: { "source-global": "inchangé" },
      _completedSteps: {
        "product:101": true,
        "ranking:target-rank": true,
        "discrim:target-anona": true,
      },
      _timing: { "product:101": 1200, "ranking:target-rank": 400 },
      _finished: true,
    });
  });

  it("traduit les sélections triangulaires et BET sans modifier les statuts A/non-A", () => {
    const discrimSource: SessionConfig = {
      ...sourceConfig,
      questions: [
        { id: "source-tri", type: "triangulaire", label: "Triangle", scope: "standalone", codes: ["784", "219", "999"], correctAnswer: "784" },
        {
          id: "source-bet",
          type: "seuil-bet",
          label: "BET",
          scope: "standalone",
          betLevels: [{ label: "Niveau 1", concentration: 1, codes: ["784", "219", "999"], correctAnswer: "219" }],
        },
      ],
    };
    const mappings = guessSessionProductMappings(targetConfig, sourceConfig);
    const transformed = transformJurorAnswersForSessionMerge({
      _discrim: {
        "source-tri": "784",
        "source-bet": { "0": "219" },
      },
    }, discrimSource, mappings, [
      { sourceQuestionId: "source-tri", targetQuestionId: "target-tri" },
      { sourceQuestionId: "source-bet", targetQuestionId: "target-bet" },
    ]);

    expect(transformed).toEqual({
      _discrim: {
        "target-tri": "101",
        "target-bet": { "0": "202" },
      },
    });
  });
});
