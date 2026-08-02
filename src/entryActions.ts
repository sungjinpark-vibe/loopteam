/**
 * F1 + F2 application logic — MVP-SPEC.md §5.
 *
 * Pure: no storage, no React, no `Date`. Reuses `slotsRemainingToday` from
 * `selectors.ts` (T002) rather than re-deriving the slot-reset rule, and
 * stores `plotIndex = town.nextPlotIndex` on the new `Building` exactly as
 * `devtools/fixtures.ts` does — `plotFromIndex` (also selectors.ts) is only
 * ever called at render time to turn that index into a grid position, per
 * the `Building.plotIndex` contract in `types.ts`.
 */
import { slotsRemainingToday } from "./selectors";
import type { Building, CategoryId, EntryType, LedgerEntry, TownState } from "./types";

export interface EntryDraft {
  type: EntryType;
  amountKrw: number;
  categoryId: CategoryId;
  occurredOn: string; // 'YYYY-MM-DD', device-local, never future (validated by the caller/UI)
  memo?: string;
}

export interface ApplyNewEntryArgs {
  town: TownState;
  draft: EntryDraft;
  entryId: string;
  buildingId: string;
  /** clock.now() at save time — used for both `createdAt`/`updatedAt` and the building's `builtOn`/`createdAt`. */
  createdAt: number;
  /** clock.today() — the building always rises "today" (spec F2/F4), independent of a backdated `draft.occurredOn`. */
  today: string;
  dailyBuildSlots: number;
  variantIndex: number;
}

export interface ApplyNewEntryResult {
  entry: LedgerEntry;
  /** null when no slot remained — F14 (materials queue) is out of scope for this task; the entry is still ledger-only, matching F14's own overflow fallback. */
  building: Building | null;
  town: TownState;
}

/**
 * Saving a 지출/수입 entry: if a build slot remains today, place exactly one
 * `Building` and consume the slot; otherwise the entry is saved as ledger
 * data only. 저축 entries never build and never consume a slot (F13, out of
 * this task's UI scope but handled here defensively) — spec §5 F13.
 */
export function applyNewEntry(args: ApplyNewEntryArgs): ApplyNewEntryResult {
  const { town, draft, entryId, buildingId, createdAt, today, dailyBuildSlots, variantIndex } = args;

  const remaining = draft.type === "saving" ? 0 : slotsRemainingToday(town, today, dailyBuildSlots);

  if (remaining <= 0) {
    const entry: LedgerEntry = {
      id: entryId,
      type: draft.type,
      amountKrw: draft.amountKrw,
      categoryId: draft.categoryId,
      occurredOn: draft.occurredOn,
      memo: draft.memo,
      createdAt,
      updatedAt: createdAt,
      buildingId: null,
      queued: false,
    };
    return { entry, building: null, town };
  }

  // `slotsRemainingToday` already applies the "reset when stale" rule
  // (selectors.ts); back it out to get today's *used* count without
  // duplicating that logic here.
  const usedToday = dailyBuildSlots - remaining;

  const building: Building = {
    id: buildingId,
    source: { kind: "entry", entryId },
    categoryId: draft.categoryId,
    variantIndex,
    plotIndex: town.nextPlotIndex,
    builtOn: today,
    createdAt,
  };

  const entry: LedgerEntry = {
    id: entryId,
    type: draft.type,
    amountKrw: draft.amountKrw,
    categoryId: draft.categoryId,
    occurredOn: draft.occurredOn,
    memo: draft.memo,
    createdAt,
    updatedAt: createdAt,
    buildingId,
    queued: false,
  };

  const newTown: TownState = {
    ...town,
    nextPlotIndex: town.nextPlotIndex + 1,
    slotsUsedOn: today,
    slotsUsedToday: usedToday + 1,
  };

  return { entry, building, town: newTown };
}
