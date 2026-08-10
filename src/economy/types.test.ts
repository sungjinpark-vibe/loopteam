import { describe, expect, it } from "vitest";
import { GRANTED_EVENT_KEYS_CAP, NPC_MAX_VISIBLE, defaultEconomyState, seeds } from "./types";

describe("seeds()", () => {
  it("brands a non-negative integer", () => {
    expect(seeds(0)).toBe(0);
    expect(seeds(42)).toBe(42);
  });

  it("rejects non-integers", () => {
    expect(() => seeds(1.5)).toThrow();
  });

  it("rejects negatives", () => {
    expect(() => seeds(-1)).toThrow();
  });
});

describe("defaultEconomyState()", () => {
  it("is a fresh, empty economy", () => {
    expect(defaultEconomyState()).toEqual({
      seeds: 0,
      ownedSkus: [],
      appliedTownSku: null,
      appliedByBuildingId: {},
      purchasedNpcSlots: 0,
      grantedEventKeys: [],
    });
  });
});

describe("constants", () => {
  it("NPC_MAX_VISIBLE is a small render-perf ceiling, not a game rule", () => {
    expect(NPC_MAX_VISIBLE).toBe(12);
  });

  it("GRANTED_EVENT_KEYS_CAP bounds the idempotency ledger", () => {
    expect(GRANTED_EVENT_KEYS_CAP).toBeGreaterThan(0);
  });
});
