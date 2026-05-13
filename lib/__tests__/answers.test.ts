import { describe, expect, it } from "vitest";
import { parseANonAAnswer, serializeANonAAnswer } from "../answers";

describe("A/non-A answer codec", () => {
  it("parses and serializes code assignments", () => {
    expect(parseANonAAnswer("101:A, 205:non-A")).toEqual({
      "101": "A",
      "205": "non-A",
    });

    expect(serializeANonAAnswer({ "101": "A", "205": "non-A" })).toBe("101:A,205:non-A");
  });

  it("ignores empty pairs", () => {
    expect(parseANonAAnswer("101:A,, bad, 205: non-A")).toEqual({
      "101": "A",
      "205": "non-A",
    });
  });

  it("ignores invalid statuses when parsing and serializing", () => {
    expect(parseANonAAnswer("101:A,205:maybe,307:non-A")).toEqual({
      "101": "A",
      "307": "non-A",
    });
    expect(serializeANonAAnswer({ "101": "A", "205": "maybe", "": "non-A" })).toBe("101:A");
  });
});
