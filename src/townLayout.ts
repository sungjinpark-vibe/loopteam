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
export const LAYOUT_VERSION = 3; // ADDENDUM-07 (silhouette): 2 -> 3, block-edge masking relocates every building

// ── §3.3 — grid shape ──

export const GRID_COLUMNS = TOWN_COLUMNS + 1; // 9 = 8 plot columns + 1 street column

// ADDENDUM-05 §2: ROAD_COLUMN/SERPENTINE_COLUMNS are literal constants, not
// derived from TOWN_COLUMNS — bumping TOWN_COLUMNS does not recentre them by
// itself. Hand-recomputed for 9 grid columns: ROAD_COLUMN is the exact
// middle (4), SERPENTINE_COLUMNS is every column but the road.
export const ROAD_COLUMN = 4; // 0-based grid column of the main street
export const BLOCK_ROWS = 2; // plot rows per block — forced by the frontage invariant (§3.2)

// Layout px (assumption; director may retune — none of these is a pacing dial).
export const TILE_HEIGHT_PX = 72; // unchanged from App.css's former grid-auto-rows
export const ROAD_WIDTH_PX = 22;
export const ROAD_HEIGHT_PX = 22;
export const GRID_GAP_PX = 6; // was 8 — recovers the width the street takes

/**
 * ADDENDUM-05 §2 (F-EXP): the floor `plotTileWidthPx` clamps to, so tiles
 * stop shrinking to fit a narrow phone. Reaches the stylesheet as the lower
 * bound of GRID_TEMPLATE_COLUMNS's `minmax()` tracks — a viewport too narrow
 * for every column to be this wide overflows `.town-grid` natively, which is
 * exactly what `.town-viewport`'s `overflow-x: auto` (TownGrid.tsx) is for.
 */
export const MIN_TILE_WIDTH_PX = 52;

/**
 * .town-grid's horizontal padding. Reaches the stylesheet ONLY as
 * `--town-grid-pad-x`, set inline from this constant — with no CSS fallback
 * value, because a fallback is a second source of truth that silently wins
 * when the property is missing. `plotTileWidthPx` reads the same constant, so
 * the width arithmetic and the painted padding cannot disagree (R-3).
 */
export const GRID_PADDING_X_PX = 16;

/** Plot column (0..7, straight from `plotFromIndex`) -> grid column, skipping the street. */
export const SERPENTINE_COLUMNS = [0, 1, 2, 3, 5, 6, 7, 8] as const;

// ── 저축 블록 (§2.4) — fixed cells, OUTSIDE plot-index space ──

/**
 * Prominence rank -> grid column: street-front pair, then each next-nearest
 * pair out. Rank 0/1 are the two sub-types the director named, so 예적금 and
 * 주식 투자 are the ones facing the main street. A CONTENT assumption (§7),
 * not a mechanic; one array to overturn.
 *
 * ADDENDUM-05 §2: re-derived by hand for 9 grid columns (ROAD_COLUMN = 4) by
 * the same rule that produced the old 7-column array — sort
 * SERPENTINE_COLUMNS by ascending distance from ROAD_COLUMN, ties broken by
 * ascending column: dist 1 -> [3,5], dist 2 -> [2,6], dist 3 -> [1,7],
 * dist 4 -> [0,8].
 */
export const SAVINGS_COLUMN_RANK = [3, 5, 2, 6, 1, 7, 0, 8] as const;

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
 * Savings-row cells with no structure on them, in column-rank order.
 * `SavingsRow.tsx` renders one 마을 안내판 (`.savings-signpost`) per cell
 * here. ADDENDUM-05 §2: widening TOWN_COLUMNS to 8 grew this from one cell
 * (6 columns - 5 sub-types) to three (8 - 5).
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

/**
 * True for any road cell — used by the frontage test, by decoration, and by
 * NPC walkability (`NpcLayer`). A cross-street row is only road WITHIN the
 * span `crossStreetColumnRange` (below) actually paints — ADDENDUM-07's
 * block-edge masking means that span is not always the full grid, and this
 * is the ONE function both TownGrid (the street's own `gridColumn`) and NPC
 * movement read, so the two can never disagree about where the ground is.
 */
