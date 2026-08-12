/**
 * PlaceholderBuilding — MVP-SPEC.md §6.1 named this "the MVP ships a
 * rounded-rect placeholder behind the same interface as the final sprite
 * component". ADDENDUM-05 §F-BLD is that swap: `BuildingArt` (buildingArt.tsx,
 * ported from lifetown's `docs/design/building-props/building-props.html`)
 * now draws a real category-specific isometric building. `BuildingVisualProps`
 * keeps its exact prop shape unchanged, per that promise — nothing at the
 * call site (`TownGrid.tsx`) moves.
 */
import { memo } from "react";
import { colors } from "@toss/tds-colors";
import { CATEGORY_CONTENT } from "../content.placeholder";
import { archetypeFor, BuildingArt, MAX_VISUAL_LEVEL } from "./buildingArt";
import type { BuildingCategoryId } from "../types";
import "../buildings.css";

/**
 * §4.4 — a 10%-alpha tint of the category colour, not the raw token. Keeps
 * `style.backgroundColor` a non-empty string (the load-bearing proof that
 * `@toss/tds-colors` resolves under Vitest, `TownGrid.test.tsx`) while no
 * longer painting a full-bleed flat-grid swatch behind the SVG art.
 */
function tintOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, 0.1)`;
}

export interface BuildingVisualProps {
  categoryId: BuildingCategoryId | null;
  variantIndex: number;
  /** Plays the rise-in animation once, for a building just created this session. */
  justBuilt?: boolean;
  /**
   * Building level (ADDENDUM-04 §8) — 1 (default, every existing save) renders
   * IDENTICALLY to before: no floors div, no badge, same markup. >= 2 stacks
   * a floor below the roof and shows a `Lv.N` badge. `variantIndex` (roof
   * shape) is independent of this.
   */
  level?: number;
  /**
   * F16 — 'YYYY-MM' engraved on a monument tile (`source.kind === "monument"`,
   * `categoryId === null`); undefined for every other tile. Monuments never
   * grow (selectors.ts's `growCandidates` already excludes them), so `level`
   * stays 1 and no `Lv.N` badge ever shows on one — no extra guard needed here.
   */
  monumentPeriod?: string;
  /** ADDENDUM-08 §2.1/§7 — footprint in cells (absent === 1x1), forwarded to `BuildingArt` for the landmark-scale treatment. Never read raw elsewhere — callers pass `footprintOf(building)`. */
  w?: 1 | 2;
  h?: 1 | 2;
  /** ADDENDUM-11 §4.1 — fuse tier (0-5), forwarded to `BuildingArt` as-is. Absent/0 is the byte-identical pre-fusion render. Callers pass `fuseOf(building)`. */
  fuseTier?: number;
}

function PlaceholderBuildingImpl({ categoryId, variantIndex, justBuilt, level = 1, monumentPeriod, w, h, fuseTier }: BuildingVisualProps) {
  const content = categoryId ? CATEGORY_CONTENT[categoryId] : null;
  // F16 — a monument (categoryId === null) gets its own stone tone rather
  // than falling back to the same grey400 the "etc"/"other_saving" categories
  // already use, so it never blends into an ordinary building on sight. This
  // colour is also asserted directly by TownGrid.test.tsx ("a real building's
  // tile gets a non-empty inline background colour") — kept as a swatch
  // behind the SVG art, not just a fallback.
  const color = content?.color ?? (monumentPeriod ? colors.grey600 : colors.grey400);
  // variantIndex is always >= 0 (every producer is `Math.floor(random() * n)`) — plain modulo is enough.
  const floors = Math.max(0, Math.min(level, MAX_VISUAL_LEVEL) - 1);
  const title = monumentPeriod ?? (floors > 0 ? [content?.label, `Lv.${level}`].filter(Boolean).join(" ") : content?.label);

  const classNames = ["building-tile", monumentPeriod && "building-tile--monument", justBuilt && "building-tile-rise"]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classNames}
      style={{ backgroundColor: tintOf(color) }}
      title={title}
      data-archetype={archetypeFor(categoryId, monumentPeriod)}
    >
      <BuildingArt categoryId={categoryId} variantIndex={variantIndex} level={level} monumentPeriod={monumentPeriod} w={w} h={h} fuseTier={fuseTier} />
      {floors > 0 && (
        <span className="building-level-badge" aria-hidden="true">
          {`Lv.${level}`}
        </span>
      )}
      {/* F16 AC: "each engraved with its own YYYY-MM" — visible on the tile, never a Lv.N badge (monuments never grow). */}
      {monumentPeriod && (
        <span className="building-monument-period" aria-hidden="true">
          {monumentPeriod}
        </span>
      )}
    </div>
  );
}

export const PlaceholderBuilding = memo(PlaceholderBuildingImpl);
