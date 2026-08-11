/**
 * S3 grid (spec §6 S2 / §5 F3) — ADDENDUM-08 §1/§6/§7: the fixed 20x20 map
 * replaces every growing/serpentine/block-masking mechanism. `townLayout.ts`
 * (`TOWN_MAP`) is the single source of truth for terrain; this component
 * contains no grid coordinate or pixel literal of its own (rule R-3) — every
 * `gridColumn`/`gridRow`/size below is read from a townLayout.ts function or
 * constant and set inline, and the CSS custom properties on the container
 * are how App.css reads the same numbers with no fallback.
 *
 * Two render layers, split for §7's performance requirement:
 *  - `TownTerrain` (below): a `memo()` component taking NO PROPS, covering
 *    every non-void cell's elevation tint + road/park/lake surface art. It is
 *    computed ONCE from `TOWN_MAP` at module load (the map never changes at
 *    runtime) and never re-renders after mount, however often buildings,
 *    move mode, or the roving cursor change.
 *  - the ground layer (inside `TownGridImpl`): one element per empty ground
 *    lot, and ONE element per building spanning its whole footprint
 *    (`gridColumn: col+1 / span w`) — never 4 sub-tiles for a 2x2. This is
 *    the only part of the grid that re-renders when `buildings` changes.
 *
 * Wrapped in `React.memo`: a parent re-render for unrelated reasons (e.g.
 * the entry sheet opening/closing) must not rebuild the ground layer either.
 *
 * ADDENDUM-05 §2 / ADDENDUM-08 §7 (F-EXP): `.town-grid` sits inside a
 * `.town-viewport` with native `overflow-x`/`overflow-y: auto` (no gesture
 * library, no pinch-zoom) plus a zoom-to-fit toggle that now fits BOTH axes
 * and opens fit-to-whole-map on first launch (§7). The button is a SIBLING
 * of `.town-grid`, never a child (the direct-children guard below is about
 * `.town-grid` itself, not this wrapper).
 *
 * Gesture safety: `useTileGestures`'s long-press/tap resolution reads
 * `event.target.closest("[data-plot-index]")` and raw `event.clientX/clientY`
 * pointer deltas — both are POST-transform browser values, so neither needs
 * dividing by the zoom scale.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTileGestures } from "../hooks/useTileGestures";
import { anchorsFor, footprintOf, occupiedCells } from "../placement";
import { levelOf } from "../selectors";
import {
  CELL_COUNT,
  GRID_GAP_PX,
  GRID_PADDING_X_PX,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS,
  PIP_GAP_PX,
  PIP_ROW_GAP_PX,
  PIP_SIZE_PX,
  DISTRICT_ROW_GAP_PX,
  TERRACE_DROP_PX,
  TERRACE_EARTH_PX,
  TERRACE_TINTS,
  cellFromIndex,
  decorVariant,
  elevationBandOf,
  footprintCells,
  isPrimeCell,
  isPrimePlotIndex,
  terrainAt,
  terrainAtIndex,
  type TerrainKind,
} from "../townLayout";
import type { Building, SavingCategoryId } from "../types";
import { EmptyLot } from "./EmptyLot";
import { NpcLayer } from "./NpcLayer";
import { PlaceholderBuilding } from "./PlaceholderBuilding";
import { SavingsRow } from "./SavingsRow";

export interface TownGridProps {
  buildings: readonly Building[];
  justBuiltId: string | null;
  /** Per-structure cumulative KRW — drives each savings structure's level. */
  savingsByCategoryKrw: Partial<Record<SavingCategoryId, number>> | undefined;
  /** The shared default ladder — sizes the savings block's shared row height. */
  ladder: readonly number[];
  /** Per-structure overrides. Ships `{}`. */
  ladderOverrides: Partial<Record<SavingCategoryId, readonly number[]>>;
  expPerLevel: number;
  maxLevel: number;
  /** The structure that just gained a level, and a per-event sequence number. */
  justGrew: { id: SavingCategoryId; seq: number } | null;
  /** The rise animation ended — clears `justGrew`. */
  onRiseSettled: () => void;
  /** The building currently being moved, or null outside move mode. */
  movingId: string | null;
  /** Roving keyboard cursor (`aria-activedescendant`) — null until the first arrow key. */
  cursorIndex: number | null;
  /** How many animal NPCs to render. */
  npcCount: number;
  /**
   * A building tile was long-pressed (or Enter'd while not in move mode).
   * Returns whether it actually grabbed a building.
   */
  onPlotLongPress: (plotIndex: number) => boolean;
  /** A tile was tapped (or Enter'd while in move mode) — the caller decides what it means. Always an ANCHOR index (a multi-cell footprint's non-anchor cells resolve to their anchor before this fires — see `resolveDropTarget` below). */
  onPlotTap: (plotIndex: number) => void;
  /** An arrow key moved the roving cursor to this (already-clamped) index. */
  onCursorMove: (nextIndex: number) => void;
  /** The live grow-candidate ids while grid pick-mode is active. */
  growCandidateIds?: ReadonlySet<string>;
  /** [취소] / Escape / Android back — cancels move mode outright. */
  onCancel: () => void;
}

