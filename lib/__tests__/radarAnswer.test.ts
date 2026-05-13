import { describe, expect, it } from "vitest";
import type { RadarAxis, RadarAnswer } from "../../types";
import { validateRadarAnswer } from "../radarAnswer";

describe("validateRadarAnswer", () => {
  const axes: RadarAxis[] = [
    { label: "Fruit", children: [{ label: "Pomme" }, { label: "Poire" }] },
    { label: "Boise" },
  ];

  it("flags untouched root families", () => {
    const answer: RadarAnswer = {
      Fruit: { _: 0 },
      Boise: { _: 0, _touched: true },
    };

    expect(validateRadarAnswer(answer, axes, 0)).toEqual({
      untouched: ["Fruit"],
      emptyChildren: [],
    });
  });

  it("requires a child when a parent is above the minimum", () => {
    const answer: RadarAnswer = {
      Fruit: { _: 4, _touched: true, children: { Pomme: { _: 0 }, Poire: { _: 0 } } },
      Boise: { _: 0, _touched: true },
    };

    expect(validateRadarAnswer(answer, axes, 0)).toEqual({
      untouched: [],
      emptyChildren: ["Fruit"],
    });
  });
});
