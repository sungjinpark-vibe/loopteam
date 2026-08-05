/**
 * Pure formatting helpers for the entry sheet (S4, spec §5 F1).
 * No `Date`, no storage, no React — unit-testable in isolation.
 */

/** '12000' -> '12,000'. Empty/non-numeric input passes through unchanged. */
export function commaizeAmount(digits: string): string {
  if (digits === "") return "";
  return Number(digits).toLocaleString("en-US");
}

/** '12,000원' -> '12000' (keeps only digits, for a comma-formatted TextField's `format.reset`). */
export function decommaizeAmount(formatted: string): string {
  return formatted.replace(/[^0-9]/g, "");
}

/** ~99억 원 — a generous keypad input ceiling, not a balance dial. */
const AMOUNT_DIGITS_MAX = 10;

/** Appends one keypad digit to a normalized amount-digit string: caps length at AMOUNT_DIGITS_MAX, strips leading zeros. Shared by EntrySheet (S4) and EntryDetailSheet (S5) via `EntryFields`. */
export function appendAmountDigit(prevDigits: string, digit: string): string {
  const next = (prevDigits + digit).replace(/^0+(?=\d)/, "");
  return next.length > AMOUNT_DIGITS_MAX ? prevDigits : next;
}

/**
 * KRW amount -> Korean 만/억/천 reading hint, spec §5 F1 AC:
 * "Typing 12000 shows '12,000원' + hint '1만 2천원'". Approximate by design
 * (a placeholder UX hint, not a certified number-to-Korean converter) — the
 * sub-1,000 remainder is appended as a plain number rather than dropped, so
 * e.g. 4,500원 reads "4천 500원", not an understated "4천원".
 */
export function krwReadingHint(amountKrw: number): string {
  if (!Number.isFinite(amountKrw) || amountKrw <= 0) return "";
  let n = Math.floor(amountKrw);
  const eok = Math.floor(n / 100_000_000);
  n %= 100_000_000;
  const man = Math.floor(n / 10_000);
  n %= 10_000;
  const cheon = Math.floor(n / 1_000);
  const won = n % 1_000;

  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man}만`);
  if (cheon > 0) parts.push(`${cheon}천`);
  if (won > 0) parts.push(`${won}`);
  if (parts.length === 0) return `${amountKrw}원`;
  return `${parts.join(" ")}원`;
}
