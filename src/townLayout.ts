/**
 * The fixed 20x20 town map — ADDENDUM-08. One authored ASCII constant
 * (`TOWN_MAP`) is the single source of truth for terrain, replacing the
 * growing serpentine/block/masking geometry of ADDENDUM-01/05/06/07. Pure,
 * no React, no storage, no `Math.random` — nothing here is ever persisted
 * except `LAYOUT_VERSION`'s value (rule R-1: bump it whenever `TOWN_MAP`
 * changes, so every building relocates on screen instead of drifting).
 *
 * It is also the single source of truth for every grid COORDINATE and every
 * PIXEL SIZE the TS arithmetic uses — App.css must never restate one
 * (rule R-3).
 */
import { ladderFor } from "./selectors";
import { SAVING_CATEGORY_IDS } from "./savingsBuckets";
import type { SavingCategoryCellId } from "./savingsBuckets";
import type { SavingCategoryId } from "./types";

export interface Cell {
  row: number;
  col: number;
}

/** Rule R-1: bumped whenever `TOWN_MAP` (or anything it derives) changes. ADDENDUM-08: 3 -> 4, the fixed 20x20 map replaces the growing town. */
export const LAYOUT_VERSION = 4;

// ── §1 — the map itself ──

export const GRID_SIZE = 20; // rows === cols === 20, fixed, never grows (ADDENDUM-08 §0.1)
export const CELL_COUNT = GRID_SIZE * GRID_SIZE; // 400

export type TerrainKind = "ground" | "road" | "park" | "lake" | "savings" | "void";

/**
 * THE MAP (ADDENDUM-08 §1.2, normative). 20 rows x 20 chars. `.`=ground
 * `#`=road `P`=park `L`=lake `S`=savings ` `=void. Editable by a human
 * without reading code; every other export in this module is derived from
 * this constant.
 *
 * Row 7 is transcribed with one extra leading space versus the addendum
 * markdown, which renders it 19 characters wide there (a whitespace
 * trim on that one line) — restored to 20 so every row is uniform. Verified
 * against the addendum's own census/connectivity/prime-lot numbers (§1.2,
 * §6): ground=193 road=93 park=29 lake=12 savings=5 void=68, all 93 road
 * cells form one connected component, and prime-cell count is exactly 20 —
 * all of which only hold with this fix applied.
 */
export const TOWN_MAP: readonly string[] = [
  "    PPP......PPP    ",
  "  .....SSSSS.....   ",
  " ################## ",
  " ...#........#...PP ",
  " ...#........#..PPP ",
  "  ..#........#....P ",
  "  ..#........#..... ",
  "  ################# ",
  " ...#..LLLL..#..... ",
  " ...#.LLLLL..#..... ",
  " ...#..LLL...#..... ",
  " ...#........#..... ",
  " ################## ",
  " ...#PPP.....#..... ",
  " ...#PPPP....#..... ",
  " ...#PPP.....#....P ",
  "  ..#........#....  ",
  "  ################  ",
  "   ...PPP........   ",
  "     PPP.......     ",
];

const TERRAIN_CHARS: Record<string, TerrainKind> = {
  ".": "ground",
  "#": "road",
  P: "park",
  L: "lake",
  S: "savings",
  " ": "void",
};

/** Parsed once at module load — `terrainAt` is called in hot render/placement loops, so it never re-indexes the strings. */
const TERRAIN_GRID: readonly TerrainKind[] = TOWN_MAP.join("")
  .split("")
  .map((ch) => TERRAIN_CHARS[ch]);

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

export function terrainAt(row: number, col: number): TerrainKind {
  if (!inBounds(row, col)) return "void";
  return TERRAIN_GRID[row * GRID_SIZE + col];
}

export function terrainAtIndex(i: number): TerrainKind {
  if (i < 0 || i >= CELL_COUNT) return "void";
  return TERRAIN_GRID[i];
}

// ── §2 — coordinates ──

/** `plotIndex` stays a single number (ADDENDUM-08 §2): 0..399, row-major. */
export function cellFromIndex(i: number): Cell {
  return { row: (i / GRID_SIZE) | 0, col: i % GRID_SIZE };
}

export function indexFromCell(cell: Cell): number {
  return cell.row * GRID_SIZE + cell.col;
}

