/**
 * Render-time layout — plot index -> grid cell, plus the savings block's
 * fixed cells. Pure, no React, no storage. ADDENDUM-01 §3.3/§2.5.
 *
 * This module is the ONLY thing that knows the town has roads and a savings
 * block. `plotFromIndex` (selectors.ts) is the storage mapping and is
 * deliberately untouched: nothing here is ever persisted, so any constant
 * below can change with no migration.
 *
 * It is also the single source of truth for every grid COORDINATE and every
 * PIXEL SIZE the TS arithmetic uses — App.css must never restate one
 * (rule R-3, ADDENDUM-01 §3.5). See App.css's own header comment.
 *
 * THIS TASK renders the savings block's five cells as empty lots + one
 * signpost (`components/TownGrid.tsx`) — not the real savings structures.
 * The geometry below (§2.5's segment/pip size functions) already sizes the
 * block to the shared ladder so the 저축 블록 task's structures drop in with
 * no second `LAYOUT_VERSION` bump (ADDENDUM-01 §6 "Ordering note").
 */
import { TOWN_COLUMNS, ladderFor, plotFromIndex } from "./selectors";
import { SAVING_CATEGORY_IDS } from "./savingsBuckets";
import type { SavingCategoryCellId } from "./savingsBuckets";
import type { SavingCategoryId } from "./types";

export interface Cell {
  row: number;
  col: number;
}

/** Rule R-1 (ADDENDUM-01 §3.6): bumped whenever any constant below changes — every building relocates on screen. */
export const LAYOUT_VERSION = 1;

// ── §3.3 — grid shape ──

export const GRID_COLUMNS = TOWN_COLUMNS + 1; // 7 = 6 plot columns + 1 street column
export const ROAD_COLUMN = 3; // 0-based grid column of the main street
export const BLOCK_ROWS = 2; // plot rows per block — forced by the frontage invariant (§3.2)

// Layout px (assumption; director may retune — none of these is a pacing dial).
export const TILE_HEIGHT_PX = 72; // unchanged from App.css's former grid-auto-rows
export const ROAD_WIDTH_PX = 22;
export const ROAD_HEIGHT_PX = 22;
export const GRID_GAP_PX = 6; // was 8 — recovers the width the street takes

/**
 * .town-grid's horizontal padding. Reaches the stylesheet ONLY as
 * `--town-grid-pad-x`, set inline from this constant — with no CSS fallback
 * value, because a fallback is a second source of truth that silently wins
 * when the property is missing. `plotTileWidthPx` reads the same constant, so
 * the width arithmetic and the painted padding cannot disagree (R-3).
 */
export const GRID_PADDING_X_PX = 16;

/** Plot column (0..5, straight from `plotFromIndex`) -> grid column, skipping the street. */
export const SERPENTINE_COLUMNS = [0, 1, 2, 4, 5, 6] as const;

// ── 저축 블록 (§2.4) — fixed cells, OUTSIDE plot-index space ──

/**
 * Prominence rank -> grid column: street-front pair, middle pair, back pair.
 * Rank 0/1 are the two sub-types the director named, so 예적금 and 주식 투자
 * are the ones facing the main street. A CONTENT assumption (§7), not a
 * mechanic; one array to overturn.
 */
export const SAVINGS_COLUMN_RANK = [2, 4, 1, 5, 0, 6] as const;

/** Savings rows needed for the current sub-type list. 5 ids -> 1 row. Follows D-17 automatically. */
export const SAVINGS_ROWS = Math.max(1, Math.ceil(SAVING_CATEGORY_IDS.length / TOWN_COLUMNS));

/**
 * Grid rows the town's head occupies: the savings rows plus their closing
 * cross street. The entrance cross street is grid row 0, so savings rows are
 * `1 .. TOWN_HEAD_ROWS - 1` and the closing cross street is `TOWN_HEAD_ROWS`.
 */
export const TOWN_HEAD_ROWS = SAVINGS_ROWS + 1; // 2 today

