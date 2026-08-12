import { describe, expect, it } from "vitest";
import { drainQueue } from "./queueActions";
import type { Placed } from "./placement";
import type { QueuedMaterial, TownState } from "./types";

function freshTown(overrides: Partial<TownState> = {}): TownState {
  return {
    townName: "우리 동네",
    streakDays: 0,
    longestStreakDays: 0,
    lastActOn: null,
    slotsUsedOn: "",
    slotsUsedToday: 0,
    highestTierSeen: 0,
    queue: [],
    noSpendDays: [],
    cumulativeSavingsKrw: 0,
    lastSettledPeriod: null,
    ...overrides,
  };
}

const tierThresholds = [0, 10, 30, 80, 200];

// `drainQueue` takes a `placeMany`-shaped allocator called ONCE with the
// drain count — a real one draws randomly from the open town
// (placement.placeMany); this deterministic stand-in only needs to hand back
// `count` distinct 1x1 anchors per test.
function seqAlloc(start: number): (count: number) => Placed[] {
  return (count) => Array.from({ length: count }, (_, i) => ({ anchor: start + i, w: 1, h: 1 }));
}

/** A `placeMany` stand-in that runs out after `available` placements — town-full simulation. */
function limitedAlloc(start: number, available: number): (count: number) => Placed[] {
  return (count) => Array.from({ length: Math.min(count, available) }, (_, i) => ({ anchor: start + i, w: 1, h: 1 }));
}

