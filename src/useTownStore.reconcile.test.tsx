/**
 * ADDENDUM-08 §3.6/§4 — the boot-time self-healing reconciler AND the
 * version-4 migration (the fixed 20x20 map replacing the growing/serpentine
 * town), exercised through the real hook (not just `placement.test.ts`'s
 * pure-function unit). Same bare createRoot+act hook-harness pattern
 * `useTownStore.test.tsx` uses.
 *
 * AC-R2 / AC-R3: a valid town (built through the real placement pipeline)
 * boots with zero storage writes and every building on its original cell.
 * AC-R1 (boot level): a corrupt/duplicate `plotIndex` is repaired silently,
 * with a write only for the affected month chunk(s), in ascending `ym`
 * order, and exactly one `placement_repaired` analytics event per boot.
 *
 * §4 (this task's headline deliverable): a version<4 save forces every
 * building to be re-seated in the new 20x20 coordinate space — every
 * building survives (id/source/categoryId/exp/builtOn/createdAt/
 * monumentSummary intact, only plotIndex/w/h may differ), chronology is
 * preserved (oldest gets the lowest free cell), old buildings stay 1x1
 * (no retroactive footprint growth), and capacity is proven at the map's
 * own literal ground-cell count (193, ADDENDUM-08 §1.2) — a save at
 * capacity loses nothing, one over capacity is never dropped.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analytics } from "./platform/analytics";
import { setTimeTravelDate } from "./platform/clock";
import { BALANCE } from "./balance.approved";
import { growthScore, tier } from "./selectors";
import { CELL_COUNT, cellFromIndex, isBuildable, LAYOUT_VERSION } from "./townLayout";
import type { Building } from "./types";
import { useTownStore } from "./useTownStore";

let container: HTMLDivElement;
let root: Root | null = null;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  latest = useTownStore();
  return null;
}

/** Mounts (or remounts, simulating a reload) — unmounts any prior root on THIS container first, so a second call is a real reload, not two React roots sharing one DOM node. */
async function mountAndWaitForBoot(): Promise<void> {
  if (root !== null) act(() => root!.unmount());
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root!.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Forces the ~300ms debounced write buffer to flush, same trick `useTownStore.test.tsx` uses. */
function flush(): void {
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
}

const TODAY = "2026-08-02";

function freshTownFixture(overrides: Partial<Record<string, unknown>> = {}) {
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
    // ADDENDUM-02 §4.5 — this file is about the RECONCILER's own "no
    // player-facing notice" contract (§3.6 point 6) and the §4 migration, not
    // the move-hint. Marking it already-seen keeps every test here scoped to
    // its own concern (`useTownStore.move.test.tsx` covers the hint itself).
    moveHintSeen: true,
    ...overrides,
  };
}

function building(id: string, plotIndex: number, createdAt: number, builtOn: string, extra: Partial<Building> = {}): Building {
  return { id, source: { kind: "entry", entryId: id }, categoryId: "cafe", variantIndex: 0, plotIndex, builtOn, createdAt, ...extra };
}

function writeIndex(buildingMonths: string[], layoutVersion: number = LAYOUT_VERSION): void {
  window.localStorage.setItem(
    "ait.v1.index",
    JSON.stringify({ schemaVersion: 1, layoutVersion, entryMonths: [], buildingMonths }),
  );
}

function writeCore(overrides: Partial<Record<string, unknown>> = {}): void {
  const core = { town: freshTownFixture(overrides), budget: { monthlyBudgetKrw: null, updatedAt: 0 }, onboarded: true };
  window.localStorage.setItem("ait.v1.core", JSON.stringify(core));
}

/** Groups `buildings` by their `builtOn` month and writes each chunk, plus the index and a fresh core — the whole pre-boot seed a migration/reconcile test needs. */
function seedTown(buildings: readonly Building[], layoutVersion: number = LAYOUT_VERSION): void {
  const months = new Set(buildings.map((b) => b.builtOn.slice(0, 7)));
  writeIndex([...months].sort(), layoutVersion);
  writeCore();
  for (const ym of months) {
    window.localStorage.setItem(`ait.v1.buildings.${ym}`, JSON.stringify(buildings.filter((b) => b.builtOn.slice(0, 7) === ym)));
  }
}

/** Every `ground` cell index, in reading order (row-major) — what a forced relayout seats 1x1 buildings onto, oldest first (ADDENDUM-08 §3.2/§4). */
const ALL_GROUND_CELLS: readonly number[] = Array.from({ length: CELL_COUNT }, (_, i) => i).filter((i) => {
  const { row, col } = cellFromIndex(i);
  return isBuildable(row, col);
});
/** The first `n` ground cells, reading order. */
function groundCellsInOrder(n: number): number[] {
  return ALL_GROUND_CELLS.slice(0, n);
}
const GROUND_CELL_COUNT = ALL_GROUND_CELLS.length; // townLayout's own census, computed rather than hand-copied (ADDENDUM-08 §1.2: 193)

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root !== null) act(() => root!.unmount());
  root = null;
  container.remove();
  setTimeTravelDate(null);
  vi.restoreAllMocks();
});

