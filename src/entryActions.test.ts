import { describe, expect, it } from "vitest";
import { plotFromIndex } from "./selectors";
import { applyNewEntry, type EntryDraft } from "./entryActions";
import type { TownState } from "./types";

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

describe("applyNewEntry", () => {
  it("places a building via plotFromIndex(nextPlotIndex) and consumes one slot when slots remain", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry({
      town,
      draft,
      entryId: "e1",
      buildingId: "b1",
      createdAt: 1000,
      today: "2026-08-02",
      dailyBuildSlots: 5,
      variantIndex: 0,
    });

    expect(result.building).not.toBeNull();
    expect(result.building?.plotIndex).toBe(0);
    expect(result.building?.source).toEqual({ kind: "entry", entryId: "e1" });
    expect(plotFromIndex(result.building!.plotIndex)).toEqual({ row: 0, col: 0 });
    expect(result.entry.buildingId).toBe("b1");
    expect(result.town.nextPlotIndex).toBe(1);
    expect(result.town.slotsUsedToday).toBe(1);
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
  });

  it("amount never changes building count — a huge amount still places exactly one building", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry({
      town,
      draft: { ...draft, amountKrw: 1_000_000 },
      entryId: "e2",
      buildingId: "b2",
      createdAt: 2000,
      today: "2026-08-02",
      dailyBuildSlots: 5,
      variantIndex: 1,
    });
    expect(result.building?.plotIndex).toBe(0);
    expect(result.town.nextPlotIndex).toBe(1);
  });

  it("saves ledger-only, no building, when no slot remains (F14 out of scope)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, nextPlotIndex: 5 });
    const result = applyNewEntry({
      town,
      draft,
      entryId: "e3",
      buildingId: "b3",
      createdAt: 3000,
      today: "2026-08-02",
      dailyBuildSlots: 5,
      variantIndex: 0,
    });
    expect(result.building).toBeNull();
    expect(result.entry.buildingId).toBeNull();
    expect(result.town).toBe(town); // untouched
  });

  it("resets the slot count when slotsUsedOn is stale (new day)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5, nextPlotIndex: 5 });
    const result = applyNewEntry({
      town,
      draft,
      entryId: "e4",
      buildingId: "b4",
      createdAt: 4000,
      today: "2026-08-02",
      dailyBuildSlots: 5,
      variantIndex: 0,
    });
    expect(result.building).not.toBeNull();
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
    expect(result.town.slotsUsedToday).toBe(1);
    expect(result.town.nextPlotIndex).toBe(6);
  });

  it("saving entries never build and never consume a slot (F13)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry({
      town,
      draft: { type: "saving", amountKrw: 50_000, categoryId: "goal", occurredOn: "2026-08-02" },
      entryId: "e5",
      buildingId: "b5",
      createdAt: 5000,
      today: "2026-08-02",
      dailyBuildSlots: 5,
      variantIndex: 0,
    });
    expect(result.building).toBeNull();
    expect(result.town).toBe(town);
  });
});
