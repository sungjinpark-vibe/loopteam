/**
 * Wiring-level tests for ADDENDUM-05 (F-ECON / F-BGM) — the seed earn loop
 * (`grantSeeds`, wired into `addEntry`/`claimNoSpend`), the shop actions
 * (`purchaseSku`/`applyTownSku`/`applyBuildingSku`), `npcCount`, and
 * `bgmMuted`. Same bare `react-dom/client` + `act` harness `useTownStore.test.tsx`
 * already uses — no React Testing Library in this project.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
import { SHOP_SKUS } from "./economy/skus";
import { NPC_MAX_VISIBLE, NPC_SLOT_SKU } from "./economy/types";
import type { EntryDraft } from "./entryActions";
import { setTimeTravelDate } from "./platform/clock";
import { setRandomOverride } from "./platform/random";
import { useTownStore, type AddEntryResult } from "./useTownStore";

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  latest = useTownStore();
  return null;
}

async function mountAndWaitForBoot(): Promise<void> {
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const TODAY = "2026-08-02";

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  setRandomOverride(() => 0);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setTimeTravelDate(null);
  setRandomOverride(null);
});

describe("seed earn loop", () => {
  it("a build grants BALANCE.seedAwards.entry + .build seeds exactly once", async () => {
    await mountAndWaitForBoot();
    expect(latest?.economy.seeds).toBe(0);

    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    let addResult: AddEntryResult | undefined;
    act(() => {
      addResult = latest!.addEntry(coffee);
    });
    // B4 — the recorded entry pays on its own, the founding is a bonus on top.
    // Gate-3-rerun fix: this is also the town's day-1 streak act (a fresh
    // town's `lastActOn` starts unset), so it pays the day-1 streak award too
    // (2 * streakDays(1), see `economy/awards.ts`).
    const streakAward = 2 * 1;
    // Gate-3 round-5: seeds are tiered by amount (`awards.ts`'s
    // `seedsForExpTier`); this 4,500원 coffee is below the first
    // `expAmountTiers` band (5,000원), so it lands on rung 0.
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.entry[0] + BALANCE.seedAwards.build[0] + streakAward);
    const keys = latest!.economy.grantedEventKeys;
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatch(/^seed:entry:/);
    expect(keys[1]).toBe(`seed:streak:${TODAY}`);
    expect(keys[2]).toBe(`seed:build:${latest!.buildings[0].id}`);
    // Gate-3-rerun fix — the caller (TownScreen) folds this into the
    // build toast; see `AddEntryResult.seedsGranted`'s doc for why the grant
    // needs to be surfaced at all (it silently existed before, per the panel).
    expect(addResult?.seedsGranted).toBe(BALANCE.seedAwards.entry[0] + BALANCE.seedAwards.build[0] + streakAward);
  });

  // --- B4 — the paths that used to pay nothing at all. -------------------
  it("an entry that GROWS an existing building still grants the entry award", async () => {
    await mountAndWaitForBoot();
    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(coffee);
    });
    const hostId = latest!.buildings[0].id;
    const seedsAfterFounding = latest!.economy.seeds;

    let grow: AddEntryResult | undefined;
    act(() => {
      grow = latest!.addEntry({ ...coffee, amountKrw: 30_000 }, hostId);
    });
    expect(grow?.grew).not.toBeNull(); // it really took the grow branch, not the build one
    // 30,000원 is the 20,000-50,000원 band (expGain 6) — rung 2.
    expect(grow?.seedsGranted).toBe(BALANCE.seedAwards.entry[2]); // was 0 before B4
    expect(latest?.economy.seeds).toBe(seedsAfterFounding + BALANCE.seedAwards.entry[2]);
  });

  it("an entry that QUEUES past the daily slot cap still grants the entry award", async () => {
    await mountAndWaitForBoot();
    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      for (let i = 0; i < BALANCE.dailyBuildSlots; i++) latest!.addEntry(coffee);
    });
    const seedsAtCap = latest!.economy.seeds;

    let queued: AddEntryResult | undefined;
    act(() => {
      queued = latest!.addEntry(coffee);
    });
    expect(queued?.queued).toBe(true); // slots exhausted — nothing was built
    expect(queued?.seedsGranted).toBe(BALANCE.seedAwards.entry[0]); // was 0 before B4; 4,500원 = rung 0
    expect(latest?.economy.seeds).toBe(seedsAtCap + BALANCE.seedAwards.entry[0]);
  });

  it("the cheapest shop sku is reachable in days, not months, and not in one sitting", async () => {
    const cheapest = Math.min(...SHOP_SKUS.map((s) => s.priceSeeds));
    // Gate-3 round-5: seeds are tiered by amount now — rung 1 (the
    // 5,000-20,000원 band, an actual coffee/lunch) is the dial that kept the
    // old flat entry=4/build=3 value on purpose, so this "normal logger"
    // sanity check reads the same as it always has.
    const perNormalEntry = BALANCE.seedAwards.entry[1] + BALANCE.seedAwards.build[1];
    // "a few entries a day" = 3 — between 3 and 14 days to the price floor.
    const days = cheapest / (3 * perNormalEntry);
    expect(days).toBeGreaterThan(3);
    expect(days).toBeLessThan(14);
    // ...and one day of grinding every reward path cannot reach it: the ONLY
    // saves that pay are the ones that produced something, so a day is capped
    // at `dailyBuildSlots` foundings + one tier crossing + a full queue (whose
    // build bonus lands on a LATER boot's drain, not today).
    const oneDayCeiling =
      BALANCE.dailyBuildSlots * perNormalEntry + BALANCE.seedAwards.tier + BALANCE.materialQueueMax * BALANCE.seedAwards.entry[1];
    expect(oneDayCeiling).toBeLessThan(cheapest);
  });

  it("a 저축 entry earns the day's first-act entry award once; a queue-overflow save stays outside it (no daily cap of its own)", async () => {
    await mountAndWaitForBoot();
    let saving: AddEntryResult | undefined;
    act(() => {
      saving = latest!.addEntry({ type: "saving", amountKrw: 100_000, categoryId: "deposit", occurredOn: TODAY });
    });
    // Gate-3-rerun fix (게임 디자이너's TOP FIX): 저축 used to pay 0 unconditionally
    // — this is that same 100,000원 save, now priced at its own amount rung
    // (100,000원 lands in the 50,000-150,000원 band, rung 3), plus this is
    // also the town's day-1 streak act (a fresh town's `lastActOn` starts
    // unset) — 저축 now advances the streak too, so it pays the day-1 streak
    // award on top, same as any other first act of the day.
    const streakAward = 2 * 1;
    expect(saving?.seedsGranted).toBe(BALANCE.seedAwards.entry[3] + streakAward);
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.entry[3] + streakAward);

    // A second 저축 entry the SAME day earns no further entry OR streak
    // award — 저축 has no `dailyBuildSlots`/`materialQueueMax` cap of its own
    // (F13), so paying every 저축 entry would reopen the exact day-one
    // seed-farm ceiling this suite's "reachable in days, not months" test
    // guards; the streak is already-advanced-today, same as any other act.
    let secondSaving: AddEntryResult | undefined;
    act(() => {
      secondSaving = latest!.addEntry({ type: "saving", amountKrw: 100_000, categoryId: "deposit", occurredOn: TODAY });
    });
    expect(secondSaving?.seedsGranted).toBe(0);
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.entry[3] + streakAward);

    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      for (let i = 0; i < BALANCE.dailyBuildSlots + BALANCE.materialQueueMax; i++) latest!.addEntry(coffee);
    });
    const seedsAtCeiling = latest!.economy.seeds;

    let overflow: AddEntryResult | undefined;
    act(() => {
      overflow = latest!.addEntry(coffee);
    });
    expect(overflow?.queueOverflow).toBe(true);
    expect(overflow?.seedsGranted).toBe(0);
    expect(latest?.economy.seeds).toBe(seedsAtCeiling);
    // The day's hard ceiling, measured through the real store — under the
    // cheapest sku, so the shop can never be bought out in one sitting.
    expect(seedsAtCeiling).toBeLessThan(Math.min(...SHOP_SKUS.map((s) => s.priceSeeds)));
  });

  it("a no-spend claim grants BALANCE.seedAwards.nospend seeds", async () => {
    await mountAndWaitForBoot();
    expect(latest?.canClaimNoSpend).toBe(true);

    act(() => {
      latest!.claimNoSpend();
    });
    // Gate-3-rerun fix: also the town's day-1 streak act (2 * streakDays(1)).
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.nospend + 2);
    expect(latest?.economy.grantedEventKeys).toEqual([`seed:nospend:${TODAY}`, `seed:streak:${TODAY}`]);
  });

  it("grantSeeds is idempotent — calling the same event twice pays once", async () => {
    await mountAndWaitForBoot();
    act(() => {
      const paid = latest!.grantSeeds({ kind: "tier", tier: 1 });
      expect(paid).toBe(true);
    });
    const afterFirst = latest?.economy.seeds;
    act(() => {
      const paidAgain = latest!.grantSeeds({ kind: "tier", tier: 1 });
      expect(paidAgain).toBe(false);
    });
    expect(latest?.economy.seeds).toBe(afterFirst);
  });

  it("seeds survive a reload", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.claimNoSpend();
    });
    const seedsBefore = latest!.economy.seeds;

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.economy.seeds).toBe(seedsBefore);
  });
});

describe("shop actions", () => {
  async function withSeeds(n: number): Promise<void> {
    await mountAndWaitForBoot();
    act(() => {
      latest!.grantSeeds({ kind: "tier", tier: n }); // BALANCE.seedAwards.tier per call, tier value only keys the eventKey
    });
  }

  it("purchaseSku succeeds, deducts seeds, and never goes negative", async () => {
    await withSeeds(1);
    const before = latest!.economy.seeds;
    expect(before).toBeGreaterThanOrEqual(BALANCE.seedAwards.tier);

    let result;
    act(() => {
      result = latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    expect(result).toBe("ok");
    expect(latest?.economy.seeds).toBe(before - BALANCE.seedAwards.tier);
    expect(latest?.economy.ownedSkus).toEqual(["deco.town.sakura.v1"]);
  });

  it("purchaseSku reports insufficient without touching state", async () => {
    await mountAndWaitForBoot();
    let result;
    act(() => {
      result = latest!.purchaseSku("deco.town.sakura.v1", 999_999);
    });
    expect(result).toBe("insufficient");
    expect(latest?.economy.seeds).toBe(0);
    expect(latest?.economy.ownedSkus).toEqual([]);
  });

  it("purchaseSku reports alreadyOwned on a second purchase of the same sku", async () => {
    await withSeeds(1);
    act(() => {
      latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    let result;
    act(() => {
      result = latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    expect(result).toBe("alreadyOwned");
  });

  it("applyTownSku is a no-op for an unowned sku, applies once owned, clears with null", async () => {
    await withSeeds(1);
    act(() => {
      latest!.applyTownSku("deco.town.sakura.v1"); // not owned yet — no-op
    });
    expect(latest?.economy.appliedTownSku).toBeNull();

    act(() => {
      latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    act(() => {
      latest!.applyTownSku("deco.town.sakura.v1");
    });
    expect(latest?.economy.appliedTownSku).toBe("deco.town.sakura.v1");

    act(() => {
      latest!.applyTownSku(null);
    });
    expect(latest?.economy.appliedTownSku).toBeNull();
  });

  it("applyBuildingSku sets/clears per building id, guarded by ownership", async () => {
    await withSeeds(1);
    act(() => {
      latest!.purchaseSku("deco.building.flowerbed.v1", BALANCE.seedAwards.tier);
    });
    act(() => {
      latest!.applyBuildingSku("b1", "deco.building.flowerbed.v1");
    });
    expect(latest?.economy.appliedByBuildingId).toEqual({ b1: "deco.building.flowerbed.v1" });

    act(() => {
      latest!.applyBuildingSku("b1", null);
    });
    expect(latest?.economy.appliedByBuildingId).toEqual({});

    act(() => {
      latest!.applyBuildingSku("b2", "deco.building.unowned.v1"); // never purchased — no-op
    });
    expect(latest?.economy.appliedByBuildingId).toEqual({});
  });
});

describe("NPC_SLOT_SKU — repeatable purchase", () => {
  async function withSeeds(n: number): Promise<void> {
    await mountAndWaitForBoot();
    act(() => {
      latest!.grantSeeds({ kind: "tier", tier: n });
    });
  }

  it("increments purchasedNpcSlots and never touches ownedSkus", async () => {
    await withSeeds(1);
    let result;
    act(() => {
      result = latest!.purchaseSku(NPC_SLOT_SKU, BALANCE.seedAwards.tier);
    });
    expect(result).toBe("ok");
    expect(latest?.economy.purchasedNpcSlots).toBe(1);
    expect(latest?.economy.ownedSkus).toEqual([]);
  });

  it("stacks across repeated purchases and never returns alreadyOwned", async () => {
    await withSeeds(1);
    act(() => {
      latest!.purchaseSku(NPC_SLOT_SKU, 0);
      latest!.purchaseSku(NPC_SLOT_SKU, 0);
    });
    let third;
    act(() => {
      third = latest!.purchaseSku(NPC_SLOT_SKU, 0);
    });
    expect(third).toBe("ok"); // not "alreadyOwned" — repeatable
    expect(latest?.economy.purchasedNpcSlots).toBe(3);
  });

  it("is refused with 'maxed' at the NPC_MAX_VISIBLE ceiling, with no seed deduction", async () => {
    await withSeeds(1);
    act(() => {
      // npcCount = 1 (base) + 0 buildings + purchasedNpcSlots — buy up to one below the cap.
      for (let i = 0; i < NPC_MAX_VISIBLE - 1; i++) latest!.purchaseSku(NPC_SLOT_SKU, 0);
    });
    expect(latest?.npcCount).toBe(NPC_MAX_VISIBLE);
    const seedsAtCap = latest!.economy.seeds;

    let result;
    act(() => {
      result = latest!.purchaseSku(NPC_SLOT_SKU, BALANCE.seedAwards.tier);
    });
    expect(result).toBe("maxed");
    expect(latest?.economy.seeds).toBe(seedsAtCap); // refused BEFORE any deduction
    expect(latest?.economy.purchasedNpcSlots).toBe(NPC_MAX_VISIBLE - 1);
  });

  it("a one-time SKU still returns alreadyOwned on a repeat purchase (unchanged by the slot-SKU branch)", async () => {
    await withSeeds(1);
    act(() => {
      latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    let result;
    act(() => {
      result = latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    expect(result).toBe("alreadyOwned");
  });
});

describe("npcCount", () => {
  it("is 1 (base) with no buildings, and grows by 1 per building", async () => {
    await mountAndWaitForBoot();
    expect(latest?.npcCount).toBe(1);

    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(coffee);
    });
    expect(latest?.npcCount).toBe(2);
  });

  it("NPC_MAX_VISIBLE is exported at 12, the render-perf ceiling npcCount is capped at", () => {
    expect(NPC_MAX_VISIBLE).toBe(12);
  });
});

describe("bgmMuted", () => {
  it("defaults to false (F-BGM: default ON) and toggling survives a reload", async () => {
    await mountAndWaitForBoot();
    expect(latest?.bgmMuted).toBe(false);

    act(() => {
      latest!.setBgmMuted(true);
    });
    expect(latest?.bgmMuted).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.bgmMuted).toBe(true);
  });
});
