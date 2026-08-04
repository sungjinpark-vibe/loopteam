/**
 * Random building placement + self-healing reconciler — ADDENDUM-02 §3.
 * Pure domain. No React, no storage, no Date, no Math.random (rule R-6 — the
 * only random draws here come through the injected `rng`/`RandomPort`).
 *
 * Three concepts, named apart (§3.1):
 *  - opened lots (the town's growth frontier) — `TownState.nextPlotIndex`
 *  - the open pool (which lot indices exist right now) — `openPlotCount` below
 *  - occupancy/position (which lot a building stands on) — `Building.plotIndex`
 *
 * `plotFromIndex` / `TOWN_COLUMNS` (selectors.ts) and the whole road layout
 * (townLayout.ts) are read-only here (rule R-5) — this module only decides
 * WHICH index a building holds, never what an index means on screen.
 */
import { renderedTileCount } from "./townLayout";
import type { Building } from "./types";

/**
 * The lot count the growth pool must cover, for a given growth frontier
 * (`plotsOpened`, i.e. `nextPlotIndex`) and the town's CURRENT occupancy.
 *
 * NOT simply `max(plotsOpened, highest-occupied-index)`, despite that being
 * ADDENDUM-02 §3.2's literal code block — that version folds every occupied
 * index into the pool unconditionally, so one random draw landing near the
 * top of the currently open block (an ordinary, non-corrupt outcome) drags
 * the pool's size to that draw's position instead of to the number of
 * buildings actually built. That breaks §3.4's growth table / §6.1's F2 AC /
 * §6.6's proposed invariant (town area becomes a function of the dice, not
 * of history), and it makes `reconcilePlacement` (below) see a "mismatch"
 * and fire a boot-time write on every valid, freshly-randomly-placed town —
 * the exact case §3.6 point 2 promises zero writes for. Escalated to
 * planner/director rather than silently deviated from the addendum text
 * (ADDENDUM-02 is not yet approved) — see the client-dev report for this task.
 *
 * The bump below fires ONLY when the frontier-only pool would actually be
 * unsafe for this occupancy: an index it cannot render (DE-2/G1), or so many
 * occupied lots that none would be left free (G2). Both branches are proven
 * safe for ANY (plotsOpened, taken) pair, including adversarial/corrupt
 * ones — see `poolSize`'s doc for the two-line proof of each.
 *
 * Under the real `pickPlot`/`allocatePlots` pipeline this never fires: every
 * live draw is already bounded by the SAME frontier-only pool it is about to
 * enlarge (`plotsOpened` only ever grows by exactly `+ 1` per placed
 * building — the producer call sites, ADDENDUM-02 §3.5), so by induction
 * `taken.size <= plotsOpened` and every occupied index is already
 * `< renderedTileCount(plotsOpened + 1)` before this function is asked. It
 * exists to protect the one case that genuinely needs it: a `plotIndex` that
 * did NOT come from this pipeline — an F12 import, hand-edited storage, or a
 * corrupt-recovery survivor `reconcilePlacement` chose not to re-seat because
 * it was a valid, unique, non-negative integer (just an implausibly large one).
 */
export function requiredLots(plotsOpened: number, taken: ReadonlySet<number>): number {
  const frontier = Math.max(plotsOpened, 0);
  const framedPool = renderedTileCount(frontier + 1);
  let highest = 0;
  for (const i of taken) if (Number.isInteger(i) && i >= 0) highest = Math.max(highest, i + 1);
  if (highest > framedPool || taken.size >= framedPool) return Math.max(highest, taken.size);
  return frontier;
}

/**
 * Every plot index the town currently shows — the single pool used by
 *   (a) a new building's random landing spot,
 *   (b) a move's legal destinations (follow-up task), and
 *   (c) TownGrid's tile count.
 * One definition, three consumers (rule R-5).
 *
 * The `+ 1` is not a tunable and not a "spare lots" pacing dial (DE-4). With
 * need = requiredLots(...), `poolSize = renderedTileCount(need + 1)`, so
 * `poolSize >= need + 1`. `requiredLots` returns one of two values, and both
 * make the two guarantees below hold for ANY `(plotsOpened, taken)` pair —
 * not just ones a real game session could produce:
 *
 *   - the escape valve fired: need = max(highest, taken.size), so
 *     poolSize >= need + 1 > highest > every occupied index (G1), and
 *     poolSize >= need + 1 > taken.size (G2).
 *   - it didn't: need = plotsOpened, and by the valve's own NOT-firing
 *     condition, highest <= renderedTileCount(need + 1) = poolSize and
 *     taken.size < poolSize — G1 and G2 again, and `poolSize` is then
 *     EXACTLY `renderedTileCount(plotsOpened + 1)`, which is what makes town
 *     area a pure function of the growth frontier alone (§3.4, AC-P4).
 *
 * G1 (DE-2, nothing invisible): no building can ever sit outside the
 * rendered grid. G2 (there is ALWAYS somewhere to put a building): the
 * free-lot count is >= 1 at EVERY town size, forever — this is what deletes
 * the "block is exactly full" dead end (§3.4), by arithmetic, not a message.
 */
