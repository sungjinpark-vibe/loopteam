/**
 * ADDENDUM-02 §3 / §8.3 — Placement + Repair/compatibility acceptance
 * criteria (AC-P1..AC-P8, AC-R1, AC-R2). AC-P9 ([dom]) lives in
 * `components/TownGrid.test.tsx`, the only place a grid actually mounts.
 * AC-R4's dense-scale evidence lives in `devtools/reconcileDense.test.tsx`
 * (it must load the real `dense` fixture through the real boot path, which
 * needs `src/devtools/**`, off-limits to this file per eslint's
 * `no-restricted-imports` rule — MVP-SPEC §11).
 */
import { describe, expect, it } from "vitest";
import { seededRandom } from "./platform/random";
import {
  allocatePlots,
  freePlots,
  moveBuilding,
  occupiedPlots,
  openPlotCount,
  pickPlot,
  pickPlotIn,
  poolSize,
  reconcilePlacement,
} from "./placement";
import { cellFromIndex, isMaskedPlotIndex, isRoadCell, LOTS_PER_BLOCK, renderedTileCount, unmaskedLotsInBlock } from "./townLayout";
import type { Building } from "./types";

function building(id: string, plotIndex: number, createdAt = 0, builtOn = "2026-08-01"): Building {
  return {
    id,
    source: { kind: "entry", entryId: id },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex,
    builtOn,
    createdAt,
  };
}

/** A randomised occupancy set: `count` distinct plot indices under 700, for a randomised-N trial. */
function randomOccupancy(rng: () => number, count: number): Building[] {
  const indices = new Set<number>();
  while (indices.size < count) indices.add(Math.floor(rng() * 700));
  return [...indices].map((idx, i) => building(`b${i}`, idx));
}

/** The first N UNMASKED plot indices, ascending — what a real town built with rng() = 0 (AC-P7) lands on under ADDENDUM-07's block-edge masking. */
function firstNUnmasked(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; out.length < n; i++) if (!isMaskedPlotIndex(i)) out.push(i);
  return out;
}

/** Minimal whole-block RAW pool size whose cumulative UNMASKED capacity exceeds `need` — an independent (test-side) reimplementation of placement.ts's own block-search, verifying the production `poolSize` against pure townLayout.ts geometry rather than against itself. */
function unmaskedAwarePoolSize(need: number): number {
  let blocks = 0;
  let capacity = 0;
  do {
    capacity += unmaskedLotsInBlock(blocks);
    blocks++;
  } while (capacity <= need);
  return blocks * LOTS_PER_BLOCK;
}

describe("AC-P1/AC-P2 — 1,000 seeded placements interleaved with deletions", () => {
  it("every pick is free and inside the pool, and no two live buildings ever collide", () => {
    const rng = seededRandom(1);
    let plotsOpened = 0;
    let buildings: Building[] = [];
    let nextId = 0;
    const SAMPLE_SIZE = 1000; // AC-P1/AC-P2's own stated count — deletions are interleaved IN ADDITION, not counted against it

    for (let placed = 0; placed < SAMPLE_SIZE; ) {
      const doDelete = buildings.length > 0 && rng() < 0.3;
      if (doDelete) {
        const victim = Math.floor(rng() * buildings.length);
        buildings = buildings.filter((_, i) => i !== victim); // F9: a deleted lot rejoins the free pool
        continue;
      }

      const pool = openPlotCount(plotsOpened, buildings);
      const idx = pickPlot(plotsOpened, buildings, rng);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(pool); // AC-P1: inside openPlotCount
      expect(buildings.some((b) => b.plotIndex === idx)).toBe(false); // AC-P1: free

      buildings.push(building(`b${nextId++}`, idx));
      plotsOpened += 1;
      placed++;

      const seen = new Set<number>();
      for (const b of buildings) {
        expect(seen.has(b.plotIndex)).toBe(false); // AC-P2: no collision, ever
        seen.add(b.plotIndex);
      }
    }
  });
});

describe("AC-P3 — openPlotCount(n, buildings) > max(n - 1, maxPlotIndex) for n = 0..600 (G1)", () => {
  it("holds with no buildings", () => {
    for (let n = 0; n <= 600; n++) {
      expect(openPlotCount(n, [])).toBeGreaterThan(Math.max(n - 1, -1));
    }
  });

  it("holds for randomised occupancy sets", () => {
    const rng = seededRandom(2);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(rng() * 601);
      const buildings = randomOccupancy(rng, Math.floor(rng() * 30));
      const maxPlotIndex = buildings.length > 0 ? Math.max(...buildings.map((b) => b.plotIndex)) : -1;
      expect(openPlotCount(n, buildings)).toBeGreaterThan(Math.max(n - 1, maxPlotIndex));
    }
  });
});

