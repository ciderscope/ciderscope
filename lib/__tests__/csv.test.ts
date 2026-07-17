import { describe, expect, it } from "vitest";
import type { AllAnswers, SessionConfig } from "../../types";
import { buildCsvData } from "../csv";

describe("buildCsvData", () => {
  it("scores A/non-A answers with the shared parser", () => {
    const config: SessionConfig = {
      name: "CSV",
      date: "2026-05-13",
      presMode: "fixed",
      products: [{ code: "101" }],
      questions: [
        {
          id: "anona",
          type: "a-non-a",
          label: "Defaut",
          scope: "standalone",
          codes: ["101", "205"],
          correctAnswer: "101:A,205:non-A",
        },
      ],
    };
    const answers: AllAnswers = {
      Alice: { _discrim: { anona: { "101": "A", "205": "non-A" } } },
    };

    expect(buildCsvData(config, answers)).toMatchObject([
      { jury: "Alice", question: "Defaut", valeur: "101:A, 205:non-A", score: "1" },
    ]);
  });

  it("does not mark A/non-A answers correct when the correction is missing", () => {
    const config: SessionConfig = {
      name: "CSV",
      date: "2026-05-13",
      presMode: "fixed",
      products: [{ code: "101" }],
      questions: [
        {
          id: "anona",
          type: "a-non-a",
          label: "Defaut",
          scope: "standalone",
          codes: ["101"],
          correctAnswer: "",
        },
      ],
    };
    const answers: AllAnswers = {
      Alice: { _discrim: { anona: { "101": "A" } } },
    };

    expect(buildCsvData(config, answers)).toMatchObject([
      { jury: "Alice", question: "Defaut", score: "0" },
    ]);
  });
});
