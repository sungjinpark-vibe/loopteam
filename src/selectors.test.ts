import { describe, expect, it } from "vitest";
import {
  TOWN_COLUMNS,
  advanceStreak,
  budgetPace,
  buildingCount,
  canClaimNoSpend,
  categoryDonut,
  categoryTotals,
  dayGroups,
  grownStructures,
  ladderFor,
  monthTotal,
  monthTotals,
  moodTier,
  plotFromIndex,
  rebuildDerived,
  recentMemos,
  savingsByCategory,
  slotsRemainingToday,
  tier,
  towerSegments,
  unsettledPeriods,
} from "./selectors";
import { savingsBucketOf } from "./savingsBuckets";
import type { Building, LedgerEntry, TownState } from "./types";

// ── plotFromIndex — spec §5 F2 AC: i = 0..23, serpentine adjacency ──
describe("plotFromIndex", () => {
  it("fills row 0 left-to-right for i = 0..TOWN_COLUMNS-1", () => {
    for (let i = 0; i < TOWN_COLUMNS; i++) {
      expect(plotFromIndex(i)).toEqual({ row: 0, col: i });
    }
  });

  it("reverses direction on row 1 (serpentine)", () => {
    // i = TOWN_COLUMNS..2*TOWN_COLUMNS-1 is row 1, right-to-left.
    for (let k = 0; k < TOWN_COLUMNS; k++) {
      expect(plotFromIndex(TOWN_COLUMNS + k)).toEqual({ row: 1, col: TOWN_COLUMNS - 1 - k });
    }
  });

  it("index 6 sits directly below index 5 (the spec's own worked example)", () => {
    const five = plotFromIndex(5);
    const six = plotFromIndex(6);
    expect(five).toEqual({ row: 0, col: 5 });
    expect(six).toEqual({ row: 1, col: 5 });
    expect(six.col).toBe(five.col);
    expect(six.row).toBe(five.row + 1);
  });

  it("i = 0..23 (four full rows) never collide and stay within the grid width", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const { row, col } = plotFromIndex(i);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(TOWN_COLUMNS);
      expect(row).toBe(Math.floor(i / TOWN_COLUMNS));
      const key = `${row},${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("is monotonic-safe: a large index still resolves to a valid, unique plot", () => {
    const a = plotFromIndex(5_403);
    const b = plotFromIndex(5_404);
    expect(a.col).toBeGreaterThanOrEqual(0);
    expect(a.col).toBeLessThan(TOWN_COLUMNS);
    expect(a).not.toEqual(b);
  });
});

// ── buildingCount ──
describe("buildingCount", () => {
  it("is 0 for an empty town and n for n buildings", () => {
    expect(buildingCount([])).toBe(0);
    const buildings = [1, 2, 3].map((i) => makeBuilding(i));
    expect(buildingCount(buildings)).toBe(3);
  });
});

// ── tier ──
describe("tier", () => {
  const thresholds = [0, 10, 30, 80, 200];
  it("returns 0 below every non-zero threshold", () => {
    expect(tier(0, thresholds)).toBe(0);
    expect(tier(9, thresholds)).toBe(0);
  });
  it("returns the largest index whose threshold is met", () => {
    expect(tier(10, thresholds)).toBe(1);
    expect(tier(29, thresholds)).toBe(1);
    expect(tier(200, thresholds)).toBe(4);
    expect(tier(9_999, thresholds)).toBe(4);
  });
});

// ── slotsRemainingToday ──
describe("slotsRemainingToday", () => {
  it("returns the full cap when the stored date is not today", () => {
    const town = { slotsUsedOn: "2026-08-01", slotsUsedToday: 3 };
    expect(slotsRemainingToday(town, "2026-08-02", 5)).toBe(5);
  });
  it("subtracts used slots when the stored date is today", () => {
    const town = { slotsUsedOn: "2026-08-02", slotsUsedToday: 3 };
    expect(slotsRemainingToday(town, "2026-08-02", 5)).toBe(2);
  });
  it("never goes negative", () => {
    const town = { slotsUsedOn: "2026-08-02", slotsUsedToday: 9 };
    expect(slotsRemainingToday(town, "2026-08-02", 5)).toBe(0);
  });
  it("grants nothing when the date is TimeTravel'd backward (spec §5 F4 AC)", () => {
    // slotsUsedOn is LATER than `today` (clock moved back) — must not reset.
    const town = { slotsUsedOn: "2026-08-05", slotsUsedToday: 3 };
    expect(slotsRemainingToday(town, "2026-08-02", 5)).toBe(2);
  });
});

// ── monthTotal / budgetPace / moodTier — spec §5 F6's own worked example ──
describe("monthTotal, budgetPace, moodTier", () => {
  const entries: LedgerEntry[] = [
    makeEntry("expense", 100_000, "2026-06-01"),
    makeEntry("expense", 200_000, "2026-06-10"),
    makeEntry("income", 50_000, "2026-06-05"),
    makeEntry("expense", 999_999, "2026-07-01"), // different month, must not leak in
  ];

  it("sums only the requested type and month", () => {
    expect(monthTotal(entries, "2026-06", "expense")).toBe(300_000);
    expect(monthTotal(entries, "2026-06", "income")).toBe(50_000);
    expect(monthTotal(entries, "2026-07", "expense")).toBe(999_999);
  });

  it("day 15 of a 30-day month, 600,000 budget, 300,000 spent -> pace = 1.0 (spec's own example)", () => {
    const pace = budgetPace(entries, "2026-06", 600_000, "2026-06-15");
    expect(pace).toBe(1.0);
  });

  it("is null when there is no budget", () => {
    expect(budgetPace(entries, "2026-06", null, "2026-06-15")).toBeNull();
  });

  it("a fully-elapsed past month clamps elapsedFraction to 1.0, not a stale day-of-today ratio", () => {
    // Regression: viewing June from August must compare against June's own
    // 600,000 budget in full, not today's day-of-month divided by June's
    // length. All 300,000 logged in June against a 600,000 budget -> 0.5.
    expect(budgetPace(entries, "2026-06", 600_000, "2026-08-03")).toBeCloseTo(0.5);
  });

  it("the current month prorates by day-of-month as before", () => {
    expect(budgetPace(entries, "2026-06", 600_000, "2026-06-15")).toBe(1.0);
  });

  it("a future month has nothing elapsed yet -> null", () => {
    expect(budgetPace(entries, "2026-08", 600_000, "2026-06-15")).toBeNull();
  });

  it("moodTier buckets pace by the thresholds, and is -1 (neutral) with no budget", () => {
    const thresholds = [0.9, 1.1];
    expect(moodTier(0.5, thresholds)).toBe(0);
    expect(moodTier(1.0, thresholds)).toBe(1);
    expect(moodTier(2.0, thresholds)).toBe(2);
    expect(moodTier(null, thresholds)).toBe(-1);
  });
});

// ── categoryTotals ──
describe("categoryTotals", () => {
  it("sums expenses per category, descending, and ignores income/saving", () => {
    const entries: LedgerEntry[] = [
      makeEntry("expense", 10_000, "2026-06-01", "food"),
      makeEntry("expense", 30_000, "2026-06-02", "cafe"),
      makeEntry("expense", 5_000, "2026-06-03", "food"),
      makeEntry("income", 999_999, "2026-06-04", "salary"),
    ];
    expect(categoryTotals(entries, "2026-06")).toEqual([
      { categoryId: "cafe", totalKrw: 30_000 },
      { categoryId: "food", totalKrw: 15_000 },
    ]);
  });

  it("returns an empty list for an empty month, not a broken chart", () => {
    expect(categoryTotals([], "2026-06")).toEqual([]);
  });
});

// ── towerSegments ──
describe("towerSegments", () => {
  const thresholds = [100_000, 300_000, 600_000];
  it("counts thresholds met, 0 for nothing saved", () => {
    expect(towerSegments(0, thresholds)).toBe(0);
    expect(towerSegments(99_999, thresholds)).toBe(0);
    expect(towerSegments(100_000, thresholds)).toBe(1);
    expect(towerSegments(650_000, thresholds)).toBe(3);
  });
});

// ── canClaimNoSpend ──
describe("canClaimNoSpend", () => {
  const town = { slotsUsedOn: "2026-08-02", slotsUsedToday: 2, noSpendDays: ["2026-08-01"] };

  it("is claimable with no expense today, slots free, and not already claimed", () => {
    expect(canClaimNoSpend([], town, "2026-08-02", 5, true)).toBe(true);
  });
  it("is false once any expense exists for today", () => {
    const entries: LedgerEntry[] = [makeEntry("expense", 1_000, "2026-08-02")];
    expect(canClaimNoSpend(entries, town, "2026-08-02", 5, true)).toBe(false);
  });
  it("is false with no slots remaining, when noSpendDayCostsSlot is true (BALANCE.noSpendDayCostsSlot, D-15)", () => {
    const noSlots = { ...town, slotsUsedToday: 5 };
    expect(canClaimNoSpend([], noSlots, "2026-08-02", 5, true)).toBe(false);
  });
  it("ignores the slot cap entirely when noSpendDayCostsSlot is false — the flag actually gates behavior", () => {
    const noSlots = { ...town, slotsUsedToday: 5 };
    expect(canClaimNoSpend([], noSlots, "2026-08-02", 5, false)).toBe(true);
  });
  it("is false if already claimed today", () => {
    const claimedToday = { ...town, noSpendDays: ["2026-08-02"] };
    expect(canClaimNoSpend([], claimedToday, "2026-08-02", 5, true)).toBe(false);
  });
});

// ── advanceStreak — F7 ──
describe("advanceStreak", () => {
  it("a second act the same day leaves town completely unchanged (+1 total, not +2)", () => {
    const town = { lastActOn: "2026-08-02", streakDays: 3, longestStreakDays: 5 };
    expect(advanceStreak(town, "2026-08-02")).toBe(town); // same reference — truly a no-op
  });

  it("increments when the previous act was exactly yesterday", () => {
    const town = { lastActOn: "2026-08-01", streakDays: 3, longestStreakDays: 5 };
    expect(advanceStreak(town, "2026-08-02")).toEqual({ lastActOn: "2026-08-02", streakDays: 4, longestStreakDays: 5 });
  });

  it("resets to 1 after skipping a day, but longestStreakDays is retained", () => {
    const town = { lastActOn: "2026-07-30", streakDays: 10, longestStreakDays: 10 };
    expect(advanceStreak(town, "2026-08-02")).toEqual({ lastActOn: "2026-08-02", streakDays: 1, longestStreakDays: 10 });
  });

  it("longestStreakDays advances when a new streak exceeds the old record", () => {
    const town = { lastActOn: "2026-08-01", streakDays: 5, longestStreakDays: 5 };
    expect(advanceStreak(town, "2026-08-02")).toEqual({ lastActOn: "2026-08-02", streakDays: 6, longestStreakDays: 6 });
  });

  it("first-ever act (lastActOn null) starts the streak at 1", () => {
    const town = { lastActOn: null, streakDays: 0, longestStreakDays: 0 };
    expect(advanceStreak(town, "2026-08-02")).toEqual({ lastActOn: "2026-08-02", streakDays: 1, longestStreakDays: 1 });
  });
});

// ── rebuildDerived ──
describe("rebuildDerived", () => {
  it("returns zero savings and null period for no entries", () => {
    expect(rebuildDerived([])).toEqual({ cumulativeSavingsKrw: 0, lastSettledPeriod: null });
  });

  it("sums only 'saving' entries into cumulativeSavingsKrw", () => {
    const entries: LedgerEntry[] = [
      makeEntry("saving", 50_000, "2026-06-01"),
      makeEntry("expense", 10_000, "2026-06-02"),
      makeEntry("saving", 30_000, "2026-07-01"),
      makeEntry("income", 999_999, "2026-07-02"),
    ];
    // lastSettledPeriod = one month before the EARLIEST touched period
    // (2026-06), not the latest — see the function's own doc comment for why.
    expect(rebuildDerived(entries)).toEqual({ cumulativeSavingsKrw: 80_000, lastSettledPeriod: "2026-05" });
  });

  it("lastSettledPeriod is one month before the earliest period touched, regardless of entry order", () => {
    const entries: LedgerEntry[] = [
      makeEntry("expense", 1_000, "2026-08-15"),
      makeEntry("expense", 1_000, "2026-05-01"),
      makeEntry("expense", 1_000, "2026-12-31"),
    ];
    expect(rebuildDerived(entries).lastSettledPeriod).toBe("2026-04");
  });

  it("never advances lastSettledPeriod past a month that still has entries (crosses a year boundary)", () => {
    const entries: LedgerEntry[] = [makeEntry("expense", 1_000, "2026-01-15")];
    expect(rebuildDerived(entries).lastSettledPeriod).toBe("2025-12");
  });
});

// ── unsettledPeriods ──
describe("unsettledPeriods", () => {
  it("is empty when nothing was ever settled (fresh town)", () => {
    expect(unsettledPeriods(null, "2026-08-02")).toEqual([]);
  });
  it("lists the months strictly between last-settled and current, exclusive of both", () => {
    expect(unsettledPeriods("2026-04", "2026-08-02")).toEqual(["2026-05", "2026-06", "2026-07"]);
  });
  it("is empty when already settled through last month", () => {
    expect(unsettledPeriods("2026-07", "2026-08-02")).toEqual([]);
  });
  it("crosses a year boundary correctly", () => {
    expect(unsettledPeriods("2025-11", "2026-02-01")).toEqual(["2025-12", "2026-01"]);
  });
});

// ── recentMemos ──
describe("recentMemos", () => {
  it("returns up to 6 distinct memos, most recent first, per category", () => {
    const entries: LedgerEntry[] = [
      makeEntryWithMemo("food", "김밥천국", 1),
      makeEntryWithMemo("food", "편의점", 2),
      makeEntryWithMemo("food", "김밥천국", 3), // duplicate memo, should not repeat
      makeEntryWithMemo("cafe", "스타벅스", 4),
    ];
    expect(recentMemos(entries, "food")).toEqual(["김밥천국", "편의점"]);
  });

  it("shows no chips for a category never used", () => {
    expect(recentMemos([], "etc")).toEqual([]);
  });

  it("caps at 6 distinct memos", () => {
    const entries: LedgerEntry[] = Array.from({ length: 10 }, (_, i) => makeEntryWithMemo("food", `memo-${i}`, i));
    expect(recentMemos(entries, "food")).toHaveLength(6);
  });
});

// ── test helpers ──
let idCounter = 0;
function makeBuilding(seed: number): Building {
  return {
    id: `b${seed}`,
    source: { kind: "entry", entryId: `e${seed}` },
    categoryId: "food",
    variantIndex: 0,
    plotIndex: seed,
    builtOn: "2026-08-01",
    createdAt: 1,
  };
}
function makeEntry(
  type: LedgerEntry["type"],
  amountKrw: number,
  occurredOn: string,
  categoryId: LedgerEntry["categoryId"] = "food",
): LedgerEntry {
  idCounter += 1;
  return {
    id: `e${idCounter}`,
    type,
    amountKrw,
    categoryId,
    occurredOn,
    createdAt: idCounter,
    updatedAt: idCounter,
    buildingId: null,
    queued: false,
  };
}
function makeEntryWithMemo(categoryId: LedgerEntry["categoryId"], memo: string, createdAt: number): LedgerEntry {
  idCounter += 1;
  return {
    id: `e${idCounter}`,
    type: "expense",
    amountKrw: 1_000,
    categoryId,
    occurredOn: "2026-08-01",
    memo,
    createdAt,
    updatedAt: createdAt,
    buildingId: null,
    queued: false,
  };
}

// ── ADDENDUM-01 §2.5/§4.2/§2.6a — APPEND ONLY (ladderFor/savingsByCategory/grownStructures) ──

describe("ladderFor", () => {
  const DEFAULT = [1, 2, 3];
  it("returns the default ladder (reference-equal) for every id when overrides is {}", () => {
    for (const id of ["deposit", "stock", "emergency", "goal", "other_saving"] as const) {
      expect(ladderFor(id, DEFAULT, {})).toBe(DEFAULT);
    }
  });
  it("returns the override for the overridden id, and the default for every other", () => {
    const OTHER = [5, 10];
    const overrides = { stock: OTHER };
    expect(ladderFor("stock", DEFAULT, overrides)).toBe(OTHER);
    expect(ladderFor("deposit", DEFAULT, overrides)).toBe(DEFAULT);
    expect(ladderFor("emergency", DEFAULT, overrides)).toBe(DEFAULT);
  });
});

describe("savingsByCategory", () => {
  it("sums only type==='saving' entries, buckets legacy invest via bucketOf, ignores expense/income", () => {
    const entries: LedgerEntry[] = [
      makeEntry("saving", 10_000, "2026-08-01", "deposit"),
      makeEntry("saving", 5_000, "2026-08-02", "deposit"),
      makeEntry("saving", 7_000, "2026-08-03", "invest" as unknown as LedgerEntry["categoryId"]), // legacy — aliases to stock
      makeEntry("expense", 999, "2026-08-01", "food"),
      makeEntry("income", 999, "2026-08-01", "salary"),
    ];
    const totals = savingsByCategory(entries, savingsBucketOf);
    expect(totals).toEqual({ deposit: 15_000, stock: 7_000 });
  });

  it("matches rebuildDerived's total (AC-F13-4's cross-check)", () => {
    const entries: LedgerEntry[] = [
      makeEntry("saving", 10_000, "2026-08-01", "goal"),
      makeEntry("saving", 30_000, "2026-08-02", "emergency"),
    ];
    const byCategory = savingsByCategory(entries, savingsBucketOf);
    const sum = Object.values(byCategory).reduce((a, b) => a + (b ?? 0), 0);
    expect(sum).toBe(rebuildDerived(entries).cumulativeSavingsKrw);
  });
});

describe("grownStructures", () => {
  const ladderOf = () => [100_000, 300_000];

  it("returns the id that crossed a threshold, [] when it did not cross, [] when nothing moved", () => {
    const before: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: { deposit: 50_000 } };
    const crossed: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: { deposit: 150_000 } };
    const notCrossed: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: { deposit: 90_000 } };
    expect(grownStructures(before, crossed, ladderOf)).toEqual(["deposit"]);
    expect(grownStructures(before, notCrossed, ladderOf)).toEqual([]);
    expect(grownStructures(before, before, ladderOf)).toEqual([]);
  });

  it("handles an id absent from `before` entirely", () => {
    const before: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: {} };
    const after: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: { stock: 100_000 } };
    expect(grownStructures(before, after, ladderOf)).toEqual(["stock"]);
  });

  it("returns at most one id for a normal single-bucket save", () => {
    const before: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: { deposit: 50_000, stock: 50_000 } };
    const after: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: { deposit: 150_000, stock: 50_000 } };
    const grown = grownStructures(before, after, ladderOf);
    expect(grown).toEqual(["deposit"]);
  });

  // Round-4 finding C2 #5 — the exact case that produced a doubled toast
  // live (one save crossing MULTIPLE rungs at once) had zero coverage.
  // `grownStructures` counts a level via `towerSegments` (thresholds
  // crossed), not "did it cross exactly one", so one save jumping several
  // rungs on the SAME structure must still return that id exactly ONCE —
  // never once per rung crossed.
  it("a single save crossing MULTIPLE thresholds on the same structure still returns that id exactly once, not once per rung", () => {
    const multiRungLadder = () => [100_000, 300_000, 600_000, 1_000_000];
    const before: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: { deposit: 0 } };
    const after: Pick<TownState, "savingsByCategoryKrw"> = { savingsByCategoryKrw: { deposit: 999_999 } }; // crosses 3 of 4 rungs (0 -> level 3)
    const grown = grownStructures(before, after, multiRungLadder);
    expect(grown).toEqual(["deposit"]);
    expect(grown.length).toBe(1);
  });
});

// ── F8 기록 selectors — MVP-SPEC §5 F8 / §8.2 ──

describe("monthTotals", () => {
  it("sums each type for the month and derives netKrw = income - expense", () => {
    const entries: LedgerEntry[] = [
      makeEntry("expense", 10_000, "2026-08-01"),
      makeEntry("expense", 5_000, "2026-08-02"),
      makeEntry("income", 30_000, "2026-08-03"),
      makeEntry("saving", 20_000, "2026-08-04"),
      makeEntry("expense", 999_999, "2026-07-01"), // different month, must not leak in
    ];
    expect(monthTotals(entries, "2026-08")).toEqual({
      expenseKrw: 15_000,
      incomeKrw: 30_000,
      savingKrw: 20_000,
      netKrw: 15_000,
    });
  });

  it("an empty month totals all zero", () => {
    expect(monthTotals([], "2026-08")).toEqual({ expenseKrw: 0, incomeKrw: 0, savingKrw: 0, netKrw: 0 });
  });
});

describe("categoryDonut", () => {
  it("empty month -> [] (no divide-by-zero, no broken chart)", () => {
    expect(categoryDonut([], "2026-08")).toEqual([]);
  });

  it("descending by amount, and percentages sum to exactly 100", () => {
    const entries: LedgerEntry[] = [
      makeEntry("expense", 60_000, "2026-08-01", "food"),
      makeEntry("expense", 30_000, "2026-08-02", "cafe"),
      makeEntry("expense", 10_000, "2026-08-03", "transport"),
    ];
    const slices = categoryDonut(entries, "2026-08");
    expect(slices.map((s) => s.categoryId)).toEqual(["food", "cafe", "transport"]);
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it("a three-way split that would naively round to 99 or 101 still sums to exactly 100", () => {
    // 1/3 each -> 33.33...% naive-rounds to 33 x 3 = 99.
    const entries: LedgerEntry[] = [
      makeEntry("expense", 1_000, "2026-08-01", "food"),
      makeEntry("expense", 1_000, "2026-08-02", "cafe"),
      makeEntry("expense", 1_000, "2026-08-03", "transport"),
    ];
    const slices = categoryDonut(entries, "2026-08");
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
    for (const s of slices) expect(s.percent === 33 || s.percent === 34).toBe(true);
  });

  it("ignores income/saving and other months", () => {
    const entries: LedgerEntry[] = [
      makeEntry("expense", 10_000, "2026-08-01", "food"),
      makeEntry("income", 999_999, "2026-08-02", "salary"),
      makeEntry("saving", 999_999, "2026-08-03", "goal"),
      makeEntry("expense", 999_999, "2026-07-01", "food"),
    ];
    expect(categoryDonut(entries, "2026-08")).toEqual([{ categoryId: "food", totalKrw: 10_000, percent: 100 }]);
  });
});

describe("dayGroups", () => {
  it("groups entries by day, most recent day first, most-recently-created entry first within a day", () => {
    const entries: LedgerEntry[] = [
      { ...makeEntry("expense", 1_000, "2026-08-01"), createdAt: 1 },
      { ...makeEntry("expense", 2_000, "2026-08-01"), createdAt: 2 },
      { ...makeEntry("income", 5_000, "2026-08-03"), createdAt: 3 },
    ];
    const groups = dayGroups(entries, [], "2026-08");
    expect(groups.map((g) => g.date)).toEqual(["2026-08-03", "2026-08-01"]);
    expect(groups[1].entries.map((e) => e.amountKrw)).toEqual([2_000, 1_000]); // createdAt desc
    expect(groups[1].expenseKrw).toBe(3_000);
  });

  it("a claimed 무지출 데이 with zero entries still produces a distinct zero-amount row", () => {
    const groups = dayGroups([], ["2026-08-05"], "2026-08");
    expect(groups).toEqual([{ date: "2026-08-05", entries: [], isNoSpend: true, expenseKrw: 0, incomeKrw: 0, savingKrw: 0 }]);
  });

  it("a day with both a no-spend claim and other entries (income logged) keeps both", () => {
    const entries: LedgerEntry[] = [makeEntry("income", 5_000, "2026-08-05")];
    const groups = dayGroups(entries, ["2026-08-05"], "2026-08");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ date: "2026-08-05", isNoSpend: true, incomeKrw: 5_000 });
    expect(groups[0].entries).toHaveLength(1);
  });

  it("filters no-spend days and entries outside the requested month", () => {
    const entries: LedgerEntry[] = [makeEntry("expense", 1_000, "2026-07-15")];
    const groups = dayGroups(entries, ["2026-07-20"], "2026-08");
    expect(groups).toEqual([]);
  });
});
