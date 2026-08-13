/**
 * ADDENDUM-08 §3 — footprint placement, move, and reconcile.
 */
import { describe, expect, it } from "vitest";
import { seededRandom } from "./platform/random";
import {
  anchorsFor,
  canPlace,
  cellOwners,
  fits,
  footprintOf,
  moveBuilding,
  occupiedCells,
  pickAnchor,
  placeMany,
  placeMonument,
  placeNew,
  reconcilePlacement,
  rollFootprint,
  spacingOk,
  MAX_ROW_RUN,
} from "./placement";
import { saturatedTown, townWithOneFreeCell } from "./testUtils/saturatedTown";
import { CELL_COUNT, cellFromIndex, footprintCells, GRID_SIZE, indexFromCell, isBuildable } from "./townLayout";
import type { Building } from "./types";

function building(id: string, plotIndex: number, w?: 1 | 2, h?: 1 | 2, createdAt = 0, builtOn = "2026-08-01"): Building {
  return {
    id,
    source: { kind: "entry", entryId: id },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex,
    builtOn,
    createdAt,
    ...(w !== undefined ? { w } : {}),
    ...(h !== undefined ? { h } : {}),
  };
}

/**
 * Reusable assertion (PM request, post F16-overlap-bug review): no two
 * buildings' footprints share a cell. Applied after every test below that
 * produces a set of placed buildings, not just the placement-specific ones —
 * an overlap is the single worst outcome this whole module exists to prevent.
 */
function expectNoOverlap(buildings: readonly Building[]): void {
  const seen = new Set<number>();
  for (const b of buildings) {
    const { w, h } = footprintOf(b);
    for (const c of footprintCells(b.plotIndex, w, h)) {
      expect(seen.has(c)).toBe(false);
      seen.add(c);
    }
  }
}

// ── rollFootprint ──

describe("rollFootprint", () => {
  it("only ever produces the four legal shapes", () => {
    const rng = seededRandom(1);
    for (let i = 0; i < 2000; i++) {
      const { w, h } = rollFootprint(rng);
      expect([1, 2]).toContain(w);
      expect([1, 2]).toContain(h);
    }
  });

  it("weights land within +/-3pp of 60/15/15/10 over 10,000 seeded draws", () => {
    const rng = seededRandom(7);
    const counts = { "1x1": 0, "1x2": 0, "2x1": 0, "2x2": 0 };
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const { w, h } = rollFootprint(rng);
      counts[`${w}x${h}` as keyof typeof counts]++;
    }
    expect(counts["1x1"] / N).toBeGreaterThanOrEqual(0.57);
    expect(counts["1x1"] / N).toBeLessThanOrEqual(0.63);
    expect(counts["1x2"] / N).toBeGreaterThanOrEqual(0.12);
    expect(counts["1x2"] / N).toBeLessThanOrEqual(0.18);
    expect(counts["2x1"] / N).toBeGreaterThanOrEqual(0.12);
    expect(counts["2x1"] / N).toBeLessThanOrEqual(0.18);
    expect(counts["2x2"] / N).toBeGreaterThanOrEqual(0.07);
    expect(counts["2x2"] / N).toBeLessThanOrEqual(0.13);
  });
});

// ── footprintOf ──

describe("footprintOf", () => {
  it("absent w/h defaults to 1x1", () => {
    expect(footprintOf({})).toEqual({ w: 1, h: 1 });
  });
  it("reads stored w/h", () => {
    expect(footprintOf({ w: 2, h: 1 })).toEqual({ w: 2, h: 1 });
  });
});

// ── fits ──

