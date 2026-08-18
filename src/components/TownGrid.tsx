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
 * `.town-viewport` with native `overflow-x`/`overflow-y: auto` plus a
 * zoom-to-fit toggle that fits BOTH axes and opens fit-to-whole-map on first
 * launch (§7). The button is a SIBLING of `.town-grid`, never a child (the
 * direct-children guard below is about `.town-grid` itself, not this
 * wrapper).
 *
 * ADDENDUM-09 §3.2/§3.3 — pinch zoom + pan reuse this SAME transform (no
 * wrapper element, no relayout): `scale(k) translate(tx, ty)`, hand-rolled
 * Pointer Events via `useTileGestures`'s 2-pointer arbitration, no gesture
 * library. Pan is transform-owned only above `fitScale`; at or below it,
 * native `.town-viewport` overflow scrolling is the sole owner (§3.3's
 * double-handling guard — see `useTileGestures.ts`'s `onPinchMove`
 * `preventDefault()`).
 *
 * Gesture safety: `useTileGestures`'s long-press/tap resolution reads
 * `event.target.closest("[data-plot-index]")` and raw `event.clientX/clientY`
 * pointer deltas — both are POST-transform browser values, so neither needs
 * dividing by the zoom scale. The pinch math in this file (`handlePinchMove`)
 * relies on the same property: `getBoundingClientRect()` and `clientX/Y` are
 * both in post-transform viewport space, so they compose directly.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { colors } from "@toss/tds-colors";
import { useTileGestures } from "../hooks/useTileGestures";
import { footprintOf, moveAnchorsFor } from "../placement";
import { resolvePinchTransform, type PinchBaseline } from "../pinchTransform";
import { fuseOf, totalLevelOf } from "../selectors";
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
  indexFromCell,
  isPrimeCell,
  isPrimePlotIndex,
  terrainAt,
  terrainAtIndex,
  type TerrainKind,
} from "../townLayout";
import type { Building, SavingCategoryId } from "../types";
import { MAX_ART_OVERHANG_PX } from "./buildingArt";
import { DecorIcons } from "./decorArt";
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
  /** S8 — species skus actually owned, so `NpcLayer` shows only what's been bought (base 6 always show). */
  ownedSkus?: readonly string[];
  /** S8 — 건물 꾸미기: buildingId -> applied deco sku. Gate-3-rerun fix (게임 디자이너 TOP FIX): a purchase used to change nothing on screen. */
  appliedByBuildingId?: Readonly<Record<string, string>>;
  /** S8 — 마을 꾸미기: the one town-wide skin sku currently applied, or none. */
  appliedTownSku?: string | null;
  /**
   * A building tile was long-pressed (or Enter'd while not in move mode).
   * Returns whether it actually grabbed a building.
   */
  onPlotLongPress: (plotIndex: number) => boolean;
  /** A tile was tapped (or Enter'd while in move mode) — the caller decides what it means. Always an ANCHOR index (a multi-cell footprint's non-anchor cells resolve to their anchor before this fires — see `resolveDropTarget` below). */
  onPlotTap: (plotIndex: number) => void;
  /** An arrow key moved the roving cursor to this (already-clamped) index. */
  onCursorMove: (nextIndex: number) => void;
  /**
   * Gate-3-rerun fix (round-3, all five expert lenses) — a hold-drag-release
   * that ended on no tile at all (outside `.town-grid` entirely). Only ever
   * fires mid-move (grow/fuse pick-mode's long-press is swapped for a no-op,
   * so it never arms this path); wired straight to `useTileGestures`'s own
   * `onInvalidDrop`, no `resolveDropTarget` needed since there is no
   * `plotIndex` to resolve.
   */
  onInvalidDrop: () => void;
  /** The live grow-candidate ids while grid pick-mode is active. */
  growCandidateIds?: ReadonlySet<string>;
  /** [취소] / Escape / Android back — cancels move mode outright. */
  onCancel: () => void;
  /**
   * 명당 (prime lot) ring tapped (user report 2026-08-19, part b). `TownGrid`
   * only reports the tap — it owns no toast/overlay primitive itself (keeps
   * this component's own dependency list at zero vendor context providers,
   * so every bare `mountComponent(<TownGrid ... />)` test, including the
   * perf-smoke ones in `src/devtools/`, keeps working with no provider
   * wrapper). The caller (`TownScreen.tsx`, which already owns every other
   * toast in the app) decides what "explain this" means. Optional: callers
   * that don't render the ring's tap target at all (none currently) can omit
   * it — the button still renders either way, it just becomes inert.
   */
  onPrimeTap?: () => void;
}

/**
 * The town's outline (ADDENDUM-08 §1.2): rows 4/9/14 are each elevation
 * band's LAST row — `elevationBandOf(row)` steps down right after them — so
 * this is where the earth-lip cliff hangs (§6). Pure function of `GRID_SIZE`
 * (fixed at 20), computed once.
 */
