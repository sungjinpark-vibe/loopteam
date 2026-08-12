/**
 * F14 materials queue drain — MVP-SPEC.md §5.
 *
 * Runs on app open, AFTER F4's slot reset — `slotsRemainingToday` (selectors.ts)
 * already applies that reset purely from `today` vs. `town.slotsUsedOn`, so
 * calling it here with today's date IS "after the reset", with no separate
 * reset step needed. Drains FIFO up to that day's slot count, building each
 * exactly as F2/`entryActions.ts` would.
 *
 * Pure: no storage, no React, no `Date`. Locating/patching each drained
 * material's own `LedgerEntry` (a different month chunk than "today"'s
 * buildings chunk, in general) is the caller's job — `useTownStore.ts`
 * follows the same pure-function-then-storage-side-effects split that
 * `entryActions.ts`/`useTownStore.ts` already use for a normal save.
 */
import { expGainFor, slotsRemainingToday, tier } from "./selectors";
import type { Placed } from "./placement";
import type { Building, QueuedMaterial, TownState } from "./types";

export interface DrainQueueResult {
  town: TownState;
  /** One entry per drained material, in FIFO order — pairs the original queue slot with the building it became. */
  drained: Array<{ material: QueuedMaterial; building: Building }>;
  /** Set when draining crosses a new tier threshold upward (F5) — mirrors `applyNewEntry`'s `celebrateTier`. */
  celebrateTier: number | null;
}

export function drainQueue(
  town: TownState,
  existingBuildingCount: number,
  today: string,
  dailyBuildSlots: number,
  tierThresholds: readonly number[],
  /** Deterministic id generator, one call per drained material (i = 0, 1, 2, ...). */
  buildingIdFor: (i: number) => string,
  createdAt: number,
  /**
   * N footprint placements for this drain, called ONCE with the drain count —
   * computed by `placement.placeMany` (rule R-4, ADDENDUM-08 §3). Not an rng:
   * a drain places several buildings at once and they may not collide. May
   * return FEWER than requested if the town fills up mid-drain — the
   * un-placed materials simply stay queued (never dropped, never built as a
   * ghost on a cell that doesn't exist).
   */
  placeMany: (count: number) => Placed[],
  /**
   * ADDENDUM-04 §6/§7 — `BALANCE.expAmountTiers`, threaded through so a
   * drained material founds with the SAME amount-driven exp a same-day
   * founding save would get (`decideBuildOrQueue`'s parity rule). Optional,
   * defaults to `null` (flat gain 1 — today's exact behaviour and every
   * existing call site's default) so this stays additive.
   */
  expAmountTiers: readonly (readonly [number, number])[] | null = null,
): DrainQueueResult {
  const remaining = slotsRemainingToday(town, today, dailyBuildSlots);
  if (remaining <= 0 || town.queue.length === 0) {
    return { town, drained: [], celebrateTier: null };
  }

  const drainCount = Math.min(remaining, town.queue.length);
  const placements = placeMany(drainCount); // may be fewer than drainCount — town could be full
  const actualCount = placements.length;
  const toDrain = town.queue.slice(0, actualCount);
  const rest = town.queue.slice(actualCount); // undrained materials (town-full remainder, plus anything past drainCount) stay queued, FIFO order preserved

  // ADDENDUM-04 §6/§7 parity fix: a material queued without `amountKrw`
  // (pre-existing data, migration-safe) reads gain 1 via `expGainFor`'s own
  // `null`-tiers contract — exactly today's behaviour, never a crash.
  //
  // Gate-3-rerun fix: `exp` is the FULL `gain`, not `gain - 1` — same root
  // cause and same fix as `entryActions.ts`'s founding path (search that
  // file's `BuildOrQueueArgs` doc for the full story). A next-morning
  // drained building was under-leveled by the same one-rung offset as a
  // same-day founding one; both call sites needed the fix, not just the one
  // the panel's repro happened to exercise.
  const drained = toDrain.map((material, i) => {
    const gain = material.amountKrw !== undefined ? expGainFor(material.amountKrw, expAmountTiers) : 1;
    const building: Building = {
      id: buildingIdFor(i),
      source: { kind: "entry", entryId: material.entryId },
      categoryId: material.categoryId,
      variantIndex: material.variantIndex,
      plotIndex: placements[i].anchor,
      w: placements[i].w,
      h: placements[i].h,
      builtOn: today,
      createdAt,
      ...(gain > 1 ? { exp: gain } : {}),
    };
    return { material, building };
  });

  // Gate-3-rerun fix: this used to sum `1 + expOf(building)` per drained
  // item (a growth score) into a variable literally named `buildingCount` —
  // the exact mislabeled-number bug the panel caught elsewhere. A drain
  // places exactly `actualCount` new buildings; that's the count.
  const buildingCount = existingBuildingCount + actualCount;
  const newTier = tier(buildingCount, tierThresholds);
  const celebrateTier = newTier > town.highestTierSeen ? newTier : null;

  // Same "reset then consume" arithmetic entryActions.ts's applyNewEntry
  // uses: slotsRemainingToday already applies F4's reset, so
  // `dailyBuildSlots - remaining` is today's ALREADY-used count (0 when
  // slotsUsedOn was stale, but NOT necessarily 0 when the queue drains on a
  // same-day reopen after slots were partially spent — e.g. dailyBuildSlots
  // is raised mid-day, D-3). Add actualCount on top of that, never overwrite
  // it — overwriting would hand back slots already spent today.
  const usedBeforeDrain = dailyBuildSlots - remaining;
  const newTown: TownState = {
    ...town,
    slotsUsedOn: today,
    slotsUsedToday: usedBeforeDrain + actualCount,
    queue: rest,
    highestTierSeen: Math.max(town.highestTierSeen, newTier),
  };

  return { town: newTown, drained, celebrateTier };
}