export function isBuildable(row: number, col: number): boolean {
  return terrainAt(row, col) === "ground";
}

export function isRoadCell(row: number, col: number): boolean {
  return terrainAt(row, col) === "road";
}

/** ADDENDUM-08 §5 — road OR park; parks are strollable, lakes are not. The only predicate `npc/movement.ts` uses. */
export function isWalkable(row: number, col: number): boolean {
  const t = terrainAt(row, col);
  return t === "road" || t === "park";
}

/**
 * §2.1 — the cells a `w`x`h` footprint covers, anchored at its top-left
 * cell, in reading order (row-major: top row left-to-right, then the next
 * row). Assumes the footprint fits inside the grid from `anchorIndex` —
 * callers (`placement.ts`'s `fits`/`anchorsFor`) check bounds per cell
 * before trusting these indices.
 */
export function footprintCells(anchorIndex: number, w: number, h: number): number[] {
  const { row, col } = cellFromIndex(anchorIndex);
  const cells: number[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push(indexFromCell({ row: row + dy, col: col + dx }));
    }
  }
  return cells;
}

// ── §6 — art: elevation bands and 명당 (prime lots) ──

/** Terraced elevation band, 0..3 — pure function of row, render-only, never stored. */
export function elevationBandOf(row: number): number {
  return Math.floor(row / 5);
}

/** A 명당 (prime lot): ground, orthogonally adjacent to a road AND to a park or lake — the scenic street corner. Derived, not authored. */
export function isPrimeCell(row: number, col: number): boolean {
  if (terrainAt(row, col) !== "ground") return false;
  const neighbors: Array<[number, number]> = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
  let hasRoad = false;
  let hasParkOrLake = false;
  for (const [r, c] of neighbors) {
    const t = terrainAt(r, c);
    if (t === "road") hasRoad = true;
    else if (t === "park" || t === "lake") hasParkOrLake = true;
  }
  return hasRoad && hasParkOrLake;
}

/** Same predicate in plot-index space — what non-render callers (economy) use. Keeps its ADDENDUM-06 name and meaning. */
export function isPrimePlotIndex(i: number): boolean {
  const { row, col } = cellFromIndex(i);
  return isPrimeCell(row, col);
}

// ── 저축 블록 — the 5 fixed savings cells ──

/** Every `savings` cell, in row-major (left-to-right) order — row 1, cols 7..11 on the current map. */
const SAVINGS_CELLS: readonly Cell[] = TERRAIN_GRID.reduce<Cell[]>((cells, terrain, i) => {
  if (terrain === "savings") cells.push(cellFromIndex(i));
  return cells;
}, []);

export function savingsCells(): Cell[] {
  return SAVINGS_CELLS.map((c) => ({ ...c }));
}

/**
 * The fixed cell one savings structure stands on. Injective over
 * `SAVING_CATEGORY_IDS` — position `rank` in the id list gets the `rank`-th
 * savings cell, left-to-right. Takes `SavingCategoryCellId` — the narrow
 * 5-member type, not the 6-member `SavingCategoryId` (which still carries
 * the legacy `invest` id) — so a caller can no longer pass an id outside
 * `SAVING_CATEGORY_IDS` and get a silent out-of-range cell back. The runtime
 * throw is defence in depth for any value that reaches here without going
 * through the type checker (e.g. from a cast).
 */
export function savingsCellFor(id: SavingCategoryCellId): Cell {
  const rank = (SAVING_CATEGORY_IDS as readonly string[]).indexOf(id);
  if (rank < 0) {
    throw new Error(`savingsCellFor: "${id}" is not a member of SAVING_CATEGORY_IDS`);
  }
  return { ...SAVINGS_CELLS[rank] };
}

/**
 * DOM emission order for the savings block: left -> right on screen, so DOM
 * order equals visual order. DERIVED from `savingsCellFor`, never a second
 * hand-written list that could drift from it.
 */
export const SAVINGS_ROW_ORDER: readonly SavingCategoryCellId[] = [...SAVING_CATEGORY_IDS].sort((a, b) => {
  const ca = savingsCellFor(a);
  const cb = savingsCellFor(b);
  return ca.row - cb.row || ca.col - cb.col;
});

