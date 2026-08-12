/**
 * ADDENDUM-11 — building fusion (Lv.6 -> Lv.10). Pure domain, same shape as
 * its siblings (`entryActions.ts` / `historyActions.ts` / `queueActions.ts`):
 * values in, values out. No React, no storage, no clock, no random. The store
 * (`useTownStore.ts`) owns every write; this file only decides WHAT the town
 * should look like afterwards.
 *
 * Two rules carry the whole feature:
 *  - §2.2 F1-F6: two DISTINCT live, entry-founded buildings, same category,
 *    same footprint, both at `maxLevel`, same fuse tier, neither capped.
 *  - §3: the INITIATING building survives untouched except for `fuse` + 1 —
 *    same id, plotIndex, footprint, createdAt, exp. The other is deleted. The
 *    survivor never moves and never grows into the freed cells (they can be
 *    anywhere on the map), so `placement.ts` needs no new function: removing
 *    the consumed building from the array frees its cells automatically
 *    (`occupiedCells` rebuilds its Set per call, placement.ts:33-40).
 */
import { footprintOf } from "./placement";
import { fuseOf, levelOf } from "./selectors";
import type { EconomyState } from "./economy/types";
import type { Building, LedgerEntry } from "./types";

/** §2.3 — the ladder tops out at Lv.5 + 5 = Lv.10. Derived nowhere else. */
export const MAX_FUSE_TIER = 5;

/**
 * §2.2 — every condition, in one predicate. `maxLevel` is passed in and never
 * duplicated as a literal (F1's basis), and `levelOf` (not `totalLevelOf`) is
 * the EXP-level check: a fused building's EXP level stays at the cap, so F1
 * and F5 together are what stop a Lv.6 fusing with a Lv.5.
 */
export function canFuse(
  a: Building,
  b: Building,
  expPerLevel: number,
  maxLevel: number,
): boolean {
  if (a.id === b.id) return false; // F6 — two DISTINCT buildings
  if (a.source.kind !== "entry" || b.source.kind !== "entry") return false; // F4 — never a monument or a 무지출 park tile (§5.2)
  if (a.categoryId === null || a.categoryId !== b.categoryId) return false; // F2
  if (levelOf(a, expPerLevel, maxLevel) < maxLevel || levelOf(b, expPerLevel, maxLevel) < maxLevel) return false; // F1
  if (fuseOf(a) !== fuseOf(b)) return false; // F5 — a Lv.6 fuses only with a Lv.6
  if (fuseOf(a) >= MAX_FUSE_TIER) return false; // F6 — already Lv.10
  const fa = footprintOf(a);
  const fb = footprintOf(b);
  return fa.w === fb.w && fa.h === fb.h; // F3
}

/**
 * §6 step 2 — the partners the UI may highlight for `initiatorId`. Empty when
 * the initiator itself fails F1/F4 or has no partner at all, which is what
 * lets the detail sheet render the 융합하기 CTA only when it can actually do
 * something (never a disabled button that cannot explain itself).
 *
 * Sorted by `createdAt` ascending for a deterministic pick order, matching
 * `growCandidates` (selectors.ts:120-125).
 */
export function fusePartners(
  buildings: readonly Building[],
  initiatorId: string,
  expPerLevel: number,
  maxLevel: number,
): Building[] {
  const initiator = buildings.find((b) => b.id === initiatorId);
  if (!initiator) return [];
  return buildings
    .filter((b) => canFuse(initiator, b, expPerLevel, maxLevel))
    .sort((x, y) => x.createdAt - y.createdAt);
}

export interface FusionResult {
  /** The survivor, `fuse` incremented, `fusePending` NOT set — the settled shape (§3.1 write 3). */
  survivor: Building;
  /** The building this fusion consumes — needed for its own month chunk and its dangling refs. */
  consumed: Building;
  /** The town after the fusion: survivor replaced in place, consumed removed. Array order is otherwise preserved. */
  buildings: Building[];
}

/**
 * §3 — the fusion itself. Returns `null` (town untouched) when the pair fails
 * any of F1-F6, so a stale UI can never commit an illegal fusion: the check
 * lives here, at the one place that mutates, not only at the CTA that offered
 * it.
 */
export function applyFusion(
  buildings: readonly Building[],
  survivorId: string,
  consumedId: string,
  expPerLevel: number,
  maxLevel: number,
): FusionResult | null {
  const survivor = buildings.find((b) => b.id === survivorId);
  const consumed = buildings.find((b) => b.id === consumedId);
  if (!survivor || !consumed || !canFuse(survivor, consumed, expPerLevel, maxLevel)) return null;

  const fused: Building = { ...survivor, fuse: (fuseOf(survivor) + 1) as NonNullable<Building["fuse"]> };
  return {
    survivor: fused,
    consumed,
    buildings: buildings.filter((b) => b.id !== consumedId).map((b) => (b.id === survivorId ? fused : b)),
  };
}

export interface FusionChunkWrite {
  /** 'YYYY-MM' buildings chunk this write targets. */
  ym: string;
  mutate: (existing: Building[]) => Building[];
}

