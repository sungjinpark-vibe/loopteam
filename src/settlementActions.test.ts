import { describe, expect, it } from "vitest";
import { seededRandom } from "./platform/random";
import { MONUMENT_CHRONOLOGICAL_PLOTS, settleMonths } from "./settlementActions";
import { placeMonument } from "./placement";
import type { Placed } from "./placement";
import { townWithOneFreeCell } from "./testUtils/saturatedTown";
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
    // Gate-3-rerun fix: a zero-entry month no longer mints a monument (see
    // `settleMonths`'s own doc), so tests exercising monument mechanics
    // (placement/footprint/order) need a non-empty default month — the
    // dedicated zero-entry test below overrides this back to `[]`.
    entriesForPeriod: () => [entry()],
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
    // A town with exactly one free cell and no 2x2/2x1/1x2 anchor anywhere,
    // saturated through the placer so it is a state the game can actually reach.
    const { buildings: existing, gap } = townWithOneFreeCell();

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

  // Gate-3-rerun fix — a month with literally zero activity mints no
  // monument at all (the top reward tile stays reserved for a month the
  // player actually lived), but still settles so it's never retried forever.
  it("a zero-entry month settles with NO monument — never mints one for a month with nothing in it", () => {
    const town = freshTown({ lastSettledPeriod: "2026-06" });
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", entriesForPeriod: () => [] }));
    expect(result.monuments).toEqual([]);
    expect(result.town.lastSettledPeriod).toBe("2026-07"); // still advances — not stuck retrying
  });

  it("an empty month between two active ones settles without a monument, without blocking the active month after it", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04" }); // unsettled: 05 (active), 06 (empty), 07 (active)
    const result = settleMonths(
      baseArgs({
        town,
        today: "2026-08-01",
        entriesForPeriod: (period) => (period === "2026-06" ? [] : [entry({ occurredOn: `${period}-10` })]),
      }),
    );
    expect(result.monuments.map((b) => b.source)).toEqual([
      { kind: "monument", period: "2026-05" },
      { kind: "monument", period: "2026-07" },
    ]);
    expect(result.town.lastSettledPeriod).toBe("2026-07"); // 06 still settled, just no plot
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

// MONUMENT_CHRONOLOGICAL_PLOTS — MVP-SPEC F16 AC ("chronological plot
// order") vs ADDENDUM-02 R-5 (random draw) conflict. Director decision
// 2026-08-09: implement behind a flag, ship OFF (T022). User decision
// 2026-08-13: turn it ON — this describe block was edited (not just
// extended) to match: the old "defaults to off" / "off (default): ..."
// assertions asserted the now-superseded shipped state, so they're rewritten
// below to assert the new default instead of left green-but-wrong.
describe("settleMonths — MONUMENT_CHRONOLOGICAL_PLOTS", () => {
  it("defaults to on (user decision 2026-08-13)", () => {
    expect(MONUMENT_CHRONOLOGICAL_PLOTS).toBe(true);
  });

  it("default (no override passed): monuments land in chronological (oldest-first) plot order, regardless of draw order", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04" });
    // A real allocator (placement.placeMany) can hand back anchors out of
    // ascending order — that's the bug report's 56/57/59 -> 05/07/06 case.
    const shuffled: (count: number) => Placed[] = () => [
      { anchor: 59, w: 1, h: 1 },
      { anchor: 56, w: 1, h: 1 },
      { anchor: 57, w: 1, h: 1 },
    ];
    const result = settleMonths(baseArgs({ town, today: "2026-08-01", placeMany: shuffled }));
    expect(result.monuments.map((b) => b.source)).toEqual([
      { kind: "monument", period: "2026-05" },
      { kind: "monument", period: "2026-06" },
      { kind: "monument", period: "2026-07" },
    ]);
    // ascending, and paired oldest-period-to-smallest-index
    expect(result.monuments.map((b) => b.plotIndex)).toEqual([56, 57, 59]);
  });

  it("override false: legacy random-draw-order placement is still reachable (plot indices used in exactly the order the allocator drew them)", () => {
    const town = freshTown({ lastSettledPeriod: "2026-04" });
    const shuffled: (count: number) => Placed[] = () => [
      { anchor: 59, w: 1, h: 1 },
      { anchor: 56, w: 1, h: 1 },
      { anchor: 57, w: 1, h: 1 },
    ];
    const result = settleMonths(
      baseArgs({ town, today: "2026-08-01", placeMany: shuffled, chronologicalPlots: false }),
    );
    expect(result.monuments.map((b) => b.plotIndex)).toEqual([59, 56, 57]);
  });

  it("grandfathering: turning the flag ON never moves a monument minted by an earlier settleMonths call — a legacy town's monuments stay exactly where they were", () => {
    const town0 = freshTown({ lastSettledPeriod: "2026-04" });
    const shuffled: (count: number) => Placed[] = () => [
      { anchor: 59, w: 1, h: 1 },
      { anchor: 56, w: 1, h: 1 },
      { anchor: 57, w: 1, h: 1 },
    ];
    // Simulates monuments placed under the OLD (off) behaviour, as they'd
    // sit in a town saved before this flag flipped.
    const legacyRun = settleMonths(
      baseArgs({ town: town0, today: "2026-08-01", placeMany: shuffled, chronologicalPlots: false }),
    );
    const legacyMonuments = legacyRun.monuments;
    expect(legacyMonuments.map((b) => b.plotIndex)).toEqual([59, 56, 57]); // pre-existing, draw-order plots

    // `settleMonths` never re-reads or re-sorts monuments from a prior call
    // (it has no `buildings` param at all — see `SettleMonthsArgs`) — only
    // the caller (`useTownStore.ts`) appends `monuments` to the existing
    // array. A later settle run, now defaulting to chronological ON, must
    // mint only a NEW monument and leave `legacyMonuments` untouched.
    const laterRun = settleMonths(baseArgs({ town: legacyRun.town, today: "2026-09-01", placeMany: () => [{ anchor: 10, w: 1, h: 1 }] }));
    expect(laterRun.monuments).toHaveLength(1);
    expect(laterRun.monuments[0].source).toEqual({ kind: "monument", period: "2026-08" });
    // legacy monuments, held in the caller's own array, are byte-identical —
    // nothing in this module could have touched them.
    expect(legacyMonuments.map((b) => b.plotIndex)).toEqual([59, 56, 57]);
  });
});