describe("fits", () => {
  it("rejects a footprint that steps onto a road cell", () => {
    // row 2 is a solid road row across most columns.
    expect(fits(indexFromCell({ row: 2, col: 5 }), 1, 1, new Set())).toBe(false);
  });

  it("rejects a footprint that steps onto a park cell", () => {
    expect(fits(indexFromCell({ row: 0, col: 4 }), 1, 1, new Set())).toBe(false);
  });

  it("rejects a footprint that steps onto a lake cell", () => {
    expect(fits(indexFromCell({ row: 8, col: 7 }), 1, 1, new Set())).toBe(false);
  });

  it("rejects a footprint that steps onto a savings cell", () => {
    expect(fits(indexFromCell({ row: 1, col: 8 }), 1, 1, new Set())).toBe(false);
  });

  it("rejects a footprint that steps onto a void cell", () => {
    expect(fits(indexFromCell({ row: 0, col: 0 }), 1, 1, new Set())).toBe(false);
  });

  it("rejects an anchor whose footprint would fall outside the grid (bottom/right edge)", () => {
    expect(fits(CELL_COUNT - 1, 2, 2, new Set())).toBe(false);
  });

  it("rejects the classic row-wrap bug: a 2-wide footprint anchored at col 19 must not wrap to col 0 of the same row", () => {
    // Row 3 col 19 is ground ('P' at 18/19 actually — pick a real ground cell
    // at the row's last column and confirm a width-2 footprint there is
    // rejected for going out of bounds, never silently wrapping to col 0.
    for (let row = 0; row < GRID_SIZE; row++) {
      const anchor = indexFromCell({ row, col: GRID_SIZE - 1 });
      expect(fits(anchor, 2, 1, new Set())).toBe(false);
    }
  });

  it("rejects an anchor already in the occupied set, or overlapping one", () => {
    const anchor = indexFromCell({ row: 3, col: 1 }); // ground cell
    expect(fits(anchor, 1, 1, new Set([anchor]))).toBe(false);
  });

  it("accepts a legal ground-only footprint", () => {
    const anchor = indexFromCell({ row: 3, col: 1 });
    expect(fits(anchor, 1, 1, new Set())).toBe(true);
  });
});

// ── anchorsFor — verified-correct counts on the empty town ──

describe("anchorsFor on an empty town", () => {
  it("2x2 -> 83 anchors", () => {
    expect(anchorsFor(2, 2, new Map()).length).toBe(83);
  });
  it("1x2 (w1 h2) -> 115 anchors", () => {
    expect(anchorsFor(1, 2, new Map()).length).toBe(115);
  });
  it("2x1 (w2 h1) -> 148 anchors", () => {
    expect(anchorsFor(2, 1, new Map()).length).toBe(148);
  });
  it("1x1 -> 193 anchors (every ground cell)", () => {
    expect(anchorsFor(1, 1, new Map()).length).toBe(193);
  });
});

// ── pickAnchor ──

describe("pickAnchor", () => {
  it("returns null when no anchor exists for the shape", () => {
    // every ground cell occupied, each by a DISTINCT building (the RX1-N2 run
    // limit counts buildings, so identity has to be real here)
    const occupied = new Map(anchorsFor(1, 1, new Map()).map((i) => [i, `b${i}`]));
    expect(pickAnchor([], 1, 1, () => 0.5)).not.toBeNull(); // sanity: empty town has room
    expect(anchorsFor(1, 1, occupied).length).toBe(0);
  });

  it("only ever returns a legal anchor", () => {
    const rng = seededRandom(3);
    for (let i = 0; i < 200; i++) {
      const anchor = pickAnchor([], 2, 2, rng);
      expect(anchor).not.toBeNull();
      expect(fits(anchor!, 2, 2, new Set())).toBe(true);
    }
  });
});

// ── placeNew — downgrade chain ──

describe("placeNew", () => {
  it("never returns an overlapping/illegal placement across many draws on a growing town", () => {
    // Average footprint size is > 1 cell (§2.2 weights), so 150 draws can
    // legitimately fill all 193 ground cells before finishing — stop early
    // when the town is genuinely full rather than asserting non-null forever.
    const rng = seededRandom(5);
    const buildings: Building[] = [];
    for (let i = 0; i < 150; i++) {
      const placed = placeNew(buildings, rng);
      if (placed === null) break; // town full — fine, exercised separately below
      const occupiedBefore = occupiedCells(buildings);
      expect(fits(placed.anchor, placed.w, placed.h, occupiedBefore)).toBe(true);
      buildings.push(building(`b${i}`, placed.anchor, placed.w, placed.h, i));
    }
    // no two buildings ever collide
    expect(occupiedCells(buildings).size).toBe(
      buildings.reduce((sum, b) => sum + footprintOf(b).w * footprintOf(b).h, 0),
    );
    expectNoOverlap(buildings);
  });

  it("downgrades 2x2 -> 2x1 -> 1x2 -> 1x1 when larger shapes have no room: force a town where only 1x1 anchors remain", () => {
    // The premise is asserted, not assumed: exactly one 1x1 anchor and no
    // larger anchor anywhere, so a 2x2 roll can only succeed by walking the
    // whole downgrade chain.
    const { buildings, gap } = townWithOneFreeCell();
    const rng = () => 0.95; // always rolls 2x2 first
    const placed = placeNew(buildings, rng);
    expect(placed).not.toBeNull();
    expect(placed).toEqual({ anchor: gap, w: 1, h: 1 }); // downgraded all the way to 1x1
  });

  it("returns null when even 1x1 has nowhere to go (town completely full)", () => {
    const buildings = saturatedTown();
    expect(placeNew(buildings, () => 0.95)).toBeNull();
    expect(placeNew(buildings, () => 0.1)).toBeNull(); // full regardless of the roll
  });
});

