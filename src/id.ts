/**
 * Trivial id generator — not cryptographically unique, fine for local-only
 * client ids. Takes `now` (epoch ms) from the caller rather than calling
 * `Date.now()` itself: that call is banned outside `src/platform/clock.ts`
 * (MVP-SPEC §10.2), and callers creating an entry/building already have a
 * `clock.now()` value on hand for `createdAt`. The random suffix goes through
 * `platform/random.ts` for the same reason (rule R-6, ADDENDUM-02 §2) — a
 * bug report replayed under a pinned random seed gets reproducible ids too.
 *
 * A monotonic per-module counter is folded into every id in addition to
 * `now`/`random.next()` — proven necessary, not defensive dressing: two
 * `makeId` calls in the same millisecond under a CONSTANT random source
 * (e.g. a test's `setRandomOverride(() => 0)`, or simply bad luck with a real
 * one) used to collide, because `(0).toString(36).slice(2, 8)` of a
 * single-character string is `""` — both calls produced the exact same id,
 * silently merging two distinct entries/buildings. The counter guarantees
 * distinctness on its own regardless of what `now`/`random` return, while
 * staying fully deterministic (so DE-3 reproducibility under a pinned
 * seed/clock is unaffected — the counter's value is a pure function of call
 * order, not of wall-clock time).
 */
import { random } from "./platform/random";

let counter = 0;

export function makeId(prefix: string, now: number): string {
  counter = (counter + 1) % 2 ** 32;
  return `${prefix}_${now.toString(36)}_${random.next().toString(36).slice(2, 8)}_${counter.toString(36)}`;
}
