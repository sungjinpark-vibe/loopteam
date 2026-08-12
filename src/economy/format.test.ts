import { describe, expect, it } from "vitest";
import { SEED_UNIT, formatSeeds, formatSeedsWithUnit } from "./format";
import { seeds } from "./types";

describe("formatSeeds", () => {
  it.each([0, 1, 999, 1000, 123456])("renders %i as a plain count, never a thousands separator or currency mark", (n) => {
    expect(formatSeeds(seeds(n))).toMatch(/^\d+개$/);
  });

  it("never contains a comma", () => {
    expect(formatSeeds(seeds(1000))).not.toContain(",");
  });
});

// Gate-3 follow-up (A5): every seed surface showed a bare "N개" and named no
// unit, so nothing on screen said what was being counted.
describe("formatSeedsWithUnit", () => {
  it.each([0, 3, 25, 1200])("names the currency in front of the plain count (%i)", (n) => {
    expect(formatSeedsWithUnit(seeds(n))).toBe(`${SEED_UNIT} ${n}개`);
  });

  it("still never renders like money — no separator, no currency mark", () => {
    const rendered = formatSeedsWithUnit(seeds(123456));
    expect(rendered).not.toContain(",");
    expect(rendered).not.toMatch(/[₩원]/); // 원 = the KRW character (rule R-7 bans the literal here)
  });
});
