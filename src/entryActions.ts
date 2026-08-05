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
import { savingsBucketOf } from "./savingsBuckets";
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
 * Adds `deltaKrw` (may be negative — F9's edit/delete back-out) to the
 * savings tower's denormalized totals for `categoryId`'s bucket. The ONE
 * place both a fresh 저축 save (below) and F9's edit/delete effects
 * (`historyActions.ts`) touch `cumulativeSavingsKrw`/`savingsByCategoryKrw` —
 * factored out so a 저축 back-out is never hand-rolled a second time (round-4
 * finding C3). Floored at 0 (a back-out can never make either total negative,
 * whether from a rounding-adjacent edit or a corrupt prior state).
 */
export function adjustSavings(town: TownState, categoryId: string, deltaKrw: number): TownState {
  const bucket = savingsBucketOf(categoryId);
  const buckets = town.savingsByCategoryKrw ?? {};
  return {
    ...town,
    cumulativeSavingsKrw: Math.max(0, town.cumulativeSavingsKrw + deltaKrw),
    savingsByCategoryKrw: { ...buckets, [bucket]: Math.max(0, (buckets[bucket] ?? 0) + deltaKrw) },
  };
}

export interface BuildOrQueueArgs {
  town: TownState;
  /** Buildings count BEFORE this act (post any F15 revocation the caller already applied) — used for the F5 tier check. */
  buildingCountBeforeThis: number;
  today: string;
  dailyBuildSlots: number;
  materialQueueMax: number;
  tierThresholds: readonly number[];
  entryId: string;
  categoryId: CategoryId;
  variantIndex: number;
  buildingId: string;
  plotIndex: number;
  createdAt: number;
  /** 'YYYY-MM' of the entry's `occurredOn` — carried on a queued material (F14) so a later drain patches the right chunk. */
  entryYm: string;
  /** F7: whether this act should advance the streak. True for a fresh F1 save; false for an F9 edit-driven type conversion (not a new logging act). */
  advancesStreak: boolean;
}

export interface BuildOrQueueResult {
  building: Building | null;
  queuedMaterial: QueuedMaterial | null;
  queueOverflow: boolean;
  town: TownState;
  celebrateTier: number | null;
}

/**
 * F2/F4's build-or-queue decision (F14) — the single place a save decides
 * "build now, queue for tomorrow, or overflow", reused by `applyNewEntry`
 * below AND by F9's edit-driven type conversion (`historyActions.ts`'s
 * `editEntryEffects`, saving -> expense/income) so that second call site
 * doesn't re-derive F2/F4/F5's rules by hand (round-4 finding C3).
 */
export function decideBuildOrQueue(args: BuildOrQueueArgs): BuildOrQueueResult {
  const {
    town,
    buildingCountBeforeThis,
    today,
    dailyBuildSlots,
    materialQueueMax,
    tierThresholds,
    entryId,
    categoryId,
    variantIndex,
    buildingId,
    plotIndex,
    createdAt,
    entryYm,
    advancesStreak,
  } = args;
  const remaining = slotsRemainingToday(town, today, dailyBuildSlots);

  if (remaining > 0) {
    const usedToday = dailyBuildSlots - remaining;
    const building: Building = {
      id: buildingId,
      source: { kind: "entry", entryId },
      categoryId,
      variantIndex,
      plotIndex,
      builtOn: today,
      createdAt,
    };
    const buildingCount = buildingCountBeforeThis + 1;
    const newTier = tier(buildingCount, tierThresholds);
    const celebrateTier = newTier > town.highestTierSeen ? newTier : null;
    const newTown: TownState = {
      ...town,
      ...(advancesStreak ? advanceStreak(town, today) : {}),
      nextPlotIndex: town.nextPlotIndex + 1,
      slotsUsedOn: today,
      slotsUsedToday: usedToday + 1,
      highestTierSeen: Math.max(town.highestTierSeen, newTier),
    };
    return { building, queuedMaterial: null, queueOverflow: false, town: newTown, celebrateTier };
  }

  if (town.queue.length < materialQueueMax) {
    const queuedMaterial: QueuedMaterial = { entryId, categoryId, variantIndex, queuedOn: today, entryYm };
    const newTown: TownState = {
      ...town,
      ...(advancesStreak ? advanceStreak(town, today) : {}),
      queue: [...town.queue, queuedMaterial],
    };
    return { building: null, queuedMaterial, queueOverflow: false, town: newTown, celebrateTier: null };
  }

  return { building: null, queuedMaterial: null, queueOverflow: true, town, celebrateTier: null };
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
    // 저축 never builds/queues/consumes a slot and is never a streak act (F13).
    // `draft.type === "saving"` narrows NOTHING about `draft.categoryId` —
    // EntryDraft's two fields are independent, not a discriminated union.
    // `savingsBucketOf` is total over string and RETURNS SavingCategoryId;
    // that return type is the narrowing, and it also absorbs legacy `invest`
    // (ADDENDUM-01 §4.5/§4.5a).
    const newTown = adjustSavings(town, draft.categoryId, draft.amountKrw);
    return {
      entry: { ...baseEntry, buildingId: null, queued: false },
      building: null,
      queuedMaterial: null,
      queueOverflow: false,
      town: newTown,
      revokedNoSpend,
      celebrateTier: null,
    };
  }

  // `buildings` is the PRE-revocation array — when this same save just
  // revoked a claimed 무지출 데이 above, its park tile is still in there but
  // is about to be removed by the caller. Subtract it before counting, or a
  // revoking save one building below a threshold falsely celebrates (and
  // permanently burns that threshold in highestTierSeen, since it only ever
  // increases — round-2 finding C2 #1).
  const revokedCount = revokedNoSpend?.buildingId ? 1 : 0;
  const decision = decideBuildOrQueue({
    town,
    buildingCountBeforeThis: buildings.length - revokedCount,
    today,
    dailyBuildSlots,
    materialQueueMax,
    tierThresholds,
    entryId,
    categoryId: draft.categoryId,
    variantIndex,
    buildingId,
    plotIndex,
    createdAt,
    entryYm: draft.occurredOn.slice(0, 7),
    advancesStreak: true, // F7: a fresh F1 save is a streak act when it builds OR queues; `decideBuildOrQueue`'s own overflow branch never advances it
  });

  if (decision.building) {
    return {
      entry: { ...baseEntry, buildingId, queued: false },
      building: decision.building,
      queuedMaterial: null,
      queueOverflow: false,
      town: decision.town,
      revokedNoSpend,
      celebrateTier: decision.celebrateTier,
    };
  }

  if (decision.queuedMaterial) {
    return {
      entry: { ...baseEntry, buildingId: null, queued: true },
      building: null,
      queuedMaterial: decision.queuedMaterial,
      queueOverflow: false,
      town: decision.town,
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
    town: decision.town,
    revokedNoSpend,
    celebrateTier: null,
  };
}
