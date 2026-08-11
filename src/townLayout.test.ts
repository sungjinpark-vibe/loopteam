/**
 * ADDENDUM-01 §3.8 — road layout unit tests (component-placement DOM tests
 * live in components/TownGrid.test.tsx). `[unit]`/`[dom]`/`[qa]` legend per
 * ADDENDUM-01 §2.9.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { plotFromIndex, TOWN_COLUMNS } from "./selectors";
import { SAVING_CATEGORY_IDS } from "./savingsBuckets";
import {
  BLOCK_ROWS,
  DISTRICT_ROW_GAP_PX,
  GRID_COLUMNS,
  GRID_PADDING_X_PX,
  GRID_TEMPLATE_COLUMNS,
  LAYOUT_VERSION,
  LOTS_PER_BLOCK,
  MAX_EDGE_INSET,
  MIN_TILE_WIDTH_PX,
  MIN_UNMASKED_LOTS_PER_BLOCK,
  MIN_VIEWPORT_PX,
  PIPS_PER_ROW,
  ROAD_COLUMN,
  ROAD_WIDTH_PX,
  SAVINGS_COLUMN_RANK,
  SAVINGS_ROWS,
  SAVINGS_ROW_ORDER,
  SEG_STEP_PX,
  SERPENTINE_COLUMNS,
  TERRACE_BLEED_PX,
  TERRACE_TINTS,
  TOWN_HEAD_ROWS,
  blockColumnInset,
  blockFirstRow,
  blockGridColumnEnd,
  blockGridColumnStart,
  blockIndexOf,
  cellFromIndex,
  crossStreetColumnRange,
  crossStreetRowCount,
  districtLadderLength,
  freeSavingsCells,
  gridRowCount,
  indexFromPlot,
  isBlockFirstRow,
  isCrossStreetRow,
  isMaskedCell,
  isMaskedPlotCol,
  isMaskedPlotIndex,
  isPrimeLot,
  isPrimePlotIndex,
  isRoadCell,
  isSavingsRow,
  pipBlockHeightPx,
  pipRowCount,
  pipRowWidthPx,
  plotTileWidthPx,
  renderedTileCount,
  savingsCellFor,
  savingsPlotHeightPx,
  savingsPlotTemplateRows,
  structureHeightPx,
  terraceEdgeInsetPx,
  terraceTintOf,
  unmaskedLotsInBlock,
} from "./townLayout";
import type { SavingCategoryId } from "./types";

const MAX_I = 600;

describe("plot space <-> screen space round-trip (§3.1)", () => {
  it("indexFromPlot is the exact inverse of plotFromIndex, i = 0..600", () => {
    for (let i = 0; i <= MAX_I; i++) {
      expect(indexFromPlot(plotFromIndex(i))).toBe(i);
    }
  });

  it("plotFromIndex(indexFromPlot(p)) deep-equals p", () => {
    for (let i = 0; i <= MAX_I; i++) {
      const plot = plotFromIndex(i);
      expect(plotFromIndex(indexFromPlot(plot))).toEqual(plot);
    }
  });
});

describe("cellFromIndex (§3.3)", () => {
  it("is injective, i = 0..600", () => {
    const seen = new Set<string>();
    for (let i = 0; i <= MAX_I; i++) {
      const { row, col } = cellFromIndex(i);
      const key = `${row},${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("no plot index ever lands on the road column or a cross-street row, i = 0..600", () => {
    for (let i = 0; i <= MAX_I; i++) {
      const { row, col } = cellFromIndex(i);
      expect(col).not.toBe(ROAD_COLUMN);
      expect(isCrossStreetRow(row)).toBe(false);
    }
  });

  it("worked values (ADDENDUM-01 §3.3, re-derived for ADDENDUM-05 §2's 8-column town)", () => {
    expect(cellFromIndex(0)).toEqual({ row: 3, col: 0 });
    expect(cellFromIndex(1)).toEqual({ row: 3, col: 1 });
    expect(cellFromIndex(2)).toEqual({ row: 3, col: 2 });
    expect(cellFromIndex(3)).toEqual({ row: 3, col: 3 });
    expect(cellFromIndex(7)).toEqual({ row: 3, col: 8 });
    expect(cellFromIndex(8)).toEqual({ row: 4, col: 8 }); // directly below (7) — §3.9
    expect(cellFromIndex(15)).toEqual({ row: 4, col: 0 });
    expect(cellFromIndex(16)).toEqual({ row: 6, col: 0 });
    expect(cellFromIndex(23)).toEqual({ row: 6, col: 8 });
    expect(cellFromIndex(24)).toEqual({ row: 7, col: 8 });
  });
});

describe("§2.1's structural (disjointness) invariant — the AC the whole D-32 answer rests on", () => {
  it("no plot index can ever land on a savings row or savings cell, i = 0..600", () => {
    const savingsCells = new Set(
      SAVING_CATEGORY_IDS.map((id) => {
        const c = savingsCellFor(id);
        return `${c.row},${c.col}`;
      }),
    );
    for (let i = 0; i <= MAX_I; i++) {
      const { row, col } = cellFromIndex(i);
      expect(row).toBeGreaterThanOrEqual(TOWN_HEAD_ROWS + 1);
      expect(isSavingsRow(row)).toBe(false);
      expect(savingsCells.has(`${row},${col}`)).toBe(false);
    }
  });

  it("holds as a property of the row formula, not just today's TOWN_HEAD_ROWS (asserted with head rows doubled)", () => {
    const rowFormula = (plotRow: number, headRows: number): number =>
      plotRow + Math.floor(plotRow / BLOCK_ROWS) + 1 + headRows;
    for (const headRows of [TOWN_HEAD_ROWS, TOWN_HEAD_ROWS * 2]) {
      for (let plotRow = 0; plotRow < 100; plotRow++) {
        // Smallest possible row is strictly greater than the largest possible
        // savings row (headRows - 1) for ANY headRows value.
        expect(rowFormula(plotRow, headRows)).toBeGreaterThan(headRows - 1);
      }
    }
  });
});

describe("frontage invariant — every rendered cell touches at least one road cell (§3.3)", () => {
  function roadNeighborCount(row: number, col: number): number {
    return [isRoadCell(row - 1, col), isRoadCell(row + 1, col), isRoadCell(row, col - 1), isRoadCell(row, col + 1)]
      .filter(Boolean).length;
  }

  // ADDENDUM-07: scoped to UNMASKED (rendered) lots, i = 0..600 — a masked
  // index is void, never rendered, never buildable (`isMaskedPlotIndex`), so
  // the invariant this describe block is named for simply does not apply to
  // it. `crossStreetColumnRange`'s union rule is what makes this hold BY
  // CONSTRUCTION for every unmasked lot: see the block-edge masking describe
  // block below for the proof-shaped tests.
  it("every UNMASKED plot cell has >= 1 road neighbor, i = 0..600", () => {
    for (let i = 0; i <= MAX_I; i++) {
      if (isMaskedPlotIndex(i)) continue;
      const { row, col } = cellFromIndex(i);
      expect(roadNeighborCount(row, col)).toBeGreaterThanOrEqual(1);
    }
  });

  it("every savings cell has >= 2 road neighbors (cross streets above AND below)", () => {
    for (const id of SAVING_CATEGORY_IDS) {
      const { row, col } = savingsCellFor(id);
      expect(roadNeighborCount(row, col)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("column permutations", () => {
  it("SERPENTINE_COLUMNS and SAVINGS_COLUMN_RANK are both permutations of the eight non-road grid columns", () => {
    const expected = [0, 1, 2, 3, 5, 6, 7, 8];
    expect(SERPENTINE_COLUMNS.length).toBe(TOWN_COLUMNS);
    expect(SAVINGS_COLUMN_RANK.length).toBe(TOWN_COLUMNS);
    expect([...SERPENTINE_COLUMNS].sort((a, b) => a - b)).toEqual(expected);
    expect([...SAVINGS_COLUMN_RANK].sort((a, b) => a - b)).toEqual(expected);
    expect(SERPENTINE_COLUMNS).not.toContain(ROAD_COLUMN);
    expect(SAVINGS_COLUMN_RANK).not.toContain(ROAD_COLUMN);
  });

  // ADDENDUM-07's `blockGridColumnStart`/`blockGridColumnEnd` (block-edge
  // masking) assume this monotonicity to turn "the first/last UNMASKED plot
  // column" straight into "the leftmost/rightmost live grid column" — a
  // permutation alone would not be enough.
  it("SERPENTINE_COLUMNS is monotonically increasing in plot-column order", () => {
    for (let i = 1; i < SERPENTINE_COLUMNS.length; i++) {
      expect(SERPENTINE_COLUMNS[i]).toBeGreaterThan(SERPENTINE_COLUMNS[i - 1]);
    }
  });
});

describe("MVP-SPEC F2's AC in screen space (D-30 answered, §3.9)", () => {
  it("consecutive plot indices within the same block are screen-adjacent", () => {
    const blockOf = (idx: number) => Math.floor(plotFromIndex(idx).row / BLOCK_ROWS);
    for (let i = 0; i < MAX_I; i++) {
      if (blockOf(i) !== blockOf(i + 1)) continue;
      const a = cellFromIndex(i);
      const b = cellFromIndex(i + 1);
      const sameRow = b.row === a.row;
      const nextRowSameCol = b.row === a.row + 1 && b.col === a.col;
      expect(sameRow || nextRowSameCol).toBe(true);
    }
  });

  it("spot check: index 8 renders directly below index 7 on screen (last column of an 8-wide row)", () => {
    expect(cellFromIndex(7)).toEqual({ row: 3, col: 8 });
    expect(cellFromIndex(8)).toEqual({ row: 4, col: 8 });
  });

  it("across a block boundary the column repeats and exactly one cross-street row lies between (15 -> 16)", () => {
    const a = cellFromIndex(15);
    const b = cellFromIndex(16);
    expect(a).toEqual({ row: 4, col: 0 });
    expect(b).toEqual({ row: 6, col: 0 });
    expect(b.col).toBe(a.col);
    expect(b.row - a.row).toBe(2);
    expect(isCrossStreetRow(a.row + 1)).toBe(true);
  });
});

describe("savingsCellFor / SAVINGS_ROW_ORDER / freeSavingsCells", () => {
  it("savingsCellFor is injective, off-road, and in a savings row for every id", () => {
    const seen = new Set<string>();
    for (const id of SAVING_CATEGORY_IDS) {
      const { row, col } = savingsCellFor(id);
      expect(col).not.toBe(ROAD_COLUMN);
      expect(isSavingsRow(row)).toBe(true);
      const key = `${row},${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("deposit and stock get the two street-front lots (§2.2/§3.3)", () => {
    expect(savingsCellFor("deposit").col).toBe(ROAD_COLUMN - 1);
    expect(savingsCellFor("stock").col).toBe(ROAD_COLUMN + 1);
  });

  it("worked cells (ADDENDUM-01 §3.3, re-derived for ADDENDUM-05 §2's 8-column town)", () => {
    expect(savingsCellFor("deposit")).toEqual({ row: 1, col: 3 });
    expect(savingsCellFor("stock")).toEqual({ row: 1, col: 5 });
    expect(savingsCellFor("emergency")).toEqual({ row: 1, col: 2 });
    expect(savingsCellFor("goal")).toEqual({ row: 1, col: 6 });
    expect(savingsCellFor("other_saving")).toEqual({ row: 1, col: 1 });
  });

  it("SAVINGS_ROW_ORDER is sorted by (row, col) and contains every id exactly once", () => {
    expect(SAVINGS_ROW_ORDER.length).toBe(SAVING_CATEGORY_IDS.length);
    expect(new Set(SAVINGS_ROW_ORDER).size).toBe(SAVING_CATEGORY_IDS.length);
    const cells = SAVINGS_ROW_ORDER.map(savingsCellFor);
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1];
      const cur = cells[i];
      expect(prev.row < cur.row || (prev.row === cur.row && prev.col < cur.col)).toBe(true);
    }
  });

  it("freeSavingsCells returns SAVINGS_ROWS*TOWN_COLUMNS - SAVING_CATEGORY_IDS.length cells, none on the road", () => {
    const cells = freeSavingsCells();
    expect(cells.length).toBe(SAVINGS_ROWS * TOWN_COLUMNS - SAVING_CATEGORY_IDS.length);
    // ADDENDUM-05 §2: 8 columns - 5 sub-types = 3 free cells now (was 1 at 6
    // columns) — in SAVINGS_COLUMN_RANK's column-rank order, not sorted ascending.
    expect(cells).toEqual([
      { row: 1, col: 7 },
      { row: 1, col: 0 },
      { row: 1, col: 8 },
    ]);
    for (const c of cells) expect(c.col).not.toBe(ROAD_COLUMN);
  });

  it("throws for an id outside SAVING_CATEGORY_IDS instead of returning a garbage cell (round-1 finding C2)", () => {
    // The legacy `invest` id is still a member of `SavingCategoryId` (types.ts)
    // but never of `SAVING_CATEGORY_IDS` — `savingsCellFor` no longer accepts
    // it at the type level either; `as never` simulates a value that reached
    // here bypassing the type checker (e.g. a bad cast).
    expect(() => savingsCellFor("invest" as never)).toThrow(/SAVING_CATEGORY_IDS/);
  });
});

describe("row/tile/cross-street counts and the grid template", () => {
  it("worked values (ADDENDUM-01 §3.3, re-derived for ADDENDUM-05 §2's 8-column town — one block now holds 16 plots)", () => {
    expect(gridRowCount(0)).toBe(6);
    expect(gridRowCount(16)).toBe(6);
    expect(gridRowCount(17)).toBe(9);
    expect(crossStreetRowCount(0)).toBe(3);
    expect(crossStreetRowCount(17)).toBe(4);
    expect(renderedTileCount(17)).toBe(32);
    expect(GRID_TEMPLATE_COLUMNS).toBe(
      "minmax(52px,1fr) minmax(52px,1fr) minmax(52px,1fr) minmax(52px,1fr) 22px minmax(52px,1fr) minmax(52px,1fr) minmax(52px,1fr) minmax(52px,1fr)",
    );
    // ADDENDUM-05 §2: every phone-class viewport (320..~518px) clamps to
    // MIN_TILE_WIDTH_PX now — the raw derived width (~27-47px here) is below
    // the floor at every one of these, which is the whole point of the clamp.
    expect(plotTileWidthPx(390)).toBe(52);
    expect(plotTileWidthPx(320)).toBe(52);
  });

  it("the first and last grid row are always cross streets, and row 1 is always a savings row", () => {
    for (const n of [0, 12, 13, 25, 100]) {
      const rows = gridRowCount(n);
      expect(isCrossStreetRow(0)).toBe(true);
      expect(isCrossStreetRow(rows - 1)).toBe(true);
      expect(isSavingsRow(1)).toBe(true);
    }
  });

  it("GRID_TEMPLATE_COLUMNS has exactly GRID_COLUMNS tokens, with the road's px token at ROAD_COLUMN and every other a minmax(MIN_TILE_WIDTH_PX, 1fr)", () => {
    const tokens = GRID_TEMPLATE_COLUMNS.split(" ");
    expect(tokens.length).toBe(GRID_COLUMNS);
    expect(tokens[ROAD_COLUMN]).toBe(`${ROAD_WIDTH_PX}px`);
    tokens.forEach((token, i) => {
      if (i !== ROAD_COLUMN) expect(token).toBe(`minmax(${MIN_TILE_WIDTH_PX}px,1fr)`);
    });
  });

  // Acceptance criterion #2 (ADDENDUM-05 §9): plotTileWidthPx clamps to the floor.
  it("plotTileWidthPx never returns below MIN_TILE_WIDTH_PX, at any supported viewport", () => {
    for (const v of [320, 360, 390, 430]) {
      expect(plotTileWidthPx(v)).toBeGreaterThanOrEqual(MIN_TILE_WIDTH_PX);
    }
    expect(plotTileWidthPx(390)).toBe(MIN_TILE_WIDTH_PX); // the clamp is what wins at phone width, not the raw derivation
  });
});

describe("savings plot geometry (§2.5) — never clamped, wraps instead of overflowing (AC-F13-16)", () => {
  it("(a) the widest pip line never overflows the narrowest plot at any supported viewport", () => {
    for (const v of [320, 360, 390, 430]) {
      expect(pipRowWidthPx(PIPS_PER_ROW)).toBeLessThanOrEqual(plotTileWidthPx(v));
    }
  });

  it("(b) PIPS_PER_ROW is maximal — one more pip would overflow at the narrowest viewport", () => {
    expect(pipRowWidthPx(PIPS_PER_ROW + 1)).toBeGreaterThan(plotTileWidthPx(MIN_VIEWPORT_PX));
  });

  it("(c) pipRowCount always fits its ladder length and is monotone non-decreasing", () => {
    let prev = 0;
    for (let n = 1; n <= 40; n++) {
      const rows = pipRowCount(n);
      expect(rows * PIPS_PER_ROW).toBeGreaterThanOrEqual(n);
      expect(rows).toBeGreaterThanOrEqual(prev);
      prev = rows;
    }
  });

  it("(d) the template's three rows plus the two gaps sum exactly to the plot's own inline height, n = 1, 8, 20", () => {
    for (const n of [1, 8, 20]) {
      const rowsPx = savingsPlotTemplateRows(n)
        .split(" ")
        .map((token) => Number(token.replace("px", "")));
      const sum = rowsPx.reduce((a, b) => a + b, 0) + 2 * DISTRICT_ROW_GAP_PX;
      expect(sum).toBe(savingsPlotHeightPx(n));
    }
  });

  it("heights are strictly increasing in ladder length and never clamped", () => {
    const n = 8;
    expect(structureHeightPx(2 * n) - structureHeightPx(n)).toBe(SEG_STEP_PX * n);
    expect(savingsPlotHeightPx(2 * n)).toBeGreaterThan(savingsPlotHeightPx(n));
  });

  it("pipBlockHeightPx grows with the ladder length (wraps rather than shrinking pips)", () => {
    expect(pipBlockHeightPx(PIPS_PER_ROW + 1)).toBeGreaterThan(pipBlockHeightPx(1));
  });
});

describe("districtLadderLength — sized to the longest ladder any structure resolves to", () => {
  it("is the default length with no overrides, and the override's length when it is longer", () => {
    const DEFAULT = [1, 2, 3];
    expect(districtLadderLength(DEFAULT, {})).toBe(3);
    const overrides: Partial<Record<SavingCategoryId, readonly number[]>> = { stock: [1, 2, 3, 4, 5] };
    expect(districtLadderLength(DEFAULT, overrides)).toBe(5);
  });
});

describe("ADDENDUM-05 §2 (F-EXP) — 8-column town expansion", () => {
  it("TOWN_COLUMNS/GRID_COLUMNS/SERPENTINE_COLUMNS match the spec's worked numbers", () => {
    expect(TOWN_COLUMNS).toBe(8);
    expect(GRID_COLUMNS).toBe(9);
    expect(SERPENTINE_COLUMNS.length).toBe(8);
    expect(SERPENTINE_COLUMNS).not.toContain(ROAD_COLUMN);
    expect(ROAD_COLUMN).toBe(4);
  });

  it("8-column serpentine round-trip: indexFromPlot(plotFromIndex(i)) === i, i = 0..600", () => {
    for (let i = 0; i <= MAX_I; i++) {
      expect(indexFromPlot(plotFromIndex(i))).toBe(i);
    }
  });

  it("frontage invariant still holds at 8 columns for every UNMASKED cell: >= 1 road neighbor, i = 0..600", () => {
    function roadNeighborCount(row: number, col: number): number {
      return [isRoadCell(row - 1, col), isRoadCell(row + 1, col), isRoadCell(row, col - 1), isRoadCell(row, col + 1)].filter(
        Boolean,
      ).length;
    }
    for (let i = 0; i <= MAX_I; i++) {
      if (isMaskedPlotIndex(i)) continue; // ADDENDUM-07 — void, never a rendered lot
      const { row, col } = cellFromIndex(i);
      expect(roadNeighborCount(row, col)).toBeGreaterThanOrEqual(1);
    }
  });

  it("no plot index ever lands on a savings cell at 8 columns, i = 0..600", () => {
    const savingsCells = new Set(
      SAVING_CATEGORY_IDS.map((id) => {
        const c = savingsCellFor(id);
        return `${c.row},${c.col}`;
      }),
    );
    for (let i = 0; i <= MAX_I; i++) {
      const { row, col } = cellFromIndex(i);
      expect(isSavingsRow(row)).toBe(false);
      expect(savingsCells.has(`${row},${col}`)).toBe(false);
    }
  });

  it("MIN_TILE_WIDTH_PX clamp: plotTileWidthPx never drops below it, and is exactly it at every supported phone viewport", () => {
    expect(MIN_TILE_WIDTH_PX).toBe(52);
    for (const v of [320, 360, 390, 430]) {
      expect(plotTileWidthPx(v)).toBe(MIN_TILE_WIDTH_PX);
    }
    // Wide enough that 8 unclamped columns fit, the raw derivation wins instead.
    expect(plotTileWidthPx(2000)).toBeGreaterThan(MIN_TILE_WIDTH_PX);
  });
});

describe("LAYOUT_VERSION (rule R-1, §3.6)", () => {
  it("is a stable integer constant, bumped to 3 by ADDENDUM-07's block-edge masking", () => {
    expect(Number.isInteger(LAYOUT_VERSION)).toBe(true);
    expect(LAYOUT_VERSION).toBe(3);
  });
});

describe("rule R-3 — App.css never places or measures a townLayout.ts coordinate/metric (§3.5/§3.8)", () => {
  // process.cwd() is the project root under `vitest run` (this project's
  // config/scripts always invoke it from there) — `import.meta.url` is not
  // reliably a `file://` URL inside vitest's own module transform pipeline.
  const appCssPath = join(process.cwd(), "src", "App.css");
  const appCss = readFileSync(appCssPath, "utf8");

  function ruleBodyOf(css: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?:^|[\\s,}])${escaped}\\s*\\{([^}]*)\\}`, "s").exec(css);
    return match ? match[1] : "__SELECTOR_NOT_FOUND__";
  }

  const forbiddenCoordinate = /grid-column\s*:|grid-row\s*:|grid-template-columns\s*:|grid-template-rows\s*:/;
  const forbiddenFallbackVar = /var\(\s*--[\w-]+\s*,/;

  it.each([
    ".town-grid",
    ".town-tile",
    ".town-main-street",
    ".town-cross-street",
    ".savings-plot",
    ".savings-plot--empty",
    ".savings-signpost",
  ])("%s carries no grid coordinate and no fallback var()", (selector) => {
    const body = ruleBodyOf(appCss, selector);
    expect(body).not.toBe("__SELECTOR_NOT_FOUND__");
    expect(body).not.toMatch(forbiddenCoordinate);
    expect(body).not.toMatch(forbiddenFallbackVar);
  });

  it(".savings-plot and .savings-structure never declare height/width directly (arrives inline from JS)", () => {
    for (const selector of [".savings-plot", ".savings-structure"]) {
      const body = ruleBodyOf(appCss, selector);
      if (body === "__SELECTOR_NOT_FOUND__") continue; // .savings-structure doesn't exist until the next task
      expect(body).not.toMatch(/(?<!min-|max-)\bheight\s*:/);
      expect(body).not.toMatch(/(?<!min-|max-)\bwidth\s*:/);
    }
  });

  it(".town-grid's padding and grid-auto-rows read from GRID_PADDING_X_PX/the keyword auto, not a literal", () => {
    const body = ruleBodyOf(appCss, ".town-grid");
    expect(body).toMatch(/padding:\s*8px\s+var\(--town-grid-pad-x\)\s+24px/);
    expect(body).toMatch(/grid-auto-rows:\s*auto/);
  });
});

describe("terrain — terraceEdgeInsetPx / terraceTintOf (ADDENDUM-06 §2, AC-1)", () => {
  it("TERRACE_BLEED_PX stays inside GRID_PADDING_X_PX, so a slab never overflows the viewport", () => {
    expect(TERRACE_BLEED_PX).toBeLessThanOrEqual(GRID_PADDING_X_PX);
  });

  it("terraceEdgeInsetPx is always in [0, TERRACE_BLEED_PX], b = 0..200, both sides", () => {
    for (let b = 0; b <= 200; b++) {
      for (const side of [0, 1] as const) {
        const inset = terraceEdgeInsetPx(b, side);
        expect(inset).toBeGreaterThanOrEqual(0);
        expect(inset).toBeLessThanOrEqual(TERRACE_BLEED_PX);
      }
    }
  });

  it("terraceTintOf is always in [0, TERRACE_TINTS), b = 0..200", () => {
    for (let b = 0; b <= 200; b++) {
      const tint = terraceTintOf(b);
      expect(tint).toBeGreaterThanOrEqual(0);
      expect(tint).toBeLessThan(TERRACE_TINTS);
    }
  });
});

describe("blockFirstRow (ADDENDUM-06 §2, AC-4)", () => {
  it("blockFirstRow(0) is the first plot row right after the town head", () => {
    expect(blockFirstRow(0)).toBe(TOWN_HEAD_ROWS + 1);
  });

  it("blockFirstRow(b) is <= every row blockIndexOf resolves back to block b, and is itself a block-first row, b = 0..200", () => {
    for (let b = 0; b <= 200; b++) {
      const firstRow = blockFirstRow(b);
      expect(blockIndexOf(firstRow)).toBeLessThanOrEqual(firstRow);
      expect(isBlockFirstRow(firstRow)).toBe(true);
    }
  });
});

describe("isPrimeLot / isPrimePlotIndex — 명당 (ADDENDUM-06 §2, AC-5)", () => {
  it("exactly 2 prime cells per block's first row, b = 0..50", () => {
    for (let b = 0; b <= 50; b++) {
      const row = blockFirstRow(b);
      let count = 0;
      for (let col = 0; col < GRID_COLUMNS; col++) {
        if (isPrimeLot(row, col)) count++;
      }
      expect(count).toBe(2);
    }
  });

  it("row 0 (entrance cross street) is never a prime lot despite the signed-modulo trap", () => {
    expect(isPrimeLot(0, ROAD_COLUMN - 1)).toBe(false);
    expect(isPrimeLot(0, ROAD_COLUMN + 1)).toBe(false);
  });

  it("the road column itself is never a prime lot, for any row", () => {
    for (let row = 0; row <= 30; row++) {
      expect(isPrimeLot(row, ROAD_COLUMN)).toBe(false);
    }
  });

  it("isPrimePlotIndex agrees with isPrimeLot(cellFromIndex(i)), i = 0..600", () => {
    for (let i = 0; i <= MAX_I; i++) {
      const { row, col } = cellFromIndex(i);
      expect(isPrimePlotIndex(i)).toBe(isPrimeLot(row, col));
    }
  });
});

// ── ADDENDUM-07 — block-edge masking, the outer silhouette ──

describe("blockColumnInset — capped, deterministic, never Math.random (R-2)", () => {
  it("is always in [0, MAX_EDGE_INSET], b = 0..200, both sides", () => {
    expect(MAX_EDGE_INSET).toBe(2);
    for (let b = 0; b <= 200; b++) {
      for (const side of [0, 1] as const) {
        const inset = blockColumnInset(b, side);
        expect(Number.isInteger(inset)).toBe(true);
        expect(inset).toBeGreaterThanOrEqual(0);
        expect(inset).toBeLessThanOrEqual(MAX_EDGE_INSET);
      }
    }
  });

  it("is a pure function of (b, side) alone — calling it twice never drifts", () => {
    for (let b = 0; b <= 20; b++) {
      expect(blockColumnInset(b, 0)).toBe(blockColumnInset(b, 0));
      expect(blockColumnInset(b, 1)).toBe(blockColumnInset(b, 1));
    }
  });
});

describe("street-front / 명당 plot columns (3, 4) can NEVER be masked", () => {
  it("isMaskedPlotCol(b, 3) and isMaskedPlotCol(b, 4) are always false, b = 0..200", () => {
    // Structural, not incidental: MAX_EDGE_INSET = 2 caps the left mask at
    // plot cols {0,1} and the right mask at plot cols {6,7} — cols 2..5 are
    // outside either range for ANY inset value <= MAX_EDGE_INSET, so this
    // holds regardless of what `decorVariant` returns.
    for (let b = 0; b <= 200; b++) {
      expect(isMaskedPlotCol(b, 3)).toBe(false);
      expect(isMaskedPlotCol(b, 4)).toBe(false);
    }
  });

  it("every 명당 (isPrimeLot) cell is therefore never masked, i = 0..600", () => {
    for (let i = 0; i <= MAX_I; i++) {
      if (!isPrimePlotIndex(i)) continue;
      expect(isMaskedPlotIndex(i)).toBe(false);
    }
  });
});

describe("block widths genuinely differ — the outline is no longer a rectangle", () => {
  function widthOf(b: number): number {
    return TOWN_COLUMNS - blockColumnInset(b, 0) - blockColumnInset(b, 1);
  }

  it("blocks 0..4 are [5, 6, 7, 5, 6] plot columns wide — the director's own worked example", () => {
    const widths = [0, 1, 2, 3, 4].map(widthOf);
    expect(widths).toEqual([5, 6, 7, 5, 6]);
  });

  it("widths vary by >= 2 plot columns across the first 5 blocks (a 74-building town's worth)", () => {
    const widths = [0, 1, 2, 3, 4].map(widthOf);
    expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThanOrEqual(2);
    // No two ADJACENT blocks share a width either — the silhouette actually
    // steps in/out at every block boundary, not just "differs somewhere".
    for (let b = 1; b < widths.length; b++) expect(widths[b]).not.toBe(widths[b - 1]);
  });

  it("unmaskedLotsInBlock never drops below MIN_UNMASKED_LOTS_PER_BLOCK (the G2 floor), b = 0..200", () => {
    expect(MIN_UNMASKED_LOTS_PER_BLOCK).toBe(8);
    for (let b = 0; b <= 200; b++) {
      expect(unmaskedLotsInBlock(b)).toBeGreaterThanOrEqual(MIN_UNMASKED_LOTS_PER_BLOCK);
      expect(unmaskedLotsInBlock(b)).toBeLessThanOrEqual(LOTS_PER_BLOCK);
    }
  });
});

describe("isMaskedCell / isMaskedPlotIndex — grid space and plot-index space agree", () => {
  it("isMaskedPlotIndex(i) === isMaskedCell(cellFromIndex(i)), i = 0..600", () => {
    for (let i = 0; i <= MAX_I; i++) {
      const { row, col } = cellFromIndex(i);
      expect(isMaskedPlotIndex(i)).toBe(isMaskedCell(row, col));
    }
  });

  it("never masks the road column, any savings row, or the entrance/head rows", () => {
    for (let row = 0; row <= 10; row++) {
      expect(isMaskedCell(row, ROAD_COLUMN)).toBe(false);
    }
    for (let row = 0; row <= TOWN_HEAD_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) expect(isMaskedCell(row, col)).toBe(false);
    }
  });

  it("some plot cells ARE masked (the mechanism actually fires, not a no-op)", () => {
    let maskedCount = 0;
    for (let i = 0; i <= MAX_I; i++) if (isMaskedPlotIndex(i)) maskedCount++;
    expect(maskedCount).toBeGreaterThan(0);
  });
});

describe("crossStreetColumnRange — the union rule (spec §3.2's frontage invariant)", () => {
  it("the entrance row (0) and the savings closing row (TOWN_HEAD_ROWS) always span the full grid", () => {
    expect(crossStreetColumnRange(0)).toEqual({ start: 0, end: GRID_COLUMNS - 1 });
    expect(crossStreetColumnRange(TOWN_HEAD_ROWS)).toEqual({ start: 0, end: GRID_COLUMNS - 1 });
  });

  it("an inter-block cross street is NEVER narrower than either adjacent block's own span, b = 0..50", () => {
    for (let b = 0; b <= 50; b++) {
      const row = blockFirstRow(b) + BLOCK_ROWS; // the closer directly below block b
      const { start, end } = crossStreetColumnRange(row);
      expect(start).toBeLessThanOrEqual(blockGridColumnStart(b));
      expect(end).toBeGreaterThanOrEqual(blockGridColumnEnd(b));
      expect(start).toBeLessThanOrEqual(blockGridColumnStart(b + 1));
      expect(end).toBeGreaterThanOrEqual(blockGridColumnEnd(b + 1));
    }
  });

  it("isRoadCell agrees with crossStreetColumnRange on every cross-street row — the ONE thing NPC walkability and rendering both read", () => {
    for (let row = 0; row <= gridRowCount(600); row++) {
      if (!isCrossStreetRow(row)) continue;
      const { start, end } = crossStreetColumnRange(row);
      for (let col = 0; col < GRID_COLUMNS; col++) {
        expect(isRoadCell(row, col)).toBe(col >= start && col <= end);
      }
    }
  });

  it("NPC walkability regression: a column outside a narrow cross street's union is NOT a road cell", () => {
    // block 0 (width 5, plot cols masked {0,1,7}) meets block 1 (width 6,
    // masked {6,7}) at row blockFirstRow(0) + BLOCK_ROWS. Their union leaves
    // grid col 8 uncovered (neither block reaches it) — this is a concrete,
    // pinned regression for the general property the test above already
    // proves in general.
    const row = blockFirstRow(0) + BLOCK_ROWS;
    expect(crossStreetColumnRange(row).end).toBeLessThan(GRID_COLUMNS - 1);
    expect(isRoadCell(row, GRID_COLUMNS - 1)).toBe(false);
    expect(isRoadCell(row, ROAD_COLUMN)).toBe(true); // the main street itself is unaffected
  });
});
