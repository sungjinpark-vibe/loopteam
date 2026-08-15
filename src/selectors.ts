/**
 * Pure derived-state functions — MVP-SPEC.md §8.2.
 *
 * Nothing here touches storage, the DOM, or `Date`/`Date.now()` (that ban is
 * enforced outside `src/platform/clock.ts` by an eslint `no-restricted-syntax`
 * rule, §10.2) — every selector takes `today`/`ym` as an explicit string
 * argument supplied by the caller from the clock port. That is what makes
 * every selector unit-testable with no React and fully time-travelable.
 */
import { daysInMonth as daysInMonthOf, dayBefore, monthBefore, parseYm, shiftMonth, ymOnly } from "./calendar";
import { canFuse, MAX_FUSE_TIER } from "./fusionActions";
import { footprintOf } from "./placement";
import { savingsOf } from "./types";
import type { Building, CategoryId, EntryType, LedgerEntry, SavingCategoryId, TownState } from "./types";

// ── Small date helpers (device-local 'YYYY-MM-DD' strings only, §8.3) ──

function ymOf(dateStr: string): string {
  return dateStr.slice(0, 7); // 'YYYY-MM-DD' -> 'YYYY-MM'
}

// Pure calendar math (shared with storage.ts/devtools/fixtures.ts via ./calendar) —
// `new Date()` is banned outside src/platform/clock.ts (§10.2).
function daysInMonth(ym: string): number {
  const { y, m } = parseYm(ym);
  return daysInMonthOf(y, m);
}

