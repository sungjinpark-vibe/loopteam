/**
 * The repo's first COMPONENT test (ADDENDUM-01 §6/§2.9) — mounted via the
 * shared bare createRoot+act helper (`testUtils/mount.ts`), the same
 * discipline the existing hook harnesses already use (no
 * `@testing-library/react`). Covers every `[dom]` AC from ADDENDUM-01 §3.8
 * this task's rendering can prove; geometry/paint (crosswalk position, roof
 * lean) is `qa`'s job in a real browser — jsdom has `css: false` and no
 * layout engine (ADDENDUM-01 §2.9).
 */
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BALANCE } from "../balance.approved";
import { LONG_PRESS_MS, LONG_PRESS_TOLERANCE_PX } from "../hooks/useTileGestures";
import { freePlots, openPlotCount } from "../placement";
import { SAVING_CATEGORY_IDS } from "../savingsBuckets";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import {
  BLOCK_ROWS,
  GRID_COLUMNS,
  GRID_GAP_PX,
  GRID_PADDING_X_PX,
  GRID_TEMPLATE_COLUMNS,
  PIP_GAP_PX,
  PIP_SIZE_PX,
  ROAD_COLUMN,
  ROAD_WIDTH_PX,
  TOWN_HEAD_ROWS,
  blockCount,
  blockFirstRow,
  blockGridColumnEnd,
  blockGridColumnStart,
  crossStreetColumnRange,
  crossStreetRowCount,
  freeSavingsCells,
  gridRowCount,
  isCrossStreetRow,
  isMaskedPlotIndex,
  isPrimeLot,
  isRoadCell,
  renderedTileCount,
  roadSideOf,
  savingsCellFor,
} from "../townLayout";
import type { Building } from "../types";
import { TownGrid, type TownGridProps } from "./TownGrid";

let mounted: MountedComponent | null = null;

