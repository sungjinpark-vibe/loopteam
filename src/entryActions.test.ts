import { describe, expect, it } from "vitest";
import { applyNewEntry, resolveGrowChoice, type EntryDraft } from "./entryActions";
import type { Building, TownState } from "./types";

function freshTown(overrides: Partial<TownState> = {}): TownState {
  return {
    townName: "우리 동네",
    streakDays: 0,
    longestStreakDays: 0,
    lastActOn: null,
    slotsUsedOn: "",
    slotsUsedToday: 0,
    highestTierSeen: 0,
    queue: [],
    noSpendDays: [],
    cumulativeSavingsKrw: 0,
    lastSettledPeriod: null,
    ...overrides,
  };
}

const draft: EntryDraft = {
  type: "expense",
  amountKrw: 4_500,
  categoryId: "cafe",
  occurredOn: "2026-08-02",
};

// Shared args every call site fills in explicitly (project style already
// passes every balance dial explicitly, e.g. `dailyBuildSlots`) — this local
// helper only removes repetition across this file's tests, it isn't a
// production default.
function callArgs(overrides: Partial<Parameters<typeof applyNewEntry>[0]> = {}): Parameters<typeof applyNewEntry>[0] {
  return {
    town: freshTown(),
    buildings: [],
    draft,
    entryId: "e1",
    buildingId: "b1",
    createdAt: 1000,
    today: "2026-08-02",
    dailyBuildSlots: 5,
    materialQueueMax: 10,
    tierThresholds: [0, 10, 30, 80, 200],
    noSpendDayCostsSlot: true,
    variantIndex: 0,
    plotIndex: 0,
    w: 1,
    h: 1,
    ...overrides,
  };
}

