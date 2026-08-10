/**
 * S8 shop catalogue — PM-DECISIONS §F-ECON / ADDENDUM-05 §6.
 *
 * SKU id scheme is FROZEN and append-only (ids are permanent once shipped —
 * a store id can never be silently renamed, only added to):
 *   deco.<family>.<slug>.v1   — 건물 꾸미기 (family "building") / 마을 꾸미기 (family "town")
 *   npc.species.<id>.v1       — NPC species unlock (one-time, `ownedSkus`)
 *   npc.slot.v1               — `NPC_SLOT_SKU` (economy/types.ts), repeatable
 *
 * Prices are seeds only (rule R-7 — this file may not import `../format` or
 * contain the KRW character) and are TUNABLE DIALS, not fixed law.
 * PM-DECISIONS §F-ECON pins the catalogue's price floor/ceiling at
 * 150 / 1200 seeds — the cheapest and priciest entries below hit those
 * exactly, so nudging any OTHER price later never has to touch those two
 * numbers.
 *
 * Shape ported from lifetown's `app/lib/data/shop_catalog.dart` (colour
 * presets, building skins with a common/rare/epic rarity ladder, NPC species
 * unlocks) per PM-DECISIONS §PORT — only the catalogue SHAPE is reused, not
 * its time-based earn rules, which do not apply here (see `awards.ts`).
 */
import { NPC_SLOT_SKU, type EconomyState } from "./types";

export type ShopSection = "building" | "town" | "npc";
export type ShopRarity = "common" | "rare" | "epic";

export interface ShopSku {
  id: string;
  section: ShopSection;
  /** Korean display name — user-visible strings stay Korean (HARD CONSTRAINTS). */
  name: string;
  priceSeeds: number;
  rarity: ShopRarity;
  /** `NPC_SLOT_SKU` only — repeatable, never lands in `ownedSkus`, so it can never read "owned". */
  repeatable?: true;
}

// 건물 꾸미기 — a cosmetic applied to ONE chosen building. Ownership is
// permanent and separate from application (ADDENDUM-03 DE-9 rule 4):
// deleting the building it's applied to never revokes the purchase.
const BUILDING_DECOS: readonly ShopSku[] = [
  { id: "deco.building.flowerbed.v1", section: "building", name: "화단", priceSeeds: 150, rarity: "common" },
  { id: "deco.building.mailbox.v1", section: "building", name: "우체통", priceSeeds: 200, rarity: "common" },
  { id: "deco.building.signboard.v1", section: "building", name: "간판", priceSeeds: 220, rarity: "common" },
  { id: "deco.building.balloon.v1", section: "building", name: "풍선", priceSeeds: 260, rarity: "common" },
  { id: "deco.building.streetlamp.v1", section: "building", name: "가로등", priceSeeds: 320, rarity: "rare" },
  { id: "deco.building.cat.v1", section: "building", name: "고양이", priceSeeds: 420, rarity: "rare" },
];

// 마을 꾸미기 — town-wide ground/street skin. The sky is off limits (R-12,
// enforced at the renderer, not here) — ground/street/props/signage only.
const TOWN_DECOS: readonly ShopSku[] = [
  { id: "deco.town.cherryBlossom.v1", section: "town", name: "벚꽃길", priceSeeds: 600, rarity: "rare" },
  { id: "deco.town.snowyVillage.v1", section: "town", name: "눈 내린 마을", priceSeeds: 750, rarity: "rare" },
  { id: "deco.town.nightMarket.v1", section: "town", name: "야시장", priceSeeds: 950, rarity: "epic" },
];

// NPC — one repeatable slot sku + one-time species unlocks.
const NPC_SKUS: readonly ShopSku[] = [
  { id: NPC_SLOT_SKU, section: "npc", name: "NPC 자리 추가", priceSeeds: 350, rarity: "common", repeatable: true },
  { id: "npc.species.hamster.v1", section: "npc", name: "햄스터", priceSeeds: 500, rarity: "common" },
  { id: "npc.species.fox.v1", section: "npc", name: "여우", priceSeeds: 650, rarity: "rare" },
  { id: "npc.species.panda.v1", section: "npc", name: "판다", priceSeeds: 800, rarity: "rare" },
  { id: "npc.species.penguin.v1", section: "npc", name: "펭귄", priceSeeds: 1000, rarity: "epic" },
  { id: "npc.species.raccoon.v1", section: "npc", name: "너구리", priceSeeds: 1200, rarity: "epic" },
];

export const SHOP_SKUS: readonly ShopSku[] = [...BUILDING_DECOS, ...TOWN_DECOS, ...NPC_SKUS];

export function skusBySection(section: ShopSection): readonly ShopSku[] {
  return SHOP_SKUS.filter((s) => s.section === section);
}

/**
 * True when at least one sku the player doesn't yet have is within reach of
 * the current balance — drives the shop mini-FAB's non-numeric "something's
 * affordable" dot (spec: never a nag, never a count badge). Recomputed fresh
 * every render from `economy`/`npcCount`, no stored "seen" flag — the dot
 * simply stops showing once nothing new is in reach, which is the whole
 * point (no extra persisted state to invent for it).
 */
export function hasAffordableUnowned(economy: EconomyState, npcCount: number, npcMaxVisible: number): boolean {
  return SHOP_SKUS.some((sku) => {
    if (sku.repeatable) return npcCount < npcMaxVisible && economy.seeds >= sku.priceSeeds;
    return !economy.ownedSkus.includes(sku.id) && economy.seeds >= sku.priceSeeds;
  });
}
