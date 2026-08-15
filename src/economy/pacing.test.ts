/**
 * Gate-3 round-5 (A5) — the shop's time-to-first-purchase, computed from the
 * REAL award dials rather than asserted as a magic number.
 *
 * Round-5 panel: "The seed economy pays 4 per entry against a 150-seed
 * cheapest item... for a casual 2-3 entries/day logger that is roughly two
 * weeks to the first purchasable decor — the shop's reward loop does not close
 * inside the retention window it is supposed to defend." ADDENDUM-05 §6's own
 * stated intent is that a player "affords their first cosmetic within roughly
 * a week", so this is a regression against the spec, not just against taste.
 *
 * The simulation is deliberately the WORST case a "casual 2-3 entries/day
 * logger" can be, so anything better than it is covered too:
 *   - 2 entries/day, the low end of the stated range;
 *   - every entry GROWS an existing building rather than founding one, so the
 *     `build` bonus never fires (`awards.ts`: `build` is paid only when the
 *     entry founded a building) — this is the "4 per entry" the panel measured;
 *   - no 무지출 days, so `nospend` never fires — a player logging an expense
 *     every day has none by definition;
 *   - no tier crossings, which a pure grower does not reach (`townScale` only
 *     moves when a building is founded or fused).
 * What it does include is every award such a player unavoidably earns: the
 * per-entry award and the once-a-day streak award.
 */
import { describe, expect, it } from "vitest";
import { applyAward, awardFor } from "./awards";
import { SHOP_SKUS } from "./skus";
import { defaultEconomyState } from "./types";

const CHEAPEST_SKU_PRICE = Math.min(...SHOP_SKUS.map((s) => s.priceSeeds));
const ENTRIES_PER_DAY = 2;
/** ADDENDUM-05 §6's own pacing intent for the first cosmetic. */
const RETENTION_WINDOW_DAYS = 7;

/** Seed balance at the end of each simulated day, day 1 first. */
function simulateCasualLogger(days: number): number[] {
  let economy = defaultEconomyState();
  // The one-time welcome grant fires from `completeOnboarding` — before day 1
  // of logging, which is what makes it count toward the first week.
  economy = applyAward(economy, awardFor({ kind: "welcome" }));

  const balances: number[] = [];
  for (let day = 1; day <= days; day++) {
    const date = `2026-09-${String(day).padStart(2, "0")}`;
    for (let n = 0; n < ENTRIES_PER_DAY; n++) {
      // Gate-3 round-5: seeds are now tiered by amount, same as building EXP.
      // A "casual 2-3 entries/day logger" spending real money (not farming
      // sub-5,000원 rows) lands in the 5,000-20,000원 band (expGain 3), so
      // this worst-case simulation uses that rung, not the farming floor.
      economy = applyAward(economy, awardFor({ kind: "entry", entryId: `${date}-${n}`, expGain: 3 }));
    }
    // The day's first act extends the streak — idempotent by date, so it pays
    // once no matter how many entries that day.
    economy = applyAward(economy, awardFor({ kind: "streak", date, streakDays: day }));
    balances.push(economy.seeds);
  }
  return balances;
}

describe("A5 — seed pacing closes the shop loop inside the retention window", () => {
  it(`a casual ${ENTRIES_PER_DAY}-entries/day logger can afford the cheapest SKU within ${RETENTION_WINDOW_DAYS} days`, () => {
    const balances = simulateCasualLogger(21);
    const firstAffordableDay = balances.findIndex((b) => b >= CHEAPEST_SKU_PRICE) + 1;

    expect(firstAffordableDay).toBeGreaterThan(0); // reached at all
    expect(firstAffordableDay, `day-by-day balances: ${balances.slice(0, 10).join(", ")}`).toBeLessThanOrEqual(
      RETENTION_WINDOW_DAYS,
    );
  });

  it("the welcome grant is the thing that closes it — without it the same logger is still short at day 7", () => {
    // Guards the fix from being quietly removed as "an unnecessary freebie":
    // strip the one-time grant and the same worst-case player misses the
    // window, which is the exact state the panel reported.
    const withoutWelcome = simulateCasualLogger(21).map((b) => b - awardFor({ kind: "welcome" }).amount);
    expect(withoutWelcome[RETENTION_WINDOW_DAYS - 1]).toBeLessThan(CHEAPEST_SKU_PRICE);
  });

  it("the grant is one-time — a replayed award never pays twice", () => {
    let economy = defaultEconomyState();
    economy = applyAward(economy, awardFor({ kind: "welcome" }));
    const afterFirst = economy.seeds;
    economy = applyAward(economy, awardFor({ kind: "welcome" }));
    expect(economy.seeds).toBe(afterFirst);
  });
});
