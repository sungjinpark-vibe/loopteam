import { describe, expect, it } from "vitest";
import { MONUMENT_CHRONOLOGICAL_PLOTS, settleMonths } from "./settlementActions";
import type { LedgerEntry, TownState } from "./types";

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

const moodPaceThresholds = [0.9, 1.1];

// Same deterministic stand-in `queueActions.test.ts` uses for the injected
// allocator — a real one draws randomly from the open pool (placement.ts).
function seqAlloc(start: number): (count: number) => number[] {
  return (count) => Array.from({ length: count }, (_, i) => start + i);
}

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "e",
    type: "expense",
    amountKrw: 1000,
    categoryId: "food",
    occurredOn: "2026-05-10",
    createdAt: 0,
    updatedAt: 0,
    buildingId: null,
    queued: false,
    ...overrides,
  };
}

function baseArgs(overrides: Partial<Parameters<typeof settleMonths>[0]> = {}): Parameters<typeof settleMonths>[0] {
  return {
    town: freshTown({ lastSettledPeriod: "2026-04", nextPlotIndex: 10 }),
    today: "2026-08-01",
    entriesForPeriod: () => [],
    budgetKrw: 300_000,
    moodPaceThresholds,
    buildingIdFor: (i) => `mon${i}`,
    createdAt: 1000,
    allocatePlotIndices: seqAlloc(10),
    ...overrides,
  };
}

describe("settleMonths — F16", () => {
  it("mints nothing and returns the same town when nothing is unsettled", () => {
    const town = freshTown({ lastSettledPeriod: "2026-07" });
    const result = settleMonths(baseArgs({ town, today: "2026-08-01" }));
    expect(result.monuments).toEqual([]);
    expect(result.town).toBe(town);
  });

  it("a 3-month gap mints exactly 3 monuments, oldest first, each carrying its own YYYY-MM, in chronological plot order", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04", nextPlotIndex: 10 });
    const result = settleMonths(baseArgs({ town, today: "2026-08-01" }));

    expect(result.monuments).toHaveLength(3);
    expect(result.monuments.map((b) => b.source)).toEqual([
      { kind: "monument", period: "2026-05" },
      { kind: "monument", period: "2026-06" },
      { kind: "monument", period: "2026-07" },
    ]);
    // chronological plot order: earlier months land on earlier plots, in the
    // same order the allocator handed indices back.
    expect(result.monuments.map((b) => b.plotIndex)).toEqual([10, 11, 12]);
    expect(result.town.nextPlotIndex).toBe(13);
    expect(result.town.lastSettledPeriod).toBe("2026-07");
    // no build slot consumed, no streak advanced
    expect(result.town.slotsUsedToday).toBe(0);
    expect(result.town.streakDays).toBe(0);
  });

  it("re-running settlement with the same today mints nothing further (idempotent)", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04", nextPlotIndex: 10 });
    const first = settleMonths(baseArgs({ town, today: "2026-08-01" }));
    const second = settleMonths(baseArgs({ town: first.town, today: "2026-08-01" }));
    expect(second.monuments).toEqual([]);
    expect(second.town).toBe(first.town);
  });

  it("a zero-entry month lands in the 'no data' bucket (0) without crashing", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06", nextPlotIndex: 0 });
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", entriesForPeriod: () => [] }));
    expect(result.monuments).toHaveLength(1);
    expect(result.monuments[0].variantIndex).toBe(0);
    expect(result.monuments[0].monumentSummary?.outcomeBucket).toBe(0);
    expect(result.monuments[0].monumentSummary?.daysLogged).toBe(0);
  });

  it("budgetKrw === null lands in the 'no data' bucket without dividing by zero, even with entries", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06", nextPlotIndex: 0 });
    const entries = [entry({ occurredOn: "2026-07-05", amountKrw: 5000 })];
    const result = settleMonths(
      baseArgs({ town, today: "2026-08-01", budgetKrw: null, entriesForPeriod: () => entries }),
    );
    expect(result.monuments[0].monumentSummary?.outcomeBucket).toBe(0);
    expect(result.monuments[0].monumentSummary?.budgetKrw).toBeNull();
    expect(result.monuments[0].monumentSummary?.expenseKrw).toBe(5000);
  });

  it("computes frozen expense/income/saving totals and a real pace bucket when a budget is set", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06", nextPlotIndex: 0 });
    const entries = [
      entry({ id: "e1", type: "expense", amountKrw: 100_000, occurredOn: "2026-07-01" }),
      entry({ id: "e2", type: "expense", amountKrw: 50_000, occurredOn: "2026-07-02" }),
      entry({ id: "e3", type: "income", categoryId: "salary", amountKrw: 2_000_000, occurredOn: "2026-07-03" }),
      entry({ id: "e4", type: "saving", categoryId: "goal", amountKrw: 300_000, occurredOn: "2026-07-04" }),
    ];
    const result = settleMonths(
      baseArgs({ town, today: "2026-08-01", budgetKrw: 300_000, entriesForPeriod: () => entries }),
    );
    const summary = result.monuments[0].monumentSummary!;
    expect(summary.period).toBe("2026-07");
    expect(summary.expenseKrw).toBe(150_000);
    expect(summary.incomeKrw).toBe(2_000_000);
    expect(summary.savingKrw).toBe(300_000);
    expect(summary.daysLogged).toBe(4);
    // 150,000 / 300,000 budget (past month => fully elapsed) = 0.5 pace, under both thresholds -> moodTier 0 -> bucket 1
    expect(summary.outcomeBucket).toBe(1);
    expect(result.monuments[0].categoryId).toBeNull();
    expect(result.monuments[0].variantIndex).toBe(1);
  });

  it("monument buildings never advance the F7 streak or consume a build slot even across multiple months", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04", nextPlotIndex: 0, slotsUsedOn: "2026-08-01", slotsUsedToday: 4 });
    const result = settleMonths(baseArgs({ town, today: "2026-08-01" }));
    expect(result.town.slotsUsedToday).toBe(4); // untouched
    expect(result.town.slotsUsedOn).toBe("2026-08-01"); // untouched
    expect(result.town.lastActOn).toBeNull(); // untouched
    expect(result.town.streakDays).toBe(0); // untouched
  });
});