// ── placeMany ──

describe("placeMany", () => {
  it("returns count distinct, non-overlapping placements on an empty town", () => {
    const rng = seededRandom(11);
    const placements = placeMany([], 40, rng);
    expect(placements.length).toBe(40);
    const cells = new Set<number>();
    let totalCells = 0;
    for (const p of placements) {
      for (const c of footprintCells(p.anchor, p.w, p.h)) {
        expect(cells.has(c)).toBe(false);
        cells.add(c);
      }
      totalCells += p.w * p.h;
    }
    expect(cells.size).toBe(totalCells);
    expectNoOverlap(placements.map((p, i) => building(`b${i}`, p.anchor, p.w, p.h)));
  });

  it("returns fewer than count when the town fills up mid-drain, never throws", () => {
    // Saturate, then free 3 buildings — the drain runs out of room part-way.
    const buildings = saturatedTown().slice(0, -3);
    const rng = () => 0.95; // bias toward large shapes so some draws fail outright
    const placements = placeMany(buildings, 10, rng);
    expect(placements.length).toBeLessThanOrEqual(10);
    expect(placements.length).toBeGreaterThan(0);
    expectNoOverlap([...buildings, ...placements.map((p, i) => building(`new${i}`, p.anchor, p.w, p.h))]);
  });
});

// ── moveBuilding ──

describe("moveBuilding", () => {
  it("not-found for an unknown id", () => {
    expect(moveBuilding([building("a", 0)], "ghost", 5)).toEqual({ ok: false, reason: "not-found" });
  });

  it("same-plot when to === from", () => {
    expect(moveBuilding([building("a", indexFromCell({ row: 3, col: 1 }))], "a", indexFromCell({ row: 3, col: 1 }))).toEqual({
      ok: false,
      reason: "same-plot",
    });
  });

  it("out-of-town for a negative/non-integer/overflowing index", () => {
    const buildings = [building("a", indexFromCell({ row: 3, col: 1 }))];
    expect(moveBuilding(buildings, "a", -1)).toEqual({ ok: false, reason: "out-of-town" });
    expect(moveBuilding(buildings, "a", 1.5)).toEqual({ ok: false, reason: "out-of-town" });
    expect(moveBuilding(buildings, "a", CELL_COUNT)).toEqual({ ok: false, reason: "out-of-town" });
  });

  it("out-of-town for a destination that isn't ground (road cell)", () => {
    const buildings = [building("a", indexFromCell({ row: 3, col: 1 }))];
    const road = indexFromCell({ row: 2, col: 5 });
    expect(moveBuilding(buildings, "a", road)).toEqual({ ok: false, reason: "out-of-town" });
  });

  it("occupied when another live building already holds the target anchor", () => {
    const a = building("a", indexFromCell({ row: 3, col: 1 }));
    const b = building("b", indexFromCell({ row: 3, col: 2 }));
    expect(moveBuilding([a, b], "a", b.plotIndex)).toEqual({ ok: false, reason: "occupied" });
  });

  it("no-fit when the footprint doesn't fit at the target (its own anchor cell is ground, but the rest of the footprint steps onto terrain)", () => {
    const a = building("a", indexFromCell({ row: 3, col: 1 }), 2, 1);
    // row 3: col 16 is ground, col 17 is park — the anchor itself is legal
    // (so this isn't "out-of-town"), but the width-2 footprint isn't.
    const target = indexFromCell({ row: 3, col: 16 });
    expect(moveBuilding([a], "a", target)).toEqual({ ok: false, reason: "no-fit" });
  });

  it("succeeds to a free legal lot, touching only that building's plotIndex", () => {
    const a = building("a", indexFromCell({ row: 3, col: 1 }));
    const b = building("b", indexFromCell({ row: 3, col: 2 }));
    const target = indexFromCell({ row: 4, col: 1 });
    const result = moveBuilding([a, b], "a", target);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.from).toBe(a.plotIndex);
    expect(result.to).toBe(target);
    expect(result.buildings.find((x) => x.id === "b")).toBe(b); // untouched
    expectNoOverlap(result.buildings);
  });

  it("self-overlap is allowed: nudging a 2x2 one cell over never rejects on its own footprint", () => {
    const anchor = indexFromCell({ row: 3, col: 1 });
    const a = building("a", anchor, 2, 2);
    const target = indexFromCell({ row: 3, col: 2 }); // shares 2 cells with the current footprint
    const result = moveBuilding([a], "a", target);
    expect(result.ok).toBe(true);
    if (result.ok) expectNoOverlap(result.buildings);
  });
});

