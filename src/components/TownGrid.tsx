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
 *
 * ADDENDUM-05 §2 (F-EXP): `.town-grid` is now wrapped in a `.town-viewport`
 * (native `overflow-x: auto` — no gesture library, no pinch-zoom) plus a
 * zoom-to-fit toggle button. The button is a SIBLING of `.town-grid`, never a
 * child (AC-M7's direct-children guard is about `.town-grid` itself, not this
 * wrapper). The zoom scale is a runtime DOM measurement (`scrollWidth` /
 * `scrollHeight`), not a townLayout.ts constant, so rule R-3 doesn't apply to
 * it — there is nothing to source from townLayout.ts because nothing here is
 * a fixed pixel/grid metric.
 *
 * Gesture safety: `useTileGestures`'s long-press/tap resolution reads
 * `event.target.closest("[data-plot-index]")` and raw `event.clientX/clientY`
 * pointer deltas (LONG_PRESS_TOLERANCE_PX) — both are POST-transform browser
 * values (DOM hit-testing and pointer coordinates already account for any
 * CSS `transform: scale()` on an ancestor), so neither needs dividing by the
 * zoom scale. Verified by mounting with the zoom toggle active and replaying
 * the same long-press pointer sequence the un-zoomed suite already drives
 * (`TownGrid.test.tsx`).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTileGestures } from "../hooks/useTileGestures";
import { openPlotCount } from "../placement";
import { levelOf } from "../selectors";
import {
  BLOCK_ROWS,
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
  TERRACE_BLEED_PX,
  TERRACE_DROP_PX,
  TERRACE_EARTH_PX,
  TILE_HEIGHT_PX,
  blockCount,
  blockFirstRow,
  cellFromIndex,
  decorVariant,
  gridRowCount,
  isCrossStreetRow,
  isPrimeLot,
  roadSideOf,
  terraceEdgeInsetPx,
  terraceTintOf,
} from "../townLayout";
import type { Building, SavingCategoryId } from "../types";
import { EmptyLot } from "./EmptyLot";
import { NpcLayer } from "./NpcLayer";
import { PlaceholderBuilding } from "./PlaceholderBuilding";
import { SavingsRow } from "./SavingsRow";

export interface TownGridProps {
  nextPlotIndex: number;
  buildings: readonly Building[];
  justBuiltId: string | null;
  /** Per-structure cumulative KRW — drives each savings structure's level (ADDENDUM-01 §2.4/break B14). */
  savingsByCategoryKrw: Partial<Record<SavingCategoryId, number>> | undefined;
  /** The shared default ladder — sizes the savings block's shared row height (BALANCE.savingsTowerSegments, D-13). */
  ladder: readonly number[];
  /** Per-structure overrides — BALANCE.savingsStructureSegments (D-13a). Ships `{}`. */
  ladderOverrides: Partial<Record<SavingCategoryId, readonly number[]>>;
  /** ADDENDUM-04 §8 — BALANCE.expPerLevel/maxLevel, threaded through like every other dial (this component imports no balance config of its own). */
  expPerLevel: number;
  maxLevel: number;
  /** The structure that just gained a level, and a per-event sequence number (§2.6a). */
  justGrew: { id: SavingCategoryId; seq: number } | null;
  /** The rise animation ended — clears `justGrew` (round-4 finding C1 #2, threaded straight through to `SavingsRow`). */
  onRiseSettled: () => void;
  // ADDENDUM-02 §4.3/§7.1 (B19) — the grid owns the delegated gesture
  // surface, so it owns these too. Required (not optional): a forgetful call
  // site is a compile error, not a dead feature.
  /** The building currently being moved, or null outside move mode. */
  movingId: string | null;
  /** Roving keyboard cursor (`aria-activedescendant`) — null until the first arrow key. */
  cursorIndex: number | null;
  /**
   * ADDENDUM-05 §3 (F-NPC) — how many animal NPCs to render. The store owns
   * the rule (`min(1 + buildings.length + purchasedNpcSlots, NPC_MAX_VISIBLE)`)
   * and this component only forwards it; neither the grid nor `NpcLayer`
   * reimplements the count.
   */
  npcCount: number;
  /**
   * A building tile was long-pressed (or Enter'd while not in move mode).
   * Returns whether it actually grabbed a building — see
   * `useTileGestures`'s `onLongPress` contract (round-2 finding C2 #1).
   */
  onPlotLongPress: (plotIndex: number) => boolean;
  /** A tile was tapped (or Enter'd while in move mode) — the caller decides what it means. */
  onPlotTap: (plotIndex: number) => void;
  /** An arrow key moved the roving cursor to this (already-clamped) index. */
  onCursorMove: (nextIndex: number) => void;
  /**
   * ADDENDUM-04 §4 — the live grow-candidate ids while grid pick-mode is
   * active (undefined/empty outside it). Building tiles whose id is a member
   * get the highlight class; never set together with move mode (`TownScreen`
   * keeps the two mutually exclusive).
   */
  growCandidateIds?: ReadonlySet<string>;
  /**
   * [취소] / Escape / Android back — cancels move mode outright. A dedicated
   * prop rather than reusing `onPlotTap` at the moving building's own plot:
   * "tap the moving tile again" and "press Escape" are two different user
   * intents that happened to produce the same result; coupling them meant any
   * future change to the tap-the-moving-tile semantics would silently
   * redefine what Escape does too (round-2 finding C3 #5). `useMoveMode`'s
   * `cancel` is idempotent, so wiring it unconditionally here is safe even
   * outside move mode.
   */
  onCancel: () => void;
}

