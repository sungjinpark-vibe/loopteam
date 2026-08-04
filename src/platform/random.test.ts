import { afterEach, describe, expect, it } from "vitest";
import { browserRandom, seededRandom, setRandomOverride } from "./random";

describe("random port", () => {
  afterEach(() => setRandomOverride(null));

  it("returns a number in [0, 1) with no override set", () => {
    const n = browserRandom.next();
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(1);
  });

  it("returns exactly the overridden sequence once pinned", () => {
    setRandomOverride(() => 0.42);
    expect(browserRandom.next()).toBe(0.42);
    expect(browserRandom.next()).toBe(0.42);
  });

  it("clearing the override (null) restores real Math.random-backed draws", () => {
    setRandomOverride(() => 0);
    setRandomOverride(null);
    const n = browserRandom.next();
    // Astronomically unlikely to be exactly 0 from a real Math.random() call;
    // a real regression here (override stuck) would make this flaky-false,
    // not flaky-true, so it's a safe guard.
    expect(n).not.toBe(0);
  });
});

describe("seededRandom", () => {
  it("is deterministic: same seed produces the same sequence", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds produce different sequences", () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect(a()).not.toBe(b());
  });

  it("every draw is in [0, 1)", () => {
    const rng = seededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