/**
 * The town's outline (ADDENDUM-08 §1.2): rows 4/9/14 are each elevation
 * band's LAST row — `elevationBandOf(row)` steps down right after them — so
 * this is where the earth-lip cliff hangs (§6). Pure function of `GRID_SIZE`
 * (fixed at 20), computed once.
 */
const BAND_EDGE_ROWS = new Set([4, 9, 14]);

interface TerrainCell {
  index: number;
  row: number;
  col: number;
  kind: Exclude<TerrainKind, "void">;
  band: number;
  bandEdge: boolean;
  bleedRight: boolean;
  bleedBottom: boolean;
  shoreTop: boolean;
  shoreRight: boolean;
  shoreBottom: boolean;
  shoreLeft: boolean;
  decor: number;
  prime: boolean;
  /** A single glyph to paint on THIS cell, or none — park decor is sparse across the whole park, not one bouquet per cell (see `TERRAIN_CELLS` build). */
  glyph: string | null;
  /** Ripple, at most 2 per lake total (one body of water, not one puddle per cell). */
  ripple: boolean;
}

/**
 * One row per non-void cell (332 of 400 — road 93 + park 29 + lake 12 +
 * savings 5 + ground 193). Computed ONCE from `TOWN_MAP` at module load: the
 * map is a fixed authored constant (ADDENDUM-08 §1), so there is nothing here
 * that could ever need recomputing at runtime.
 */
const PARK_GLYPHS: readonly string[] = ["🌳", "🌲", "🪑"];

const TERRAIN_CELLS: TerrainCell[] = (() => {
  const cells: TerrainCell[] = [];
  const lakeIndices: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const kind = terrainAtIndex(i);
    if (kind === "void") continue;
    const { row, col } = cellFromIndex(i);
    const decor = decorVariant(row, col, 3);
    if (kind === "lake") lakeIndices.push(i);
    cells.push({
      index: i,
      row,
      col,
      kind,
      band: elevationBandOf(row),
      bandEdge: BAND_EDGE_ROWS.has(row),
      // Bleed only ever extends right/down, for park/lake/road alike: the gap
      // to a cell's LEFT or ABOVE is already closed by that neighbor's own
      // right/bottom bleed, so checking only these two directions closes
      // every same-kind gap exactly once (no double-bleed, no gap left
      // uncovered) — this is what merges contiguous terrain into one
      // continuous shape instead of a checkerboard of same-colour tiles.
      bleedRight: kind !== "ground" && kind !== "savings" && terrainAt(row, col + 1) === kind,
      bleedBottom: kind !== "ground" && kind !== "savings" && terrainAt(row + 1, col) === kind,
      shoreTop: kind === "lake" && terrainAt(row - 1, col) !== "lake",
      shoreRight: kind === "lake" && terrainAt(row, col + 1) !== "lake",
      shoreBottom: kind === "lake" && terrainAt(row + 1, col) !== "lake",
      shoreLeft: kind === "lake" && terrainAt(row, col - 1) !== "lake",
      decor,
      prime: kind === "ground" && isPrimeCell(row, col),
      // Sparse, not one bouquet per cell: only ~1 in 4 park cells gets a
      // single glyph, scattered by `decorVariant` rather than centred on
      // every tile — that's what reads as "a park", not "a grid of parks".
      glyph: kind === "park" && decorVariant(row, col, 4) === 0 ? PARK_GLYPHS[decor] : null,
      ripple: false, // filled in below, once the full lake is known
    });
  }
  // One body of water gets one or two ripples total, not one per cell —
  // picked deterministically (first and middle of the lake's own cell list,
  // in scan order) so this stays a pure function of the fixed map, no
  // Math.random and no connected-component search (YAGNI: this map has one
  // lake; revisit with real flood-fill grouping if a future map has several).
  const rippleAt = new Set(lakeIndices.length === 0 ? [] : [lakeIndices[0], lakeIndices[Math.floor(lakeIndices.length / 2)]]);
  for (const c of cells) if (rippleAt.has(c.index)) c.ripple = true;
  return cells;
})();

