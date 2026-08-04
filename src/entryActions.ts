/**
 * F1 + F2 + F5 + F7 + F14 + F15 application logic — MVP-SPEC.md §5.
 *
 * Pure: no storage, no React, no `Date`. Reuses `slotsRemainingToday` (F4),
 * `advanceStreak` (F7), and `tier` (F5) from `selectors.ts` rather than
 * re-deriving those rules here — this file only decides *when* a save
 * triggers each of them and assembles the resulting `TownState`.
 *
 * F15 revocation lives here too, not in `noSpendActions.ts`: it fires on a
 * normal 지출 save (logging an expense on an already-claimed date), not on a
 * dedicated user action, so it has to run as part of this same save.
 */
import { advanceStreak, slotsRemainingToday, tier } from "./selectors";
import type { Building, CategoryId, EntryType, LedgerEntry, QueuedMaterial, TownState } from "./types";

export interface EntryDraft {
  type: EntryType;
  amountKrw: number;
  categoryId: CategoryId;
  occurredOn: string; // 'YYYY-MM-DD', device-local, never future (validated by the caller/UI)
  memo?: string;
}

export interface ApplyNewEntryArgs {
  town: TownState;
  /** Every building currently known — needed to locate a revoked no-spend claim's building (F15) and to recompute `buildingCount` for the tier check (F5). */
  buildings: readonly Building[];
  draft: EntryDraft;
  entryId: string;
  buildingId: string;
  /** clock.now() at save time — used for both `createdAt`/`updatedAt` and the building's `builtOn`/`createdAt`. */
  createdAt: number;
  /** clock.today() — the building always rises "today" (spec F2/F4), independent of a backdated `draft.occurredOn`. */
  today: string;
  dailyBuildSlots: number;
  materialQueueMax: number;
  tierThresholds: readonly number[];
  noSpendDayCostsSlot: boolean;
  variantIndex: number;
  /** Where the new building lands — computed by `placement.pickPlot`, supplied by the caller (rule R-4, ADDENDUM-02 §3.5). */
  plotIndex: number;
}

export interface ApplyNewEntryResult {
  entry: LedgerEntry;
  /** Built now (F2) — null when queued, overflowed, or a 저축 entry. */
  building: Building | null;
  /** Pushed to the queue (F14) — null unless this save queued a material. */
  queuedMaterial: QueuedMaterial | null;
  /** True when the queue was already at `materialQueueMax` — entry saved with no material at all. */
  queueOverflow: boolean;
  town: TownState;
  /** Set when this save revokes an already-claimed 무지출 데이 (F15) — `buildingId` is the park tile to remove from storage, or null if it somehow wasn't found. */
  revokedNoSpend: { date: string; buildingId: string | null } | null;
  /** Set when this save crosses a new tier threshold upward (F5) — the tier index to celebrate. */
  celebrateTier: number | null;
}

/**
 * Saving a ledger entry applies, in order: F15 revocation (a same-day revoke
 * can free the very slot this entry needs, so it must run first), then F13's
 * "저축 never builds" short-circuit, then F2/F4's build-or-queue decision
 * (F14), then F7's streak and F5's tier check on whichever branch actually
 * placed a building or a queued promise.
 */
