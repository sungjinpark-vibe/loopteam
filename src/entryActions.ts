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
import { advanceStreak, expOf, slotsRemainingToday, tier, townScale } from "./selectors";
import { savingsBucketOf } from "./savingsBuckets";
import type { Building, CategoryId, EntryType, LedgerEntry, PendingGrowChoice, QueuedMaterial, TownState } from "./types";

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
  /** Where the new building lands — computed by `placement.placeNew`, supplied by the caller (rule R-4, ADDENDUM-08 §3). Null when the town is full; see `DecideBuildOrQueueArgs.plotIndex`. */
  plotIndex: number | null;
  /** ADDENDUM-08 §2.1 — the footprint of the new building, rolled by `placement.rollFootprint`/`placeNew`, supplied alongside `plotIndex`. */
  w: 1 | 2;
  h: 1 | 2;
  /**
   * ADDENDUM-04 §4/§5 — grow an existing building instead of placing a new
   * one. The id of a LIVE, entry-founded building; a stale id (named no live
   * building) or no free slot both fall back to the normal build/queue path
   * below rather than losing the entry — see `decideBuildOrQueue`.
   */
  growTargetId?: string;
  /**
   * ADDENDUM-04 §3/§7 — EXP this act's amount is worth, already computed by
   * the caller via `expGainFor(draft.amountKrw, BALANCE.expAmountTiers)`
   * (selectors.ts) — this module stays balance-free like every other dial
   * here. Feeds whichever branch `decideBuildOrQueue` actually takes: added
   * to the grow target's exp when `growTargetId` resolves, or set as the
   * founding exp of the new Building otherwise (Gate-3-rerun fix — used to
   * store `expGain - 1` for growth-score parity with the tier check; now
   * that tier reads the literal building count instead (see
   * `buildingCountBeforeThis` below), that offset only served to hide the
   * amount from `levelOf`, which is exactly the "same level regardless of
   * amount" defect every expert on the panel flagged as the #1 finding).
   * Missing/undefined defaults to 1 (flat), same as the dial-off shape.
   */
  expGain?: number;
  /** ADDENDUM-04 §4 — see `BuildOrQueueArgs.deferGrowChoice`. Mutually exclusive with `growTargetId`. */
  deferGrowChoice?: boolean;
}

