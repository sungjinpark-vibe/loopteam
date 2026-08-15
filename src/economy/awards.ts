/**
 * F-ECON earn loop — PM-DECISIONS §F-ECON. Pure functions only: no React, no
 * storage, no `clock`/`random` (this whole file is a value -> value mapping,
 * unit-testable with plain inputs). `../useTownStore.ts` is the only caller —
 * it supplies the event descriptor from whatever domain state it already has
 * in hand at the four existing call sites (build / no-spend / tier / F16
 * settlement) and persists the result; nothing here touches storage itself.
 *
 * Idempotency lives in `eventKey`: the same real-world event always produces
 * the same key, so `applyAward` (and the store's `grantSeeds`) can refuse to
 * pay a key already recorded in `EconomyState.grantedEventKeys` — a re-boot,
 * a double render, or a replayed drain can never double-pay.
 */
import { BALANCE } from "../balance.approved";
import { GRANTED_EVENT_KEYS_CAP, seeds as toSeedCount, type EconomyState } from "./types";

export type AwardEvent =
  // B4 — the ledger entry itself, which is the play action the player actually
  // performs. `build` below only ever fired when the entry FOUNDED a building,
  // so growing (ADDENDUM-04 §5), queueing (F14) and overflowing all paid zero.
  //
  // Gate-3 round-5 (게임 디자이너's TOP FIX): `expGain` — the same
  // `expGainFor(amountKrw, BALANCE.expAmountTiers)` value the building EXP
  // curve already computed for this act — makes the seed payout track the
  // amount instead of being flat. A flat per-entry amount let 15 same-day
  // tiny entries (well under the first exp band) mint far more seeds than
  // that much real spending should buy — past the cheapest shop item on day
  // one; a building founded by the same entry already reads as "barely
  // anything" at that amount (expGain 0, Lv.1) — seeds now agree. (Amounts
  // themselves stay out of this file — rule R-7, `ruleR7.test.ts`.)
  | { kind: "entry"; entryId: string; expGain: number }
  | { kind: "build"; buildingId: string; expGain: number }
  | { kind: "nospend"; date: string }
  | { kind: "tier"; tier: number }
  // Gate-3-rerun fix (liveops-pd's TOP FIX, -4 the single biggest deduction of
  // the panel): 연속 N일 was tracked (`selectors.ts` advanceStreak) and shown
  // in the header at all times, but paid nothing and explained nothing — "the
  // opposite of a return hook." Fires once per calendar day, the same day
  // `advanceStreak` actually extends the streak (never on the idempotent
  // same-day no-op) — the caller (`useTownStore.ts`) detects that by
  // `town.lastActOn` changing. Keyed by date, same idempotency shape as
  // `nospend`, so a reboot or a replayed drain can't double-pay one day.
  | { kind: "streak"; date: string; streakDays: number }
  // ADDENDUM-11 §5.3 — one fusion act. The idempotency key carries the
  // RESULTING fuse tier, not just the survivor's id: the same building fuses
  // again on its way to Lv.10, and an id-only key would treat that Lv.7 as an
  // already-paid Lv.6 and silently pay nothing for every rung after the first.
  | { kind: "fuse"; buildingId: string; fuseTier: number }
  | { kind: "settlement"; period: string; outcomeBucket: number; primeLotCount: number }
  // Gate-3 round-5 (A5), the panel-blocking finding: against the 150-seed
  // price floor, a casual 2-entries/day logger who GROWS rather than founds
  // earns only `entry` (4) per entry plus the daily streak top-up, which puts
  // the first cosmetic on day 9 — past ADDENDUM-05 §6's own stated intent
  // ("affords their first cosmetic within roughly a week"). A one-time grant
  // on onboarding completion closes that without touching the earn RATE (so
  // long-run economy balance is unchanged) and without touching
  // `balance.approved.ts`, which is frozen (MVP-SPEC §9 rule 3). Fired once
  // from `completeOnboarding` (useTownStore.ts), which itself already treats
  // skip and finish identically, so a player who skips onboarding is not
  // quietly excluded. Same idempotent-key mechanism as every other award here,
  // so a re-boot or a re-render can never double-pay it.
  | { kind: "welcome" };

