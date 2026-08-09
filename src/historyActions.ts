/**
 * F9 edit/delete application logic — MVP-SPEC.md §5 F9 / §6 S5.
 *
 * Pure: no storage, no React, no `Date` — same discipline as `entryActions.ts`
 * (`useTownStore.ts` does the storage side effects). Reuses `entryActions.ts`'s
 * `adjustSavings` (F13 back-out/forward) and `decideBuildOrQueue` (F2/F4/F14's
 * build-or-queue decision) rather than re-deriving either — round-4 finding
 * C3 flagged both as hand-rolled duplicates of logic this file's neighbour
 * already owns.
 *
 * `type` IS editable (round-4 finding C1) via three cases:
 *  - type unchanged: amount/memo/date/category edits, as before.
 *  - neither old nor new type is "saving" (지출 <-> 수입): both consume a slot
 *    identically (F2), so this is just a category/type re-skin on whatever
 *    building or queued material the entry already produced — no slot
 *    accounting changes at all.
 *  - 저축 -> 지출/수입: never had a building; decide build-or-queue fresh,
 *    exactly like a brand-new F1 save (`decideBuildOrQueue`), minus streak
 *    credit — an edit is not a new logging act.
 *  - 지출/수입 -> 저축: loses whatever building/queue slot it already
 *    produced (D-10's delete policy: not refunded) and starts contributing
 *    to the tower instead.
 */
import { adjustSavings, decideBuildOrQueue } from "./entryActions";
import { expGainFor, expOf, growthScore } from "./selectors";
import type { Building, CategoryId, EntryType, LedgerEntry, QueuedMaterial, TownState } from "./types";

/** Locates the building this entry produced, if any — the one place both delete and edit look this up (round-4 finding C3: was copy-pasted twice in `useTownStore.ts`). */
export function buildingForEntry(buildings: readonly Building[], entryId: string): Building | undefined {
  return buildings.find((b) => b.source.kind === "entry" && b.source.entryId === entryId);
}

/**
 * ADDENDUM-04 §6 — a "grow contribution" entry: `buildingId` names a host,
 * but that host's OWN founding entry is a DIFFERENT entry (`buildingForEntry`,
 * keyed off `source.entryId`, finds nothing for THIS entry's id). No extra
 * field marks this; it's inferred exactly as the spec names it. The
 * `buildingId !== null` guard matters — a queued/overflowed/저축 entry also
 * has no `buildingForEntry` match, but its `buildingId` is null, not a
 * dangling host reference.
 */
function isGrowContribution(buildings: readonly Building[], entry: Pick<LedgerEntry, "id" | "buildingId">): boolean {
  return entry.buildingId !== null && buildingForEntry(buildings, entry.id) === undefined;
}

/** Drops `entryId`'s pending material from the queue, if any — the F14 invariant "every queued material has a live entry" (round-4 finding C2), needed by both delete and an edit that moves the entry out of "still needs a building" state (saving -> already handled by never having queued; 저축 entries never queue). */
function dropFromQueue(town: TownState, entryId: string): TownState {
  if (!town.queue.some((m) => m.entryId === entryId)) return town;
  return { ...town, queue: town.queue.filter((m) => m.entryId !== entryId) };
}

export interface DeleteEntryArgs {
  town: TownState;
  buildings: readonly Building[];
  entry: LedgerEntry;
  /** ADDENDUM-04 §7 — the EXP-per-amount dial, passed in so this module stays balance-free like `tierThresholds` elsewhere; only consulted when `entry` is a grow contribution. */
  expAmountTiers: readonly (readonly [number, number])[] | null;
}