describe("AC-P4 — open-lot count after N buildings placed through the REAL pickPlot pipeline is exactly the masking-aware pool size; nextPlotIndex after N build-producing acts is exactly N", () => {
  // ADDENDUM-07: pacing is no longer `renderedTileCount(N + 1)` — a raw
  // block no longer always holds LOTS_PER_BLOCK BUILDABLE lots (block-edge
  // masking), so `openPlotCount` now tracks `unmaskedAwarePoolSize(N)` (this
  // file's own independent reimplementation, over pure townLayout.ts
  // geometry) instead. `renderedTileCount(N + 1)` is asserted as a LOWER
  // bound below — the new pacing is never TIGHTER than the old one, only
  // ever the same or looser (report the actual numbers in docs/qa).
  it("pacing is a pure function of history alone (§3.4, §6.6) — a hand-built 0..N-1 occupancy would NOT have caught this: round-3 finding traced a real failure to seed 1 by N=4 (idx 11, pool 24, expected 12) under the pre-fix pool sizing", () => {
    const rng = seededRandom(1); // the exact seed the round-3 probe used
    let plotsOpened = 0;
    const buildings: Building[] = [];
    for (let N = 0; N <= 600; N++) {
      expect(plotsOpened).toBe(N); // the +1-per-build counter, unaffected by WHERE the dice landed
      const pool = openPlotCount(plotsOpened, buildings);
      expect(pool).toBe(unmaskedAwarePoolSize(N));
      expect(pool).toBeGreaterThanOrEqual(renderedTileCount(N + 1));
      const idx = pickPlot(plotsOpened, buildings, rng);
      expect(isMaskedPlotIndex(idx)).toBe(false); // pickPlot never lands on a void cell
      buildings.push(building(`b${N}`, idx));
      plotsOpened += 1;
    }
  });

  it("holds under a second, independent seed too — not an artifact of one lucky draw sequence", () => {
    const rng = seededRandom(42);
    let plotsOpened = 0;
    const buildings: Building[] = [];
    for (let N = 0; N <= 200; N++) {
      expect(openPlotCount(plotsOpened, buildings)).toBe(unmaskedAwarePoolSize(N));
      const idx = pickPlot(plotsOpened, buildings, rng);
      buildings.push(building(`b${N}`, idx));
      plotsOpened += 1;
    }
    expect(plotsOpened).toBe(201);
  });
});

