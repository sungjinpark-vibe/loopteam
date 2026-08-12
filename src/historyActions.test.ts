import { describe, expect, it } from "vitest";
import { buildingForEntry, deleteEntryEffects, editEntryEffects } from "./historyActions";
import type { Building, LedgerEntry, QueuedMaterial, TownState } from "./types";

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

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: "e1",
    type: "expense",
    amountKrw: 4_500,
    categoryId: "cafe",
    occurredOn: "2026-08-15",
    createdAt: 1000,
    updatedAt: 1000,
    buildingId: "b1",
    queued: false,
    ...overrides,
  };
}

function building(overrides: Partial<Building> = {}): Building {
  return {
    id: "b1",
    source: { kind: "entry", entryId: "e1" },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex: 3,
    builtOn: "2026-08-15",
    createdAt: 1000,
    ...overrides,
  };
}

const tierThresholds = [0, 10, 30, 80, 200];
// ADDENDUM-04 §7 default (BALANCE.expAmountTiers) — flat 1 EXP/act; the
// amount-tiered case is exercised separately below.
const expAmountTiers = null;
// The director-confirmed table (BALANCE.expAmountTiers, 2026-08-09) — used by
// the amount-edit parity tests below, where a flat table would never move exp.
const tieredExpAmountTiers: readonly (readonly [number, number])[] = [
  [10_000, 1],
  [50_000, 2],
  [200_000, 3],
  [Infinity, 5],
];

describe("buildingForEntry", () => {
  it("finds the one building whose source.entryId matches, ignoring nospend/monument buildings", () => {
    const b = building();
    const other: Building = { ...building({ id: "park" }), source: { kind: "nospend", date: "2026-08-15" } };
    expect(buildingForEntry([other, b], "e1")).toBe(b);
    expect(buildingForEntry([other], "e1")).toBeUndefined();
  });
});

describe("deleteEntryEffects — F9", () => {
  it("removes the bound building, leaves other buildings/slots untouched", () => {
    const b = building();
    const survivor = building({ id: "b2", plotIndex: 7, source: { kind: "entry", entryId: "e2" } });
    const town = freshTown({ slotsUsedOn: "2026-08-15", slotsUsedToday: 2 });
    const result = deleteEntryEffects({ town, buildings: [b, survivor], entry: entry(), expAmountTiers });
    expect(result.buildings).toEqual([survivor]);
    expect(result.removedBuilding).toEqual({ id: "b1", ym: "2026-08" });
    expect(result.town.slotsUsedToday).toBe(2); // not refunded
  });

  it("drops a QUEUED entry's material from town.queue (round-4 finding C2 — no ghost building on the next drain)", () => {
    const queue: QueuedMaterial[] = [
      { entryId: "e1", categoryId: "cafe", variantIndex: 0, queuedOn: "2026-08-15", entryYm: "2026-08" },
      { entryId: "e2", categoryId: "food", variantIndex: 1, queuedOn: "2026-08-15", entryYm: "2026-08" },
    ];
    const town = freshTown({ queue });
    const queuedEntry = entry({ buildingId: null, queued: true });
    const result = deleteEntryEffects({ town, buildings: [], entry: queuedEntry, expAmountTiers });
    expect(result.town.queue.map((m) => m.entryId)).toEqual(["e2"]);
    expect(result.removedBuilding).toBeNull(); // never built yet
  });

  it("deleting a 저축 entry backs its amount out of the tower total, floored at 0", () => {
    const town = freshTown({ cumulativeSavingsKrw: 5_000, savingsByCategoryKrw: { goal: 5_000 } });
    const savingEntry = entry({ type: "saving", categoryId: "goal", amountKrw: 50_000, buildingId: null });
    const result = deleteEntryEffects({ town, buildings: [], entry: savingEntry, expAmountTiers });
    expect(result.town.cumulativeSavingsKrw).toBe(0);
    expect(result.town.savingsByCategoryKrw).toEqual({ goal: 0 });
  });
});

function editArgs(overrides: Partial<Parameters<typeof editEntryEffects>[0]> = {}): Parameters<typeof editEntryEffects>[0] {
  return {
    town: freshTown({ slotsUsedOn: "2026-08-15", slotsUsedToday: 1 }),
    buildings: [building()],
    entry: entry(),
    patch: {},
    today: "2026-08-15",
    dailyBuildSlots: 5,
    materialQueueMax: 10,
    tierThresholds,
    newBuildingId: "bnew",
    variantIndex: 0,
    plotIndex: 9,
    w: 1,
    h: 1,
    now: 2000,
    expAmountTiers,
    ...overrides,
  };
}

