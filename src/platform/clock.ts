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

/**
 * 'YYYY-MM-DD' -> local Date at midnight, for handing a date to a TDS
 * date-picker component (`WheelDatePicker`) that requires a native `Date` —
 * that's their API surface, not this app's; every other module still deals
 * exclusively in 'YYYY-MM-DD' strings (§8.3). Exported from this file, not a
 * component, because `new Date()` is banned everywhere else (§10.2 lint rule).
 */
export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}

/** The inverse of `ymdToDate` — same "banned everywhere but here" reasoning. */
export function dateToYmd(date: Date): string {
  return toYmd(date);
}

// Dev-only TimeTravel override (§11.B) — set from the S7 devtools sheet.
let timeTravelDate: string | null = null;
// Anchor pair captured the moment travel starts: local midnight of the travel
// date, plus the real Date.now() at that instant. now() during travel is
// `travelMidnight + realElapsedSinceAnchor` — monotonic (Date.now() only
// advances) and immune to timezone wraparound. The previous implementation
// used `Date.now() % 86_400_000` (ms since UTC midnight), which is off by the
// local UTC offset and resets to 0 whenever local time crosses UTC midnight —
// in KST that's 09:00, which could make createdAt jump backwards mid-session.
let timeTravelAnchorMs = 0;
let timeTravelBaseMs = 0;

// Listeners notified on every `setTimeTravelDate` call — what makes the
// override `useSyncExternalStore`-compatible (React re-renders on change
// instead of needing a remount/poll, spec §11.B "everything derives from it").
const listeners = new Set<() => void>();

export const browserClock: ClockPort = {
  today: () => timeTravelDate ?? toYmd(new Date()),
  now: () => (timeTravelDate ? timeTravelBaseMs + (Date.now() - timeTravelAnchorMs) : Date.now()),
};

/** Toss driver — later column says "unchanged" (spec §10.2): device date is device date on either host. */
export const tossClock: ClockPort = browserClock;

export const clock: ClockPort = browserClock;

/** Dev-only: set/clear the date `clock.today()` returns. `null` restores the real device date. */
export function setTimeTravelDate(dateOrNull: string | null): void {
  timeTravelDate = dateOrNull;
  if (dateOrNull) {
    timeTravelAnchorMs = Date.now();
    timeTravelBaseMs = new Date(`${dateOrNull}T00:00:00`).getTime();
  }
  for (const listener of listeners) listener();
}

/** Dev-only: read the current TimeTravel override, for the S7 inspector. */
export function getTimeTravelDate(): string | null {
  return timeTravelDate;
}

/**
 * Dev-only: subscribe to TimeTravel changes. Returns an unsubscribe function.
 * Pairs with `getTimeTravelDate` as a `useSyncExternalStore(subscribeTimeTravel,
 * getTimeTravelDate)` store — the S7 sheet (later task) needs this to
 * re-render the app on date change instead of remounting or polling.
 */
export function subscribeTimeTravel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
