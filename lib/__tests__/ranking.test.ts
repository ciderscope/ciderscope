import { describe, expect, it } from "vitest";
import { findPerceptionThreshold } from "../ranking";

describe("findPerceptionThreshold", () => {
  it("keeps samples in group 'a' when the group is 'ab'", () => {
    const products = ["P1", "P2", "P3", "P4"];
    const rankMeans = { P1: 1, P2: 2, P3: 3, P4: 4 };
    const groups = { P1: "a", P2: "ab", P3: "b", P4: "c" };

    expect(findPerceptionThreshold(products, rankMeans, groups)).toBe("P3");
  });

  it("returns null when every sample still belongs to the initial group", () => {
    const products = ["P1", "P2"];
    const rankMeans = { P1: 1, P2: 2 };
    const groups = { P1: "a", P2: "ab" };

    expect(findPerceptionThreshold(products, rankMeans, groups)).toBeNull();
  });
});