describe("useTownStore boot — AC-R2/AC-R3: a valid pre-placed town needs no repair", () => {
  it("boots with every building at its original cell and issues zero storage writes", async () => {
    // Built via a real, non-colliding layout (any set of distinct ground
    // cells is legal) — the town a real player boots with zero writes.
    const cells = groundCellsInOrder(40);
    const buildings = cells.map((cell, i) => building(`b${i}`, cell, i, TODAY));
    seedTown(buildings);

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(cells.length);
    expect(latest?.notice).toBeNull(); // no relayout, no corruption, no player-facing repair notice (§3.6 point 6)
    expect(setItemSpy).not.toHaveBeenCalled(); // AC-R3: zero storage writes
    expect(latest!.buildings.map((b) => b.plotIndex).sort((a, b) => a - b)).toEqual(cells.slice().sort((a, b) => a - b));
  });
});

describe("useTownStore boot — AC-R1 (boot level): a single duplicate plotIndex is repaired silently", () => {
  it("re-seats the later duplicate, writes ONLY the affected month chunk, fires placement_repaired once with count:1, and shows no player-facing notice", async () => {
    const dup = ALL_GROUND_CELLS[4]; // a real `ground` cell — arbitrary index, must NOT be park/road/void/savings
    const buildings = [building("b0", dup, 100, TODAY), building("b1", dup, 200, TODAY)];
    seedTown(buildings);

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const trackSpy = vi.spyOn(analytics, "track");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(2);
    const plotIndices = latest!.buildings.map((b) => b.plotIndex).sort((a, b) => a - b);
    expect(new Set(plotIndices).size).toBe(2); // no more collision
    expect(plotIndices).not.toEqual([dup, dup]);
    // The earlier claimant (b0, createdAt 100) keeps its lot; the later (b1) moved.
    expect(latest!.buildings.find((b) => b.id === "b0")?.plotIndex).toBe(dup);
    expect(latest!.buildings.find((b) => b.id === "b1")?.plotIndex).not.toBe(dup);
    expect(latest?.notice).toBeNull(); // repair is silent — §3.6 point 6, never a Notice

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(`ait.v1.buildings.${TODAY.slice(0, 7)}`, expect.any(String));
    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith("placement_repaired", { count: 1 });

    // Reload — repair is idempotent, so a second boot must not repair again.
    setItemSpy.mockClear();
    trackSpy.mockClear();
    await mountAndWaitForBoot();
    const secondRun = latest!.buildings.map((b) => b.plotIndex).sort((a, b) => a - b);
    expect(secondRun).toEqual(plotIndices);
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(trackSpy).not.toHaveBeenCalled();
  });
});

describe("useTownStore boot — AC-R1 (boot level): corrupt plotIndex values, not just duplicates", () => {
  it("repairs a negative and a fractional plotIndex (a corrupt import / partial recovery) and leaves a clean building alone", async () => {
    const keeperCell = ALL_GROUND_CELLS[2]; // a real `ground` cell
    const buildings = [
      building("keeper", keeperCell, 50, TODAY),
      building("bad-negative", -3, 100, TODAY),
      building("bad-fractional", 1.5, 150, TODAY),
    ];
    seedTown(buildings);

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const trackSpy = vi.spyOn(analytics, "track");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(3);
    const keeper = latest!.buildings.find((b) => b.id === "keeper");
    expect(keeper?.plotIndex).toBe(keeperCell); // untouched — no collision, no repair

    const repaired = latest!.buildings.filter((b) => b.id !== "keeper");
    for (const b of repaired) {
      expect(Number.isInteger(b.plotIndex)).toBe(true);
      const { row, col } = cellFromIndex(b.plotIndex);
      expect(isBuildable(row, col)).toBe(true);
    }
    const allIndices = latest!.buildings.map((b) => b.plotIndex);
    expect(new Set(allIndices).size).toBe(allIndices.length); // no collision after repair

    expect(trackSpy).toHaveBeenCalledWith("placement_repaired", { count: 2 });
    expect(latest?.notice).toBeNull(); // silent — §3.6 point 6
    expect(setItemSpy).toHaveBeenCalledWith(`ait.v1.buildings.${TODAY.slice(0, 7)}`, expect.any(String));
  });
});

