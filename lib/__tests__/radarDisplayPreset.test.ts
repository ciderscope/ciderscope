import { describe, expect, it } from "vitest";
import { applyRadarAxisCorrection, buildRadarDisplayAxes, FRUITY_RADAR_DISPLAY_PRESET } from "../radarDisplayPreset";

describe("fruity radar display preset", () => {
  it("keeps the requested clockwise order and display labels", () => {
    const axes = buildRadarDisplayAxes([
      "Fruit",
      "Fruit > Fruit tropical",
      "Fruit > Fruit tropical > Banane",
      "Fruit > Fruit blanc/jaune > Poire",
      "Fruit > Agrume",
      "Fruit > Fruit rouge",
      "Floral",
    ], FRUITY_RADAR_DISPLAY_PRESET);

    expect(axes.map(axis => axis.label)).toEqual([
      "Fruité",
      "Banane",
      "Poire",
      "Fruits exotiques",
      "Agrumes",
      "Fruits rouges",
      "Floral",
    ]);
    expect(axes.map(axis => axis.id)).toEqual([
      "Fruit",
      "Fruit > Fruit tropical > Banane",
      "Fruit > Fruit blanc/jaune > Poire",
      "Fruit > Fruit tropical",
      "Fruit > Agrume",
      "Fruit > Fruit rouge",
      "Floral",
    ]);
  });

  it("keeps missing axes visible without changing the seven-axis model", () => {
    const axes = buildRadarDisplayAxes(["Fruit", "Floral"], FRUITY_RADAR_DISPLAY_PRESET);

    expect(axes).toHaveLength(7);
    expect(axes.map(axis => axis.label)).toEqual([
      "Fruité",
      "Banane",
      "Poire",
      "Fruits exotiques",
      "Agrumes",
      "Fruits rouges",
      "Floral",
    ]);
    expect(axes.filter(axis => !axis.matched).map(axis => axis.label)).toEqual([
      "Banane",
      "Poire",
      "Fruits exotiques",
      "Agrumes",
      "Fruits rouges",
    ]);
  });

  it("applies multiplicative corrections inside the radar scale", () => {
    expect(applyRadarAxisCorrection(5, 1.8, 10)).toBe(9);
    expect(applyRadarAxisCorrection(5, -8, 10)).toBe(0);
    expect(applyRadarAxisCorrection(9.5, 2, 10)).toBe(10);
  });
});
