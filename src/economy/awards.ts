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
  | { kind: "entry"; entryId: string }
  | { kind: "build"; buildingId: string }
  | { kind: "nospend"; date: string }
  | { kind: "tier"; tier: number }
  // ADDENDUM-11 §5.3 — one fusion act. The idempotency key carries the
  // RESULTING fuse tier, not just the survivor's id: the same building fuses
  // again on its way to Lv.10, and an id-only key would treat that Lv.7 as an
  // already-paid Lv.6 and silently pay nothing for every rung after the first.
  | { kind: "fuse"; buildingId: string; fuseTier: number }
  | { kind: "settlement"; period: string; outcomeBucket: number; primeLotCount: number };

export interface SeedAward {
  eventKey: string;
  amount: number;
}

/** Event descriptor -> the seed grant it earns. Pure — same event always yields the same key and amount. */
export function awardFor(event: AwardEvent): SeedAward {
  switch (event.kind) {
    case "entry":
      return { eventKey: `seed:entry:${event.entryId}`, amount: BALANCE.seedAwards.entry };
    case "build":
      return { eventKey: `seed:build:${event.buildingId}`, amount: BALANCE.seedAwards.build };
    case "nospend":
      return { eventKey: `seed:nospend:${event.date}`, amount: BALANCE.seedAwards.nospend };
    case "tier":
      return { eventKey: `seed:tier:${event.tier}`, amount: BALANCE.seedAwards.tier };
    case "fuse":
      return { eventKey: `seed:fuse:${event.buildingId}:${event.fuseTier}`, amount: BALANCE.seedAwards.fuse };
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