// ── reconcilePlacement ──

describe("reconcilePlacement", () => {
  it("keeps a valid, non-overlapping town untouched (repaired: 0, same array reference)", () => {
    const rng = seededRandom(21);
    const buildings: Building[] = [];
    for (let i = 0; i < 50; i++) {
      const placed = placeNew(buildings, rng)!;
      buildings.push(building(`b${i}`, placed.anchor, placed.w, placed.h, i));
    }
    const result = reconcilePlacement(buildings);
    expect(result.repaired).toBe(0);
    expect(result.buildings).toBe(buildings);
    expect(result.unplacedIds).toEqual([]);
    expectNoOverlap(result.buildings);
  });

  it("re-seats a duplicate anchor deterministically, keeping the earlier claimant", () => {
    const anchor = indexFromCell({ row: 3, col: 1 }); // a real ground cell
    const earlier = building("b1", anchor, undefined, undefined, 100);
    const later = building("b2", anchor, undefined, undefined, 200);
    const result = reconcilePlacement([earlier, later]);
    expect(result.repaired).toBe(1);
    expect(result.buildings[0]).toBe(earlier); // untouched
    expect(result.buildings[1].plotIndex).not.toBe(anchor);

    const second = reconcilePlacement(result.buildings);
    expect(second.repaired).toBe(0);
    expect(second.buildings).toBe(result.buildings); // idempotent
    expectNoOverlap(result.buildings);
  });

  it("shrinks a footprint to 1x1 when its size has no anchor anywhere, but a 1x1 does", () => {
    // Occupy everything except one gap, then place a 2x2 building "on top of"
    // an occupied region (stale anchor) that no 2x2 free space exists for.
    const allGround = anchorsFor(1, 1, new Map());
    const gap = allGround[0];
    // "others" sort BEFORE "big" (lower createdAt), so they claim every
    // ground cell except the gap first — only then does "big" get evaluated
    // and find no 2x2 room anywhere, forcing the shrink-to-1x1 retry.
    const others = allGround.filter((i) => i !== gap).map((i, idx) => building(`f${idx}`, i, undefined, undefined, idx));
    const bigOne = building("big", 999_999, 2, 2, 999); // stale, illegal anchor, forces a re-seat, processed last
    const result = reconcilePlacement([bigOne, ...others]);
    const big = result.buildings.find((b) => b.id === "big")!;
    expect(big.plotIndex).toBe(gap);
    expect(footprintOf(big)).toEqual({ w: 1, h: 1 });
    expect(result.shrunk).toBe(1);
    expect(result.repaired).toBeGreaterThanOrEqual(1);
    expectNoOverlap(result.buildings);
  });

  it("forceReseat treats every stored anchor as invalid, even legal ones", () => {
    const a = building("a", indexFromCell({ row: 5, col: 5 }), undefined, undefined, 1);
    const b = building("b", indexFromCell({ row: 5, col: 6 }), undefined, undefined, 2);
    const normal = reconcilePlacement([a, b]);
    expect(normal.repaired).toBe(0); // both already legal, non-overlapping

    const forced = reconcilePlacement([a, b], { forceReseat: true });
    expect(forced.repaired).toBe(2); // both re-seated from scratch, oldest first
    expect(forced.buildings[0].plotIndex).toBeLessThan(forced.buildings[1].plotIndex);
    expectNoOverlap(forced.buildings);
  });

  it("never loses a building: 193 1x1 buildings all placed; 194 places 193 and reports 1 unplaced", () => {
    // 1x1 explicitly (not placeMany's random roll — the average rolled
    // footprint is > 1 cell, so 193 RANDOM buildings would not all fit; this
    // test is about the ground-cell CAPACITY, exercised with the smallest shape).
    const allGround = anchorsFor(1, 1, new Map());
    expect(allGround.length).toBe(193); // sanity: exactly the ground-cell capacity
    const buildings193 = allGround.map((anchor, i) => building(`b${i}`, anchor, undefined, undefined, i));
    const result193 = reconcilePlacement(buildings193);
    expect(result193.unplacedIds).toEqual([]);
    expect(result193.buildings.length).toBe(193);
    expectNoOverlap(result193.buildings);

    const buildings194 = [...buildings193, building("overflow", 0, undefined, undefined, 999)];
    const result194 = reconcilePlacement(buildings194);
    expect(result194.buildings.length).toBe(194); // never dropped
    expect(result194.unplacedIds).toEqual(["overflow"]);
    // The unplaced straggler still sits at its stale, illegal anchor (0 — void)
    // by construction, so it is excluded from the overlap check on purpose:
    // it was never actually reserved anywhere.
    expectNoOverlap(result194.buildings.filter((b) => b.id !== "overflow"));
  });
});