/**
 * The fixed cell one savings structure stands on. Injective over
 * `SAVING_CATEGORY_IDS`. Takes `SavingCategoryCellId` — the narrow 5-member
 * type, not the 6-member `SavingCategoryId` (which still carries the legacy
 * `invest` id) — so a caller can no longer pass an id outside
 * `SAVING_CATEGORY_IDS` and get a silent out-of-range cell back (round-1 lead
 * finding C2). The runtime throw is defence in depth for any value that
 * reaches here without going through the type checker (e.g. from a cast).
 */
export function savingsCellFor(id: SavingCategoryCellId): Cell {
  const rank = (SAVING_CATEGORY_IDS as readonly string[]).indexOf(id);
  if (rank < 0) {
    throw new Error(`savingsCellFor: "${id}" is not a member of SAVING_CATEGORY_IDS`);
  }
  return {
    row: 1 + Math.floor(rank / TOWN_COLUMNS),
    col: SAVINGS_COLUMN_RANK[rank % TOWN_COLUMNS],
  };
}

/** True for a grid row that carries savings structures (never plots — §2.1). */
export function isSavingsRow(row: number): boolean {
  return row >= 1 && row < TOWN_HEAD_ROWS;
}

/**
 * DOM emission order for the savings block: left -> right on screen, so DOM
 * order equals visual order. DERIVED from `SAVINGS_COLUMN_RANK` — never a
 * second hand-written list that could drift from the first.
 * Today: ["other_saving", "emergency", "deposit", "stock", "goal"].
 */
export const SAVINGS_ROW_ORDER: readonly SavingCategoryCellId[] = [...SAVING_CATEGORY_IDS].sort((a, b) => {
  const ca = savingsCellFor(a);
  const cb = savingsCellFor(b);
  return ca.row - cb.row || ca.col - cb.col;
});

/**
 * Savings-row cells with no structure on them. The first (in column-rank
 * order) renders the 마을 안내판 (`.savings-signpost`); any others render an
 * ordinary decorated 빈 터. With five sub-types this is exactly one cell,
 * grid col 6.
 */
export function freeSavingsCells(): Cell[] {
  const taken = new Set(SAVING_CATEGORY_IDS.map((id) => `${savingsCellFor(id).row},${savingsCellFor(id).col}`));
  const cells: Cell[] = [];
  for (let r = 1; r < TOWN_HEAD_ROWS; r++) {
    for (const col of SAVINGS_COLUMN_RANK) {
      if (!taken.has(`${r},${col}`)) cells.push({ row: r, col });
    }
  }
  return cells;
}

// ── plot space -> grid cell ──

/** Inverse of `plotFromIndex` — undoes the serpentine. `indexFromPlot(plotFromIndex(i)) === i`. */
export function indexFromPlot(plot: Cell): number {
  const k = plot.row % 2 === 0 ? plot.col : TOWN_COLUMNS - 1 - plot.col;
  return plot.row * TOWN_COLUMNS + k;
}

/**
 * Plot index -> grid cell. The whole road layout, in four lines.
 *
 * The `+ TOWN_HEAD_ROWS` term is what makes §2.1's invariant STRUCTURAL: the
 * smallest row this can return is `0 + 0 + 1 + TOWN_HEAD_ROWS`, which is
 * strictly greater than the largest savings row, `TOWN_HEAD_ROWS - 1`. No
 * plot index can land on a savings cell, for any input, ever. Do not
 * "simplify" this by folding the constant into the block arithmetic.
 */
export function cellFromIndex(i: number): Cell {
  const { row: plotRow, col: plotCol } = plotFromIndex(i);
  return {
    row: plotRow + Math.floor(plotRow / BLOCK_ROWS) + 1 + TOWN_HEAD_ROWS,
    col: SERPENTINE_COLUMNS[plotCol],
  };
}

/** Same transform from a plot-space cell — composed through the inverse, so there is one source of truth. */
export function cellFromPlot(plot: Cell): Cell {
  return cellFromIndex(indexFromPlot(plot));
}

