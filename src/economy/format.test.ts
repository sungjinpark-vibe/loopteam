import { describe, expect, it } from "vitest";
import { formatSeeds } from "./format";
import { seeds } from "./types";

describe("formatSeeds", () => {
  it.each([0, 1, 999, 1000, 123456])("renders %i as a plain count, never a thousands separator or currency mark", (n) => {
    expect(formatSeeds(seeds(n))).toMatch(/^\d+개$/);
  });

  it("never contains a comma", () => {
    expect(formatSeeds(seeds(1000))).not.toContain(",");
  });
});