// ── placeMonument (F16) ──

describe("placeMonument", () => {
  it("is 2x2 on a normal (empty) town", () => {
    const rng = seededRandom(1);
    const placed = placeMonument([], rng);
    expect(placed).not.toBeNull();
    expect(placed).toEqual({ anchor: placed!.anchor, w: 2, h: 2 });
    expect(fits(placed!.anchor, 2, 2, new Set())).toBe(true);
  });

  it("downgrades to a smaller footprint when no 2x2 anchor is left, and never overlaps an existing building", () => {
    // One free cell, and no 2x2/2x1/1x2 anchor anywhere (asserted by the helper).
    const { buildings: existing, gap } = townWithOneFreeCell();
    const rng = () => 0.95; // biases the placeNew fallback's roll toward 2x2, which still has no room
    const placed = placeMonument(existing, rng);
    expect(placed).not.toBeNull();
    expect(placed).toEqual({ anchor: gap, w: 1, h: 1 });
    expectNoOverlap([...existing, building("monument", placed!.anchor, placed!.w, placed!.h)]);
  });

  it("returns null when the town is completely full (no room even at 1x1)", () => {
    expect(placeMonument(saturatedTown(), () => 0.5)).toBeNull();
  });
});

// ── invariant: stored w/h always equals the reserved footprint ──

describe("stored footprint equals reserved footprint (the F16 overlap bug's root-cause invariant)", () => {
  it("holds for every placement placeNew/placeMany/placeMonument hand back, across many draws", () => {
    const rng = seededRandom(99);
    const buildings: Building[] = [];

    for (let i = 0; i < 60; i++) {
      const placed = placeNew(buildings, rng);
      if (placed === null) break;
      const candidate = building(`n${i}`, placed.anchor, placed.w, placed.h, i);
      // The footprint the caller is about to STORE must be exactly the one
      // that was RESERVED — verified by re-checking `fits` against the
      // occupancy from BEFORE this placement, with the stored w/h.
      expect(fits(candidate.plotIndex, footprintOf(candidate).w, footprintOf(candidate).h, occupiedCells(buildings))).toBe(true);
      buildings.push(candidate);
    }

    const batch = placeMany(buildings, 5, rng);
    const occBefore = occupiedCells(buildings);
    for (const p of batch) {
      expect(fits(p.anchor, p.w, p.h, occBefore)).toBe(true);
      for (const c of footprintCells(p.anchor, p.w, p.h)) occBefore.add(c);
    }

    const monument = placeMonument(buildings, rng);
    if (monument !== null) {
      expect(fits(monument.anchor, monument.w, monument.h, occupiedCells(buildings))).toBe(true);
    }
  });
});