function dayOfMonth(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

// ── Recovery (§8.3): the only two fields ever rebuilt from entries ──

/**
 * Reconstructs `cumulativeSavingsKrw` and `lastSettledPeriod` — spec §8.3's
 * "only denormalized fields" — from `entries` alone. Run by import (F12,
 * later task) and by `src/storage.ts`'s corrupt-*core*-chunk recovery path
 * (§8.3: "run ... by the corrupt-chunk recovery path") so a lost `core`
 * chunk never permanently loses these two numbers. Only called when `core`
 * itself is gone — a `core` that parsed fine is always authoritative and
 * must never be overwritten by this function's output (storage.ts never
 * calls this when `core` survived).
 *
 * `lastSettledPeriod` is set to one month *before* the earliest `YYYY-MM`
 * touched by any entry, not the latest — the risk runs only one direction:
 * setting it too late would advance past a month that still has entries and
 * F16 would never mint that month's 기념비 again (permanent, since
 * `unsettledPeriods` is exclusive of `lastSettledPeriod`). Setting it too
 * early costs at most a re-run of F16 for already-settled zero-entry months,
 * which is idempotent and merely mints an extra (harmless) monument — a
 * correctness gap only reachable via storage corruption, not normal use.
 */
export function rebuildDerived(
  entries: readonly LedgerEntry[],
): Pick<TownState, "cumulativeSavingsKrw" | "lastSettledPeriod"> {
  let cumulativeSavingsKrw = 0;
  let earliestPeriod: string | null = null;
  for (const e of entries) {
    if (e.type === "saving") cumulativeSavingsKrw += e.amountKrw;
    const period = ymOf(e.occurredOn);
    if (earliestPeriod === null || period < earliestPeriod) earliestPeriod = period;
  }
  const lastSettledPeriod = earliestPeriod === null ? null : monthBefore(earliestPeriod);
  return { cumulativeSavingsKrw, lastSettledPeriod };
}

// ── Town / building selectors ──

export function buildingCount(buildings: readonly Building[]): number {
  return buildings.length;
}

/** ADDENDUM-04 §2 — read discipline for `Building.exp`, the same rule `savingsOf` already sets for `TownState`: never open-code `?? 0` at a call site. */
export function expOf(b: Pick<Building, "exp">): number {
  return b.exp ?? 0;
}

/** ADDENDUM-04 §2/§8 — `1 + floor(exp / expPerLevel)`, capped at `maxLevel` (visual only; EXP past the cap still counts toward tier via `growthScore` below). */
export function levelOf(b: Pick<Building, "exp">, expPerLevel: number, maxLevel: number): number {
  return Math.min(maxLevel, 1 + Math.floor(expOf(b) / expPerLevel));
}

/** ADDENDUM-11 §2.4 — read discipline for `Building.fuse`, same rule `expOf` sets: never open-code `?? 0`. */
export function fuseOf(b: Pick<Building, "fuse">): number {
  return b.fuse ?? 0;
}

/**
 * ADDENDUM-11 §2.4 — the level a player SEES: `levelOf` (EXP, capped at
 * `maxLevel`) plus the fuse tier. `levelOf` itself is deliberately NOT
 * modified — every existing caller keeps its current meaning and its current
 * cap; only the display/art path and the fusion condition read this.
 */
export function totalLevelOf(b: Pick<Building, "exp" | "fuse">, expPerLevel: number, maxLevel: number): number {
  return levelOf(b, expPerLevel, maxLevel) + fuseOf(b);
}

/**
 * ADDENDUM-11 §5.1.3 — the town's size in Lv.5-equivalents: a fused building
 * counts as the buildings it absorbed (`Σ 2 ** fuseOf(b)`).
 *
 * This is what feeds BOTH `tier()` and the header's "건물 N채", through the
 * single `TownStore.buildingCount` accessor — the Gate-3-rerun invariant
 * (`entryActions.ts:112-124`) is that the gate and the display are ONE number
 * reached through ONE accessor, which is exactly why this is not introduced as
 * a second number sitting beside the count.
 *
 * Two consequences, both intended: fusion is exactly tier-neutral (two Lv.5s,
 * scale 2, become one Lv.6, scale 2 — never a regression at any rung), and the
 * top threshold (200) becomes reachable on a 193-cell map for the first time
 * (§5.1.1's pre-existing arithmetic defect). For a town with nothing fused
 * every building reads `2 ** 0 = 1`, so this equals `buildings.length`
 * exactly and an existing save's tier is unchanged on first load.
 */
export function townScale(buildings: readonly Building[]): number {
  let scale = 0;
  for (const b of buildings) scale += 2 ** fuseOf(b);
  return scale;
}

/**
 * ADDENDUM-04 §3 — what every *tier* call site now feeds `tier()` instead of
 * `buildings.length`. A new building and a grow each add exactly 1 (one via
 * `.length`, one via `exp`), so tier pacing is byte-identical to today for a
 * player who always builds, and an existing save (every building's `exp`
 * absent -> `expOf` reads 0) reproduces the exact `buildings.length` score
 * `tier()` was already getting. `buildingCount` above is unchanged and still
 * used where a literal count is wanted (기록/UI).
 */
export function growthScore(buildings: readonly Building[]): number {
  let score = buildings.length;
  for (const b of buildings) score += expOf(b);
  return score;
}

/**
 * ADDENDUM-04 §7 — EXP earned by one logging act. `tiers === null` (the
 * shipped default, `BALANCE.expAmountTiers`) is flat 1 EXP regardless of
 * amount. A table of ascending `[maxAmountKrwExclusive, exp]` pairs returns
 * the first tier `amountKrw` falls strictly under. A well-formed table ends
 * with `Infinity` so every amount matches one; the last tier's exp is the
 * fallback only so a malformed table degrades instead of returning
 * `undefined`.
 */
export function expGainFor(amountKrw: number, tiers: readonly (readonly [number, number])[] | null): number {
  if (tiers === null) return 1;
  for (const [maxExclusive, exp] of tiers) {
    if (amountKrw < maxExclusive) return exp;
  }
  return tiers.length > 0 ? tiers[tiers.length - 1][1] : 1;
}

/**
 * ADDENDUM-04 §4 — candidate set for the grow dialog/pick-mode: live,
 * entry-founded buildings sharing `categoryId`. Park tiles
 * (`source.kind === "nospend"`) and monuments are never candidates. Sorted by
 * `createdAt` ascending for a deterministic pick-mode order.
 */
export function growCandidates(buildings: readonly Building[], categoryId: CategoryId): Building[] {
  return buildings
    .filter((b) => b.source.kind === "entry" && b.categoryId === categoryId)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Gate-3 round-5 follow-up: `FUSION_WAY_OUT_HINT` (TownScreen.tsx) tells a
 * full town to fuse two Lv.`maxLevel` buildings, but never checked whether
 * such a pair actually EXISTS — advice that can point at a door that isn't
 * there. Finds one in O(n), not a naive O(n²) all-pairs scan (this runs on
 * render, and the dense fixture is ~5,400 buildings — devtools/fixtures.ts):
 * buildings that pass the cheap per-building conditions
 * (`source.kind === "entry"`, at `maxLevel`, below `MAX_FUSE_TIER`) are
 * bucketed by `categoryId|footprint|fuseTier`; the first bucket to reach two
 * is the pair, an early exit. `canFuse` (fusionActions.ts §2.2, the one place
 * F1-F6 live) re-confirms the pair before it's returned, so this only
 * narrows the search — it never restates a fusion condition.
 */
export function firstFusablePair(
  buildings: readonly Building[],
  expPerLevel: number,
  maxLevel: number,
): [Building, Building] | null {
  const firstByKey = new Map<string, Building>();
  for (const b of buildings) {
    if (b.source.kind !== "entry") continue; // F4
    if (levelOf(b, expPerLevel, maxLevel) !== maxLevel) continue; // F1
    if (fuseOf(b) >= MAX_FUSE_TIER) continue; // F6
    const { w, h } = footprintOf(b);
    const key = `${b.categoryId}|${w}x${h}|${fuseOf(b)}`; // F2/F3/F5
    const partner = firstByKey.get(key);
    if (partner === undefined) {
      firstByKey.set(key, b);
      continue;
    }
    if (canFuse(partner, b, expPerLevel, maxLevel)) return [partner, b];
  }
  return null;
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

/**
 * F7's own "does today extend the streak" predicate — the ONE place that
 * decides it, shared by `advanceStreak` (what a save actually does) and
 * `streakDisplay` (what the header honestly shows) below. Extracted so the
 * header's copy can never drift from the save path's real behavior again
 * (header-honesty defect: it used to re-derive `lastActOn !== today` on its
 * own, which is true both the day after a live streak AND months after a
 * dead one — this is the narrower, correct check).
 */
function streakAlive(town: Pick<TownState, "lastActOn">, today: string): boolean {
  return town.lastActOn === dayBefore(today);
}

/**
 * F7 streak: advances `lastActOn`/`streakDays`/`longestStreakDays` for the
 * day's first build-producing act (a new ledger entry that builds or queues,
 * or a claimed 무지출 데이 — spec §5 F7). Idempotent within a day — a second
 * act on the same day returns `town` completely unchanged ("two acts same
 * day -> +1 total, not +2"). `longestStreakDays` never decreases.
 */
export function advanceStreak(
  town: Pick<TownState, "lastActOn" | "streakDays" | "longestStreakDays">,
  today: string,
): Pick<TownState, "lastActOn" | "streakDays" | "longestStreakDays"> {
  if (town.lastActOn === today) return town;
  const streakDays = streakAlive(town, today) ? town.streakDays + 1 : 1;
  return { lastActOn: today, streakDays, longestStreakDays: Math.max(town.longestStreakDays, streakDays) };
}

/** Header-honesty status for the streak line — see `streakDisplay` below. */
export type StreakStatus = "recorded" | "alive" | "broken";

/**
 * Header-honesty fix: what the streak line should HONESTLY show right now,
 * derived from `streakAlive` (the exact predicate `advanceStreak` — the save
 * path's real source of truth — uses), not restated by hand. Three cases:
 *
 *  - `lastActOn === today`: already recorded today. Shows the stored count,
 *    no continuation copy.
 *  - `streakAlive`: yesterday was the last act — today genuinely continues
 *    it. Shows the stored count with the "이어져요" copy.
 *  - otherwise: the streak is dead (`advanceStreak` would RESET it to 1, not
 *    extend it, on the next save) — the stored `streakDays` is stale and
 *    must not be shown as if it were still live. Shows 0, with "새로
 *    시작해요" copy instead of a continuation claim.
 */
export function streakDisplay(
  town: Pick<TownState, "lastActOn" | "streakDays">,
  today: string,
): { streakDays: number; status: StreakStatus } {
  if (town.lastActOn === today) return { streakDays: town.streakDays, status: "recorded" };
  if (streakAlive(town, today)) return { streakDays: town.streakDays, status: "alive" };
  return { streakDays: 0, status: "broken" };
}

/**
 * FT-1 header honesty check (commit e5da901): whether the header's
 * queue-length line should promise "자리가 나면" (room-based) instead of
 * "내일" (a specific-morning promise it may not be able to keep).
 *
 * `decideBuildOrQueue` (entryActions.ts) only queues instead of building when
 * EITHER today's daily cap is spent OR the town has no legal plot — and it
 * never queues while a slot AND a plot both exist (it builds immediately
 * instead). So a queue that is still non-empty despite slots remaining today
 * can only be explained by the second reason: the town is full, not merely
 * capped for today. When slots are already spent, the cap alone explains the
 * queue and "내일" (it drains tomorrow's reset) stays honest.
 */
export function queueWaitsOnRoom(slotsRemaining: number, queueLength: number): boolean {
  return queueLength > 0 && slotsRemaining > 0;
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
    // Gate-3 round-5 (타깃 플레이어's TOP FIX): with only 1-2 real days
    // elapsed, `elapsedFraction` is tiny, so a single ordinary bill (rent, a
    // card payment) divided by it explodes into an extreme ratio — day 2
    // already read "🌧️ 빠듯해요" off 13% of the month's budget. Floor the
    // denominator at a week's worth of the month so the first week is judged
    // against a week's grace budget instead of against 1-2 days of it;
    // converges back to the real day-of-month fraction from day 7 on
    // (continuous at the seam), so nothing changes for the rest of the month.
    const EARLY_MONTH_GRACE_DAYS = 7;
    elapsedFraction = Math.max(elapsedFraction, EARLY_MONTH_GRACE_DAYS / daysInMonth(ym));
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

/**
 * Gate-3-rerun fix (게임디자이너/UX리서처/라이브옵스PD/QA/타깃플레이어, all E1 top
 * finding): a saving below the FIRST rung of `ladder` (100,000원 by default)
 * previously produced zero visible change anywhere — same pips, same empty
 * lot, screenshots read as identical. This is the partial-progress fraction
 * [0, 1) toward the next un-crossed rung, purely a rendering input (no new
 * amount is exposed — `SavingsRow` turns this into a CSS fill width, never
 * text, so invariant 2 / AC-F13-9 "no 원 in the savings block" still holds).
 * `0` once every rung is already crossed (`towerSegments` maxed) — nothing
 * left to fill toward.
 */
export function progressToNextSegment(cumulativeSavingsKrw: number, ladder: readonly number[]): number {
  const level = towerSegments(cumulativeSavingsKrw, ladder);
  if (level >= ladder.length) return 0;
  const prevThreshold = level === 0 ? 0 : ladder[level - 1];
  const nextThreshold = ladder[level];
  if (nextThreshold <= prevThreshold) return 0; // guard a malformed/flat ladder — never divide by <=0
  const fraction = (cumulativeSavingsKrw - prevThreshold) / (nextThreshold - prevThreshold);
  return Math.max(0, Math.min(1, fraction));
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
  let { y, m } = parseYm(lastSettledPeriod);
  for (;;) {
    ({ y, m } = shiftMonth(y, m, 1));
    const period = ymOnly(y, m);
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

// ── ADDENDUM-01 §2.5/§4.2 — APPEND ONLY, nothing above this line is opened ──

/**
 * Which ladder a savings structure uses: its own override if one exists,
 * else the shared default. Injected rather than imported — same discipline
 * `towerSegments`/`canClaimNoSpend` already use — so this file's header rule
 * ("imports only ./calendar and ./types") holds. Every level read in the app
 * goes through this function; there is no second place that decides which
 * ladder a structure uses.
 */
export function ladderFor(
  id: SavingCategoryId,
  defaultLadder: readonly number[],
  overrides: Partial<Record<SavingCategoryId, readonly number[]>>,
): readonly number[] {
  return overrides[id] ?? defaultLadder;
}

/**
 * Rebuilds the per-category aggregate from entries (import / corrupt-core
 * recovery) — the same denormalization `rebuildDerived` does for the total,
 * split by bucket. `bucketOf` is injected rather than imported (same
 * discipline as `ladderFor`/`towerSegments`/`canClaimNoSpend`) so this file's
 * header rule ("imports only ./calendar and ./types") holds.
 */
export function savingsByCategory(
  entries: readonly LedgerEntry[],
  bucketOf: (categoryId: string) => SavingCategoryId,
): Partial<Record<SavingCategoryId, number>> {
  const totals: Partial<Record<SavingCategoryId, number>> = {};
  for (const e of entries) {
    if (e.type !== "saving") continue;
    const id = bucketOf(e.categoryId);
    totals[id] = (totals[id] ?? 0) + e.amountKrw;
  }
  return totals;
}

/**
 * Which structures crossed a ladder threshold between two savings snapshots
 * — the level-up detector (§2.6a). Iterates the keys of AFTER only: a level
 * can rise for an id absent from `before`, never for one absent from
 * `after`, so no id list is needed here. Returns at most one id for a normal
 * save (one entry has one categoryId) but an array anyway, so import/
 * corrupt-recovery paths (which can move several buckets at once) reuse it.
 */
export function grownStructures(
  before: Pick<TownState, "savingsByCategoryKrw">,
  after: Pick<TownState, "savingsByCategoryKrw">,
  ladderOf: (id: SavingCategoryId) => readonly number[],
): SavingCategoryId[] {
  const grown: SavingCategoryId[] = [];
  for (const key of Object.keys(after.savingsByCategoryKrw ?? {})) {
    const id = key as SavingCategoryId;
    const ladder = ladderOf(id);
    const was = towerSegments(savingsOf(before, id), ladder);
    const now = towerSegments(savingsOf(after, id), ladder);
    if (now > was) grown.push(id);
  }
  return grown;
}

// ── F8 기록 (history + stats) selectors — APPEND ONLY, nothing above this line is opened ──

/** Month totals for S3's totals row (지출/수입/저축/순액). `netKrw` is income minus expense — saving is money moved, not spent, so it doesn't offset the net. */
export interface MonthTotals {
  expenseKrw: number;
  incomeKrw: number;
  savingKrw: number;
  netKrw: number;
}

export function monthTotals(entries: readonly LedgerEntry[], ym: string): MonthTotals {
  const expenseKrw = monthTotal(entries, ym, "expense");
  const incomeKrw = monthTotal(entries, ym, "income");
  const savingKrw = monthTotal(entries, ym, "saving");
  return { expenseKrw, incomeKrw, savingKrw, netKrw: incomeKrw - expenseKrw };
}

export interface DonutSlice {
  categoryId: CategoryId;
  totalKrw: number;
  /** Integer percent; every month's slices sum to exactly 100 (see below). */
  percent: number;
}

/**
 * F8's expense category donut: `categoryTotals`' own descending order, with
 * INTEGER percentages guaranteed to sum to exactly 100 for a non-empty month.
 * Rounding each slice independently (`Math.round`) can under/overshoot 100 by
 * a point or two — the largest-remainder method instead floors every slice,
 * then hands the leftover point(s) to the slices with the biggest fractional
 * part first, which is what the spec's AC ("percentages sum to 100 within
 * rounding") asks for. Empty month -> `[]` (no divide-by-zero), so the caller
 * renders an empty state instead of a broken chart.
 */
export function categoryDonut(entries: readonly LedgerEntry[], ym: string): DonutSlice[] {
  const totals = categoryTotals(entries, ym);
  const grandTotal = totals.reduce((sum, t) => sum + t.totalKrw, 0);
  if (grandTotal <= 0) return [];
  const raw = totals.map((t) => (t.totalKrw / grandTotal) * 100);
  const floors = raw.map(Math.floor);
  const leftover = 100 - floors.reduce((a, b) => a + b, 0);
  const byFractionDesc = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  const percents = [...floors];
  for (let k = 0; k < leftover; k++) percents[byFractionDesc[k].i] += 1;
  return totals.map((t, i) => ({ categoryId: t.categoryId, totalKrw: t.totalKrw, percent: percents[i] }));
}

/** One day's rows in S3's entry list. */
export interface DayGroup {
  date: string; // 'YYYY-MM-DD'
  /** This day's entries, most-recently-created first. */
  entries: LedgerEntry[];
  /** A claimed 무지출 데이 for this date — spec's "distinct zero-amount row" AC, even when `entries` is otherwise empty. */
  isNoSpend: boolean;
  expenseKrw: number;
  incomeKrw: number;
  savingKrw: number;
}

/**
 * F8's reverse-chronological, day-grouped entry list for one month. A day
 * that was claimed as a 무지출 데이 always produces a group — even with zero
 * entries that day — so the no-spend row is never silently dropped; a day
 * that also logged income/saving keeps both.
 */
export function dayGroups(entries: readonly LedgerEntry[], noSpendDays: readonly string[], ym: string): DayGroup[] {
  const byDate = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    if (ymOf(e.occurredOn) !== ym) continue;
    const list = byDate.get(e.occurredOn);
    if (list) list.push(e);
    else byDate.set(e.occurredOn, [e]);
  }
  const noSpendInMonth = noSpendDays.filter((d) => ymOf(d) === ym);
  const dates = new Set<string>([...byDate.keys(), ...noSpendInMonth]);
  return [...dates]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)) // descending — most recent day first
    .map((date) => {
      const dayEntries = (byDate.get(date) ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);
      let expenseKrw = 0;
      let incomeKrw = 0;
      let savingKrw = 0;
      for (const e of dayEntries) {
        if (e.type === "expense") expenseKrw += e.amountKrw;
        else if (e.type === "income") incomeKrw += e.amountKrw;
        else savingKrw += e.amountKrw;
      }
      return { date, entries: dayEntries, isNoSpend: noSpendInMonth.includes(date), expenseKrw, incomeKrw, savingKrw };
    });
}
