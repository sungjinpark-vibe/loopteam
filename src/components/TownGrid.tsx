/**
 * S3 grid (spec §6 S2 / §5 F3) — serpentine tile grid, one tile per plot
 * index from 0 to `nextPlotIndex - 1`, padded out to complete the current
 * row. Occupied plots render `PlaceholderBuilding`; empty plots render
 * `EmptyLot` — both the permanent kind (a future deletion, F9, out of this
 * task's scope) and the "not built yet" kind that fills out the rest of the
 * row so the grid always reads as a row of lots, not one tile floating on
 * blank background (spec F3: "empty plots render an empty lot").
 *
 * Dense/virtualization (F3's "dense" AC — ~5,400 buildings, <1s paint) is
 * explicitly deferred by this task's brief; this grid renders every plot
 * directly, which is correct for the empty/normal states in scope.
 *
 * Wrapped in `React.memo`: this is the town's biggest subtree, and its props
 * (`buildings`, `nextPlotIndex`) only change when `useTownStore` actually
 * mutates town state — a parent re-render for unrelated reasons (e.g. the
 * entry sheet opening/closing) must not rebuild every tile.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import { TOWN_COLUMNS, plotFromIndex } from "../selectors";
import type { Building } from "../types";
import { EmptyLot } from "./EmptyLot";
import { PlaceholderBuilding } from "./PlaceholderBuilding";

export interface TownGridProps {
  nextPlotIndex: number;
  buildings: readonly Building[];
  justBuiltId: string | null;
}

function TownGridImpl({ nextPlotIndex, buildings, justBuiltId }: TownGridProps) {
  const newestTileRef = useRef<HTMLDivElement | null>(null);

  const byPlotIndex = useMemo(() => {
    const map = new Map<number, Building>();
    for (const b of buildings) map.set(b.plotIndex, b);
    return map;
  }, [buildings]);

  // Round up to a full row: plots [nextPlotIndex, tileCount) are "not built
  // yet" empty lots, rendered so the current row never ends mid-street on
  // blank background. At nextPlotIndex === 0 (empty state, App.tsx renders
  // its own message instead) this still yields one full row, harmless if
  // this component is ever rendered directly with no buildings.
  const tileCount = Math.max(TOWN_COLUMNS, Math.ceil(nextPlotIndex / TOWN_COLUMNS) * TOWN_COLUMNS);

  const tiles = useMemo(() => {
    const result = [];
    for (let i = 0; i < tileCount; i++) {
      const { row, col } = plotFromIndex(i);
      const building = byPlotIndex.get(i);
      const isNewest = building?.id === justBuiltId;
      result.push(
        <div
          key={i}
          ref={isNewest ? newestTileRef : undefined}
          className="town-tile"
          style={{ gridColumn: col + 1, gridRow: row + 1 }}
        >
          {building ? (
            <PlaceholderBuilding categoryId={building.categoryId} variantIndex={building.variantIndex} justBuilt={isNewest} />
          ) : (
            <EmptyLot />
          )}
        </div>,
      );
    }
    return result;
  }, [tileCount, byPlotIndex, justBuiltId]);

  // F3: "New buildings animate in; the view auto-scrolls to the newest."
  useEffect(() => {
    if (justBuiltId === null) return;
    newestTileRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [justBuiltId]);

  return (
    <div className="town-grid" style={{ gridTemplateColumns: `repeat(${TOWN_COLUMNS}, 1fr)` }}>
      {tiles}
    </div>
  );
}

export const TownGrid = memo(TownGridImpl);