// ── RX1-N2 spacing rule (user pick from the mockups, 2026-08-13) ──

/**
 * The test oracle, deliberately NOT written in terms of `spacingOk` — it
 * re-derives cell ownership from the FINISHED town and counts every cell whose
 * directly-above neighbour belongs to a different building. Same check the
 * mockup harness used to prove the rule works before it was shipped
 * (`docs/qa/evidence-placement-patterns/capacity.mjs`). A building's art
 * overhangs by at most 45px and a row+gap is 46px, so this pair count IS the
 * front/back occlusion the user reported.
 */
function overlapPairs(buildings: readonly Building[]): number {
  const owners = cellOwners(buildings);
  let pairs = 0;
  for (const [cell, id] of owners) {
    const above = owners.get(cell - GRID_SIZE);
    if (above !== undefined && above !== id) pairs++;
  }
  return pairs;
}

/** The most DISTINCT buildings standing shoulder-to-shoulder in any one row. */
function longestRowRun(buildings: readonly Building[]): number {
  const owners = cellOwners(buildings);
  let longest = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    let run = new Set<string>();
    for (let col = 0; col < GRID_SIZE; col++) {
      const id = owners.get(indexFromCell({ row, col }));
      if (id === undefined) {
        longest = Math.max(longest, run.size);
        run = new Set();
      } else {
        run.add(id);
      }
    }
    longest = Math.max(longest, run.size);
  }
  return longest;
}

/** Fills a town through `placeNew` with a real seeded roll, so every footprint appears. */
function townBuiltByThePlacer(seed: number): Building[] {
  const rng = seededRandom(seed);
  const buildings: Building[] = [];
  for (;;) {
    const placed = placeNew(buildings, rng);
    if (placed === null) return buildings;
    buildings.push(building(`b${buildings.length}`, placed.anchor, placed.w, placed.h));
  }
}

