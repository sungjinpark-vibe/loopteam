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
import { slotsRemainingToday, tier } from "./selectors";
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
  /** N distinct plot indices for this drain, called ONCE with the drain count — computed by `placement.allocatePlots` (rule R-4, ADDENDUM-02 §3.5). Not an rng: a drain places several buildings at once and they may not collide. */
  allocatePlotIndices: (count: number) => number[],
): DrainQueueResult {
  const remaining = slotsRemainingToday(town, today, dailyBuildSlots);
  if (remaining <= 0 || town.queue.length === 0) {
    return { town, drained: [], celebrateTier: null };
  }

  const drainCount = Math.min(remaining, town.queue.length);
  const toDrain = town.queue.slice(0, drainCount);
  const rest = town.queue.slice(drainCount);

  const plotIndices = allocatePlotIndices(drainCount);
  const drained = toDrain.map((material, i) => {
    const building: Building = {
      id: buildingIdFor(i),
      source: { kind: "entry", entryId: material.entryId },
      categoryId: material.categoryId,
      variantIndex: material.variantIndex,
      plotIndex: plotIndices[i],
      builtOn: today,
      createdAt,
    };
    return { material, building };
  });

  const buildingCount = existingBuildingCount + drained.length;
  const newTier = tier(buildingCount, tierThresholds);
  const celebrateTier = newTier > town.highestTierSeen ? newTier : null;

  // Same "reset then consume" arithmetic entryActions.ts's applyNewEntry
  // uses: slotsRemainingToday already applies F4's reset, so
  // `dailyBuildSlots - remaining` is today's ALREADY-used count (0 when
  // slotsUsedOn was stale, but NOT necessarily 0 when the queue drains on a
  // same-day reopen after slots were partially spent — e.g. dailyBuildSlots
  // is raised mid-day, D-3). Add drainCount on top of that, never overwrite
  // it — overwriting would hand back slots already spent today.
  const usedBeforeDrain = dailyBuildSlots - remaining;
  const newTown: TownState = {
    ...town,
    nextPlotIndex: town.nextPlotIndex + drainCount,
    slotsUsedOn: today,
    slotsUsedToday: usedBeforeDrain + drainCount,
    queue: rest,
    highestTierSeen: Math.max(town.highestTierSeen, newTier),
  };

  return { town: newTown, drained, celebrateTier };
}
