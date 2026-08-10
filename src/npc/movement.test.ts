import { describe, expect, it } from "vitest";
import type { RandomPort } from "../platform/random";
import { EXTRA_REST_CHANCE, initialNpcStates, stepNpcs, type NpcState } from "./movement";

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