const BAND_EDGE_ROWS = new Set([4, 9, 14]);

/**
 * S8 건물 꾸미기 sku -> the glyph its badge shows. A placeholder rendering
 * (one emoji, not a bespoke SVG asset) is the deliberately lazy version of
 * the panel's TOP FIX — it proves the earn -> buy -> apply loop actually
 * ends in something visible, without touching the frozen building-art SVGs.
 * ponytail: upgrade to a real per-sku SVG if/when an artist has time; the
 * `appliedByBuildingId` plumbing this reads from doesn't change either way.
 */
const BUILDING_DECO_GLYPH: Readonly<Record<string, string>> = {
  "deco.building.flowerbed.v1": "🌷",
  "deco.building.mailbox.v1": "📮",
  "deco.building.signboard.v1": "🪧",
  "deco.building.balloon.v1": "🎈",
  "deco.building.streetlamp.v1": "💡",
  "deco.building.cat.v1": "🐱",
};

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
  /** A single decor icon to paint on THIS cell, or none — park decor is sparse across the whole park, not one bouquet per cell (see `TERRAIN_CELLS` build). */
  glyph: ReactNode | null;
  /** Ripple, at most 2 per lake total (one body of water, not one puddle per cell). */
  ripple: boolean;
  /** Street furniture — ADDENDUM-10. Sparse, road/park only, never on a cell that already carries `glyph`. */
  prop: PropKind | null;
}

/** ADDENDUM-10 §2.1 — road gets streetlamp/bench/cart, park gets tree/bench/fountain. */
type PropKind = "lamp" | "bench" | "cart" | "tree" | "fountain";

const ROAD_PROP_KINDS: readonly PropKind[] = ["lamp", "bench", "cart"];
const PARK_PROP_KINDS: readonly PropKind[] = ["tree", "bench", "fountain"];

/**
 * Inline SVGs, one per kind, built ONCE at module load (same discipline as
 * `TERRAIN_CELLS` below) and reused by reference across every cell that
 * shares a kind — `TownTerrain` never re-renders, so this is the entire
 * per-element cost, paid once. `@toss/tds-colors` tokens only (rule: no
 * hand-picked hex), pastel shades (100/300) to sit quietly under buildings.
 * Each viewBox is 24x24 mapped to a 20-25px box (ADDENDUM-10 §2.1 revised
 * target: +25% over round 1's 16-20px, still well inside the 40x40 cell —
 * the largest, `cart`, is 25x23).
 */
const PROP_ICONS: Record<PropKind, ReactNode> = {
  lamp: (
    <svg viewBox="0 0 24 24" width="20" height="23" aria-hidden="true">
      <rect x="11" y="9" width="2" height="12" fill={colors.grey600} />
      <rect x="8" y="21" width="8" height="2" rx="1" fill={colors.grey600} />
      <circle cx="12" cy="7" r="4" fill={colors.yellow300} />
      <circle cx="12" cy="7" r="2" fill={colors.yellow100} />
    </svg>
  ),
  bench: (
    <svg viewBox="0 0 24 24" width="23" height="18" aria-hidden="true">
      <rect x="3" y="9" width="18" height="2" fill={colors.orange700} />
      <rect x="3" y="13" width="18" height="2" fill={colors.orange700} />
      <rect x="4" y="15" width="2" height="5" fill={colors.orange800} />
      <rect x="18" y="15" width="2" height="5" fill={colors.orange800} />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" width="25" height="23" aria-hidden="true">
      <rect x="4" y="8" width="16" height="9" rx="1" fill={colors.teal300} />
      <rect x="3" y="6" width="18" height="3" fill={colors.red300} />
      <circle cx="8" cy="19" r="2" fill={colors.grey700} />
      <circle cx="16" cy="19" r="2" fill={colors.grey700} />
    </svg>
  ),
  tree: (
    <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
      <rect x="11" y="14" width="2" height="7" fill={colors.orange800} />
      <circle cx="12" cy="10" r="7" fill={colors.green300} />
    </svg>
  ),
  fountain: (
    <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
      <circle cx="12" cy="14" r="8" fill="none" stroke={colors.blue300} strokeWidth="2" />
      <circle cx="12" cy="14" r="5" fill={colors.blue100} />
      <circle cx="12" cy="9" r="1.5" fill={colors.blue300} />
    </svg>
  ),
};

/**
 * Connected components of park cells (orthogonal adjacency), computed once
 * from the fixed map. The current map has several separate park regions (top
 * strip, corners, mid-block courtyards) — unlike the single lake body the
 * ripple cap below already handles, so a "cap per body" for the fountain
 * needs an actual grouping rather than one global first/middle pick.
 */