/** Rendered `.town-tile` count for a plot pool of `pool` raw indices with `buildings` occupying some of them — masked-but-unoccupied cells render no tile at all (ADDENDUM-07), masked-but-occupied ones still do (DE-2/G1). */
function expectedTileCount(pool: number, buildings: readonly Building[]): number {
  const occupied = new Set(buildings.map((b) => b.plotIndex));
  let count = 0;
  for (let i = 0; i < pool; i++) if (occupied.has(i) || !isMaskedPlotIndex(i)) count++;
  return count;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const cafeBuilding: Building = {
  id: "b1",
  source: { kind: "entry", entryId: "e1" },
  categoryId: "cafe",
  variantIndex: 0,
  plotIndex: 0,
  builtOn: "2026-08-02",
  createdAt: 1,
};

type MoveProps = Pick<TownGridProps, "movingId" | "cursorIndex" | "onPlotLongPress" | "onPlotTap" | "onCursorMove" | "onCancel">;

const NOOP_MOVE_PROPS: MoveProps = {
  movingId: null,
  cursorIndex: null,
  onPlotLongPress: () => false,
  onPlotTap: () => {},
  onCursorMove: () => {},
  onCancel: () => {},
};

function mountGrid(
  nextPlotIndex: number,
  buildings: readonly Building[] = [],
  moveProps: Partial<MoveProps> = {},
  savingsProps: Partial<Pick<TownGridProps, "savingsByCategoryKrw" | "ladder" | "ladderOverrides" | "justGrew">> = {},
  growCandidateIds?: TownGridProps["growCandidateIds"],
): HTMLElement {
  mounted = mountComponent(
    <TownGrid
      nextPlotIndex={nextPlotIndex}
      buildings={buildings}
      justBuiltId={null}
      savingsByCategoryKrw={undefined}
      ladder={BALANCE.savingsTowerSegments}
      ladderOverrides={{}}
      expPerLevel={BALANCE.expPerLevel}
      maxLevel={BALANCE.maxLevel}
      justGrew={null}
      onRiseSettled={() => {}}
      npcCount={0}
      {...NOOP_MOVE_PROPS}
      {...moveProps}
      {...savingsProps}
      growCandidateIds={growCandidateIds}
    />,
  );
  return mounted.container;
}

describe("TownGrid — road layout placement (ADDENDUM-01 §3.4/§3.8)", () => {
  it("sets all nine layout custom properties on the container, sourced from townLayout.ts", () => {
    const container = mountGrid(0);
    const grid = container.querySelector(".town-grid") as HTMLElement;
    expect(grid.style.getPropertyValue("--town-road-w")).toBe(`${ROAD_WIDTH_PX}px`);
    expect(grid.style.getPropertyValue("--town-road-h")).toBeTruthy();
    expect(grid.style.getPropertyValue("--town-tile-h")).toBeTruthy();
    expect(grid.style.getPropertyValue("--town-gap")).toBe(`${GRID_GAP_PX}px`);
    expect(grid.style.getPropertyValue("--town-grid-pad-x")).toBe(`${GRID_PADDING_X_PX}px`);
    expect(grid.style.getPropertyValue("--district-row-gap")).toBeTruthy();
    expect(grid.style.getPropertyValue("--pip-size")).toBe(`${PIP_SIZE_PX}px`);
    expect(grid.style.getPropertyValue("--pip-gap")).toBe(`${PIP_GAP_PX}px`);
    expect(grid.style.getPropertyValue("--pip-row-gap")).toBeTruthy();
    expect(grid.style.gridTemplateColumns).toBe(GRID_TEMPLATE_COLUMNS);
  });

  it("@toss/tds-colors resolves under Vitest: a real building's tile gets a non-empty inline background colour", () => {
    const container = mountGrid(1, [cafeBuilding]);
    const tile = container.querySelectorAll(".town-tile")[0] as HTMLElement;
    const swatch = tile.querySelector(".building-tile") as HTMLElement;
    expect(swatch).not.toBeNull();
    expect(swatch.style.backgroundColor).not.toBe("");
  });

  it("exactly one .town-main-street node, and crossStreetRowCount(pool) .town-cross-street nodes", () => {
    const container = mountGrid(13);
    expect(container.querySelectorAll(".town-main-street").length).toBe(1);
    // ADDENDUM-07: TownGrid renders off the masking-aware POOL
    // (`openPlotCount`), not the raw `nextPlotIndex` — the two used to
    // coincide almost everywhere (both round up to the same block boundary),
    // but block-edge masking can now need an extra block that 13 alone
    // wouldn't ask for.
    expect(container.querySelectorAll(".town-cross-street").length).toBe(crossStreetRowCount(openPlotCount(13, [])));
  });

  it("no tile ever sits on the road column or a cross-street/savings row (read from the inline style)", () => {
    const container = mountGrid(13);
    for (const tile of container.querySelectorAll(".town-tile")) {
      const el = tile as HTMLElement;
      expect(el.style.gridColumn).not.toBe(String(ROAD_COLUMN + 1));
      const row = Number(el.style.gridRow) - 1;
      expect(isCrossStreetRow(row)).toBe(false);
    }
  });

  it("the street node sits at ROAD_COLUMN and the container's template matches GRID_TEMPLATE_COLUMNS", () => {
    const container = mountGrid(13);
    const street = container.querySelector(".town-main-street") as HTMLElement;
    expect(street.style.gridColumn).toBe(String(ROAD_COLUMN + 1));
    const grid = container.querySelector(".town-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe(GRID_TEMPLATE_COLUMNS);
  });

  it("the main street spans the whole rendered town, not one row — regression for the '1 / -1' bug", () => {
    // ADDENDUM-05 §2: at 8 columns a block holds 16 plots, so 17 (not 13) is
    // the smallest plot count that spills into a second block.
    for (const n of [0, 17]) {
      const container = mountGrid(n);
      const street = container.querySelector(".town-main-street") as HTMLElement;
      const raw = street.getAttribute("style") ?? "";
      expect(raw).toMatch(new RegExp(`grid-row:\\s*1\\s*/\\s*span\\s*${gridRowCount(n)}\\b`));
      expect(raw).not.toMatch(/grid-row:\s*1\s*\/\s*-1/);
    }
    expect(gridRowCount(0)).toBe(6);
    expect(gridRowCount(17)).toBe(9);
  });

  it("every tile and every savings plot carries town-tile--left/right matching roadSideOf(col)", () => {
    const container = mountGrid(13);
    for (const tile of container.querySelectorAll(".town-tile")) {
      const el = tile as HTMLElement;
      const col = Number(el.style.gridColumn) - 1;
      expect(el.classList.contains(`town-tile--${roadSideOf(col)}`)).toBe(true);
    }
    for (const plot of container.querySelectorAll(".savings-plot")) {
      const el = plot as HTMLElement;
      const col = Number(el.style.gridColumn) - 1;
      expect(el.classList.contains(`town-tile--${roadSideOf(col)}`)).toBe(true);
    }
  });

  it("the savings block's five cells sit exactly at savingsCellFor(id), DOM order ascending by column, none on the road", () => {
    const container = mountGrid(0);
    const plots = [...container.querySelectorAll(".savings-plot")] as HTMLElement[];
    expect(plots.length).toBe(SAVING_CATEGORY_IDS.length);
    const ids = new Set(plots.map((p) => p.dataset.structureId));
    expect(ids.size).toBe(SAVING_CATEGORY_IDS.length);

    let lastCol = -1;
    for (const plot of plots) {
      const id = plot.dataset.structureId as (typeof SAVING_CATEGORY_IDS)[number];
      const cell = savingsCellFor(id);
      expect(Number(plot.style.gridColumn)).toBe(cell.col + 1);
      expect(Number(plot.style.gridRow)).toBe(cell.row + 1);
      expect(Number(plot.style.gridColumn)).not.toBe(ROAD_COLUMN + 1);
      expect(plot.classList.contains("savings-plot--empty")).toBe(true);
      expect(cell.col).toBeGreaterThan(lastCol);
      lastCol = cell.col;
    }
  });

  it("ADDENDUM-01 §2.4a/§2.5: savingsByCategoryKrw drives real (non-empty) structures, and all five plots still share one reserved height", () => {
    const container = mountGrid(0, [], {}, { savingsByCategoryKrw: { deposit: 5_000_000 } });
    const plots = [...container.querySelectorAll(".savings-plot")] as HTMLElement[];
    const heights = new Set(plots.map((p) => p.style.height));
    expect(heights.size).toBe(1); // shared-longest rule — one height across all five, even mid-growth
    const deposit = plots.find((p) => p.dataset.structureId === "deposit")!;
    expect(deposit.classList.contains("savings-plot--empty")).toBe(false);
    expect(deposit.querySelectorAll(".savings-pip--on").length).toBeGreaterThan(0);
    const stock = plots.find((p) => p.dataset.structureId === "stock")!;
    expect(stock.classList.contains("savings-plot--empty")).toBe(true); // untouched bucket stays empty
  });

  it("one signpost per freeSavingsCells() cell, never on the road", () => {
    // ADDENDUM-05 §2: 8 columns - 5 sub-types = 3 free cells now (was 1 at 6 columns).
    const container = mountGrid(0);
    const signposts = [...container.querySelectorAll(".savings-signpost")] as HTMLElement[];
    const free = freeSavingsCells();
    expect(signposts.length).toBe(free.length);
    const signpostCells = new Set(signposts.map((s) => `${Number(s.style.gridRow) - 1},${Number(s.style.gridColumn) - 1}`));
    for (const cell of free) {
      expect(signpostCells.has(`${cell.row},${cell.col}`)).toBe(true);
      expect(cell.col).not.toBe(ROAD_COLUMN);
    }
  });

  it("the fragment trap: .town-grid's direct children count matches the exact formula (§2.4a's guard)", () => {
    const container = mountGrid(0);
    const grid = container.querySelector(".town-grid") as HTMLElement;
    // ADDENDUM-05 §2: the trailing term is one signpost PER free savings cell
    // (freeSavingsCells().length), not a hardcoded 1 — that count grew from 1
    // to 3 when TOWN_COLUMNS went 6 -> 8 (see freeSavingsCells' own test).
    // ADDENDUM-05 §3: the final `+ 1` is the NPC layer (F-NPC). It is a real
    // grid item spanning `1 / -1` that positions its sprites absolutely inside
    // itself, so §2.4a's guard still means what it always meant — every direct
    // child is a grid item and no fragment has leaked one in.
    // ADDENDUM-06 §2/§9 (WP-A): `+ blockCount(0)` is one `.town-terrace` per
    // plot block, emitted before `.town-main-street` — also a real direct
    // grid item (T-R1/AC-2), so the guard's shape is unchanged, just one more term.
    // ADDENDUM-07: the tile term is `expectedTileCount(...)`, not
    // `renderedTileCount(0)` — a masked, unoccupied cell renders no
    // `.town-tile` node at all (block 0 alone voids 6 of its 16 raw lots).
    const expected =
      expectedTileCount(openPlotCount(0, []), []) +
      1 +
      crossStreetRowCount(0) +
      SAVING_CATEGORY_IDS.length +
      freeSavingsCells().length +
      1 +
      blockCount(0);
    expect(expected).toBe(24);
    expect(grid.children.length).toBe(expected);
  });

  it("ADDENDUM-05 §3 — the NPC layer is the LAST direct child of .town-grid, and is not interactive", () => {
    const container = mountGrid(0);
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const last = grid.lastElementChild as HTMLElement;
    // DOM order alone decides stacking inside the grid (App.css gives
    // `.town-tile` no z-index on purpose), so "last" is what puts NPCs above
    // every tile. `pointer-events: none` is what stops one eating a tap.
    expect(last.classList.contains("npc-layer")).toBe(true);
    expect(last.style.pointerEvents).toBe("none");
  });

  it("GRID_COLUMNS matches the template's token count (sanity cross-check with townLayout.test.ts)", () => {
    expect(GRID_TEMPLATE_COLUMNS.split(" ").length).toBe(GRID_COLUMNS);
  });
});

describe("TownGrid — ADDENDUM-07 block-edge masking: the outer silhouette is no longer a rectangle", () => {
  it("a masked, unoccupied cell renders no .town-tile node at all", () => {
    // block 0 masks plot indices {0, 1, 7, 8, 14, 15} (insetL=2, insetR=1) —
    // pick a comfortably large pool (20) with no buildings so every one of
    // them is unoccupied and therefore void.
    const container = mountGrid(20, []);
    for (const i of [0, 1, 7, 8, 14, 15]) {
      expect(isMaskedPlotIndex(i)).toBe(true); // sanity — this IS the masked set
      expect(container.querySelector(`[data-plot-index="${i}"]`)).toBeNull();
    }
    // its unmasked neighbor renders normally
    expect(container.querySelector('[data-plot-index="2"]')).not.toBeNull();
  });

  it("DE-2/G1 exception: a building that occupies a masked index still renders, never invisible", () => {
    const onMasked: Building = { ...cafeBuilding, plotIndex: 0 };
    const container = mountGrid(20, [onMasked]);
    const tile = container.querySelector('[data-plot-index="0"]') as HTMLElement;
    expect(tile).not.toBeNull();
    expect(tile.querySelector(".building-tile")).not.toBeNull();
  });

  it("terrace slabs span each block's OWN live column range, never the old full-width '1 / -1'", () => {
    const container = mountGrid(20, []); // 2 blocks
    const terraces = [...container.querySelectorAll<HTMLElement>(".town-terrace")];
    expect(terraces.length).toBe(2);
    for (let b = 0; b < terraces.length; b++) {
      const expectedCol = `${blockGridColumnStart(b) + 1} / ${blockGridColumnEnd(b) + 2}`;
      expect(terraces[b].style.gridColumn).toBe(expectedCol);
      expect(terraces[b].style.gridColumn).not.toBe("1 / -1");
    }
    // The two blocks genuinely differ (this is what makes the silhouette ragged).
    expect(terraces[0].style.gridColumn).not.toBe(terraces[1].style.gridColumn);
  });

  it("an inter-block cross street spans the union of its two neighbors (narrower than full width here), while the entrance/savings-closer stay full width", () => {
    const container = mountGrid(20, []); // 2 blocks
    const crossStreets = [...container.querySelectorAll<HTMLElement>(".town-cross-street")];
    const byRow = new Map(crossStreets.map((el) => [Number(el.style.gridRow) - 1, el]));

    const entranceRow = 0;
    const closerRow = TOWN_HEAD_ROWS;
    const interBlockRow = blockFirstRow(0) + BLOCK_ROWS;

    expect(byRow.get(entranceRow)!.style.gridColumn).toBe(`1 / ${GRID_COLUMNS + 1}`);
    expect(byRow.get(closerRow)!.style.gridColumn).toBe(`1 / ${GRID_COLUMNS + 1}`);

    const { start, end } = crossStreetColumnRange(interBlockRow);
    const interBlockEl = byRow.get(interBlockRow)!;
    expect(interBlockEl.style.gridColumn).toBe(`${start + 1} / ${end + 2}`);
    expect(interBlockEl.style.gridColumn).not.toBe(`1 / ${GRID_COLUMNS + 1}`); // genuinely narrower
  });

  it("isRoadCell and the rendered cross-street span agree — no NPC can ever be seeded onto a void column", () => {
    const container = mountGrid(20, []);
    const rowCount = gridRowCount(openPlotCount(20, []));
    const crossStreets = [...container.querySelectorAll<HTMLElement>(".town-cross-street")];
    const byRow = new Map(crossStreets.map((el) => [Number(el.style.gridRow) - 1, el]));
    for (let row = 0; row < rowCount; row++) {
      if (!isCrossStreetRow(row)) continue;
      const el = byRow.get(row)!;
      const [startTok, endTok] = el.style.gridColumn.split(" / ").map(Number);
      for (let col = 0; col < GRID_COLUMNS; col++) {
        expect(isRoadCell(row, col)).toBe(col >= startTok - 1 && col <= endTok - 2);
      }
    }
  });
});

describe("TownGrid — ADDENDUM-06 §2 terrain / §3.3 명당 marker (AC-2/AC-3/AC-6)", () => {
  it("AC-2 — one .town-terrace per block: count === blockCount(openPlotCount(...)) at plotCount 0/12/13/100, exactly 1 at plotCount 0", () => {
    for (const nextPlotIndex of [0, 12, 13, 100]) {
      const container = mountGrid(nextPlotIndex);
      expect(container.querySelectorAll(".town-terrace").length).toBe(blockCount(openPlotCount(nextPlotIndex, [])));
    }
    expect(mountGrid(0).querySelectorAll(".town-terrace").length).toBe(1);
  });

  it("AC-3 — every .town-terrace is inert ground (aria-hidden, no role, no data-plot-index, no z-index, pointer-events none), emitted before .town-main-street, and .npc-layer stays the LAST child", () => {
    const container = mountGrid(24);
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const children = [...grid.children];
    const terraceIdxs: number[] = [];
    let streetIdx = -1;
    children.forEach((c, i) => {
      if (c.classList.contains("town-terrace")) terraceIdxs.push(i);
      if (streetIdx === -1 && c.classList.contains("town-main-street")) streetIdx = i;
    });
    expect(terraceIdxs.length).toBe(blockCount(openPlotCount(24, [])));
    expect(streetIdx).toBeGreaterThan(-1);
    expect(Math.max(...terraceIdxs)).toBeLessThan(streetIdx); // T-R1: every terrace before the street

    for (const i of terraceIdxs) {
      const t = children[i] as HTMLElement;
      expect(t.getAttribute("aria-hidden")).toBe("true"); // T-R4
      expect(t.getAttribute("role")).toBeNull(); // T-R4
      expect(t.hasAttribute("data-plot-index")).toBe(false); // never a gesture-hit-testable tile
      expect(t.style.zIndex).toBe(""); // T-R1 — no z-index, ever
      expect(t.style.pointerEvents).toBe("none"); // T-R3
    }
    expect(grid.lastElementChild!.classList.contains("npc-layer")).toBe(true);
  });

  it("AC-6 — the NPC-safety AC: terraces change no grid track. .town-grid's gridTemplateColumns is identical regardless of terrace count, it never carries an inline gridTemplateRows, and no .town-terrace sets height/width/padding or a grid-template-* property (T-R2)", () => {
    const bareGrid = mountGrid(0).querySelector(".town-grid") as HTMLElement; // blockCount(0) === 1 terrace
    const grownGrid = mountGrid(100).querySelector(".town-grid") as HTMLElement; // several terraces

    expect(bareGrid.style.gridTemplateColumns).toBe(GRID_TEMPLATE_COLUMNS);
    expect(grownGrid.style.gridTemplateColumns).toBe(GRID_TEMPLATE_COLUMNS);
    expect(bareGrid.style.gridTemplateRows).toBe(""); // rows come from App.css's grid-auto-rows, never inline (R-3)
    expect(grownGrid.style.gridTemplateRows).toBe("");

    for (const grid of [bareGrid, grownGrid]) {
      for (const terrace of grid.querySelectorAll<HTMLElement>(".town-terrace")) {
        expect(terrace.style.height).toBe("");
        expect(terrace.style.width).toBe("");
        expect(terrace.style.padding).toBe("");
        expect(terrace.style.gridTemplateRows).toBe("");
        expect(terrace.style.gridTemplateColumns).toBe("");
      }
    }
  });

  it("AC-3.3 — a droppable 명당 gets .town-tile--droppable.town-tile--prime and the '명당 빈 터' aria-label; an ordinary droppable lot does not", () => {
    const container = mountGrid(2, [], { movingId: "not-in-buildings" });
    const droppable = [...container.querySelectorAll(".town-tile--droppable")] as HTMLElement[];
    expect(droppable.length).toBeGreaterThan(0);
    const primeDroppable = droppable.filter((t) => t.classList.contains("town-tile--prime"));
    const plainDroppable = droppable.filter((t) => !t.classList.contains("town-tile--prime"));
    expect(primeDroppable.length).toBeGreaterThan(0);
    expect(plainDroppable.length).toBeGreaterThan(0);
    for (const t of primeDroppable) expect(t.getAttribute("aria-label")).toBe("명당 빈 터, 여기로 옮기기");
    for (const t of plainDroppable) expect(t.getAttribute("aria-label")).toBe("빈 터, 여기로 옮기기");

    // Cross-check against the pure predicate: every .town-tile--prime tile's
    // (row, col) — read back from its own inline grid-column/grid-row — agrees
    // with isPrimeLot, and there are exactly the 2-per-block count on screen.
    const primeTiles = [...container.querySelectorAll(".town-tile--prime")] as HTMLElement[];
    for (const t of primeTiles) {
      const col = Number(t.style.gridColumn) - 1;
      const row = Number(t.style.gridRow) - 1;
      expect(isPrimeLot(row, col)).toBe(true);
    }
    expect(primeTiles.length).toBe(2 * blockCount(openPlotCount(2, [])));
  });
});

describe("TownGrid — ADDENDUM-02 §3.2/§8.3 AC-P9: random placement's on-screen pool", () => {
  function scatteredBuildings(indices: number[]): Building[] {
    return indices.map((plotIndex, i) => ({
      id: `sb${i}`,
      source: { kind: "entry", entryId: `se${i}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex,
      builtOn: "2026-08-02",
      createdAt: i,
    }));
  }

  it("renders each building at data-plot-index matching its plotIndex, no lot rendered twice, exactly the expected tile count", () => {
    // index 0 is masked (block 0) but occupied — DE-2/G1 still renders it
    // (see expectedTileCount's own doc); the others are all unmasked.
    const buildings = scatteredBuildings([0, 5, 11, 2]);
    const nextPlotIndex = 12;
    const container = mountGrid(nextPlotIndex, buildings);
    const tiles = [...container.querySelectorAll(".town-tile")] as HTMLElement[];

    expect(tiles.length).toBe(expectedTileCount(openPlotCount(nextPlotIndex, buildings), buildings));

    const seen = new Set<number>();
    for (const tile of tiles) {
      const idx = Number(tile.dataset.plotIndex);
      expect(seen.has(idx)).toBe(false); // no lot rendered twice
      seen.add(idx);
    }
    expect(seen.size).toBe(tiles.length);

    for (const b of buildings) {
      const tile = container.querySelector(`[data-plot-index="${b.plotIndex}"]`) as HTMLElement;
      expect(tile).not.toBeNull();
      expect(tile.id).toBe(`plot-${b.plotIndex}`);
      expect(tile.querySelector(".building-tile")).not.toBeNull();
    }
  });

  it("renders openPlotCount tiles (not the old renderedTileCount(nextPlotIndex)) once a building sits past the old tile boundary", () => {
    // A building at index 20 with nextPlotIndex=1 could not have existed
    // pre-addendum (a sequential cursor never overshoots itself), but a
    // move/import/corrupt-recovery (this task's boot reconciler) can now hand
    // a live building an index anywhere in the open pool — B20's DE-2
    // latent-bug fix (§7.2): the old `renderedTileCount(nextPlotIndex)` would
    // render only 16 tiles here and silently drop this building off-grid.
    // ADDENDUM-05 §2: 20 (not 14) — one 8-column block now covers 16 plots,
    // so the building has to sit past a WHOLE block to force the pool wider
    // than renderedTileCount(nextPlotIndex) alone.
    const buildings = scatteredBuildings([20]);
    const nextPlotIndex = 1;
    const container = mountGrid(nextPlotIndex, buildings);
    const tiles = container.querySelectorAll(".town-tile");
    expect(tiles.length).toBe(expectedTileCount(openPlotCount(nextPlotIndex, buildings), buildings));
    expect(tiles.length).toBeGreaterThan(renderedTileCount(nextPlotIndex));
    expect(container.querySelector('[data-plot-index="20"]')).not.toBeNull();
  });
});

describe("TownGrid — ADDENDUM-02 §4.4 move-mode DOM contract (AC-M5/AC-M6/AC-M7)", () => {
  const secondBuilding: Building = { ...cafeBuilding, id: "b2", plotIndex: 1 };

  it("AC-M5 — movingId set marks exactly one tile .town-tile--moving, with aria-selected='true'", () => {
    const container = mountGrid(2, [cafeBuilding, secondBuilding], { movingId: cafeBuilding.id });
    const moving = container.querySelectorAll(".town-tile--moving");
    expect(moving.length).toBe(1);
    expect((moving[0] as HTMLElement).dataset.plotIndex).toBe(String(cafeBuilding.plotIndex));
    expect(moving[0].getAttribute("aria-selected")).toBe("true");
    // the other building tile is untouched
    const other = container.querySelector(`[data-plot-index="${secondBuilding.plotIndex}"]`) as HTMLElement;
    expect(other.classList.contains("town-tile--moving")).toBe(false);
  });

  it("AC-M6 — droppable count === free-UNMASKED-lot count (>= 1), no droppable tile holds a building, none on the road/savings row", () => {
    const nextPlotIndex = 2;
    const buildings = [cafeBuilding, secondBuilding];
    const container = mountGrid(nextPlotIndex, buildings, { movingId: cafeBuilding.id });
    const droppable = [...container.querySelectorAll(".town-tile--droppable")] as HTMLElement[];
    // ADDENDUM-07: `pool - buildings.length` counted every unoccupied RAW
    // index, including masked (void, never rendered) ones — `freePlots` is
    // the same masked-aware pool `placement.ts` itself uses (rule R-5).
    const expectedFree = freePlots(nextPlotIndex, buildings).length;

    expect(droppable.length).toBe(expectedFree);
    expect(droppable.length).toBeGreaterThanOrEqual(1); // G2 (§3.2) — always at least one free lot
    for (const tile of droppable) {
      expect(tile.querySelector(".building-tile")).toBeNull(); // no droppable tile holds a building
      expect(tile.style.gridColumn).not.toBe(String(ROAD_COLUMN + 1)); // never the road column
      expect(tile.getAttribute("role")).toBe("button");
    }
  });

  it("AC-M7 — .town-grid's direct-children count is unchanged by move mode (the bar lives outside the grid, in App.tsx)", () => {
    const container = mountGrid(0, [], { movingId: "not-in-buildings" });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    // Trailing `+ 1` = the ADDENDUM-05 NPC layer, present in and out of move mode.
    // ADDENDUM-06 §2/§9 (WP-A): `+ blockCount(0)` = the terrace layer, also present in and out of move mode.
    // ADDENDUM-07: the tile term is `expectedTileCount(...)`, see the fragment-trap test above.
    const expected =
      expectedTileCount(openPlotCount(0, []), []) +
      1 +
      crossStreetRowCount(0) +
      SAVING_CATEGORY_IDS.length +
      freeSavingsCells().length +
      1 +
      blockCount(0);
    expect(grid.children.length).toBe(expected);
  });
});

describe("TownGrid — ADDENDUM-02 §4.3/§8.3 long-press gesture (AC-M8/AC-M9)", () => {
  function pointerDown(tile: HTMLElement, x = 0, y = 0) {
    tile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
  }
  function pointerMove(tile: HTMLElement, x: number, y: number) {
    tile.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
  }
  function pointerUp(tile: HTMLElement) {
    tile.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  }

  it("AC-M8 — a stationary LONG_PRESS_MS pointerdown fires onPlotLongPress exactly once, through the single delegated listener", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid(1, [cafeBuilding], { onPlotLongPress });
      const tile = container.querySelector('[data-plot-index="0"]') as HTMLElement;

      pointerDown(tile);
      vi.advanceTimersByTime(LONG_PRESS_MS - 1);
      expect(onPlotLongPress).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      expect(onPlotLongPress).toHaveBeenCalledWith(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("AC-M8 — a pointermove past the tolerance cancels it (fires zero times)", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid(1, [cafeBuilding], { onPlotLongPress });
      const tile = container.querySelector('[data-plot-index="0"]') as HTMLElement;

      pointerDown(tile);
      pointerMove(tile, LONG_PRESS_TOLERANCE_PX + 5, 0);
      vi.advanceTimersByTime(LONG_PRESS_MS + 50);
      expect(onPlotLongPress).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("AC-M8 — a pointerup at 300ms cancels it (fires zero times even after the full 500ms elapses)", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid(1, [cafeBuilding], { onPlotLongPress });
      const tile = container.querySelector('[data-plot-index="0"]') as HTMLElement;

      pointerDown(tile);
      vi.advanceTimersByTime(300);
      pointerUp(tile);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("AC-M9 — the click immediately following a long-press that GRABBED a building does not reach onPlotTap (B22)", () => {
    vi.useFakeTimers();
    try {
      // `true` — the long-press actually did something (grabbed a building),
      // same as `useMoveMode.onPlotLongPress` returns on a real building.
      const onPlotLongPress = vi.fn(() => true);
      const onPlotTap = vi.fn();
      const container = mountGrid(1, [cafeBuilding], { onPlotLongPress, onPlotTap });
      const tile = container.querySelector('[data-plot-index="0"]') as HTMLElement;

      pointerDown(tile);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      tile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onPlotTap).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // Round-2 finding C2 #1 — the regression this exists to close: a >=500ms
  // press held on an EMPTY (droppable) lot is exactly move mode's commit
  // gesture, not just a faster tap. `onLongPress` there is a documented
  // no-op and returns `false`, so the tail `click` must NOT be swallowed —
  // it must still reach `onPlotTap`, or the commit is silently lost.
  it("AC-M9 regression — a 500ms+ press on an empty/droppable lot still reaches onPlotTap (the long-press itself grabbed nothing)", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn(() => false); // empty lot — useMoveMode's own no-op contract
      const onPlotTap = vi.fn();
      const container = mountGrid(2, [cafeBuilding], { movingId: cafeBuilding.id, onPlotLongPress, onPlotTap });
      // plot 1 is MASKED (block 0, ADDENDUM-07) and unoccupied — void, never
      // rendered — so plot 2 (unmasked, empty) is the droppable lot here.
      const tile = container.querySelector('[data-plot-index="2"]') as HTMLElement; // the empty, droppable lot

      pointerDown(tile);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      tile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onPlotTap).toHaveBeenCalledTimes(1);
      expect(onPlotTap).toHaveBeenCalledWith(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("an ordinary tap (no long-press fired) DOES reach onPlotTap", () => {
    const onPlotTap = vi.fn();
    const container = mountGrid(1, [cafeBuilding], { onPlotTap });
    const tile = container.querySelector('[data-plot-index="0"]') as HTMLElement;

    pointerDown(tile);
    pointerUp(tile);
    tile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPlotTap).toHaveBeenCalledWith(0);
  });
});

describe("TownGrid — ADDENDUM-02 §4.3/§8.3 keyboard / a11y (AC-K1/AC-K2)", () => {
  it("AC-K1 — the whole grid is exactly one tab stop at every town size; no tile ever carries a tabindex", () => {
    for (const n of [0, 12, 600]) {
      const container = mountGrid(n);
      const grid = container.querySelector(".town-grid") as HTMLElement;
      expect(grid.getAttribute("tabindex")).toBe("0");
      expect(container.querySelectorAll(".town-tile[tabindex]").length).toBe(0);
      mounted?.unmount();
      mounted = null;
    }
  });

  it("AC-K2 — the first arrow key sets the cursor (starts null, pointer users never pay for it)", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(1, [cafeBuilding], { onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(0);
  });

  it("AC-K2 — a subsequent arrow key moves the cursor by one adjacent lot in index space", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(20, [], { cursorIndex: 5, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(6);
  });

  it("AC-K2 — ArrowLeft moves the cursor back by one adjacent lot", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(20, [], { cursorIndex: 6, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(5);
  });

  it("AC-K2 — ArrowLeft at the first lot (index 0) does not move the cursor", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(20, [], { cursorIndex: 0, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(onCursorMove).not.toHaveBeenCalled();
  });

  // ArrowUp/ArrowDown go through a distinct code path from ArrowLeft/Right —
  // the serpentine inverse `plotFromIndex` -> `indexFromPlot` in
  // `useTileGestures.ts`'s `stepCursor` — round-2 finding C1 #4: only
  // ArrowRight was ever driven, leaving this the most error-prone,
  // completely unguarded part of the cursor. ADDENDUM-05 §2: at 8 columns
  // index 7 (not 5) sits at the END of row 0 (a left-to-right row); row 1
  // runs right-to-left, so row 1's own index 0 is the lot directly BELOW
  // index 7 on screen — that is `8`.
  it("AC-K2 — ArrowDown crosses a serpentine row reversal correctly (index 7 -> 8)", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(20, [], { cursorIndex: 7, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(8);
  });

  it("AC-K2 — ArrowUp crosses the same serpentine reversal in reverse (index 8 -> 7)", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(20, [], { cursorIndex: 8, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(7);
  });

  it("AC-K2 — ArrowUp at the top row does not move the cursor", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(20, [], { cursorIndex: 2, onCursorMove }); // row 0
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(onCursorMove).not.toHaveBeenCalled();
  });

  it("AC-K2 — ArrowDown at the bottom row (past the last tile) does not move the cursor", () => {
    const onCursorMove = vi.fn();
    // ADDENDUM-05 §2 / ADDENDUM-07: mountGrid(20, []) rounds up to a 32-tile
    // (2-block) pool — rows 0..3, 8 columns each; index 31 sits in the LAST
    // row (row 3), so ArrowDown's `stepCursor(4, col)` computes an index >=
    // tileCount and returns null. (20, not 24, keeps this a 2-block pool
    // under ADDENDUM-07's masking-aware pool growth — see placement.test.ts.)
    const container = mountGrid(20, [], { cursorIndex: 31, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(onCursorMove).not.toHaveBeenCalled();
  });

  it("§4.4 DOM contract — .town-tile--cursor tracks cursorIndex across a re-render, applied imperatively (not via the tiles memo — round-2 finding C4 #7)", () => {
    mounted = mountComponent(
      <TownGrid
        nextPlotIndex={2}
        buildings={[cafeBuilding]}
        justBuiltId={null}
        savingsByCategoryKrw={undefined}
        ladder={BALANCE.savingsTowerSegments}
        ladderOverrides={{}}
        expPerLevel={BALANCE.expPerLevel}
        maxLevel={BALANCE.maxLevel}
        justGrew={null}
        onRiseSettled={() => {}}
        npcCount={0}
        {...NOOP_MOVE_PROPS}
        cursorIndex={0}
      />,
    );
    let cursored = mounted.container.querySelectorAll(".town-tile--cursor");
    expect(cursored.length).toBe(1);
    expect((cursored[0] as HTMLElement).dataset.plotIndex).toBe("0");

    act(() => {
      mounted!.root.render(
        <TownGrid
          nextPlotIndex={2}
          buildings={[cafeBuilding]}
          justBuiltId={null}
          savingsByCategoryKrw={undefined}
          ladder={BALANCE.savingsTowerSegments}
          ladderOverrides={{}}
          expPerLevel={BALANCE.expPerLevel}
          maxLevel={BALANCE.maxLevel}
          justGrew={null}
          onRiseSettled={() => {}}
          npcCount={0}
          {...NOOP_MOVE_PROPS}
          cursorIndex={2}
        />,
      );
    });
    // plot 2, not 1 — ADDENDUM-07 masks plot 1 of block 0 (unoccupied, so it
    // renders no `.town-tile` node at all; the cursor highlight is applied
    // to a real DOM node, so it needs a rendered one to land on).
    cursored = mounted.container.querySelectorAll(".town-tile--cursor");
    expect(cursored.length).toBe(1); // moved, not duplicated
    expect((cursored[0] as HTMLElement).dataset.plotIndex).toBe("2");
  });

  it("AC-K2 — Enter on a building (cursor sitting on it) enters move mode via onPlotLongPress", () => {
    const onPlotLongPress = vi.fn();
    const container = mountGrid(1, [cafeBuilding], { cursorIndex: 0, onPlotLongPress });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onPlotLongPress).toHaveBeenCalledWith(0);
  });

  it("AC-K2 — Enter on a free lot while in move mode commits via onPlotTap", () => {
    const onPlotTap = vi.fn();
    const container = mountGrid(2, [cafeBuilding], { movingId: cafeBuilding.id, cursorIndex: 1, onPlotTap });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onPlotTap).toHaveBeenCalledWith(1);
  });

  it("AC-K2 — Escape cancels move mode via a dedicated onCancel prop (not routed through onPlotTap — round-2 finding C3 #5)", () => {
    const onPlotTap = vi.fn();
    const onCancel = vi.fn();
    const container = mountGrid(2, [cafeBuilding], { movingId: cafeBuilding.id, onPlotTap, onCancel });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPlotTap).not.toHaveBeenCalled();
  });

  it("Escape outside move mode still calls onCancel (harmless — useMoveMode's cancel is idempotent)", () => {
    const onCancel = vi.fn();
    const container = mountGrid(1, [cafeBuilding], { onCancel });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("TownGrid — ADDENDUM-04 §4/§8 (grow: level rendering, pick-mode highlight)", () => {
  it("a level-1 building (no exp) renders with no floors/badge — level 2 (exp=4, expPerLevel=3) shows Lv.2", () => {
    const grownBuilding: Building = { ...cafeBuilding, id: "b-grown", plotIndex: 1, exp: 4 };
    const container = mountGrid(2, [cafeBuilding, grownBuilding]);

    const level1Tile = container.querySelector(`[data-plot-index="${cafeBuilding.plotIndex}"] .building-tile`) as HTMLElement;
    expect(level1Tile.querySelector(".building-level-badge")).toBeNull();

    const level2Tile = container.querySelector(`[data-plot-index="${grownBuilding.plotIndex}"] .building-tile`) as HTMLElement;
    expect(level2Tile.querySelector(".building-level-badge")?.textContent).toBe("Lv.2");
  });

  it("growCandidateIds highlights only the matching building tile with town-tile--grow-candidate, never an empty lot", () => {
    const secondBuilding: Building = { ...cafeBuilding, id: "b2", plotIndex: 1 };
    const container = mountGrid(2, [cafeBuilding, secondBuilding], {}, {}, new Set([cafeBuilding.id]));

    const candidateTile = container.querySelector(`[data-plot-index="${cafeBuilding.plotIndex}"]`) as HTMLElement;
    expect(candidateTile.classList.contains("town-tile--grow-candidate")).toBe(true);

    const otherTile = container.querySelector(`[data-plot-index="${secondBuilding.plotIndex}"]`) as HTMLElement;
    expect(otherTile.classList.contains("town-tile--grow-candidate")).toBe(false);

    for (const tile of container.querySelectorAll(".town-tile")) {
      if ((tile as HTMLElement).querySelector(".building-tile")) continue; // buildings checked above
      expect(tile.classList.contains("town-tile--grow-candidate")).toBe(false);
    }
  });
});

describe("TownGrid — ADDENDUM-05 §2 zoom-to-fit toggle", () => {
  it("defaults to 1:1 (크게 보기 view): no transform on .town-grid, button offers 전체 보기, aria-pressed=false", () => {
    const container = mountGrid(0);
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const button = container.querySelector(".town-zoom-toggle") as HTMLButtonElement;
    expect(grid.style.transform).toBe("");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toBe("전체 보기");
    expect(button.getAttribute("aria-label")).toBeTruthy();
  });

  it(".town-zoom-toggle sits inside .town-viewport as a sibling of .town-grid, never a .town-grid child (AC-M7's guard)", () => {
    const container = mountGrid(0);
    const viewport = container.querySelector(".town-viewport") as HTMLElement;
    const grid = viewport.querySelector(".town-grid") as HTMLElement;
    const button = viewport.querySelector(".town-zoom-toggle") as HTMLElement;
    expect(viewport).not.toBeNull();
    expect(grid.parentElement).toBe(viewport);
    expect(button.parentElement).toBe(viewport);
    expect([...grid.children]).not.toContain(button);
  });

  it("clicking the toggle flips to the zoomed-out view: aria-pressed=true, label flips to 크게 보기, applies a scale() transform to .town-grid", () => {
    const container = mountGrid(0);
    const button = container.querySelector(".town-zoom-toggle") as HTMLButtonElement;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toBe("크게 보기");
    const grid = container.querySelector(".town-grid") as HTMLElement;
    expect(grid.style.transform).toMatch(/^scale\(/);
    expect(grid.style.transformOrigin).toBe("top left");
  });

  it("clicking a second time returns to 1:1 — no transform, wrapper height back to auto", () => {
    const container = mountGrid(0);
    const button = container.querySelector(".town-zoom-toggle") as HTMLButtonElement;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const viewport = container.querySelector(".town-viewport") as HTMLElement;
    expect(grid.style.transform).toBe("");
    expect(viewport.style.height).toBe("");
  });

  // Proves the move gesture (long-press) still works while zoomed out — the
  // exact scenario TownGrid.tsx's header comment reasons about: tap
  // resolution (`element.closest`) and the pointer-tolerance check
  // (raw `clientX`/`clientY` deltas) are both POST-transform, screen-space
  // values, so entering zoom mode must not change whether this fires.
  it("a long-press still fires onPlotLongPress after the zoom toggle is switched on", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid(1, [cafeBuilding], { onPlotLongPress });
      const button = container.querySelector(".town-zoom-toggle") as HTMLButtonElement;
      act(() => {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(button.getAttribute("aria-pressed")).toBe("true"); // zoom is actually active for this test

      const tile = container.querySelector('[data-plot-index="0"]') as HTMLElement;
      tile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      expect(onPlotLongPress).toHaveBeenCalledWith(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