describe("applyNewEntry — F2/F4 build", () => {
  it("places a building at the supplied plotIndex/footprint and consumes one slot when slots remain", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(callArgs({ town, entryId: "e1", buildingId: "b1", plotIndex: 42, w: 2, h: 1 }));

    expect(result.building).not.toBeNull();
    expect(result.building?.plotIndex).toBe(42);
    expect(result.building?.w).toBe(2);
    expect(result.building?.h).toBe(1);
    expect(result.building?.source).toEqual({ kind: "entry", entryId: "e1" });
    expect(result.entry.buildingId).toBe("b1");
    expect(result.town.slotsUsedToday).toBe(1);
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
    expect(result.queuedMaterial).toBeNull();
    expect(result.queueOverflow).toBe(false);
  });

  // RX1-N2 capacity (2026-08-13): the spacing rule caps the map near 81
  // buildings, so "no legal anchor left" is now reachable in about a week of
  // 10-slot days. `plotIndex: null` is how the caller says so.
  it("a full town (plotIndex null) QUEUES the entry — it never founds a building on a fallback cell", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(callArgs({ town, entryId: "e1", buildingId: "b1", plotIndex: null }));

    expect(result.building).toBeNull(); // nothing founded — the old `?? 0` built an invisible building on void cell 0
    expect(result.queuedMaterial).not.toBeNull();
    expect(result.entry.queued).toBe(true);
    expect(result.entry.buildingId).toBeNull();
    expect(result.queueOverflow).toBe(false); // kept, not lost
    expect(result.town.slotsUsedToday).toBe(0); // a queued entry burns no slot
  });

  it("a full town can still GROW an existing building — growing needs no plot", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const host: Building = {
      id: "host",
      source: { kind: "entry", entryId: "old" },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: 42,
      builtOn: "2026-08-01",
      createdAt: 1,
    };
    const result = applyNewEntry(callArgs({ town, entryId: "e2", buildingId: "b2", plotIndex: null, growTargetId: "host", buildings: [host] }));

    expect(result.grownBuilding?.id).toBe("host");
    expect(result.queuedMaterial).toBeNull();
  });

  it("amount never changes building count — a huge amount still places exactly one building", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(
      callArgs({ town, draft: { ...draft, amountKrw: 1_000_000 }, entryId: "e2", buildingId: "b2", createdAt: 2000, variantIndex: 1 }),
    );
    expect(result.building?.plotIndex).toBe(0);
  });

  it("resets the slot count when slotsUsedOn is stale (new day) — F4", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-01", slotsUsedToday: 5 });
    const result = applyNewEntry(callArgs({ town, entryId: "e4", buildingId: "b4", createdAt: 4000 }));
    expect(result.building).not.toBeNull();
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
    expect(result.town.slotsUsedToday).toBe(1);
  });

  it("advancing the date backward grants nothing (F4)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-05", slotsUsedToday: 5 });
    const result = applyNewEntry(callArgs({ town, entryId: "e4b", buildingId: "b4b", today: "2026-08-02" }));
    expect(result.building).toBeNull(); // no slot freed by travelling backward — falls to F14 queue instead
    expect(result.queuedMaterial).not.toBeNull();
  });

  it("saving entries never build, queue, or consume a slot (F13) — AC-F13-1/-2", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(
      callArgs({
        town,
        draft: { type: "saving", amountKrw: 50_000, categoryId: "goal", occurredOn: "2026-08-02" },
        entryId: "e5",
        buildingId: "b5",
        createdAt: 5000,
      }),
    );
    expect(result.building).toBeNull();
    expect(result.queuedMaterial).toBeNull();
    expect(result.queueOverflow).toBe(false);
    expect(result.celebrateTier).toBeNull();
    expect(result.entry.buildingId).toBeNull();
    // ADDENDUM-01 §5.2 break B2 — the branch necessarily returns a NEW town
    // object once it accumulates `savingsByCategoryKrw` (`toBe(town)` no
    // longer holds); AC-F13-1 is the stronger replacement: every OTHER field
    // stays byte-identical to its pre-save value.
    expect(result.town).not.toBe(town);
    expect(result.town).toEqual({
      ...town,
      cumulativeSavingsKrw: 50_000,
      savingsByCategoryKrw: { goal: 50_000 },
    });
  });

  it("buckets by savingsBucketOf(categoryId) — one bucket moves per save, the other four are byte-identical (AC-F13-5)", () => {
    const town = freshTown({ savingsByCategoryKrw: { goal: 10_000, emergency: 5_000 } });
    const result = applyNewEntry(
      callArgs({
        town,
        draft: { type: "saving", amountKrw: 20_000, categoryId: "deposit", occurredOn: "2026-08-02" },
        entryId: "e5b",
        buildingId: "b5b",
      }),
    );
    expect(result.town.savingsByCategoryKrw).toEqual({ goal: 10_000, emergency: 5_000, deposit: 20_000 });
    expect(result.town.cumulativeSavingsKrw).toBe(town.cumulativeSavingsKrw + 20_000);
  });

  it("legacy `invest` still accumulates via the alias (ADDENDUM-01 §4.5/D-24)", () => {
    const town = freshTown();
    const result = applyNewEntry(
      callArgs({
        town,
        // `categoryId` is typed `CategoryId` (no longer includes "invest"), but
        // stored/legacy data can still carry the string — `savingsBucketOf` is
        // total over `string`, not just the live union.
        draft: { type: "saving", amountKrw: 7_000, categoryId: "invest" as unknown as EntryDraft["categoryId"], occurredOn: "2026-08-02" },
        entryId: "e5c",
        buildingId: "b5c",
      }),
    );
    expect(result.town.savingsByCategoryKrw).toEqual({ stock: 7_000 });
  });

  // ADDENDUM-01 §2.1/AC-F13-3 — the sharpest regression test for F13's
  // invariant: a 저축 entry must still save, still grow its structure, even
  // when a 지출 entry in the exact same state would be refused/queued/overflowed.
  it("AC-F13-3: a 저축 entry still saves and never overflows, even with zero slots AND a full queue", () => {
    const fullQueue = Array.from({ length: 10 }, (_, i) => ({
      entryId: `q${i}`,
      categoryId: "cafe" as const,
      variantIndex: 0,
      queuedOn: "2026-08-02",
      entryYm: "2026-08",
    }));
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, queue: fullQueue });
    expect(fullQueue.length).toBe(10); // materialQueueMax used below

    const result = applyNewEntry(
      callArgs({
        town,
        draft: { type: "saving", amountKrw: 100_000, categoryId: "deposit", occurredOn: "2026-08-02" },
        entryId: "e7",
        buildingId: "b7",
        dailyBuildSlots: 5,
        materialQueueMax: 10,
      }),
    );
    expect(result.building).toBeNull();
    expect(result.queuedMaterial).toBeNull();
    expect(result.queueOverflow).toBe(false); // never the "대기열도 가득 찼어요" branch
    expect(result.town.queue).toBe(town.queue); // queue itself is untouched by a 저축 save
    expect(result.town.savingsByCategoryKrw).toEqual({ deposit: 100_000 });
  });
});

