/**
 * F-ECON economy state — PM-DECISIONS §F-ECON / ADDENDUM-05 (2026-08-10).
 *
 * 씨앗 (seeds) is a game-side count, never a KRW amount — see `format.ts`'s
 * rule R-7 for the display-side half of that separation. This file only
 * defines the persisted shape; storage wiring lives in `../storage.ts`
 * (`ait.v1.economy`), earning lives in `awards.ts`, spending/mutation lives
 * in `../useTownStore.ts`.
 */

/**
 * Branded so a raw `number` (a KRW amount, an index, anything) can never
 * silently stand in for a seed balance — the whole point of the currency
 * split (PM-DECISIONS §F-ECON). Construct only via `seeds()` below.
 */
export type SeedCount = number & { readonly __seeds: unique symbol };

/** Validates and brands a seed amount — a seed balance is a count, so non-integers and negatives are a programmer error, not a value to clamp silently. */
export function seeds(n: number): SeedCount {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`seeds(): expected a non-negative integer, got ${n}`);
  }
  return n as SeedCount;
}

// ponytail: render-perf ceiling, not a game rule — F-NPC's count formula is
// `1 + buildings.length + purchasedNpcSlots`, uncapped that would try to
// render one sprite per building (the dense fixture alone is ~5,400). Raise
// this only once `NpcLayer` is proven to hold a steady frame budget above 12
// concurrent sprites.
export const NPC_MAX_VISIBLE = 12;

// Bounds `EconomyState.grantedEventKeys` so a long-lived town's idempotency
// ledger cannot grow forever — a ring buffer (oldest key drops first once
// full), not a full history. A key that ages out of the ring becomes
// re-grantable if the exact same event were ever replayed; 64 is well above
// any realistic in-flight window (build/no-spend/tier/settlement events are
// each granted once, at the moment they happen, never re-checked later).
export const GRANTED_EVENT_KEYS_CAP = 64;

export interface EconomyState {
  seeds: SeedCount;
  /** Permanent — deleting a building/town-skin selection never revokes a purchase (PM-DECISIONS §F-ECON, ADDENDUM-03 DE-9 rule 4). */
  ownedSkus: string[];
  /** Currently-applied 마을 꾸미기 SKU, or none. Must be a member of `ownedSkus` (enforced at the store, not here — this file has no invariants beyond shape). */
  appliedTownSku: string | null;
  /** buildingId -> applied 건물 꾸미기 SKU. */
  appliedByBuildingId: Record<string, string>;
  /** Extra NPC slots purchased in the shop's NPC section — feeds `npcCount`'s formula. */
  purchasedNpcSlots: number;
  /** Idempotency ledger for `awards.ts` grants — see `GRANTED_EVENT_KEYS_CAP` above. */
  grantedEventKeys: string[];
}

export function defaultEconomyState(): EconomyState {
  return {
    seeds: seeds(0),
    ownedSkus: [],
    appliedTownSku: null,
    appliedByBuildingId: {},
    purchasedNpcSlots: 0,
    grantedEventKeys: [],
  };
}