export function applyNewEntry(args: ApplyNewEntryArgs): ApplyNewEntryResult {
  const {
    buildings,
    draft,
    entryId,
    buildingId,
    createdAt,
    today,
    dailyBuildSlots,
    materialQueueMax,
    tierThresholds,
    noSpendDayCostsSlot,
    variantIndex,
    plotIndex,
  } = args;

  // F15: logging a 지출 for an already-claimed date un-claims it. Refund the
  // slot only when the revoked date is today (spec AC) — a past date's slot
  // was never spendable "now" and there is nothing to hand back.
  let town = args.town;
  let revokedNoSpend: ApplyNewEntryResult["revokedNoSpend"] = null;
  if (draft.type === "expense" && town.noSpendDays.includes(draft.occurredOn)) {
    const revokedBuilding = buildings.find((b) => b.source.kind === "nospend" && b.source.date === draft.occurredOn);
    const refund = noSpendDayCostsSlot && draft.occurredOn === today && town.slotsUsedOn === today;
    town = {
      ...town,
      noSpendDays: town.noSpendDays.filter((d) => d !== draft.occurredOn),
      slotsUsedToday: refund ? Math.max(0, town.slotsUsedToday - 1) : town.slotsUsedToday,
    };
    revokedNoSpend = { date: draft.occurredOn, buildingId: revokedBuilding?.id ?? null };
  }

  const baseEntry = {
    id: entryId,
    type: draft.type,
    amountKrw: draft.amountKrw,
    categoryId: draft.categoryId,
    occurredOn: draft.occurredOn,
    memo: draft.memo,
    createdAt,
    updatedAt: createdAt,
  };

  if (draft.type === "saving") {
    // 저축 never builds/queues/consumes a slot and is never a streak act (F13, out of this task's scope).
    return {
      entry: { ...baseEntry, buildingId: null, queued: false },
      building: null,
      queuedMaterial: null,
      queueOverflow: false,
      town,
      revokedNoSpend,
      celebrateTier: null,
    };
  }

  const remaining = slotsRemainingToday(town, today, dailyBuildSlots);

  if (remaining > 0) {
    const usedToday = dailyBuildSlots - remaining;
    const building: Building = {
      id: buildingId,
      source: { kind: "entry", entryId },
      categoryId: draft.categoryId,
      variantIndex,
      plotIndex,
      builtOn: today,
      createdAt,
    };
    // `buildings` is the PRE-revocation array — when this same save just
    // revoked a claimed 무지출 데이 above, its park tile is still in there
    // but is about to be removed by the caller. Subtract it before counting,
    // or a revoking save one building below a threshold falsely celebrates
    // (and permanently burns that threshold in highestTierSeen, since it
    // only ever increases — round-2 finding C2 #1).
    const revokedCount = revokedNoSpend?.buildingId ? 1 : 0;
    const buildingCount = buildings.length - revokedCount + 1;
    const newTier = tier(buildingCount, tierThresholds);
    const celebrateTier = newTier > town.highestTierSeen ? newTier : null;
    const newTown: TownState = {
      ...town,
      ...advanceStreak(town, today),
      nextPlotIndex: town.nextPlotIndex + 1,
      slotsUsedOn: today,
      slotsUsedToday: usedToday + 1,
      highestTierSeen: Math.max(town.highestTierSeen, newTier),
    };
    return {
      entry: { ...baseEntry, buildingId, queued: false },
      building,
      queuedMaterial: null,
      queueOverflow: false,
      town: newTown,
      revokedNoSpend,
      celebrateTier,
    };
  }

  // No slot remains today — F14: queue the material, or overflow if the queue is already full.
  if (town.queue.length < materialQueueMax) {
    const queuedMaterial: QueuedMaterial = {
      entryId,
      categoryId: draft.categoryId,
      variantIndex,
      queuedOn: today,
      entryYm: draft.occurredOn.slice(0, 7),
    };
    const newTown: TownState = {
      ...town,
      // A queued material is still a build-producing act for F7 — the
      // reward is owed, not denied; only true overflow (below) isn't.
      ...advanceStreak(town, today),
      queue: [...town.queue, queuedMaterial],
    };
    return {
      entry: { ...baseEntry, buildingId: null, queued: true },
      building: null,
      queuedMaterial,
      queueOverflow: false,
      town: newTown,
      revokedNoSpend,
      celebrateTier: null,
    };
  }

  // Overflow past materialQueueMax — recorded in 기록 with no material at all, not a streak act.
  return {
    entry: { ...baseEntry, buildingId: null, queued: false },
    building: null,
    queuedMaterial: null,
    queueOverflow: true,
    town,
    revokedNoSpend,
    celebrateTier: null,
  };
}