describe("applyNewEntry — F14 materials queue", () => {
  it("pushes to the queue (not overflow) when no slot remains and the queue has room", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5 });
    const result = applyNewEntry(callArgs({ town, entryId: "e6", buildingId: "b6", materialQueueMax: 10 }));
    expect(result.building).toBeNull();
    expect(result.queueOverflow).toBe(false);
    expect(result.queuedMaterial).toEqual({
      entryId: "e6",
      categoryId: "cafe",
      variantIndex: 0,
      amountKrw: 4_500, // ADDENDUM-04 §6 — captured at queue time (draft.amountKrw)
      queuedOn: "2026-08-02",
      entryYm: "2026-08",
    });
    expect(result.entry.queued).toBe(true);
    expect(result.entry.buildingId).toBeNull();
    expect(result.town.queue).toEqual([result.queuedMaterial]);
  });

  it("overflows past materialQueueMax — entry still recorded, no material, town.queue unchanged", () => {
    const queue = [{ entryId: "qe1", categoryId: "food" as const, variantIndex: 0, queuedOn: "2026-08-02", entryYm: "2026-08" }];
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, queue });
    const result = applyNewEntry(callArgs({ town, entryId: "e7", buildingId: "b7", materialQueueMax: 1 }));
    expect(result.building).toBeNull();
    expect(result.queuedMaterial).toBeNull();
    expect(result.queueOverflow).toBe(true);
    expect(result.entry.queued).toBe(false);
    expect(result.entry.buildingId).toBeNull();
    expect(result.town.queue).toBe(queue); // untouched
  });

  it("a queued entry counts as a streak act (F7) even though no building rises yet", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, lastActOn: "2026-08-01", streakDays: 3, longestStreakDays: 3 });
    const result = applyNewEntry(callArgs({ town, entryId: "e8", buildingId: "b8" }));
    expect(result.town.streakDays).toBe(4);
    expect(result.town.lastActOn).toBe("2026-08-02");
  });

  it("overflow is NOT a streak act", () => {
    const queue = [{ entryId: "qe1", categoryId: "food" as const, variantIndex: 0, queuedOn: "2026-08-02", entryYm: "2026-08" }];
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, queue, lastActOn: "2026-08-01", streakDays: 3, longestStreakDays: 3 });
    const result = applyNewEntry(callArgs({ town, entryId: "e9", buildingId: "b9", materialQueueMax: 1 }));
    expect(result.town.streakDays).toBe(3);
    expect(result.town.lastActOn).toBe("2026-08-01");
  });
});

