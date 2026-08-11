/**
 * INDEPENDENT invariant tests for ADDENDUM-08 placement — written by the PM,
 * not by the module's implementer, and deliberately not derived from
 * `placement.test.ts`. The one who builds never grades (CLAUDE.md, 26장).
 *
 * These cover only the three guarantees whose failure hurts a real player:
 *   1. no two buildings ever occupy the same cell,
 *   2. no building is ever lost — not by placement, not by reconcile,
 *   3. a building's stored footprint is always the one placement reserved.
 *
 * They are randomised sequence tests (fixed seeds, so failures reproduce),
 * because the single-shot examples in the implementer's suite cannot catch an
 * invariant that only breaks after a particular ORDER of operations.
 */
import { describe, expect, it } from "vitest";
import { footprintCells, isBuildable, cellFromIndex, CELL_COUNT } from "./townLayout";
import {
  footprintOf,
  moveBuilding,
  occupiedCells,
  placeMany,
  placeMonument,
  placeNew,
  reconcilePlacement,
  type Placed,
} from "./placement";
import type { Building } from "./types";

/** Deterministic LCG — a seeded rng so any failure below reproduces exactly. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

let nextId = 0;
function make(placed: Placed, createdAt: number): Building {
  return {
    id: `b${nextId++}`,
    source: { kind: "entry", entryId: `e${nextId}` },
    categoryId: null,
    variantIndex: 0,
    plotIndex: placed.anchor,
    w: placed.w,
    h: placed.h,
    builtOn: "2026-01-01",
    createdAt,
  } as Building;
}

/** Every occupied cell, counted — duplicates are the bug we are hunting. */
function cellUsage(buildings: readonly Building[]): Map<number, string[]> {
  const usage = new Map<number, string[]>();
  for (const b of buildings) {
    const { w, h } = footprintOf(b);
    for (const cell of footprintCells(b.plotIndex, w, h)) {
      const owners = usage.get(cell) ?? [];
      owners.push(b.id);
      usage.set(cell, owners);
    }
  }
  return usage;
}

function expectNoOverlap(buildings: readonly Building[]) {
  const clashes = [...cellUsage(buildings)].filter(([, owners]) => owners.length > 1);
  expect(clashes.map(([cell, owners]) => `cell ${cell}: ${owners.join(" vs ")}`)).toEqual([]);
}

function expectAllOnBuildableGround(buildings: readonly Building[]) {
  const offMap: string[] = [];
  for (const b of buildings) {
    const { w, h } = footprintOf(b);
    for (const cell of footprintCells(b.plotIndex, w, h)) {
      const { row, col } = cellFromIndex(cell);
      if (cell < 0 || cell >= CELL_COUNT || !isBuildable(row, col)) offMap.push(`${b.id}@${cell}`);
    }
  }
  expect(offMap).toEqual([]);
}

