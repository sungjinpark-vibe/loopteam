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
import type { CategoryId } from "../types";

export interface BuildingVisualProps {
  categoryId: CategoryId | null;
  variantIndex: number;
  /** Plays the rise-in animation once, for a building just created this session. */
  justBuilt?: boolean;
}

const ROOF_SHAPES = ["dome", "peak", "flat"] as const;

function PlaceholderBuildingImpl({ categoryId, variantIndex, justBuilt }: BuildingVisualProps) {
  const content = categoryId ? CATEGORY_CONTENT[categoryId] : null;
  const color = content?.color ?? colors.grey400;
  const icon = content?.icon ?? "🏛️";
  // variantIndex is always >= 0 (every producer is `Math.floor(random() * n)`) — plain modulo is enough.
  const roof = ROOF_SHAPES[variantIndex % ROOF_SHAPES.length];

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
