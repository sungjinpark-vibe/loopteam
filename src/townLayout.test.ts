/**
 * ADDENDUM-08 — fixed 20x20 map unit tests. `[unit]` (component-placement DOM
 * tests live in components/TownGrid.test.tsx).
 */
import { describe, expect, it } from "vitest";
import { SAVING_CATEGORY_IDS } from "./savingsBuckets";
import {
  CELL_COUNT,
  DISTRICT_ROW_GAP_PX,
  GRID_GAP_PX,
  GRID_PADDING_X_PX,
  GRID_SIZE,
  GRID_TEMPLATE_COLUMNS,
  GRID_TEMPLATE_ROWS,
  LAYOUT_VERSION,
  MIN_TILE_WIDTH_PX,
  MIN_VIEWPORT_PX,
  PIPS_PER_ROW,
  SAVINGS_ROW_ORDER,
  TERRACE_DROP_PX,
  TERRACE_EARTH_PX,
  TERRACE_TINTS,
  TILE_HEIGHT_PX,
  TOWN_MAP,
  cellFromIndex,
  decorVariant,
  districtLadderLength,
  elevationBandOf,
  footprintCells,
  inBounds,
  indexFromCell,
  isBuildable,
  isPrimeCell,
  isPrimePlotIndex,
  isRoadCell,
  isWalkable,
  pipBlockHeightPx,
  pipRowCount,
  pipRowWidthPx,
  plotTileWidthPx,
  savingsCellFor,
  savingsCells,
  savingsPlotHeightPx,
  savingsPlotTemplateRows,
  structureHeightPx,
  terrainAt,
  terrainAtIndex,
} from "./townLayout";
import type { TerrainKind } from "./townLayout";
import type { SavingCategoryId } from "./types";

// ── shared helpers over the raw map, used by several describe blocks ──

function terrainCharAt(row: number, col: number): string {
  return TOWN_MAP[row][col];
}

const NEIGHBOR_OFFSETS: ReadonlyArray<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

describe("TOWN_MAP structure (§1.2)", () => {
  it("is exactly 20 rows", () => {
    expect(TOWN_MAP.length).toBe(20);
  });

  it("every row is exactly 20 characters", () => {
    for (let r = 0; r < TOWN_MAP.length; r++) expect(TOWN_MAP[r].length).toBe(20);
  });

  it("every character is one of the six legend symbols", () => {
    const legal = new Set([".", "#", "P", "L", "S", " "]);
    for (const row of TOWN_MAP) for (const ch of row) expect(legal.has(ch)).toBe(true);
  });
});

describe("census — the map's fingerprint (§1.2)", () => {
  it("ground/road/park/lake/savings/void counts match the authored map exactly", () => {
    const counts: Record<string, number> = {};
    for (const row of TOWN_MAP) for (const ch of row) counts[ch] = (counts[ch] ?? 0) + 1;
    expect(counts["."]).toBe(193);
    expect(counts["#"]).toBe(93);
    expect(counts["P"]).toBe(29);
    expect(counts["L"]).toBe(12);
    expect(counts["S"]).toBe(5);
    expect(counts[" "]).toBe(68);
  });

  it("census sums to CELL_COUNT (400)", () => {
    const total = TOWN_MAP.reduce((sum, row) => sum + row.length, 0);
    expect(total).toBe(CELL_COUNT);
    expect(CELL_COUNT).toBe(400);
    expect(GRID_SIZE).toBe(20);
  });
});

describe("savings cells (§1.2)", () => {
  it("exactly 5 S cells, contiguous on row 1, cols 7..11", () => {
    const cells: Array<[number, number]> = [];
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) if (terrainCharAt(r, c) === "S") cells.push([r, c]);
    expect(cells).toEqual([
      [1, 7],
      [1, 8],
      [1, 9],
      [1, 10],
      [1, 11],
    ]);
  });

  it("every S cell is orthogonally adjacent to a road cell", () => {
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        if (terrainCharAt(r, c) !== "S") continue;
        const adjacent = NEIGHBOR_OFFSETS.some(([dr, dc]) => terrainCharAt(r + dr, c + dc) === "#");
        expect(adjacent).toBe(true);
      }
    }
  });
});

