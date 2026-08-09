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
  /** N distinct plot indices for this settlement run, called ONCE with the monument count — `placement.allocatePlots` (rule R-4). */
  allocatePlotIndices: (count: number) => number[];
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
  const { town, today, entriesForPeriod, budgetKrw, moodPaceThresholds, buildingIdFor, createdAt, allocatePlotIndices } = args;

  const periods = unsettledPeriods(town.lastSettledPeriod, today);
  if (periods.length === 0) return { town, monuments: [] };

  const plotIndices = allocatePlotIndices(periods.length);
  const monuments = periods.map((period, i) => {
    const monumentSummary = monthSummaryFor(period, entriesForPeriod(period), budgetKrw, today, moodPaceThresholds);
    const building: Building = {
      id: buildingIdFor(i),
      source: { kind: "monument", period },
      categoryId: null,
      variantIndex: monumentSummary.outcomeBucket,
      plotIndex: plotIndices[i],
      builtOn: today,
      createdAt,
      monumentSummary,
    };
    return building;
  });

  const newTown: TownState = {
    ...town,
    nextPlotIndex: town.nextPlotIndex + periods.length,
    lastSettledPeriod: periods[periods.length - 1],
  };

  return { town: newTown, monuments };
}