export interface DeleteEntryResult {
  town: TownState;
  buildings: Building[];
  /** The removed building's id/`builtOn` month, for the caller to also drop it from that month's storage chunk — `null` when the entry never built one. */
  removedBuilding: { id: string; ym: string } | null;
  /** ADDENDUM-04 §6 — set when `entry` was a grow contribution: the host with its EXP backed out (floored at 0, D-10: the slot is not refunded either way). The host is NOT removed; the caller persists this into ITS OWN `builtOn` month chunk (may differ from `entry`'s month). */
  grownBuilding: Building | null;
}

/**
 * F9 delete: removes the entry's building (if any — building count -1, its
 * plot becomes a permanent empty lot, the slot is NOT refunded per D-10) and,
 * for a still-queued entry (F14), drops its material from `town.queue` so a
 * later drain never builds a ghost for an entry that no longer exists
 * (round-4 finding C2 — the fix this task's escalation named as highest
 * value). A deleted 저축 entry backs its amount out of the tower.
 *
 * ADDENDUM-04 §6: deleting a GROW CONTRIBUTION (see `isGrowContribution`)
 * backs its EXP out of the host instead — the host is not removed, only its
 * `exp` decreases. Deleting the FOUNDING entry of a grown building still
 * removes the whole building, EXP included, same as any other building
 * (unchanged) — a dangling `buildingId` on the contributor entries is an
 * accepted ceiling, ADDENDUM-04 §6.
 */
export function deleteEntryEffects({ town, buildings, entry, expAmountTiers }: DeleteEntryArgs): DeleteEntryResult {
  let nextTown = town;
  let nextBuildings = buildings as Building[];
  let removedBuilding: DeleteEntryResult["removedBuilding"] = null;
  let grownBuilding: DeleteEntryResult["grownBuilding"] = null;

  const bound = buildingForEntry(buildings, entry.id);
  if (bound) {
    nextBuildings = buildings.filter((b) => b.id !== bound.id);
    removedBuilding = { id: bound.id, ym: bound.builtOn.slice(0, 7) };
  } else if (isGrowContribution(buildings, entry)) {
    const host = buildings.find((b) => b.id === entry.buildingId);
    // `host` can be missing when the founding entry was deleted first (§6's
    // accepted ceiling) — nothing left to back EXP out of.
    if (host) {
      const gain = expGainFor(entry.amountKrw, expAmountTiers);
      const updated: Building = { ...host, exp: Math.max(0, expOf(host) - gain) };
      grownBuilding = updated;
      nextBuildings = buildings.map((b) => (b.id === host.id ? updated : b));
    }
  }

  if (entry.queued) nextTown = dropFromQueue(nextTown, entry.id);
  if (entry.type === "saving") nextTown = adjustSavings(nextTown, entry.categoryId, -entry.amountKrw);

  return { town: nextTown, buildings: nextBuildings, removedBuilding, grownBuilding };
}

/** F9 edit fields — `type` included (round-4 finding C1: was display-only). */
export interface EntryEditPatch {
  type?: EntryType;
  amountKrw?: number;
  categoryId?: CategoryId;
  occurredOn?: string;
  memo?: string;
}

export interface EditEntryArgs {
  town: TownState;
  buildings: readonly Building[];
  entry: LedgerEntry;
  patch: EntryEditPatch;
  today: string;
  dailyBuildSlots: number;
  materialQueueMax: number;
  tierThresholds: readonly number[];
  /** Used ONLY when this edit newly places a building (저축 -> 지출/수입) — generated by the caller exactly like a fresh F1 save. */
  newBuildingId: string;
  variantIndex: number;
  plotIndex: number;
  now: number;
  /** ADDENDUM-04 §7 — same dial `deleteEntryEffects` takes; only consulted when `entry` is a grow contribution converting 지출/수입 -> 저축. */
  expAmountTiers: readonly (readonly [number, number])[] | null;
}

