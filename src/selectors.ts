/**
 * Pure derived-state functions — MVP-SPEC.md §8.2.
 *
 * Nothing here touches storage, the DOM, or `Date`/`Date.now()` (that ban is
 * enforced outside `src/platform/clock.ts` by an eslint `no-restricted-syntax`
 * rule, §10.2) — every selector takes `today`/`ym` as an explicit string
 * argument supplied by the caller from the clock port. That is what makes
 * every selector unit-testable with no React and fully time-travelable.
 */
import type { Building, CategoryId, EntryType, LedgerEntry, TownState } from "./types";

// ── Layout constant (not a balance dial, spec §9 / §13 trade-off 9) ──

/** Town grid width. Kept out of balance.placeholder.ts: layout, not pacing. */
export const TOWN_COLUMNS = 6;

/** Serpentine row-major fill: the town reads as one street winding downward. */
export function plotFromIndex(i: number): { col: number; row: number } {
  const row = Math.floor(i / TOWN_COLUMNS);
  const k = i % TOWN_COLUMNS;
  return { row, col: row % 2 === 0 ? k : TOWN_COLUMNS - 1 - k };
}

// ── Small date helpers (device-local 'YYYY-MM-DD' strings only, §8.3) ──

function ymOf(dateStr: string): string {
  return dateStr.slice(0, 7); // 'YYYY-MM-DD' -> 'YYYY-MM'
}

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// Pure calendar math — `new Date()` is banned outside src/platform/clock.ts (§10.2).
function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return m === 2 && isLeapYear(y) ? 29 : DAYS_PER_MONTH[m - 1];
}

function dayOfMonth(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

// ── Recovery (§8.3): the only two fields ever rebuilt from entries ──

/**
 * Reconstructs `cumulativeSavingsKrw` and `lastSettledPeriod` — spec §8.3's
 * "only denormalized fields" — from `entries` alone. Run by import (F12,
 * later task) and by the corrupt-index recovery path in `src/storage.ts` so
 * a bad chunk can never permanently lose these two numbers.
 *
 * `lastSettledPeriod` is approximated as the latest `YYYY-MM` touched by any
 * entry — the best information recoverable from entries alone (per spec's
 * own wording); it does not know about zero-entry settled months (F16), so a
 * recovery may re-run settlement for those and mint an extra monument. That
 * is a correctness gap only reachable via storage corruption, not normal use.
 */
export function rebuildDerived(
  entries: readonly LedgerEntry[],
): Pick<TownState, "cumulativeSavingsKrw" | "lastSettledPeriod"> {
  let cumulativeSavingsKrw = 0;
  let lastSettledPeriod: string | null = null;
  for (const e of entries) {
    if (e.type === "saving") cumulativeSavingsKrw += e.amountKrw;
    const period = ymOf(e.occurredOn);
    if (lastSettledPeriod === null || period > lastSettledPeriod) lastSettledPeriod = period;
  }
  return { cumulativeSavingsKrw, lastSettledPeriod };
}

// ── Town / building selectors ──

export function buildingCount(buildings: readonly Building[]): number {
  return buildings.length;
}

/** Largest i where buildingCount >= tierThresholds[i]; 0 if below every threshold. */
export function tier(count: number, tierThresholds: readonly number[]): number {
  let result = 0;
  for (let i = 0; i < tierThresholds.length; i++) {
    if (count >= tierThresholds[i]) result = i;
  }
  return result;
}

export function slotsRemainingToday(
  town: Pick<TownState, "slotsUsedOn" | "slotsUsedToday">,
  today: string,
  dailyBuildSlots: number,
): number {
  // Reset only when the stored date is strictly earlier than today (spec §5
  // F4 AC) — travelling the clock backward must not hand out a fresh cap, so
  // `slotsUsedOn > today` (backward travel) keeps the stored count as-is,
  // same as `slotsUsedOn === today`.
  const used = town.slotsUsedOn < today ? 0 : town.slotsUsedToday;
  return Math.max(0, dailyBuildSlots - used);
}

// ── Ledger selectors ──

export function monthTotal(entries: readonly LedgerEntry[], ym: string, type: EntryType): number {
  let sum = 0;
  for (const e of entries) {
    if (e.type === type && ymOf(e.occurredOn) === ym) sum += e.amountKrw;
  }
  return sum;
}

/**
 * `monthExpenseTotal / (budget * elapsedFraction)`. `elapsedFraction` is
 * derived from how `ym` relates to `today`'s period (spec §5 F8: the pace
 * bar must make sense on any of the 36 months reachable by ‹ › nav, not just
 * the current one) — a month strictly before today's is fully elapsed
 * (clamped to 1.0), a month strictly after has nothing elapsed yet (`null`,
 * nothing to compare against), and the current month prorates by day.
 * Returns `null` when there is no budget or the elapsed window hasn't
 * started (guards `expectedSpend > 0`).
 */
export function budgetPace(
  entries: readonly LedgerEntry[],
  ym: string,
  budgetKrw: number | null,
  today: string,
): number | null {
  if (budgetKrw === null) return null;
  const currentPeriod = ymOf(today);
  let elapsedFraction: number;
  if (ym < currentPeriod) {
    elapsedFraction = 1.0; // past month: fully elapsed
  } else if (ym > currentPeriod) {
    return null; // future month: nothing elapsed yet
  } else {
    elapsedFraction = dayOfMonth(today) / daysInMonth(ym);
  }
  const expectedSpend = budgetKrw * elapsedFraction;
  if (expectedSpend <= 0) return null;
  return monthTotal(entries, ym, "expense") / expectedSpend;
}

/**
 * Buckets `pace` by `moodPaceThresholds` into `thresholds.length + 1` tiers
 * (0 = best/under pace, increasing = worse). `-1` means neutral: no budget
 * set, per spec F6 ("pinned neutral" when `budget === null`).
 */
export function moodTier(pace: number | null, moodPaceThresholds: readonly number[]): number {
  if (pace === null) return -1;
  let bucket = 0;
  for (const threshold of moodPaceThresholds) {
    if (pace >= threshold) bucket++;
  }
  return bucket;
}

export function categoryTotals(
  entries: readonly LedgerEntry[],
  ym: string,
): Array<{ categoryId: CategoryId; totalKrw: number }> {
  const totals = new Map<CategoryId, number>();
  for (const e of entries) {
    if (e.type !== "expense" || ymOf(e.occurredOn) !== ym) continue;
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amountKrw);
  }
  return [...totals.entries()]
    .map(([categoryId, totalKrw]) => ({ categoryId, totalKrw }))
    .sort((a, b) => b.totalKrw - a.totalKrw);
}

