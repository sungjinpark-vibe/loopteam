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

/** 0 -> '0개', 1000 -> '1000개'. */
export function formatSeeds(n: SeedCount): string {
  return `${n}개`;
}