// MONUMENT_CHRONOLOGICAL_PLOTS (director decision, 2026-08-09) — MVP-SPEC F16 AC
// ("chronological plot order") vs ADDENDUM-02 R-5 (random draw) conflict.
// Implemented behind a flag, shipped OFF: ADDENDUM-02's random placement is
// the shipped behaviour.
describe("settleMonths — MONUMENT_CHRONOLOGICAL_PLOTS", () => {
  it("defaults to off", () => {
    expect(MONUMENT_CHRONOLOGICAL_PLOTS).toBe(false);
  });

  it("off (default): plot indices are used in exactly the order the allocator drew them — today's random placement, unchanged", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04", nextPlotIndex: 10 });
    // A real allocator (placement.allocatePlots) can hand back indices out of
    // ascending order — that's the bug report's 56/57/59 -> 05/07/06 case.
    const shuffled = () => [59, 56, 57];
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", allocatePlotIndices: shuffled }));
    expect(result.monuments.map((b) => b.plotIndex)).toEqual([59, 56, 57]);
  });

  it("on: monuments land on ascending plot indices in chronological (oldest-first) period order, regardless of draw order", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04", nextPlotIndex: 10 });
    const shuffled = () => [59, 56, 57];
    const result = settleMonths(
      baseArgs({ town, today: "2026-08-01", allocatePlotIndices: shuffled, chronologicalPlots: true }),
    );
    expect(result.monuments.map((b) => b.source)).toEqual([
      { kind: "monument", period: "2026-05" },
      { kind: "monument", period: "2026-06" },
      { kind: "monument", period: "2026-07" },
    ]);
    // ascending, and paired oldest-period-to-smallest-index
    expect(result.monuments.map((b) => b.plotIndex)).toEqual([56, 57, 59]);
  });
});