export function poolSize(plotsOpened: number, taken: ReadonlySet<number>): number {
  return renderedTileCount(requiredLots(plotsOpened, taken) + 1);
}

/** Fresh, mutable Set — callers may add to it (`allocatePlots` does). */
export function occupiedPlots(buildings: readonly Building[]): Set<number> {
  const taken = new Set<number>();
  for (const b of buildings) taken.add(b.plotIndex);
  return taken;
}

export function openPlotCount(plotsOpened: number, buildings: readonly Building[]): number {
  return poolSize(plotsOpened, occupiedPlots(buildings));
}

/** Free lots, ascending. Bounded by the pool, so O(open lots) — one pass per save. */
export function freePlots(plotsOpened: number, buildings: readonly Building[]): number[] {
  const taken = occupiedPlots(buildings);
  const limit = poolSize(plotsOpened, taken);
  const out: number[] = [];
  for (let i = 0; i < limit; i++) if (!taken.has(i)) out.push(i);
  return out;
}

/**
 * Where a NEWLY CONSTRUCTED building lands: a uniformly random free lot in
 * the open pool (the SAME pool `poolSize`/`openPlotCount` report — R-5).
 * `taken` is the occupancy BEFORE this building.
 *
 * By G2 (`poolSize`'s doc) `poolSize > taken.size` for ANY `(plotsOpened,
 * taken)` pair, so the fallback below is provably unreachable, not merely
 * unreachable for well-formed input. It exists only so a save can NEVER
 * throw on pathological input: a throw here loses a real ledger entry, the
 * one failure this app may not have.
 */
export function pickPlotIn(plotsOpened: number, taken: ReadonlySet<number>, rng: () => number): number {
  const limit = poolSize(plotsOpened, taken);
  const pool: number[] = [];
  for (let i = 0; i < limit; i++) if (!taken.has(i)) pool.push(i);
  if (pool.length === 0) return requiredLots(plotsOpened, taken);
  const r = Math.min(Math.max(rng(), 0), 0.999_999_999); // rng() === 1 must not index past the end
  return pool[Math.floor(r * pool.length)];
}

export function pickPlot(plotsOpened: number, buildings: readonly Building[], rng: () => number): number {
  return pickPlotIn(plotsOpened, occupiedPlots(buildings), rng);
}

/**
 * N distinct lots for one F14 queue drain — no two drained buildings may
 * collide, and each must be legal at the moment it is drawn. `plotsOpened + k`
 * is what lets the k-th drained building see the block its predecessor opened.
 */
export function allocatePlots(
  plotsOpened: number,
  buildings: readonly Building[],
  count: number,
  rng: () => number,
): number[] {
  const taken = occupiedPlots(buildings); // fresh Set — safe to mutate
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const idx = pickPlotIn(plotsOpened + k, taken, rng);
    taken.add(idx);
    out.push(idx);
  }
  return out;
}

// ── §4 — move via long-press (ADDENDUM-02 §4.1) ──

export type MoveRejection = "not-found" | "same-plot" | "out-of-town" | "occupied";

export type MoveResult =
  | { ok: true; buildings: Building[]; from: number; to: number }
  | { ok: false; reason: MoveRejection };

