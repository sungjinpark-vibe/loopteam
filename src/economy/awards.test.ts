import { describe, expect, it } from "vitest";
import { BALANCE } from "../balance.approved";
import { applyAward, awardFor, revokeAward, settleAward, type AwardEvent } from "./awards";
import { defaultEconomyState } from "./types";

describe("awardFor", () => {
  // B4 — the entry award is what makes the shop reachable by logging; the
  // build award below only ever fired for an entry that FOUNDED a building.
  // Gate-3 round-5 — both are now tiered by `expGain` (`awards.ts`'s
  // `seedsForExpTier`), indexed the same way `expAmountTiers` rungs map to
  // exp: rung index = expGain / expPerLevel.
  it("keys an entry award by entry id, amount from the tiered balance dial", () => {
    expect(awardFor({ kind: "entry", entryId: "e1", expGain: 0 })).toEqual({
      eventKey: "seed:entry:e1",
      amount: BALANCE.seedAwards.entry[0],
    });
    expect(awardFor({ kind: "entry", entryId: "e1", expGain: 12 })).toEqual({
      eventKey: "seed:entry:e1",
      amount: BALANCE.seedAwards.entry[4],
    });
    expect(BALANCE.seedAwards.entry.every((n) => n > 0)).toBe(true);
    // A bigger entry is never worth fewer seeds than a smaller one.
    expect(awardFor({ kind: "entry", entryId: "e1", expGain: 12 }).amount).toBeGreaterThan(
      awardFor({ kind: "entry", entryId: "e1", expGain: 0 }).amount,
    );
  });

  it("keys a build award by building id, amount from the tiered balance dial", () => {
    expect(awardFor({ kind: "build", buildingId: "b1", expGain: 0 })).toEqual({
      eventKey: "seed:build:b1",
      amount: BALANCE.seedAwards.build[0],
    });
  });

  it("clamps an out-of-range expGain onto the nearest real rung instead of throwing", () => {
    expect(awardFor({ kind: "entry", entryId: "e1", expGain: -5 }).amount).toBe(BALANCE.seedAwards.entry[0]);
    expect(awardFor({ kind: "entry", entryId: "e1", expGain: 999 }).amount).toBe(BALANCE.seedAwards.entry[4]);
  });

  it("keys a no-spend award by date, larger than a NORMAL build (§F-ECON table)", () => {
    const award = awardFor({ kind: "nospend", date: "2026-08-10" });
    expect(award).toEqual({ eventKey: "seed:nospend:2026-08-10", amount: BALANCE.seedAwards.nospend });
    // Rung 1 (5,000-20,000원) is the dial that kept the old flat build value —
    // the "biggest bonus dial" comparison this test always meant.
    expect(award.amount).toBeGreaterThan(BALANCE.seedAwards.build[1]);
  });

  it("keys a tier award by the tier number", () => {
    expect(awardFor({ kind: "tier", tier: 2 })).toEqual({ eventKey: "seed:tier:2", amount: BALANCE.seedAwards.tier });
  });

  // Gate-3-rerun fix — liveops-pd's TOP FIX: the streak counter paid nothing.
  it("keys a streak award by date, amount scales with streak length", () => {
    expect(awardFor({ kind: "streak", date: "2026-08-10", streakDays: 1 })).toEqual({
      eventKey: "seed:streak:2026-08-10",
      amount: 2,
    });
    expect(awardFor({ kind: "streak", date: "2026-08-10", streakDays: 3 }).amount).toBe(6);
  });

  it("caps the streak award so a very long streak doesn't dwarf every other award", () => {
    expect(awardFor({ kind: "streak", date: "2026-08-10", streakDays: 999 }).amount).toBe(20);
  });

  it("keys a settlement award by period, scaled by outcomeBucket", () => {
    expect(awardFor({ kind: "settlement", period: "2026-07", outcomeBucket: 1, primeLotCount: 0 })).toEqual({
      eventKey: "seed:settlement:2026-07",
      amount: BALANCE.seedAwards.settlementByOutcomeBucket[1],
    });
  });

  it("a settlement with outcomeBucket 0 (no data) earns nothing when no prime lots are held", () => {
    expect(awardFor({ kind: "settlement", period: "2026-07", outcomeBucket: 0, primeLotCount: 0 }).amount).toBe(0);
  });

  // ADDENDUM-06 §3.2 / AC-11 — 명당 (prime lot) standing bonus.
  it("adds primeLot * count to the settlement amount, same eventKey", () => {
    const award = awardFor({ kind: "settlement", period: "2026-07", outcomeBucket: 1, primeLotCount: 4 });
    expect(award.eventKey).toBe("seed:settlement:2026-07");
    expect(award.amount).toBe(BALANCE.seedAwards.settlementByOutcomeBucket[1] + 4 * BALANCE.seedAwards.primeLot);
  });

  it("caps the prime-lot bonus at primeLotMax for a very large count", () => {
    const award = awardFor({ kind: "settlement", period: "2026-07", outcomeBucket: 1, primeLotCount: 999 });
    expect(award.amount).toBe(BALANCE.seedAwards.settlementByOutcomeBucket[1] + BALANCE.seedAwards.primeLotMax);
  });

  it("a negative primeLotCount contributes nothing (clamped to 0)", () => {
    const award = awardFor({ kind: "settlement", period: "2026-07", outcomeBucket: 1, primeLotCount: -3 });
    expect(award.amount).toBe(BALANCE.seedAwards.settlementByOutcomeBucket[1]);
  });

  it("the same event always produces the same key (idempotency contract)", () => {
    const event: AwardEvent = { kind: "build", buildingId: "b1", expGain: 6 };
    expect(awardFor(event).eventKey).toBe(awardFor(event).eventKey);
  });
});