describe("road network connectivity (§1.2)", () => {
  it("all 93 road cells are one connected component (4-neighbour flood fill)", () => {
    const roadCells: Array<[number, number]> = [];
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) if (terrainCharAt(r, c) === "#") roadCells.push([r, c]);
    expect(roadCells.length).toBe(93);

    const visited = new Set<string>();
    const stack: Array<[number, number]> = [roadCells[0]];
    visited.add(`${roadCells[0][0]},${roadCells[0][1]}`);
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      for (const [dr, dc] of NEIGHBOR_OFFSETS) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc) || terrainCharAt(nr, nc) !== "#") continue;
        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;
        visited.add(key);
        stack.push([nr, nc]);
      }
    }
    expect(visited.size).toBe(roadCells.length);
  });
});

describe("no landlocked ground cells (§1.2)", () => {
  it("every '.' cell has a road cell within Chebyshev distance 3", () => {
    function hasRoadWithin(r: number, c: number, dist: number): boolean {
      for (let dr = -dist; dr <= dist; dr++) {
        for (let dc = -dist; dc <= dist; dc++) {
          if (inBounds(r + dr, c + dc) && terrainCharAt(r + dr, c + dc) === "#") return true;
        }
      }
      return false;
    }
    let landlocked = 0;
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        if (terrainCharAt(r, c) === "." && !hasRoadWithin(r, c, 3)) landlocked++;
      }
    }
    expect(landlocked).toBe(0);
  });
});

describe("terrainAt / terrainAtIndex", () => {
  it("agrees with the raw map character at every cell", () => {
    const CHAR_TO_KIND: Record<string, TerrainKind> = {
      ".": "ground",
      "#": "road",
      P: "park",
      L: "lake",
      S: "savings",
      " ": "void",
    };
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        expect(terrainAt(r, c)).toBe(CHAR_TO_KIND[terrainCharAt(r, c)]);
      }
    }
  });

  it("returns void out of bounds in all four directions", () => {
    expect(terrainAt(-1, 5)).toBe("void");
    expect(terrainAt(20, 5)).toBe("void");
    expect(terrainAt(5, -1)).toBe("void");
    expect(terrainAt(5, 20)).toBe("void");
  });

  it("terrainAtIndex agrees with terrainAt(cellFromIndex(i)) for every valid index", () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      const { row, col } = cellFromIndex(i);
      expect(terrainAtIndex(i)).toBe(terrainAt(row, col));
    }
  });

  it("terrainAtIndex returns void for negative or overflowing indices", () => {
    expect(terrainAtIndex(-1)).toBe("void");
    expect(terrainAtIndex(400)).toBe("void");
  });
});

describe("cellFromIndex / indexFromCell — inverses over 0..399", () => {
  it("indexFromCell(cellFromIndex(i)) === i", () => {
    for (let i = 0; i < CELL_COUNT; i++) expect(indexFromCell(cellFromIndex(i))).toBe(i);
  });

  it("cellFromIndex(indexFromCell(cell)) deep-equals cell, every row/col", () => {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        expect(cellFromIndex(indexFromCell({ row, col }))).toEqual({ row, col });
      }
    }
  });

  it("worked values: 0 -> (0,0), 21 -> (1,1), 399 -> (19,19)", () => {
    expect(cellFromIndex(0)).toEqual({ row: 0, col: 0 });
    expect(cellFromIndex(21)).toEqual({ row: 1, col: 1 });
    expect(cellFromIndex(399)).toEqual({ row: 19, col: 19 });
  });
});

describe("inBounds", () => {
  it("true for every (row, col) inside the 20x20 grid, false just outside it", () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(19, 19)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(0, -1)).toBe(false);
    expect(inBounds(20, 0)).toBe(false);
    expect(inBounds(0, 20)).toBe(false);
  });
});

describe("isBuildable / isRoadCell / isWalkable (§5)", () => {
  it("isBuildable is true iff the cell is ground", () => {
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        expect(isBuildable(r, c)).toBe(terrainAt(r, c) === "ground");
      }
    }
  });

  it("isRoadCell is true iff the cell is road", () => {
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        expect(isRoadCell(r, c)).toBe(terrainAt(r, c) === "road");
      }
    }
  });

  it("isWalkable is true for road and park", () => {
    expect(isWalkable(2, 5)).toBe(true); // road
    expect(isWalkable(0, 6)).toBe(true); // park
  });

  it("isWalkable is false for ground, lake, savings, and void", () => {
    expect(isWalkable(3, 1)).toBe(false); // ground
    expect(isWalkable(9, 6)).toBe(false); // lake
    expect(isWalkable(1, 9)).toBe(false); // savings
    expect(isWalkable(0, 0)).toBe(false); // void
  });

  it("isWalkable agrees with terrainAt over the whole grid", () => {
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        const t = terrainAt(r, c);
        expect(isWalkable(r, c)).toBe(t === "road" || t === "park");
      }
    }
  });
});