describe("ADDENDUM-08 placement invariants (independent)", () => {
  it("never overlaps across 500 sequential placements, over 5 seeds", () => {
    for (const seed of [1, 7, 42, 1337, 90210]) {
      const rng = seeded(seed);
      let buildings: Building[] = [];
      for (let i = 0; i < 500; i++) {
        const placed = placeNew(buildings, rng);
        if (!placed) break; // town full — legitimate, and asserted separately below
        buildings = [...buildings, make(placed, i)];
      }
      expectNoOverlap(buildings);
      expectAllOnBuildableGround(buildings);
    }
  });

  it("stored footprint always equals the footprint placement reserved", () => {
    const rng = seeded(2024);
    let buildings: Building[] = [];
    for (let i = 0; i < 300; i++) {
      const placed = placeNew(buildings, rng);
      if (!placed) break;
      const b = make(placed, i);
      expect({ w: b.w, h: b.h }).toEqual({ w: placed.w, h: placed.h });
      buildings = [...buildings, b];
    }
    expect(buildings.length).toBeGreaterThan(50);
  });

  it("placeMany never returns overlapping placements, even when it under-delivers", () => {
    const rng = seeded(555);
    const buildings: Building[] = [];
    // Drain in chunks until the town refuses more, then assert the whole town.
    for (let round = 0; round < 40; round++) {
      const placements = placeMany(buildings, 25, rng);
      placements.forEach((p, k) => buildings.push(make(p, round * 25 + k)));
      expectNoOverlap(buildings);
      if (placements.length < 25) break; // under-delivery is allowed; overlap is not
    }
    expectAllOnBuildableGround(buildings);
  });

  it("a monument never overlaps, and is 2x2 on a town with room", () => {
    const rng = seeded(99);
    const monument = placeMonument([], rng);
    expect(monument).not.toBeNull();
    expect({ w: monument!.w, h: monument!.h }).toEqual({ w: 2, h: 2 });
  });

  it("fills the town without overlap, then reports the true capacity", () => {
    const rng = seeded(31337);
    let buildings: Building[] = [];
    for (let i = 0; i < 1000; i++) {
      const placed = placeNew(buildings, rng);
      if (!placed) break;
      buildings = [...buildings, make(placed, i)];
    }
    expectNoOverlap(buildings);
    expectAllOnBuildableGround(buildings);
    // A full town must consume real ground, and can never exceed the 193 ground cells.
    const used = occupiedCells(buildings).size;
    expect(used).toBeLessThanOrEqual(193);
    expect(buildings.length).toBeGreaterThan(80);
  });

  it("reconcile never loses a building — every id is either placed or reported unplaced", () => {
    const rng = seeded(4242);
    let buildings: Building[] = [];
    for (let i = 0; i < 250; i++) {
      const placed = placeNew(buildings, rng);
      if (!placed) break;
      buildings = [...buildings, make(placed, i)];
    }
    const before = buildings.map((b) => b.id).sort();

    const result = reconcilePlacement(buildings);
    const after = [...result.buildings.map((b) => b.id), ...result.unplacedIds].sort();
    expect(after).toEqual(before);
    expectNoOverlap(result.buildings);
  });

  it("forced reseat (the version-4 migration) loses nothing and overlaps nothing", () => {
    const rng = seeded(808);
    let buildings: Building[] = [];
    for (let i = 0; i < 150; i++) {
      const placed = placeNew(buildings, rng);
      if (!placed) break;
      buildings = [...buildings, make(placed, i)];
    }
    const before = buildings.map((b) => b.id).sort();

    const result = reconcilePlacement(buildings, { forceReseat: true });
    const after = [...result.buildings.map((b) => b.id), ...result.unplacedIds].sort();
    expect(after).toEqual(before);
    expectNoOverlap(result.buildings);
    expectAllOnBuildableGround(result.buildings);
  });

  it("reconcile repairs garbage anchors from a pre-ADDENDUM-08 save without dropping anyone", () => {
    // Old serpentine indices, negatives, NaN, fractional, out-of-range, duplicates —
    // exactly the shapes a version-3 save can present after the coordinate change.
    const garbage = [-5, 0, 0, 12.5, Number.NaN, 399, 4000, 77, 77, 190];
    const buildings = garbage.map((idx, i) => ({
      ...make({ anchor: idx, w: 1, h: 1 }, i),
      plotIndex: idx,
    })) as Building[];

    const result = reconcilePlacement(buildings, { forceReseat: true });
    const after = [...result.buildings.map((b) => b.id), ...result.unplacedIds].sort();
    expect(after).toEqual(buildings.map((b) => b.id).sort());
    expectNoOverlap(result.buildings);
    expectAllOnBuildableGround(result.buildings);
  });

  it("a building reconcile cannot seat is parked at -1, never on a cell another building owns", () => {
    // 200 1x1 buildings against 193 ground cells: 7 cannot be seated. Each of
    // those must own NO cell — parking them on a stale anchor would let the
    // renderer's cell->building map hide a real building behind a phantom.
    const buildings: Building[] = [];
    for (let i = 0; i < 200; i++) {
      buildings.push({ ...make({ anchor: 100, w: 1, h: 1 }, i), plotIndex: 100 } as Building);
    }

    const result = reconcilePlacement(buildings, { forceReseat: true });
    expect(result.unplacedIds.length).toBe(200 - 193);

    const unplaced = new Set(result.unplacedIds);
    for (const b of result.buildings) {
      if (unplaced.has(b.id)) expect(b.plotIndex).toBeLessThan(0);
      else expect(b.plotIndex).toBeGreaterThanOrEqual(0);
    }
    // Nothing lost, and the seated ones tile the ground with no collisions.
    expect(result.buildings.length).toBe(200);
    expectNoOverlap(result.buildings.filter((b) => b.plotIndex >= 0));
    expectAllOnBuildableGround(result.buildings.filter((b) => b.plotIndex >= 0));
  });

  it("moving buildings around never creates an overlap", () => {
    const rng = seeded(1212);
    let buildings: Building[] = [];
    for (let i = 0; i < 120; i++) {
      const placed = placeNew(buildings, rng);
      if (!placed) break;
      buildings = [...buildings, make(placed, i)];
    }
    for (let attempt = 0; attempt < 400; attempt++) {
      const target = buildings[Math.floor(rng() * buildings.length)];
      const toAnchor = Math.floor(rng() * CELL_COUNT);
      const result = moveBuilding(buildings, target.id, toAnchor);
      if (result.ok) {
        buildings = [...result.buildings];
        expectNoOverlap(buildings);
      }
    }
    expectAllOnBuildableGround(buildings);
  });
});