export function isRoadCell(row: number, col: number): boolean {
  if (row < 0) return false;
  if (col === ROAD_COLUMN) return true;
  if (!isCrossStreetRow(row)) return false;
  const { start, end } = crossStreetColumnRange(row);
  return col >= start && col <= end;
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
 * stylesheet must never hardcode "1fr 1fr 1fr 1fr 22px 1fr 1fr 1fr 1fr",
 * because that string silently encodes GRID_COLUMNS, ROAD_COLUMN AND
 * MIN_TILE_WIDTH_PX. Each plot column is `minmax(MIN_TILE_WIDTH_PX, 1fr)` —
 * ADDENDUM-05 §2's "tiles stop shrinking to fit the phone" — so a narrow
 * viewport overflows the grid natively instead of the browser silently
 * shrinking columns below the floor; `.town-viewport`'s `overflow-x: auto`
 * (TownGrid.tsx) is what makes that overflow scrollable. No space after the
 * comma inside minmax(): a space would split one column into two tokens for
 * every consumer that does `GRID_TEMPLATE_COLUMNS.split(" ")` (own test below).
 */
export const GRID_TEMPLATE_COLUMNS = Array.from({ length: GRID_COLUMNS }, (_, c) =>
  c === ROAD_COLUMN ? `${ROAD_WIDTH_PX}px` : `minmax(${MIN_TILE_WIDTH_PX}px,1fr)`,
).join(" ");

/**
 * Plot tile width at a given viewport width, clamped to MIN_TILE_WIDTH_PX
 * (ADDENDUM-05 §2) — the one width function the whole town derives from:
 * `PIPS_PER_ROW` below, the savings-plot geometry (§2.5), and
 * GRID_TEMPLATE_COLUMNS's `minmax()` floor above all trace back to this same
 * clamp, so nothing hand-patches a second "at least 52px" rule.
 */
export function plotTileWidthPx(viewportPx: number): number {
  const inner = viewportPx - GRID_PADDING_X_PX * 2;
  const gaps = (GRID_COLUMNS - 1) * GRID_GAP_PX;
  const derived = (inner - gaps - ROAD_WIDTH_PX) / TOWN_COLUMNS;
  return Math.max(MIN_TILE_WIDTH_PX, derived);
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

// ── ADDENDUM-06 §2 — terrain. Render-time only, never persisted (C-2), pure
// functions of the grid row alone (C-3). No new state, no new storage key.

/**
 * Height of the earth cross-section hanging below a terrace slab.
 *
 * ponytail: capped at the cross-street row (ROAD_HEIGHT_PX = 22). The slab's
 * earth is absolutely positioned at `top: 100%`, and the NEXT block's slab is a
 * later DOM sibling that paints over it — so anything past ~22px is drawn but
 * invisible. 10px was too shallow to read as a wall at all (evidence 07);
 * 20px fills the available gap. Going deeper than this means taller row gaps,
 * which changes `grid-template-rows` and moves every NPC off the road
 * (NpcLayer measures resolved tracks off the live DOM, C-7) — that is a
 * layout task with a LAYOUT_VERSION bump, not a paint tweak.
 */
export const TERRACE_EARTH_PX = 20;
/** How far one terrace's shadow falls onto the ramp below it. */
export const TERRACE_DROP_PX = 6;
/**
 * Max horizontal bleed of a terrace slab past the plot columns, into
 * `.town-grid`'s own padding. MUST stay <= GRID_PADDING_X_PX (16) — a larger
 * value would push the slab under the viewport edge and reintroduce the
 * horizontal overflow `.town-viewport` exists to scroll. Asserted.
 */
export const TERRACE_BLEED_PX = 12;
/** Number of ground tints in the elevation ramp. */
export const TERRACE_TINTS = 3;
/** Number of distinct silhouette cuts a terrace edge can take. */
export const TERRACE_EDGE_CUTS = 3;

/** Grid row of block `b`'s FIRST plot row. Inverse of `blockIndexOf` on its first row. */
export function blockFirstRow(b: number): number {
  return TOWN_HEAD_ROWS + 1 + b * (BLOCK_ROWS + 1);
}

/** Elevation tint step for a terrace, 0..TERRACE_TINTS-1. Decoration only (R-2). */
export function terraceTintOf(b: number): number {
  return decorVariant(b, 0, TERRACE_TINTS);
}

/**
 * Silhouette inset, in px, of one terrace's left (side 0) / right (side 1)
 * edge — this is what makes the town outline irregular instead of a
 * rectangle. Reuses `decorVariant` (R-2): deterministic, never stored, never
 * `Math.random` (R-6). Always in [0, TERRACE_BLEED_PX].
 */
export function terraceEdgeInsetPx(b: number, side: 0 | 1): number {
  const cut = decorVariant(b, side + 1, TERRACE_EDGE_CUTS); // 0 | 1 | 2
  return Math.round((cut * TERRACE_BLEED_PX) / (TERRACE_EDGE_CUTS - 1)); // 0 | 6 | 12
}

/**
 * A 명당 (prime lot): the two street-front lots on a block's FIRST plot row —
 * the corner of the plaza where the cross street meets the main street, and
 * the lot that overlooks the terrace edge. Exactly 2 per block, at every town
 * size, forever.
 *
 * TRAP, do not drop the first clause: `isBlockFirstRow(0)` is `true`
 * (`(0 - 2 - 1) % 3 === 0` in JS's signed modulo), and row 0 is the entrance
 * CROSS STREET, not a plot row. `row > TOWN_HEAD_ROWS` is what excludes it —
 * and excludes the savings rows with it.
 */
export function isPrimeLot(row: number, col: number): boolean {
  return row > TOWN_HEAD_ROWS && isBlockFirstRow(row) && isStreetFrontCol(col);
}

/** The same predicate in plot-index space — what non-render callers (economy) use. */
export function isPrimePlotIndex(i: number): boolean {
  const { row, col } = cellFromIndex(i);
  return isPrimeLot(row, col);
}

// ── ADDENDUM-07 — block-edge masking: the outer silhouette. The terrace edge
// bleed above is a soft finish; THIS is the mechanism. Each block masks
// 0..MAX_EDGE_INSET whole plot columns off ITS OWN outer edges (never off the
// street-front columns), so blocks along the main street genuinely differ in
// width — that is what breaks the rectangle. Masked cells are void: no
// terrain, no tile, no placement (TownGrid.tsx / placement.ts).

/**
 * Columns a block can lose off ONE outer edge, capped well short of the
 * street-front columns (plot cols 3/4, i.e. grid cols ROAD_COLUMN±1) so a
 * 명당 can never be masked: with TOWN_COLUMNS = 8 and MAX_EDGE_INSET = 2, the
 * worst case masks plot cols {0,1} on the left and {6,7} on the right,
 * leaving cols 2..5 — including 3/4 — always live. Asserted directly in
 * townLayout.test.ts, not just implied by this comment.
 */
export const MAX_EDGE_INSET = 2;

/**
 * Columns masked off block `b`'s outer edge, `side` 0 = left / 1 = right.
 * Reuses `decorVariant` (rule R-2): pure function of the block index alone,
 * never stored, never `Math.random`. `kinds = MAX_EDGE_INSET + 1` gives 0, 1,
 * or 2, so the cap above is structural, not just the hash's typical range.
 */
export function blockColumnInset(b: number, side: 0 | 1): number {
  return decorVariant(b, side + 1, MAX_EDGE_INSET + 1);
}

/** True when plot column `plotCol` (0..TOWN_COLUMNS-1) is masked for block `b`. */
export function isMaskedPlotCol(b: number, plotCol: number): boolean {
  return plotCol < blockColumnInset(b, 0) || plotCol >= TOWN_COLUMNS - blockColumnInset(b, 1);
}

/**
 * True for a grid (row, col) that falls inside a plot block's masked outer
 * columns. False for every road/savings/head cell — those are never masked.
 */
export function isMaskedCell(row: number, col: number): boolean {
  if (row <= TOWN_HEAD_ROWS || isCrossStreetRow(row)) return false;
  const plotCol = SERPENTINE_COLUMNS.indexOf(col);
  if (plotCol < 0) return false; // the road column itself
  return isMaskedPlotCol(blockIndexOf(row), plotCol);
}

/** Same predicate in plot-index space — what `placement.ts` uses. */
export function isMaskedPlotIndex(i: number): boolean {
  const { row, col } = cellFromIndex(i);
  return isMaskedCell(row, col);
}

/**
 * Live (unmasked) grid-column span of block `b`, inclusive — the actual
 * silhouette TownGrid paints for its terrace/tiles. `SERPENTINE_COLUMNS` is
 * monotonic in plot-column order (asserted in townLayout.test.ts's "column
 * permutations" describe block), so the first/last UNMASKED plot column map
 * straight to the block's leftmost/rightmost live grid column.
 */
export function blockGridColumnStart(b: number): number {
  return SERPENTINE_COLUMNS[blockColumnInset(b, 0)];
}
export function blockGridColumnEnd(b: number): number {
  return SERPENTINE_COLUMNS[TOWN_COLUMNS - 1 - blockColumnInset(b, 1)];
}

/**
 * Guaranteed floor of unmasked (buildable) lots ANY block contributes,
 * independent of the specific `decorVariant` hash — MAX_EDGE_INSET caps each
 * side at 2, so a block can lose at most 4 of its TOWN_COLUMNS columns,
 * leaving >= 4 columns * BLOCK_ROWS rows. `placement.ts`'s G2 proof leans on
 * this floor, not on today's hash's actual (higher) yield, so it stays true
 * even if the hash changes.
 */
export const MIN_UNMASKED_LOTS_PER_BLOCK = (TOWN_COLUMNS - 2 * MAX_EDGE_INSET) * BLOCK_ROWS;

/** Actual unmasked (buildable) lot count of block `b` — always >= MIN_UNMASKED_LOTS_PER_BLOCK. */
export function unmaskedLotsInBlock(b: number): number {
  return (TOWN_COLUMNS - blockColumnInset(b, 0) - blockColumnInset(b, 1)) * BLOCK_ROWS;
}

/** Raw plot slots ("lots") one whole block spans — named so placement.ts never re-derives TOWN_COLUMNS * BLOCK_ROWS by hand. */
export const LOTS_PER_BLOCK = TOWN_COLUMNS * BLOCK_ROWS;

/** Cumulative unmasked (buildable) lot count across the first `blocks` blocks (0-indexed) — the actual capacity a `blocks`-block-deep pool provides. Pure geometry; `placement.ts`'s growth policy decides WHEN to add another block. */
export function unmaskedCapacity(blocks: number): number {
  let total = 0;
  for (let b = 0; b < blocks; b++) total += unmaskedLotsInBlock(b);
  return total;
}

/**
 * Inclusive grid-column span [start, end] a cross-street row covers — the
 * UNION of the two plot blocks it sits between, never narrower (spec §3.2's
 * frontage invariant: a lot may never lose its road frontage to masking).
 * Defined for ANY row for which `isCrossStreetRow(row)` is true, exactly
 * like `isCrossStreetRow`/`blockIndexOf` themselves — unbounded by any
 * particular town size, so this is the ONE thing both TownGrid (the street's
 * own `gridColumn`) and `isRoadCell` (NPC walkability) read; there is no
 * "current town size" parameter for the two to disagree over.
 *
 * The entrance row (0) and the savings block's own closing row
 * (TOWN_HEAD_ROWS) have no plot block adjacent yet, so both span the full grid.
 */
export function crossStreetColumnRange(row: number): { start: number; end: number } {
  if (row <= TOWN_HEAD_ROWS) return { start: 0, end: GRID_COLUMNS - 1 };
  const k = (row - TOWN_HEAD_ROWS) / (BLOCK_ROWS + 1);
  const above = k - 1;
  const below = k;
  return {
    start: Math.min(blockGridColumnStart(above), blockGridColumnStart(below)),
    end: Math.max(blockGridColumnEnd(above), blockGridColumnEnd(below)),
  };
}