// ── Rule R-2 (decoration) — pure function of (row, col) alone, never stored ──

/** Decoration only. Pure, (row, col) -> variant. Never stored, never persisted, never versioned. Unchanged from ADDENDUM-06. */
export function decorVariant(row: number, col: number, kinds: number): number {
  return (((row * 31 + col * 17) % kinds) + kinds) % kinds;
}

// ── §7 — viewport pixel geometry ──

/**
 * The floor `plotTileWidthPx` clamps to, so tiles stop shrinking to fit a
 * narrow phone. ADDENDUM-08 §7: 52 -> 40 — a 20-column grid at 52px/tile is
 * ~1160px wide, far past a phone; 40px keeps cells square (a square grid is
 * what makes a 2x2 building read as a square building).
 */
export const MIN_TILE_WIDTH_PX = 40;

/** ADDENDUM-08 §7: 72 -> 40, matching `MIN_TILE_WIDTH_PX` so every cell is square. */
export const TILE_HEIGHT_PX = 40;

export const GRID_GAP_PX = 6;

/**
 * `.town-grid`'s horizontal padding. Reaches the stylesheet ONLY as
 * `--town-grid-pad-x`, set inline from this constant — with no CSS fallback
 * value, because a fallback is a second source of truth that silently wins
 * when the property is missing. `plotTileWidthPx` reads the same constant, so
 * the width arithmetic and the painted padding cannot disagree (R-3).
 */
export const GRID_PADDING_X_PX = 16;

/**
 * The grid template, GENERATED from the constants above (rule R-3) — the
 * stylesheet must never hardcode 20 repeated column tokens, because that
 * string silently encodes GRID_SIZE and MIN_TILE_WIDTH_PX. Every column is
 * `minmax(MIN_TILE_WIDTH_PX, 1fr)` — a narrow viewport overflows the grid
 * natively instead of the browser silently shrinking columns below the
 * floor; `.town-viewport`'s `overflow-x: auto` is what makes that overflow
 * scrollable. No space after the comma inside minmax(): a space would split
 * one column into two tokens for every consumer that does
 * `GRID_TEMPLATE_COLUMNS.split(" ")` (own test below).
 */
export const GRID_TEMPLATE_COLUMNS = Array.from({ length: GRID_SIZE }, () => `minmax(${MIN_TILE_WIDTH_PX}px,1fr)`).join(
  " ",
);

/** Same generation discipline as `GRID_TEMPLATE_COLUMNS` — 20 uniform `TILE_HEIGHT_PX` row tracks. */
export const GRID_TEMPLATE_ROWS = Array.from({ length: GRID_SIZE }, () => `${TILE_HEIGHT_PX}px`).join(" ");

/**
 * Plot tile width at a given viewport width, clamped to MIN_TILE_WIDTH_PX —
 * the one width function the whole town derives from: `PIPS_PER_ROW` below,
 * the savings-plot geometry (§2.5), and `GRID_TEMPLATE_COLUMNS`'s `minmax()`
 * floor above all trace back to this same clamp. ADDENDUM-08 §7: the uniform
 * 20-column grid has no separate road column to subtract, unlike the old
 * `GRID_COLUMNS`/`ROAD_WIDTH_PX` formula.
 */
export function plotTileWidthPx(viewportPx: number): number {
  const inner = viewportPx - GRID_PADDING_X_PX * 2;
  const gaps = (GRID_SIZE - 1) * GRID_GAP_PX;
  const derived = (inner - gaps) / GRID_SIZE;
  return Math.max(MIN_TILE_WIDTH_PX, derived);
}

// ── §2.5 — savings plot geometry (unrelated to this change, sizes the
// savings UI's own block; kept as-is) ──

export const SEG_BASE_PX = 18; // plinth / ground floor
export const SEG_STEP_PX = 12; // one level
export const SEG_CAP_PX = 14; // roof / signboard cap
export const LABEL_ROW_PX = 16; // 예적금 / 주식투자 … label row
export const DISTRICT_ROW_GAP_PX = 6; // between the plot's internal rows

/**
 * Pip metrics. These stop being "paint" the moment the wrap arithmetic below
 * computes with them, so R-3 moves them here and the stylesheet reads them as
 * --pip-size / --pip-gap / --pip-row-gap with no fallback.
 */
