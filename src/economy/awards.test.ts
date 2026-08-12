import { describe, expect, it } from "vitest";
import { BALANCE } from "../balance.approved";
import { applyAward, awardFor, type AwardEvent } from "./awards";
import { defaultEconomyState } from "./types";

describe("awardFor", () => {
  // B4 — the entry award is what makes the shop reachable by logging; the
  // build award below only ever fired for an entry that FOUNDED a building.
  it("keys an entry award by entry id, amount from the balance dial", () => {
    expect(awardFor({ kind: "entry", entryId: "e1" })).toEqual({
      eventKey: "seed:entry:e1",
      amount: BALANCE.seedAwards.entry,
    });
    expect(BALANCE.seedAwards.entry).toBeGreaterThan(0);
  });

  it("keys a build award by building id, amount from the balance dial", () => {
    expect(awardFor({ kind: "build", buildingId: "b1" })).toEqual({
      eventKey: "seed:build:b1",
      amount: BALANCE.seedAwards.build,
    });
  });

  it("keys a no-spend award by date, larger than a build (§F-ECON table)", () => {
    const award = awardFor({ kind: "nospend", date: "2026-08-10" });
    expect(award).toEqual({ eventKey: "seed:nospend:2026-08-10", amount: BALANCE.seedAwards.nospend });
    expect(award.amount).toBeGreaterThan(BALANCE.seedAwards.build);
  });

  it("keys a tier award by the tier number", () => {
    expect(awardFor({ kind: "tier", tier: 2 })).toEqual({ eventKey: "seed:tier:2", amount: BALANCE.seedAwards.tier });
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
    const event: AwardEvent = { kind: "build", buildingId: "b1" };
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
});
