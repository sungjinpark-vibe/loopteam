/**
 * NPC species recipe table — transcribed from
 * `C:\Users\user\app-dev-team\lifetown\app\lib\data\npc_visual_defs.dart`
 * (lines 54-182, `kNpcIds` / `kNpcVisualDefs`), our own prior work (Flutter
 * project `lifetown`, PM-DECISIONS §PORT). Color hex values and the `ear`
 * shape tags are copied 1:1 from that Dart const table; `NpcSprite.tsx`
 * ports the JS generator (`docs/design/npcs/npcs.html` +
 * `docs/design/shop/new_npcs.html`) that the Dart colors were designed to
 * render through.
 *
 * Data only — no rendering here. Species assignment for a given NPC index
 * is a pure function of that index (`speciesForIndex`), matching
 * ADDENDUM-05 §3 / rule R-2: never persisted, never stored.
 */

/** Ear/head-decoration shape tag — one branch per tag in `NpcSprite.tsx`, ported from the two JS generators. */
export type NpcEarShape =
  | "cat"
  | "fox"
  | "round"
  | "roundDark"
  | "floppy"
  | "rabbit"
  | "bird"
  | "bump"
  | "spike"
  | "antler"
  | "none";

export interface NpcSpeciesDef {
  id: string;
  body: string;
  dark: string;
  ear: NpcEarShape;
  /** Ear-inner / iris-adjacent accent color. Dart default when omitted: `#FFC4D6`. */
  inner: string;
  /** Belly patch color. Dart default when omitted: `#FFFFFF`. */
  belly: string;
  /** White muzzle patch under the eyes. */
  muzzle: boolean;
  /** Eye-mask patch (panda) — drawn under the eyes, before them. */
  patch?: string;
  /** Independent beak flag (new_npcs.html: no longer tied to `ear === 'bird'`). */
  beak: boolean;
  /** Front-paw color override; defaults to `body` when omitted. */
  armColor?: string;
  /** Neck scarf color — new in the Dart table (07-art-redesign.md §3-2/§3-3), gives the 12 species a "same village" unity that neither JS prototype drew. */
  scarfColor?: string;
}

// Base 6 (npcs.html defs order) + shop 6 (new_npcs.html defs order) — same
// order as Dart's kNpcIds/kNpcVisualDefs.
export const SPECIES: readonly NpcSpeciesDef[] = [
  { id: "cat", body: "#FFD1E8", dark: "#F2A9C9", ear: "cat", inner: "#FF9EC4", belly: "#FFFFFF", muzzle: false, beak: false, scarfColor: "#B6A0EF" },
  { id: "dog", body: "#FFE3B0", dark: "#D9A05C", ear: "floppy", inner: "#E8B978", belly: "#FFFFFF", muzzle: true, beak: false, scarfColor: "#6FD0E8" },
  { id: "rabbit", body: "#F1E9FF", dark: "#C9B6EE", ear: "rabbit", inner: "#FFC2D9", belly: "#FFFFFF", muzzle: false, beak: false, scarfColor: "#FFD066" },
  { id: "bear", body: "#E8C79E", dark: "#B98A55", ear: "round", inner: "#C98A46", belly: "#FFF6E8", muzzle: false, beak: false, scarfColor: "#8AD3B4" },
  { id: "fox", body: "#FFB37A", dark: "#E0923F", ear: "fox", inner: "#FFF3E0", belly: "#FFFFFF", muzzle: true, beak: false, scarfColor: "#6FBFA6" },
  { id: "chick", body: "#FFE066", dark: "#E0B93F", ear: "bird", inner: "#FFC4D6", belly: "#FFF8DC", muzzle: false, beak: false, scarfColor: "#FF8FA3" },
  { id: "hamster", body: "#F5D9B0", dark: "#D9AE73", ear: "round", inner: "#FFCFA0", belly: "#FFF6E8", muzzle: true, beak: false, scarfColor: "#FF9EC4" },
  { id: "frog", body: "#A8E6B0", dark: "#7CC98A", ear: "bump", inner: "#FFC4D6", belly: "#EAFFF0", muzzle: false, beak: false, scarfColor: "#FFB37A" },
  { id: "panda", body: "#FAFAFA", dark: "#3A3A46", ear: "roundDark", inner: "#FFC4D6", belly: "#FFFFFF", muzzle: false, patch: "#3A3A46", beak: false, armColor: "#3A3A46", scarfColor: "#FF9EC4" },
  { id: "hedgehog", body: "#D9BBA0", dark: "#8A6A52", ear: "spike", inner: "#FFC4D6", belly: "#FFF3E6", muzzle: true, beak: false, scarfColor: "#6FD0E8" },
  { id: "penguin", body: "#3A3A52", dark: "#26263A", ear: "none", inner: "#FFC4D6", belly: "#FFFFFF", muzzle: false, beak: true, scarfColor: "#FFD066" },
  { id: "deer", body: "#D9B48A", dark: "#A67C52", ear: "antler", inner: "#FFE3C2", belly: "#FFF6E8", muzzle: true, beak: false, scarfColor: "#B6A0EF" },
];

/** Deterministic pure function of the NPC's index — never persisted (ADDENDUM-05 §3, rule R-2). */
export function speciesForIndex(npcIndex: number): NpcSpeciesDef {
  const i = ((npcIndex % SPECIES.length) + SPECIES.length) % SPECIES.length;
  return SPECIES[i];
}

/** The first 6 (`kNpcIds` "base" set) render for everyone with no purchase — the shop-tier 6 are what S8's NPC section is selling. */
const BASE_SPECIES_COUNT = 6;

/**
 * S8 shop sku id -> the SPECIES entry it unlocks. Gate-3-rerun fix
 * (게임 디자이너 TOP FIX): before this, `speciesForIndex` cycled through all
 * 12 species unconditionally, so every shop-tier species already appeared
 * for free — buying `npc.species.*.v1` changed nothing observable. Only 3 of
 * the 5 NPC-species skus have a clean match to today's `SPECIES` table.
 * ponytail: `npc.species.fox.v1` re-sells a species that's already in the
 * free base 6, and `npc.species.raccoon.v1` has no matching `SPECIES` entry
 * at all — pre-existing catalogue/species-table drift, not something to
 * silently paper over here. Both skus stay purchasable (ownership is still
 * tracked) but unlock nothing new until an artist either retires them or
 * adds a real "raccoon" `SPECIES` def and repoints fox at a different one.
 */
const SKU_TO_SPECIES_ID: Readonly<Record<string, string>> = {
  "npc.species.hamster.v1": "hamster",
  "npc.species.panda.v1": "panda",
  "npc.species.penguin.v1": "penguin",
};

/** Base 6 (always shown) plus any shop-tier species the player has actually bought. */
export function unlockedSpecies(ownedSkus: readonly string[]): readonly NpcSpeciesDef[] {
  const ownedSpeciesIds = new Set(ownedSkus.map((sku) => SKU_TO_SPECIES_ID[sku]).filter((id): id is string => id !== undefined));
  return SPECIES.filter((s, i) => i < BASE_SPECIES_COUNT || ownedSpeciesIds.has(s.id));
}

/** Same determinism as `speciesForIndex`, scoped to what `ownedSkus` has actually unlocked. */
export function speciesForIndexUnlocked(npcIndex: number, ownedSkus: readonly string[]): NpcSpeciesDef {
  const pool = unlockedSpecies(ownedSkus);
  const i = ((npcIndex % pool.length) + pool.length) % pool.length;
  return pool[i];
}