describe("editEntryEffects — F9, type unchanged", () => {
  it("amount/memo/date edits never move the building", () => {
    const result = editEntryEffects(editArgs({ patch: { amountKrw: 9_900, memo: "x" } }));
    expect(result.buildings).toEqual([building()]);
    expect(result.newBuilding).toBeNull();
    expect(result.removedBuilding).toBeNull();
    expect(result.entry.amountKrw).toBe(9_900);
  });

  it("a category edit re-skins the building in place, keeping the same plot", () => {
    const result = editEntryEffects(editArgs({ patch: { categoryId: "food" } }));
    expect(result.buildings[0].categoryId).toBe("food");
    expect(result.buildings[0].plotIndex).toBe(3);
    expect(result.buildings[0].builtOn).toBe("2026-08-15");
  });

  // ADDENDUM-04 §6/§7 — with the amount dial on, editing a FOUNDING entry's
  // amount must re-derive its building's founding exp component (gain - 1)
  // and leave any contributor exp already on the host untouched.
  it("an amount edit on a founding entry adjusts the host by (newGain-1)-(oldGain-1), leaving contributor exp untouched", () => {
    // amountKrw 4_500 -> gain 1 under tieredExpAmountTiers, so this host's
    // exp of 5 is entirely from OTHER entries' grow contributions.
    const hostWithContributorExp = building({ exp: 5 });
    const result = editEntryEffects(
      editArgs({ buildings: [hostWithContributorExp], patch: { amountKrw: 60_000 }, expAmountTiers: tieredExpAmountTiers }),
    );
    // new gain 3 (60_000 falls in the [50_000, 200_000) tier) - old gain 1 = +2
    expect(result.buildings[0].exp).toBe(7);
    expect(result.entry.amountKrw).toBe(60_000);
  });

  it("an amount edit under a flat table (dial off) never touches exp", () => {
    const result = editEntryEffects(editArgs({ buildings: [building({ exp: 5 })], patch: { amountKrw: 60_000 } }));
    expect(result.buildings[0].exp).toBe(5);
  });

  it("a category edit on a still-QUEUED entry patches the queue material instead of a building (round-4 finding C2)", () => {
    const queue: QueuedMaterial[] = [{ entryId: "e1", categoryId: "cafe", variantIndex: 0, queuedOn: "2026-08-15", entryYm: "2026-08" }];
    const result = editEntryEffects(
      editArgs({ town: freshTown({ queue }), buildings: [], entry: entry({ buildingId: null, queued: true }), patch: { categoryId: "food" } }),
    );
    expect(result.town.queue).toEqual([{ entryId: "e1", categoryId: "food", variantIndex: 0, queuedOn: "2026-08-15", entryYm: "2026-08" }]);
    expect(result.newBuilding).toBeNull();
  });

  it("a date edit across a month boundary on a QUEUED entry updates the material's entryYm (so a later drain patches the right chunk)", () => {
    const queue: QueuedMaterial[] = [{ entryId: "e1", categoryId: "cafe", variantIndex: 0, queuedOn: "2026-08-15", entryYm: "2026-08" }];
    const result = editEntryEffects(
      editArgs({
        town: freshTown({ queue }),
        buildings: [],
        entry: entry({ buildingId: null, queued: true }),
        patch: { occurredOn: "2026-07-20" },
      }),
    );
    expect(result.town.queue[0].entryYm).toBe("2026-07");
    expect(result.entry.occurredOn).toBe("2026-07-20");
  });

  it("a category edit on a 저축 entry moves the amount between buckets", () => {
    const town = freshTown({ cumulativeSavingsKrw: 10_000, savingsByCategoryKrw: { goal: 10_000 } });
    const savingEntry = entry({ type: "saving", categoryId: "goal", amountKrw: 10_000, buildingId: null });
    const result = editEntryEffects(editArgs({ town, buildings: [], entry: savingEntry, patch: { categoryId: "deposit" } }));
    expect(result.town.savingsByCategoryKrw).toEqual({ goal: 0, deposit: 10_000 });
    expect(result.town.cumulativeSavingsKrw).toBe(10_000);
  });
});

