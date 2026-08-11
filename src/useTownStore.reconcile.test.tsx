/**
 * ADDENDUM-02 §3.6 — the boot-time self-healing reconciler, exercised through
 * the real hook (not just `placement.test.ts`'s pure-function unit). Same
 * bare createRoot+act hook-harness pattern `useTownStore.test.tsx` uses — a
 * NEW file so that file's existing assertions stay untouched.
 *
 * AC-R2 / AC-R3: a valid pre-change town boots with zero storage writes and
 * every building on its original lot. AC-R1 (boot level): a town with a
 * duplicate `plotIndex` is repaired silently, with a write only for the
 * affected month chunk(s), in ascending `ym` order, `saveCore` fired only
 * when `plotsOpened !== core.town.nextPlotIndex`, and exactly one
 * `placement_repaired` analytics event per boot.
 *
 * Round-3 findings C1/C2, closed here at the store level (not just in
 * `placement.test.ts`'s pure-function unit): a genuinely RANDOM (not dense
 * 0..N-1) valid town must also boot with zero writes, and `nextPlotIndex`
 * must never drift from the real building count across many build+reboot
 * cycles, no matter where the dice landed.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysInMonth, shiftMonth, ymd } from "./calendar";
import { analytics } from "./platform/analytics";
import { setTimeTravelDate } from "./platform/clock";
import { pickPlot } from "./placement";
import { seededRandom, setRandomOverride } from "./platform/random";
import { plotFromIndex } from "./selectors";
import { LAYOUT_VERSION } from "./townLayout";
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

function freshTownFixture(nextPlotIndex: number) {
  return {
    townName: "우리 동네",
    nextPlotIndex,
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
    // player-facing notice" contract (§3.6 point 6), not the move-hint. A
    // fixture town with >= 2 buildings and `moveHintSeen` unset would
    // otherwise ALSO get a (correct, separately-tested — see
    // `useTownStore.move.test.tsx`) `{ kind: "moveHint" }` notice queued at
    // boot, which is real, spec-required behaviour but unrelated to what
    // this file tests. Marking it already-seen here keeps this file scoped
    // to the reconciler.
    moveHintSeen: true,
  };
}

function building(id: string, plotIndex: number, createdAt: number, builtOn: string): Building {
  return { id, source: { kind: "entry", entryId: id }, categoryId: "cafe", variantIndex: 0, plotIndex, builtOn, createdAt };
}

function writeIndex(buildingMonths: string[]): void {
  window.localStorage.setItem(
    "ait.v1.index",
    JSON.stringify({ schemaVersion: 1, layoutVersion: LAYOUT_VERSION, entryMonths: [], buildingMonths }),
  );
}

function writeCore(nextPlotIndex: number): void {
  const core = { town: freshTownFixture(nextPlotIndex), budget: { monthlyBudgetKrw: null, updatedAt: 0 }, onboarded: true };
  window.localStorage.setItem("ait.v1.core", JSON.stringify(core));
}

/** 'YYYY-MM-DD' one calendar day after `dateStr` — reuses `calendar.ts`'s own day-count math (no reimplementation). */
function dayAfter(dateStr: string): string {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(5, 7));
  const d = Number(dateStr.slice(8, 10));
  if (d < daysInMonth(y, m)) return ymd(y, m, d + 1);
  const next = shiftMonth(y, m, 1);
  return ymd(next.y, next.m, 1);
}

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
  setRandomOverride(null);
  vi.restoreAllMocks();
});

describe("useTownStore boot — AC-R2/AC-R3: a valid pre-change town needs no repair", () => {
  it("boots with every building at its original ON-SCREEN cell (not just the same index) and issues zero storage writes", async () => {
    // A larger, multi-block town (47 spans past the first two blocks) —
    // round-3 finding: a 5-building fixture never leaves the first block, so
    // it couldn't have caught a bug in block-boundary geometry.
    //
    // ADDENDUM-07: "valid" no longer means dense indices 0..N-1 — block-edge
    // masking means most such runs include a void cell, which now correctly
    // NEEDS repair (see placement.test.ts's own dedicated describe block for
    // that case). The town a real player boots with zero writes is one built
    // through the REAL placement pipeline instead.
    const N = 47;
    const rng = seededRandom(5);
    const buildings: Building[] = [];
    for (let i = 0; i < N; i++) buildings.push(building(`b${i}`, pickPlot(i, buildings, rng), i, TODAY));

    // The BEFORE picture — exactly what the pre-change (sequential-placement)
    // app would have rendered for this town, computed the same way TownGrid
    // does (`plotFromIndex`), keyed by building id so order doesn't matter.
    const beforeCellById = new Map(buildings.map((b) => [b.id, plotFromIndex(b.plotIndex)]));

    writeIndex(["2026-08"]);
    writeCore(N);
    window.localStorage.setItem("ait.v1.buildings.2026-08", JSON.stringify(buildings));

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(N);
    expect(latest?.nextPlotIndex).toBe(N);
    expect(latest?.notice).toBeNull(); // no relayout, no corruption, and no player-facing repair notice (§3.6 point 6)
    expect(setItemSpy).not.toHaveBeenCalled(); // AC-R3: zero storage writes

    // AC-R3 in full: the AFTER picture, cell-by-cell, matches the BEFORE
    // picture exactly — "every building in the same on-screen position as
    // before", not merely "the plotIndex number happens to be unchanged".
    for (const b of latest!.buildings) {
      expect(plotFromIndex(b.plotIndex)).toEqual(beforeCellById.get(b.id));
    }
  });
});

