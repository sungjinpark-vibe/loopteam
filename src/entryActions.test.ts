import { describe, expect, it } from "vitest";
import { plotFromIndex } from "./selectors";
import { applyNewEntry, type EntryDraft } from "./entryActions";
import type { Building, TownState } from "./types";

function freshTown(overrides: Partial<TownState> = {}): TownState {
  return {
    townName: "우리 동네",
    nextPlotIndex: 0,
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

const draft: EntryDraft = {
  type: "expense",
  amountKrw: 4_500,
  categoryId: "cafe",
  occurredOn: "2026-08-02",
};

// Shared args every call site fills in explicitly (project style already
// passes every balance dial explicitly, e.g. `dailyBuildSlots`) — this local
// helper only removes repetition across this file's tests, it isn't a
// production default.
function callArgs(overrides: Partial<Parameters<typeof applyNewEntry>[0]> = {}): Parameters<typeof applyNewEntry>[0] {
  return {
    town: freshTown(),
    buildings: [],
    draft,
    entryId: "e1",
    buildingId: "b1",
    createdAt: 1000,
    today: "2026-08-02",
    dailyBuildSlots: 5,
    materialQueueMax: 10,
    tierThresholds: [0, 10, 30, 80, 200],
    noSpendDayCostsSlot: true,
    variantIndex: 0,
    ...overrides,
  };
}

describe("applyNewEntry — F2/F4 build", () => {
  it("places a building via plotFromIndex(nextPlotIndex) and consumes one slot when slots remain", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(callArgs({ town, entryId: "e1", buildingId: "b1" }));

    expect(result.building).not.toBeNull();
    expect(result.building?.plotIndex).toBe(0);
    expect(result.building?.source).toEqual({ kind: "entry", entryId: "e1" });
    expect(plotFromIndex(result.building!.plotIndex)).toEqual({ row: 0, col: 0 });
    expect(result.entry.buildingId).toBe("b1");
    expect(result.town.nextPlotIndex).toBe(1);
    expect(result.town.slotsUsedToday).toBe(1);
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
    expect(result.queuedMaterial).toBeNull();
    expect(result.queueOverflow).toBe(false);
  });

  it("amount never changes building count — a huge amount still places exactly one building", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(
      callArgs({ town, draft: { ...draft, amountKrw: 1_000_000 }, entryId: "e2", buildingId: "b2", createdAt: 2000, variantIndex: 1 }),
    );
    expect(result.building?.plotIndex).toBe(0);
    expect(result.town.nextPlotIndex).toBe(1);
  });

  it("resets the slot count when slotsUsedOn is stale (new day) — F4", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, nextPlotIndex: 5 });
    const result = applyNewEntry(callArgs({ town, entryId: "e4", buildingId: "b4", createdAt: 4000 }));
    expect(result.building).not.toBeNull();
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
    expect(result.town.slotsUsedToday).toBe(1);
    expect(result.town.nextPlotIndex).toBe(6);
  });

  it("advancing the date backward grants nothing (F4)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-05", slotsUsedToday: 5, nextPlotIndex: 5 });
    const result = applyNewEntry(callArgs({ town, entryId: "e4b", buildingId: "b4b", today: "2026-08-02" }));
    expect(result.building).toBeNull(); // no slot freed by travelling backward — falls to F14 queue instead
    expect(result.queuedMaterial).not.toBeNull();
  });

  it("saving entries never build, queue, or consume a slot (F13)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(
      callArgs({
        town,
        draft: { type: "saving", amountKrw: 50_000, categoryId: "goal", occurredOn: "2026-08-02" },
        entryId: "e5",
        buildingId: "b5",
        createdAt: 5000,
      }),
    );
    expect(result.building).toBeNull();
    expect(result.queuedMaterial).toBeNull();
    expect(result.town).toBe(town); // untouched
  });
});