describe("editEntryEffects — F9, type changed (round-4 finding C1)", () => {
  it("지출 <-> 수입 re-skins the existing building, no slot/queue accounting change", () => {
    const result = editEntryEffects(editArgs({ patch: { type: "income", categoryId: "salary" } }));
    expect(result.buildings[0].categoryId).toBe("salary");
    expect(result.buildings[0].id).toBe("b1"); // same building, not a new one
    expect(result.newBuilding).toBeNull();
    expect(result.entry.type).toBe("income");
    expect(result.entry.buildingId).toBe("b1"); // unchanged — still bound to the same building
  });

  it("저축 -> 지출 with a free slot builds a fresh building today and starts consuming a slot", () => {
    const savingEntry = entry({ type: "saving", categoryId: "goal", amountKrw: 10_000, buildingId: null });
    const town = freshTown({ cumulativeSavingsKrw: 10_000, savingsByCategoryKrw: { goal: 10_000 }, slotsUsedOn: "2026-08-15", slotsUsedToday: 1 });
    const result = editEntryEffects(editArgs({ town, buildings: [], entry: savingEntry, patch: { type: "expense", categoryId: "food" } }));
    expect(result.newBuilding).not.toBeNull();
    expect(result.newBuilding?.id).toBe("bnew");
    expect(result.newBuilding?.plotIndex).toBe(9);
    expect(result.entry.buildingId).toBe("bnew");
    expect(result.entry.queued).toBe(false);
    expect(result.town.slotsUsedToday).toBe(2);
    expect(result.town.savingsByCategoryKrw).toEqual({ goal: 0 }); // backed out
  });

  // ADDENDUM-04 §3/§7 — a 저축 -> 지출/수입 conversion founds exactly like a
  // fresh F1 save, through the same shared `decideBuildOrQueue`, so it gets
  // the same amount-driven founding exp (root-cause fix, not special-cased).
  it("저축 -> 지출 with a tiered amount founds the building with exp = gain (§3 parity)", () => {
    const savingEntry = entry({ type: "saving", categoryId: "goal", amountKrw: 60_000, buildingId: null });
    const town = freshTown({ cumulativeSavingsKrw: 60_000, savingsByCategoryKrw: { goal: 60_000 }, slotsUsedOn: "2026-08-15", slotsUsedToday: 1 });
    const result = editEntryEffects(
      editArgs({ town, buildings: [], entry: savingEntry, patch: { type: "expense", categoryId: "food" }, expAmountTiers: tieredExpAmountTiers }),
    );
    // Gate-3-rerun fix: founding exp is the full gain, not `gain - 1`.
    expect(result.newBuilding?.exp).toBe(3); // gain 3 (60_000 falls in the [50_000, 200_000) tier)
  });

  it("저축 -> 지출 with no slots remaining queues the material instead (F14)", () => {
    const savingEntry = entry({ type: "saving", categoryId: "goal", amountKrw: 10_000, buildingId: null });
    const town = freshTown({ slotsUsedOn: "2026-08-15", slotsUsedToday: 5 });
    const result = editEntryEffects(
      editArgs({ town, buildings: [], entry: savingEntry, patch: { type: "expense", categoryId: "food" }, dailyBuildSlots: 5 }),
    );
    expect(result.newBuilding).toBeNull();
    expect(result.entry.queued).toBe(true);
    expect(result.entry.buildingId).toBeNull();
    expect(result.town.queue).toHaveLength(1);
    expect(result.town.queue[0].entryYm).toBe("2026-08");
  });

  it("지출 -> 저축 loses its building (not refunded) and starts contributing to the tower", () => {
    const town = freshTown({ slotsUsedOn: "2026-08-15", slotsUsedToday: 3 });
    const result = editEntryEffects(editArgs({ town, buildings: [building()], patch: { type: "saving", categoryId: "goal" } }));
    expect(result.buildings).toEqual([]);
    expect(result.removedBuilding).toEqual({ id: "b1", ym: "2026-08" });
    expect(result.town.slotsUsedToday).toBe(3); // not refunded
    expect(result.town.savingsByCategoryKrw).toEqual({ goal: 4_500 });
    expect(result.entry.buildingId).toBeNull();
    expect(result.entry.queued).toBe(false);
  });

  it("QUEUED 지출 -> 저축 drops the pending material instead of ever building it", () => {
    const queue: QueuedMaterial[] = [{ entryId: "e1", categoryId: "cafe", variantIndex: 0, queuedOn: "2026-08-15", entryYm: "2026-08" }];
    const result = editEntryEffects(
      editArgs({ town: freshTown({ queue }), buildings: [], entry: entry({ buildingId: null, queued: true }), patch: { type: "saving", categoryId: "goal" } }),
    );
    expect(result.town.queue).toEqual([]);
    expect(result.entry.queued).toBe(false);
    expect(result.town.savingsByCategoryKrw).toEqual({ goal: 4_500 });
  });
});

