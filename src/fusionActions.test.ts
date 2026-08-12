/**
 * ADDENDUM-11 — pure-domain unit tests for the fusion rule (§2.2 F1-F6), the
 * survivor/consumed decision (§3), the chunk-write ORDER that makes a
 * cross-month fusion self-healing (§3.1), the dangling-reference remap (§5.4)
 * and the boot repair. Wiring (real store, real storage, real boot) lives in
 * `useTownStore.fusion.test.tsx`.
 */
import { describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
import { defaultEconomyState } from "./economy/types";
import {
  applyFusion,
  canFuse,
  fusePartners,
  fusionChunkWrites,
  MAX_FUSE_TIER,
  remapEntryBuildingRefs,
  repairPendingFusions,
  transferBuildingSku,
} from "./fusionActions";
import { totalLevelOf } from "./selectors";
import type { Building, LedgerEntry } from "./types";

const EXP_PER_LEVEL = BALANCE.expPerLevel;
const MAX_LEVEL = BALANCE.maxLevel;
/** EXP that reaches `maxLevel` — derived, never a literal (F1's basis). */
const MAXED_EXP = (MAX_LEVEL - 1) * EXP_PER_LEVEL;

function b(id: string, extra: Partial<Building> = {}): Building {
  return {
    id,
    source: { kind: "entry", entryId: `e-${id}` },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex: 0,
    builtOn: "2026-08-01",
    createdAt: 1,
    exp: MAXED_EXP,
    ...extra,
  };
}

describe("canFuse — §2.2 conditions F1..F6", () => {
  it("accepts two distinct maxed entry buildings of the same category and footprint", () => {
    expect(canFuse(b("a"), b("c"), EXP_PER_LEVEL, MAX_LEVEL)).toBe(true);
  });

  it("F1 — refuses when either building is below maxLevel", () => {
    expect(canFuse(b("a"), b("c", { exp: MAXED_EXP - 1 }), EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
    expect(canFuse(b("a", { exp: 0 }), b("c"), EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
  });

  it("F2 — refuses a different category", () => {
    expect(canFuse(b("a"), b("c", { categoryId: "food" }), EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
  });

  it("F3 — refuses a different footprint", () => {
    expect(canFuse(b("a", { w: 2, h: 2 }), b("c"), EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
    // ...and accepts a matching multi-cell pair (absent w/h === 1, placement.ts's rule).
    expect(canFuse(b("a", { w: 2, h: 2 }), b("c", { w: 2, h: 2 }), EXP_PER_LEVEL, MAX_LEVEL)).toBe(true);
    expect(canFuse(b("a", { w: 1, h: 1 }), b("c"), EXP_PER_LEVEL, MAX_LEVEL)).toBe(true);
  });

  it("F4/§5.2 — a monument or a 무지출 park tile is never a fusion input", () => {
    const monument = b("m", { source: { kind: "monument", period: "2026-07" }, categoryId: null });
    const park = b("p", { source: { kind: "nospend", date: "2026-08-01" }, categoryId: "park" });
    expect(canFuse(b("a"), monument, EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
    expect(canFuse(monument, b("a"), EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
    expect(canFuse(b("a"), park, EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
    // ...and two monuments never fuse with each other either (categoryId null).
    expect(canFuse(monument, b("m2", { source: { kind: "monument", period: "2026-06" }, categoryId: null }), EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
  });

  it("F5 — a Lv.6 fuses only with a Lv.6, never with a Lv.5", () => {
    expect(canFuse(b("a", { fuse: 1 }), b("c"), EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
    expect(canFuse(b("a", { fuse: 1 }), b("c", { fuse: 1 }), EXP_PER_LEVEL, MAX_LEVEL)).toBe(true);
  });

  it("F6 — refuses the same building twice, and refuses a pair already at the fuse cap (Lv.10)", () => {
    const one = b("a");
    expect(canFuse(one, one, EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
    expect(canFuse(b("a", { fuse: MAX_FUSE_TIER }), b("c", { fuse: MAX_FUSE_TIER }), EXP_PER_LEVEL, MAX_LEVEL)).toBe(false);
  });
});

describe("fusePartners — §6 step 2", () => {
  it("lists only legal partners, oldest first, and never the initiator itself", () => {
    const town = [
      b("a", { createdAt: 5 }),
      b("young", { createdAt: 9 }),
      b("old", { createdAt: 2 }),
      b("small", { createdAt: 1, exp: 0 }),
      b("other", { createdAt: 1, categoryId: "food" }),
    ];
    expect(fusePartners(town, "a", EXP_PER_LEVEL, MAX_LEVEL).map((x) => x.id)).toEqual(["old", "young"]);
  });

  it("is empty when the initiator itself is ineligible — no partner, no 융합하기 CTA", () => {
    const town = [b("a", { exp: 0 }), b("c")];
    expect(fusePartners(town, "a", EXP_PER_LEVEL, MAX_LEVEL)).toEqual([]);
    expect(fusePartners(town, "nosuchid", EXP_PER_LEVEL, MAX_LEVEL)).toEqual([]);
    expect(fusePartners([b("lonely")], "lonely", EXP_PER_LEVEL, MAX_LEVEL)).toEqual([]);
  });
});

describe("applyFusion — §3", () => {
  it("keeps the survivor's identity and position, increments only `fuse`, and deletes the other", () => {
    const survivor = b("s", { plotIndex: 42, w: 2, h: 1, createdAt: 7, variantIndex: 2 });
    const consumed = b("c", { plotIndex: 100, w: 2, h: 1, createdAt: 9 });
    const result = applyFusion([survivor, consumed], "s", "c", EXP_PER_LEVEL, MAX_LEVEL)!;

    expect(result.survivor).toEqual({ ...survivor, fuse: 1 });
    expect(totalLevelOf(result.survivor, EXP_PER_LEVEL, MAX_LEVEL)).toBe(MAX_LEVEL + 1); // Lv.6
    expect(result.buildings.map((x) => x.id)).toEqual(["s"]);
    expect(result.consumed.id).toBe("c");
  });

  it("climbs one rung per act, to the Lv.10 cap", () => {
    let survivor = b("s");
    for (let tierN = 1; tierN <= MAX_FUSE_TIER; tierN++) {
      const partner = b(`p${tierN}`, { fuse: survivor.fuse });
      survivor = applyFusion([survivor, partner], "s", partner.id, EXP_PER_LEVEL, MAX_LEVEL)!.survivor;
      expect(totalLevelOf(survivor, EXP_PER_LEVEL, MAX_LEVEL)).toBe(MAX_LEVEL + tierN);
    }
    expect(totalLevelOf(survivor, EXP_PER_LEVEL, MAX_LEVEL)).toBe(10);
    // §8 — no rung past Lv.10.
    expect(applyFusion([survivor, b("p6", { fuse: MAX_FUSE_TIER })], "s", "p6", EXP_PER_LEVEL, MAX_LEVEL)).toBeNull();
  });

  it("returns null and leaves the town untouched for an illegal pair (a stale UI can never commit one)", () => {
    const town = [b("a"), b("c", { categoryId: "food" })];
    expect(applyFusion(town, "a", "c", EXP_PER_LEVEL, MAX_LEVEL)).toBeNull();
    expect(applyFusion(town, "a", "ghost", EXP_PER_LEVEL, MAX_LEVEL)).toBeNull();
  });
});

describe("fusionChunkWrites — §3.1 atomicity ordering", () => {
  it("a same-month fusion is ONE write and never sets fusePending", () => {
    const survivor = { ...b("s", { builtOn: "2026-08-01" }), fuse: 1 as const };
    const consumed = b("c", { builtOn: "2026-08-20" });
    const writes = fusionChunkWrites(survivor, consumed);

    expect(writes).toHaveLength(1);
    expect(writes[0].ym).toBe("2026-08");
    const after = writes[0].mutate([b("s", { builtOn: "2026-08-01" }), consumed]);
    expect(after.map((x) => x.id)).toEqual(["s"]);
    expect(after[0].fuse).toBe(1);
    expect(after[0].fusePending).toBeUndefined();
  });

  it("a cross-month fusion grants the level and marks the debt in the SAME first write, then deletes, then clears", () => {
    const survivor = { ...b("s", { builtOn: "2026-07-03" }), fuse: 1 as const };
    const consumed = b("c", { builtOn: "2026-08-20" });
    const writes = fusionChunkWrites(survivor, consumed);

    expect(writes.map((w) => w.ym)).toEqual(["2026-07", "2026-08", "2026-07"]);
    // Write 1 — the level and the debt land together, so no interruption can
    // grant one without the other.
    const afterWrite1 = writes[0].mutate([b("s", { builtOn: "2026-07-03" })]);
    expect(afterWrite1[0].fuse).toBe(1);
    expect(afterWrite1[0].fusePending).toBe("c");
    // Write 2 — the consumed building's own chunk.
    expect(writes[1].mutate([consumed])).toEqual([]);
    // Write 3 — the debt is cleared, the level stays.
    const afterWrite3 = writes[2].mutate(afterWrite1);
    expect(afterWrite3[0].fuse).toBe(1);
    expect(afterWrite3[0].fusePending).toBeUndefined();
  });
});

describe("repairPendingFusions — §3.1 boot repair", () => {
  const survivorPending: Building = { ...b("s", { builtOn: "2026-07-03" }), fuse: 1, fusePending: "c" };

  it("interrupted after write 1: finishes forward — deletes the consumed building, keeps the level", () => {
    const consumed = b("c", { builtOn: "2026-08-20" });
    const { buildings, repairs } = repairPendingFusions([survivorPending, consumed]);

    expect(buildings.map((x) => x.id)).toEqual(["s"]);
    expect(buildings[0].fuse).toBe(1); // NEVER rolled back — rolling back is what loses a building
    expect(buildings[0].fusePending).toBeUndefined();
    expect(repairs).toEqual([{ survivorId: "s", survivorYm: "2026-07", consumedId: "c", consumedYm: "2026-08" }]);
  });

  it("interrupted after write 2: the consumed building is already gone, so only the stale field is cleared", () => {
    const { buildings, repairs } = repairPendingFusions([survivorPending]);
    expect(buildings[0].fuse).toBe(1);
    expect(buildings[0].fusePending).toBeUndefined();
    expect(repairs[0].consumedYm).toBeNull();
  });

  it("is idempotent, and an ordinary town is returned BY REFERENCE so a clean boot writes nothing", () => {
    const once = repairPendingFusions([survivorPending, b("c", { builtOn: "2026-08-20" })]);
    const twice = repairPendingFusions(once.buildings);
    expect(twice.repairs).toEqual([]);
    expect(twice.buildings).toBe(once.buildings);

    const clean = [b("a"), b("c")];
    expect(repairPendingFusions(clean).buildings).toBe(clean);
  });
});

describe("dangling references — §5.4", () => {
  const entry = (id: string, buildingId: string | null): LedgerEntry => ({
    id,
    type: "expense",
    amountKrw: 1000,
    categoryId: "cafe",
    occurredOn: "2026-08-01",
    createdAt: 1,
    updatedAt: 1,
    buildingId,
    queued: false,
  });

  it("remaps every reference to the survivor — never nulls one, never drops an entry", () => {
    const entries = [entry("e1", "c"), entry("e2", "s"), entry("e3", null), entry("e4", "c")];
    const remapped = remapEntryBuildingRefs(entries, "c", "s");

    expect(remapped).toHaveLength(entries.length); // no entry is ever deleted by a fusion
    expect(remapped.map((e) => e.buildingId)).toEqual(["s", "s", null, "s"]);
    // A pre-existing null (queued / over-cap / 저축) stays null and is not touched.
    expect(remapped[2]).toBe(entries[2]);
  });

  it("returns the same array reference when nothing pointed at the consumed building (no chunk write)", () => {
    const entries = [entry("e1", "s"), entry("e2", null)];
    expect(remapEntryBuildingRefs(entries, "c", "s")).toBe(entries);
  });

  it("transfers a cosmetic SKU to the survivor, and never revokes a purchase", () => {
    const owned = { ...defaultEconomyState(), ownedSkus: ["deco.a", "deco.b"] };
    const bound = { ...owned, appliedByBuildingId: { c: "deco.a" } };
    const moved = transferBuildingSku(bound, "c", "s");
    expect(moved.appliedByBuildingId).toEqual({ s: "deco.a" });
    expect(moved.ownedSkus).toEqual(owned.ownedSkus);

    // Survivor already skinned: only the BINDING is dropped — ownership is untouched,
    // so the sku can simply be re-applied.
    const both = { ...owned, appliedByBuildingId: { c: "deco.a", s: "deco.b" } };
    const kept = transferBuildingSku(both, "c", "s");
    expect(kept.appliedByBuildingId).toEqual({ s: "deco.b" });
    expect(kept.ownedSkus).toEqual(owned.ownedSkus);

    // Nothing bound to the consumed building — same reference, no write.
    expect(transferBuildingSku(owned, "c", "s")).toBe(owned);
  });
});
