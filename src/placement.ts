/**
 * Random footprint placement + self-healing reconciler — ADDENDUM-08 §3.
 * Pure domain. No React, no storage, no Date, no Math.random (the only
 * random draws here come through the injected `rng`).
 *
 * The fixed 20x20 map (`townLayout.ts`) is read-only here: this module only
 * decides WHICH cells a building's footprint occupies, never what a cell
 * means on screen. `plotIndex` is a building's top-left (anchor) cell.
 */
import { CELL_COUNT, cellFromIndex, footprintCells, indexFromCell, inBounds, isBuildable } from "./townLayout";
import type { Building } from "./types";

export interface Placed {
  anchor: number;
  w: 1 | 2;
  h: 1 | 2;
}

/** `w`/`h` read discipline (ADDENDUM-08 §2.1) — absent means 1x1, everywhere. */
export function footprintOf(b: Pick<Building, "w" | "h">): { w: number; h: number } {
  return { w: b.w ?? 1, h: b.h ?? 1 };
}

/** ADDENDUM-08 §2.2 weights: 1x1 60%, 1x2/2x1 15% each, 2x2 10%. */
export function rollFootprint(rng: () => number): { w: 1 | 2; h: 1 | 2 } {
  const r = rng();
  if (r < 0.6) return { w: 1, h: 1 };
  if (r < 0.75) return { w: 1, h: 2 };
  if (r < 0.9) return { w: 2, h: 1 };
  return { w: 2, h: 2 };
}

export function occupiedCells(buildings: readonly Building[]): Set<number> {
  const cells = new Set<number>();
  for (const b of buildings) {
    const { w, h } = footprintOf(b);
    for (const cell of footprintCells(b.plotIndex, w, h)) cells.add(cell);
  }
  return cells;
}

/**
 * True iff every cell of the `w`x`h` footprint anchored at `anchor` is in
 * bounds, `ground`, and not already occupied. Bounds are checked PER CELL
 * here (not via `footprintCells`, which trusts its caller) — that is what
 * stops a 2-wide footprint from wrapping the row edge (col 19 -> col 0).
 */
export function fits(anchor: number, w: number, h: number, occupied: ReadonlySet<number>): boolean {
  const { row, col } = cellFromIndex(anchor);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const r = row + dy;
      const c = col + dx;
      if (!inBounds(r, c) || !isBuildable(r, c)) return false;
      if (occupied.has(indexFromCell({ row: r, col: c }))) return false;
    }
  }
  return true;
}

// ponytail: scans all 400 cells per call — fine at this town size (one map,
// never grows). Index by cell if the map ever grows past a few thousand.
export function anchorsFor(w: number, h: number, occupied: ReadonlySet<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) if (fits(i, w, h, occupied)) out.push(i);
  return out;
}

function pickAnchorIn(occupied: ReadonlySet<number>, w: number, h: number, rng: () => number): number | null {
  const anchors = anchorsFor(w, h, occupied);
  if (anchors.length === 0) return null;
  const r = Math.min(Math.max(rng(), 0), 0.999_999_999); // rng() === 1 must not index past the end
  return anchors[Math.floor(r * anchors.length)];
}

export function pickAnchor(buildings: readonly Building[], w: number, h: number, rng: () => number): number | null {
  return pickAnchorIn(occupiedCells(buildings), w, h, rng);
}

/**
 * The downgrade path for a rolled footprint (§3.1): starting from 2x2 walks
 * the full chain 2x2 -> 2x1 -> 1x2 -> 1x1; starting from 2x1 or 1x2 downgrades
 * straight to 1x1 (skipping the other non-square shape); 1x1 has nowhere
 * smaller to go.
 */
function downgradeChain(rolled: { w: 1 | 2; h: 1 | 2 }): Array<{ w: 1 | 2; h: 1 | 2 }> {
  if (rolled.w === 2 && rolled.h === 2) {
    return [
      { w: 2, h: 2 },
      { w: 2, h: 1 },
      { w: 1, h: 2 },
      { w: 1, h: 1 },
    ];
  }
  if (rolled.w === 1 && rolled.h === 1) return [{ w: 1, h: 1 }];
  return [rolled, { w: 1, h: 1 }];
}