/**
 * §3.1 — the ordered chunk writes one fusion performs, as data.
 *
 * Buildings live in per-month chunks and the only writer is a plain
 * load-modify-save on ONE chunk with no transaction, so a fusion whose two
 * buildings were built in different months is two independent writes and an
 * interruption between them would otherwise leave a half-fusion. Neither
 * partial state self-heals on its own: stopping after the survivor write is a
 * free level (duplication), stopping after the delete is a SILENTLY LOST
 * building.
 *
 * The ordering below makes the sequence self-healing with no transaction
 * support: write 1 sets `fusePending` in the SAME write that grants the level,
 * so any interruption from that moment on is visible at the next boot and
 * `repairPendingFusions` finishes the job forward. Write 3 clears the field.
 *
 * A same-month fusion needs none of that — it is a single chunk write, atomic
 * by construction, and never sets `fusePending` at all.
 *
 * Returned as data rather than executed here so this file stays pure AND so
 * the atomicity test can execute any PREFIX of the sequence (simulating an
 * interruption after each write in turn) through the very same descriptors the
 * store runs, instead of re-implementing the order in the test.
 */
export function fusionChunkWrites(survivor: Building, consumed: Building): FusionChunkWrite[] {
  const survivorYm = survivor.builtOn.slice(0, 7);
  const consumedYm = consumed.builtOn.slice(0, 7);
  const put = (b: Building) => (existing: Building[]) => existing.map((x) => (x.id === b.id ? b : x));
  const dropConsumed = (existing: Building[]) => existing.filter((x) => x.id !== consumed.id);

  if (survivorYm === consumedYm) {
    return [{ ym: survivorYm, mutate: (existing) => put(survivor)(dropConsumed(existing)) }];
  }
  return [
    { ym: survivorYm, mutate: put({ ...survivor, fusePending: consumed.id }) },
    { ym: consumedYm, mutate: dropConsumed },
    { ym: survivorYm, mutate: put(survivor) },
  ];
}

/**
 * §5.4 — every reference to the consumed building is REMAPPED to the survivor,
 * never nulled: `buildingId: null` already means "queued, over-cap, or a 저축
 * entry" (types.ts:64), so nulling a founded entry would make a real
 * building's founding entry indistinguishable from one that never built.
 * Remapping is also the honest model — the consumed building was absorbed, and
 * its EXP is standing in the fused tower.
 *
 * Returns the SAME array reference when nothing pointed at `fromId`, so the
 * caller can skip a chunk write with `===` (the discipline `applyAward`
 * already sets, economy/awards.ts:61).
 */
export function remapEntryBuildingRefs(
  entries: readonly LedgerEntry[],
  fromId: string,
  toId: string,
): LedgerEntry[] {
  if (!entries.some((e) => e.buildingId === fromId)) return entries as LedgerEntry[];
  return entries.map((e) => (e.buildingId === fromId ? { ...e, buildingId: toId } : e));
}

/**
 * §5.4 — a cosmetic SKU bound to the consumed building transfers to the
 * survivor when the survivor has none; otherwise only the BINDING is dropped.
 * Ownership lives in `ownedSkus` and is never touched here, so a fusion can
 * never revoke a purchase (the precedent useTownStore.ts:1161 already sets)
 * and the sku can simply be re-applied.
 *
 * Same-reference-when-unchanged contract as `remapEntryBuildingRefs`.
 */
export function transferBuildingSku(economy: EconomyState, fromId: string, toId: string): EconomyState {
  const sku = economy.appliedByBuildingId[fromId];
  if (sku === undefined) return economy;
  const appliedByBuildingId = { ...economy.appliedByBuildingId };
  delete appliedByBuildingId[fromId];
  if (appliedByBuildingId[toId] === undefined) appliedByBuildingId[toId] = sku;
  return { ...economy, appliedByBuildingId };
}

export interface PendingFusionRepair {
  survivorId: string;
  /** 'YYYY-MM' chunk holding the survivor — the one that carries the stale `fusePending`. */
  survivorYm: string;
  consumedId: string;
  /** 'YYYY-MM' chunk the consumed building is still sitting in, or `null` when it was already deleted (crash after write 2). */
  consumedYm: string | null;
}

/**
 * §3.1 boot repair — folded into the boot's existing reconcile pass so it
 * costs no new pass over the buildings.
 *
 * A `fusePending` field can only exist between a cross-month fusion's write 1
 * and write 3, so finding one means the app died mid-fusion. The repair is the
 * same in both interruption windows: delete that id if it is still standing,
 * then clear the field. Idempotent, and re-entrant if boot itself is
 * interrupted — which is what makes the sequence self-healing without any
 * transaction support in storage.
 *
 * Crucially the survivor's `fuse` is NEVER rolled back: write 1 already
 * persisted it, so completing forward is the only direction that cannot lose a
 * building. `buildings` is returned by reference when there was nothing to
 * repair (the ordinary boot), so an untouched town writes nothing.
 */
export function repairPendingFusions(buildings: readonly Building[]): {
  buildings: Building[];
  repairs: PendingFusionRepair[];
} {
  const repairs: PendingFusionRepair[] = [];
  for (const b of buildings) {
    if (b.fusePending === undefined) continue;
    const consumed = buildings.find((c) => c.id === b.fusePending);
    repairs.push({
      survivorId: b.id,
      survivorYm: b.builtOn.slice(0, 7),
      consumedId: b.fusePending,
      consumedYm: consumed ? consumed.builtOn.slice(0, 7) : null,
    });
  }
  if (repairs.length === 0) return { buildings: buildings as Building[], repairs };

  const consumedIds = new Set(repairs.map((r) => r.consumedId));
  const repaired = buildings
    .filter((b) => !consumedIds.has(b.id))
    .map((b) => {
      if (b.fusePending === undefined) return b;
      const settled = { ...b };
      delete settled.fusePending; // deleted, not set to undefined — the field must not survive JSON round-tripping
      return settled;
    });
  return { buildings: repaired, repairs };
}