function parkBodyGroups(): number[][] {
  const visited = new Set<number>();
  const groups: number[][] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (terrainAtIndex(i) !== "park" || visited.has(i)) continue;
    const group: number[] = [];
    const stack = [i];
    visited.add(i);
    while (stack.length > 0) {
      const idx = stack.pop() as number;
      group.push(idx);
      const { row, col } = cellFromIndex(idx);
      const neighbors: Array<[number, number]> = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ];
      for (const [r, c] of neighbors) {
        if (terrainAt(r, c) !== "park") continue;
        const ni = indexFromCell({ row: r, col: c });
        if (!visited.has(ni)) {
          visited.add(ni);
          stack.push(ni);
        }
      }
    }
    groups.push(group.sort((a, b) => a - b));
  }
  return groups;
}

/** Cell index -> the lowest index in its own park body — the only cell allowed to seat that body's (at most one) fountain. Mirrors the lake ripple cap at `TERRAIN_CELLS` below, generalized to multiple bodies. */
const FOUNTAIN_SEAT: ReadonlyMap<number, number> = new Map(
  parkBodyGroups().flatMap((group) => group.map((i): [number, number] => [i, group[0]])),
);

/**
 * One row per non-void cell (332 of 400 — road 93 + park 29 + lake 12 +
 * savings 5 + ground 193). Computed ONCE from `TOWN_MAP` at module load: the
 * map is a fixed authored constant (ADDENDUM-08 §1), so there is nothing here
 * that could ever need recomputing at runtime.
 */
// Path-B art upgrade — was literal emoji (🌳🌲🪑), which render differently
// per platform and clash with the app's own art. `decorArt.tsx`'s vectorized
// `DecorIcons` replace them 1:1, indexed the same way `decorVariant` already
// picked an emoji (0/1/2).
const PARK_GLYPHS: readonly ReactNode[] = [DecorIcons.tree, DecorIcons.pine, DecorIcons.bench];

const TERRAIN_CELLS: TerrainCell[] = (() => {
  const cells: TerrainCell[] = [];
  const lakeIndices: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const kind = terrainAtIndex(i);
    if (kind === "void") continue;
    const { row, col } = cellFromIndex(i);
    const decor = decorVariant(row, col, 3);
    if (kind === "lake") lakeIndices.push(i);

    // ADDENDUM-10 §2.1 — street furniture, per cell from terrain, same pass
    // as glyph/ripple. Road: streetlamp/bench/cart, only on a road cell
    // ADJACENT TO GROUND (so it reads as facing a building, not floating
    // mid-road), gated `decorVariant(...,7) < 3` — loosened from round 1's
    // `=== 0` (13 props, visually invisible per the round-1 pixel-diff FAIL)
    // to hit the revised 35-40 target (93 road cells, 87 adjacent to ground
    // -> exactly 40 on the fixed map). Park: tree/bench/fountain, gated on a
    // DIFFERENT decorVariant bucket (modulus 7, not the glyph's modulus 4) so
    // a prop never stacks on a glyph, loosened the same way (1-in-4 cells ->
    // 1-in-2, exactly 11 on the fixed map).
    let prop: PropKind | null = null;
    if (kind === "road") {
      const adjacentToGround =
        terrainAt(row - 1, col) === "ground" ||
        terrainAt(row + 1, col) === "ground" ||
        terrainAt(row, col - 1) === "ground" ||
        terrainAt(row, col + 1) === "ground";
      if (adjacentToGround && decorVariant(row, col, 7) < 3) {
        prop = ROAD_PROP_KINDS[decorVariant(row, col, ROAD_PROP_KINDS.length)];
      }
    } else if (kind === "park") {
      const hasGlyph = decorVariant(row, col, 4) === 0;
      if (FOUNTAIN_SEAT.get(i) === i) {
        // Deterministic: a park body's designated seat cell always gets its
        // one fountain, bypassing the scatter/glyph gates below — otherwise
        // a body's fountain depends on the 1-in-3 scatter lottery landing on
        // that exact cell, which can (and did) miss every seat on the map.
        prop = "fountain";
      } else if (!hasGlyph && decorVariant(row, col, 7) < 3) {
        const guess = PARK_PROP_KINDS[decorVariant(row, col, PARK_PROP_KINDS.length)];
        // Every non-seat cell that guesses "fountain" falls back to a tree —
        // the seat cell above is the only cell allowed to carry one.
        prop = guess === "fountain" ? "tree" : guess;
      }
    }

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
      // §6 — the ring must never sit on top of an EmptyLot's own tree/sprout
      // icon (user report 2026-08-19: read as "a bug drawing a circle on a
      // tree"). `decor` (== `decorVariant(row, col, 3)`) is the SAME value
      // `EmptyLot`'s `variant` prop gets below in the ground-tile loop — 0 is
      // its plain, icon-less lot; 1/2 draw the tree/sprout. Gating on it here
      // keeps the ring off any decorated lot without touching `isPrimeCell`
      // itself (townLayout.ts, economy-facing — a decorated lot is still
      // genuinely prime to build on, only its RING is suppressed).
      prime: kind === "ground" && isPrimeCell(row, col) && decor === 0,
      // Sparse, not one bouquet per cell: only ~1 in 4 park cells gets a
      // single glyph, scattered by `decorVariant` rather than centred on
      // every tile — that's what reads as "a park", not "a grid of parks".
      // Never on the fountain seat — that cell's one decoration is its fountain.
      glyph: kind === "park" && decorVariant(row, col, 4) === 0 && FOUNTAIN_SEAT.get(i) !== i ? PARK_GLYPHS[decor] : null,
      ripple: false, // filled in below, once the full lake is known
      prop,
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
          {c.prop && <span className="town-prop">{PROP_ICONS[c.prop]}</span>}
        </div>
      ))}
    </>
  );
});