/**
 * The ONLY mutator of `Building.plotIndex` outside placement-time (rule R-4).
 * Pure: returns a new array with exactly one building's `plotIndex` replaced.
 * Never throws, never mutates an input, and touches NOTHING else on the
 * building — not `id`, `source`, `categoryId`, `variantIndex`, `builtOn` or
 * `createdAt` (AC-M3).
 *
 * Checked in order (V1-V4, §4.1):
 *   V1 the building must exist                      -> "not-found"
 *   V2 `to === building.plotIndex`                   -> "same-plot" (UI treats this as cancel, not an error)
 *   V3 `to` must be a non-negative integer inside the CURRENT open pool
 *      (`openPlotCount` over the pre-move occupancy) -> "out-of-town" (D-37:
 *      a building may only move among lots the town has already grown into)
 *   V4 no other LIVE building may already hold `to`  -> "occupied" (D-34:
 *      rejected, not swapped)
 *
 * V5 (frontage) and V6 (savings cells unreachable) need no runtime check —
 * both are structural over the destination space (every plot index maps
 * through `cellFromIndex` to a cell with road frontage, and no plot index
 * ever aliases a savings cell). V7 (every building kind is movable, D-35) is
 * satisfied by this function taking no `categoryId`/`source` branch at all.
 */
export function moveBuilding(
  plotsOpened: number,
  buildings: readonly Building[],
  buildingId: string,
  toPlotIndex: number,
): MoveResult {
  const index = buildings.findIndex((b) => b.id === buildingId);
  if (index === -1) return { ok: false, reason: "not-found" };

  const building = buildings[index];
  if (toPlotIndex === building.plotIndex) return { ok: false, reason: "same-plot" };
  if (!Number.isInteger(toPlotIndex) || toPlotIndex < 0 || toPlotIndex >= openPlotCount(plotsOpened, buildings)) {
    return { ok: false, reason: "out-of-town" };
  }
  if (buildings.some((b) => b.plotIndex === toPlotIndex)) return { ok: false, reason: "occupied" };

  const next = buildings.slice() as Building[];
  next[index] = { ...building, plotIndex: toPlotIndex };
  return { ok: true, buildings: next, from: building.plotIndex, to: toPlotIndex };
}

export interface ReconcileResult {
  /** Same order and same object identities as the input, except repaired entries. Identical reference when repaired === 0. */
  buildings: Building[];
  /**
   * >= buildings.length, and `openPlotCount(plotsOpened, buildings) > every
   * plotIndex` (DE-2/G1 — see `poolSize`'s doc). NOT itself `> every
   * plotIndex`: a valid random placement can legitimately hold an index past
   * the raw counter (e.g. building #1 landing at plot 11 of its 12-lot
   * block) without that being a repair — only the rendered POOL, not this
   * counter, is guaranteed to be past it. Equals the input `plotsOpened`
   * whenever nothing needed widening, which is what makes a valid town's
   * boot a zero-write no-op (§3.6 point 2).
   */
  plotsOpened: number;
  repaired: number;
}

/**
 * Deterministic by (createdAt, id, array position), so two devices repairing
 * the same corrupt export land on the same town. Keyed by POSITION, never by
 * id, so duplicate ids cannot collapse two buildings into one.
 * O(n log n) for the sort + O(n) passes — microseconds even on the ~5,400
 * building dense fixture, inside the <1s first-paint budget (MVP-SPEC §10.4).
 */
export function reconcilePlacement(plotsOpened: number, buildings: readonly Building[]): ReconcileResult {
  const order = buildings.map((_, pos) => pos).sort((x, y) => {
    const a = buildings[x], b = buildings[y];
    return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : x - y);
  });

  const taken = new Set<number>();
  const losers: number[] = [];
  for (const pos of order) {
    const i = buildings[pos].plotIndex;
    if (Number.isInteger(i) && i >= 0 && !taken.has(i)) taken.add(i); // earliest claimant keeps the lot
    else losers.push(pos); // duplicate, NaN, negative, fractional
  }

  let repaired = 0;
  const fixed = buildings.slice() as Building[];
  let cursor = 0;
  for (const pos of losers) {
    while (taken.has(cursor)) cursor++;
    taken.add(cursor);
    fixed[pos] = { ...buildings[pos], plotIndex: cursor };
    repaired++;
  }

  // The DE-2 safety net (requiredLots) only widens `plotsOpened` when the
  // final occupancy actually needs it — an index beyond what the frontier
  // implies (F12 import, corrupt-recovery survivor). For a valid, freshly
  // random-placed town (repaired === 0, taken produced entirely by
  // pickPlot/allocatePlots) this is a no-op: `Math.max(plotsOpened,
  // buildings.length)` already equals the input `plotsOpened`, so the caller
  // sees no mismatch and issues no boot write (§3.6 point 2).
  const safeFrontier = Math.max(plotsOpened, buildings.length);
  return {
    buildings: repaired === 0 ? (buildings as Building[]) : fixed,
    plotsOpened: requiredLots(safeFrontier, taken),
    repaired,
  };
}