export interface ApplyNewEntryResult {
  entry: LedgerEntry;
  /** Built now (F2) — null when queued, overflowed, grown, or a 저축 entry. */
  building: Building | null;
  /** ADDENDUM-04 §5 — the host this save grew, EXP already added — null unless this save actually grew. */
  grownBuilding: Building | null;
  /** Pushed to the queue (F14) — null unless this save queued a material. */
  queuedMaterial: QueuedMaterial | null;
  /** True when the queue was already at `materialQueueMax` — entry saved with no material at all. */
  queueOverflow: boolean;
  town: TownState;
  /** Set when this save revokes an already-claimed 무지출 데이 (F15) — `buildingId` is the park tile to remove from storage, or null if it somehow wasn't found. */
  revokedNoSpend: { date: string; buildingId: string | null } | null;
  /** Set when this save crosses a new tier threshold upward (F5) — the tier index to celebrate. */
  celebrateTier: number | null;
  /** ADDENDUM-04 §4 — set when the entry is saved but its 새로짓기/키우기 choice is still open; already parked on `town`. */
  pendingGrowChoice: PendingGrowChoice | null;
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
  /**
   * Literal building count BEFORE this act (post any F15 revocation the
   * caller already applied) — used for the F5 tier check.
   *
   * Gate-3-rerun fix (every expert's confirmed defect): ADDENDUM-04 §3 used
   * to feed `tier()` `growthScore(buildings)` (count + Σexp) instead, so the
   * number that gated a tier-up could run ahead of `TownHeader`'s literal
   * "건물 N채" — the panel's exact repro (tier fired at growthScore 10 while
   * the header read 6 buildings, and the celebration banner's own "N채 더"
   * math, computed from the literal count, didn't reconcile with either).
   * Reverted to the literal count so the SAME number drives both the header
   * display and the tier gate everywhere — no accessor can drift from the
   * other because there is only one. The money->reward mechanic this was
   * layering onto tier stays intact where it actually lives: `levelOf`
   * (per-building Lv./size) still reads `exp` directly, untouched.
   *
   * ADDENDUM-11 §5.1.3 keeps that invariant and only changes WHAT is counted:
   * every caller now passes `townScale(buildings)` (Σ 2**fuse), which is the
   * same single number `TownStore.buildingCount` hands the header — one
   * accessor still, never a second parallel number. Equal to the literal count
   * for any town with nothing fused.
   */
  buildingCountBeforeThis: number;
  today: string;
  dailyBuildSlots: number;
  materialQueueMax: number;
  tierThresholds: readonly number[];
  entryId: string;
  categoryId: CategoryId;
  variantIndex: number;
  buildingId: string;
  /**
   * Where the new building goes, or **null when the town has no legal anchor
   * left** — `placeNew` refused. Null forces the queue branch below instead of
   * founding a building: the entry is kept and built on a later drain, exactly
   * like a used-up daily slot. Growing an existing building is unaffected (it
   * needs no plot), so a full town can still grow.
   */
  plotIndex: number | null;
  /** ADDENDUM-08 §2.1 — the footprint of the new building; ignored when this decision grows an existing one instead. */
  w: 1 | 2;
  h: 1 | 2;
  createdAt: number;
  /** 'YYYY-MM' of the entry's `occurredOn` — carried on a queued material (F14) so a later drain patches the right chunk. */
  entryYm: string;
  /** ADDENDUM-04 §6 — carried onto a queued material so a later drain can re-run `expGainFor` at the amount that was actually logged, closing the F14 parity gap (queueActions.ts). */
  amountKrw: number;
  /** F7: whether this act should advance the streak. True for a fresh F1 save; false for an F9 edit-driven type conversion (not a new logging act). */
  advancesStreak: boolean;
  /**
   * ADDENDUM-04 §4/§5 — resolved LIVE host to grow instead of placing a new
   * building; undefined falls back to the normal build decision below (a
   * stale `growTargetId` must never lose the entry, per `applyNewEntry`).
   * Only consulted when a slot is free — the queue path (`remaining <= 0`)
   * never grows, it queues exactly as today.
   */
  growTarget?: Building;
  /**
   * ADDENDUM-04 §3/§7 — EXP this act's amount is worth (see `ApplyNewEntryArgs.expGain`
   * for the full contract). Used to grow `growTarget` when present, or to
   * set the founding exp of a freshly-created Building otherwise. Missing
   * defaults to 1 (flat).
   */
  expGain?: number;
  /**
   * ADDENDUM-04 §4 — take the build slot and the streak now, but park the
   * "새 건물 / 키우기" choice on `town.pendingGrowChoice` instead of deciding
   * the building effect here (see `PendingGrowChoice`'s doc for why the
   * effect, and only the effect, is the deferred part). Ignored on the queue
   * and overflow branches: those never offered a choice in the first place, so
   * a full town / a used-up day still behaves exactly as before.
   * Never combined with `growTarget` — the choice IS what picks one.
   */
  deferGrowChoice?: boolean;
}