function terrainCellClassName(c: TerrainCell): string {
  const classes = [`town-cell`, `town-cell--${c.kind}`];
  if (c.kind === "ground" || c.kind === "savings") classes.push(`town-cell--band${c.band % TERRACE_TINTS}`);
  if (c.bandEdge) classes.push("town-cell--band-edge");
  if (c.prime) classes.push("town-cell--prime");
  if (c.shoreTop) classes.push("town-cell--shore-t");
  if (c.shoreRight) classes.push("town-cell--shore-r");
  if (c.shoreBottom) classes.push("town-cell--shore-b");
  if (c.shoreLeft) classes.push("town-cell--shore-l");
  return classes.join(" ");
}

/**
 * The static terrain layer — ADDENDUM-08 §7's performance requirement, taken
 * literally: a `memo()` component with NO PROPS never re-renders after
 * mount, however often `buildings`/`movingId`/`cursorIndex` change in the
 * parent. Every visual here (road/park/lake surface, elevation tint + earth
 * lip, the 명당 paving) is a pure function of `(row, col)` alone.
 */
const TownTerrain = memo(function TownTerrain() {
  return (
    <>
      {TERRAIN_CELLS.map((c) => (
        <div
          key={c.index}
          aria-hidden="true"
          className={terrainCellClassName(c)}
          style={{
            gridColumn: c.col + 1,
            gridRow: c.row + 1,
            marginRight: c.bleedRight ? `${-GRID_GAP_PX}px` : undefined,
            marginBottom: c.bleedBottom ? `${-GRID_GAP_PX}px` : undefined,
          }}
        >
          {c.glyph && <span className="town-park-glyph">{c.glyph}</span>}
          {c.ripple && <span className="town-lake-ripple" />}
        </div>
      ))}
    </>
  );
});

