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
import { openPlotCount } from "../placement";
import { SAVING_CATEGORY_IDS } from "../savingsBuckets";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import {
  GRID_COLUMNS,
  GRID_GAP_PX,
  GRID_PADDING_X_PX,
  GRID_TEMPLATE_COLUMNS,
  PIP_GAP_PX,
  PIP_SIZE_PX,
  ROAD_COLUMN,
  ROAD_WIDTH_PX,
  crossStreetRowCount,
  freeSavingsCells,
  gridRowCount,
  isCrossStreetRow,
  renderedTileCount,
  roadSideOf,
  savingsCellFor,
} from "../townLayout";
import type { Building } from "../types";
import { TownGrid, type TownGridProps } from "./TownGrid";

let mounted: MountedComponent | null = null;

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

  it("exactly one .town-main-street node, and crossStreetRowCount(n) .town-cross-street nodes", () => {
    const container = mountGrid(13);
    expect(container.querySelectorAll(".town-main-street").length).toBe(1);
    expect(container.querySelectorAll(".town-cross-street").length).toBe(crossStreetRowCount(13));
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
    for (const n of [0, 13]) {
      const container = mountGrid(n);
      const street = container.querySelector(".town-main-street") as HTMLElement;
      const raw = street.getAttribute("style") ?? "";
      expect(raw).toMatch(new RegExp(`grid-row:\\s*1\\s*/\\s*span\\s*${gridRowCount(n)}\\b`));
      expect(raw).not.toMatch(/grid-row:\s*1\s*\/\s*-1/);
    }
    expect(gridRowCount(0)).toBe(6);
    expect(gridRowCount(13)).toBe(9);
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

  it("exactly one signpost, at freeSavingsCells()'s cell, never on the road", () => {
    const container = mountGrid(0);
    const signposts = [...container.querySelectorAll(".savings-signpost")] as HTMLElement[];
    expect(signposts.length).toBe(1);
    const free = freeSavingsCells()[0];
    expect(Number(signposts[0].style.gridColumn)).toBe(free.col + 1);
    expect(Number(signposts[0].style.gridRow)).toBe(free.row + 1);
    expect(Number(signposts[0].style.gridColumn)).not.toBe(ROAD_COLUMN + 1);
  });

  it("the fragment trap: .town-grid's direct children count matches the exact formula (§2.4a's guard)", () => {
    const container = mountGrid(0);
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const expected = renderedTileCount(0) + 1 + crossStreetRowCount(0) + SAVING_CATEGORY_IDS.length + 1;
    expect(expected).toBe(22);
    expect(grid.children.length).toBe(expected);
  });

  it("GRID_COLUMNS matches the template's token count (sanity cross-check with townLayout.test.ts)", () => {
    expect(GRID_TEMPLATE_COLUMNS.split(" ").length).toBe(GRID_COLUMNS);
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

  it("renders each building at data-plot-index matching its plotIndex, no lot rendered twice, exactly openPlotCount tiles", () => {
    const buildings = scatteredBuildings([0, 5, 11, 2]);
    const nextPlotIndex = 12;
    const container = mountGrid(nextPlotIndex, buildings);
    const tiles = [...container.querySelectorAll(".town-tile")] as HTMLElement[];

    expect(tiles.length).toBe(openPlotCount(nextPlotIndex, buildings));

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
    // A building at index 14 with nextPlotIndex=1 could not have existed
    // pre-addendum (a sequential cursor never overshoots itself), but a
    // move/import/corrupt-recovery (this task's boot reconciler) can now hand
    // a live building an index anywhere in the open pool — B20's DE-2
    // latent-bug fix (§7.2): the old `renderedTileCount(nextPlotIndex)` would
    // render only 12 tiles here and silently drop this building off-grid.
    const buildings = scatteredBuildings([14]);
    const nextPlotIndex = 1;
    const container = mountGrid(nextPlotIndex, buildings);
    const tiles = container.querySelectorAll(".town-tile");
    expect(tiles.length).toBe(openPlotCount(nextPlotIndex, buildings));
    expect(tiles.length).toBeGreaterThan(renderedTileCount(nextPlotIndex));
    expect(container.querySelector('[data-plot-index="14"]')).not.toBeNull();
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

  it("AC-M6 — droppable count === free-lot count (>= 1), no droppable tile holds a building, none on the road/savings row", () => {
    const nextPlotIndex = 2;
    const buildings = [cafeBuilding, secondBuilding];
    const container = mountGrid(nextPlotIndex, buildings, { movingId: cafeBuilding.id });
    const droppable = [...container.querySelectorAll(".town-tile--droppable")] as HTMLElement[];
    const pool = openPlotCount(nextPlotIndex, buildings);

    expect(droppable.length).toBe(pool - buildings.length);
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
    const expected = renderedTileCount(0) + 1 + crossStreetRowCount(0) + SAVING_CATEGORY_IDS.length + 1;
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
      const tile = container.querySelector('[data-plot-index="1"]') as HTMLElement; // the empty, droppable lot

      pointerDown(tile);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      tile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onPlotTap).toHaveBeenCalledTimes(1);
      expect(onPlotTap).toHaveBeenCalledWith(1);
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
    const container = mountGrid(24, [], { cursorIndex: 5, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(6);
  });

  it("AC-K2 — ArrowLeft moves the cursor back by one adjacent lot", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(24, [], { cursorIndex: 6, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(5);
  });

  it("AC-K2 — ArrowLeft at the first lot (index 0) does not move the cursor", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(24, [], { cursorIndex: 0, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(onCursorMove).not.toHaveBeenCalled();
  });

  // ArrowUp/ArrowDown go through a distinct code path from ArrowLeft/Right —
  // the serpentine inverse `plotFromIndex` -> `indexFromPlot` in
  // `useTileGestures.ts`'s `stepCursor` — round-2 finding C1 #4: only
  // ArrowRight was ever driven, leaving this the most error-prone,
  // completely unguarded part of the cursor. Index 5 sits at the END of row
  // 0 (a left-to-right row); row 1 runs right-to-left, so row 1's own index 0
  // is the lot directly BELOW index 5 on screen — that is `6`, not `11`.
  it("AC-K2 — ArrowDown crosses a serpentine row reversal correctly (index 5 -> 6)", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(24, [], { cursorIndex: 5, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(6);
  });

  it("AC-K2 — ArrowUp crosses the same serpentine reversal in reverse (index 6 -> 5)", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(24, [], { cursorIndex: 6, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(5);
  });

  it("AC-K2 — ArrowUp at the top row does not move the cursor", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid(24, [], { cursorIndex: 2, onCursorMove }); // row 0
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(onCursorMove).not.toHaveBeenCalled();
  });

  it("AC-K2 — ArrowDown at the bottom row (past the last tile) does not move the cursor", () => {
    const onCursorMove = vi.fn();
    // mountGrid(24, []) rounds up to a 36-tile (3-block) pool — rows 0..5,
    // 6 columns each; index 33 sits in the LAST row (row 5), so ArrowDown's
    // `stepCursor(6, col)` computes an index >= tileCount and returns null.
    const container = mountGrid(24, [], { cursorIndex: 33, onCursorMove });
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
          {...NOOP_MOVE_PROPS}
          cursorIndex={1}
        />,
      );
    });
    cursored = mounted.container.querySelectorAll(".town-tile--cursor");
    expect(cursored.length).toBe(1); // moved, not duplicated
    expect((cursored[0] as HTMLElement).dataset.plotIndex).toBe("1");
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