describe("useTownStore boot — AC-R1 (boot level): a single duplicate plotIndex is repaired silently", () => {
  it("re-seats the later duplicate, writes ONLY the affected month chunk, does not touch core when plotsOpened already matches nextPlotIndex, fires placement_repaired once with count:1, and shows no player-facing notice", async () => {
    const buildings = [
      building("b0", 4, 100, TODAY),
      building("b1", 4, 200, TODAY),
    ];
    writeIndex(["2026-08"]);
    writeCore(5); // reconciled.plotsOpened will also be 5 here — the "no core write" branch
    window.localStorage.setItem("ait.v1.buildings.2026-08", JSON.stringify(buildings));

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const trackSpy = vi.spyOn(analytics, "track");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(2);
    const plotIndices = latest!.buildings.map((b) => b.plotIndex).sort((a, b) => a - b);
    expect(new Set(plotIndices).size).toBe(2); // no more collision
    expect(plotIndices).not.toEqual([4, 4]);
    // The earlier claimant (b0, createdAt 100) keeps its lot; the later (b1) moved.
    expect(latest!.buildings.find((b) => b.id === "b0")?.plotIndex).toBe(4);
    expect(latest!.buildings.find((b) => b.id === "b1")?.plotIndex).not.toBe(4);
    expect(latest?.notice).toBeNull(); // repair is silent — §3.6 point 6, never a Notice

    // §3.6's persistence contract, asserted literally: exactly ONE storage
    // write, for exactly the one repaired month's chunk key. No core write —
    // reconciled.plotsOpened (5) equals core.town.nextPlotIndex (5) already.
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith("ait.v1.buildings.2026-08", expect.any(String));

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith("placement_repaired", { count: 1 });

    // Reload — a REAL reload (prior root unmounted by mountAndWaitForBoot) —
    // repair is idempotent, so a second boot must not repair again and must
    // issue zero further writes (nothing left to fix).
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
  it("repairs a negative and a fractional plotIndex (a corrupt import / partial recovery, not a collision) and leaves a clean building alone", async () => {
    // A valid, non-colliding building alongside two corrupt ones — JSON
    // round-trips negative/fractional numbers fine (unlike NaN, which
    // `placement.test.ts` covers at the pure-function level), so this is
    // exactly the shape a real corrupt export or partial F12 import can
    // produce on disk.
    const buildings = [
      building("keeper", 2, 50, TODAY),
      building("bad-negative", -3, 100, TODAY),
      building("bad-fractional", 1.5, 150, TODAY),
    ];
    writeIndex(["2026-08"]);
    writeCore(3);
    window.localStorage.setItem("ait.v1.buildings.2026-08", JSON.stringify(buildings));

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const trackSpy = vi.spyOn(analytics, "track");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(3);
    const keeper = latest!.buildings.find((b) => b.id === "keeper");
    expect(keeper?.plotIndex).toBe(2); // untouched — no collision, no repair

    const repaired = latest!.buildings.filter((b) => b.id !== "keeper");
    for (const b of repaired) {
      expect(Number.isInteger(b.plotIndex)).toBe(true);
      expect(b.plotIndex).toBeGreaterThanOrEqual(0);
    }
    const allIndices = latest!.buildings.map((b) => b.plotIndex);
    expect(new Set(allIndices).size).toBe(allIndices.length); // no collision after repair

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith("placement_repaired", { count: 2 });
    expect(latest?.notice).toBeNull(); // silent — §3.6 point 6
    expect(setItemSpy).toHaveBeenCalledWith("ait.v1.buildings.2026-08", expect.any(String));
  });
});

describe("useTownStore boot — AC-R1 (boot level): duplicates across multiple months", () => {
  it("writes only the repaired months' chunks, in ascending ym order, leaves an untouched month's chunk unwritten, writes core when plotsOpened no longer matches nextPlotIndex, and fires one placement_repaired event with the total repair count", async () => {
    // June: duplicate at plot 20 (repaired). July: one clean building at plot
    // 30 (must NEVER be repaired or written — it has no collision). August:
    // duplicate at plot 4 (repaired). `reconcilePlacement` operates over the
    // GLOBAL flattened occupancy, so June's loser and August's loser both
    // land in the lowest globally-free UNMASKED lots — 0 and 1 are MASKED
    // (ADDENDUM-07, block 0), so that's 2, then 3.
    const buildings = [
      building("j0", 20, 100, "2026-06-01"), // June — keeps 20
      building("c0", 30, 150, "2026-07-01"), // July — untouched, never repaired
      building("j1", 20, 200, "2026-06-02"), // June — loses, re-seated to 2
      building("a0", 4, 300, "2026-08-01"), // August — keeps 4
      building("a1", 4, 400, "2026-08-02"), // August — loses, re-seated to 3
    ];
    writeIndex(["2026-06", "2026-07", "2026-08"]);
    writeCore(3); // mismatched — forces the coreNeedsWrite branch
    window.localStorage.setItem("ait.v1.buildings.2026-06", JSON.stringify(buildings.filter((b) => b.builtOn.startsWith("2026-06"))));
    window.localStorage.setItem("ait.v1.buildings.2026-07", JSON.stringify(buildings.filter((b) => b.builtOn.startsWith("2026-07"))));
    window.localStorage.setItem("ait.v1.buildings.2026-08", JSON.stringify(buildings.filter((b) => b.builtOn.startsWith("2026-08"))));

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const trackSpy = vi.spyOn(analytics, "track");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(5);
    const july = latest!.buildings.find((b) => b.id === "c0");
    expect(july?.plotIndex).toBe(30); // untouched building, untouched value
    const june1 = latest!.buildings.find((b) => b.id === "j1");
    const aug1 = latest!.buildings.find((b) => b.id === "a1");
    expect(june1?.plotIndex).toBe(2);
    expect(aug1?.plotIndex).toBe(3);
    // highest occupied index after repair is 30 (July) -> requiredLots = 31.
    expect(latest?.nextPlotIndex).toBe(31);
    expect(latest?.notice).toBeNull();

    const writtenKeys = setItemSpy.mock.calls.map((call) => call[0]);
    // Exactly the two repaired months' building chunks + core — nothing else,
    // and specifically NEVER July's chunk (it has no repaired building).
    expect(writtenKeys).not.toContain("ait.v1.buildings.2026-07");
    expect(writtenKeys.filter((k) => k === "ait.v1.buildings.2026-06")).toHaveLength(1);
    expect(writtenKeys.filter((k) => k === "ait.v1.buildings.2026-08")).toHaveLength(1);
    expect(writtenKeys).toContain("ait.v1.core"); // plotsOpened (31) !== nextPlotIndex (3) at boot
    // Ascending ym order: June's write must precede August's write.
    expect(writtenKeys.indexOf("ait.v1.buildings.2026-06")).toBeLessThan(writtenKeys.indexOf("ait.v1.buildings.2026-08"));

    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith("placement_repaired", { count: 2 });
  });
});

// Round-3 findings C1/C2: every AC-R2/AC-R3 case above used a DENSE 0..N-1
// town — the pre-change sequential shape, not what random placement actually
// produces. A single randomly-placed building whose plotIndex happens to sit
// near the top of its block (perfectly valid, not corrupt) is exactly the
// case the round-3 probe found firing an unwanted boot write.
describe("useTownStore boot — round-3 finding C2: a clean RANDOMLY placed town needs no repair either", () => {
  it("boots a single building at plot 11 (top of the first 12-lot block), nextPlotIndex 1, with zero storage writes", async () => {
    const buildings = [building("b0", 11, 100, TODAY)];
    writeIndex(["2026-08"]);
    writeCore(1);
    window.localStorage.setItem("ait.v1.buildings.2026-08", JSON.stringify(buildings));

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    await mountAndWaitForBoot();
    flush();

    expect(latest?.buildingCount).toBe(1);
    // NOT ratcheted to max(plotIndex) + 1 = 12 — the town's growth frontier
    // is a function of how many buildings were built (1), not of where the
    // one it has happens to sit.
    expect(latest?.nextPlotIndex).toBe(1);
    expect(latest?.notice).toBeNull();
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

// Round-3 finding C1 (AC-P4 clause 2): the +1-per-build counter's own tests
// only ever asserted the per-action increment; end to end, across reboots,
// the round-3 probe showed the boot reconciler itself was what silently
// inflated the counter (build 1/day + reboot each day, seed 1: 40 buildings,
// nextPlotIndex reached 76). Reproduced here through the real store, the
// real random port, and a real reboot between every single build.
describe("useTownStore boot — round-3 finding C1: nextPlotIndex tracks buildingCount exactly across many build+reboot cycles", () => {
  it("stays exactly N after N single-building days, each followed by a real reboot", async () => {
    setRandomOverride(seededRandom(1)); // the exact seed the round-3 probe used
    const DAYS = 40;
    let today = TODAY;
    for (let day = 0; day < DAYS; day++) {
      setTimeTravelDate(today);
      await mountAndWaitForBoot();
      act(() => {
        latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: today });
      });
      expect(latest?.buildingCount).toBe(day + 1);
      expect(latest?.nextPlotIndex).toBe(day + 1); // never inflated by where the dice landed
      today = dayAfter(today);
    }

    // One more reboot over the fully accumulated town — the reconciler must
    // still see it as clean (repaired: 0) and leave the counter untouched.
    setTimeTravelDate(today);
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(DAYS);
    expect(latest?.nextPlotIndex).toBe(DAYS);
  });
});
