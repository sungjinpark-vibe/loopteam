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
  GRID_TEMPLATE_COLUMNS,
  LAYOUT_VERSION,
  MIN_TILE_WIDTH_PX,
  MIN_VIEWPORT_PX,
  PIPS_PER_ROW,
  ROAD_COLUMN,
  ROAD_WIDTH_PX,
  SAVINGS_COLUMN_RANK,
  SAVINGS_ROWS,
  SAVINGS_ROW_ORDER,
  SEG_STEP_PX,
  SERPENTINE_COLUMNS,
  TOWN_HEAD_ROWS,
  cellFromIndex,
  crossStreetRowCount,
  districtLadderLength,
  freeSavingsCells,
  gridRowCount,
  indexFromPlot,
  isCrossStreetRow,
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

  it("every plot cell has >= 1 road neighbor, i = 0..600", () => {
    for (let i = 0; i <= MAX_I; i++) {
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

  it("frontage invariant still holds at 8 columns: every plot cell has >= 1 road neighbor, i = 0..600", () => {
    function roadNeighborCount(row: number, col: number): number {
      return [isRoadCell(row - 1, col), isRoadCell(row + 1, col), isRoadCell(row, col - 1), isRoadCell(row, col + 1)].filter(
        Boolean,
      ).length;
    }
    for (let i = 0; i <= MAX_I; i++) {
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
  it("is a stable integer constant, bumped to 2 by ADDENDUM-05 §2's 8-column relayout", () => {
    expect(Number.isInteger(LAYOUT_VERSION)).toBe(true);
    expect(LAYOUT_VERSION).toBe(2);
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