/** True when this grid row is a cross street (no plots and no savings on it). */
export function isCrossStreetRow(row: number): boolean {
  if (row < TOWN_HEAD_ROWS) return row === 0; // r0 entrance; r1.. are savings rows
  return (row - TOWN_HEAD_ROWS) % (BLOCK_ROWS + 1) === 0; // r2, r5, r8, …
}

/** True for any road cell — used by the frontage test and by decoration. */
export function isRoadCell(row: number, col: number): boolean {
  return row >= 0 && (col === ROAD_COLUMN || isCrossStreetRow(row));
}

/** True for a grid column immediately beside the main street — the street-front lots. */
export function isStreetFrontCol(col: number): boolean {
  return col === ROAD_COLUMN - 1 || col === ROAD_COLUMN + 1;
}

/**
 * 0-based index of the plot block a grid row belongs to, and whether `row` is
 * that block's first (street-front-facing) plot row — decoration only (R-2),
 * used to place the §3.7 item-3 streetlight on every second block.
 */
export function blockIndexOf(row: number): number {
  return Math.floor((row - TOWN_HEAD_ROWS - 1) / (BLOCK_ROWS + 1));
}
export function isBlockFirstRow(row: number): boolean {
  return (row - TOWN_HEAD_ROWS - 1) % (BLOCK_ROWS + 1) === 0;
}

/** Whole blocks are always rendered, so the town always closes on a cross street. */
export function blockCount(plotCount: number): number {
  return Math.max(1, Math.ceil(Math.ceil(plotCount / TOWN_COLUMNS) / BLOCK_ROWS));
}

/** Grid rows to render for `plotCount` plots (head rows + blocks + the closing cross street). */
export function gridRowCount(plotCount: number): number {
  return TOWN_HEAD_ROWS + blockCount(plotCount) * (BLOCK_ROWS + 1) + 1;
}

/** Cross-street rows to render: the entrance, the savings block's closer, and one per block. */
export function crossStreetRowCount(plotCount: number): number {
  return blockCount(plotCount) + 2;
}

/** Plot tiles to render — padded out to a whole block, the road-era version of "pad to a full row". */
export function renderedTileCount(plotCount: number): number {
  return blockCount(plotCount) * BLOCK_ROWS * TOWN_COLUMNS;
}

/** Which side of the main street a grid column sits on — drives building facing. */
export function roadSideOf(col: number): "left" | "right" {
  return col < ROAD_COLUMN ? "left" : "right";
}

/**
 * The grid template, GENERATED from the constants above (rule R-3) — the
 * stylesheet must never hardcode "1fr 1fr 1fr 22px 1fr 1fr 1fr", because that
 * string silently encodes both GRID_COLUMNS and ROAD_COLUMN.
 */
export const GRID_TEMPLATE_COLUMNS = Array.from({ length: GRID_COLUMNS }, (_, c) =>
  c === ROAD_COLUMN ? `${ROAD_WIDTH_PX}px` : "1fr",
).join(" ");

/**
 * Plot tile width at a given viewport width. Also the width of one savings
 * lot (§2.5) and the width `PIPS_PER_ROW` is derived against — one width
 * function for the whole town.
 */
export function plotTileWidthPx(viewportPx: number): number {
  const inner = viewportPx - GRID_PADDING_X_PX * 2;
  const gaps = (GRID_COLUMNS - 1) * GRID_GAP_PX;
  return (inner - gaps - ROAD_WIDTH_PX) / TOWN_COLUMNS;
}

// ── §2.5 — savings plot geometry (sizes the block even before the next task
// fills it with real structures, so the block never resizes a second time) ──

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
 * the tile width comes from, so a change to GRID_GAP_PX / ROAD_WIDTH_PX /
 * GRID_PADDING_X_PX moves this with it instead of silently overflowing.
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

// ── Rule R-2 (decoration) — pure function of (row, col) alone, never stored ──

/** Decoration only. Pure, (row, col) -> variant. Never stored, never persisted, never versioned. */
export function decorVariant(row: number, col: number, kinds: number): number {
  return (((row * 31 + col * 17) % kinds) + kinds) % kinds;
}
