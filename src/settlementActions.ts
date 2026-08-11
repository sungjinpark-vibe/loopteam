/**
 * F16 monthly settlement + 기념비 (monument) — MVP-SPEC.md §7 F16 / §8.1.
 *
 * Pure: no storage, no React, no `Date`. Follows `queueActions.ts`'s
 * `drainQueue` shape — plot indices and building ids are injected by the
 * caller (rule R-4: only `placement.ts`'s allocators decide plot indices,
 * never drawn here) — and reuses `unsettledPeriods`/`budgetPace`/`moodTier`
 * (selectors.ts) rather than inventing parallel bucket logic.
 *
 * outcomeBucket convention (documented once, here): 0 = "no data" (this
 * month has zero ledger entries, OR `budgetKrw === null`); otherwise
 * `1 + moodTier(pace, moodPaceThresholds)` — moodTier's own buckets (0 =
 * best/under pace, increasing = worse) shifted up by one so index 0 stays
 * reserved for "no data" and never collides with a real pace outcome.
 */
import { budgetPace, moodTier, unsettledPeriods } from "./selectors";
import type { Placed } from "./placement";
import type { Building, LedgerEntry, MonthSummary, TownState } from "./types";

function monthSummaryFor(
  period: string,
  entries: readonly LedgerEntry[],
  budgetKrw: number | null,
  today: string,
  moodPaceThresholds: readonly number[],
): MonthSummary {
  let expenseKrw = 0;
  let incomeKrw = 0;
  let savingKrw = 0;
  const daysSeen = new Set<string>();
  for (const e of entries) {
    if (e.type === "expense") expenseKrw += e.amountKrw;
    else if (e.type === "income") incomeKrw += e.amountKrw;
    else savingKrw += e.amountKrw;
    daysSeen.add(e.occurredOn);
  }
  // "no data" short-circuits before touching budgetPace at all — zero
  // entries would otherwise read as a misleadingly perfect (0) pace.
  const outcomeBucket =
    entries.length === 0 || budgetKrw === null
      ? 0
      : 1 + moodTier(budgetPace(entries, period, budgetKrw, today), moodPaceThresholds);
  return { period, expenseKrw, incomeKrw, savingKrw, budgetKrw, outcomeBucket, daysLogged: daysSeen.size };
}

/**
 * F16 acceptance criterion ("3 monuments in chronological plot order") vs
 * ADDENDUM-02 R-5 (plots are drawn randomly by `placement.placeMany`)
 * conflict — director decision 2026-08-09: implement, ship OFF. Shipped
 * build keeps today's random placement, byte-identical.
 */
export const MONUMENT_CHRONOLOGICAL_PLOTS = false;

export interface SettleMonthsArgs {
  town: TownState;
  today: string;
  /** Reads one month's entries — loading the right chunk(s) (storage.ts) is the caller's job. */
  entriesForPeriod: (period: string) => readonly LedgerEntry[];
  /** Current budget setting, applied (and then frozen) for every month settled in this run. */
  budgetKrw: number | null;
  moodPaceThresholds: readonly number[];
  /** Deterministic id generator, one call per minted monument (i = 0, 1, 2, ...). */
  buildingIdFor: (i: number) => string;
  createdAt: number;
  /**
   * N footprint placements for this settlement run, called ONCE with the
   * monument count (rule R-4). Each entry MUST be exactly what was reserved
   * for that monument — build it from `placement.placeMonument` (tries 2x2,
   * downgrades only when the town has no 2x2 room left), never from generic
   * `placeMany` with a forced-2x2 override: this module trusts `w`/`h` here
   * verbatim and stores them unchanged, so a placement that claims fewer
   * cells than the stored footprint would leave the difference unclaimed for
   * the next building to sit inside. May return fewer than requested if the
   * town is full; the unplaced months stay unsettled and are retried on the
   * next call (see `settleMonths`).
   */
  placeMany: (count: number) => Placed[];
  /** Test-only override for `MONUMENT_CHRONOLOGICAL_PLOTS`; defaults to it. */
  chronologicalPlots?: boolean;
}

export interface SettleMonthsResult {
  town: TownState;
  /** One monument per settled month, oldest first — same order as `plotIndices` was allocated in. Empty when nothing was unsettled. */
  monuments: Building[];
}

/**
 * Settles every unsettled month (oldest first — `unsettledPeriods`),
 * consuming no build slot and not advancing the F7 streak. Idempotent:
 * `lastSettledPeriod` advances inside the returned `town`, so a re-run with
 * the same `today` finds nothing unsettled and mints nothing further.
 */
export function settleMonths(args: SettleMonthsArgs): SettleMonthsResult {
  const {
    town, today, entriesForPeriod, budgetKrw, moodPaceThresholds, buildingIdFor, createdAt, placeMany,
    chronologicalPlots = MONUMENT_CHRONOLOGICAL_PLOTS,
  } = args;

  const periods = unsettledPeriods(town.lastSettledPeriod, today);
  if (periods.length === 0) return { town, monuments: [] };

  const drawnPlacements = placeMany(periods.length);
  // Fewer placements than months means the town is full — settle only the
  // months that actually got a lot; the rest stay unsettled and retry next call.
  const settledPeriods = periods.slice(0, drawnPlacements.length);
  if (settledPeriods.length === 0) return { town, monuments: [] };

  // ON: re-sort the same drawn set ascending (by anchor) so periods (already
  // oldest-first) land in ascending plot order — chronological order visible
  // on the grid.
  const placements = chronologicalPlots ? [...drawnPlacements].sort((a, b) => a.anchor - b.anchor) : drawnPlacements;
  const monuments = settledPeriods.map((period, i) => {
    const monumentSummary = monthSummaryFor(period, entriesForPeriod(period), budgetKrw, today, moodPaceThresholds);
    const building: Building = {
      id: buildingIdFor(i),
      source: { kind: "monument", period },
      categoryId: null,
      variantIndex: monumentSummary.outcomeBucket,
      plotIndex: placements[i].anchor,
      // ADDENDUM-08 §2.2: stored EXACTLY what was reserved (`placeMonument`
      // tries 2x2, downgrades only when the town is full) — never overridden
      // here. A stored footprint bigger than the reservation would leave
      // cells unclaimed for the next building to overlap into.
      w: placements[i].w,
      h: placements[i].h,
      builtOn: today,
      createdAt,
      monumentSummary,
    };
    return building;
  });

  const newTown: TownState = {
    ...town,
    lastSettledPeriod: settledPeriods[settledPeriods.length - 1],
  };

  return { town: newTown, monuments };
}