describe("applyAward", () => {
  it("adds the amount and records the key", () => {
    const economy = defaultEconomyState();
    const next = applyAward(economy, { eventKey: "seed:build:b1", amount: 3 });
    expect(next.seeds).toBe(3);
    expect(next.grantedEventKeys).toEqual(["seed:build:b1"]);
  });

  it("refuses to pay a key already granted — same reference returned", () => {
    const granted = { ...defaultEconomyState(), grantedEventKeys: ["seed:build:b1"] };
    const next = applyAward(granted, { eventKey: "seed:build:b1", amount: 3 });
    expect(next).toBe(granted);
    expect(next.seeds).toBe(0);
  });

  it("a zero-amount award is a no-op — same reference returned", () => {
    const economy = defaultEconomyState();
    const next = applyAward(economy, { eventKey: "seed:settlement:2026-07", amount: 0 });
    expect(next).toBe(economy);
  });

  // ADDENDUM-06 §3.2 / AC-12 — settlement stays idempotent with the prime-lot bonus folded in.
  it("a settlement award with a prime-lot bonus is credited once even if the award path runs twice", () => {
    const economy = defaultEconomyState();
    const event = { kind: "settlement" as const, period: "2026-07", outcomeBucket: 1, primeLotCount: 4 };
    const once = applyAward(economy, awardFor(event));
    const twice = applyAward(once, awardFor(event));
    expect(twice).toBe(once); // same reference — second call was a no-op
    expect(twice.seeds).toBe(BALANCE.seedAwards.settlementByOutcomeBucket[1] + 4 * BALANCE.seedAwards.primeLot);
    expect(twice.grantedEventKeys).toEqual(["seed:settlement:2026-07"]); // key unchanged, recorded once
  });

  it("bounds grantedEventKeys at the ring-buffer cap", () => {
    let economy = defaultEconomyState();
    for (let i = 0; i < 70; i++) {
      economy = applyAward(economy, { eventKey: `seed:build:b${i}`, amount: 1 });
    }
    expect(economy.grantedEventKeys.length).toBe(64);
    expect(economy.grantedEventKeys[economy.grantedEventKeys.length - 1]).toBe("seed:build:b69");
    expect(economy.seeds).toBe(70); // seeds themselves are never reclaimed when a key ages out of the ring
  });

  // ADDENDUM-12 §3.3 — a fresh grant pays down any outstanding seedDebt first.
  it("pays down seedDebt before crediting seeds", () => {
    const economy = { ...defaultEconomyState(), seeds: 0, seedDebt: 5 } as ReturnType<typeof defaultEconomyState>;
    const next = applyAward(economy, { eventKey: "seed:entry:e1", amount: 8 });
    expect(next.seedDebt).toBe(0);
    expect(next.seeds).toBe(3); // 8 - 5 debt = 3 remainder
  });

  it("a grant smaller than the debt pays it down partially, leaves seeds at 0", () => {
    const economy = { ...defaultEconomyState(), seeds: 0, seedDebt: 10 };
    const next = applyAward(economy, { eventKey: "seed:entry:e1", amount: 4 });
    expect(next.seedDebt).toBe(6);
    expect(next.seeds).toBe(0);
  });
});

