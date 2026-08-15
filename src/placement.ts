/**
 * Random footprint placement + self-healing reconciler — ADDENDUM-08 §3.
 * Pure domain. No React, no storage, no Date, no Math.random (the only
 * random draws here come through the injected `rng`).
 *
 * The fixed 20x20 map (`townLayout.ts`) is read-only here: this module only
 * decides WHICH cells a building's footprint occupies, never what a cell
 * means on screen. `plotIndex` is a building's top-left (anchor) cell.
 */
import { CELL_COUNT, GRID_SIZE, cellFromIndex, footprintCells, indexFromCell, inBounds, isBuildable } from "./townLayout";
import type { Building } from "./types";

/**
 * All `fits` ever asks of an occupancy set is "is this cell taken?". Typed as
 * that one method so both a `Set<number>` (reconcile's running claim set) and a
 * `cellOwners` map satisfy it without a conversion at the call site.
 */
export type CellSet = Pick<ReadonlySet<number>, "has">;

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

/**
 * Cell -> the id of the building that owns it. Same key set as
 * `occupiedCells`, plus the identity `spacingOk` needs: the run limit counts
 * BUILDINGS, not cells, so it has to be able to tell two neighbours apart from
 * one 2-wide building.
 */
export function cellOwners(buildings: readonly Building[]): Map<number, string> {
  const owners = new Map<number, string>();
  for (const b of buildings) {
    const { w, h } = footprintOf(b);
    for (const cell of footprintCells(b.plotIndex, w, h)) owners.set(cell, b.id);
  }
  return owners;
}

export function occupiedCells(buildings: readonly Building[]): Set<number> {
  return new Set(cellOwners(buildings).keys());
}

/**
 * RX1-N2 — at most this many BUILDINGS may sit shoulder-to-shoulder in one row
 * before an empty cell is forced. Counted per building, never per cell: a 2x1
 * is ONE building occupying two cells and must never trip its own limit.
 * (A cell-based cap would make 2x1 and 2x2 unplaceable outright — measured.)
 */
export const MAX_ROW_RUN = 2;

/**
 * The 2026-08-13 anti-occlusion rule the user picked from the mockups
 * (`docs/qa/evidence-placement-patterns/`), in two halves:
 *
 *  - VERTICAL (what actually fixes the occlusion): no other building may sit in
 *    the row directly above the footprint's top edge, or directly below its
 *    bottom edge, in any column the footprint spans. A building's art overhangs
 *    by at most MAX_ART_OVERHANG_PX (45) and a row+gap is 46, so the row
 *    directly behind is the ONLY row it can ever hide — clear that row and the
 *    front/back overlap is gone. The check is SYMMETRIC on purpose: a one-sided
 *    "row above must be clear" rule lets a building seated LATER, ABOVE an
 *    existing one, pass its own check and still occlude it.
 *  - HORIZONTAL (the look the user asked for): at most `MAX_ROW_RUN` buildings
 *    in a row before a gap, giving the scattered 띄엄띄엄 rhythm.
 *
 * `owners` must EXCLUDE the building being placed or moved — callers pass the
 * other buildings only, so a 2x2 nudged one cell over never rejects on itself.
 */
export function spacingOk(anchor: number, w: number, h: number, owners: ReadonlyMap<number, string>): boolean {
  const { row, col } = cellFromIndex(anchor);
  for (let dx = 0; dx < w; dx++) {
    if (owners.has(indexFromCell({ row: row - 1, col: col + dx }))) return false;
    if (owners.has(indexFromCell({ row: row + h, col: col + dx }))) return false;
  }
  for (let dy = 0; dy < h; dy++) {
    const r = row + dy;
    const neighbours = new Set<string>();
    for (let c = col - 1; c >= 0; c--) {
      const owner = owners.get(indexFromCell({ row: r, col: c }));
      if (owner === undefined) break;
      neighbours.add(owner);
    }
    for (let c = col + w; c < GRID_SIZE; c++) {
      const owner = owners.get(indexFromCell({ row: r, col: c }));
      if (owner === undefined) break;
      neighbours.add(owner);
    }
    if (neighbours.size + 1 > MAX_ROW_RUN) return false;
  }
  return true;
}

/**
 * THE placement predicate. Every path that seats a NEW building or validates a
 * move-mode drop goes through this one function — `anchorsFor` (which feeds
 * `placeNew`/`placeMany`/`placeMonument`/`pickAnchor` and the grid's drop
 * targets) and `moveBuilding`. Do not re-implement either half at a call site.
 *
 * `reconcilePlacement` deliberately does NOT use this: it is the repair path,
 * and its contract is "never lose or move a building that is legal where it
 * stands". Existing towns predate the rule and are grandfathered — putting the
 * rule here would relayout every saved town on the next boot and park ~50
 * buildings at -1. Reconcile keeps bare `fits`.
 */