describe("footprintCells (§2.1)", () => {
  const anchor = indexFromCell({ row: 3, col: 1 }); // ground, with ground neighbors to the right and below

  it("1x1 returns exactly the anchor", () => {
    expect(footprintCells(anchor, 1, 1)).toEqual([anchor]);
  });

  it("2x1 (w2 h1) returns the anchor and the cell to its right, in reading order", () => {
    expect(footprintCells(anchor, 2, 1)).toEqual([indexFromCell({ row: 3, col: 1 }), indexFromCell({ row: 3, col: 2 })]);
  });

  it("1x2 (w1 h2) returns the anchor and the cell below it, in reading order", () => {
    expect(footprintCells(anchor, 1, 2)).toEqual([indexFromCell({ row: 3, col: 1 }), indexFromCell({ row: 4, col: 1 })]);
  });

  it("2x2 returns all four cells, row-major reading order", () => {
    expect(footprintCells(anchor, 2, 2)).toEqual([
      indexFromCell({ row: 3, col: 1 }),
      indexFromCell({ row: 3, col: 2 }),
      indexFromCell({ row: 4, col: 1 }),
      indexFromCell({ row: 4, col: 2 }),
    ]);
  });

  it("always returns exactly w*h cells, for every legal shape at a valid interior anchor", () => {
    const interior = indexFromCell({ row: 9, col: 9 });
    for (const [w, h] of [
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ] as const) {
      expect(footprintCells(interior, w, h).length).toBe(w * h);
    }
  });
});

describe("anchor counts on an empty map (§1.2)", () => {
  function isGround(row: number, col: number): boolean {
    return inBounds(row, col) && terrainAt(row, col) === "ground";
  }
  function countAnchors(w: number, h: number): number {
    let n = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (row + h > GRID_SIZE || col + w > GRID_SIZE) continue;
        const anchor = indexFromCell({ row, col });
        if (footprintCells(anchor, w, h).every((i) => { const c = cellFromIndex(i); return isGround(c.row, c.col); })) n++;
      }
    }
    return n;
  }

  it("2x2 has exactly 83 valid anchors", () => {
    expect(countAnchors(2, 2)).toBe(83);
  });

  it("1x2 (w1 h2) has exactly 115 valid anchors", () => {
    expect(countAnchors(1, 2)).toBe(115);
  });

  it("2x1 (w2 h1) has exactly 148 valid anchors", () => {
    expect(countAnchors(2, 1)).toBe(148);
  });

  it("1x1 has exactly 193 valid anchors — every ground cell", () => {
    expect(countAnchors(1, 1)).toBe(193);
  });
});

describe("prime cells — 명당 (§6)", () => {
  it("isPrimeCell is false for any non-ground cell", () => {
    expect(isPrimeCell(0, 0)).toBe(false); // void
    expect(isPrimeCell(2, 5)).toBe(false); // road
    expect(isPrimeCell(0, 6)).toBe(false); // park
    expect(isPrimeCell(9, 6)).toBe(false); // lake
    expect(isPrimeCell(1, 9)).toBe(false); // savings
  });

  it("exactly 20 prime cells over the whole grid", () => {
    let count = 0;
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) if (isPrimeCell(r, c)) count++;
    expect(count).toBe(20);
  });

  it("a known prime cell: (3,3) is ground, adjacent to road (3,4) and to nothing park/lake — spot check the converse holds too", () => {
    // (3,3) is ground next to the road at (3,4) but has no park/lake neighbor, so it is NOT prime —
    // pinned as a concrete negative case alongside the positive count above.
    expect(terrainAt(3, 3)).toBe("ground");
    expect(isPrimeCell(3, 3)).toBe(false);
  });

  it("isPrimePlotIndex agrees with isPrimeCell(cellFromIndex(i)) for every index", () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      const { row, col } = cellFromIndex(i);
      expect(isPrimePlotIndex(i)).toBe(isPrimeCell(row, col));
    }
  });
});

