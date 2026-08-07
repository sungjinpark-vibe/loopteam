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
});
