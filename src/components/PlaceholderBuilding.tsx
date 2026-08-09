/**
 * PlaceholderBuilding — MVP-SPEC.md §6.1: "the MVP ships PlaceholderBuilding
 * (rounded rect in the category colour + category icon + a variant-driven
 * roof shape) behind the same interface as the final sprite component."
 *
 * `BuildingVisualProps` is that interface: swapping in real art later means
 * writing one new component with this same prop shape and changing one
 * import at the call site (`TownGrid.tsx`) — nothing else moves.
 */
import { memo } from "react";
import { colors } from "@toss/tds-colors";
import { CATEGORY_CONTENT } from "../content.placeholder";
import type { BuildingCategoryId } from "../types";

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
}

const ROOF_SHAPES = ["dome", "peak", "flat"] as const;

// Cosmetic cap only (ADDENDUM-04 §8's maxLevel dial) — clamped here too so a
// bad/future level value can never blow the fixed-height tile (defence in
// depth; the real clamp lives upstream where level is computed).
const MAX_VISUAL_LEVEL = 5;

// Measured against App.css's fixed --town-tile-h (72px, townLayout.ts
// TILE_HEIGHT_PX): roof is at most 14px (dome/peak) and .building-icon's box
// is exactly 24px line-height + 8px padding-bottom = 32px, leaving a 26px gap
// between them. MAX_VISUAL_LEVEL - 1 = 4 floors must fit that gap, so
// 4 * FLOOR_HEIGHT_PX <= 26 — 6px (24px total) is the largest whole-pixel
// step that clears it.
const FLOOR_HEIGHT_PX = 6;

function PlaceholderBuildingImpl({ categoryId, variantIndex, justBuilt, level = 1 }: BuildingVisualProps) {
  const content = categoryId ? CATEGORY_CONTENT[categoryId] : null;
  const color = content?.color ?? colors.grey400;
  const icon = content?.icon ?? "🏛️";
  // variantIndex is always >= 0 (every producer is `Math.floor(random() * n)`) — plain modulo is enough.
  const roof = ROOF_SHAPES[variantIndex % ROOF_SHAPES.length];
  const floors = Math.max(0, Math.min(level, MAX_VISUAL_LEVEL) - 1);
  const title = floors > 0 ? [content?.label, `Lv.${level}`].filter(Boolean).join(" ") : content?.label;

  const classNames = ["building-tile", justBuilt && "building-tile-rise"].filter(Boolean).join(" ");

  return (
    <div className={classNames} style={{ backgroundColor: color }} title={title}>
      <div className={`building-roof building-roof-${roof}`} />
      {floors > 0 && (
        <div className="building-floors" style={{ height: floors * FLOOR_HEIGHT_PX }} aria-hidden="true" />
      )}
      <span className="building-icon" aria-hidden="true">
        {icon}
      </span>
      {floors > 0 && (
        <span className="building-level-badge" aria-hidden="true">
          {`Lv.${level}`}
        </span>
      )}
    </div>
  );
}

export const PlaceholderBuilding = memo(PlaceholderBuildingImpl);