export interface BuildOrQueueResult {
  building: Building | null;
  /** ADDENDUM-04 §5 — the host `growTarget` grew into, EXP already added — null unless this decision actually grew. */
  grownBuilding: Building | null;
  queuedMaterial: QueuedMaterial | null;
  queueOverflow: boolean;
  town: TownState;
  celebrateTier: number | null;
  /** ADDENDUM-04 §4 — set when this decision took the slot but parked the building effect; the marker is already on `town`. Null on every other branch. */
  pendingGrowChoice: PendingGrowChoice | null;
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
    w,
    h,
    createdAt,
    entryYm,
    amountKrw,
    advancesStreak,
    growTarget,
    expGain,
    deferGrowChoice,
  } = args;
  const remaining = slotsRemainingToday(town, today, dailyBuildSlots);

  // A free slot is not enough — the town must also have somewhere to put the
  // building. `plotIndex === null` means `placeNew` found no legal anchor, so
  // this falls through to the queue rather than founding a building on a
  // fallback cell. Before the RX1-N2 spacing rule the caller passed `?? 0` and
  // a full town founded an INVISIBLE building on cell 0 (a void cell the grid
  // never renders) that also collided with the next one; the map held ~136
  // buildings so it was written off as unreachable. It holds ~81 now, which a
  // 10-slot day reaches in about a week, so the pre-existing follow-up
  // ("teach decideBuildOrQueue to force-queue when placement fails") is done here.
  if (remaining > 0 && (plotIndex !== null || growTarget)) {
    const usedToday = dailyBuildSlots - remaining;
    const gain = expGain ?? 1;

    // ADDENDUM-04 §4 — the choice is pending: everything the two branches
    // agree on (the slot, the streak) lands NOW, alongside the caller's entry
    // write, and only the building effect waits. No tier check here — both
    // branches score differently (count vs. count + 1), so it is computed once
    // in `resolveGrowChoice` when the branch is actually known, which also
    // means `highestTierSeen` (write-once-upward) is never burned on a
    // celebration the resolved choice wouldn't have earned.
    if (deferGrowChoice) {
      const pendingGrowChoice: PendingGrowChoice = { entryId, entryYm, categoryId, expGain: gain };
      const newTown: TownState = {
        ...town,
        ...(advancesStreak ? advanceStreak(town, today) : {}),
        slotsUsedOn: today,
        slotsUsedToday: usedToday + 1,
        pendingGrowChoice,
      };
      return {
        building: null,
        grownBuilding: null,
        queuedMaterial: null,
        queueOverflow: false,
        town: newTown,
        celebrateTier: null,
        pendingGrowChoice,
      };
    }

    // ADDENDUM-04 §5: growing consumes a slot and advances the streak
    // exactly like building, but creates no Building and opens no lot.
    if (growTarget) {
      const grownBuilding: Building = { ...growTarget, exp: expOf(growTarget) + gain };
      // Growing an existing building places no new one, so the literal count
      // (and therefore the tier gate) never moves from this branch alone.
      const newTier = tier(buildingCountBeforeThis, tierThresholds);
      const celebrateTier = newTier > town.highestTierSeen ? newTier : null;
      const newTown: TownState = {
        ...town,
        ...(advancesStreak ? advanceStreak(town, today) : {}),
        slotsUsedOn: today,
        slotsUsedToday: usedToday + 1,
        highestTierSeen: Math.max(town.highestTierSeen, newTier),
      };
      return { building: null, grownBuilding, queuedMaterial: null, queueOverflow: false, town: newTown, celebrateTier, pendingGrowChoice: null };
    }

    // Gate-3-rerun fix: founding exp is the FULL amount-derived gain, not
    // `gain - 1`. The `-1` used to exist so a new building's growth-score
    // contribution (1 from `.length` + founding exp) matched a same-amount
    // grow — but growth-score no longer drives anything (tier reads the
    // literal count, see `buildingCountBeforeThis`), so that offset was
    // pure cost with no remaining benefit: it made `levelOf` (which reads
    // `exp` directly) under-report every founding building by a full level,
    // which is the exact "1,500원 and 150,000원 both show Lv.1" bug the
    // panel reproduced. `exp` is still omitted (not written as 0) when
    // `gain === 1` (dial off, or the smallest amount band) so the smallest
    // entries stay byte-identical to before this dial existed.
    const building: Building = {
      id: buildingId,
      source: { kind: "entry", entryId },
      categoryId,
      variantIndex,
      plotIndex: plotIndex as number, // non-null: the guard above sends a null plot to the queue
      w,
      h,
      builtOn: today,
      createdAt,
      ...(gain > 1 ? { exp: gain } : {}),
    };
    const newTier = tier(buildingCountBeforeThis + 1, tierThresholds);
    const celebrateTier = newTier > town.highestTierSeen ? newTier : null;
    const newTown: TownState = {
      ...town,
      ...(advancesStreak ? advanceStreak(town, today) : {}),
      slotsUsedOn: today,
      slotsUsedToday: usedToday + 1,
      highestTierSeen: Math.max(town.highestTierSeen, newTier),
    };
    return { building, grownBuilding: null, queuedMaterial: null, queueOverflow: false, town: newTown, celebrateTier, pendingGrowChoice: null };
  }

  // ADDENDUM-04 §4/§5: no free slot means no grow either — queues exactly as today.
  if (town.queue.length < materialQueueMax) {
    const queuedMaterial: QueuedMaterial = { entryId, categoryId, variantIndex, amountKrw, queuedOn: today, entryYm };
    const newTown: TownState = {
      ...town,
      ...(advancesStreak ? advanceStreak(town, today) : {}),
      queue: [...town.queue, queuedMaterial],
    };
    return { building: null, grownBuilding: null, queuedMaterial, queueOverflow: false, town: newTown, celebrateTier: null, pendingGrowChoice: null };
  }

  return { building: null, grownBuilding: null, queuedMaterial: null, queueOverflow: true, town, celebrateTier: null, pendingGrowChoice: null };
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
    w,
    h,
    growTargetId,
    expGain,
    deferGrowChoice,
  } = args;

  // F15: logging a 지출 for an already-claimed date un-claims it. Refund the
  // slot only when the revoked date is today (spec AC) — a past date's slot
  // was never spendable "now" and there is nothing to hand back.
  let town = args.town;
  let revokedNoSpend: ApplyNewEntryResult["revokedNoSpend"] = null;
  // The revoked park tile's own contribution to the literal building count
  // — 1 when a park tile actually existed to revoke, else 0 — subtracted
  // below so a same-save revocation is scored as if that tile never counted.
  let revokedContribution = 0;
  if (draft.type === "expense" && town.noSpendDays.includes(draft.occurredOn)) {
    const revokedBuilding = buildings.find((b) => b.source.kind === "nospend" && b.source.date === draft.occurredOn);
    const refund = noSpendDayCostsSlot && draft.occurredOn === today && town.slotsUsedOn === today;
    town = {
      ...town,
      noSpendDays: town.noSpendDays.filter((d) => d !== draft.occurredOn),
      // A claim made while the town was full has no park tile yet — it is
      // still sitting in F14's queue (noSpendActions.ts). Revoking has to
      // drop that too, or tomorrow's drain builds a park for a day that is no
      // longer 무지출. Entry materials never carry `noSpendDate`, so this
      // touches nothing else.
      queue: town.queue.filter((m) => m.noSpendDate !== draft.occurredOn),
      slotsUsedToday: refund ? Math.max(0, town.slotsUsedToday - 1) : town.slotsUsedToday,
    };
    revokedNoSpend = { date: draft.occurredOn, buildingId: revokedBuilding?.id ?? null };
    revokedContribution = revokedBuilding ? 1 : 0;
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
      grownBuilding: null,
      queuedMaterial: null,
      queueOverflow: false,
      town: newTown,
      revokedNoSpend,
      celebrateTier: null,
      pendingGrowChoice: null,
    };
  }

  // ADDENDUM-04 §4/§5: resolve a LIVE, entry-founded host for growTargetId.
  // `buildings` still includes a same-save-revoked park tile (never
  // `source.kind === "entry"`, so it can never match here) — no bogus grow
  // target. A stale/bogus id (a race between the dialog and a delete) leaves
  // `growTarget` undefined, and `decideBuildOrQueue` below falls back to the
  // normal build/queue path rather than losing the entry.
  const growTarget = growTargetId ? buildings.find((b) => b.id === growTargetId && b.source.kind === "entry") : undefined;

  // `buildings` is the PRE-revocation array — when this same save just
  // revoked a claimed 무지출 데이 above, its park tile is still in there but
  // is about to be removed by the caller. Subtract its contribution before
  // scoring, or a revoking save one below a threshold falsely celebrates (and
  // permanently burns that threshold in highestTierSeen, since it only ever
  // increases — round-2 finding C2 #1).
  const decision = decideBuildOrQueue({
    town,
    // ADDENDUM-11 §5.1.3 — `townScale`, not `.length`: a fused building counts
    // as the buildings it absorbed. Identical to `.length` for any town with
    // nothing fused, so tier pacing is unchanged for every existing save.
    buildingCountBeforeThis: townScale(buildings) - revokedContribution,
    today,
    dailyBuildSlots,
    materialQueueMax,
    tierThresholds,
    entryId,
    categoryId: draft.categoryId,
    variantIndex,
    buildingId,
    plotIndex,
    w,
    h,
    createdAt,
    entryYm: draft.occurredOn.slice(0, 7),
    amountKrw: draft.amountKrw,
    advancesStreak: true, // F7: a fresh F1 save is a streak act when it builds, grows, OR queues; `decideBuildOrQueue`'s own overflow branch never advances it
    growTarget,
    expGain,
    deferGrowChoice,
  });

  // ADDENDUM-04 §4 — saved, slot spent, choice open. `buildingId: null` here
  // is the same "no building behind this row (yet)" the queue branch below
  // already writes; `resolveGrowChoice` patches it to the real id. `queued`
  // stays FALSE — this entry is not on F14's queue and must never be drained
  // by `drainQueue`.
  if (decision.pendingGrowChoice) {
    return {
      entry: { ...baseEntry, buildingId: null, queued: false },
      building: null,
      grownBuilding: null,
      queuedMaterial: null,
      queueOverflow: false,
      town: decision.town,
      revokedNoSpend,
      celebrateTier: null,
      pendingGrowChoice: decision.pendingGrowChoice,
    };
  }

  if (decision.grownBuilding) {
    return {
      entry: { ...baseEntry, buildingId: decision.grownBuilding.id, queued: false },
      building: null,
      grownBuilding: decision.grownBuilding,
      queuedMaterial: null,
      queueOverflow: false,
      town: decision.town,
      revokedNoSpend,
      celebrateTier: decision.celebrateTier,
      pendingGrowChoice: null,
    };
  }

  if (decision.building) {
    return {
      entry: { ...baseEntry, buildingId, queued: false },
      building: decision.building,
      grownBuilding: null,
      queuedMaterial: null,
      queueOverflow: false,
      town: decision.town,
      revokedNoSpend,
      celebrateTier: decision.celebrateTier,
      pendingGrowChoice: null,
    };
  }

  if (decision.queuedMaterial) {
    return {
      entry: { ...baseEntry, buildingId: null, queued: true },
      building: null,
      grownBuilding: null,
      queuedMaterial: decision.queuedMaterial,
      queueOverflow: false,
      town: decision.town,
      revokedNoSpend,
      celebrateTier: null,
      pendingGrowChoice: null,
    };
  }

  // Overflow past materialQueueMax — recorded in 기록 with no material at all, not a streak act.
  return {
    entry: { ...baseEntry, buildingId: null, queued: false },
    building: null,
    grownBuilding: null,
    queuedMaterial: null,
    queueOverflow: true,
    town: decision.town,
    revokedNoSpend,
    celebrateTier: null,
    pendingGrowChoice: null,
  };
}

