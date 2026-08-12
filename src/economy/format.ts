/**
 * 씨앗 display — PM-DECISIONS §F-ECON rule R-7.
 *
 * Never a thousands separator, never the legacy KRW suffix/symbol — a seed
 * count must never be visually confusable with the app's real money display
 * (`../format.ts`'s `formatKrw`). Rule R-7 also bans this whole directory
 * from importing that file at all; see `eslint.config.js`'s `src/economy/**`
 * override for the enforced half of that ban.
 */
import type { SeedCount } from "./types";

/** The currency's name, as the player sees it. One source of truth for every surface that names it. */
export const SEED_UNIT = "씨앗";

/** 0 -> '0개', 1000 -> '1000개'. */
export function formatSeeds(n: SeedCount): string {
  return `${n}개`;
}

/**
 * The same count with the currency named — '씨앗 12개'.
 *
 * Gate-3 follow-up (A5): every seed surface rendered a bare "N개", so nothing
 * on screen said WHAT was being counted (buildings? days? seeds?). The unit
 * word was previously hand-prefixed at one call site, which is how the shop
 * header and the reward toast ended up disagreeing. `formatSeeds` itself stays
 * a bare count — ADDENDUM-05 §6 adopts that signature verbatim, and the
 * `SeedCount` brand plus rule R-7 still keep this off the money axis (no
 * thousands separator, no KRW mark anywhere in this directory).
 */
export function formatSeedsWithUnit(n: SeedCount): string {
  return `${SEED_UNIT} ${formatSeeds(n)}`;
}