describe("applyNewEntry — F5 tier celebration", () => {
  it("fires exactly once on a fresh upward crossing", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0, highestTierSeen: 0 });
    const buildings: Building[] = Array.from({ length: 9 }, (_, i) => ({
      id: `b${i}`,
      source: { kind: "entry", entryId: `e${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    // 9 existing + this save's 1 = 10, crossing tierThresholds[1] = 10.
    const result = applyNewEntry(callArgs({ town, buildings, entryId: "e10", buildingId: "b10" }));
    expect(result.celebrateTier).toBe(1);
    expect(result.town.highestTierSeen).toBe(1);
  });

  it("never re-fires for a threshold already seen", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0, highestTierSeen: 1 });
    const buildings: Building[] = Array.from({ length: 9 }, (_, i) => ({
      id: `b${i}`,
      source: { kind: "entry", entryId: `e${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    const result = applyNewEntry(callArgs({ town, buildings, entryId: "e10", buildingId: "b10" }));
    expect(result.celebrateTier).toBeNull(); // already-seen tier 1, still below tier 2 (30)
    expect(result.town.highestTierSeen).toBe(1);
  });

  it("does not fire while the material only queues (no building placed yet)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5, highestTierSeen: 0 });
    const buildings: Building[] = Array.from({ length: 9 }, (_, i) => ({
      id: `b${i}`,
      source: { kind: "entry", entryId: `e${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    const result = applyNewEntry(callArgs({ town, buildings, entryId: "e10", buildingId: "b10" }));
    expect(result.queuedMaterial).not.toBeNull();
    expect(result.celebrateTier).toBeNull();
    expect(result.town.highestTierSeen).toBe(0);
  });
});

describe("applyNewEntry — F15 revocation", () => {
  const nospendBuilding: Building = {
    id: "park1",
    source: { kind: "nospend", date: "2026-08-02" },
    categoryId: "park",
    variantIndex: 0,
    plotIndex: 3,
    builtOn: "2026-08-02",
    createdAt: 0,
  };

  it("revokes a claim for TODAY and refunds the slot, then builds the expense normally", () => {
    const town = freshTown({
      slotsUsedOn: "2026-08-02",
      slotsUsedToday: 1, // the 1 slot the claim itself spent
      noSpendDays: ["2026-08-02"],
    });
    const result = applyNewEntry(callArgs({ town, buildings: [nospendBuilding], entryId: "e11", buildingId: "b11" }));
    expect(result.revokedNoSpend).toEqual({ date: "2026-08-02", buildingId: "park1" });
    expect(result.town.noSpendDays).toEqual([]);
    // slot refunded (1 -> 0) then this entry's own build spends 1 again -> net 1, and it actually built.
    expect(result.building).not.toBeNull();
    expect(result.town.slotsUsedToday).toBe(1);
  });

  it("revokes a claim for a PAST date with no refund", () => {
    const town = freshTown({
      slotsUsedOn: "2026-08-01",
      slotsUsedToday: 5, // yesterday's count — irrelevant to today's refund decision
      noSpendDays: ["2026-08-01"],
    });
    const pastBuilding = { ...nospendBuilding, source: { kind: "nospend" as const, date: "2026-08-01" }, builtOn: "2026-08-01" };
    const result = applyNewEntry(
      callArgs({ town, buildings: [pastBuilding], entryId: "e12", buildingId: "b12", draft: { ...draft, occurredOn: "2026-08-01" } }),
    );
    expect(result.revokedNoSpend).toEqual({ date: "2026-08-01", buildingId: "park1" });
    expect(result.town.noSpendDays).toEqual([]);
    // No refund: today (2026-08-02) still starts fresh (slotsUsedOn stale -> full cap), builds normally.
    expect(result.building).not.toBeNull();
    expect(result.town.slotsUsedOn).toBe("2026-08-02");
    expect(result.town.slotsUsedToday).toBe(1);
  });

  // 사용자 지시 2026-08-13 "공원도 이월되게 해줘": a claim made while the town
  // was full has no park tile yet — it is a material sitting in F14's queue.
  // Revoking has to drop that too, or the next morning's drain builds a park
  // for a day that is no longer 무지출.
  it("revokes a claim whose park is still QUEUED, dropping the material and nothing else", () => {
    const town = freshTown({
      slotsUsedOn: "2026-08-02",
      slotsUsedToday: 0, // a deferred claim never spent a slot
      noSpendDays: ["2026-08-02"],
      queue: [
        { noSpendDate: "2026-08-02", categoryId: "park", variantIndex: 0, queuedOn: "2026-08-02" },
        { entryId: "e-other", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-02", entryYm: "2026-08" },
      ],
    });
    const result = applyNewEntry(callArgs({ town, buildings: [], entryId: "e14", buildingId: "b14" }));
    expect(result.revokedNoSpend).toEqual({ date: "2026-08-02", buildingId: null }); // no tile to remove — it was never built
    expect(result.town.noSpendDays).toEqual([]);
    expect(result.town.queue.map((m) => m.entryId)).toEqual(["e-other"]); // the park material is gone, the entry material untouched
  });

  it("does nothing when the date isn't claimed", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(callArgs({ town, entryId: "e13", buildingId: "b13" }));
    expect(result.revokedNoSpend).toBeNull();
  });

  // Round-2 finding C2 #1: a revoking save must count the true POST-revocation
  // building total, not `buildings.length` (which still includes today's park
  // — it is the caller's job to filter it out of storage, AFTER this
  // function already decided the tier). 8 real buildings + today's park = 9
  // passed in; revoking removes the park (-1) and this save's own expense
  // adds one back (+1) — true count stays 9, one below tierThresholds[1] (10).
  it("a revoking save does not celebrate a tier the true post-save count never reaches", () => {
    const realBuildings: Building[] = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      source: { kind: "entry", entryId: `re${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    const town = freshTown({
      slotsUsedOn: "2026-08-02",
      slotsUsedToday: 1, // the 1 slot the claim itself spent
      noSpendDays: ["2026-08-02"],
      highestTierSeen: 0,
    });
    const result = applyNewEntry(
      callArgs({ town, buildings: [...realBuildings, nospendBuilding], entryId: "e14", buildingId: "b14" }),
    );
    expect(result.revokedNoSpend).toEqual({ date: "2026-08-02", buildingId: "park1" });
    expect(result.building).not.toBeNull(); // the expense itself still builds
    expect(result.celebrateTier).toBeNull(); // true count is 9 (8 + revoked park removed + this build), not 10
    expect(result.town.highestTierSeen).toBe(0); // must stay 0 so the REAL 10th building later still celebrates
  });
});

describe("applyNewEntry — ADDENDUM-04 grow", () => {
  const host: Building = {
    id: "host1",
    source: { kind: "entry", entryId: "founding1" },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex: 2,
    builtOn: "2026-08-01",
    createdAt: 0,
  };
  const park: Building = {
    id: "park1",
    source: { kind: "nospend", date: "2026-08-02" },
    categoryId: "park",
    variantIndex: 0,
    plotIndex: 3,
    builtOn: "2026-08-02",
    createdAt: 0,
  };

  it("grows the host instead of building — no new Building, host exp +gain, entry.buildingId = host.id", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(
      callArgs({ town, buildings: [host], entryId: "e20", buildingId: "b20", growTargetId: "host1", expGain: 1 }),
    );
    expect(result.building).toBeNull();
    expect(result.grownBuilding).toEqual({ ...host, exp: 1 });
    expect(result.entry.buildingId).toBe("host1");
    expect(result.town.slotsUsedToday).toBe(1); // slot IS consumed
  });

  it("grow advances the streak exactly like a build (F7)", () => {
    const town = freshTown({
      slotsUsedOn: "2026-08-02",
      slotsUsedToday: 0,
      lastActOn: "2026-08-01",
      streakDays: 3,
      longestStreakDays: 3,
    });
    const result = applyNewEntry(
      callArgs({ town, buildings: [host], entryId: "e21", buildingId: "b21", growTargetId: "host1", expGain: 1 }),
    );
    expect(result.town.streakDays).toBe(4);
    expect(result.town.lastActOn).toBe("2026-08-02");
  });

  // Gate-3-rerun fix: tier tracks the literal building count now (see
  // `entryActions.ts`'s `buildingCountBeforeThis` doc), so a build crosses a
  // threshold a grow of the SAME 9 pre-existing buildings never does — a
  // grow places no new building, the count `TownHeader` shows never moves.
  it("a new build crosses the tier; a grow of the same town does not, because the count never moves", () => {
    const nineNoExp: Building[] = Array.from({ length: 9 }, (_, i) => ({
      id: `b${i}`,
      source: { kind: "entry", entryId: `e${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0, highestTierSeen: 0 });

    const built = applyNewEntry(callArgs({ town, buildings: nineNoExp, entryId: "eb", buildingId: "bb" }));
    expect(built.celebrateTier).toBe(1); // 9 + 1 (new building) = 10 -> tierThresholds[1]

    const grown = applyNewEntry(
      callArgs({ town, buildings: nineNoExp, entryId: "eg", buildingId: "bg", growTargetId: nineNoExp[0].id, expGain: 1 }),
    );
    expect(grown.celebrateTier).toBeNull(); // still 9 buildings — no new plot, no tier
  });

  it("no free slot: a growTargetId still queues — grow is never a free bypass of the F4 daily cap", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 5 });
    const result = applyNewEntry(
      callArgs({
        town,
        buildings: [host],
        entryId: "e22",
        buildingId: "b22",
        dailyBuildSlots: 5,
        growTargetId: "host1",
        expGain: 1,
      }),
    );
    expect(result.grownBuilding).toBeNull();
    expect(result.building).toBeNull();
    expect(result.queuedMaterial).not.toBeNull();
    expect(result.entry.queued).toBe(true);
  });

  it("a bogus growTargetId falls back to a normal build — the entry is never lost", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(
      callArgs({ town, buildings: [host], entryId: "e23", buildingId: "b23", growTargetId: "does-not-exist", expGain: 1 }),
    );
    expect(result.grownBuilding).toBeNull();
    expect(result.building).not.toBeNull();
    expect(result.building?.id).toBe("b23");
    expect(result.entry.buildingId).toBe("b23");
  });

  it("a growTargetId naming a park tile (not entry-founded) falls back to a normal build", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(
      callArgs({ town, buildings: [park], entryId: "e24", buildingId: "b24", growTargetId: "park1", expGain: 1 }),
    );
    expect(result.grownBuilding).toBeNull();
    expect(result.building).not.toBeNull();
  });
});

describe("applyNewEntry — ADDENDUM-04 §7 founding parity (expGain > 1)", () => {
  it("expGain 1 (flat, or dial off) omits `exp` entirely — byte-identical to a pre-dial founding", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(callArgs({ town, entryId: "e30", buildingId: "b30", expGain: 1 }));
    expect(result.building).not.toHaveProperty("exp");
  });

  // Gate-3-rerun fix: founding exp is the FULL gain now, not `gain - 1` (see
  // `entryActions.ts`'s doc on the new `Building` construction) — the `-1`
  // used to hide the amount from `levelOf`, which produced the exact
  // "1,500원 and 150,000원 both show Lv.1" flatness every expert flagged.
  it("expGain > 1 founds a building with exp = expGain (full amount, not amount - 1)", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0 });
    const result = applyNewEntry(callArgs({ town, entryId: "e31", buildingId: "b31", expGain: 5 }));
    expect(result.building?.exp).toBe(5);
  });

  // §7's exp parity is now exact, not offset by one: founding and growing
  // with the same `expGain` leave the SAME total exp on the affected
  // building (which drives its own visual Lv./size). §3's tier parity claim
  // doesn't survive the Gate-3-rerun fix, though: exp no longer feeds tier
  // at all, only the literal count does, so founding (a new plot) crosses a
  // threshold a grow (no new plot) never does regardless of expGain.
  it("exp parity holds for level; tier now only ever moves on an actual new building", () => {
    const nineNoExp: Building[] = Array.from({ length: 9 }, (_, i) => ({
      id: `q${i}`,
      source: { kind: "entry", entryId: `qe${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: i,
      builtOn: "2026-08-01",
      createdAt: 0,
    }));
    const town = freshTown({ slotsUsedOn: "2026-08-02", slotsUsedToday: 0, highestTierSeen: 0 });

    const founded = applyNewEntry(callArgs({ town, buildings: nineNoExp, entryId: "ef", buildingId: "bf", expGain: 3 }));
    expect(founded.building?.exp).toBe(3); // full gain, same exp a grow of gain 3 would add
    expect(founded.celebrateTier).toBe(1); // 9 + 1 (one new building, regardless of expGain) = 10 -> tierThresholds[1]

    const grown = applyNewEntry(
      callArgs({ town, buildings: nineNoExp, entryId: "eg3", buildingId: "bg3", growTargetId: nineNoExp[0].id, expGain: 3 }),
    );
    expect(grown.grownBuilding?.exp).toBe(3);
    expect(grown.celebrateTier).toBeNull(); // still 9 buildings — no new plot, no tier, regardless of expGain
  });
});

// ── ADDENDUM-04 §4 deferred grow choice (data-loss fix) ────────────────────
//
// `deferGrowChoice` is what makes 저장 durable while the 새로짓기/키우기 dialog
// is up: the entry, the slot and the streak commit immediately and ONLY the
// building effect waits on `town.pendingGrowChoice`.
describe("applyNewEntry — deferGrowChoice", () => {
  it("saves the entry, spends the slot and advances the streak, but builds nothing yet", () => {
    const result = applyNewEntry(callArgs({ deferGrowChoice: true }));

    expect(result.entry.id).toBe("e1");
    expect(result.entry.buildingId).toBeNull();
    expect(result.entry.queued).toBe(false); // NOT on F14's queue — drainQueue must never touch it
    expect(result.building).toBeNull();
    expect(result.grownBuilding).toBeNull();
    expect(result.queuedMaterial).toBeNull();
    expect(result.town.slotsUsedToday).toBe(1);
    expect(result.town.lastActOn).toBe("2026-08-02");
    expect(result.pendingGrowChoice).toEqual({ entryId: "e1", entryYm: "2026-08", categoryId: "cafe", expGain: 1 });
    expect(result.town.pendingGrowChoice).toEqual(result.pendingGrowChoice);
    // The tier check is NOT run here — both branches score differently, and
    // `highestTierSeen` only ever increases.
    expect(result.celebrateTier).toBeNull();
    expect(result.town.highestTierSeen).toBe(0);
  });

  // Gate-3-rerun fix (panel's unanimous top finding): growing needs no cell,
  // so a full town (`plotIndex: null`) must still open the choice instead of
  // silently queuing — 키우기 was reachable the whole time, the old gate just
  // never offered it. `resolveGrowChoice`'s own full-town fallback (queues
  // gracefully when the player answers 새로 짓기 instead) is what makes this
  // safe: the choice is never presented for an outcome the app cannot honour.
  it("still offers the choice when the town is full — growing needs no cell, so a full town must not skip it", () => {
    const result = applyNewEntry(callArgs({ deferGrowChoice: true, plotIndex: null }));

    expect(result.pendingGrowChoice).toEqual({ entryId: "e1", entryYm: "2026-08", categoryId: "cafe", expGain: 1 });
    expect(result.town.pendingGrowChoice).toEqual(result.pendingGrowChoice);
    expect(result.queuedMaterial).toBeNull();
    expect(result.entry.queued).toBe(false);
  });
});

describe("resolveGrowChoice — the deferred half", () => {
  const pendingTown = (overrides: Partial<TownState> = {}): TownState =>
    freshTown({
      slotsUsedOn: "2026-08-02",
      slotsUsedToday: 1,
      pendingGrowChoice: { entryId: "e1", entryYm: "2026-08", categoryId: "cafe", expGain: 3 },
      ...overrides,
    });

  const savedEntry = {
    id: "e1",
    type: "expense" as const,
    amountKrw: 4_500,
    categoryId: "cafe" as const,
    occurredOn: "2026-08-02",
    createdAt: 1000,
    updatedAt: 1000,
    buildingId: null,
    queued: false,
  };

  const host: Building = {
    id: "host",
    source: { kind: "entry", entryId: "e0" },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex: 5,
    builtOn: "2026-07-10",
    createdAt: 10,
    exp: 2,
  };

  function resolveArgs(overrides: Partial<Parameters<typeof resolveGrowChoice>[0]> = {}): Parameters<typeof resolveGrowChoice>[0] {
    return {
      town: pendingTown(),
      buildings: [host],
      entry: savedEntry,
      buildingId: "b9",
      variantIndex: 0,
      createdAt: 2000,
      today: "2026-08-02",
      tierThresholds: [0, 10, 30, 80, 200],
      materialQueueMax: 10,
      plotIndex: 7,
      w: 1,
      h: 1,
      ...overrides,
    };
  }

  it("새로 짓기: founds the building, points the saved entry at it, clears the marker", () => {
    const result = resolveGrowChoice(resolveArgs())!;

    expect(result.building?.id).toBe("b9");
    expect(result.building?.plotIndex).toBe(7);
    expect(result.building?.exp).toBe(3);
    expect(result.building?.source).toEqual({ kind: "entry", entryId: "e1" });
    expect(result.entry.buildingId).toBe("b9");
    expect(result.town.pendingGrowChoice).toBeUndefined();
    // The slot was spent at 저장 time and must NOT be charged a second time.
    expect(result.town.slotsUsedToday).toBe(1);
  });

  it("키우기: adds the exp to the named host, builds nothing, charges no second slot", () => {
    const result = resolveGrowChoice(resolveArgs({ growTargetId: "host" }))!;

    expect(result.building).toBeNull();
    expect(result.grownBuilding?.id).toBe("host");
    expect(result.grownBuilding?.exp).toBe(5); // 2 + expGain 3
    expect(result.entry.buildingId).toBe("host");
    expect(result.town.pendingGrowChoice).toBeUndefined();
    expect(result.town.slotsUsedToday).toBe(1);
  });

  it("a stale growTargetId falls back to 새로 짓기 rather than dropping the choice", () => {
    const result = resolveGrowChoice(resolveArgs({ growTargetId: "deleted" }))!;

    expect(result.building?.id).toBe("b9");
    expect(result.grownBuilding).toBeNull();
    expect(result.town.pendingGrowChoice).toBeUndefined();
  });

  it("a town that filled up between 저장 and the answer defers the building onto F14's queue", () => {
    const result = resolveGrowChoice(resolveArgs({ plotIndex: null }))!;

    expect(result.building).toBeNull();
    expect(result.queuedMaterial?.entryId).toBe("e1");
    expect(result.entry.queued).toBe(true);
    expect(result.town.queue).toHaveLength(1);
    expect(result.town.pendingGrowChoice).toBeUndefined();
  });

  it("returns null when there is nothing pending, or when the marker outlived its entry", () => {
    expect(resolveGrowChoice(resolveArgs({ town: freshTown() }))).toBeNull();
    expect(resolveGrowChoice(resolveArgs({ entry: undefined }))).toBeNull();
  });
});