export function canPlace(anchor: number, w: number, h: number, owners: ReadonlyMap<number, string>): boolean {
  return fits(anchor, w, h, owners) && spacingOk(anchor, w, h, owners);
}

/**
 * True iff every cell of the `w`x`h` footprint anchored at `anchor` is in
 * bounds, `ground`, and not already occupied. Bounds are checked PER CELL
 * here (not via `footprintCells`, which trusts its caller) — that is what
 * stops a 2-wide footprint from wrapping the row edge (col 19 -> col 0).
 */
export function fits(anchor: number, w: number, h: number, occupied: CellSet): boolean {
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

/**
 * Every anchor a NEW building (or a move-mode drop) may legally take — the
 * spacing rule included, via `canPlace`. Takes `cellOwners`, not a bare cell
 * set, because the run limit needs to tell buildings apart; the narrower type
 * is deliberate, so a caller cannot accidentally ask for rule-checked anchors
 * with identity-free data and silently get the rule skipped.
 */
// ponytail: scans all 400 cells per call — fine at this town size (one map,
// never grows). Index by cell if the map ever grows past a few thousand.
export function anchorsFor(w: number, h: number, owners: ReadonlyMap<number, string>): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) if (canPlace(i, w, h, owners)) out.push(i);
  return out;
}

function pickAnchorIn(occupied: ReadonlyMap<number, string>, w: number, h: number, rng: () => number): number | null {
  const anchors = anchorsFor(w, h, occupied);
  if (anchors.length === 0) return null;
  const r = Math.min(Math.max(rng(), 0), 0.999_999_999); // rng() === 1 must not index past the end
  return anchors[Math.floor(r * anchors.length)];
}

export function pickAnchor(buildings: readonly Building[], w: number, h: number, rng: () => number): number | null {
  return pickAnchorIn(cellOwners(buildings), w, h, rng);
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
  const occupied = cellOwners(buildings);
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
  const occupied = cellOwners(buildings);
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
    // A synthetic id per drain step: these buildings do not exist yet, and the
    // run limit only needs them to be DISTINCT from each other.
    for (const cell of footprintCells(placed.anchor, placed.w, placed.h)) occupied.set(cell, `pending-${k}`);
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
 * Every anchor a move-mode drag of `buildingId` may legally land on — the
 * ONE function both the grid's droppable highlight (`TownGrid.tsx`) and
 * `moveBuilding`'s accept/reject decision route through, so they can never
 * drift apart on what counts as a legal destination.
 *
 * `anchorsFor(w, h, otherCells)` alone is not quite this: it happily
 * includes the building's OWN current anchor, since excluding the mover's
 * cells from `otherCells` (so a footprint can overlap its own old spot while
 * nudging) also makes its old spot look like free ground. `moveBuilding`
 * rejects that exact anchor as `same-plot` — tapping the moving building
 * again is already the documented cancel gesture (ADDENDUM-02 §4.3), not a
 * destination — so it must never be offered as one. Filtered out here, at
 * the shared root, instead of trusted to accidentally never render (which
 * held only because a multi-cell building paints as a single merged DOM
 * tile — see the `moveAnchorsFor` block in `placement.test.ts`).
 */
export function moveAnchorsFor(buildings: readonly Building[], buildingId: string, w: 1 | 2, h: 1 | 2): number[] {
  const building = buildings.find((b) => b.id === buildingId);
  if (!building) return [];
  const otherCells = cellOwners(buildings.filter((b) => b.id !== buildingId));
  return anchorsFor(w, h, otherCells).filter((anchor) => anchor !== building.plotIndex);
}

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

  const otherCells = cellOwners(buildings.filter((b) => b.id !== buildingId));
  if (otherCells.has(toAnchor)) return { ok: false, reason: "occupied" };

  const { w, h } = footprintOf(building);
  // `canPlace`, not `fits`: a hand-placed building must obey the same spacing
  // rule as a placed one, or the player can put back exactly what the placer
  // refuses to create. The mover's own cells are already excluded above.
  if (!canPlace(toAnchor, w, h, otherCells)) return { ok: false, reason: "no-fit" };

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

/**
 * Repair-path seating: bare `fits`, NOT `canPlace`. See `canPlace` — existing
 * towns are grandfathered, and a rule-checked repair would relayout every saved
 * town and strand the buildings that no longer fit.
 */
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