describe("useTownStore boot — AC-R1 (boot level): duplicates across multiple months", () => {
  it("writes only the repaired months' chunks, in ascending ym order, leaves an untouched month's chunk unwritten, and fires one placement_repaired event with the total repair count", async () => {
    const [juneCell, julyCell, augCell] = [ALL_GROUND_CELLS[10], ALL_GROUND_CELLS[15], ALL_GROUND_CELLS[20]];
    const buildings = [
      building("j0", juneCell, 100, "2026-06-01"), // June — keeps its cell
      building("c0", julyCell, 150, "2026-07-01"), // July — untouched, never repaired
      building("j1", juneCell, 200, "2026-06-02"), // June — loses, re-seated
      building("a0", augCell, 300, "2026-08-01"), // August — keeps its cell
      building("a1", augCell, 400, "2026-08-02"), // August — loses, re-seated
    ];
    seedTown(buildings);

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const trackSpy = vi.spyOn(analytics, "track");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(5);
    const july = latest!.buildings.find((b) => b.id === "c0");
    expect(july?.plotIndex).toBe(julyCell); // untouched building, untouched value
    const june1 = latest!.buildings.find((b) => b.id === "j1");
    const aug1 = latest!.buildings.find((b) => b.id === "a1");
    expect(june1?.plotIndex).not.toBe(juneCell);
    expect(aug1?.plotIndex).not.toBe(augCell);
    expect(latest?.notice).toBeNull();

    const writtenKeys = setItemSpy.mock.calls.map((call) => call[0]);
    expect(writtenKeys).not.toContain("ait.v1.buildings.2026-07"); // no repaired building — never written
    expect(writtenKeys.filter((k) => k === "ait.v1.buildings.2026-06")).toHaveLength(1);
    expect(writtenKeys.filter((k) => k === "ait.v1.buildings.2026-08")).toHaveLength(1);
    // Ascending ym order: June's write must precede August's write.
    expect(writtenKeys.indexOf("ait.v1.buildings.2026-06")).toBeLessThan(writtenKeys.indexOf("ait.v1.buildings.2026-08"));

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith("placement_repaired", { count: 2 });
  });
});

// ── ADDENDUM-08 §4 — migration of existing (pre-fixed-map) saves ──

describe("useTownStore boot — ADDENDUM-08 §4: version<4 forces a full relayout", () => {
  it("a realistic mixed save (entries with exp, a claimed no-spend park, an F16 monument) survives with every field intact except plotIndex", async () => {
    const buildings: Building[] = [
      building("b0", 999, 100, "2026-07-01", { categoryId: "cafe", exp: 4 }),
      building("b1", 5, 200, "2026-07-02", { categoryId: "food" }), // no exp — absent stays absent
      building("nospend0", 12, 300, "2026-07-03", {
        source: { kind: "nospend", date: "2026-07-03" },
        categoryId: "park",
      }),
      building("mon0", 40, 50, "2026-07-31", {
        source: { kind: "monument", period: "2026-07" },
        categoryId: null,
        monumentSummary: {
          period: "2026-07",
          expenseKrw: 10_000,
          incomeKrw: 0,
          savingKrw: 0,
          budgetKrw: 600_000,
          outcomeBucket: 1,
          daysLogged: 3,
        },
      }),
    ];
    // Old index: no layoutVersion key at all — exactly what a pre-ADDENDUM-01
    // town's index looked like, and what a pre-ADDENDUM-08 town's still is.
    seedTown(buildings, 0);

    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(4); // zero losses
    expect(latest?.notice).toEqual({ kind: "relayout" });

    for (const before of buildings) {
      const after = latest!.buildings.find((b) => b.id === before.id);
      expect(after).toBeDefined();
      // Every field except plotIndex (and w/h, unused here — none of these
      // had one) survives byte-identical.
      const { plotIndex: _beforePlot, ...beforeRest } = before;
      const { plotIndex: _afterPlot, ...afterRest } = after!;
      void _beforePlot;
      void _afterPlot;
      expect(afterRest).toEqual(beforeRest);
      // Old buildings never had w/h — they stay 1x1, no retroactive growth.
      expect(after!.w).toBeUndefined();
      expect(after!.h).toBeUndefined();
      const { row, col } = cellFromIndex(after!.plotIndex);
      expect(isBuildable(row, col)).toBe(true);
    }
    const allIndices = latest!.buildings.map((b) => b.plotIndex);
    expect(new Set(allIndices).size).toBe(allIndices.length); // no collisions post-relayout
  });

  it("chronology: buildings are seated in (createdAt, id) order — the oldest gets the lowest free cell", async () => {
    // Deliberately shuffled input plotIndex/array order — only createdAt
    // decides seating order after a forced relayout.
    const buildings = [
      building("young", 1, 500, "2026-07-05"),
      building("old", 2, 100, "2026-07-01"),
      building("middle", 3, 300, "2026-07-03"),
    ];
    seedTown(buildings, 3); // version 3 — pre-ADDENDUM-08

    await mountAndWaitForBoot();
    flush();

    const expected = groundCellsInOrder(3); // reading-order ground cells, oldest -> lowest
    expect(latest!.buildings.find((b) => b.id === "old")?.plotIndex).toBe(expected[0]);
    expect(latest!.buildings.find((b) => b.id === "middle")?.plotIndex).toBe(expected[1]);
    expect(latest!.buildings.find((b) => b.id === "young")?.plotIndex).toBe(expected[2]);
  });

  it("capacity: a save at exactly the map's ground-cell count relayouts with zero losses", async () => {
    const buildings = Array.from({ length: GROUND_CELL_COUNT }, (_, i) => building(`b${i}`, i * 137, i, "2026-07-01"));
    seedTown(buildings, 3);

    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(GROUND_CELL_COUNT); // zero losses
    const allIndices = latest!.buildings.map((b) => b.plotIndex);
    expect(new Set(allIndices).size).toBe(GROUND_CELL_COUNT); // every one got its own distinct cell
    for (const i of allIndices) {
      const { row, col } = cellFromIndex(i);
      expect(isBuildable(row, col)).toBe(true);
    }
  });

  it("capacity+1: one building over the map's ground-cell count is queued, not dropped — nothing vanishes", async () => {
    const buildings = Array.from({ length: GROUND_CELL_COUNT + 1 }, (_, i) => building(`b${i}`, i * 137, i, "2026-07-01"));
    seedTown(buildings, 3);

    await mountAndWaitForBoot();
    flush();

    // Nothing dropped: every id from the seeded save is still present.
    expect(latest?.buildingCount).toBe(GROUND_CELL_COUNT + 1);
    const idsAfter = new Set(latest!.buildings.map((b) => b.id));
    for (const b of buildings) expect(idsAfter.has(b.id)).toBe(true);

    // Exactly one couldn't be seated on the 193-cell map — by (createdAt, id)
    // order that is the YOUNGEST building (`b${GROUND_CELL_COUNT}`, the
    // highest createdAt).
    const seatedPlotIndices = latest!.buildings
      .filter((b) => b.id !== `b${GROUND_CELL_COUNT}`)
      .map((b) => b.plotIndex);
    expect(new Set(seatedPlotIndices).size).toBe(GROUND_CELL_COUNT); // every OTHER building got a distinct, valid cell
    for (const i of seatedPlotIndices) {
      const { row, col } = cellFromIndex(i);
      expect(isBuildable(row, col)).toBe(true);
    }
  });
});

