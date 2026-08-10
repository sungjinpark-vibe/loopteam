import { describe, expect, it } from "vitest";
import { NPC_SLOT_SKU, defaultEconomyState, seeds as seedCount } from "./types";
import { SHOP_SKUS, hasAffordableUnowned, skusBySection } from "./skus";

describe("SHOP_SKUS — frozen id snapshot", () => {
  it("pins every sku id exactly — ids are permanent once shipped (PM-DECISIONS §F-ECON)", () => {
    expect(SHOP_SKUS.map((s) => s.id)).toEqual([
      "deco.building.flowerbed.v1",
      "deco.building.mailbox.v1",
      "deco.building.signboard.v1",
      "deco.building.balloon.v1",
      "deco.building.streetlamp.v1",
      "deco.building.cat.v1",
      "deco.town.cherryBlossom.v1",
      "deco.town.snowyVillage.v1",
      "deco.town.nightMarket.v1",
      NPC_SLOT_SKU,
      "npc.species.hamster.v1",
      "npc.species.fox.v1",
      "npc.species.panda.v1",
      "npc.species.penguin.v1",
      "npc.species.raccoon.v1",
    ]);
  });

  it("every id follows the frozen scheme", () => {
    for (const s of SHOP_SKUS) {
      expect(s.id).toMatch(/^(deco\.(building|town)\.[a-zA-Z]+\.v1|npc\.(slot|species\.[a-zA-Z]+)\.v1)$/);
    }
  });

  it("prices span the PM-approved dial bounds exactly (150 cheapest, 1200 priciest)", () => {
    const prices = SHOP_SKUS.map((s) => s.priceSeeds);
    expect(Math.min(...prices)).toBe(150);
    expect(Math.max(...prices)).toBe(1200);
  });

  it("only NPC_SLOT_SKU is repeatable", () => {
    expect(SHOP_SKUS.filter((s) => s.repeatable).map((s) => s.id)).toEqual([NPC_SLOT_SKU]);
  });

  it("skusBySection groups into the three S8 sections", () => {
    expect(skusBySection("building")).toHaveLength(6);
    expect(skusBySection("town")).toHaveLength(3);
    expect(skusBySection("npc")).toHaveLength(6);
  });
});

describe("hasAffordableUnowned", () => {
  it("false on a fresh (zero-seed) economy", () => {
    expect(hasAffordableUnowned(defaultEconomyState(), 1, 12)).toBe(false);
  });

  it("true once seeds cover the cheapest unowned sku", () => {
    const economy = { ...defaultEconomyState(), seeds: seedCount(150) };
    expect(hasAffordableUnowned(economy, 1, 12)).toBe(true);
  });

  it("ignores a repeatable sku once the NPC cap is reached, even with plenty of seeds", () => {
    const economy = {
      ...defaultEconomyState(),
      seeds: seedCount(350),
      ownedSkus: SHOP_SKUS.filter((s) => !s.repeatable).map((s) => s.id),
    };
    // every one-time sku owned, and enough seeds only for the (capped) slot sku
    expect(hasAffordableUnowned(economy, 12, 12)).toBe(false);
  });

  it("ignores a sku already owned even if affordable", () => {
    const economy = { ...defaultEconomyState(), seeds: seedCount(1200), ownedSkus: SHOP_SKUS.map((s) => s.id) };
    expect(hasAffordableUnowned(economy, 12, 12)).toBe(false);
  });
});
