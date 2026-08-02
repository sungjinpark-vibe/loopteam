/**
 * clock port — MVP-SPEC.md §10.2.
 *
 * This is the ONLY file in the app allowed to call `new Date()` / `Date.now()`
 * (enforced by the `no-restricted-syntax` rule in eslint.config.js). Every
 * other module gets "now" through this port, which is what makes the whole
 * app time-travelable for QA with no extra machinery (§11 TimeTravel).
 */

export interface ClockPort {
  /** Device-local 'YYYY-MM-DD' for "today". */
  today(): string;
  /** Epoch ms, for `createdAt`/`updatedAt` timestamps. */
  now(): number;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Dev-only TimeTravel override (§11.B) — set from the S7 devtools sheet.
let timeTravelDate: string | null = null;

export const browserClock: ClockPort = {
  today: () => timeTravelDate ?? toYmd(new Date()),
  // When time-traveling, timestamps still advance within the overridden day
  // so ordering (e.g. recentMemos) stays sane instead of freezing at noon.
  now: () => (timeTravelDate ? new Date(`${timeTravelDate}T00:00:00`).getTime() + (Date.now() % 86_400_000) : Date.now()),
};

/** Toss driver — later column says "unchanged" (spec §10.2): device date is device date on either host. */
export const tossClock: ClockPort = browserClock;

export const clock: ClockPort = browserClock;

/** Dev-only: set/clear the date `clock.today()` returns. `null` restores the real device date. */
export function setTimeTravelDate(dateOrNull: string | null): void {
  timeTravelDate = dateOrNull;
}

/** Dev-only: read the current TimeTravel override, for the S7 inspector. */
export function getTimeTravelDate(): string | null {
  return timeTravelDate;
}