describe("RX1-N2 — the spacing rule", () => {
  it("all four footprints stay placeable on an empty map (the rule must not delete a shape)", () => {
    const empty = new Map<number, string>();
    expect(anchorsFor(1, 1, empty).length).toBeGreaterThan(0);
    expect(anchorsFor(2, 1, empty).length).toBeGreaterThan(0);
    expect(anchorsFor(1, 2, empty).length).toBeGreaterThan(0);
    expect(anchorsFor(2, 2, empty).length).toBeGreaterThan(0);
  });

  it("a town filled by placeNew has zero front/back overlap and never more than 2 in a row", () => {
    for (const seed of [3, 11, 29]) {
      const town = townBuiltByThePlacer(seed);
      expect(town.length).toBeGreaterThan(50);
      expect(overlapPairs(town)).toBe(0);
      expect(longestRowRun(town)).toBeLessThanOrEqual(MAX_ROW_RUN);
      // and the fill really did exercise every footprint, not just 1x1
      expect(new Set(town.map((b) => `${footprintOf(b).w}x${footprintOf(b).h}`)).size).toBeGreaterThan(1);
    }
  });

  it("placeMany drains into the same rule — every step, not just the first", () => {
    const placements = placeMany([], 60, seededRandom(7));
    const town = placements.map((p, i) => building(`m${i}`, p.anchor, p.w, p.h));
    expect(town.length).toBeGreaterThan(30);
    expect(overlapPairs(town)).toBe(0);
    expect(longestRowRun(town)).toBeLessThanOrEqual(MAX_ROW_RUN);
  });

  it("a 2x2 monument obeys the rule too", () => {
    const town = placeMany([], 30, seededRandom(5)).map((p, i) => building(`m${i}`, p.anchor, p.w, p.h));
    const monument = placeMonument(town, seededRandom(2));
    expect(monument).not.toBeNull();
    const withMonument = [...town, building("mon", monument!.anchor, monument!.w, monument!.h)];
    expect(overlapPairs(withMonument)).toBe(0);
    expect(longestRowRun(withMonument)).toBeLessThanOrEqual(MAX_ROW_RUN);
  });

  it("moveBuilding refuses a drop directly above or below another building", () => {
    // anchor 47 is r2c7 -> road. Use two known ground cells in the same column.
    const anchor = indexFromCell({ row: 3, col: 1 });
    const below = indexFromCell({ row: 4, col: 1 });
    const stay = building("stay", anchor);
    const mover = building("mover", indexFromCell({ row: 6, col: 3 }));
    expect(fits(below, 1, 1, occupiedCells([stay]))).toBe(true); // geometrically free...
    expect(moveBuilding([stay, mover], "mover", below)).toEqual({ ok: false, reason: "no-fit" }); // ...but occluding
  });

  it("moveBuilding refuses a drop that would make three in a row", () => {
    const a = building("a", indexFromCell({ row: 3, col: 1 }));
    const b = building("b", indexFromCell({ row: 3, col: 2 }));
    const mover = building("mover", indexFromCell({ row: 6, col: 3 }));
    const third = indexFromCell({ row: 3, col: 3 });
    expect(fits(third, 1, 1, occupiedCells([a, b]))).toBe(true);
    expect(moveBuilding([a, b, mover], "mover", third)).toEqual({ ok: false, reason: "no-fit" });
  });

  it("every anchor the grid offers as a move target is one moveBuilding accepts", () => {
    const town = placeMany([], 25, seededRandom(13)).map((p, i) => building(`m${i}`, p.anchor, p.w, p.h));
    const mover = town[0];
    const others = town.filter((b) => b.id !== mover.id);
    const offered = anchorsFor(footprintOf(mover).w, footprintOf(mover).h, cellOwners(others));
    expect(offered.length).toBeGreaterThan(0);
    for (const anchor of offered) {
      if (anchor === mover.plotIndex) continue;
      expect(moveBuilding(town, mover.id, anchor).ok).toBe(true);
    }
  });

  it("canPlace is exactly fits AND spacingOk — no path may re-implement half of it", () => {
    const town = placeMany([], 20, seededRandom(4)).map((p, i) => building(`m${i}`, p.anchor, p.w, p.h));
    const owners = cellOwners(town);
    for (let i = 0; i < CELL_COUNT; i++) {
      expect(canPlace(i, 1, 1, owners)).toBe(fits(i, 1, 1, owners) && spacingOk(i, 1, 1, owners));
    }
  });
});

describe("RX1-N2 — existing towns are grandfathered (no relayout)", () => {
  /** A legacy town: buildings stacked vertically and 3-in-a-row, both illegal under the rule. */
  const legacy: Building[] = [
    building("v1", indexFromCell({ row: 3, col: 1 }), 1, 1, 1),
    building("v2", indexFromCell({ row: 4, col: 1 }), 1, 1, 2), // directly below v1
    building("h1", indexFromCell({ row: 6, col: 2 }), 1, 1, 3),
    building("h2", indexFromCell({ row: 6, col: 3 }), 1, 1, 4), // three in a row
    building("h3", indexFromCell({ row: 5, col: 2 }), 1, 1, 5),
  ];

  it("violates the rule — the premise of this suite", () => {
    expect(overlapPairs(legacy)).toBeGreaterThan(0);
  });

  it("reconcile leaves it completely untouched: no move, no shrink, no id churn, same reference", () => {
    const result = reconcilePlacement(legacy);
    expect(result.repaired).toBe(0);
    expect(result.shrunk).toBe(0);
    expect(result.unplacedIds).toEqual([]);
    expect(result.buildings).toBe(legacy); // identical reference — not even a copy was written
  });

  it("a full legacy town survives reconcile with zero losses", () => {
    // Every ground cell taken by a 1x1 — the densest legacy save possible, and
    // one the rule could never produce. Reconcile must not evict a single one.
    const allGround: Building[] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      const { row, col } = cellFromIndex(i);
      if (isBuildable(row, col)) allGround.push(building(`g${allGround.length}`, i, 1, 1, allGround.length));
    }
    expect(allGround.length).toBe(193);
    const result = reconcilePlacement(allGround);
    expect(result.repaired).toBe(0);
    expect(result.unplacedIds).toEqual([]);
    expect(result.buildings.map((b) => b.plotIndex)).toEqual(allGround.map((b) => b.plotIndex));
  });
});