function TownGridImpl({
  buildings,
  justBuiltId,
  savingsByCategoryKrw,
  ladder,
  ladderOverrides,
  expPerLevel,
  maxLevel,
  justGrew,
  onRiseSettled,
  movingId,
  cursorIndex,
  npcCount,
  onPlotLongPress,
  onPlotTap,
  onCursorMove,
  growCandidateIds,
  onCancel,
}: TownGridProps) {
  const newestTileRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // ADDENDUM-08 §7 — the map is always visible on day one, at full size: the
  // player's first impression must be the whole town, not a corner of it.
  const [zoomedOut, setZoomedOut] = useState(true);
  const [zoomScale, setZoomScale] = useState<{ scale: number; heightPx: number } | null>(null);

  useEffect(() => {
    if (!zoomedOut) return;
    const grid = gridRef.current;
    const viewport = viewportRef.current;
    if (!grid || !viewport) return;
    function recompute() {
      const worldWidth = grid!.scrollWidth;
      const worldHeight = grid!.scrollHeight;
      const availableWidth = viewport!.clientWidth;
      const availableHeight = viewport!.clientHeight;
      // §7: fit BOTH axes — "전체 보기" must genuinely show all 400 cells at once.
      const scale =
        worldWidth > 0 && worldHeight > 0 ? Math.min(1, availableWidth / worldWidth, availableHeight / worldHeight) : 1;
      setZoomScale({ scale, heightPx: worldHeight * scale });
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [zoomedOut]);

  // ADDENDUM-08 §3/§7 — the ground layer: one element per empty lot, one
  // element per building spanning its whole footprint. The ONLY part of the
  // grid that depends on `buildings`/move-mode/pick-mode state, so this is
  // the only thing that re-renders when a building changes (TownTerrain
  // above never does).
  const { groundTiles, dropAnchorFor, byAnchor } = useMemo(() => {
    const anchorMap = new Map<number, Building>();
    const coveredBy = new Map<number, Building>();
    for (const b of buildings) {
      // plotIndex -1 = reconcile could not seat this building (town full). It
      // is still in state and will get a seat when one frees up, but it owns
      // no cells, so it must not claim any here — a phantom in `coveredBy`
      // would hide the real building standing on that cell.
      if (b.plotIndex < 0) continue;
      anchorMap.set(b.plotIndex, b);
      const { w, h } = footprintOf(b);
      for (const cell of footprintCells(b.plotIndex, w, h)) coveredBy.set(cell, b);
    }

    // §3.1/§4.3 — a move target is an ANCHOR whose whole footprint must fit.
    // Every cell of every legal anchor gets the droppable highlight (a 2x2
    // drop target highlights all 4 cells), and a tap on any of those cells
    // resolves to its anchor (`dropAnchorFor`) before reaching `onPlotTap` —
    // the caller only ever sees anchor indices.
    const dropAnchors = new Map<number, number>();
    const movingBuilding = movingId === null ? undefined : buildings.find((b) => b.id === movingId);
    if (movingBuilding) {
      const { w, h } = footprintOf(movingBuilding);
      const occupied = occupiedCells(buildings.filter((b) => b.id !== movingId));
      for (const anchor of anchorsFor(w, h, occupied)) {
        for (const cell of footprintCells(anchor, w, h)) dropAnchors.set(cell, anchor);
      }
    }

    const elements: ReactNode[] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      if (terrainAtIndex(i) !== "ground") continue; // only ground cells ever hold a lot/building
      const covering = coveredBy.get(i);
      if (covering && covering.plotIndex !== i) continue; // part of a multi-cell building — drawn once, at its anchor
      const { row, col } = cellFromIndex(i);

      if (covering) {
        const { w, h } = footprintOf(covering);
        const isNewest = covering.id === justBuiltId;
        const isMoving = covering.id === movingId;
        const isGrowCandidate = growCandidateIds?.has(covering.id) ?? false;
        // §6 — a multi-cell building counts as prime if ANY cell of its footprint is prime.
        const isPrime = footprintCells(i, w, h).some(isPrimePlotIndex);
        const stateClasses =
          (isMoving ? " town-tile--moving" : "") +
          (isGrowCandidate ? " town-tile--grow-candidate" : "") +
          (isPrime ? " town-tile--prime" : "");
        elements.push(
          <div
            key={i}
            id={`plot-${i}`}
            data-plot-index={i}
            ref={isNewest ? newestTileRef : undefined}
            className={`town-tile${stateClasses}`}
            style={{ gridColumn: `${col + 1} / span ${w}`, gridRow: `${row + 1} / span ${h}` }}
            role="button"
            aria-label="건물, 길게 눌러 옮기기"
            aria-selected={isMoving ? ("true" as const) : undefined}
          >
            <PlaceholderBuilding
              categoryId={covering.categoryId}
              variantIndex={covering.variantIndex}
              justBuilt={isNewest}
              level={levelOf(covering, expPerLevel, maxLevel)}
              monumentPeriod={covering.source.kind === "monument" ? covering.source.period : undefined}
              w={w as 1 | 2}
              h={h as 1 | 2}
            />
          </div>,
        );
      } else {
        const isDroppable = dropAnchors.has(i);
        const isPrime = isPrimeCell(row, col);
        const a11yProps = isDroppable
          ? { role: "button" as const, "aria-label": isPrime ? "명당 빈 터, 여기로 옮기기" : "빈 터, 여기로 옮기기" }
          : {};
        elements.push(
          <div
            key={i}
            id={`plot-${i}`}
            data-plot-index={i}
            className={`town-tile${isDroppable ? " town-tile--droppable" : ""}${isPrime ? " town-tile--prime" : ""}`}
            style={{ gridColumn: col + 1, gridRow: row + 1 }}
            {...a11yProps}
          >
            <EmptyLot variant={decorVariant(row, col, 3) as 0 | 1 | 2} />
          </div>,
        );
      }
    }
    return { groundTiles: elements, dropAnchorFor: dropAnchors, byAnchor: anchorMap };
  }, [buildings, movingId, growCandidateIds, justBuiltId, expPerLevel, maxLevel]);

  const resolveDropTarget = useCallback((plotIndex: number) => dropAnchorFor.get(plotIndex) ?? plotIndex, [dropAnchorFor]);

  // Cursor highlight applied imperatively (not baked into the ground-tiles
  // memo above): a repeated arrow-key press only needs to move a class
  // between (at most) two existing DOM nodes, not rebuild the ground layer.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const current = grid.querySelector<HTMLElement>(".town-tile--cursor");
    if (current && Number(current.dataset.plotIndex) !== cursorIndex) current.classList.remove("town-tile--cursor");
    if (cursorIndex !== null) grid.querySelector<HTMLElement>(`#plot-${cursorIndex}`)?.classList.add("town-tile--cursor");
  }, [cursorIndex, groundTiles]);

  // Enter/Space on the roving cursor is the keyboard equivalent of a
  // long-press (outside move mode, on a building) or a tap (in move mode, on
  // whatever the cursor sits on) — dispatched through the SAME two callback
  // props a pointer gesture uses.
  const handleActivate = useCallback(
    (plotIndex: number) => {
      if (movingId !== null) {
        onPlotTap(resolveDropTarget(plotIndex));
        return;
      }
      if (byAnchor.has(plotIndex)) onPlotLongPress(plotIndex);
    },
    [movingId, byAnchor, onPlotTap, onPlotLongPress, resolveDropTarget],
  );

  useTileGestures(gridRef, CELL_COUNT, cursorIndex, {
    onLongPress: onPlotLongPress,
    onTap: (plotIndex) => onPlotTap(resolveDropTarget(plotIndex)),
    onCursorMove,
    onActivate: handleActivate,
    onEscape: onCancel,
  });

  // F3: "New buildings animate in; the view auto-scrolls to the newest."
  useEffect(() => {
    if (justBuiltId === null) return;
    newestTileRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [justBuiltId]);

  const activeZoom = zoomedOut ? zoomScale : null;

  return (
    <div className="town-viewport" ref={viewportRef} style={activeZoom ? { height: `${activeZoom.heightPx}px` } : undefined}>
      <div
        ref={gridRef}
        className={`town-grid${movingId !== null ? " town-grid--moving" : ""}`}
        // ADDENDUM-02 §4.3 — one tab stop for the whole town, at any size: no
        // tile ever gets its own `tabIndex`. `aria-activedescendant` is the
        // roving-cursor pattern that lets a single-tab-stop container still
        // announce which lot is "focused".
        tabIndex={0}
        role="group"
        aria-label="마을 지도"
        aria-activedescendant={cursorIndex === null ? undefined : `plot-${cursorIndex}`}
        style={
          {
            gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
            gridTemplateRows: GRID_TEMPLATE_ROWS,
            "--town-gap": `${GRID_GAP_PX}px`,
            "--town-grid-pad-x": `${GRID_PADDING_X_PX}px`,
            "--district-row-gap": `${DISTRICT_ROW_GAP_PX}px`,
            "--pip-size": `${PIP_SIZE_PX}px`,
            "--pip-gap": `${PIP_GAP_PX}px`,
            "--pip-row-gap": `${PIP_ROW_GAP_PX}px`,
            "--terrace-earth-h": `${TERRACE_EARTH_PX}px`,
            "--terrace-drop": `${TERRACE_DROP_PX}px`,
            // ADDENDUM-05 §2 / ADDENDUM-08 §7 — zoom-to-fit. A runtime-measured
            // scale, not a townLayout.ts constant, so rule R-3 doesn't reach
            // it — a plain inline transform like `gridColumn`/`gridRow` already are above.
            transform: activeZoom ? `scale(${activeZoom.scale})` : undefined,
            transformOrigin: "top left",
          } as CSSProperties
        }
      >
        <TownTerrain />
        {groundTiles}
        <SavingsRow
          ladder={ladder}
          ladderOverrides={ladderOverrides}
          savingsByCategoryKrw={savingsByCategoryKrw}
          justGrew={justGrew}
          onRiseSettled={onRiseSettled}
        />
        {/* LAST child so it stacks above every tile on DOM order alone
            (App.css deliberately gives `.town-tile`/`.town-cell` no z-index). */}
        <NpcLayer npcCount={npcCount} />
      </div>
      {/* Never a `.town-grid` child — a sibling inside `.town-viewport` instead. */}
      <button
        type="button"
        className="town-zoom-toggle"
        aria-pressed={zoomedOut}
        aria-label={zoomedOut ? "크게 보기로 전환" : "전체 보기로 전환"}
        onClick={() => setZoomedOut((z) => !z)}
      >
        {zoomedOut ? "크게 보기" : "전체 보기"}
      </button>
    </div>
  );
}

export const TownGrid = memo(TownGridImpl);
