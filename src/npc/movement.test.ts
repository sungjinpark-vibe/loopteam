import { describe, expect, it } from "vitest";
import type { RandomPort } from "../platform/random";
import { GRID_SIZE, isRoadCell, isWalkable as mapIsWalkable, terrainAt } from "../townLayout";
import { EXTRA_REST_CHANCE, initialNpcStates, reachableCells, stepNpcs, type NpcState } from "./movement";

/** Deterministic fake `RandomPort` — replays a fixed sequence, then repeats its last value forever. */
function fakeRandom(sequence: readonly number[]): RandomPort {
  let i = 0;
  return { next: () => sequence[Math.min(i++, sequence.length - 1)] };
}

const plusRoad = (row: number, col: number) => row === 5 || col === 5; // a "+" shaped road, centered at (5,5)

describe("initialNpcStates", () => {
  it("returns exactly `count` states, spread across the given road cells", () => {
    const cells = Array.from({ length: 10 }, (_, i) => ({ row: 0, col: i }));
    const states = initialNpcStates(4, cells);
    expect(states).toHaveLength(4);
    for (const s of states) {
      expect(s.facingLeft).toBe(false);
      expect(s.lastDelta).toBeNull();
    }
    // Evenly spaced (step = floor(10/4) = 2), not all stacked on cell 0.
    const cols = states.map((s) => s.col);
    expect(new Set(cols).size).toBeGreaterThan(1);
  });

  it("returns an empty array when there are no road cells or count is 0", () => {
    expect(initialNpcStates(3, [])).toEqual([]);
    expect(initialNpcStates(0, [{ row: 0, col: 0 }])).toEqual([]);
  });
});

describe("stepNpcs", () => {
  it("is deterministic: the same states + same random sequence produce the same result", () => {
    const states: NpcState[] = [{ row: 5, col: 5, facingLeft: false, lastDelta: null }];
    const seq = [0.9, 0.1, 0.9, 0.6]; // never-rest, pick-index draws
    const a = stepNpcs(states, plusRoad, fakeRandom(seq));
    const b = stepNpcs(states, plusRoad, fakeRandom(seq));
    expect(a).toEqual(b);
  });

  it("never steps onto a non-road cell, even when it always chooses to move", () => {
    let states: NpcState[] = [{ row: 5, col: 5, facingLeft: false, lastDelta: null }];
    // random.next() always returns 0.9: never rests (>= EXTRA_REST_CHANCE), always picks the last candidate.
    for (let step = 0; step < 20; step++) {
      states = stepNpcs(states, plusRoad, fakeRandom([0.9, 0.9, 0.9, 0.9]));
      expect(plusRoad(states[0].row, states[0].col)).toBe(true);
    }
  });

  it("rests (does not move) when the random draw is below restChance, even with open candidates", () => {
    const states: NpcState[] = [{ row: 5, col: 5, facingLeft: false, lastDelta: null }];
    const next = stepNpcs(states, plusRoad, fakeRandom([0])); // 0 < EXTRA_REST_CHANCE always
    expect(next).toEqual(states);
  });

  it("rests at a dead end regardless of the random draw", () => {
    const deadEnd = (row: number, col: number) => row === 0 && col === 0; // only the NPC's own cell is walkable
    const states: NpcState[] = [{ row: 0, col: 0, facingLeft: false, lastDelta: null }];
    const next = stepNpcs(states, deadEnd, fakeRandom([0.99, 0.99]));
    expect(next).toEqual(states);
  });

  it("honors EXTRA_REST_CHANCE as the default rest probability (0.25, ported from npc_controller.dart)", () => {
    expect(EXTRA_REST_CHANCE).toBe(0.25);
  });

  it("prefers not to reverse direction when another candidate exists", () => {
    // A straight corridor along row 0: cols -1..1 walkable, nothing else.
    const corridor = (row: number, col: number) => row === 0 && col >= -1 && col <= 1;
    // NPC sits at (0,0), arrived there by moving +1 col (dCol: 1) from (0,-1).
    const states: NpcState[] = [{ row: 0, col: 0, facingLeft: false, lastDelta: { dRow: 0, dCol: 1 } }];
    // Candidates before reverse-filtering: col-1 (reverse) and col+1 (forward). Only "forward" should remain,
    // so picking "index 0 of the pool" must deterministically be the forward move.
    const next = stepNpcs(states, corridor, fakeRandom([0.9, 0]));
    expect(next[0]).toEqual({ row: 0, col: 1, facingLeft: false, lastDelta: { dRow: 0, dCol: 1 } });
  });

  it("falls back to reversing when it's the only walkable candidate (true dead end for a corridor)", () => {
    const corridor = (row: number, col: number) => row === 0 && col >= 0 && col <= 1;
    const states: NpcState[] = [{ row: 0, col: 1, facingLeft: false, lastDelta: { dRow: 0, dCol: 1 } }];
    const next = stepNpcs(states, corridor, fakeRandom([0.9, 0]));
    expect(next[0].col).toBe(0); // only the reverse move exists — must still take it, not freeze forever
  });

  it("flips facingLeft only on a horizontal move, and preserves it on a vertical-only move", () => {
    const cross = () => true; // every cell walkable — isolate the facing logic
    const movingLeft: NpcState[] = [{ row: 0, col: 0, facingLeft: false, lastDelta: null }];
    // pool order is [up, down, left, right]; pick index 2 -> "left" (dCol: -1)
    const afterLeft = stepNpcs(movingLeft, cross, fakeRandom([0.9, 2 / 4]));
    expect(afterLeft[0].facingLeft).toBe(true);

    const thenUp: NpcState[] = afterLeft;
    // pick index 0 -> "up" (dRow: -1, dCol: 0): vertical-only, facing must be preserved from the prior step.
    const afterUp = stepNpcs(thenUp, cross, fakeRandom([0.9, 0]));
    expect(afterUp[0].facingLeft).toBe(true);
  });
});

