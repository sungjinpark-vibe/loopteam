import { describe, expect, it } from "vitest";
import { BALANCE } from "./balance.placeholder";

// Spec §9: the app must run on placeholder values, never on missing ones —
// every key must be present and typed, and BALANCE_UNSET must be true until
// the director's approved values file lands.
describe("BALANCE placeholder", () => {
  it("is flagged unset", () => {
    expect(BALANCE.BALANCE_UNSET).toBe(true);
  });

  it("has every balance key the spec requires, non-empty and correctly typed", () => {
    expect(typeof BALANCE.dailyBuildSlots).toBe("number");
    expect(BALANCE.dailyBuildSlots).toBeGreaterThan(0);

    expect(typeof BALANCE.materialQueueMax).toBe("number");
    expect(BALANCE.materialQueueMax).toBeGreaterThan(0);

    expect(Array.isArray(BALANCE.tierThresholds)).toBe(true);
    expect(BALANCE.tierThresholds.length).toBeGreaterThan(0);

    expect(Array.isArray(BALANCE.moodPaceThresholds)).toBe(true);
    expect(BALANCE.moodPaceThresholds.length).toBeGreaterThan(0);

    expect(typeof BALANCE.variantsPerCategory).toBe("number");
    expect(BALANCE.variantsPerCategory).toBeGreaterThan(0);

    expect(Array.isArray(BALANCE.savingsTowerSegments)).toBe(true);
    expect(BALANCE.savingsTowerSegments.length).toBeGreaterThan(0);

    expect(typeof BALANCE.noSpendDayCostsSlot).toBe("boolean");
  });
});