// ── ADDENDUM-08 §4.1 (PM correction) — tier thresholds are still reachable
// despite the map's fixed capacity. `tier()` is fed `growthScore(buildings)
// = buildings.length + Σ exp` (ADDENDUM-04 §3), NOT raw building count — the
// old town grew without bound so count alone could reach every threshold; the
// new map caps count at 193, below `tierThresholds[4]` (200), so this proves
// the top tier is reached through exp (a grow costs no cell), not assumed. ──

describe("ADDENDUM-08 §4.1 — tier thresholds remain reachable on a capacity-capped map", () => {
  it("BALANCE.tierThresholds literal snapshot (guards against silent drift)", () => {
    expect(BALANCE.tierThresholds).toEqual([0, 10, 30, 80, 200]);
  });

  it("growthScore is buildings.length + sum(exp) — unchanged by the geometry change", () => {
    const buildings: Building[] = [
      building("a", 0, 0, TODAY, { exp: 3 }),
      building("b", 1, 1, TODAY), // exp absent -> reads 0
      building("c", 2, 2, TODAY, { exp: 10 }),
    ];
    expect(growthScore(buildings)).toBe(buildings.length + 3 + 0 + 10);
  });

  it("tier 4 (threshold 200) is reachable on a town filled to the fixed map's 193-cell capacity, via exp rather than more buildings", () => {
    // A full town: GROUND_CELL_COUNT buildings (the entire fixed-map budget).
    // Count alone (`tier(GROUND_CELL_COUNT, ...)`) sits BELOW tier 4 — the
    // capacity cap this correction is about, actually biting. Growth (exp)
    // is uncapped by geometry (a grow costs no cell), so distributing just a
    // few points of exp across the full town still clears 200.
    expect(tier(GROUND_CELL_COUNT, BALANCE.tierThresholds)).toBeLessThan(4);
    const expNeeded = 200 - GROUND_CELL_COUNT;
    const buildings: Building[] = Array.from({ length: GROUND_CELL_COUNT }, (_, i) =>
      building(`b${i}`, i, i, TODAY, i < expNeeded ? { exp: 1 } : {}),
    );
    const score = growthScore(buildings);
    expect(score).toBeGreaterThanOrEqual(200);
    expect(tier(score, BALANCE.tierThresholds)).toBe(4);
  });
});