describe("drainQueue — F14", () => {
  it("drains nothing when the queue is empty", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-01" });
    const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(5));
    expect(result.drained).toEqual([]);
    expect(result.town).toBe(town);
  });

  it("drains FIFO up to today's full slot count after the F4 reset, leaving the rest queued", () => {
    const queue: QueuedMaterial[] = [
      { entryId: "q1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-01", entryYm: "2026-08" },
      { entryId: "q2", categoryId: "cafe", variantIndex: 1, queuedOn: "2026-08-01", entryYm: "2026-08" },
      { entryId: "q3", categoryId: "shopping", variantIndex: 2, queuedOn: "2026-08-01", entryYm: "2026-08" },
    ];
    // Stale slotsUsedOn (yesterday) — F4's reset applies purely via slotsRemainingToday.
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue });
    const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(5));

    expect(result.drained).toHaveLength(3); // cap (5) exceeds queue length (3) — all 3 drain
    expect(result.drained.map((d) => d.material.entryId)).toEqual(["q1", "q2", "q3"]);
    expect(result.drained.map((d) => d.building.plotIndex)).toEqual([5, 6, 7]);
    expect(result.drained.every((d) => d.building.builtOn === "2026-08-02")).toBe(true);
    expect(result.town.queue).toEqual([]);
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
    expect(result.town.slotsUsedToday).toBe(3);
  });

  it("drains only up to the daily cap when the queue is larger, keeping the remainder in FIFO order", () => {
    const queue: QueuedMaterial[] = Array.from({ length: 5 }, (_, i) => ({
      entryId: `q${i}`,
      categoryId: "food" as const,
      variantIndex: 0,
      queuedOn: "2026-08-01",
      entryYm: "2026-08",
    }));
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue });
    const result = drainQueue(town, 0, "2026-08-02", 2, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(0));
    expect(result.drained.map((d) => d.material.entryId)).toEqual(["q0", "q1"]);
    expect(result.town.queue.map((q) => q.entryId)).toEqual(["q2", "q3", "q4"]);
    expect(result.town.slotsUsedToday).toBe(2);
  });

  it("a queued material never builds on the same date it was queued (drain requires today's reset)", () => {
    const queue: QueuedMaterial[] = [{ entryId: "q1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-02", entryYm: "2026-08" }];
    // Same day — slots are still fully used (that's WHY it queued), so nothing drains.
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, queue });
    const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(5));
    expect(result.drained).toEqual([]);
    expect(result.town).toBe(town);
  });

  it("fires a tier celebration when the drain itself crosses a new threshold", () => {
    const queue: QueuedMaterial[] = [{ entryId: "q1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-01", entryYm: "2026-08" }];
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue, highestTierSeen: 0 });
    const result = drainQueue(town, 9, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(9));
    expect(result.celebrateTier).toBe(1); // 9 existing + 1 drained = 10 -> crosses tierThresholds[1]
    expect(result.town.highestTierSeen).toBe(1);
  });

  it("adds drainCount on top of slots already used TODAY instead of overwriting them (D-3: dailyBuildSlots raised mid-day)", () => {
    // slotsUsedOn === today already (not stale) — 5 slots spent today under
    // the OLD cap, then dailyBuildSlots is raised to 7 for this same day.
    const queue: QueuedMaterial[] = [
      { entryId: "q1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-01", entryYm: "2026-08" },
      { entryId: "q2", categoryId: "cafe", variantIndex: 1, queuedOn: "2026-08-01", entryYm: "2026-08" },
    ];
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, queue });
    const result = drainQueue(town, 5, "2026-08-02", 7, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(5));
    expect(result.drained).toHaveLength(2); // remaining = 7 - 5 = 2
    // 5 already spent today + 2 just drained = 7, never rewritten down to 2.
    expect(result.town.slotsUsedToday).toBe(7);
  });

  it("does not re-fire a celebration for a threshold already seen", () => {
    const queue: QueuedMaterial[] = [{ entryId: "q1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-01", entryYm: "2026-08" }];
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue, highestTierSeen: 1 });
    const result = drainQueue(town, 9, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(9));
    expect(result.celebrateTier).toBeNull();
  });

  it("carries the placement's footprint onto the drained Building", () => {
    const queue: QueuedMaterial[] = [{ entryId: "q1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-01", entryYm: "2026-08" }];
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue });
    const twoByOne: (count: number) => Placed[] = (count) =>
      Array.from({ length: count }, (_, i) => ({ anchor: 10 + i, w: 2, h: 1 }));
    const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, twoByOne);
    expect(result.drained[0].building.w).toBe(2);
    expect(result.drained[0].building.h).toBe(1);
  });

  it("ADDENDUM-08 §3.1 — a full town (placeMany returns fewer than requested) drains only what fit, leaving the rest queued rather than dropped", () => {
    const queue: QueuedMaterial[] = [
      { entryId: "q1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-01", entryYm: "2026-08" },
      { entryId: "q2", categoryId: "cafe", variantIndex: 1, queuedOn: "2026-08-01", entryYm: "2026-08" },
      { entryId: "q3", categoryId: "shopping", variantIndex: 2, queuedOn: "2026-08-01", entryYm: "2026-08" },
    ];
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue });
    // 5 slots free, 3 queued, but the town only has room for 1 more building.
    const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, limitedAlloc(5, 1));
    expect(result.drained).toHaveLength(1);
    expect(result.drained[0].material.entryId).toBe("q1");
    expect(result.town.queue.map((q) => q.entryId)).toEqual(["q2", "q3"]); // never dropped
    expect(result.town.slotsUsedToday).toBe(1); // only the 1 actually placed
  });

  // ADDENDUM-04 §6/§7 — closing the F14/EXP parity gap the previous agent
  // flagged: a drained material must found with the SAME amount-driven exp a
  // same-day founding save gets, not an implicit flat gain 1.
  describe("ADDENDUM-04 §6 — amount-driven exp at drain time", () => {
    const expAmountTiers: readonly (readonly [number, number])[] = [
      [10_000, 1],
      [50_000, 2],
      [200_000, 3],
      [Infinity, 5],
    ];

    it("a material queued WITH amountKrw founds with the matching gain (exp = gain)", () => {
      const queue: QueuedMaterial[] = [
        { entryId: "q1", categoryId: "food", variantIndex: 0, amountKrw: 250_000, queuedOn: "2026-08-01", entryYm: "2026-08" },
      ];
      const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue });
      const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(5), expAmountTiers);
      // Gate-3-rerun fix: founding exp is the full gain, not `gain - 1`.
      expect(result.drained[0].building.exp).toBe(5); // gain 5 (>= 200,000 tier)
    });

    it("a small-amount material (gain 1) omits `exp` entirely — byte-identical to today's shape", () => {
      const queue: QueuedMaterial[] = [
        { entryId: "q1", categoryId: "food", variantIndex: 0, amountKrw: 3_000, queuedOn: "2026-08-01", entryYm: "2026-08" },
      ];
      const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue });
      const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(5), expAmountTiers);
      expect(result.drained[0].building.exp).toBeUndefined();
    });

    it("migration-safe: a material persisted with no `amountKrw` reads gain 1, never crashes", () => {
      const queue: QueuedMaterial[] = [{ entryId: "q1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-01", entryYm: "2026-08" }];
      const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue });
      const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(5), expAmountTiers);
      expect(result.drained[0].building.exp).toBeUndefined();
    });

    it("omitting the `expAmountTiers` arg entirely (every pre-existing call site) keeps flat gain 1, even with amountKrw present", () => {
      const queue: QueuedMaterial[] = [
        { entryId: "q1", categoryId: "food", variantIndex: 0, amountKrw: 250_000, queuedOn: "2026-08-01", entryYm: "2026-08" },
      ];
      const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, queue });
      const result = drainQueue(town, 5, "2026-08-02", 5, tierThresholds, (i) => `b${i}`, 1000, seqAlloc(5));
      expect(result.drained[0].building.exp).toBeUndefined();
    });
  });
});