export function placeNew(buildings: readonly Building[], rng: () => number): Placed | null {
  const rolled = rollFootprint(rng);
  const occupied = occupiedCells(buildings);
  for (const shape of downgradeChain(rolled)) {
    const anchor = pickAnchorIn(occupied, shape.w, shape.h, rng);
    if (anchor !== null) return { anchor, w: shape.w, h: shape.h };
  }
  return null; // town genuinely full even at 1x1 — caller queues it (§3.1 step 3)
}

/**
 * N distinct, non-overlapping placements in one pass, for a queue/settlement
 * drain — each accumulates into the SAME occupied set so no two collide. May
 * return FEWER than `count` when the town fills up mid-drain; never throws.
 */
export function placeMany(buildings: readonly Building[], count: number, rng: () => number): Placed[] {
  const occupied = occupiedCells(buildings);
  const out: Placed[] = [];
  for (let k = 0; k < count; k++) {
    const rolled = rollFootprint(rng);
    let placed: Placed | null = null;
    for (const shape of downgradeChain(rolled)) {
      const anchor = pickAnchorIn(occupied, shape.w, shape.h, rng);
      if (anchor !== null) {
        placed = { anchor, w: shape.w, h: shape.h };
        break;
      }
    }
    if (placed === null) break; // full even at 1x1 — stop, hand back what we placed so far
    for (const cell of footprintCells(placed.anchor, placed.w, placed.h)) occupied.add(cell);
    out.push(placed);
  }
  return out;
}

/**
 * F16 monument placement (ADDENDUM-08 §2.2): tries 2x2 first — monuments are
 * the town's landmark — and only downgrades (via the normal `placeNew` roll
 * + downgrade chain) when no 2x2 anchor is left. Whatever this returns IS
 * what was reserved: the caller MUST store this exact w/h on the Building,
 * never override it — a stored footprint larger than what was reserved
 * leaves the extra cells unclaimed, so the next building placed can land
 * inside the monument (bug, not a stylistic choice).
 */
export function placeMonument(buildings: readonly Building[], rng: () => number): Placed | null {
  const anchor = pickAnchor(buildings, 2, 2, rng);
  if (anchor !== null) return { anchor, w: 2, h: 2 };
  return placeNew(buildings, rng); // town too full for 2x2 — a smaller monument, never overlapping
}

// ── move via long-press ──

export type MoveRejection = "not-found" | "same-plot" | "out-of-town" | "occupied" | "no-fit";

export type MoveResult =
  | { ok: true; buildings: Building[]; from: number; to: number }
  | { ok: false; reason: MoveRejection };

/**
 * Checked in order:
 *   not-found  - the building must exist
 *   same-plot  - `toAnchor === building.plotIndex` (UI treats this as cancel)
 *   out-of-town - `toAnchor` outside the grid, or its cell isn't `ground`
 *   occupied   - another LIVE building already holds the anchor cell
 *   no-fit     - the full footprint doesn't fit at `toAnchor` (terrain, bounds,
 *                or another building's cell anywhere in the footprint)
 *
 * Self-overlap is allowed: the mover's OWN current cells are excluded from
 * the occupancy checked here, so nudging a 2x2 one cell over never rejects
 * on its own footprint.
 */
export function moveBuilding(buildings: readonly Building[], buildingId: string, toAnchor: number): MoveResult {
  const index = buildings.findIndex((b) => b.id === buildingId);
  if (index === -1) return { ok: false, reason: "not-found" };

  const building = buildings[index];
  if (toAnchor === building.plotIndex) return { ok: false, reason: "same-plot" };
  if (!Number.isInteger(toAnchor) || toAnchor < 0 || toAnchor >= CELL_COUNT) {
    return { ok: false, reason: "out-of-town" };
  }
  const { row, col } = cellFromIndex(toAnchor);
  if (!isBuildable(row, col)) return { ok: false, reason: "out-of-town" };

  const otherCells = occupiedCells(buildings.filter((b) => b.id !== buildingId));
  if (otherCells.has(toAnchor)) return { ok: false, reason: "occupied" };

  const { w, h } = footprintOf(building);
  if (!fits(toAnchor, w, h, otherCells)) return { ok: false, reason: "no-fit" };

  const next = buildings.slice() as Building[];
  next[index] = { ...building, plotIndex: toAnchor };
  return { ok: true, buildings: next, from: building.plotIndex, to: toAnchor };
}

