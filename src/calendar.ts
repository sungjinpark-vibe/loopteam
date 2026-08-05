/**
 * Pure calendar math shared by `selectors.ts`, `storage.ts`, and
 * `devtools/fixtures.ts` — the one place leap-year/day-count logic lives.
 *
 * No `new Date()` anywhere in this file: dates are plain 'YYYY-MM[-DD]'
 * strings, never timezone-dependent (§8.3). `new Date()` is banned outside
 * `src/platform/clock.ts` (§10.2).
 */

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return m === 2 && isLeapYear(y) ? 29 : DAYS_PER_MONTH[m - 1];
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymOnly(y: number, m: number): string {
  return `${y}-${pad2(m)}`;
}

export function ymd(y: number, m: number, d: number): string {
  return `${ymOnly(y, m)}-${pad2(d)}`;
}

/** Parses 'YYYY-MM' into its numeric parts. */
export function parseYm(ym: string): { y: number; m: number } {
  const [y, m] = ym.split("-").map(Number);
  return { y, m };
}

/** Shifts a `{y, m}` pair by `n` months (positive or negative), wrapping the year. */
export function shiftMonth(y: number, m: number, n: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + n;
  return { y: Math.floor(total / 12), m: (((total % 12) + 12) % 12) + 1 };
}

/** 'YYYY-MM' one month before `ym`. */
export function monthBefore(ym: string): string {
  const { y, m } = parseYm(ym);
  const prev = shiftMonth(y, m, -1);
  return ymOnly(prev.y, prev.m);
}

/** 'YYYY-MM' one month after `ym` — S3's month ‹ › navigation (F8). */
export function monthAfter(ym: string): string {
  const { y, m } = parseYm(ym);
  const next = shiftMonth(y, m, 1);
  return ymOnly(next.y, next.m);
}

/** 'YYYY-MM-DD' one calendar day before `dateStr` — F7's "was the previous act yesterday?" check. */
export function dayBefore(dateStr: string): string {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(5, 7));
  const d = Number(dateStr.slice(8, 10));
  if (d > 1) return ymd(y, m, d - 1);
  const prev = shiftMonth(y, m, -1);
  return ymd(prev.y, prev.m, daysInMonth(prev.y, prev.m));
}