// ponytail: a flat one-time grant, not a curve — retune this one number (not
// `balance.approved.ts`) if the earn rate ever needs a real design pass.
// Sized against the worst realistic case in `pacing.test.ts`: 2 entries/day,
// all grows, no 무지출 days, no tier crossings. 80 moves that player's first
// purchase from day 9 to day 5; the arithmetic is asserted there, not here.
const WELCOME_GRANT_SEEDS = 80;

export interface SeedAward {
  eventKey: string;
  amount: number;
}

// Gate-3 round-5 — indexes a 5-entry seed table by the SAME rung
// `expGainFor` landed on (`BALANCE.expAmountTiers` pairs each band with exp
// 0/3/6/9/12; dividing by `expPerLevel` (3) recovers the rung 0..4 without
// re-importing the tiers themselves). Rounds and clamps so a legacy/queued
// `exp` value slightly off the table (or the 1-point legacy fallback in
// `queueActions.ts`) still lands on a real row instead of throwing.
function seedsForExpTier(table: readonly [number, number, number, number, number], expGain: number): number {
  const rung = Math.min(4, Math.max(0, Math.round(expGain / BALANCE.expPerLevel)));
  return table[rung];
}

/** Event descriptor -> the seed grant it earns. Pure — same event always yields the same key and amount. */
export function awardFor(event: AwardEvent): SeedAward {
  switch (event.kind) {
    case "entry":
      return { eventKey: `seed:entry:${event.entryId}`, amount: seedsForExpTier(BALANCE.seedAwards.entry, event.expGain) };
    case "build":
      return { eventKey: `seed:build:${event.buildingId}`, amount: seedsForExpTier(BALANCE.seedAwards.build, event.expGain) };
    case "nospend":
      return { eventKey: `seed:nospend:${event.date}`, amount: BALANCE.seedAwards.nospend };
    case "tier":
      return { eventKey: `seed:tier:${event.tier}`, amount: BALANCE.seedAwards.tier };
    case "streak":
      // Not a `BALANCE.seedAwards` dial (that file is frozen — MVP-SPEC §9
      // rule 3, director-approved contents only): a small local formula
      // instead, deliberately modest next to `nospend` (8) and `build` (3)
      // dials it sits beside — a daily login bonus is a top-up, not the
      // economy's main earn path. Scales with streak length so day 7 pays
      // noticeably more than day 1, capped so a long streak doesn't dwarf
      // every other award.
      // ponytail: flat linear ramp, not a curve — retune here (not in
      // balance.approved.ts) if the pacing ever needs a real design pass.
      return { eventKey: `seed:streak:${event.date}`, amount: Math.min(2 * event.streakDays, 20) };
    case "fuse":
      return { eventKey: `seed:fuse:${event.buildingId}:${event.fuseTier}`, amount: BALANCE.seedAwards.fuse };
    case "welcome":
      // No id in the key on purpose — there is exactly one welcome per save.
      return { eventKey: "seed:welcome", amount: WELCOME_GRANT_SEEDS };
    case "settlement":
      return {
        eventKey: `seed:settlement:${event.period}`, // UNCHANGED — same idempotency key
        amount:
          (BALANCE.seedAwards.settlementByOutcomeBucket[event.outcomeBucket] ?? 0) +
          // ADDENDUM-06 §3.2 — 명당 standing bonus: 3 seeds per building on a prime lot, capped at 30.
          Math.min(BALANCE.seedAwards.primeLotMax, BALANCE.seedAwards.primeLot * Math.max(0, event.primeLotCount)),
      };
  }
}

/**
 * Applies one award to an economy state. Returns the SAME object reference,
 * unchanged, when the award is a no-op (zero amount, or `eventKey` already
 * granted) — callers (the store's `grantSeeds`, the boot-time settlement
 * path) use `===` against their input to detect "nothing to persist" without
 * a second idempotency check of their own.
 */
export function applyAward(economy: EconomyState, award: SeedAward): EconomyState {
  if (award.amount <= 0 || economy.grantedEventKeys.includes(award.eventKey)) return economy;
  return {
    ...economy,
    seeds: toSeedCount(economy.seeds + award.amount),
    // Ring buffer — see `GRANTED_EVENT_KEYS_CAP`'s own doc comment (types.ts).
    grantedEventKeys: [...economy.grantedEventKeys, award.eventKey].slice(-GRANTED_EVENT_KEYS_CAP),
  };
}
