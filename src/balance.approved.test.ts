import { describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";

// Spec §9 rule 3: this is the director-approved live config. Pins the exact
// approved table so a future edit here is a visible diff, not a silent slip.
describe("BALANCE approved", () => {
  it("is flagged approved", () => {
    expect(BALANCE.BALANCE_UNSET).toBe(false);
  });

  it("matches the director-approved values exactly", () => {
    expect(BALANCE.dailyBuildSlots).toBe(10);
    expect(BALANCE.materialQueueMax).toBe(10);
    expect(BALANCE.tierThresholds).toEqual([0, 10, 30, 80, 200]);
    expect(BALANCE.moodPaceThresholds).toEqual([0.9, 1.1]);
    expect(BALANCE.variantsPerCategory).toBe(3);
    expect(BALANCE.savingsTowerSegments).toEqual([
      100_000, 300_000, 600_000, 1_000_000, 2_000_000, 4_000_000, 7_000_000, 10_000_000,
    ]);
    expect(BALANCE.savingsStructureSegments).toEqual({});
    expect(BALANCE.noSpendDayCostsSlot).toBe(true);
  });

  // ADDENDUM-04 §7/§8 — director-confirmed 2026-08-09: Option 3 (all entry
  // types scale with amount), expPerLevel/maxLevel confirmed as PM-proposed
  // (both untouched by either Gate-3-rerun retune of the table below).
  it("has the director-confirmed ADDENDUM-04 building-EXP dials", () => {
    expect(BALANCE.expPerLevel).toBe(3);
    expect(BALANCE.maxLevel).toBe(5);
    // Gate-3-RERUN retune #2 (2026-08-12) — see `balance.approved.ts`'s own
    // doc: a single entry's exp is now capped at `expPerLevel` (3) so no one
    // entry can found/grow a building past Lv.1 (round-5 panel's #1/TOP FIX,
    // game-designer -5, echoed by QA/target-player/liveops-pd) — reaching
    // Lv.5 needs repeat records, not one large one.
    expect(BALANCE.expAmountTiers).toEqual([
      [5_000, 0],
      [20_000, 1],
      [50_000, 2],
      [150_000, 3],
      [Infinity, 3],
    ]);
  });

  it("caps a single entry's exp at expPerLevel — no one entry can clear more than one level", () => {
    for (const [, exp] of BALANCE.expAmountTiers ?? []) {
      expect(exp).toBeLessThanOrEqual(BALANCE.expPerLevel);
    }
  });
});