describe("applyNewEntry — F14 materials queue", () => {
  it("pushes to the queue (not overflow) when no slot remains and the queue has room", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, nextPlotIndex: 5 });
    const result = applyNewEntry(callArgs({ town, entryId: "e6", buildingId: "b6", materialQueueMax: 10 }));
    expect(result.building).toBeNull();
    expect(result.queueOverflow).toBe(false);
    expect(result.queuedMaterial).toEqual({
      entryId: "e6",
      categoryId: "cafe",
      variantIndex: 0,
      queuedOn: "2026-08-02",
      entryYm: "2026-08",
    });
    expect(result.entry.queued).toBe(true);
    expect(result.entry.buildingId).toBeNull();
    expect(result.town.queue).toEqual([result.queuedMaterial]);
    expect(result.town.nextPlotIndex).toBe(5); // no building placed yet
  });

  it("overflows past materialQueueMax — entry still recorded, no material, town.queue unchanged", () => {
    const queue = [{ entryId: "qe1", categoryId: "food" as const, variantIndex: 0, queuedOn: "2026-08-02", entryYm: "2026-08" }];
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, nextPlotIndex: 5, queue });
    const result = applyNewEntry(callArgs({ town, entryId: "e7", buildingId: "b7", materialQueueMax: 1 }));
    expect(result.building).toBeNull();
    expect(result.queuedMaterial).toBeNull();
    expect(result.queueOverflow).toBe(true);
    expect(result.entry.queued).toBe(false);
    expect(result.entry.buildingId).toBeNull();
    expect(result.town.queue).toBe(queue); // untouched
  });

  it("a queued entry counts as a streak act (F7) even though no building rises yet", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, nextPlotIndex: 5, lastActOn: "2026-08-01", streakDays: 3, longestStreakDays: 3 });
    const result = applyNewEntry(callArgs({ town, entryId: "e8", buildingId: "b8" }));
    expect(result.town.streakDays).toBe(4);
    expect(result.town.lastActOn).toBe("2026-08-02");
  });

  it("overflow is NOT a streak act", () => {
    const queue = [{ entryId: "qe1", categoryId: "food" as const, variantIndex: 0, queuedOn: "2026-08-02", entryYm: "2026-08" }];
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, nextPlotIndex: 5, queue, lastActOn: "2026-08-01", streakDays: 3, longestStreakDays: 3 });
    const result = applyNewEntry(callArgs({ town, entryId: "e9", buildingId: "b9", materialQueueMax: 1 }));
    expect(result.town.streakDays).toBe(3);
    expect(result.town.lastActOn).toBe("2026-08-01");
  });
});

