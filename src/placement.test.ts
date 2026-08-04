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
  occupiedPlots,
  openPlotCount,
  pickPlot,
  pickPlotIn,
  poolSize,
  reconcilePlacement,
} from "./placement";
import { renderedTileCount } from "./townLayout";
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

describe("AC-P4 — open-lot count after N buildings placed through the REAL pickPlot pipeline is exactly renderedTileCount(N + 1); nextPlotIndex after N build-producing acts is exactly N", () => {
  it("pacing is a pure function of history alone (§3.4, §6.6) — a hand-built 0..N-1 occupancy would NOT have caught this: round-3 finding traced a real failure to seed 1 by N=4 (idx 11, pool 24, expected 12) under the pre-fix pool sizing", () => {
    const rng = seededRandom(1); // the exact seed the round-3 probe used
    let plotsOpened = 0;
    const buildings: Building[] = [];
    for (let N = 0; N <= 600; N++) {
      expect(plotsOpened).toBe(N); // the +1-per-build counter, unaffected by WHERE the dice landed
      expect(openPlotCount(plotsOpened, buildings)).toBe(renderedTileCount(N + 1));
      const idx = pickPlot(plotsOpened, buildings, rng);
      buildings.push(building(`b${N}`, idx));
      plotsOpened += 1;
    }
  });

  it("holds under a second, independent seed too — not an artifact of one lucky draw sequence", () => {
    const rng = seededRandom(42);
    let plotsOpened = 0;
    const buildings: Building[] = [];
    for (let N = 0; N <= 200; N++) {
      expect(openPlotCount(plotsOpened, buildings)).toBe(renderedTileCount(N + 1));
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

describe("AC-P7 — rng() = 0 reproduces the pre-change sequential town exactly on a fresh town", () => {
  it("pickPlot returns 0, 1, 2, ... in order as buildings accumulate", () => {
    const buildings: Building[] = [];
    for (let i = 0; i < 30; i++) {
      const idx = pickPlot(i, buildings, () => 0);
      expect(idx).toBe(i);
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

describe("AC-R1 — reconcilePlacement repairs a duplicate plotIndex", () => {
  it("re-seats the later of two buildings sharing index 4 at the lowest free lot, leaves the earlier alone, preserves order, and is idempotent", () => {
    const earlier = building("b1", 4, 100);
    const later = building("b2", 4, 200);
    const result = reconcilePlacement(5, [earlier, later]);

    expect(result.repaired).toBe(1);
    expect(result.buildings[0]).toBe(earlier); // untouched — same object reference
    expect(result.buildings[0].plotIndex).toBe(4);
    expect(result.buildings[1].plotIndex).toBe(0); // lowest free lot (0..3 free, 4 already taken)
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
  it("returns repaired: 0 and the SAME array reference for dense indices 0..N-1, nextPlotIndex = N", () => {
    for (const N of [0, 1, 12, 37, 600]) {
      const buildings = Array.from({ length: N }, (_, i) => building(`b${i}`, i));
      const result = reconcilePlacement(N, buildings);
      expect(result.repaired).toBe(0);
      expect(result.buildings).toBe(buildings); // reference-identical — the caller can skip the write entirely
      expect(result.plotsOpened).toBe(N);
    }
  });
});