describe("AC-P5 — freePlots(...).length >= 1 for every N = 0..600 (G2)", () => {
  it("holds with a dense N-building occupancy", () => {
    for (let N = 0; N <= 600; N++) {
      const buildings = Array.from({ length: N }, (_, i) => building(`b${i}`, i));
      expect(freePlots(N, buildings).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("holds for randomised occupancy sets", () => {
    const rng = seededRandom(3);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(rng() * 601);
      const buildings = randomOccupancy(rng, Math.floor(rng() * 30));
      expect(freePlots(n, buildings).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("AC-P6 — allocatePlots returns k distinct free lots, each inside the pool AT THE MOMENT IT IS DRAWN", () => {
  it("for k = 1..20 — checked per-draw, not against a looser final-occupancy bound", () => {
    const plotsOpened = 5;
    const buildings = Array.from({ length: plotsOpened }, (_, i) => building(`b${i}`, i));
    for (let k = 1; k <= 20; k++) {
      const seed = 100 + k;
      const result = allocatePlots(plotsOpened, buildings, k, seededRandom(seed));
      expect(result.length).toBe(k);
      expect(new Set(result).size).toBe(k); // distinct
      for (const idx of result) expect(buildings.some((b) => b.plotIndex === idx)).toBe(false); // free of the PRE-existing occupancy

      // Replay the exact same draws with an identical seed, threading `taken`
      // through by hand exactly as allocatePlots does internally (it is
      // documented as nothing more than this loop over pickPlotIn), so each
      // draw is checked against the pool AS IT STOOD at that exact moment —
      // strictly tighter than a bound computed over the final occupancy
      // (round-2 finding: that bound would not catch a plot returned beyond
      // its own draw-time pool but still inside the final one).
      const rng = seededRandom(seed);
      const taken = occupiedPlots(buildings);
      const replay: number[] = [];
      for (let step = 0; step < k; step++) {
        const poolAtThisDraw = poolSize(plotsOpened + step, taken);
        const idx = pickPlotIn(plotsOpened + step, taken, rng);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(poolAtThisDraw); // draw-time pool, not the final one
        taken.add(idx);
        replay.push(idx);
      }
      // The replay must be byte-identical to allocatePlots' real output —
      // otherwise the per-draw checks above would be observing a different
      // sequence than the one allocatePlots actually produced.
      expect(replay).toEqual(result);
    }
  });
});

describe("AC-P7 — rng() = 0 reproduces a dense town over the UNMASKED lots, in ascending order, skipping every masked one", () => {
  it("pickPlot returns the first 30 unmasked plot indices, in order, as buildings accumulate", () => {
    // ADDENDUM-07: rng() = 0 always takes pool[0] (the smallest FREE lot),
    // and the pool now excludes masked indices — so the sequence is the
    // ascending list of unmasked indices, not literal 0, 1, 2, ... (the
    // pre-masking result; some of those literal indices are now void).
    const expected = firstNUnmasked(30);
    const buildings: Building[] = [];
    for (let i = 0; i < 30; i++) {
      const idx = pickPlot(i, buildings, () => 0);
      expect(idx).toBe(expected[i]);
      expect(isMaskedPlotIndex(idx)).toBe(false);
      buildings.push(building(`b${i}`, idx));
    }
  });
});

describe("AC-P8 — pickPlot never throws", () => {
  it("on an empty buildings array", () => {
    expect(() => pickPlot(0, [], () => 0.5)).not.toThrow();
  });

  it("on rng() returning exactly 1 (must not index past the pool's end)", () => {
    expect(() => pickPlot(0, [], () => 1)).not.toThrow();
    const idx = pickPlot(0, [], () => 1);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(openPlotCount(0, []));
  });

  it("on NaN / negative / fractional plotIndex already present in occupancy", () => {
    const weird: Building[] = [building("b1", NaN), building("b2", -3), building("b3", 1.5)];
    expect(() => pickPlot(0, weird, () => 0.5)).not.toThrow();
    const idx = pickPlot(0, weird, () => 0.5);
    expect(Number.isInteger(idx)).toBe(true);
    expect(idx).toBeGreaterThanOrEqual(0);
  });
});

describe("ADDENDUM-07 — freePlots/pickPlotIn never return a masked index, and G2 holds over UNMASKED lots", () => {
  it("freePlots never includes a masked index, for N = 0..600 dense occupancy", () => {
    for (let N = 0; N <= 600; N += 17) {
      const buildings = Array.from({ length: N }, (_, i) => building(`b${i}`, i));
      for (const i of freePlots(N, buildings)) expect(isMaskedPlotIndex(i)).toBe(false);
    }
  });

  it("pickPlot/pickPlotIn never return a masked index, across 500 seeded draws on a growing town", () => {
    const rng = seededRandom(7);
    let plotsOpened = 0;
    const buildings: Building[] = [];
    for (let N = 0; N < 500; N++) {
      const idx = pickPlot(plotsOpened, buildings, rng);
      expect(isMaskedPlotIndex(idx)).toBe(false);
      buildings.push(building(`b${N}`, idx));
      plotsOpened += 1;
    }
  });

  it("G2 restated: freePlots(...).length >= 1 (a free UNMASKED lot) for a DENSE occupancy that also includes masked-but-occupied legacy indices", () => {
    // Every index 0..N-1 occupied, whether masked or not — exactly the shape
    // a pre-ADDENDUM-07 legacy save has before reconciliation. G2 must still
    // find a free (unmasked) lot beyond it, growing the pool by whole blocks.
    for (const N of [0, 1, 8, 16, 40, 200, 600]) {
      const buildings = Array.from({ length: N }, (_, i) => building(`b${i}`, i));
      const free = freePlots(N, buildings);
      expect(free.length).toBeGreaterThanOrEqual(1);
      for (const i of free) expect(isMaskedPlotIndex(i)).toBe(false);
    }
  });

  it("growing the pool by one block always restores G2 — the MIN_UNMASKED_LOTS_PER_BLOCK floor in practice", () => {
    // A block's own worst case never drops below 8 unmasked lots
    // (townLayout.test.ts asserts the general bound); here it is exercised
    // through the real pool-growth path instead of the constant directly.
    const rng = seededRandom(9);
    for (let trial = 0; trial < 30; trial++) {
      const n = Math.floor(rng() * 601);
      const buildings = randomOccupancy(rng, Math.floor(rng() * 40));
      expect(freePlots(n, buildings).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("AC-R1 — reconcilePlacement repairs a duplicate plotIndex", () => {
  it("re-seats the later of two buildings sharing index 4 at the lowest free UNMASKED lot, leaves the earlier alone, preserves order, and is idempotent", () => {
    const earlier = building("b1", 4, 100);
    const later = building("b2", 4, 200);
    const result = reconcilePlacement(5, [earlier, later]);

    expect(result.repaired).toBe(1);
    expect(result.buildings[0]).toBe(earlier); // untouched — same object reference
    expect(result.buildings[0].plotIndex).toBe(4);
    // Lowest free lot 0..3 are candidates, but 0 and 1 are MASKED
    // (ADDENDUM-07, block 0) — 2 is the lowest free UNMASKED one.
    expect(result.buildings[1].plotIndex).toBe(2);
    expect(result.buildings.map((b) => b.id)).toEqual(["b1", "b2"]); // array order preserved

    const second = reconcilePlacement(result.plotsOpened, result.buildings);
    expect(second.repaired).toBe(0);
    expect(second.buildings).toBe(result.buildings); // idempotent — nothing left to fix
  });

  it("preserves both buildings even when they share an id (keyed by position, never by id)", () => {
    const a = building("dup", 4, 100);
    const b = building("dup", 4, 200);
    const result = reconcilePlacement(5, [a, b]);
    expect(result.buildings.length).toBe(2);
    expect(result.repaired).toBe(1);
    expect(new Set(result.buildings.map((x) => x.plotIndex)).size).toBe(2);
  });

  // Round-3 finding C2: every reconcile test up to here fed only duplicate
  // POSITIVE INTEGERS. The `Number.isInteger(i) && i >= 0` guard exists
  // specifically for NaN / negative / fractional plotIndex — the corrupt
  // F12-import / corrupt-core-recovery case this reconciler exists for
  // (§3.6) — and had zero coverage.
  it("repairs NaN, negative, and fractional plotIndex — the corrupt-import/recovery case, not just duplicates", () => {
    const clean = building("keeper", 2, 50); // legitimately occupies 2 — must survive untouched
    const nan = building("bad-nan", NaN, 100);
    const negative = building("bad-negative", -3, 150);
    const fractional = building("bad-fractional", 1.5, 200);
    const result = reconcilePlacement(3, [clean, nan, negative, fractional]);

    expect(result.repaired).toBe(3);
    expect(result.buildings[0]).toBe(clean); // untouched — same object reference
    expect(result.buildings[0].plotIndex).toBe(2);

    const repairedIndices = result.buildings.slice(1).map((b) => b.plotIndex);
    for (const i of repairedIndices) {
      expect(Number.isInteger(i)).toBe(true);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(isMaskedPlotIndex(i)).toBe(false); // never re-seated onto a void cell (ADDENDUM-07)
    }
    // Distinct from each other AND from the survivor's lot 2.
    expect(new Set([2, ...repairedIndices]).size).toBe(4);

    // Idempotent — a second pass over the repaired output finds nothing left to fix.
    const second = reconcilePlacement(result.plotsOpened, result.buildings);
    expect(second.repaired).toBe(0);
    expect(second.buildings).toBe(result.buildings);
  });
});

describe("AC-R2 — a valid pre-change town needs no repair", () => {
  // ADDENDUM-07: "valid" no longer means "dense indices 0..N-1" — block-edge
  // masking means most such runs now include a void cell, and correctly
  // NEEDS repair (see the describe block right below this one). The town a
  // real player boots with zero writes is one built through the REAL
  // placement pipeline instead — `pickPlot(i, buildings, () => 0)` is
  // AC-P7's own dense sequence over the UNMASKED lots, so this is the
  // masking-aware replacement for the old literal `i` fixture, not a
  // different claim.
  it("returns repaired: 0 for a town built through the real placement pipeline, nextPlotIndex = N", () => {
    for (const N of [0, 1, 12, 37, 600]) {
      const buildings: Building[] = [];
      for (let i = 0; i < N; i++) buildings.push(building(`b${i}`, pickPlot(i, buildings, () => 0), i));
      const result = reconcilePlacement(N, buildings);
      expect(result.repaired).toBe(0);
      expect(result.buildings).toBe(buildings); // reference-identical — the caller can skip the write entirely
      expect(result.plotsOpened).toBe(N);
    }
  });
});

describe("ADDENDUM-07 — reconcilePlacement re-seats a legacy save's building off a masked (void) cell", () => {
  it("a dense 0..N-1 legacy town (the PRE-masking valid shape) now needs repair — every masked occupant moves to an unmasked lot", () => {
    const N = 40;
    const buildings = Array.from({ length: N }, (_, i) => building(`b${i}`, i, i));
    const maskedCount = buildings.filter((b) => isMaskedPlotIndex(b.plotIndex)).length;
    expect(maskedCount).toBeGreaterThan(0); // the scenario actually exercises the new branch

    const result = reconcilePlacement(N, buildings);
    expect(result.repaired).toBe(maskedCount);
    // Every surviving plotIndex is unmasked, and still collision-free.
    const indices = result.buildings.map((b) => b.plotIndex);
    for (const i of indices) expect(isMaskedPlotIndex(i)).toBe(false);
    expect(new Set(indices).size).toBe(indices.length);
    // A building that was never on a masked cell keeps its original lot.
    for (const b of buildings) {
      if (isMaskedPlotIndex(b.plotIndex)) continue;
      expect(result.buildings.find((x) => x.id === b.id)?.plotIndex).toBe(b.plotIndex);
    }

    // Idempotent — a second pass finds nothing left to fix.
    const second = reconcilePlacement(result.plotsOpened, result.buildings);
    expect(second.repaired).toBe(0);
    expect(second.buildings).toBe(result.buildings);
  });

  it("never re-seats a repaired building onto ANOTHER masked cell", () => {
    // Every index 0..15 (block 0) is either masked or forced-occupied here,
    // so any repair must reach past block 0 for an unmasked lot.
    const buildings = Array.from({ length: 16 }, (_, i) => building(`b${i}`, i, i));
    const result = reconcilePlacement(16, buildings);
    for (const b of result.buildings) expect(isMaskedPlotIndex(b.plotIndex)).toBe(false);
  });
});

// ── ADDENDUM-02 §4.1/§8.3 — moveBuilding (AC-M1..AC-M4, AC-M11) ──

describe("AC-M1 — a move to a free in-town lot", () => {
  it("returns ok: true, an array differing ONLY in that building's plotIndex, and echoes from/to", () => {
    const a = building("a", 0);
    const b = building("b", 1);
    const buildings = [a, b];
    const result = moveBuilding(12, buildings, "a", 5);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.from).toBe(0);
    expect(result.to).toBe(5);
    expect(result.buildings.find((x) => x.id === "a")?.plotIndex).toBe(5);
    expect(result.buildings.find((x) => x.id === "b")).toBe(b); // untouched, same reference
    expect(buildings[0].plotIndex).toBe(0); // input never mutated
  });
});

describe("AC-M2 — rejection cases, exact reasons, inputs never mutated", () => {
  it("occupied -> 'occupied'", () => {
    // plot 1 is MASKED (block 0, ADDENDUM-07) — that has its own dedicated
    // "out-of-town" rejection test; plot 2 is unmasked, so it isolates V4.
    const buildings = [building("a", 0), building("b", 2)];
    const result = moveBuilding(12, buildings, "a", 2);
    expect(result).toEqual({ ok: false, reason: "occupied" });
    expect(buildings[0].plotIndex).toBe(0);
  });

  it("to === from -> 'same-plot'", () => {
    const buildings = [building("a", 0)];
    const result = moveBuilding(12, buildings, "a", 0);
    expect(result).toEqual({ ok: false, reason: "same-plot" });
  });

  it("to < 0 -> 'out-of-town'", () => {
    const buildings = [building("a", 0)];
    expect(moveBuilding(12, buildings, "a", -1)).toEqual({ ok: false, reason: "out-of-town" });
  });

  it("to >= openPlotCount -> 'out-of-town'", () => {
    const buildings = [building("a", 0)];
    const pool = openPlotCount(1, buildings);
    expect(moveBuilding(1, buildings, "a", pool)).toEqual({ ok: false, reason: "out-of-town" });
  });

  it("non-integer to -> 'out-of-town'", () => {
    const buildings = [building("a", 0)];
    expect(moveBuilding(12, buildings, "a", 1.5)).toEqual({ ok: false, reason: "out-of-town" });
    expect(moveBuilding(12, buildings, "a", NaN)).toEqual({ ok: false, reason: "out-of-town" });
  });

  it("unknown id -> 'not-found'", () => {
    const buildings = [building("a", 0)];
    expect(moveBuilding(12, buildings, "ghost", 5)).toEqual({ ok: false, reason: "not-found" });
  });

  it("D-37 — cannot move past the open pool even into an index that LOOKS plausible", () => {
    const buildings = [building("a", 0)];
    const pool = openPlotCount(1, buildings);
    // one past the pool boundary — still rejected, not silently clamped
    expect(moveBuilding(1, buildings, "a", pool + 5)).toEqual({ ok: false, reason: "out-of-town" });
  });

  it("ADDENDUM-07 — a masked (void) destination is rejected as 'out-of-town', reusing the existing reason code", () => {
    const buildings = [building("a", 2)]; // plot 2 is unmasked (block 0)
    const maskedTarget = 7; // block 0's plot 7 is masked (insetR = 1), for any plotsOpened
    expect(isMaskedPlotIndex(maskedTarget)).toBe(true);
    expect(moveBuilding(12, buildings, "a", maskedTarget)).toEqual({ ok: false, reason: "out-of-town" });
  });

  it("ADDENDUM-07 — every UNMASKED lot in the pool remains a legal destination (masking rejects, never over-rejects)", () => {
    const buildings = [building("a", 2)];
    for (let to = 0; to < openPlotCount(12, buildings); to++) {
      if (isMaskedPlotIndex(to) || to === buildings[0].plotIndex) continue;
      expect(moveBuilding(12, buildings, "a", to).ok).toBe(true);
    }
  });
});

describe("AC-M3 — every OTHER field survives a move untouched", () => {
  it("id/source/categoryId/variantIndex/builtOn/createdAt are identical (toEqual minus plotIndex)", () => {
    const original: Building = {
      id: "a",
      source: { kind: "nospend", date: "2026-08-01" },
      categoryId: "park",
      variantIndex: 2,
      plotIndex: 0,
      builtOn: "2026-08-01",
      createdAt: 12345,
    };
    // plot 6 (not 7 — ADDENDUM-07 masks plot 7 of block 0, always; see the
    // dedicated masked-destination rejection test below for that case).
    const result = moveBuilding(12, [original], "a", 6);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    const moved = result.buildings[0];
    expect(moved).toEqual({ ...original, plotIndex: 6 });
  });
});

describe("AC-M4 — moveBuilding touches nothing but the buildings array (no TownState involvement)", () => {
  it("the function signature takes/returns no TownState field at all — a caller cannot pass one in", () => {
    // moveBuilding's own signature (plotsOpened: number, buildings, id, to) has
    // no TownState parameter, so slotsUsedToday/streakDays/nextPlotIndex/queue/etc
    // are structurally unreachable — this is the AC's own contract, exercised
    // end-to-end (against a real TownState) in useTownStore's move action.
    const buildings = [building("a", 0)];
    const result = moveBuilding(12, buildings, "a", 5);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result)).toEqual(["ok", "buildings", "from", "to"]);
  });
});

describe("AC-M11 — the frontage invariant re-asserted over the DESTINATION space, at three town sizes", () => {
  function roadNeighborCount(row: number, col: number): number {
    return [isRoadCell(row - 1, col), isRoadCell(row + 1, col), isRoadCell(row, col - 1), isRoadCell(row, col + 1)].filter(
      Boolean,
    ).length;
  }

  // ADDENDUM-07: scoped to every UNMASKED index — the actual legal
  // destination space now that moveBuilding rejects a masked one. A masked
  // index is void and was never a real destination in the first place.
  it("every LEGAL (unmasked) destination in the open pool at 12 / 24 / 600 has an orthogonal road neighbor", () => {
    for (const plotsOpened of [12, 24, 600]) {
      const pool = openPlotCount(plotsOpened, []);
      for (let i = 0; i < pool; i++) {
        if (isMaskedPlotIndex(i)) continue;
        const { row, col } = cellFromIndex(i);
        expect(roadNeighborCount(row, col)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