export const PIP_SIZE_PX = 5;
export const PIP_GAP_PX = 3; // between pips on one line
export const PIP_ROW_GAP_PX = 4; // between wrapped pip lines

/** The narrowest viewport the town is laid out for — used only to derive PIPS_PER_ROW. */
export const MIN_VIEWPORT_PX = 320;

/** Width of one line of `count` pips. */
export function pipRowWidthPx(count: number): number {
  return count <= 0 ? 0 : PIP_SIZE_PX * count + PIP_GAP_PX * (count - 1);
}

/**
 * How many pips fit on one line of a savings plot at the NARROWEST supported
 * viewport — derived, never typed in. `plotTileWidthPx` is the same function
 * the tile width comes from, so a change to GRID_GAP_PX/GRID_PADDING_X_PX
 * moves this with it instead of silently overflowing.
 */
export const PIPS_PER_ROW = Math.max(
  1,
  Math.floor((plotTileWidthPx(MIN_VIEWPORT_PX) + PIP_GAP_PX) / (PIP_SIZE_PX + PIP_GAP_PX)),
);

/** Pip lines needed for a ladder of `ladderLength` steps. Always >= 1. */
export function pipRowCount(ladderLength: number): number {
  return Math.max(1, Math.ceil(ladderLength / PIPS_PER_ROW));
}

/** Height of the whole (wrapping) pip block. */
export function pipBlockHeightPx(ladderLength: number): number {
  const rows = pipRowCount(ladderLength);
  return rows * PIP_SIZE_PX + (rows - 1) * PIP_ROW_GAP_PX;
}

/**
 * Height reserved for the structure itself — ALWAYS the full ladder, so a
 * level-up never reflows the row. All five plots share one grid row, and
 * unequal boxes would misalign five labels and five pip blocks across it
 * (the shared-longest rule; a per-structure box is deliberately not this).
 */
export function structureHeightPx(ladderLength: number): number {
  return SEG_BASE_PX + SEG_STEP_PX * ladderLength + SEG_CAP_PX;
}

/** Rendered height of a structure currently at `level` — bottom-aligned inside the reserved box. */
export function structureLevelHeightPx(level: number): number {
  return SEG_BASE_PX + SEG_STEP_PX * level + SEG_CAP_PX;
}

/** Total height of one savings plot: reserved box + label row + wrapping pip block. */
export function savingsPlotHeightPx(ladderLength: number): number {
  return (
    structureHeightPx(ladderLength) +
    DISTRICT_ROW_GAP_PX +
    LABEL_ROW_PX +
    DISTRICT_ROW_GAP_PX +
    pipBlockHeightPx(ladderLength)
  );
}

/**
 * The plot's three internal rows. Generated so App.css holds none of the
 * three numbers, and so `savingsPlotHeightPx` (the inline height) and the
 * template are provably the same arithmetic:
 *   savingsPlotHeightPx(n) === sum(rows) + 2 * DISTRICT_ROW_GAP_PX.
 */
export function savingsPlotTemplateRows(ladderLength: number): string {
  return `${structureHeightPx(ladderLength)}px ${LABEL_ROW_PX}px ${pipBlockHeightPx(ladderLength)}px`;
}

/**
 * The ladder length the BLOCK is sized to: the longest ladder any structure
 * resolves to. With `overrides = {}` this is just `defaultLadder.length`;
 * with a per-structure override longer than the default it is that
 * override's length, so one structure with a longer curve makes the row
 * taller instead of clipping.
 */
export function districtLadderLength(
  defaultLadder: readonly number[],
  overrides: Partial<Record<SavingCategoryId, readonly number[]>>,
): number {
  return SAVING_CATEGORY_IDS.reduce((max, id) => Math.max(max, ladderFor(id, defaultLadder, overrides).length), 0);
}

// ── §6 — terraced elevation tone (render-time only, never persisted) ──

/** Number of ground tints in the elevation ramp. */
export const TERRACE_TINTS = 3;

/**
 * Height of the earth cross-section hanging below a terrace slab, at each
 * elevation band boundary.
 */
export const TERRACE_EARTH_PX = 20;

/** How far one terrace's shadow falls onto the ramp below it. */
export const TERRACE_DROP_PX = 6;
