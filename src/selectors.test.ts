import { describe, expect, it } from "vitest";
import {
  TOWN_COLUMNS,
  budgetPace,
  buildingCount,
  canClaimNoSpend,
  categoryTotals,
  monthTotal,
  moodTier,
  plotFromIndex,
  rebuildDerived,
  recentMemos,
  slotsRemainingToday,
  tier,
  towerSegments,
  unsettledPeriods,
} from "./selectors";
import type { Building, LedgerEntry } from "./types";

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
    expect(rebuildDerived(entries)).toEqual({ cumulativeSavingsKrw: 80_000, lastSettledPeriod: "2026-07" });
  });

  it("lastSettledPeriod is the latest period touched, regardless of entry order", () => {
    const entries: LedgerEntry[] = [
      makeEntry("expense", 1_000, "2026-08-15"),
      makeEntry("expense", 1_000, "2026-05-01"),
      makeEntry("expense", 1_000, "2026-12-31"),
    ];
    expect(rebuildDerived(entries).lastSettledPeriod).toBe("2026-12");
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
