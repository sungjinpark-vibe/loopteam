import { describe, expect, it } from "vitest";
import { SPECIES, speciesForIndex } from "./species";

describe("SPECIES", () => {
  it("has exactly 12 entries: the base 6 then the shop 6, in kNpcIds order", () => {
    expect(SPECIES.map((s) => s.id)).toEqual([
      "cat",
      "dog",
      "rabbit",
      "bear",
      "fox",
      "chick",
      "hamster",
      "frog",
      "panda",
      "hedgehog",
      "penguin",
      "deer",
    ]);
  });

  it("every id is unique", () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
  });
});

describe("speciesForIndex", () => {
  it("is a deterministic pure function of the index", () => {
    expect(speciesForIndex(3)).toBe(speciesForIndex(3));
    expect(speciesForIndex(3)).toBe(SPECIES[3]);
  });

  it("wraps around once the index exceeds the species count", () => {
    expect(speciesForIndex(12)).toBe(SPECIES[0]);
    expect(speciesForIndex(13)).toBe(SPECIES[1]);
  });

  it("never throws and stays in range for a negative index", () => {
    const s = speciesForIndex(-1);
    expect(SPECIES).toContain(s);
  });
});