function TownGridImpl({
  nextPlotIndex,
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

  // ADDENDUM-05 §2 — zoom-to-fit toggle. Default is 1:1 (`zoomedOut === false`,
  // "크게 보기" view) per the spec: a first-time user should see readable
  // buildings, not a shrunk town. `zoomScale` is null at 1:1 (no transform, no
  // measuring needed) and only computed while zoomed out.
  const [zoomedOut, setZoomedOut] = useState(false);
  const [zoomScale, setZoomScale] = useState<{ scale: number; heightPx: number } | null>(null);

  const byPlotIndex = useMemo(() => {
    const map = new Map<number, Building>();
    for (const b of buildings) map.set(b.plotIndex, b);
    return map;
  }, [buildings]);

  // ADDENDUM-02 §3.2/§7.2 (B20): the pool a random placement/move can land in
  // (rule R-5 — "the pool is what's on screen"), not the raw growth-frontier
  // counter. `openPlotCount` is always >= `renderedTileCount(nextPlotIndex)`,
  // so this is also the DE-2 latent-bug fix: a building whose plotIndex came
  // from a move/import/corrupt-recovery can never sit outside the rendered
  // grid. Idempotent with the mount points this component's own test uses
  // (§7.2's per-file verdict), because openPlotCount is already a whole
  // number of blocks.
  const tileCount = openPlotCount(nextPlotIndex, buildings);
  const rowCount = gridRowCount(tileCount);

  // ADDENDUM-05 §2 — recompute the zoom scale whenever zoom is toggled on, or
  // the town grows (tileCount) while it's already on. Measured off the live
  // DOM (`scrollWidth`/`scrollHeight`), not townLayout.ts constants (rule R-3
  // is about FIXED pixel/grid metrics, not a runtime layout measurement — the
  // same category of value `scrollIntoView` above already reads).
  // `scrollWidth`/`scrollHeight` reflect the grid's pre-transform box, so
  // they're stable to read regardless of the CURRENT transform.
  useEffect(() => {
    if (!zoomedOut) return;
    const grid = gridRef.current;
    const viewport = viewportRef.current;
    if (!grid || !viewport) return;
    function recompute() {
      const worldWidth = grid!.scrollWidth;
      const worldHeight = grid!.scrollHeight;
      const availableWidth = viewport!.clientWidth;
      const scale = worldWidth > 0 ? Math.min(1, availableWidth / worldWidth) : 1;
      setZoomScale({ scale, heightPx: worldHeight * scale });
    }
    recompute();
    // Orientation change / window resize while zoomed out — native listener,
    // no ResizeObserver dependency needed for a toggle this cheap to recompute.
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [zoomedOut, tileCount]);

  const tiles = useMemo(() => {
    const result = [];
    for (let i = 0; i < tileCount; i++) {
      const { row, col } = cellFromIndex(i);
      const building = byPlotIndex.get(i);
      const isNewest = building?.id === justBuiltId;
      const side = roadSideOf(col);
      // ADDENDUM-06 §2.2/§3.3: a 명당 (prime lot) is one of the two
      // street-front tiles on a block's first plot row. The streetlight used
      // to mark every SECOND block (decorVariant filter); that filter is
      // dropped here — the lamp now marks every 명당, so it means something.
      const isPrime = isPrimeLot(row, col);
      const hasStreetlight = isPrime;

      // ADDENDUM-02 §4.3/§4.4 — move mode state, primitives only (movingId)
      // so this memo's dep list stays cheap even on the dense fixture (§4.3's
      // memoisation note). `cursorIndex` is deliberately NOT a dep here (see
      // the cursor-highlight effect below): a dense town's arrow-key press
      // would otherwise rebuild every one of ~5,400 tiles to move a 2-tile
      // outline (round-2 finding C4 #7) — the cursor class is instead applied
      // imperatively to the two affected DOM nodes.
      const isMoving = building !== undefined && building.id === movingId;
      const isDroppable = movingId !== null && building === undefined; // every free lot is droppable (G2 guarantees >= 1)
      // ADDENDUM-04 §4 — grid pick-mode highlight; mirrors town-tile--droppable's shape with its own class.
      const isGrowCandidate = building !== undefined && (growCandidateIds?.has(building.id) ?? false);
      const stateClasses =
        (isMoving ? " town-tile--moving" : "") +
        (isDroppable ? " town-tile--droppable" : "") +
        (isGrowCandidate ? " town-tile--grow-candidate" : "") +
        (isPrime ? " town-tile--prime" : "");

      // §4.4 DOM contract: role="button" + aria-label on building tiles
      // always, and on an empty tile only while droppable — never on inert
      // ground. ADDENDUM-06 §3.3: a droppable 명당 gets its own label — the
      // perk must never be conveyed by colour (the paving/ring) alone.
      const a11yProps = building
        ? { role: "button" as const, "aria-label": "건물, 길게 눌러 옮기기", "aria-selected": isMoving ? ("true" as const) : undefined }
        : isDroppable
          ? { role: "button" as const, "aria-label": isPrime ? "명당 빈 터, 여기로 옮기기" : "빈 터, 여기로 옮기기" }
          : {};

      result.push(
        <div
          key={i}
          id={`plot-${i}`}
          data-plot-index={i}
          ref={isNewest ? newestTileRef : undefined}
          className={`town-tile town-tile--${side}${hasStreetlight ? " town-tile--streetlight" : ""}${stateClasses}`}
          style={{ gridColumn: col + 1, gridRow: row + 1 }}
          {...a11yProps}
        >
          {building ? (
            <PlaceholderBuilding
              categoryId={building.categoryId}
              variantIndex={building.variantIndex}
              justBuilt={isNewest}
              level={levelOf(building, expPerLevel, maxLevel)}
              monumentPeriod={building.source.kind === "monument" ? building.source.period : undefined}
            />
          ) : (
            <EmptyLot variant={decorVariant(row, col, 3) as 0 | 1 | 2} />
          )}
        </div>,
      );
    }
    return result;
    // `byPlotIndex` is rebuilt (new Map) whenever `buildings` itself changes —
    // including an in-place grow that only bumps one building's `exp` — so a
    // level change re-renders its tile through this same dep with no extra
    // dep needed for "exp changed" specifically (ADDENDUM-04 task note).
  }, [tileCount, byPlotIndex, justBuiltId, movingId, growCandidateIds, expPerLevel, maxLevel]);

  // Cursor highlight applied imperatively, NOT baked into the `tiles` memo
  // above (see its comment): a repeated arrow-key press only needs to move a
  // class between (at most) two existing DOM nodes, not rebuild ~5,400 React
  // elements. Re-runs whenever `tiles` itself changes too, so a fresh render
  // (movingId flip, a new building, etc.) re-applies the highlight to
  // whatever node now lives at `cursorIndex`.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const current = grid.querySelector<HTMLElement>(".town-tile--cursor");
    if (current && Number(current.dataset.plotIndex) !== cursorIndex) current.classList.remove("town-tile--cursor");
    if (cursorIndex !== null) grid.querySelector<HTMLElement>(`#plot-${cursorIndex}`)?.classList.add("town-tile--cursor");
  }, [cursorIndex, tiles]);

  // Enter/Space on the roving cursor is the keyboard equivalent of a
  // long-press (outside move mode, on a building) or a tap (in move mode, on
  // whatever the cursor sits on) — dispatched through the SAME two callback
  // props a pointer gesture uses, so `App`'s move-mode semantics have exactly
  // one entry point each (§4.3 "Enter/Space on a building enters move mode;
  // in move mode it commits to the cursor lot").
  const handleActivate = useCallback(
    (plotIndex: number) => {
      if (movingId !== null) {
        onPlotTap(plotIndex);
        return;
      }
      if (byPlotIndex.has(plotIndex)) onPlotLongPress(plotIndex);
    },
    [movingId, byPlotIndex, onPlotTap, onPlotLongPress],
  );

  useTileGestures(gridRef, tileCount, cursorIndex, {
    onLongPress: onPlotLongPress,
    onTap: onPlotTap,
    onCursorMove,
    onActivate: handleActivate,
    onEscape: onCancel,
  });

  // ADDENDUM-06 §2.3 — one terrace slab per plot block, rebuilt only when the
  // town actually grows (P-2): must NOT depend on `buildings`, `movingId`,
  // `cursorIndex`, `npcCount`, `justBuiltId` or `growCandidateIds` — an NPC
  // tick or a keyboard cursor move must not rebuild a single terrace node.
  const terraces = useMemo(() => Array.from({ length: blockCount(tileCount) }, (_, b) => b), [tileCount]);

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

  // ADDENDUM-05 §2 — active only while zoomed out AND a measurement has
  // landed; 1:1 renders with neither a transform nor an explicit wrapper
  // height, i.e. exactly today's untouched layout.
  const activeZoom = zoomedOut ? zoomScale : null;

  return (
    <div className="town-viewport" ref={viewportRef} style={activeZoom ? { height: `${activeZoom.heightPx}px` } : undefined}>
      <div
        ref={gridRef}
        className={`town-grid${movingId !== null ? " town-grid--moving" : ""}`}
        // ADDENDUM-02 §4.3 — one tab stop for the whole town, at any size: no
        // tile ever gets its own `tabIndex` (AC-K1). `aria-activedescendant`
        // is the roving-cursor pattern that lets a single-tab-stop container
        // still announce which lot is "focused".
        tabIndex={0}
        role="group"
        aria-label="마을 지도"
        aria-activedescendant={cursorIndex === null ? undefined : `plot-${cursorIndex}`}
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
            // ADDENDUM-06 §2.3 (C-4/R-3) — the terrace metrics App.css reads
            // with no fallback, exactly like the nine properties above.
            "--terrace-earth-h": `${TERRACE_EARTH_PX}px`,
            "--terrace-drop": `${TERRACE_DROP_PX}px`,
            "--terrace-bleed": `${TERRACE_BLEED_PX}px`,
            // ADDENDUM-05 §2 — zoom-to-fit. A runtime-measured scale, not a
            // townLayout.ts constant (see this file's header comment), so no
            // custom property/rule R-3 concern here — a plain inline
            // transform like `gridColumn`/`gridRow` already are above.
            transform: activeZoom ? `scale(${activeZoom.scale})` : undefined,
            transformOrigin: "top left",
          } as CSSProperties
        }
      >
        {/* ADDENDUM-06 §2.3 — one terrace slab per plot block, emitted FIRST
            so DOM order alone keeps it behind every tile/road/NPC (T-R1; this
            file adds no z-index anywhere, C-8). T-R2: no height/width/padding
            here — the slab fills its grid area by default stretch, and the
            earth band + edge bleed below are pseudo-elements / negative
            margins into `.town-grid`'s own padding, so no grid track size
            changes (AC-6 asserts the resolved tracks are byte-identical). */}
        {terraces.map((b) => (
          <div
            key={`terrace-${b}`}
            className={`town-terrace town-terrace--t${terraceTintOf(b)}`}
            aria-hidden="true"
            style={
              {
                gridColumn: "1 / -1",
                gridRow: `${blockFirstRow(b) + 1} / span ${BLOCK_ROWS}`,
                // T-R3, set inline (not just in App.css) so it holds even if
                // the stylesheet is ever unavailable — same belt-and-braces
                // NpcLayer already uses for its own pointer-events: none.
                pointerEvents: "none",
                // R-3 (C-4): per-instance values arrive inline, exactly like
                // the nine (now twelve) custom properties on `.town-grid`.
                "--terrace-inset-l": `${terraceEdgeInsetPx(b, 0)}px`,
                "--terrace-inset-r": `${terraceEdgeInsetPx(b, 1)}px`,
              } as CSSProperties
            }
          />
        ))}
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
        <SavingsRow
          ladder={ladder}
          ladderOverrides={ladderOverrides}
          savingsByCategoryKrw={savingsByCategoryKrw}
          justGrew={justGrew}
          onRiseSettled={onRiseSettled}
        />
        {tiles}
        {/* ADDENDUM-05 §3 (F-NPC): LAST child of `.town-grid` so it stacks above
            every tile on DOM order alone (App.css deliberately gives `.town-tile`
            no z-index). It is one real grid item spanning the whole grid and
            positions its sprites absolutely inside itself, so AC-M7's
            direct-children guard still holds, and it is `pointer-events: none`
            so an NPC can never swallow a tile tap or a long-press. */}
        <NpcLayer npcCount={npcCount} rowCount={rowCount} />
      </div>
      {/* Never a `.town-grid` child (AC-M7's direct-children guard) — a
          sibling inside `.town-viewport` instead. Native <button>, not TDS's
          `Button`: no bottom-sheet/emotion runtime needed for one toggle. */}
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