export interface ResolveGrowChoiceArgs {
  /** Carries the `pendingGrowChoice` marker; returns null when there is none. */
  town: TownState;
  buildings: readonly Building[];
  /** The already-persisted ledger row named by the marker — returns null when it can't be found (nothing to patch, nothing to build for). */
  entry: LedgerEntry | undefined;
  /** The player's answer: a LIVE, entry-founded building's id to 키우기, or undefined for 새로 짓기. A stale id falls back to 새로 짓기 rather than dropping the choice. */
  growTargetId?: string;
  buildingId: string;
  /** Rolled by the caller at resolve time, exactly like `plotIndex` — the deferred branch has no building to skin until now. */
  variantIndex: number;
  createdAt: number;
  today: string;
  tierThresholds: readonly number[];
  materialQueueMax: number;
  /** `placeNew`'s answer AT RESOLVE TIME, not at 저장 time — the town may have filled up in between (a boot drain, a 무지출 park). Null sends the deferred build to F14's queue instead of losing it. */
  plotIndex: number | null;
  w: 1 | 2;
  h: 1 | 2;
}

export interface ResolveGrowChoiceResult {
  /** The same ledger row, `buildingId`/`queued` patched to match the branch actually taken. */
  entry: LedgerEntry;
  building: Building | null;
  grownBuilding: Building | null;
  queuedMaterial: QueuedMaterial | null;
  queueOverflow: boolean;
  /** `pendingGrowChoice` cleared, `highestTierSeen` raised if this branch earned it. */
  town: TownState;
  celebrateTier: number | null;
}