// ── reconcile (self-heal, runs on every boot) ──

export interface ReconcileResult {
  /** Same order and object identities as the input, except repaired entries. Identical reference when repaired === 0. */
  buildings: Building[];
  /** Count of buildings whose plotIndex changed (re-seated), shrinks included. */
  repaired: number;
  /** Of `repaired`, how many also had their footprint shrunk to 1x1 because their original size had no legal anchor anywhere. */
  shrunk: number;
  /** Ids that had no legal anchor even at 1x1 — the town is genuinely full. Kept in `buildings`, untouched, at their stale position: NEVER dropped. The caller (queue) is responsible for placing them once room opens up. */
  unplacedIds: string[];
}

function firstFitAnchor(w: number, h: number, occupied: ReadonlySet<number>): number | null {
  for (let i = 0; i < CELL_COUNT; i++) if (fits(i, w, h, occupied)) return i;
  return null;
}

/**
 * Deterministic by (createdAt, id, plotIndex), so two devices repairing the
 * same corrupt/relayouted town land on the same result. `opts.forceReseat`
 * treats every stored anchor as invalid (ADDENDUM-08 §4's version-4
 * migration: old plotIndex values are meaningless in the new coordinate
 * space) — every building lays out fresh in sort order, oldest first.
 */
export function reconcilePlacement(buildings: readonly Building[], opts?: { forceReseat?: boolean }): ReconcileResult {
  const forceReseat = opts?.forceReseat ?? false;
  const order = buildings
    .map((_, pos) => pos)
    .sort((x, y) => {
      const a = buildings[x];
      const b = buildings[y];
      return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : a.plotIndex - b.plotIndex);
    });

  const occupied = new Set<number>();
  let repaired = 0;
  let shrunk = 0;
  const unplacedIds: string[] = [];
  const fixed = buildings.slice() as Building[];

  for (const pos of order) {
    const b = buildings[pos];
    const { w, h } = footprintOf(b);

    if (!forceReseat && fits(b.plotIndex, w, h, occupied)) {
      for (const cell of footprintCells(b.plotIndex, w, h)) occupied.add(cell);
      continue; // legal where it already stands — keep, no write
    }

    let anchor = firstFitAnchor(w, h, occupied);
    let nextW = w;
    let nextH = h;
    if (anchor === null && (w > 1 || h > 1)) {
      anchor = firstFitAnchor(1, 1, occupied);
      nextW = 1;
      nextH = 1;
      if (anchor !== null) shrunk++;
    }

    if (anchor === null) {
      // No room even at 1x1. The building is NEVER dropped — it keeps every
      // field except its position, and re-attempts a seat on the next
      // reconcile (i.e. the next boot, or as soon as a cell frees up).
      //
      // It is parked at -1 rather than left on its stale anchor, because a
      // stale anchor is a position placement never granted: those cells are
      // already owned by a seated building, so the renderer's cell->building
      // map would let this phantom OVERWRITE a real building and hide it.
      // Same invariant as the F16 monument — stored footprint is always the
      // one placement actually reserved. -1 is outside 0..399, so every
      // consumer that walks the grid skips it by construction.
      unplacedIds.push(b.id);
      fixed[pos] = { ...b, plotIndex: -1 };
      continue;
    }

    for (const cell of footprintCells(anchor, nextW, nextH)) occupied.add(cell);
    fixed[pos] =
      nextW === w && nextH === h ? { ...b, plotIndex: anchor } : { ...b, plotIndex: anchor, w: nextW as 1 | 2, h: nextH as 1 | 2 };
    repaired++;
  }

  return {
    buildings: repaired === 0 && unplacedIds.length === 0 ? (buildings as Building[]) : fixed,
    repaired,
    shrunk,
    unplacedIds,
  };
}
