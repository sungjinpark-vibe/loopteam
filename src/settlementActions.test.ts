import { describe, expect, it } from "vitest";
import { seededRandom } from "./platform/random";
import { MONUMENT_CHRONOLOGICAL_PLOTS, settleMonths } from "./settlementActions";
import { anchorsFor, placeMonument } from "./placement";
import type { Placed } from "./placement";
import { footprintCells } from "./townLayout";
import type { Building, LedgerEntry, TownState } from "./types";

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

const moodPaceThresholds = [0.9, 1.1];

// Same deterministic stand-in `queueActions.test.ts` uses for the injected
// allocator — a real one draws randomly from the open town (placement.placeMany).
function seqAlloc(start: number): (count: number) => Placed[] {
  return (count) => Array.from({ length: count }, (_, i) => ({ anchor: start + i, w: 1, h: 1 }));
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
    town: freshTown({ lastSettledPeriod: "2026-04" }),
    today: "2026-08-01",
    entriesForPeriod: () => [],
    budgetKrw: 300_000,
    moodPaceThresholds,
    buildingIdFor: (i) => `mon${i}`,
    createdAt: 1000,
    placeMany: seqAlloc(10),
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
    const town = freshTown({ lastSettledPeriod: "2026-04" });
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
    expect(result.town.lastSettledPeriod).toBe("2026-07");
    // no build slot consumed, no streak advanced
    expect(result.town.slotsUsedToday).toBe(0);
    expect(result.town.streakDays).toBe(0);
  });

  it("ADDENDUM-08 §2.2 — the stored footprint is EXACTLY whatever the injected placement reserved, never overridden (a forced-2x2 override previously let a monument claim cells placement never reserved — bug, fixed)", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06" });
    const oneByOne: (count: number) => Placed[] = (count) =>
      Array.from({ length: count }, (_, i) => ({ anchor: 20 + i, w: 1, h: 1 }));
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", placeMany: oneByOne }));
    expect(result.monuments).toHaveLength(1);
    expect(result.monuments[0].w).toBe(1); // trusted verbatim, not forced to 2x2
    expect(result.monuments[0].h).toBe(1);
    expect(result.monuments[0].plotIndex).toBe(20);
  });

  it("wired to the real placement.placeMonument, a monument is 2x2 on a normal (empty) town", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06" });
    const rng = seededRandom(1);
    const real: (count: number) => Placed[] = (count) => {
      const out: Placed[] = [];
      let buildings: Building[] = [];
      for (let i = 0; i < count; i++) {
        const placed = placeMonument(buildings, rng);
        if (placed === null) break;
        out.push(placed);
        buildings = [...buildings, { id: `m${i}`, source: { kind: "monument", period: "x" }, categoryId: null, variantIndex: 0, plotIndex: placed.anchor, w: placed.w, h: placed.h, builtOn: "2026-08-01", createdAt: i }];
      }
      return out;
    };
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", placeMany: real }));
    expect(result.monuments).toHaveLength(1);
    expect(result.monuments[0].w).toBe(2);
    expect(result.monuments[0].h).toBe(2);
  });

  it("wired to the real placement.placeMonument on a town with no 2x2 room, the monument is smaller and overlaps nothing", () => {
    // Occupy every ground cell so no 2x2 (or anything but the last 1x1) fits.
    const allGround = anchorsFor(1, 1, new Set());
    const gap = allGround[0];
    const existing: Building[] = allGround
      .filter((i) => i !== gap)
      .map((i, idx) => ({ id: `f${idx}`, source: { kind: "entry", entryId: `e${idx}` }, categoryId: "cafe", variantIndex: 0, plotIndex: i, builtOn: "2026-08-01", createdAt: idx }));

    const town = freshTown({ lastSettledPeriod: "2026-06" });
    const rng = () => 0.95; // biases placeNew's fallback roll toward 2x2, which still has no room
    const real: (count: number) => Placed[] = (count) => {
      const out: Placed[] = [];
      let buildings = existing;
      for (let i = 0; i < count; i++) {
        const placed = placeMonument(buildings, rng);
        if (placed === null) break;
        out.push(placed);
        buildings = [...buildings, { id: `m${i}`, source: { kind: "monument", period: "x" }, categoryId: null, variantIndex: 0, plotIndex: placed.anchor, w: placed.w, h: placed.h, builtOn: "2026-08-01", createdAt: 1000 + i }];
      }
      return out;
    };
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", placeMany: real }));
    expect(result.monuments).toHaveLength(1);
    expect(result.monuments[0].w).toBe(1); // downgraded — no 2x2 anchor existed
    expect(result.monuments[0].h).toBe(1);
    expect(result.monuments[0].plotIndex).toBe(gap); // the one cell that was actually free

    // No overlap with any pre-existing building.
    const claimed = new Set<number>();
    for (const b of existing) for (const c of footprintCells(b.plotIndex, 1, 1)) claimed.add(c);
    for (const c of footprintCells(result.monuments[0].plotIndex, result.monuments[0].w!, result.monuments[0].h!)) {
      expect(claimed.has(c)).toBe(false);
    }
  });

  it("ADDENDUM-08 §3.1 — a full town settles only as many months as placeMany could seat, the rest stay unsettled", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04" }); // 3 unsettled months: 05, 06, 07
    const onlyOne: (count: number) => Placed[] = () => [{ anchor: 5, w: 2, h: 2 }];
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", placeMany: onlyOne }));
    expect(result.monuments).toHaveLength(1);
    expect(result.monuments[0].source).toEqual({ kind: "monument", period: "2026-05" });
    expect(result.town.lastSettledPeriod).toBe("2026-05"); // not 07 — 06/07 retry on the next call
  });

  it("re-running settlement with the same today mints nothing further (idempotent)", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04" });
    const first = settleMonths(baseArgs({ town, today: "2026-08-01" }));
    const second = settleMonths(baseArgs({ town: first.town, today: "2026-08-01" }));
    expect(second.monuments).toEqual([]);
    expect(second.town).toBe(first.town);
  });

  it("a zero-entry month lands in the 'no data' bucket (0) without crashing", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06" });
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", entriesForPeriod: () => [] }));
    expect(result.monuments).toHaveLength(1);
    expect(result.monuments[0].variantIndex).toBe(0);
    expect(result.monuments[0].monumentSummary?.outcomeBucket).toBe(0);
    expect(result.monuments[0].monumentSummary?.daysLogged).toBe(0);
  });

  it("budgetKrw === null lands in the 'no data' bucket without dividing by zero, even with entries", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06" });
    const entries = [entry({ occurredOn: "2026-07-05", amountKrw: 5000 })];
    const result = settleMonths(
      baseArgs({ town, today: "2026-08-01", budgetKrw: null, entriesForPeriod: () => entries }),
    );
    expect(result.monuments[0].monumentSummary?.outcomeBucket).toBe(0);
    expect(result.monuments[0].monumentSummary?.budgetKrw).toBeNull();
    expect(result.monuments[0].monumentSummary?.expenseKrw).toBe(5000);
  });

  it("computes frozen expense/income/saving totals and a real pace bucket when a budget is set", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06" });
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
    const town = freshTown({ lastSettledPeriod: "2026-04", slotsUsedOn: "2026-08-01", slotsUsedToday: 4 });
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
    const town = freshTown({ lastSettledPeriod: "2026-04" });
    // A real allocator (placement.placeMany) can hand back anchors out of
    // ascending order — that's the bug report's 56/57/59 -> 05/07/06 case.
    const shuffled: (count: number) => Placed[] = () => [
      { anchor: 59, w: 1, h: 1 },
      { anchor: 56, w: 1, h: 1 },
      { anchor: 57, w: 1, h: 1 },
    ];
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", placeMany: shuffled }));
    expect(result.monuments.map((b) => b.plotIndex)).toEqual([59, 56, 57]);
  });

  it("on: monuments land on ascending plot indices in chronological (oldest-first) period order, regardless of draw order", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04" });
    const shuffled: (count: number) => Placed[] = () => [
      { anchor: 59, w: 1, h: 1 },
      { anchor: 56, w: 1, h: 1 },
      { anchor: 57, w: 1, h: 1 },
    ];
    const result = settleMonths(
      baseArgs({ town, today: "2026-08-01", placeMany: shuffled, chronologicalPlots: true }),
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