/**
 * ADDENDUM-04 §4 — the other half of a deferred save: apply the building
 * effect the 새로짓기/키우기 dialog was asking about, and clear the marker.
 *
 * Deliberately does NOT touch the slot counter, the streak, or the savings
 * totals: `decideBuildOrQueue`'s defer branch already committed all of those
 * at 저장 time, and they are identical in both branches, so re-applying them
 * here would double-charge the day. The tier check IS here, because it is the
 * one thing the two branches score differently (count vs. count + 1) and
 * `highestTierSeen` only ever increases.
 *
 * Returns null when there is nothing to resolve (no marker, or its entry is
 * gone) — the caller leaves storage untouched, exactly like `applyFusion`'s
 * own illegal-pair null.
 */
export function resolveGrowChoice(args: ResolveGrowChoiceArgs): ResolveGrowChoiceResult | null {
  const { town, buildings, entry, growTargetId, buildingId, variantIndex, createdAt, today, tierThresholds, materialQueueMax, plotIndex, w, h } = args;
  const pending = town.pendingGrowChoice;
  if (pending === undefined || entry === undefined) return null;

  // `pendingGrowChoice` gone, everything else on the town untouched — this is
  // the ONE field this function is allowed to clear, on every branch below.
  const settled: TownState = { ...town };
  delete settled.pendingGrowChoice;

  // Same live/entry-founded resolution `applyNewEntry` does for `growTargetId`
  // — a building deleted between the save and the answer falls through to
  // 새로 짓기 instead of losing the effect.
  const growTarget = growTargetId ? buildings.find((b) => b.id === growTargetId && b.source.kind === "entry") : undefined;

  if (growTarget) {
    const grownBuilding: Building = { ...growTarget, exp: expOf(growTarget) + pending.expGain };
    const newTier = tier(townScale(buildings), tierThresholds);
    return {
      entry: { ...entry, buildingId: grownBuilding.id, queued: false },
      building: null,
      grownBuilding,
      queuedMaterial: null,
      queueOverflow: false,
      town: { ...settled, highestTierSeen: Math.max(settled.highestTierSeen, newTier) },
      celebrateTier: newTier > town.highestTierSeen ? newTier : null,
    };
  }

  if (plotIndex !== null) {
    const building: Building = {
      id: buildingId,
      source: { kind: "entry", entryId: pending.entryId },
      categoryId: pending.categoryId,
      variantIndex,
      plotIndex,
      w,
      h,
      builtOn: today,
      createdAt,
      ...(pending.expGain > 1 ? { exp: pending.expGain } : {}),
    };
    const newTier = tier(townScale(buildings) + 1, tierThresholds);
    return {
      entry: { ...entry, buildingId, queued: false },
      building,
      grownBuilding: null,
      queuedMaterial: null,
      queueOverflow: false,
      town: { ...settled, highestTierSeen: Math.max(settled.highestTierSeen, newTier) },
      celebrateTier: newTier > town.highestTierSeen ? newTier : null,
    };
  }

  // The town filled up between 저장 and the answer (a boot drain, a 무지출
  // park). The slot is already spent and cannot be handed back, but the
  // building can still be owed — same F14 deferral an over-cap save takes.
  if (settled.queue.length < materialQueueMax) {
    const queuedMaterial: QueuedMaterial = {
      entryId: pending.entryId,
      categoryId: pending.categoryId,
      variantIndex,
      amountKrw: entry.amountKrw,
      queuedOn: today,
      entryYm: pending.entryYm,
    };
    return {
      entry: { ...entry, buildingId: null, queued: true },
      building: null,
      grownBuilding: null,
      queuedMaterial,
      queueOverflow: false,
      town: { ...settled, queue: [...settled.queue, queuedMaterial] },
      celebrateTier: null,
    };
  }

  // Queue full too — the entry keeps everything it already earned, it just
  // never gets a building. Never a silent no-op: the marker is still cleared.
  return {
    entry: { ...entry, buildingId: null, queued: false },
    building: null,
    grownBuilding: null,
    queuedMaterial: null,
    queueOverflow: true,
    town: settled,
    celebrateTier: null,
  };
}
