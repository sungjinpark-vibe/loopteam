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
  /**
   * Where the park tile lands — computed by `placement.placeNew`, supplied by
   * the caller (rule R-4, ADDENDUM-08 §3). **Null when the town has no legal
   * anchor left**, which rejects the claim (see below) rather than founding an
   * invisible park tile on a fallback cell.
   */
  plotIndex: number | null;
  /** ADDENDUM-08 §2.1 — the park tile's rolled footprint, alongside `plotIndex`. */
  w: 1 | 2;
  h: 1 | 2;
}

export interface ClaimNoSpendResult {
  building: Building;
  town: TownState;
  celebrateTier: number | null;
}

/** Returns null when the claim isn't allowed — rejected here, not just hidden behind a disabled button. */
export function claimNoSpendDay(args: ClaimNoSpendArgs): ClaimNoSpendResult | null {
  const { town, existingBuildingCount, entries, today, dailyBuildSlots, noSpendDayCostsSlot, tierThresholds, buildingId, createdAt, plotIndex, w, h } =
    args;

  if (!canClaimNoSpend(entries, town, today, dailyBuildSlots, noSpendDayCostsSlot)) return null;
  // No room on the map: reject the claim outright rather than place a park
  // tile nowhere. A park tile has no queue path (only entries do), so
  // rejecting is the only option that does not corrupt the town — the day is
  // still recorded as 무지출 by the caller's own streak handling.
  if (plotIndex === null) return null;

  const building: Building = {
    id: buildingId,
    source: { kind: "nospend", date: today },
    categoryId: "park",
    variantIndex: 0, // spec §5 F15 / §8.1: "park variant 0"
    plotIndex,
    w,
    h,
    builtOn: today,
    createdAt,
  };

  const buildingCount = existingBuildingCount + 1;
  const newTier = tier(buildingCount, tierThresholds);
  const celebrateTier = newTier > town.highestTierSeen ? newTier : null;

  const newTown: TownState = {
    ...town,
    ...advanceStreak(town, today), // a claimed no-spend day is a full streak act (F7)
    noSpendDays: [...town.noSpendDays, today],
    highestTierSeen: Math.max(town.highestTierSeen, newTier),
    ...(noSpendDayCostsSlot
      ? { slotsUsedOn: today, slotsUsedToday: dailyBuildSlots - slotsRemainingToday(town, today, dailyBuildSlots) + 1 }
      : null),
  };

  return { building, town: newTown, celebrateTier };
}