describe("revokeAward — ADDENDUM-12 §3.1", () => {
  it("subtracts the granted amount and drops the key", () => {
    const economy = { ...defaultEconomyState(), seeds: 10, grantedEventKeys: ["seed:entry:e1"] };
    const next = revokeAward(economy, { eventKey: "seed:entry:e1", amount: 4 });
    expect(next.seeds).toBe(6);
    expect(next.grantedEventKeys).toEqual([]);
    expect(next.seedDebt ?? 0).toBe(0);
  });

  it("floors at 0 and carries the shortfall into seedDebt when the balance can't cover it", () => {
    const economy = { ...defaultEconomyState(), seeds: 2, grantedEventKeys: ["seed:entry:e1"] };
    const next = revokeAward(economy, { eventKey: "seed:entry:e1", amount: 6 });
    expect(next.seeds).toBe(0);
    expect(next.seedDebt).toBe(4);
    expect(next.grantedEventKeys).toEqual([]);
  });

  it("is a no-op (same reference) when the key was never granted", () => {
    const economy = { ...defaultEconomyState(), seeds: 10, grantedEventKeys: [] };
    expect(revokeAward(economy, { eventKey: "seed:entry:e1", amount: 4 })).toBe(economy);
  });

  it("is a no-op when the award amount is non-positive", () => {
    const economy = { ...defaultEconomyState(), seeds: 10, grantedEventKeys: ["seed:entry:e1"] };
    expect(revokeAward(economy, { eventKey: "seed:entry:e1", amount: 0 })).toBe(economy);
  });
});

describe("settleAward — ADDENDUM-12 §3.2", () => {
  it("credits the upward delta without touching the granted key (bypasses applyAward's idempotency check)", () => {
    const economy = { ...defaultEconomyState(), seeds: 10, grantedEventKeys: ["seed:entry:e1"] };
    const next = settleAward(economy, { eventKey: "seed:entry:e1", amount: 4 }, { eventKey: "seed:entry:e1", amount: 10 });
    expect(next.seeds).toBe(16); // +6 delta
    expect(next.grantedEventKeys).toEqual(["seed:entry:e1"]); // key untouched
  });

  it("pays down seedDebt first on an upward delta", () => {
    const economy = { ...defaultEconomyState(), seeds: 0, seedDebt: 3, grantedEventKeys: ["seed:entry:e1"] };
    const next = settleAward(economy, { eventKey: "seed:entry:e1", amount: 4 }, { eventKey: "seed:entry:e1", amount: 10 });
    expect(next.seedDebt).toBe(0);
    expect(next.seeds).toBe(3); // 6 delta - 3 debt
  });

  it("revokes the downward delta, flooring at 0 and carrying the shortfall to seedDebt", () => {
    const economy = { ...defaultEconomyState(), seeds: 2, grantedEventKeys: ["seed:entry:e1"] };
    const next = settleAward(economy, { eventKey: "seed:entry:e1", amount: 10 }, { eventKey: "seed:entry:e1", amount: 4 });
    expect(next.seeds).toBe(0);
    expect(next.seedDebt).toBe(4); // wanted to pull 6, only had 2
    expect(next.grantedEventKeys).toEqual(["seed:entry:e1"]); // key stays (still granted, just a different amount)
  });

  it("is a no-op (same reference) on a same-rung edit (zero delta)", () => {
    const economy = { ...defaultEconomyState(), seeds: 10, grantedEventKeys: ["seed:entry:e1"] };
    expect(settleAward(economy, { eventKey: "seed:entry:e1", amount: 4 }, { eventKey: "seed:entry:e1", amount: 4 })).toBe(economy);
  });

  it("is a no-op when the key was never granted", () => {
    const economy = { ...defaultEconomyState(), seeds: 10, grantedEventKeys: [] };
    expect(settleAward(economy, { eventKey: "seed:entry:e1", amount: 4 }, { eventKey: "seed:entry:e1", amount: 10 })).toBe(economy);
  });

  it("is a no-op when the two awards don't share a key", () => {
    const economy = { ...defaultEconomyState(), seeds: 10, grantedEventKeys: ["seed:entry:e1"] };
    expect(settleAward(economy, { eventKey: "seed:entry:e1", amount: 4 }, { eventKey: "seed:entry:e2", amount: 10 })).toBe(economy);
  });
});
