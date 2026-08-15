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
 * pure function of array index + `ownedSkus`, see `species.ts#speciesForIndexUnlocked`)
 * and never persisted (rule R-2).
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { random } from "../platform/random";
import { GRID_SIZE, isRoadCell, isWalkable } from "../townLayout";
import { initialNpcStates, reachableCells, stepNpcs, type NpcState } from "../npc/movement";
import { speciesForIndexUnlocked } from "../npc/species";
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
  /** S8 — which shop-tier species are actually unlocked (`species.ts#unlockedSpecies`). Defaults to none (base 6 only). */
  ownedSkus?: readonly string[];
}

const STEP_INTERVAL_MS = 2500; // ~2.5s/tick, PM-DECISIONS §F-NPC

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
}

/**
 * The walkable component that contains the road network, computed once at
 * module load — the map (`townLayout.ts`) is a fixed authored constant, so
 * this never changes at runtime. ADDENDUM-08's map has a few park cells that
 * touch no road (isolated pockets, verified 7 of 122 walkable cells);
 * spawning only inside this component is what stops an NPC from being
 * permanently stranded in one, without editing the authored map.
 */
const SPAWN_CELLS: { row: number; col: number }[] = (() => {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (isRoadCell(row, col)) return reachableCells({ row, col }, isWalkable);
    }
  }
  return []; // unreachable in practice — the map always has road cells
})();

function NpcLayerImpl({ npcCount, ownedSkus = [] }: NpcLayerProps) {
  const [npcs, setNpcs] = useState<NpcState[]>(() => initialNpcStates(npcCount, SPAWN_CELLS));

  // Re-seed positions whenever the visible count changes — species/position
  // are derived, never migrated, so a full re-seed is the simple, correct
  // choice (R-2).
  useEffect(() => {
    setNpcs(initialNpcStates(npcCount, SPAWN_CELLS));
  }, [npcCount]);

  useEffect(() => {
    if (prefersReducedMotion()) return; // render in place, never move (ADDENDUM-05 §3)
    const id = setInterval(() => {
      setNpcs((prev) => stepNpcs(prev, isWalkable, random));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Real grid track geometry, read off the live DOM. A uniform `col/GRID_SIZE`
  // fraction is NOT good enough here: the savings row is taller than a plot
  // row, so a uniform fraction put NPCs on top of the 저축 structures instead
  // of on the street. Resolved `grid-template-*` values are already in px, so
  // this is a measurement, not a second source of truth for any constant
  // (rule R-3) — the uniform 20x20 grid (ADDENDUM-08 §7) makes the columns
  // agree with each other, but the savings row still doesn't.
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
  }, []); // the grid is a fixed 20x20 constant — nothing here ever changes post-mount

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
      // from (the same trap `.town-main-street` documents). Spanning
      // `GRID_SIZE` explicitly is what makes this layer as tall as the town.
      style={{ gridColumn: "1 / -1", gridRow: `1 / span ${GRID_SIZE}`, pointerEvents: "none" }}
      aria-hidden="true"
    >
      {npcs.map((npc, i) => {
        const centre = centreOf(npc.row, npc.col);
        // Before the first measurement, fall back to uniform fractions — one
        // frame of approximate placement beats not rendering the town's animals.
        const style = centre
          ? { left: `${centre.x}px`, top: `${centre.y}px` }
          : {
              left: `${((npc.col + 0.5) / GRID_SIZE) * 100}%`,
              top: `${((npc.row + 0.5) / GRID_SIZE) * 100}%`,
            };
        return (
          <div key={i} className="npc-slot" data-npc-cell={`${npc.row},${npc.col}`} style={style}>
            <div className={`npc-sprite${npc.facingLeft ? " npc-sprite--flip" : ""}`}>
              <NpcSprite species={speciesForIndexUnlocked(i, ownedSkus)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Memoized on `{ npcCount }`. `TownGrid` re-renders on every roving
 * keyboard-cursor move and every move-mode transition; without this, each one
 * dragged the whole NPC layer through render for no reason. The layer's own
 * ~2.5s timer is what drives it, not its parent.
 */
export const NpcLayer = memo(NpcLayerImpl);