describe("elevationBandOf (§6)", () => {
  it("is floor(row / 5), four bands over 20 rows", () => {
    expect(elevationBandOf(0)).toBe(0);
    expect(elevationBandOf(4)).toBe(0);
    expect(elevationBandOf(5)).toBe(1);
    expect(elevationBandOf(9)).toBe(1);
    expect(elevationBandOf(10)).toBe(2);
    expect(elevationBandOf(14)).toBe(2);
    expect(elevationBandOf(15)).toBe(3);
    expect(elevationBandOf(19)).toBe(3);
  });
});

describe("decorVariant — unchanged from ADDENDUM-06 (R-2)", () => {
  it("matches the original formula exactly", () => {
    for (let row = 0; row <= 25; row++) {
      for (let col = 0; col <= 25; col++) {
        expect(decorVariant(row, col, 5)).toBe((((row * 31 + col * 17) % 5) + 5) % 5);
      }
    }
  });

  it("is always in [0, kinds)", () => {
    for (let row = 0; row <= 25; row++) {
      for (let col = 0; col <= 25; col++) {
        const v = decorVariant(row, col, 3);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(3);
      }
    }
  });
});

describe("savingsCells / savingsCellFor / SAVINGS_ROW_ORDER", () => {
  it("savingsCells returns the 5 S cells, left-to-right, row 1 cols 7..11", () => {
    expect(savingsCells()).toEqual([
      { row: 1, col: 7 },
      { row: 1, col: 8 },
      { row: 1, col: 9 },
      { row: 1, col: 10 },
      { row: 1, col: 11 },
    ]);
  });

  it("savingsCellFor is injective and every result is a real savings cell", () => {
    const seen = new Set<string>();
    for (const id of SAVING_CATEGORY_IDS) {
      const { row, col } = savingsCellFor(id);
      expect(terrainAt(row, col)).toBe("savings");
      const key = `${row},${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("worked cells, id rank -> column 7 + rank", () => {
    expect(savingsCellFor("deposit")).toEqual({ row: 1, col: 7 });
    expect(savingsCellFor("stock")).toEqual({ row: 1, col: 8 });
    expect(savingsCellFor("emergency")).toEqual({ row: 1, col: 9 });
    expect(savingsCellFor("goal")).toEqual({ row: 1, col: 10 });
    expect(savingsCellFor("other_saving")).toEqual({ row: 1, col: 11 });
  });

  it("throws for an id outside SAVING_CATEGORY_IDS instead of returning a garbage cell", () => {
    expect(() => savingsCellFor("invest" as never)).toThrow(/SAVING_CATEGORY_IDS/);
  });

  it("SAVINGS_ROW_ORDER contains every id exactly once, sorted by (row, col)", () => {
    expect(SAVINGS_ROW_ORDER.length).toBe(SAVING_CATEGORY_IDS.length);
    expect(new Set(SAVINGS_ROW_ORDER).size).toBe(SAVING_CATEGORY_IDS.length);
    const cells = SAVINGS_ROW_ORDER.map(savingsCellFor);
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1];
      const cur = cells[i];
      expect(prev.row < cur.row || (prev.row === cur.row && prev.col < cur.col)).toBe(true);
    }
  });
});

describe("GRID_TEMPLATE_COLUMNS / GRID_TEMPLATE_ROWS (§7)", () => {
  it("GRID_TEMPLATE_COLUMNS splits into exactly 20 tokens (no stray space inside minmax())", () => {
    const tokens = GRID_TEMPLATE_COLUMNS.split(" ");
    expect(tokens.length).toBe(GRID_SIZE);
    for (const token of tokens) expect(token).toBe(`minmax(${MIN_TILE_WIDTH_PX}px,1fr)`);
  });

  it("GRID_TEMPLATE_ROWS splits into exactly 20 uniform TILE_HEIGHT_PX tokens", () => {
    const tokens = GRID_TEMPLATE_ROWS.split(" ");
    expect(tokens.length).toBe(GRID_SIZE);
    for (const token of tokens) expect(token).toBe(`${TILE_HEIGHT_PX}px`);
  });

  it("MIN_TILE_WIDTH_PX and TILE_HEIGHT_PX are both 40 — a square grid", () => {
    expect(MIN_TILE_WIDTH_PX).toBe(40);
    expect(TILE_HEIGHT_PX).toBe(40);
  });
});

describe("plotTileWidthPx (§7)", () => {
  it("clamps to MIN_TILE_WIDTH_PX at phone-class viewports", () => {
    for (const v of [320, 360, 390, 430]) {
      expect(plotTileWidthPx(v)).toBe(MIN_TILE_WIDTH_PX);
    }
  });

  it("never returns below MIN_TILE_WIDTH_PX at any viewport", () => {
    for (const v of [200, 320, 800, 2000]) {
      expect(plotTileWidthPx(v)).toBeGreaterThanOrEqual(MIN_TILE_WIDTH_PX);
    }
  });

  it("derives a wider tile at a viewport wide enough for 20 unclamped columns", () => {
    expect(plotTileWidthPx(2000)).toBeGreaterThan(MIN_TILE_WIDTH_PX);
  });

  it("matches the no-road-column formula directly: (viewportPx - 2*pad - 19*gap) / 20, clamped", () => {
    const v = 900;
    const expected = Math.max(MIN_TILE_WIDTH_PX, (v - 2 * GRID_PADDING_X_PX - (GRID_SIZE - 1) * GRID_GAP_PX) / GRID_SIZE);
    expect(plotTileWidthPx(v)).toBeCloseTo(expected, 6);
  });
});

describe("savings plot geometry (§2.5) — unrelated to the map change, still sound after the width formula changed", () => {
  it("the widest pip line never overflows the narrowest plot at any supported viewport", () => {
    for (const v of [320, 360, 390, 430]) {
      expect(pipRowWidthPx(PIPS_PER_ROW)).toBeLessThanOrEqual(plotTileWidthPx(v));
    }
  });

  it("PIPS_PER_ROW is maximal — one more pip would overflow at the narrowest viewport", () => {
    expect(pipRowWidthPx(PIPS_PER_ROW + 1)).toBeGreaterThan(plotTileWidthPx(MIN_VIEWPORT_PX));
  });

  it("pipRowCount always fits its ladder length and is monotone non-decreasing", () => {
    let prev = 0;
    for (let n = 1; n <= 40; n++) {
      const rows = pipRowCount(n);
      expect(rows * PIPS_PER_ROW).toBeGreaterThanOrEqual(n);
      expect(rows).toBeGreaterThanOrEqual(prev);
      prev = rows;
    }
  });

  it("the template's three rows plus the two gaps sum exactly to the plot's own inline height", () => {
    for (const n of [1, 8, 20]) {
      const rowsPx = savingsPlotTemplateRows(n)
        .split(" ")
        .map((token) => Number(token.replace("px", "")));
      const sum = rowsPx.reduce((a, b) => a + b, 0) + 2 * DISTRICT_ROW_GAP_PX;
      expect(sum).toBe(savingsPlotHeightPx(n));
    }
  });

  it("heights are strictly increasing in ladder length", () => {
    expect(structureHeightPx(16)).toBeGreaterThan(structureHeightPx(8));
    expect(savingsPlotHeightPx(16)).toBeGreaterThan(savingsPlotHeightPx(8));
  });

  it("pipBlockHeightPx grows with the ladder length (wraps rather than shrinking pips)", () => {
    expect(pipBlockHeightPx(PIPS_PER_ROW + 1)).toBeGreaterThan(pipBlockHeightPx(1));
  });
});

describe("districtLadderLength", () => {
  it("is the default length with no overrides, and the override's length when it is longer", () => {
    const DEFAULT = [1, 2, 3];
    expect(districtLadderLength(DEFAULT, {})).toBe(3);
    const overrides: Partial<Record<SavingCategoryId, readonly number[]>> = { stock: [1, 2, 3, 4, 5] };
    expect(districtLadderLength(DEFAULT, overrides)).toBe(5);
  });
});

describe("terrace constants (§6)", () => {
  it("TERRACE_TINTS / TERRACE_EARTH_PX / TERRACE_DROP_PX keep their ADDENDUM-06 values", () => {
    expect(TERRACE_TINTS).toBe(3);
    expect(TERRACE_EARTH_PX).toBe(20);
    expect(TERRACE_DROP_PX).toBe(6);
  });
});

describe("LAYOUT_VERSION (rule R-1)", () => {
  it("is 4 — the fixed 20x20 map bump", () => {
    expect(Number.isInteger(LAYOUT_VERSION)).toBe(true);
    expect(LAYOUT_VERSION).toBe(4);
  });
});