export interface EditEntryResult {
  entry: LedgerEntry;
  town: TownState;
  buildings: Building[];
  removedBuilding: { id: string; ym: string } | null;
  /** A building this edit newly placed (저축 -> 지출/수입 landing on an open slot) — the caller persists it into TODAY's month chunk, same as a fresh save. */
  newBuilding: Building | null;
  /** ADDENDUM-04 §6 — set when a grow-contribution entry converted 지출/수입 -> 저축: the host with its EXP backed out (floored at 0). The host is NOT removed; the caller persists this into ITS OWN `builtOn` month chunk. */
  grownBuilding: Building | null;
}

export function editEntryEffects(args: EditEntryArgs): EditEntryResult {
  const { entry: oldEntry, patch, today, dailyBuildSlots, materialQueueMax, tierThresholds, newBuildingId, variantIndex, plotIndex, now, expAmountTiers } =
    args;

  const newType = patch.type ?? oldEntry.type;
  const newCategoryId = patch.categoryId ?? oldEntry.categoryId;
  const newAmountKrw = patch.amountKrw ?? oldEntry.amountKrw;
  const newOccurredOn = patch.occurredOn ?? oldEntry.occurredOn;
  const newMemo = "memo" in patch ? patch.memo : oldEntry.memo;
  const newYm = newOccurredOn.slice(0, 7);
  const categoryChanged = patch.categoryId !== undefined && patch.categoryId !== oldEntry.categoryId;
  const dateChanged = patch.occurredOn !== undefined && patch.occurredOn !== oldEntry.occurredOn;

  let town = args.town;
  let buildings = args.buildings as Building[];
  let removedBuilding: EditEntryResult["removedBuilding"] = null;
  let newBuilding: Building | null = null;
  let grownBuilding: EditEntryResult["grownBuilding"] = null;
  let buildingId = oldEntry.buildingId;
  let queued = oldEntry.queued;

  const wasSaving = oldEntry.type === "saving";
  const willBeSaving = newType === "saving";
  const bound = buildingForEntry(buildings, oldEntry.id);

  if (newType === oldEntry.type) {
    const amountChanged = patch.amountKrw !== undefined && patch.amountKrw !== oldEntry.amountKrw;
    // Amount/memo/date edits never move the building (spec); a category
    // change re-skins it in place, keeping the same plot. ADDENDUM-04 §6/§7:
    // an amount change on a FOUNDING entry re-derives its building's founding
    // exp component (`gain - 1`, the same formula `decideBuildOrQueue` used
    // to create it), leaving any contributor exp already on it untouched. A
    // grow-CONTRIBUTION entry has no building of its own — its amount edit
    // backs the old gain out of the host and adds the new one instead (the
    // delete/저축-conversion cases below already do this; this was the one
    // case that silently did nothing before this dial existed). Either way a
    // no-op delta (dial off, or same tier) never writes an `exp` key that
    // wasn't already there.
    if (bound && (categoryChanged || amountChanged)) {
      let updated: Building = categoryChanged ? { ...bound, categoryId: newCategoryId } : bound;
      if (amountChanged) {
        const delta = expGainFor(newAmountKrw, expAmountTiers) - expGainFor(oldEntry.amountKrw, expAmountTiers);
        if (delta !== 0) updated = { ...updated, exp: Math.max(0, expOf(updated) + delta) };
      }
      buildings = buildings.map((b) => (b.id === bound.id ? updated : b));
    } else if (!bound && amountChanged && isGrowContribution(buildings, oldEntry)) {
      const host = buildings.find((b) => b.id === oldEntry.buildingId);
      if (host) {
        const delta = expGainFor(newAmountKrw, expAmountTiers) - expGainFor(oldEntry.amountKrw, expAmountTiers);
        if (delta !== 0) {
          const updated: Building = { ...host, exp: Math.max(0, expOf(host) + delta) };
          grownBuilding = updated;
          buildings = buildings.map((b) => (b.id === host.id ? updated : b));
        }
      }
    }
    // F14 (round-4 finding C2): a still-queued material follows the same
    // category/date edits its future building would have gotten.
    if (queued && (categoryChanged || dateChanged)) {
      town = {
        ...town,
        queue: town.queue.map((m): QueuedMaterial => (m.entryId === oldEntry.id ? { ...m, categoryId: newCategoryId, entryYm: newYm } : m)),
      };
    }
    if (wasSaving && (categoryChanged || amountChanged)) {
      town = adjustSavings(town, oldEntry.categoryId, -oldEntry.amountKrw);
      town = adjustSavings(town, newCategoryId, newAmountKrw);
    }
  } else if (!wasSaving && !willBeSaving) {
    // 지출 <-> 수입: identical slot mechanics (F2) — a type flip is just a
    // category/type re-skin of whatever this entry already produced.
    if (bound) {
      const updated: Building = { ...bound, categoryId: newCategoryId };
      buildings = buildings.map((b) => (b.id === bound.id ? updated : b));
    }
    if (queued) {
      town = {
        ...town,
        queue: town.queue.map((m): QueuedMaterial => (m.entryId === oldEntry.id ? { ...m, categoryId: newCategoryId, entryYm: newYm } : m)),
      };
    }
  } else if (wasSaving && !willBeSaving) {
    // 저축 -> 지출/수입: never built or queued — decide fresh (reuses F2/F4's
    // own decision function; no streak credit, this is an edit, not a new act).
    // ADDENDUM-04 §3/§7: this newly founds exactly like a fresh F1 save, so
    // it gets the same amount-driven founding exp via the shared
    // `decideBuildOrQueue` (root-cause fix, not a special case here).
    town = adjustSavings(town, oldEntry.categoryId, -oldEntry.amountKrw);
    const decision = decideBuildOrQueue({
      town,
      growthScoreBeforeThis: growthScore(buildings),
      today,
      dailyBuildSlots,
      materialQueueMax,
      tierThresholds,
      entryId: oldEntry.id,
      categoryId: newCategoryId,
      variantIndex,
      buildingId: newBuildingId,
      plotIndex,
      createdAt: now,
      entryYm: newYm,
      amountKrw: newAmountKrw,
      advancesStreak: false,
      expGain: expGainFor(newAmountKrw, expAmountTiers),
    });
    town = decision.town;
    if (decision.building) {
      newBuilding = decision.building;
      buildings = [...buildings, decision.building];
      buildingId = decision.building.id;
      queued = false;
    } else if (decision.queuedMaterial) {
      buildingId = null;
      queued = true;
    } else {
      buildingId = null;
      queued = false;
    }
  } else {
    // 지출/수입 -> 저축: loses its building/queued slot (D-10: not refunded), starts contributing to the tower.
    // ADDENDUM-04 §6: a grow-contribution entry has no building of its own —
    // back its EXP out of the host instead (host survives, not removed).
    if (bound) {
      buildings = buildings.filter((b) => b.id !== bound.id);
      removedBuilding = { id: bound.id, ym: bound.builtOn.slice(0, 7) };
    } else if (isGrowContribution(buildings, oldEntry)) {
      const host = buildings.find((b) => b.id === oldEntry.buildingId);
      if (host) {
        const gain = expGainFor(oldEntry.amountKrw, expAmountTiers);
        const updated: Building = { ...host, exp: Math.max(0, expOf(host) - gain) };
        grownBuilding = updated;
        buildings = buildings.map((b) => (b.id === host.id ? updated : b));
      }
    }
    if (queued) town = dropFromQueue(town, oldEntry.id);
    buildingId = null;
    queued = false;
    town = adjustSavings(town, newCategoryId, newAmountKrw);
  }

  const entry: LedgerEntry = {
    ...oldEntry,
    type: newType,
    amountKrw: newAmountKrw,
    categoryId: newCategoryId,
    occurredOn: newOccurredOn,
    memo: newMemo,
    updatedAt: now,
    buildingId,
    queued,
  };

  return { entry, town, buildings, removedBuilding, newBuilding, grownBuilding };
}