describe("applyNewEntry — F5 tier celebration", () => {
  it("fires exactly once on a fresh upward crossing", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0, highestTierSeen: 0 });
    const buildings: Building[] = Array.from({ length: 9 }, (_, i) => ({
      id: `b${i}`,
      source: { kind: "entry", entryId: `e${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    // 9 existing + this save's 1 = 10, crossing tierThresholds[1] = 10.
    const result = applyNewEntry(callArgs({ town, buildings, entryId: "e10", buildingId: "b10" }));
    expect(result.celebrateTier).toBe(1);
    expect(result.town.highestTierSeen).toBe(1);
  });

  it("never re-fires for a threshold already seen", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0, highestTierSeen: 1 });
    const buildings: Building[] = Array.from({ length: 9 }, (_, i) => ({
      id: `b${i}`,
      source: { kind: "entry", entryId: `e${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    const result = applyNewEntry(callArgs({ town, buildings, entryId: "e10", buildingId: "b10" }));
    expect(result.celebrateTier).toBeNull(); // already-seen tier 1, still below tier 2 (30)
    expect(result.town.highestTierSeen).toBe(1);
  });

  it("does not fire while the material only queues (no building placed yet)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, nextPlotIndex: 9, highestTierSeen: 0 });
    const buildings: Building[] = Array.from({ length: 9 }, (_, i) => ({
      id: `b${i}`,
      source: { kind: "entry", entryId: `e${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    const result = applyNewEntry(callArgs({ town, buildings, entryId: "e10", buildingId: "b10" }));
    expect(result.queuedMaterial).not.toBeNull();
    expect(result.celebrateTier).toBeNull();
    expect(result.town.highestTierSeen).toBe(0);
  });
});

describe("applyNewEntry — F15 revocation", () => {
  const nospendBuilding: Building = {
    id: "park1",
    source: { kind: "nospend", date: "2026-08-02" },
    categoryId: "park",
    variantIndex: 0,
    plotIndex: 3,
    builtOn: "2026-08-02",
    createdAt: 0,
  };

  it("revokes a claim for TODAY and refunds the slot, then builds the expense normally", () => {
    const town = freshTown({
      slotsUsedOn: "2026-08-02",
      slotsUsedToday: 1, // the 1 slot the claim itself spent
      nextPlotIndex: 4,
      noSpendDays: ["2026-08-02"],
    });
    const result = applyNewEntry(callArgs({ town, buildings: [nospendBuilding], entryId: "e11", buildingId: "b11" }));
    expect(result.revokedNoSpend).toEqual({ date: "2026-08-02", buildingId: "park1" });
    expect(result.town.noSpendDays).toEqual([]);
    // slot refunded (1 -> 0) then this entry's own build spends 1 again -> net 1, and it actually built.
    expect(result.building).not.toBeNull();
    expect(result.town.slotsUsedToday).toBe(1);
  });

  it("revokes a claim for a PAST date with no refund", () => {
    const town = freshTown({
      slotsUsedOn: "2026-08-01",
      slotsUsedToday: 5, // yesterday's count — irrelevant to today's refund decision
      nextPlotIndex: 4,
      noSpendDays: ["2026-08-01"],
    });
    const pastBuilding = { ...nospendBuilding, source: { kind: "nospend" as const, date: "2026-08-01" }, builtOn: "2026-08-01" };
    const result = applyNewEntry(
      callArgs({ town, buildings: [pastBuilding], entryId: "e12", buildingId: "b12", draft: { ...draft, occurredOn: "2026-08-01" } }),
    );
    expect(result.revokedNoSpend).toEqual({ date: "2026-08-01", buildingId: "park1" });
    expect(result.town.noSpendDays).toEqual([]);
    // No refund: today (2026-08-02) still starts fresh (slotsUsedOn stale -> full cap), builds normally.
    expect(result.building).not.toBeNull();
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
    expect(result.town.slotsUsedToday).toBe(1);
  });

  it("does nothing when the date isn't claimed", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(callArgs({ town, entryId: "e13", buildingId: "b13" }));
    expect(result.revokedNoSpend).toBeNull();
  });

  // Round-2 finding C2 #1: a revoking save must count the true POST-revocation
  // building total, not `buildings.length` (which still includes today's park
  // — it is the caller's job to filter it out of storage, AFTER this
  // function already decided the tier). 8 real buildings + today's park = 9
  // passed in; revoking removes the park (-1) and this save's own expense
  // adds one back (+1) — true count stays 9, one below tierThresholds[1] (10).
  it("a revoking save does not celebrate a tier the true post-save count never reaches", () => {
    const realBuildings: Building[] = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      source: { kind: "entry", entryId: `re${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    const town = freshTown({
      slotsUsedOn: "2026-08-02",
      slotsUsedToday: 1, // the 1 slot the claim itself spent
      nextPlotIndex: 9,
      noSpendDays: ["2026-08-02"],
      highestTierSeen: 0,
    });
    const result = applyNewEntry(
      callArgs({ town, buildings: [...realBuildings, nospendBuilding], entryId: "e14", buildingId: "b14" }),
    );
    expect(result.revokedNoSpend).toEqual({ date: "2026-08-02", buildingId: "park1" });
    expect(result.building).not.toBeNull(); // the expense itself still builds
    expect(result.celebrateTier).toBeNull(); // true count is 9 (8 + revoked park removed + this build), not 10
    expect(result.town.highestTierSeen).toBe(0); // must stay 0 so the REAL 10th building later still celebrates
  });
});
