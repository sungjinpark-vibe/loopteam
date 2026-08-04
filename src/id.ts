/**
 * Trivial id generator — not cryptographically unique, fine for local-only
 * client ids. Takes `now` (epoch ms) from the caller rather than calling
 * `Date.now()` itself: that call is banned outside `src/platform/clock.ts`
 * (MVP-SPEC §10.2), and callers creating an entry/building already have a
 * `clock.now()` value on hand for `createdAt`. The random suffix goes through
 * `platform/random.ts` for the same reason (rule R-6, ADDENDUM-02 §2) — a
 * bug report replayed under a pinned random seed gets reproducible ids too.
 */
import { random } from "./platform/random";

export function makeId(prefix: string, now: number): string {
  return `${prefix}_${now.toString(36)}_${random.next().toString(36).slice(2, 8)}`;
}