// ── Integration with the real ADDENDUM-08 map (townLayout.ts) ──
// A small deterministic LCG, seeded per starting cell — not the injected
// RandomPort (that's covered above with `fakeRandom`), just a cheap way to
// generate many varied but reproducible walks for the invariant checks below.
function lcgRandom(seed: number): RandomPort {
  let s = seed >>> 0;
  return {
    next: () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    },
  };
}

const firstRoadCell = (() => {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (isRoadCell(row, col)) return { row, col };
    }
  }
  throw new Error("no road cell found");
})();

describe("stepNpcs against the real map", () => {
  it("never steps onto ground, lake, savings, or void — only road or park", () => {
    let states: NpcState[] = [{ ...firstRoadCell, facingLeft: false, lastDelta: null }];
    const rng = lcgRandom(1);
    const visitedKinds = new Set<string>();
    for (let step = 0; step < 500; step++) {
      states = stepNpcs(states, mapIsWalkable, rng, 0.05); // low rest chance: keep it moving
      const kind = terrainAt(states[0].row, states[0].col);
      visitedKinds.add(kind);
      expect(kind === "road" || kind === "park").toBe(true);
    }
    // Confirms the walk actually used both kinds, not just the road it started on.
    expect(visitedKinds.has("road")).toBe(true);
    expect(visitedKinds.has("park")).toBe(true);
  });

  it("respects the grid bounds at all four map edges (isWalkable reads out-of-bounds as void)", () => {
    const corners = [
      { row: 0, col: 0 },
      { row: 0, col: GRID_SIZE - 1 },
      { row: GRID_SIZE - 1, col: 0 },
      { row: GRID_SIZE - 1, col: GRID_SIZE - 1 },
    ];
    for (const corner of corners) {
      let states: NpcState[] = [{ ...corner, facingLeft: false, lastDelta: null }];
      const rng = lcgRandom(corner.row * 100 + corner.col + 1);
      for (let step = 0; step < 50; step++) {
        states = stepNpcs(states, mapIsWalkable, rng, 0.1);
        expect(states[0].row).toBeGreaterThanOrEqual(0);
        expect(states[0].row).toBeLessThan(GRID_SIZE);
        expect(states[0].col).toBeGreaterThanOrEqual(0);
        expect(states[0].col).toBeLessThan(GRID_SIZE);
      }
    }
  });
});

describe("reachableCells", () => {
  it("finds the road network's own connected component (all 93 road cells)", () => {
    const cells = reachableCells(firstRoadCell, isRoadCell);
    expect(cells).toHaveLength(93);
  });

  it("road ∪ walkable component omits the isolated park pockets that touch no road", () => {
    // ADDENDUM-08's authored map has a few park cells reachable only by
    // crossing non-walkable ground (verified against the map directly:
    // 122 total walkable cells, 115 in the road-connected component).
    const allWalkable: { row: number; col: number }[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (mapIsWalkable(row, col)) allWalkable.push({ row, col });
      }
    }
    const component = reachableCells(firstRoadCell, mapIsWalkable);
    expect(allWalkable.length).toBe(122);
    expect(component.length).toBe(115);
    expect(component.length).toBeLessThan(allWalkable.length);
  });

  it("no NPC spawned in the road-connected component can ever be stranded: a long walk from every spawn cell visits many distinct cells", () => {
    const spawnCells = reachableCells(firstRoadCell, mapIsWalkable);
    for (const cell of spawnCells) {
      let states: NpcState[] = [{ ...cell, facingLeft: false, lastDelta: null }];
      const rng = lcgRandom(cell.row * 1000 + cell.col + 1);
      const visited = new Set([`${cell.row},${cell.col}`]);
      for (let step = 0; step < 300; step++) {
        states = stepNpcs(states, mapIsWalkable, rng, 0.1);
        visited.add(`${states[0].row},${states[0].col}`);
      }
      // The component is a dense grid of corridors (min observed ~49 in a
      // manual simulation) — 10 is a conservative floor that only a genuine
      // dead-end-of-one could fail.
      expect(visited.size).toBeGreaterThanOrEqual(10);
    }
  });
});
