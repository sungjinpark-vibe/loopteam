/**
 * random port — ADDENDUM-02 §3.3, mirrors `src/platform/clock.ts` line for
 * line, including the dev/test override pattern.
 *
 * This is the ONLY file allowed to call `Math.random()` (rule R-6, enforced
 * by the same `no-restricted-syntax` eslint rule that already bans
 * `Date.now()`). Every random draw in the app — plot choice, variantIndex,
 * id suffixes — comes through here, which is what makes a town reproducible
 * for a bug report (DE-3).
 */

export interface RandomPort {
  /** [0, 1) */
  next(): number;
}

let override: (() => number) | null = null;

export const browserRandom: RandomPort = { next: () => (override ?? Math.random)() };

export const random: RandomPort = browserRandom;

/** Dev/test only: pin the sequence. `null` restores `Math.random`. */
export function setRandomOverride(fn: (() => number) | null): void {
  override = fn;
}

/**
 * Deterministic driver for fixtures/QA — the same mulberry32 algorithm
 * `devtools/fixtures.ts` already ships (kept as a separate copy there: that
 * module is dev-only and must not statically import outside `devtools/**`,
 * MVP-SPEC §11).
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
