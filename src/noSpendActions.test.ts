import { describe, expect, it } from "vitest";
import { claimNoSpendDay } from "./noSpendActions";
import type { LedgerEntry, TownState } from "./types";

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

function baseArgs(overrides: Partial<Parameters<typeof claimNoSpendDay>[0]> = {}): Parameters<typeof claimNoSpendDay>[0] {
  return {
    town: freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 2 }),
    existingBuildingCount: 2,
    entries: [],
    today: "2026-08-02",
    dailyBuildSlots: 5,
    noSpendDayCostsSlot: true,
    tierThresholds,
    materialQueueMax: 10,
    buildingId: "park1",
    createdAt: 1000,
    plotIndex: 0,
    w: 1,
    h: 1,
    ...overrides,
  };
}

describe("claimNoSpendDay — F15", () => {
  it("claims: builds a park tile, consumes one slot, and counts as a streak act", () => {
    const result = claimNoSpendDay(baseArgs());
    expect(result).not.toBeNull();
    // `building` is nullable since a full town defers the park instead — this
    // case places it, so the assertions below are all on the placed tile.
    expect(result!.building!.source).toEqual({ kind: "nospend", date: "2026-08-02" });
    expect(result!.building!.categoryId).toBe("park");
    expect(result!.building!.plotIndex).toBe(0);
    expect(result!.building!.w).toBe(1);
    expect(result!.building!.h).toBe(1);
    expect(result!.queuedMaterial).toBeNull();
    expect(result!.town.noSpendDays).toEqual(["2026-08-02"]);
    expect(result!.town.slotsUsedToday).toBe(3);
    expect(result!.town.streakDays).toBe(1);
    expect(result!.town.lastActOn).toBe("2026-08-02");
  });

  it("is rejected (returns null) when already claimed today — claiming twice is impossible", () => {
    const args = baseArgs({ town: freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 2, noSpendDays: ["2026-08-02"] }) });
    expect(claimNoSpendDay(args)).toBeNull();
  });

  it("is rejected when an expense already exists today", () => {
    const entries: LedgerEntry[] = [
      {
        id: "e1",
        type: "expense",
        amountKrw: 5_000,
        categoryId: "food",
        occurredOn: "2026-08-02",
        createdAt: 0,
        updatedAt: 0,
        buildingId: "b1",
        queued: false,
      },
    ];
    expect(claimNoSpendDay(baseArgs({ entries }))).toBeNull();
  });

  it("is rejected when no slots remain and noSpendDayCostsSlot is true", () => {
    const args = baseArgs({ town: freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5 }) });
    expect(claimNoSpendDay(args)).toBeNull();
  });

  it("ignores the slot cap when noSpendDayCostsSlot is false, and does not touch slot fields", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5 });
    const result = claimNoSpendDay(baseArgs({ town, noSpendDayCostsSlot: false }));
    expect(result).not.toBeNull();
    expect(result!.town.slotsUsedToday).toBe(5); // untouched
    expect(result!.town.slotsUsedOn).toBe("2026-08-02"); // untouched
  });

  it("fires a tier celebration exactly once on a fresh upward crossing", () => {
    const result = claimNoSpendDay(baseArgs({ existingBuildingCount: 9 }));
    expect(result!.celebrateTier).toBe(1);
    expect(result!.town.highestTierSeen).toBe(1);
  });

  it("never re-fires the celebration for a threshold already seen", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 2, highestTierSeen: 1 });
    const result = claimNoSpendDay(baseArgs({ town, existingBuildingCount: 9 }));
    expect(result!.celebrateTier).toBeNull();
  });

  // 사용자 지시 2026-08-13 "공원도 이월되게 해줘" — a full town used to REJECT
  // the claim outright; it now defers the park onto F14's queue, the same one
  // an over-cap ledger entry waits in.
  describe("full town (plotIndex === null) — deferred, not rejected", () => {
    it("queues a park material instead of rejecting, and counts the day as 무지출 right now", () => {
      const result = claimNoSpendDay(baseArgs({ plotIndex: null }));
      expect(result).not.toBeNull();
      expect(result!.building).toBeNull();
      expect(result!.queuedMaterial).toEqual({ noSpendDate: "2026-08-02", categoryId: "park", variantIndex: 0, queuedOn: "2026-08-02" });
      expect(result!.town.queue).toEqual([result!.queuedMaterial]);
      // The claim itself lands today: streak + 무지출 count, exactly once, on
      // this branch — the drain must not repeat them tomorrow.
      expect(result!.town.noSpendDays).toEqual(["2026-08-02"]);
      expect(result!.town.streakDays).toBe(1);
      expect(result!.town.lastActOn).toBe("2026-08-02");
    });

    it("does not consume a slot or move the tier — nothing was built today", () => {
      const result = claimNoSpendDay(baseArgs({ plotIndex: null, existingBuildingCount: 9 }));
      expect(result!.town.slotsUsedToday).toBe(2); // untouched, same as `decideBuildOrQueue`'s queue branch
      expect(result!.town.slotsUsedOn).toBe("2026-08-02"); // untouched
      expect(result!.celebrateTier).toBeNull(); // 9 + this park would cross tier 1 — but the drain places it, so the drain scores it
      expect(result!.town.highestTierSeen).toBe(0);
    });

    it("is still rejected when the queue is also at materialQueueMax — nothing left to defer into", () => {
      const queue = Array.from({ length: 2 }, (_, i) => ({
        entryId: `q${i}`,
        categoryId: "food" as const,
        variantIndex: 0,
        queuedOn: "2026-08-01",
        entryYm: "2026-08",
      }));
      expect(claimNoSpendDay(baseArgs({ plotIndex: null, materialQueueMax: 2, town: freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 2, queue }) }))).toBeNull();
    });
  });
});
