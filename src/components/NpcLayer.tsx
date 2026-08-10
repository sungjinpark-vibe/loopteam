/**
 * NPC overlay — PM-DECISIONS §F-NPC / ADDENDUM-05 §3. The LAST child of
 * `.town-grid`, spanning the whole grid (`gridColumn`/`gridRow: "1 / -1"`)
 * as ONE grid item (AC-M7's direct-children guard: sprites live inside this
 * one item, never as their own `.town-grid` children) with
 * `pointer-events: none` so an NPC can never swallow a tile tap or a
 * long-press.
 *
 * One `setInterval` for the whole layer (~2.5s/step) drives every NPC's
 * `movement.ts` step at once — never one timer per sprite. The interval is
 * a repaint trigger only: NPC position/species is derived (species is a
 * pure function of array index) and never persisted (rule R-2).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { random } from "../platform/random";
import { GRID_COLUMNS, isRoadCell } from "../townLayout";
import { initialNpcStates, stepNpcs, type NpcState } from "../npc/movement";
import { speciesForIndex } from "../npc/species";
import { NpcSprite } from "../npc/NpcSprite";
import "../npc.css";

export interface NpcLayerProps {
  /**
   * Sprite count. Computed by the caller as
   * `min(1 + buildings.length + purchasedNpcSlots, NPC_MAX_VISIBLE)`
   * (`economy/types.ts`'s `NPC_MAX_VISIBLE`) — this component does not
   * reimplement that rule, it only renders `npcCount` sprites.
   */
  npcCount: number;
  /**
   * Row count of the currently rendered town grid
   * (`gridRowCount(openPlotCount(...))`, `townLayout.ts` — the same value
   * `TownGrid` derives its own row count from). Bounds the road network
   * NPCs may walk: `isRoadCell(row, col)` is otherwise unbounded above.
   */
  rowCount: number;
}

const STEP_INTERVAL_MS = 2500; // ~2.5s/tick, PM-DECISIONS §F-NPC

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
}

function NpcLayerImpl({ npcCount, rowCount }: NpcLayerProps) {
  const roadCells = useMemo(() => {
    const cells: { row: number; col: number }[] = [];
    for (let row = 0; row < rowCount; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        if (isRoadCell(row, col)) cells.push({ row, col });
      }
    }
    return cells;
  }, [rowCount]);

  const isWalkable = useCallback(
    (row: number, col: number) => row >= 0 && row < rowCount && col >= 0 && col < GRID_COLUMNS && isRoadCell(row, col),
    [rowCount],
  );

  const [npcs, setNpcs] = useState<NpcState[]>(() => initialNpcStates(npcCount, roadCells));

  // Re-seed positions whenever the visible count or the road network itself
  // changes (town grew a row, etc.) — species/position are derived, never
  // migrated, so a full re-seed is the simple, correct choice (R-2).
  useEffect(() => {
    setNpcs(initialNpcStates(npcCount, roadCells));
  }, [npcCount, roadCells]);

  useEffect(() => {
    if (prefersReducedMotion()) return; // render in place, never move (ADDENDUM-05 §3)
    const id = setInterval(() => {
      setNpcs((prev) => stepNpcs(prev, isWalkable, random));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isWalkable]);

  // Real grid track geometry, read off the live DOM. Uniform `col/GRID_COLUMNS`
  // fractions are NOT good enough here: the road column is 22px against the
  // plots' 52px, and a savings row is ~250px against a plot row's 72px — so a
  // uniform fraction put NPCs on top of the 저축 structures instead of on the
  // street. Resolved `grid-template-*` values are already in px, so this is a
  // measurement, not a second source of truth for any constant (rule R-3).
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [tracks, setTracks] = useState<{ cols: number[]; rows: number[]; gap: number } | null>(null);
  useEffect(() => {
    const grid = layerRef.current?.parentElement;
    if (!grid) return;
    function measure() {
      const cs = getComputedStyle(grid!);
      const parse = (v: string) => v.split(/\s+/).filter(Boolean).map(parseFloat);
      setTracks({ cols: parse(cs.gridTemplateColumns), rows: parse(cs.gridTemplateRows), gap: parseFloat(cs.gap) || 0 });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rowCount, npcCount]);

  // Prefix sums, so placing an NPC is O(1) instead of walking the row array.
  // The dense fixture has ~1,000 grid rows and this runs per sprite per render.
  const offsets = useMemo(() => {
    if (!tracks) return null;
    const acc = (sizes: number[]) => {
      const out = [0];
      for (let i = 0; i < sizes.length; i++) out.push(out[i] + sizes[i] + tracks.gap);
      return out;
    };
    return { x: acc(tracks.cols), y: acc(tracks.rows) };
  }, [tracks]);

  /** Centre of grid cell (row, col) in px, relative to the layer's own box. */
  function centreOf(row: number, col: number): { x: number; y: number } | null {
    if (!tracks || !offsets || tracks.cols.length === 0 || tracks.rows.length === 0) return null;
    const c = Math.min(col, tracks.cols.length - 1);
    const r = Math.min(row, tracks.rows.length - 1);
    return { x: offsets.x[c] + tracks.cols[c] / 2, y: offsets.y[r] + tracks.rows[r] / 2 };
  }

  return (
    <div
      ref={layerRef}
      className="npc-layer"
      // `1 / -1` would collapse to a SINGLE row here: `.town-grid` declares no
      // `grid-template-rows`, so it has no explicit last row line to count back
      // from (the same trap `.town-main-street` documents). Spanning the real
      // row count is what makes this layer as tall as the town.
      style={{ gridColumn: "1 / -1", gridRow: `1 / span ${Math.max(1, rowCount)}`, pointerEvents: "none" }}
      aria-hidden="true"
    >
      {npcs.map((npc, i) => {
        const centre = centreOf(npc.row, npc.col);
        // Before the first measurement, fall back to uniform fractions — one
        // frame of approximate placement beats not rendering the town's animals.
        const style = centre
          ? { left: `${centre.x}px`, top: `${centre.y}px` }
          : {
              left: `${((npc.col + 0.5) / GRID_COLUMNS) * 100}%`,
              top: `${rowCount > 0 ? ((npc.row + 0.5) / rowCount) * 100 : 0}%`,
            };
        return (
          <div key={i} className="npc-slot" data-npc-cell={`${npc.row},${npc.col}`} style={style}>
            <div className={`npc-sprite${npc.facingLeft ? " npc-sprite--flip" : ""}`}>
              <NpcSprite species={speciesForIndex(i)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Memoized on `{ npcCount, rowCount }`. `TownGrid` re-renders on every roving
 * keyboard-cursor move and every move-mode transition; without this, each one
 * dragged the whole NPC layer through render for no reason. The layer's own
 * ~2.5s timer is what drives it, not its parent.
 */
export const NpcLayer = memo(NpcLayerImpl);