// ADDENDUM-09 §3.2 — the pinch scale ceiling. The floor is `fitScale`
// (runtime-measured, per-map), so it isn't a constant here.
const MAX_PINCH_SCALE = 2.5;

/**
 * ADDENDUM-09 §3.3 — keeps a proposed local-space translate from dragging the
 * map fully off-screen: each axis is bounded so the far edge of the world
 * can be pulled at most to the near edge of the viewport, never past it.
 * Returns the translate UNCLAMPED when either measurement is 0 (jsdom does
 * no layout, same guard the fit-scale measurement below already needs) —
 * there is nothing sane to clamp against without a real box.
 */
function clampTranslate(
  tx: number,
  ty: number,
  scale: number,
  worldWidth: number,
  worldHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { tx: number; ty: number } {
  if (worldWidth <= 0 || worldHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return { tx, ty };
  const visibleWidth = viewportWidth / scale;
  const visibleHeight = viewportHeight / scale;
  const minTx = Math.min(0, visibleWidth - worldWidth);
  const minTy = Math.min(0, visibleHeight - worldHeight);
  return { tx: Math.min(0, Math.max(minTx, tx)), ty: Math.min(0, Math.max(minTy, ty)) };
}

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
  ownedSkus,
  appliedByBuildingId,
  appliedTownSku,
  onPlotLongPress,
  onPlotTap,
  onCursorMove,
  growCandidateIds,
  onCancel,
  onInvalidDrop,
  onPrimeTap,
}: TownGridProps) {
  const newestTileRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // 명당 ring tooltip (user report 2026-08-19, part b). `TownGrid` itself
  // owns no toast/overlay primitive (peer review 2026-08-19: an earlier
  // version called `@toss/tds-mobile`'s `useToast` directly here, which made
  // this component hard-depend on `TDSMobileProvider` sitting somewhere
  // above it — broke every bare `mountComponent(<TownGrid ... />)` test,
  // including the perf-smoke ones in `src/devtools/` that intentionally
  // mount it alone). `onPrimeTap` just reports the tap; `TownScreen.tsx`
  // (which already owns every other toast in the app) decides what
  // "explain this" means and fires it with the real mechanic's copy.
  // A ref, not the `onPrimeTap` prop itself, in `handlePrimeTap`'s closure:
  // `groundTiles` below is a perf-critical memo (ADDENDUM-08 §7 — the ONLY
  // part of the grid that rebuilds when `buildings` changes) that this
  // handler is threaded through. Keeping `handlePrimeTap`'s own identity
  // permanently stable (empty dep array) means it never forces that memo to
  // rebuild even if the caller passes a fresh `onPrimeTap` closure every
  // render — same discipline `useTileGestures.ts`'s own `latest` ref uses.
  const onPrimeTapRef = useRef(onPrimeTap);
  useEffect(() => {
    onPrimeTapRef.current = onPrimeTap;
  });
  const handlePrimeTap = useCallback((e: MouseEvent) => {
    // Stop here, before `useTileGestures`'s delegated `click` listener on
    // `.town-grid` sees this — otherwise the tap would ALSO resolve through
    // `onTap`/`onPlotTap` for the tile underneath (this button only ever
    // renders on a non-droppable prime EMPTY lot — see its render site below
    // — so that would be a same-tap double-fire, not a move-mode conflict,
    // but still not what a "just explain this" tap should also trigger).
    // MUST run on the CAPTURE phase (this handler is wired to `onClickCapture`
    // below, not `onClick`): `useTileGestures.ts` attaches its `click`
    // listener with a plain `grid.addEventListener("click", onClick)` — a raw
    // DOM listener, not a React one — which fires during the REAL bubble
    // phase as the native event passes through `.town-grid` on its way up,
    // well before React's own bubble-phase root listener (which is what
    // would eventually invoke a plain `onClick` here) ever gets a turn.
    // Calling `stopPropagation()` from `onClick` is therefore too late — the
    // native listener has already run by then. Capture runs top-down BEFORE
    // that native bubble pass even starts, so stopping it here keeps the
    // event from ever reaching `.town-grid`.
    e.stopPropagation();
    onPrimeTapRef.current?.();
  }, []);

  // ADDENDUM-08 §7 — the map is always visible on day one, at full size: the
  // player's first impression must be the whole town, not a corner of it.
  const [zoomedOut, setZoomedOut] = useState(true);
  const [fit, setFit] = useState<{ scale: number; heightPx: number } | null>(null);
  // ADDENDUM-09 §3.2 — the pinch-owned scale/translate. `null` means "not
  // pinch-controlled": the effective scale/translate fall back to the
  // zoomedOut/fit-vs-100% pair below. Non-null persists across renders once
  // a pinch has happened, until the 전체 보기 toggle resets it (D2).
  const [pinch, setPinch] = useState<{ scale: number; tx: number; ty: number } | null>(null);
  const pinchSampleRef = useRef<{ midX: number; midY: number; distance: number } | null>(null);
  // A7 — the grid's transform-INDEPENDENT layout position, captured once when
  // a pinch starts and reused for the whole gesture. See `handlePinchMove`.
  const pinchLayoutRef = useRef<{ left: number; top: number } | null>(null);
  // Gate-3-rerun fix (four expert lenses, live-repro'd): scale drifted
  // 1.038 -> 0.917 during a nominally translate-only two-finger PAN (finger
  // separation held constant throughout). Root cause was that `nextScale`
  // was computed as `scale0 * (distance / prevSample.distance)` — a ratio
  // against the PREVIOUS sample, chained across every pointermove of the
  // gesture. Real touch input reports finger separation with a few px of
  // sample-to-sample jitter even when the physical separation truly isn't
  // changing (sensor quantization, sub-pixel rounding); chaining that noise
  // multiplicatively is a random walk in log-scale space, so scale drifts
  // away from 1.0 over dozens of samples even on a pure pan. Fixing it the
  // same way `pinchLayoutRef` already fixes translate anchoring: capture the
  // gesture's BASELINE distance/scale once, and every later sample compares
  // straight to that fixed baseline (`distance / baseline.distance`) instead
  // of to the noisy previous sample — no chain, no accumulation.
  //
  // Gate-3 round-5 — also carries the baseline midpoint (`midX`/`midY`) now,
  // for `resolvePinchTransform`'s anchor math (see its own doc): the last
  // residual chaining path was the TRANSLATE anchor, which still read the
  // previous sample's midpoint / the previously COMMITTED `pinch` state.
  const pinchBaselineRef = useRef<PinchBaseline | null>(null);

  const fitScale = fit?.scale ?? 1;
  const scale = pinch ? pinch.scale : zoomedOut ? fitScale : 1;
  const tx = pinch ? pinch.tx : 0;
  const ty = pinch ? pinch.ty : 0;

  useEffect(() => {
    // ADDENDUM-09 §3.2/3.3 — measured unconditionally (not just while
    // zoomedOut): `fitScale` is also the pinch clamp floor and the pan gate,
    // needed regardless of which zoom state is active.
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
      setFit({ scale, heightPx: worldHeight * scale });
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  // ADDENDUM-09 §3.1/§3.2 — a pinch sample from `useTileGestures`. The first
  // sample of a new pinch only establishes the baseline (no prior sample to
  // diff against); every sample after that derives the new scale (ratio of
  // consecutive pinch distances) and an anchor-preserving translate (the
  // local point under the PREVIOUS midpoint stays under the NEW one).
  //
  // Uses the FUNCTIONAL `setPinch` form, not the `scale`/`tx`/`ty` render
  // closure: two fingers moving independently can each fire a pointermove
  // — and therefore this handler — within the same synchronous tick, before
  // React commits either update. Reading the render closure in that case
  // means the SECOND call sees pre-first-call values (a real bug, not just
  // a test artifact: React batches same-tick state updates regardless of
  // environment). The functional updater form chains correctly instead —
  // React applies queued updaters in order, each seeing the prior one's result.
  //
  // A7 — the layout reference is captured ONCE, on the gesture's baseline
  // sample, never re-measured inside the updater. `getBoundingClientRect()`
  // reports the LAST COMMITTED transform, but React runs queued functional
  // updaters at render time: the second updater of a same-tick pair sees a
  // fresh `prevPinch` beside a rect that still describes the state before the
  // first updater ran. Deriving `layoutLeft` from that mix
  // (`rect.left - scale0 * tx0`) corrupts the anchor, and the map over-travels
  // — measured at 17.5px of drift on a 40px two-finger drag. Capturing the
  // layout position up front removes the live read entirely, so both updaters
  // work from the same, correct origin. Safe to capture once: `.town-viewport`'s
  // height stays pinned for the whole pinch (see `activeFit` below) and a pinch
  // pointermove preventDefaults native scroll, so the grid's layout position
  // cannot move mid-gesture.
  // Gate-3-rerun fix (panel finding, all five expert lenses — zoom snapping
  // at the start of a two-finger pan): seeds the baseline/layout/sample refs
  // from the SYNCHRONOUS 2-finger-pointerdown state instead of leaving it to
  // the first `onPinchMove` sample. See `onPinchStart`'s own doc
  // (`useTileGestures.ts`) for why waiting for that first move sample was
  // the bug — it could be a half-sample (one finger already moved, the other
  // still at its down position), corrupting the baseline for the WHOLE
  // gesture, not just one frame. `handlePinchMove`'s own `!prevSample`
  // branch below still runs the same seeding logic as a fallback for any
  // caller that doesn't wire `onPinchStart` (defensive only — every real
  // caller does).
  const handlePinchStart = (midX: number, midY: number, distance: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    pinchLayoutRef.current = { left: rect.left - scale * tx, top: rect.top - scale * ty };
    pinchBaselineRef.current = { scale, distance, midX, midY };
    pinchSampleRef.current = { midX, midY, distance };
  };

  const handlePinchMove = (midX: number, midY: number, distance: number) => {
    const prevSample = pinchSampleRef.current;
    pinchSampleRef.current = { midX, midY, distance };

    const grid = gridRef.current;
    const viewport = viewportRef.current;
    if (!grid) return;

    if (!prevSample) {
      // Baseline sample: nothing is queued yet, so the committed `scale`/`tx`/
      // `ty` and the DOM agree — the one moment this can be read correctly.
      const rect = grid.getBoundingClientRect();
      pinchLayoutRef.current = { left: rect.left - scale * tx, top: rect.top - scale * ty };
      // Drift fix (see the ref's own comment): every later sample of this
      // gesture compares straight against THIS distance/midpoint, never a chain.
      pinchBaselineRef.current = { scale, distance, midX, midY };
      return;
    }
    const layout = pinchLayoutRef.current;
    if (!layout) return;
    const baseline = pinchBaselineRef.current;
    if (!baseline) return;

    setZoomedOut(false); // D1/D2/D4 — a pinch takes ownership of scale away from the toggle
    // Gate-3 round-5 — `resolvePinchTransform` is pure and derives the whole
    // next state from `baseline`/`layout` (both fixed for the gesture) plus
    // THIS sample only; no `prevPinch`/previous-sample chaining left to
    // corrupt (see the function's own doc). A plain (non-functional)
    // `setPinch` call is correct here for the same reason: two same-tick
    // calls each compute a complete, independent, correct state from fixed
    // inputs, so ordinary last-write-wins batching is exactly right — there
    // is nothing left that NEEDS to see the other call's result.
    const { scale: nextScale, tx: rawTx, ty: rawTy } = resolvePinchTransform(
      baseline,
      layout,
      { midX, midY, distance },
      fitScale,
      MAX_PINCH_SCALE,
      prevSample.distance,
    );
    const clamped = clampTranslate(
      rawTx,
      rawTy,
      nextScale,
      grid.scrollWidth,
      grid.scrollHeight,
      viewport?.clientWidth ?? 0,
      viewport?.clientHeight ?? 0,
    );
    setPinch({ scale: nextScale, tx: clamped.tx, ty: clamped.ty });
  };

  const handlePinchEnd = () => {
    pinchSampleRef.current = null;
    pinchLayoutRef.current = null; // A7 — re-measured on the next gesture's baseline
    pinchBaselineRef.current = null; // re-measured on the next gesture's baseline
  };

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

    // ── occlusion (user report 2026-08-13: "2D라서 높은 건물이 앞에 있으면 뒷 건물이
    // 안 보이거나 겹쳐") ──
    //
    // A building's art rises at most MAX_ART_OVERHANG_PX (45) above its own cell,
    // and one grid row plus its gap is TILE_HEIGHT_PX + GRID_GAP_PX (46). So an
    // overhang can only ever reach the row DIRECTLY behind — never two rows back.
    // "Is this building hiding another?" is therefore one Map lookup per column
    // it spans, not a sweep of the map: O(cells covered), inside the memo that
    // already exists, so it runs when `buildings` changes and never per frame.
    // A Lv.1 building has zero overhang and is skipped outright.
    const occluders = new Set<string>();
    for (const b of buildings) {
      if (b.plotIndex < 0) continue;
      if (totalLevelOf(b, expPerLevel, maxLevel) <= 1) continue;
      const { row, col } = cellFromIndex(b.plotIndex);
      if (row === 0) continue; // nothing behind the first row but the header padding
      const { w } = footprintOf(b);
      for (let dx = 0; dx < w; dx++) {
        if (coveredBy.has(indexFromCell({ row: row - 1, col: col + dx }))) {
          occluders.add(b.id);
          break;
        }
      }
    }

    // §3.1/§4.3 — a move target is an ANCHOR whose whole footprint must fit.
    // Every cell of every legal anchor gets the droppable highlight (a 2x2
    // drop target highlights all 4 cells), and a tap on any of those cells
    // resolves to its anchor (`dropAnchorFor`) before reaching `onPlotTap` —
    // the caller only ever sees anchor indices.
    const dropAnchors = new Map<number, number>();
    const movingBuilding = movingId === null ? undefined : buildings.find((b) => b.id === movingId);
    if (movingBuilding && movingId !== null) {
      const { w, h } = footprintOf(movingBuilding);
      // `moveAnchorsFor` — the one function this and `moveBuilding` both route
      // through — already excludes the mover's own current anchor, so the
      // highlighted drop targets are exactly the set `moveBuilding` will
      // accept: the grid never offers a drop it rejects.
      for (const anchor of moveAnchorsFor(buildings, movingId, w, h)) {
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
            // Gate-3-rerun fix (QA lead E4): monuments used to share this
            // exact label with ordinary buildings, so a screen-reader user
            // had no way to tell a month's F16 monument apart from a regular
            // building — sighted users get the distinct obelisk art instead.
            aria-label={
              covering.source.kind === "monument"
                ? "기념비, 눌러서 정보 보기, 길게 눌러 옮기기"
                : "건물, 눌러서 정보 보기, 길게 눌러 옮기기"
            }
            aria-selected={isMoving ? ("true" as const) : undefined}
          >
            <PlaceholderBuilding
              categoryId={covering.categoryId}
              variantIndex={covering.variantIndex}
              justBuilt={isNewest}
              // ADDENDUM-11 §2.4/§4.1 — the displayed level is EXP level + fuse
              // tier (6..10 for a fused building), not the EXP-capped `levelOf`;
              // `fuseTier` rides alongside for the art's material-step channel.
              // Byte-identical to before for any unfused building (`fuseOf` is 0).
              level={totalLevelOf(covering, expPerLevel, maxLevel)}
              fuseTier={fuseOf(covering)}
              occludes={occluders.has(covering.id)}
              monumentPeriod={covering.source.kind === "monument" ? covering.source.period : undefined}
              w={w as 1 | 2}
              h={h as 1 | 2}
            />
            {/* S8 건물 꾸미기 — Gate-3-rerun fix (게임 디자이너 TOP FIX): a sibling
                badge over the tile, never inside `PlaceholderBuilding`/
                `buildingArt.tsx` (both frozen baselines — this must not touch
                a single polygon). Same absolute-corner pattern as
                `.building-level-badge`, opposite corner so the two never
                collide. */}
            {appliedByBuildingId?.[covering.id] && (
              <span className="town-tile-deco" aria-hidden="true">
                {BUILDING_DECO_GLYPH[appliedByBuildingId[covering.id]] ?? "✨"}
              </span>
            )}
          </div>,
        );
      } else {
        const isDroppable = dropAnchors.has(i);
        const emptyLotVariant = decorVariant(row, col, 3) as 0 | 1 | 2;
        // §6 — same gate as `TERRAIN_CELLS`'s own `prime` field above: the
        // ring must never sit on `EmptyLot`'s tree/sprout icon (variant 1/2),
        // only on the plain, icon-less lot (variant 0).
        const isPrime = isPrimeCell(row, col) && emptyLotVariant === 0;
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
            <EmptyLot variant={emptyLotVariant} />
            {/* Only outside move mode (`!isDroppable`): a droppable prime
                lot's WHOLE tile is already the move-mode drop target
                (`role="button"`, the a11yProps above) — overlaying another
                interactive element there would both violate the
                no-nested-interactive-controls a11y rule and physically
                intercept the drop tap, breaking move mode. */}
            {isPrime && !isDroppable && (
              <button type="button" className="town-prime-tap" aria-label="명당 설명 보기" onClickCapture={handlePrimeTap} />
            )}
          </div>,
        );
      }
    }
    return { groundTiles: elements, dropAnchorFor: dropAnchors, byAnchor: anchorMap };
  }, [buildings, movingId, growCandidateIds, justBuiltId, expPerLevel, maxLevel, appliedByBuildingId, handlePrimeTap]);

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
    onPinchStart: handlePinchStart,
    onPinchMove: handlePinchMove,
    onPinchEnd: handlePinchEnd,
    onInvalidDrop,
  });

  // F3: "New buildings animate in; the view auto-scrolls to the newest."
  //
  // Gate-3-rerun fix (ux-researcher/target-player TOP FIX, reusing
  // ADDENDUM-09's zoom rather than touching the map's approved visual
  // design): scroll alone wasn't enough — at the default fit-to-screen zoom
  // a new tile is still a ~17px speck indistinguishable from the town's
  // hundreds of decorative props, so the "watch it grow" moment never read
  // as anything happening. Zooming to native scale on a fresh build makes
  // the SAME pop/rise animation `PlaceholderBuilding` already plays actually
  // legible. Two effects, not one: the scroll target's on-screen position
  // depends on `zoomedOut`'s own layout (`fit`/transform), which only
  // commits to the DOM after this state flip's re-render — scrolling in the
  // same tick would still measure the pre-zoom position.
  useEffect(() => {
    if (justBuiltId !== null) setZoomedOut(false);
  }, [justBuiltId]);
  useEffect(() => {
    if (justBuiltId === null) return;
    // Gate-3-RE-RUN fix (round-5 panel, 4/5 experts independently): `inline`
    // was left unset, which defaults to "nearest" — if the new tile was
    // already even 1px inside the viewport (common right after a zoom), it
    // got nudged the minimum distance instead of centered, landing at the
    // frame edge under the FAB/전체보기 chrome exactly as the panel's
    // screenshots showed. Both axes now explicitly center.
    newestTileRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [justBuiltId, zoomedOut]);

  // Inline viewport height is a fit-to-screen concern only (§7). A pinch
  // always sets `zoomedOut` false in the same update as `pinch` becomes
  // non-null (`handlePinchMove` above), so this stays in sync with §3.2.
  // Bug found in browser touch-emulation QA (ADDENDUM-09 acceptance #8): this
  // used to be `zoomedOut ? fit : null`. A pinch's first real sample flips
  // `zoomedOut` to false (D2) as a pure ownership handoff — it does NOT mean
  // "user wants the 100% native-scroll view" the toggle's `zoomedOut=false`
  // means. But `.town-viewport`'s CSS (App.css) only pins `height` while this
  // was truthy; losing the pin mid-pinch let the viewport reflow from the
  // fit height up toward its `max-height`, moving `.town-grid`'s on-screen
  // top position out from under the anchor math (which assumes that position
  // is stable) — measured as a ~150px vertical anchor jump the instant a
  // pinch starts from the initial zoomed-out state. Keeping the pin through
  // `pinch !== null` too removes the reflow without touching the toggle's
  // own 100% (zoomedOut=false, pinch=null) behavior, which still gets `null`
  // here exactly as before.
  const activeFit = zoomedOut || pinch !== null ? fit : null;
  // ADDENDUM-09 §3.2 — the transform is shown whenever EITHER zoom mechanism
  // is active; at scale 1 / translate 0 (100% view, no pinch) it stays
  // `undefined` so `grid.style.transform` reads "" (existing toggle test).
  const showTransform = zoomedOut || pinch !== null;

  return (
    <div className="town-viewport" ref={viewportRef} style={activeFit ? { height: `${activeFit.heightPx}px` } : undefined}>
      <div
        ref={gridRef}
        className={`town-grid${movingId !== null ? " town-grid--moving" : ""}`}
        // S8 마을 꾸미기 — a data attribute, not a new child (AC-M7's
        // direct-children guard is about `.town-grid`'s own children; App.css
        // paints the skin as a ::after pseudo-element, so this stays a no-op
        // in the default/free case — the frozen map baseline is untouched
        // until a player actually applies a purchased skin).
        data-town-deco={appliedTownSku ?? undefined}
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
            // 2026-08-13 — headroom for the tallest building's overhang, so a row-0
            // building rises inside the grid instead of being clipped by
            // `.town-viewport` (or reaching the header above it).
            "--art-overhang": `${MAX_ART_OVERHANG_PX}px`,
            "--district-row-gap": `${DISTRICT_ROW_GAP_PX}px`,
            "--pip-size": `${PIP_SIZE_PX}px`,
            "--pip-gap": `${PIP_GAP_PX}px`,
            "--pip-row-gap": `${PIP_ROW_GAP_PX}px`,
            "--terrace-earth-h": `${TERRACE_EARTH_PX}px`,
            "--terrace-drop": `${TERRACE_DROP_PX}px`,
            // ADDENDUM-05 §2 / ADDENDUM-08 §7 / ADDENDUM-09 §3.2 — zoom-to-fit
            // and pinch zoom/pan share this ONE transform (no wrapper, D4):
            // runtime-measured/gesture-driven values, not townLayout.ts
            // constants, so rule R-3 doesn't reach them — a plain inline
            // transform like `gridColumn`/`gridRow` already are above.
            transform: showTransform ? `scale(${scale}) translate(${tx}px, ${ty}px)` : undefined,
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
        <NpcLayer npcCount={npcCount} ownedSkus={ownedSkus} />
      </div>
      {/* Never a `.town-grid` child — a sibling inside `.town-viewport` instead. */}
      <button
        type="button"
        className="town-zoom-toggle"
        aria-pressed={zoomedOut}
        aria-label={zoomedOut ? "크게 보기로 전환" : "전체 보기로 전환"}
        onClick={() => {
          // D2 — one-tap return to the whole map. Also the pinch-ownership
          // reset (§3.2): flipping either direction clears any pinch scale
          // so `zoomedOut`/100% take back sole ownership of the transform.
          setZoomedOut((z) => !z);
          setPinch(null);
        }}
      >
        {zoomedOut ? "크게 보기" : "전체 보기"}
      </button>
    </div>
  );
}

export const TownGrid = memo(TownGridImpl);
