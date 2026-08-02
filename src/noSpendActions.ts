/**
 * F15 무지출 데이 (no-spend day) claim — MVP-SPEC.md §5.
 *
 * Revocation (logging a 지출 on an already-claimed date) lives in
 * `entryActions.ts`'s `applyNewEntry` instead — it's triggered by a normal
 * ledger save, not this dedicated user action.
 *
 * Pure: no storage, no React, no `Date`. Reuses `canClaimNoSpend` (already in
 * `selectors.ts`) for eligibility so "claiming twice in one day is ...
 * rejected by the domain function" (spec AC) has exactly one source of
 * truth, shared with whatever hides the button in the UI.
 */
import { advanceStreak, canClaimNoSpend, slotsRemainingToday, tier } from "./selectors";
import type { Building, LedgerEntry, TownState } from "./types";

export interface ClaimNoSpendArgs {
  town: TownState;
  existingBuildingCount: number;
  /** Entries covering at least `today` — `canClaimNoSpend` only looks at entries dated `today`. */
  entries: readonly LedgerEntry[];
  today: string;
  dailyBuildSlots: number;
  noSpendDayCostsSlot: boolean;
  tierThresholds: readonly number[];
  buildingId: string;
  createdAt: number;
}

export interface ClaimNoSpendResult {
  building: Building;
  town: TownState;
  celebrateTier: number | null;
}

/** Returns null when the claim isn't allowed — rejected here, not just hidden behind a disabled button. */
export function claimNoSpendDay(args: ClaimNoSpendArgs): ClaimNoSpendResult | null {
  const { town, existingBuildingCount, entries, today, dailyBuildSlots, noSpendDayCostsSlot, tierThresholds, buildingId, createdAt } =
    args;

  if (!canClaimNoSpend(entries, town, today, dailyBuildSlots, noSpendDayCostsSlot)) return null;

  const building: Building = {
    id: buildingId,
    source: { kind: "nospend", date: today },
    categoryId: "park",
    variantIndex: 0, // spec §5 F15 / §8.1: "park variant 0"
    plotIndex: town.nextPlotIndex,
    builtOn: today,
    createdAt,
  };

  const buildingCount = existingBuildingCount + 1;
  const newTier = tier(buildingCount, tierThresholds);
  const celebrateTier = newTier > town.highestTierSeen ? newTier : null;

  const newTown: TownState = {
    ...town,
    ...advanceStreak(town, today), // a claimed no-spend day is a full streak act (F7)
    nextPlotIndex: town.nextPlotIndex + 1,
    noSpendDays: [...town.noSpendDays, today],
    highestTierSeen: Math.max(town.highestTierSeen, newTier),
    ...(noSpendDayCostsSlot
      ? { slotsUsedOn: today, slotsUsedToday: dailyBuildSlots - slotsRemainingToday(town, today, dailyBuildSlots) + 1 }
      : null),
  };

  return { building, town: newTown, celebrateTier };
}
