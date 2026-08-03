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
}

const ROOF_SHAPES = ["dome", "peak", "flat"] as const;

function PlaceholderBuildingImpl({ categoryId, variantIndex, justBuilt }: BuildingVisualProps) {
  const content = categoryId ? CATEGORY_CONTENT[categoryId] : null;
  const color = content?.color ?? colors.grey400;
  const icon = content?.icon ?? "🏛️";
  // The park tile (F15) always gets a rounded tree-canopy silhouette instead
  // of a pitched roof — it's the app's rarest reward and spec §6.1 requires
  // it to read as different from every spending/income category on sight, not
  // just as a house in a different colour. Every other category cycles
  // through the three house roofs by variantIndex, same as before.
  // variantIndex is always >= 0 (every producer is `Math.floor(random() * n)`) — plain modulo is enough.
  const roof = categoryId === "park" ? "canopy" : ROOF_SHAPES[variantIndex % ROOF_SHAPES.length];

  return (
    <div
      className={justBuilt ? "building-tile building-tile-rise" : "building-tile"}
      style={{ backgroundColor: color }}
      title={content?.label}
    >
      <div className={`building-roof building-roof-${roof}`} />
      <span className="building-icon" aria-hidden="true">
        {icon}
      </span>
    </div>
  );
}

export const PlaceholderBuilding = memo(PlaceholderBuildingImpl);
