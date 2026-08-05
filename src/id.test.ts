import { describe, expect, it } from "vitest";
import { makeId } from "./id";
import { setRandomOverride } from "./platform/random";

describe("makeId", () => {
  it("never collides across calls in the same millisecond even under a constant random source", () => {
    // Reproduces the round-1 finding: setRandomOverride(() => 0) used to
    // collapse the random suffix to "", making two same-`now` ids identical.
    setRandomOverride(() => 0);
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(makeId("e", 1_723_000_000_000));
    setRandomOverride(null);
    expect(ids.size).toBe(50);
  });
});
