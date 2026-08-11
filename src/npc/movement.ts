/**
 * NPC random-walk movement — reimplemented (numbers and feel copied, code
 * not translated line-by-line) from
 * `C:\Users\user\app-dev-team\lifetown\app\lib\features\village\npc\npc_controller.dart`
 * (our own prior work, Flutter). `EXTRA_REST_CHANCE = 0.25` is Dart's
 * `_extraRestChance` (npc_controller.dart:78), copied verbatim; "prefer not
 * to reverse direction" and "no pathfinding, plain 4-neighbor random walk"
 * are the same feel as Dart's `_startWalkToNeighbor`. What's NOT ported:
 * Dart's continuous per-NPC idle/walk duration timers — PM-DECISIONS §F-NPC
 * specifies a simpler discrete-step model instead, one random-walk decision
 * per tick, driven by `NpcLayer`'s single shared `setInterval` (never one
 * timer per NPC, never per-NPC React state or `Math`/`Date` access here).
 *
 * Pure functions only: no React, no timers, no `Math.random` (rule R-6 —
 * eslint-enforced). Randomness always comes through the injected
 * `RandomPort` (`src/platform/random.ts`), so every function here is fully
 * unit-testable with a fake, deterministic sequence.
 */
import type { RandomPort } from "../platform/random";

/** One NPC's position + facing on the road grid. Never persisted — decoration only (ADDENDUM-05 §3, rule R-2). */
export interface NpcState {
  row: number;
  col: number;
  /** true = sprite flips to face -col (left). Preserved across vertical-only moves and rests. */
  facingLeft: boolean;
  /** The delta of the last successful move, or null before the first one — used only to avoid immediately reversing. */
  lastDelta: { dRow: number; dCol: number } | null;
}

/** Dart's `_extraRestChance` (npc_controller.dart:78) — copied verbatim. */
export const EXTRA_REST_CHANCE = 0.25;

const NEIGHBOR_DELTAS: ReadonlyArray<{ dRow: number; dCol: number }> = [
  { dRow: -1, dCol: 0 },
  { dRow: 1, dCol: 0 },
  { dRow: 0, dCol: -1 },
  { dRow: 0, dCol: 1 },
];

/**
 * Spreads `count` NPCs evenly across `roadCells` so they don't all start
 * stacked on one tile — same idea as Dart's `_spawnInitial` step-spacing,
 * reimplemented without randomness (index-driven, deterministic — R-2:
 * nothing here is a stored seed, it's recomputed from `npcCount` every time).
 */
export function initialNpcStates(count: number, roadCells: readonly { row: number; col: number }[]): NpcState[] {
  if (roadCells.length === 0 || count <= 0) return [];
  const step = Math.max(1, Math.floor(roadCells.length / count));
  return Array.from({ length: count }, (_, i) => {
    const cell = roadCells[(i * step) % roadCells.length];
    return { row: cell.row, col: cell.col, facingLeft: false, lastDelta: null };
  });
}

/**
 * Advances every NPC by exactly one step: each independently either rests
 * (dead end, or the `restChance` draw) or moves to one random walkable
 * neighbor, preferring not to immediately reverse. `isWalkable` is the
 * caller's predicate — `NpcLayer` passes townLayout's `isWalkable`
 * (road OR park, ADDENDUM-08 §5) directly; out-of-bounds cells already read
 * as non-walkable there, so no separate bound check is needed here.
 */
export function stepNpcs(
  states: readonly NpcState[],
  isWalkable: (row: number, col: number) => boolean,
  random: RandomPort,
  restChance: number = EXTRA_REST_CHANCE,
): NpcState[] {
  return states.map((npc) => {
    const candidates = NEIGHBOR_DELTAS.filter((d) => isWalkable(npc.row + d.dRow, npc.col + d.dCol));
    const reverse = npc.lastDelta ? { dRow: -npc.lastDelta.dRow, dCol: -npc.lastDelta.dCol } : null;
    const preferred = reverse ? candidates.filter((d) => d.dRow !== reverse.dRow || d.dCol !== reverse.dCol) : candidates;
    const pool = preferred.length > 0 ? preferred : candidates;

    if (pool.length === 0 || random.next() < restChance) {
      return npc; // dead end, or Dart's "sometimes just rest more" (npc_controller.dart:300)
    }

    const pick = pool[Math.min(pool.length - 1, Math.floor(random.next() * pool.length))];
    return {
      row: npc.row + pick.dRow,
      col: npc.col + pick.dCol,
      facingLeft: pick.dCol !== 0 ? pick.dCol < 0 : npc.facingLeft,
      lastDelta: pick,
    };
  });
}

/**
 * Orthogonal flood-fill of the walkable graph from `seed` — the set of cells
 * an NPC can ever reach by walking. ADDENDUM-08's fixed map has a few park
 * cells that touch no road (isolated pockets); `NpcLayer` seeds this from a
 * road cell and spawns NPCs only in the returned component, so a spawn can
 * never land in a pocket it can then never leave. Plain BFS, not a
 * pathfinder — there is no goal, just "what's reachable at all".
 */
export function reachableCells(
  seed: { row: number; col: number },
  isWalkable: (row: number, col: number) => boolean,
): { row: number; col: number }[] {
  const key = (row: number, col: number) => `${row},${col}`;
  const seen = new Set([key(seed.row, seed.col)]);
  const cells = [seed];
  for (let i = 0; i < cells.length; i++) {
    const cur = cells[i];
    for (const d of NEIGHBOR_DELTAS) {
      const row = cur.row + d.dRow;
      const col = cur.col + d.dCol;
      if (isWalkable(row, col) && !seen.has(key(row, col))) {
        seen.add(key(row, col));
        cells.push({ row, col });
      }
    }
  }
  return cells;
}