// ── ADDENDUM-04 — a "grow contribution" entry: `buildingId` names a host
// whose OWN founding entry ("founding1") is a different entry than the one
// under test ("grow1") — the marker `isGrowContribution` (this file) infers
// with no extra field, per spec §6.
describe("deleteEntryEffects — ADDENDUM-04 grow contribution", () => {
  it("decrements the host's exp instead of removing it — the host survives", () => {
    const host = building({ id: "host1", source: { kind: "entry", entryId: "founding1" }, exp: 2 });
    const growEntry = entry({ id: "grow1", buildingId: "host1", amountKrw: 4_500 });
    const result = deleteEntryEffects({ town: freshTown(), buildings: [host], entry: growEntry, expAmountTiers });
    expect(result.removedBuilding).toBeNull();
    expect(result.grownBuilding).toEqual({ ...host, exp: 1 });
    expect(result.buildings).toEqual([{ ...host, exp: 1 }]);
  });

  it("floors the host's exp at 0 rather than going negative", () => {
    const host = building({ id: "host1", source: { kind: "entry", entryId: "founding1" }, exp: 0 });
    const growEntry = entry({ id: "grow1", buildingId: "host1", amountKrw: 4_500 });
    const result = deleteEntryEffects({ town: freshTown(), buildings: [host], entry: growEntry, expAmountTiers });
    expect(result.grownBuilding?.exp).toBe(0);
  });

  it("deleting the FOUNDING entry of a grown building still removes the whole building, EXP included (unchanged)", () => {
    const founding = building({ id: "host1", source: { kind: "entry", entryId: "founding1" }, exp: 5 });
    const foundingEntry = entry({ id: "founding1", buildingId: "host1" });
    const result = deleteEntryEffects({ town: freshTown(), buildings: [founding], entry: foundingEntry, expAmountTiers });
    expect(result.removedBuilding).toEqual({ id: "host1", ym: "2026-08" });
    expect(result.grownBuilding).toBeNull();
    expect(result.buildings).toEqual([]);
  });
});

describe("editEntryEffects — ADDENDUM-04 grow contribution", () => {
  it("a category edit on a grow-contribution entry does not re-skin the host — nothing moves", () => {
    const host = building({ id: "host1", source: { kind: "entry", entryId: "founding1" }, categoryId: "cafe" });
    const growEntry = entry({ id: "grow1", buildingId: "host1", categoryId: "cafe" });
    const result = editEntryEffects(editArgs({ buildings: [host], entry: growEntry, patch: { categoryId: "food" } }));
    expect(result.buildings).toEqual([host]); // host untouched
    expect(result.entry.categoryId).toBe("food"); // the entry record itself still reflects the edit
  });

  it("지출/수입 -> 저축 conversion of a grow-contribution entry backs its EXP out of the host instead of removing it", () => {
    const host = building({ id: "host1", source: { kind: "entry", entryId: "founding1" }, exp: 3 });
    const growEntry = entry({ id: "grow1", buildingId: "host1", amountKrw: 4_500 });
    const result = editEntryEffects(editArgs({ buildings: [host], entry: growEntry, patch: { type: "saving", categoryId: "goal" } }));
    expect(result.removedBuilding).toBeNull();
    expect(result.grownBuilding).toEqual({ ...host, exp: 2 });
    expect(result.buildings).toEqual([{ ...host, exp: 2 }]);
    expect(result.entry.buildingId).toBeNull();
    expect(result.town.savingsByCategoryKrw).toEqual({ goal: 4_500 });
  });

  // ADDENDUM-04 §6/§7 — previously a no-op (the amount-edit case this dial
  // makes visible): must back the old gain out and add the new one, same
  // shared `expGainFor` math the delete/convert-to-저축 cases already use.
  it("an amount edit on a grow-contribution entry backs out the old gain and adds the new one", () => {
    const host = building({ id: "host1", source: { kind: "entry", entryId: "founding1" }, exp: 3 });
    const growEntry = entry({ id: "grow1", buildingId: "host1", amountKrw: 4_500 }); // gain 1 under tieredExpAmountTiers
    const result = editEntryEffects(
      editArgs({ buildings: [host], entry: growEntry, patch: { amountKrw: 60_000 }, expAmountTiers: tieredExpAmountTiers }),
    );
    // new gain 3 - old gain 1 = +2 on top of the host's existing 3
    expect(result.grownBuilding).toEqual({ ...host, exp: 5 });
    expect(result.buildings).toEqual([{ ...host, exp: 5 }]);
  });

  it("an amount edit on a grow-contribution entry under a flat table (dial off) never touches the host", () => {
    const host = building({ id: "host1", source: { kind: "entry", entryId: "founding1" }, exp: 3 });
    const growEntry = entry({ id: "grow1", buildingId: "host1", amountKrw: 4_500 });
    const result = editEntryEffects(editArgs({ buildings: [host], entry: growEntry, patch: { amountKrw: 60_000 } }));
    expect(result.grownBuilding).toBeNull();
    expect(result.buildings).toEqual([host]);
  });
});