// ── 저축탑 / 무지출 데이 / 결산 selectors ──

/** Count of `savingsTowerSegments` thresholds `<= cumulativeSavingsKrw`. */
export function towerSegments(cumulativeSavingsKrw: number, savingsTowerSegments: readonly number[]): number {
  return savingsTowerSegments.filter((threshold) => threshold <= cumulativeSavingsKrw).length;
}

export function canClaimNoSpend(
  entries: readonly LedgerEntry[],
  town: Pick<TownState, "slotsUsedOn" | "slotsUsedToday" | "noSpendDays">,
  today: string,
  dailyBuildSlots: number,
  // BALANCE.noSpendDayCostsSlot (D-15, open director decision) — passed in
  // rather than imported so this selector stays pure/testable, same as
  // `dailyBuildSlots` above. When false, claiming a 무지출 데이 never checks
  // the daily slot cap at all.
  noSpendDayCostsSlot: boolean,
): boolean {
  const hasExpenseToday = entries.some((e) => e.type === "expense" && e.occurredOn === today);
  if (hasExpenseToday) return false;
  if (noSpendDayCostsSlot && slotsRemainingToday(town, today, dailyBuildSlots) <= 0) return false;
  if (town.noSpendDays.includes(today)) return false;
  return true;
}

/** Ordered 'YYYY-MM' list from `lastSettledPeriod` (exclusive) to the current period (exclusive). */
export function unsettledPeriods(lastSettledPeriod: string | null, today: string): string[] {
  const currentPeriod = ymOf(today);
  // A town with no prior settlement (fresh onboarding) has nothing retroactive
  // to settle — onboarding is expected to seed `lastSettledPeriod` to the
  // current period so this never fires on day one.
  if (lastSettledPeriod === null) return [];
  const periods: string[] = [];
  let [y, m] = lastSettledPeriod.split("-").map(Number);
  for (;;) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const period = `${y}-${String(m).padStart(2, "0")}`;
    if (period >= currentPeriod) break;
    periods.push(period);
  }
  return periods;
}

/**
 * Up to 6 distinct memos, most recent first, for one category — scanning
 * only entries already loaded for the current + previous month chunk
 * (chunk selection is the caller's job, per §8.4 chunked storage).
 */
export function recentMemos(entries: readonly LedgerEntry[], categoryId: CategoryId): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const sorted = entries.filter((e) => e.categoryId === categoryId).sort((a, b) => b.createdAt - a.createdAt);
  for (const e of sorted) {
    const memo = e.memo?.trim();
    if (!memo || seen.has(memo)) continue;
    seen.add(memo);
    result.push(memo);
    if (result.length >= 6) break;
  }
  return result;
}
