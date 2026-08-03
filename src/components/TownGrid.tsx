/**
 * S3 grid (spec §6 S2 / §5 F3), rebuilt as a road-based village block plan —
 * ADDENDUM-01 §3.4. One continuous main street down the centre, a cross
 * street bounding every block, and the 저축 블록 (savings block) at the
 * town's head — rendered here as five empty lots + one signpost; the real
 * savings structures land in the next task (ADDENDUM-01 §6 "Ordering note").
 *
 * Layout is entirely driven by `townLayout.ts` — this component contains no
 * grid coordinate or pixel literal of its own (rule R-3, ADDENDUM-01 §3.5):
 * every `gridColumn`/`gridRow`/size below is read from a townLayout.ts
 * function or constant and set inline, and the nine CSS custom properties on
 * the container are how App.css reads the same numbers with no fallback.
 *
 * Wrapped in `React.memo`: this is the town's biggest subtree, and its props
 * only change when `useTownStore` actually mutates town state — a parent
 * re-render for unrelated reasons (e.g. the entry sheet opening/closing)
 * must not rebuild every tile.
 */
import { memo, useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  DISTRICT_ROW_GAP_PX,
  GRID_GAP_PX,
  GRID_PADDING_X_PX,
  GRID_TEMPLATE_COLUMNS,
  PIP_GAP_PX,
  PIP_ROW_GAP_PX,
  PIP_SIZE_PX,
  ROAD_COLUMN,
  ROAD_HEIGHT_PX,
  ROAD_WIDTH_PX,
  TILE_HEIGHT_PX,
  blockIndexOf,
  cellFromIndex,
  decorVariant,
  gridRowCount,
  isBlockFirstRow,
  isCrossStreetRow,
  isStreetFrontCol,
  renderedTileCount,
  roadSideOf,
} from "../townLayout";
import type { Building } from "../types";
import { EmptyLot } from "./EmptyLot";
import { PlaceholderBuilding } from "./PlaceholderBuilding";
import { SavingsRow } from "./SavingsRow";

export interface TownGridProps {
  nextPlotIndex: number;
  buildings: readonly Building[];
  justBuiltId: string | null;
  /** The shared default ladder — sizes the savings block's shared row height (BALANCE.savingsTowerSegments, D-13). */
  ladder: readonly number[];
}

function TownGridImpl({ nextPlotIndex, buildings, justBuiltId, ladder }: TownGridProps) {
  const newestTileRef = useRef<HTMLDivElement | null>(null);

  const byPlotIndex = useMemo(() => {
    const map = new Map<number, Building>();
    for (const b of buildings) map.set(b.plotIndex, b);
    return map;
  }, [buildings]);

  const tileCount = renderedTileCount(nextPlotIndex);
  const rowCount = gridRowCount(nextPlotIndex);

  const tiles = useMemo(() => {
    const result = [];
    for (let i = 0; i < tileCount; i++) {
      const { row, col } = cellFromIndex(i);
      const building = byPlotIndex.get(i);
      const isNewest = building?.id === justBuiltId;
      const side = roadSideOf(col);
      // §3.7 checklist item 3: street furniture, zero data — a streetlight on
      // every second block's street-front tile, keyed off decorVariant(row,
      // col) alone (rule R-2). Never stored.
      const hasStreetlight = isStreetFrontCol(col) && isBlockFirstRow(row) && decorVariant(blockIndexOf(row), 0, 2) === 0;
      result.push(
        <div
          key={i}
          ref={isNewest ? newestTileRef : undefined}
          className={`town-tile town-tile--${side}${hasStreetlight ? " town-tile--streetlight" : ""}`}
          style={{ gridColumn: col + 1, gridRow: row + 1 }}
        >
          {building ? (
            <PlaceholderBuilding categoryId={building.categoryId} variantIndex={building.variantIndex} justBuilt={isNewest} />
          ) : (
            <EmptyLot variant={decorVariant(row, col, 3) as 0 | 1 | 2} />
          )}
        </div>,
      );
    }
    return result;
  }, [tileCount, byPlotIndex, justBuiltId]);

  const crossStreets = useMemo(() => {
    const rows = [];
    for (let row = 0; row < rowCount; row++) {
      if (isCrossStreetRow(row)) rows.push(row);
    }
    return rows;
  }, [rowCount]);

  // F3: "New buildings animate in; the view auto-scrolls to the newest."
  useEffect(() => {
    if (justBuiltId === null) return;
    newestTileRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [justBuiltId]);

  return (
    <div
      className="town-grid"
      style={
        {
          gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
          "--town-road-w": `${ROAD_WIDTH_PX}px`,
          "--town-road-h": `${ROAD_HEIGHT_PX}px`,
          "--town-tile-h": `${TILE_HEIGHT_PX}px`,
          "--town-gap": `${GRID_GAP_PX}px`,
          "--town-grid-pad-x": `${GRID_PADDING_X_PX}px`,
          "--district-row-gap": `${DISTRICT_ROW_GAP_PX}px`,
          "--pip-size": `${PIP_SIZE_PX}px`,
          "--pip-gap": `${PIP_GAP_PX}px`,
          "--pip-row-gap": `${PIP_ROW_GAP_PX}px`,
        } as CSSProperties
      }
    >
      <div className="town-main-street" style={{ gridColumn: ROAD_COLUMN + 1, gridRow: `1 / span ${rowCount}` }} />
      {crossStreets.map((row) => {
        // §3.7 checklist item 3: a 버스 정류장 on every second cross street —
        // decorVariant(row, col) alone (rule R-2), never stored.
        const hasBusStop = decorVariant(row, 0, 2) === 0;
        return (
          <div
            key={`cross-${row}`}
            className={`town-cross-street${hasBusStop ? " town-cross-street--busstop" : ""}`}
            style={{ gridColumn: "1 / -1", gridRow: row + 1 }}
          />
        );
      })}
      <SavingsRow ladder={ladder} />
      {tiles}
    </div>
  );
}

export const TownGrid = memo(TownGridImpl);
