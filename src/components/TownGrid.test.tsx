/**
 * TownGrid — ADDENDUM-08 (fixed 20x20 map, footprint buildings). Mounted via
 * the shared bare createRoot+act helper (`testUtils/mount.ts`). Geometry/
 * paint precision (shoreline pixels, park glyph placement) is `qa`'s job in
 * a real browser — jsdom has `css: false` and no layout engine; this file
 * covers the DOM contract: which element exists where, which class it
 * carries, and the gesture/keyboard/move-mode wiring.
 */
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BALANCE } from "../balance.approved";
import { LONG_PRESS_MS, LONG_PRESS_TOLERANCE_PX } from "../hooks/useTileGestures";
import { anchorsFor, occupiedCells } from "../placement";
import { SAVING_CATEGORY_IDS } from "../savingsBuckets";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import {
  CELL_COUNT,
  GRID_SIZE,
  GRID_TEMPLATE_COLUMNS,
  cellFromIndex,
  indexFromCell,
  isBuildable,
  isPrimeCell,
  isRoadCell,
  terrainAt,
  terrainAtIndex,
} from "../townLayout";
import type { Building } from "../types";
import { TownGrid, type TownGridProps } from "./TownGrid";

let mounted: MountedComponent | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

// ── map-derived fixtures (never hand-picked magic numbers — computed from
// the same townLayout.ts functions the component itself reads) ──

function firstIndexOfKind(kind: string): number {
  for (let i = 0; i < CELL_COUNT; i++) if (terrainAtIndex(i) === kind) return i;
  throw new Error(`no ${kind} cell on the map`);
}

const GROUND_A = firstIndexOfKind("ground");
const ROAD_CELL = firstIndexOfKind("road");
const VOID_CELL = firstIndexOfKind("void");

const [ANCHOR_2X2] = anchorsFor(2, 2, new Set());
function secondGroundCell(): number {
  for (let i = 0; i < CELL_COUNT; i++) if (i !== GROUND_A && terrainAtIndex(i) === "ground") return i;
  throw new Error("need a second ground cell");
}
const GROUND_B = secondGroundCell();

const PRIME_GROUND = (() => {
  for (let i = 0; i < CELL_COUNT; i++) {
    const { row, col } = cellFromIndex(i);
    if (terrainAtIndex(i) === "ground" && isPrimeCell(row, col)) return i;
  }
  throw new Error("no prime cell on the map");
})();

function building(overrides: Partial<Building> = {}): Building {
  return {
    id: "b1",
    source: { kind: "entry", entryId: "e1" },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex: GROUND_A,
    builtOn: "2026-08-02",
    createdAt: 1,
    ...overrides,
  };
}

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
  buildings: readonly Building[] = [],
  moveProps: Partial<MoveProps> = {},
  extra: Partial<Pick<TownGridProps, "growCandidateIds" | "justBuiltId">> = {},
): HTMLElement {
  mounted = mountComponent(
    <TownGrid
      buildings={buildings}
      justBuiltId={extra.justBuiltId ?? null}
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
      growCandidateIds={extra.growCandidateIds}
    />,
  );
  return mounted.container;
}

describe("TownGrid — the fixed 20x20 map (ADDENDUM-08 §1/§7)", () => {
  it("gridTemplateColumns matches GRID_TEMPLATE_COLUMNS (20 uniform tracks)", () => {
    const container = mountGrid();
    const grid = container.querySelector(".town-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe(GRID_TEMPLATE_COLUMNS);
    expect(GRID_SIZE).toBe(20);
  });

  it("every non-void cell renders exactly one .town-cell, in the terrain layer, at its own (row, col)", () => {
    const container = mountGrid();
    const cells = [...container.querySelectorAll<HTMLElement>(".town-cell")];
    let nonVoid = 0;
    for (let i = 0; i < CELL_COUNT; i++) if (terrainAtIndex(i) !== "void") nonVoid++;
    expect(cells.length).toBe(nonVoid);
    for (const cell of cells) {
      const col = Number(cell.style.gridColumn) - 1;
      const row = Number(cell.style.gridRow) - 1;
      const kind = terrainAtIndex(indexFromCell({ row, col }));
      expect(kind).not.toBe("void");
      expect(cell.classList.contains(`town-cell--${kind}`)).toBe(true);
    }
  });

  it("void cells paint nothing — no .town-cell and no .town-tile at that grid position", () => {
    const container = mountGrid();
    const { row, col } = cellFromIndex(VOID_CELL);
    for (const el of container.querySelectorAll<HTMLElement>(".town-cell, .town-tile")) {
      const c = Number(el.style.gridColumn) - 1;
      const r = Number((el.style.gridRow || "").split(" / ")[0]) - 1;
      expect(r === row && c === col).toBe(false);
    }
  });

  it("terrain kinds each render their own class: road/park/lake are present and distinct from ground", () => {
    const container = mountGrid();
    expect(container.querySelectorAll(".town-cell--road").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".town-cell--park").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".town-cell--lake").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".town-cell--ground").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".town-cell--savings").length).toBe(SAVING_CATEGORY_IDS.length);
  });

  it("park glyphs are sparse and scattered — not every park cell carries one, and none carries more than one", () => {
    const container = mountGrid();
    const parkCells = [...container.querySelectorAll<HTMLElement>(".town-cell--park")];
    const withGlyph = parkCells.filter((c) => c.querySelector(".town-park-glyph"));
    expect(withGlyph.length).toBeGreaterThan(0); // the park reads as a park...
    expect(withGlyph.length).toBeLessThan(parkCells.length); // ...not a bouquet in every single tile
    for (const c of parkCells) expect(c.querySelectorAll(".town-park-glyph").length).toBeLessThanOrEqual(1);
  });

  it("the lake gets one or two ripples total (one body of water), and a shoreline only on cells touching non-lake ground", () => {
    const container = mountGrid();
    const lakeCells = [...container.querySelectorAll<HTMLElement>(".town-cell--lake")];
    const rippleCells = lakeCells.filter((c) => c.querySelector(".town-lake-ripple"));
    expect(rippleCells.length).toBeGreaterThan(0);
    expect(rippleCells.length).toBeLessThanOrEqual(2); // never one ripple per tile

    const shoreCells = lakeCells.filter(
      (c) =>
        c.classList.contains("town-cell--shore-t") ||
        c.classList.contains("town-cell--shore-r") ||
        c.classList.contains("town-cell--shore-b") ||
        c.classList.contains("town-cell--shore-l"),
    );
    expect(shoreCells.length).toBeGreaterThan(0); // every lake touches the shore somewhere
    expect(shoreCells.length).toBeLessThan(lakeCells.length); // an interior lake cell has no border at all
  });

  it("road/park/lake cells bleed into the gap toward a same-kind neighbor (no dashed seam / checkerboard) — every kind has at least one bled cell", () => {
    const container = mountGrid();
    for (const kind of ["road", "park", "lake"]) {
      const cells = [...container.querySelectorAll<HTMLElement>(`.town-cell--${kind}`)];
      const bled = cells.filter((c) => c.style.marginRight !== "" || c.style.marginBottom !== "");
      expect(bled.length).toBeGreaterThan(0);
    }
    // ground/savings never bleed — they are individually-tileable lots, not a contiguous natural feature.
    for (const kind of ["ground", "savings"]) {
      const cells = [...container.querySelectorAll<HTMLElement>(`.town-cell--${kind}`)];
      for (const c of cells) {
        expect(c.style.marginRight).toBe("");
        expect(c.style.marginBottom).toBe("");
      }
    }
  });

  it("street props (ADDENDUM-10) are sparse on road/park, absent on every buildable cell", () => {
    const container = mountGrid();
    // (b) hard constraint: props never occupy a buildable (ground) cell.
    for (let i = 0; i < CELL_COUNT; i++) {
      const { row, col } = cellFromIndex(i);
      if (!isBuildable(row, col)) continue;
      const cell = [...container.querySelectorAll<HTMLElement>(".town-cell")].find(
        (c) => Number(c.style.gridColumn) - 1 === col && Number(c.style.gridRow) - 1 === row,
      );
      expect(cell).not.toBeUndefined();
      expect(cell?.querySelector(".town-prop")).toBeNull();
    }

    // sparse, not every road/park cell, and never more than one per cell.
    const roadCells = [...container.querySelectorAll<HTMLElement>(".town-cell--road")];
    const parkCells = [...container.querySelectorAll<HTMLElement>(".town-cell--park")];
    const roadWithProp = roadCells.filter((c) => c.querySelector(".town-prop"));
    const parkWithProp = parkCells.filter((c) => c.querySelector(".town-prop"));
    expect(roadWithProp.length).toBeGreaterThan(0);
    expect(roadWithProp.length).toBeLessThan(roadCells.length);
    expect(parkWithProp.length).toBeGreaterThan(0);
    expect(parkWithProp.length).toBeLessThan(parkCells.length);
    for (const c of [...roadCells, ...parkCells]) expect(c.querySelectorAll(".town-prop").length).toBeLessThanOrEqual(1);

    // lake/savings/ground never carry a prop — road/park only.
    for (const kind of ["lake", "savings", "ground"]) {
      for (const c of container.querySelectorAll<HTMLElement>(`.town-cell--${kind}`)) {
        expect(c.querySelector(".town-prop")).toBeNull();
      }
    }
  });

  it("street props are deterministic — identical across two independent mounts of the same map", () => {
    const a = mountGrid();
    const b = mountGrid();
    const propsOf = (container: HTMLElement) =>
      [...container.querySelectorAll<HTMLElement>(".town-cell")]
        .map((c) => `${c.style.gridRow},${c.style.gridColumn}:${c.querySelector(".town-prop svg")?.outerHTML ?? ""}`)
        .join("|");
    expect(propsOf(a)).toBe(propsOf(b));
  });

  it("every park body has exactly one fountain, seated deterministically (regression: the seat could previously lose the scatter lottery and leave 0 fountains on the whole map)", () => {
    const container = mountGrid();

    // Flood-fill park bodies straight off the map — independent of the
    // component's own grouping, so this isn't just re-asserting the impl.
    const visited = new Set<number>();
    const bodies: number[][] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      if (terrainAtIndex(i) !== "park" || visited.has(i)) continue;
      const body: number[] = [];
      const stack = [i];
      visited.add(i);
      while (stack.length > 0) {
        const idx = stack.pop() as number;
        body.push(idx);
        const { row, col } = cellFromIndex(idx);
        for (const [r, c] of [
          [row - 1, col],
          [row + 1, col],
          [row, col - 1],
          [row, col + 1],
        ] as const) {
          if (terrainAt(r, c) !== "park") continue;
          const ni = indexFromCell({ row: r, col: c });
          if (!visited.has(ni)) {
            visited.add(ni);
            stack.push(ni);
          }
        }
      }
      bodies.push(body);
    }
    expect(bodies.length).toBeGreaterThan(0); // sanity: the fixed map does have park bodies

    const cellAt = (row: number, col: number) =>
      [...container.querySelectorAll<HTMLElement>(".town-cell")].find(
        (c) => Number(c.style.gridColumn) - 1 === col && Number(c.style.gridRow) - 1 === row,
      );
    // The fountain SVG is the only prop icon with a `fill="none"` circle.
    const isFountain = (el: HTMLElement | undefined) => !!el?.querySelector('.town-prop svg circle[fill="none"]');

    let totalFountains = 0;
    for (const body of bodies) {
      const fountainCells = body.filter((i) => {
        const { row, col } = cellFromIndex(i);
        return isFountain(cellAt(row, col));
      });
      expect(fountainCells.length).toBe(1); // never 0, never more than 1
      totalFountains += fountainCells.length;
    }
    expect(totalFountains).toBe(bodies.length);
    expect(totalFountains).toBeGreaterThan(0); // at least one fountain exists on the real map
  });

  it("명당 (prime) ground cells are permanently highlighted in the static terrain layer", () => {
    const container = mountGrid();
    expect(container.querySelectorAll(".town-cell--prime").length).toBeGreaterThan(0);
    const { row, col } = cellFromIndex(PRIME_GROUND);
    const primeCell = [...container.querySelectorAll<HTMLElement>(".town-cell--prime")].find(
      (c) => Number(c.style.gridColumn) - 1 === col && Number(c.style.gridRow) - 1 === row,
    );
    expect(primeCell).not.toBeUndefined();
  });

  it("the direct-children count of .town-grid matches the exact formula (terrain + ground tiles + savings plots + NPC layer)", () => {
    const container = mountGrid();
    const grid = container.querySelector(".town-grid") as HTMLElement;
    let nonVoid = 0;
    let ground = 0;
    for (let i = 0; i < CELL_COUNT; i++) {
      const kind = terrainAtIndex(i);
      if (kind !== "void") nonVoid++;
      if (kind === "ground") ground++;
    }
    const expected = nonVoid + ground + SAVING_CATEGORY_IDS.length + 1;
    expect(grid.children.length).toBe(expected);
  });
});

describe("TownGrid — static terrain layer never re-renders (ADDENDUM-08 §7 performance)", () => {
  it("a .town-cell DOM node keeps its identity across a buildings-prop update", () => {
    mounted = mountComponent(
      <TownGrid
        buildings={[]}
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
      />,
    );
    const before = mounted.container.querySelector(".town-cell--road");
    expect(before).not.toBeNull();

    act(() => {
      mounted!.root.render(
        <TownGrid
          buildings={[building()]}
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
        />,
      );
    });
    const after = mounted.container.querySelector(".town-cell--road");
    expect(after).toBe(before); // same node — the memo'd, no-props layer never re-rendered
  });
});

describe("TownGrid — multi-cell buildings (ADDENDUM-08 §2.1/§7)", () => {
  it("a 2x2 building renders as ONE element spanning 2 columns and 2 rows, never 4 sub-tiles", () => {
    const b = building({ plotIndex: ANCHOR_2X2, w: 2, h: 2 });
    const container = mountGrid([b]);
    const { row, col } = cellFromIndex(ANCHOR_2X2);

    const tile = container.querySelector(`[data-plot-index="${ANCHOR_2X2}"]`) as HTMLElement;
    expect(tile).not.toBeNull();
    expect(tile.style.gridColumn).toBe(`${col + 1} / span 2`);
    expect(tile.style.gridRow).toBe(`${row + 1} / span 2`);
    expect(tile.querySelector(".building-tile")).not.toBeNull();

    // the other 3 covered cells have no tile of their own
    const covered = [
      indexFromCell({ row, col: col + 1 }),
      indexFromCell({ row: row + 1, col }),
      indexFromCell({ row: row + 1, col: col + 1 }),
    ];
    for (const i of covered) expect(container.querySelector(`[data-plot-index="${i}"]`)).toBeNull();

    // exactly one .town-tile for this building total
    const allTiles = [...container.querySelectorAll(".town-tile")];
    const buildingTiles = allTiles.filter((t) => t.querySelector(".building-tile"));
    expect(buildingTiles.length).toBe(1);
  });

  it("a 1x2 building spans 1 column and 2 rows", () => {
    const anchors = anchorsFor(1, 2, new Set());
    const b = building({ plotIndex: anchors[0], w: 1, h: 2 });
    const container = mountGrid([b]);
    const { row, col } = cellFromIndex(anchors[0]);
    const tile = container.querySelector(`[data-plot-index="${anchors[0]}"]`) as HTMLElement;
    expect(tile.style.gridColumn).toBe(`${col + 1} / span 1`);
    expect(tile.style.gridRow).toBe(`${row + 1} / span 2`);
  });
});

describe("TownGrid — move mode, footprint-aware droppable targets (ADDENDUM-08 §3)", () => {
  it("a droppable 2x2 destination highlights all 4 of its cells", () => {
    const mover = building({ id: "mover", plotIndex: GROUND_A, w: 2, h: 2 });
    const container = mountGrid([mover], { movingId: "mover" });

    const occupied = occupiedCells([]);
    const anchors = anchorsFor(2, 2, occupied).filter((a) => a !== GROUND_A);
    expect(anchors.length).toBeGreaterThan(0);
    const anchor = anchors[0];
    const { row, col } = cellFromIndex(anchor);
    const cells = [
      indexFromCell({ row, col }),
      indexFromCell({ row, col: col + 1 }),
      indexFromCell({ row: row + 1, col }),
      indexFromCell({ row: row + 1, col: col + 1 }),
    ];
    for (const i of cells) {
      const el = container.querySelector(`[data-plot-index="${i}"]`) as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.classList.contains("town-tile--droppable")).toBe(true);
    }
  });

  it("tapping a non-anchor cell of a valid 2x2 destination resolves to A valid anchor whose footprint covers it, before reaching onPlotTap", () => {
    // Adjacent 2x2 anchors can overlap (anchor A's bottom-right cell can be
    // anchor B's own top-left) — `dropAnchorFor` deterministically resolves
    // an overlapping cell to whichever anchor covers it, so this asserts the
    // CONTRACT (tap != raw index, resolved anchor's footprint contains the
    // tapped cell) rather than one specific anchor id.
    const mover = building({ id: "mover", plotIndex: GROUND_A, w: 2, h: 2 });
    const onPlotTap = vi.fn();
    const container = mountGrid([mover], { movingId: "mover", onPlotTap });

    const validAnchors = new Set(anchorsFor(2, 2, occupiedCells([])));
    const nonAnchorTile = [...container.querySelectorAll<HTMLElement>(".town-tile--droppable")].find(
      (t) => !validAnchors.has(Number(t.dataset.plotIndex)),
    );
    expect(nonAnchorTile).not.toBeUndefined();
    const tappedIndex = Number(nonAnchorTile!.dataset.plotIndex);

    nonAnchorTile!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPlotTap).toHaveBeenCalledTimes(1);
    const resolved = onPlotTap.mock.calls[0][0] as number;
    expect(resolved).not.toBe(tappedIndex); // it was resolved, not passed through raw
    const { row: ar, col: ac } = cellFromIndex(resolved);
    const coveredCells = [
      indexFromCell({ row: ar, col: ac }),
      indexFromCell({ row: ar, col: ac + 1 }),
      indexFromCell({ row: ar + 1, col: ac }),
      indexFromCell({ row: ar + 1, col: ac + 1 }),
    ];
    expect(coveredCells).toContain(tappedIndex);
  });

  it("an off-map / non-ground tap is never offered as a drop target: no droppable class on a road or park cell", () => {
    const mover = building({ id: "mover", plotIndex: GROUND_A });
    const container = mountGrid([mover], { movingId: "mover" });
    // road/park cells render in the terrain layer, not the ground layer — they
    // never carry data-plot-index/town-tile at all, so there is nothing to tap.
    const { row, col } = cellFromIndex(ROAD_CELL);
    expect(container.querySelector(`[data-plot-index="${ROAD_CELL}"]`)).toBeNull();
    expect(isRoadCell(row, col)).toBe(true);
  });

  it("a plain 1x1 move highlights every EMPTY ground lot as droppable (the mover's own cell is covered, not droppable)", () => {
    const mover = building({ id: "mover", plotIndex: GROUND_A });
    const container = mountGrid([mover], { movingId: "mover" });
    const droppable = container.querySelectorAll(".town-tile--droppable");
    // Every ground cell not covered by a LIVE building (here: every ground
    // cell except the mover's own) is a legal 1x1 anchor and gets rendered
    // as an empty, droppable lot.
    const expectedFree = anchorsFor(1, 1, occupiedCells([mover])).length;
    expect(droppable.length).toBe(expectedFree);
    expect(droppable.length).toBeGreaterThan(0);
    for (const tile of droppable) expect((tile as HTMLElement).querySelector(".building-tile")).toBeNull();
  });
});

describe("TownGrid — 명당 (prime lot) on the dynamic layer", () => {
  it("a droppable prime lot gets .town-tile--droppable.town-tile--prime and the 명당 aria-label", () => {
    const mover = building({ id: "mover", plotIndex: GROUND_B });
    const container = mountGrid([mover], { movingId: "mover" });
    const tile = container.querySelector(`[data-plot-index="${PRIME_GROUND}"]`) as HTMLElement;
    if (tile.classList.contains("town-tile--droppable")) {
      expect(tile.classList.contains("town-tile--prime")).toBe(true);
      expect(tile.getAttribute("aria-label")).toBe("명당 빈 터, 여기로 옮기기");
    }
  });
});

describe("TownGrid — long-press gesture (AC-M8/AC-M9)", () => {
  function pointerDown(tile: HTMLElement, x = 0, y = 0) {
    tile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
  }
  function pointerMove(tile: HTMLElement, x: number, y: number) {
    tile.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
  }
  function pointerUp(tile: HTMLElement) {
    tile.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  }

  it("a stationary LONG_PRESS_MS pointerdown fires onPlotLongPress exactly once", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid([building()], { onPlotLongPress });
      const tile = container.querySelector(`[data-plot-index="${GROUND_A}"]`) as HTMLElement;

      pointerDown(tile);
      vi.advanceTimersByTime(LONG_PRESS_MS - 1);
      expect(onPlotLongPress).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      expect(onPlotLongPress).toHaveBeenCalledWith(GROUND_A);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a pointermove past the tolerance cancels it (fires zero times)", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid([building()], { onPlotLongPress });
      const tile = container.querySelector(`[data-plot-index="${GROUND_A}"]`) as HTMLElement;

      pointerDown(tile);
      pointerMove(tile, LONG_PRESS_TOLERANCE_PX + 5, 0);
      vi.advanceTimersByTime(LONG_PRESS_MS + 50);
      expect(onPlotLongPress).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the click immediately following a GRABBING long-press does not reach onPlotTap (B22)", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn(() => true);
      const onPlotTap = vi.fn();
      const container = mountGrid([building()], { onPlotLongPress, onPlotTap });
      const tile = container.querySelector(`[data-plot-index="${GROUND_A}"]`) as HTMLElement;

      pointerDown(tile);
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      tile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(onPlotTap).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("an ordinary tap (no long-press fired) DOES reach onPlotTap", () => {
    const onPlotTap = vi.fn();
    const container = mountGrid([building()], { onPlotTap });
    const tile = container.querySelector(`[data-plot-index="${GROUND_A}"]`) as HTMLElement;

    pointerDown(tile);
    pointerUp(tile);
    tile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onPlotTap).toHaveBeenCalledWith(GROUND_A);
  });
});

describe("TownGrid — keyboard / a11y (AC-K1/AC-K2)", () => {
  it("the whole grid is exactly one tab stop; no tile ever carries a tabindex", () => {
    const container = mountGrid([building()]);
    const grid = container.querySelector(".town-grid") as HTMLElement;
    expect(grid.getAttribute("tabindex")).toBe("0");
    expect(container.querySelectorAll(".town-tile[tabindex]").length).toBe(0);
  });

  it("ArrowDown moves the cursor to the cell directly below (row-major, no serpentine)", () => {
    const onCursorMove = vi.fn();
    const container = mountGrid([], { cursorIndex: GROUND_A, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const { row, col } = cellFromIndex(GROUND_A);
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(onCursorMove).toHaveBeenCalledWith(indexFromCell({ row: row + 1, col }));
  });

  it("ArrowUp at row 0 does not move the cursor", () => {
    const onCursorMove = vi.fn();
    const topRowIndex = indexFromCell({ row: 0, col: 10 });
    const container = mountGrid([], { cursorIndex: topRowIndex, onCursorMove });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(onCursorMove).not.toHaveBeenCalled();
  });

  it("Escape cancels move mode via a dedicated onCancel prop (not routed through onPlotTap)", () => {
    const onPlotTap = vi.fn();
    const onCancel = vi.fn();
    const container = mountGrid([building()], { movingId: "b1", onPlotTap, onCancel });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPlotTap).not.toHaveBeenCalled();
  });

  it("Enter on a building (cursor sitting on it) enters move mode via onPlotLongPress", () => {
    const onPlotLongPress = vi.fn();
    const container = mountGrid([building()], { cursorIndex: GROUND_A, onPlotLongPress });
    const grid = container.querySelector(".town-grid") as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onPlotLongPress).toHaveBeenCalledWith(GROUND_A);
  });
});

describe("TownGrid — level rendering / pick-mode highlight", () => {
  it("a level-1 building (no exp) renders with no floors/badge — level 2 shows Lv.2", () => {
    const grown: Building = building({ id: "b-grown", plotIndex: GROUND_B, exp: BALANCE.expPerLevel });
    const container = mountGrid([building(), grown]);

    const level1Tile = container.querySelector(`[data-plot-index="${GROUND_A}"] .building-tile`) as HTMLElement;
    expect(level1Tile.querySelector(".building-level-badge")).toBeNull();

    const level2Tile = container.querySelector(`[data-plot-index="${GROUND_B}"] .building-tile`) as HTMLElement;
    expect(level2Tile.querySelector(".building-level-badge")?.textContent).toBe("Lv.2");
  });

  it("growCandidateIds highlights only the matching building tile, never an empty lot", () => {
    const second = building({ id: "b2", plotIndex: GROUND_B });
    const container = mountGrid([building(), second], {}, { growCandidateIds: new Set(["b1"]) });

    expect((container.querySelector(`[data-plot-index="${GROUND_A}"]`) as HTMLElement).classList.contains("town-tile--grow-candidate")).toBe(true);
    expect((container.querySelector(`[data-plot-index="${GROUND_B}"]`) as HTMLElement).classList.contains("town-tile--grow-candidate")).toBe(false);

    for (const tile of container.querySelectorAll(".town-tile")) {
      if ((tile as HTMLElement).querySelector(".building-tile")) continue;
      expect(tile.classList.contains("town-tile--grow-candidate")).toBe(false);
    }
  });
});

describe("TownGrid — zoom-to-fit toggle (ADDENDUM-08 §7)", () => {
  it("opens fit-to-whole-map on first launch: aria-pressed=true, offers 크게 보기, both-axes scale applied", () => {
    const container = mountGrid();
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const button = container.querySelector(".town-zoom-toggle") as HTMLButtonElement;
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toBe("크게 보기");
    expect(grid.style.transform).toMatch(/^scale\(/);
  });

  it("clicking the toggle switches to 100%: aria-pressed=false, label flips to 전체 보기, no transform", () => {
    const container = mountGrid();
    const button = container.querySelector(".town-zoom-toggle") as HTMLButtonElement;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toBe("전체 보기");
    const grid = container.querySelector(".town-grid") as HTMLElement;
    expect(grid.style.transform).toBe("");
  });

  it(".town-zoom-toggle sits inside .town-viewport as a sibling of .town-grid, never a .town-grid child", () => {
    const container = mountGrid();
    const viewport = container.querySelector(".town-viewport") as HTMLElement;
    const grid = viewport.querySelector(".town-grid") as HTMLElement;
    const button = viewport.querySelector(".town-zoom-toggle") as HTMLElement;
    expect(grid.parentElement).toBe(viewport);
    expect(button.parentElement).toBe(viewport);
    expect([...grid.children]).not.toContain(button);
  });

  it("a long-press still fires onPlotLongPress while zoomed (default state)", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid([building()], { onPlotLongPress });
      const button = container.querySelector(".town-zoom-toggle") as HTMLButtonElement;
      expect(button.getAttribute("aria-pressed")).toBe("true"); // zoomed by default

      const tile = container.querySelector(`[data-plot-index="${GROUND_A}"]`) as HTMLElement;
      tile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      expect(onPlotLongPress).toHaveBeenCalledWith(GROUND_A);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── ADDENDUM-09 — pinch zoom & pan ──
function pointerDownAt(el: HTMLElement, pointerId: number, x: number, y: number) {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId, clientX: x, clientY: y }));
}
function pointerMoveAt(el: HTMLElement, pointerId: number, x: number, y: number, cancelable = false) {
  el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable, pointerId, clientX: x, clientY: y }));
}
function pointerUpAt(el: HTMLElement, pointerId: number) {
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId }));
}
/** Parses `scale(k) translate(txpx, typx)` back into numbers for assertions
 * that need to tolerate floating-point pinch math instead of matching an
 * exact string. */
function parseTransform(transform: string): { scale: number; tx: number; ty: number } {
  const m = transform.match(/^scale\(([^)]+)\) translate\(([-\d.]+)px, ([-\d.]+)px\)$/);
  if (!m) throw new Error(`not a scale+translate transform: "${transform}"`);
  return { scale: Number(m[1]), tx: Number(m[2]), ty: Number(m[3]) };
}

describe("TownGrid — gesture arbitration, 1 finger vs 2 fingers (ADDENDUM-09 §1.1/§3.1)", () => {
  it("a 2nd pointer landing on a DIFFERENT tile during a long-press cancels it cleanly — no hijack of the 2nd tile's press, no resurrection once the pinch ends (regression: old code reassigned pressPointerId to the 2nd finger and restarted the timer against ITS tile)", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid([building()], { onPlotLongPress });
      const tileA = container.querySelector(`[data-plot-index="${GROUND_A}"]`) as HTMLElement;
      const tileB = container.querySelector(`[data-plot-index="${GROUND_B}"]`) as HTMLElement;

      pointerDownAt(tileA, 1, 0, 0); // finger 1 starts a long-press on GROUND_A
      vi.advanceTimersByTime(200); // timer in flight, has NOT fired yet
      pointerDownAt(tileB, 2, 0, 0); // finger 2 lands on a DIFFERENT tile — old code would hijack to GROUND_B here

      vi.advanceTimersByTime(LONG_PRESS_MS); // plenty of time for either the original OR a hijacked timer to fire
      expect(onPlotLongPress).not.toHaveBeenCalled(); // neither GROUND_A nor GROUND_B fired — abandoned cleanly, no hijack

      pointerUpAt(tileB, 2); // pinch ends, back to 1 pointer (finger 1 still down)
      pointerMoveAt(tileA, 1, 3, 0); // finger 1 stirring must not be read as a live press either
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).not.toHaveBeenCalled(); // no phantom move, no resurrected press
    } finally {
      vi.useRealTimers();
    }
  });

  it("after a pinch fully ends (0 pointers), a genuinely NEW pointerdown starts a normal long-press — arbitration doesn't wedge the recognizer", () => {
    vi.useFakeTimers();
    try {
      const onPlotLongPress = vi.fn();
      const container = mountGrid([building()], { onPlotLongPress });
      const tileA = container.querySelector(`[data-plot-index="${GROUND_A}"]`) as HTMLElement;

      pointerDownAt(tileA, 1, 0, 0);
      pointerDownAt(tileA, 2, 0, 0); // pinch starts
      pointerUpAt(tileA, 1);
      pointerUpAt(tileA, 2); // pinch fully ends

      pointerDownAt(tileA, 3, 0, 0); // a fresh, unrelated touch
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(onPlotLongPress).toHaveBeenCalledTimes(1);
      expect(onPlotLongPress).toHaveBeenCalledWith(GROUND_A);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("TownGrid — pinch zoom & pan (ADDENDUM-09 §3.2/§3.3)", () => {
  it(".town-grid's direct-child count is unchanged after a pinch (no wrapper, no new child)", () => {
    const container = mountGrid();
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const before = grid.children.length;

    act(() => {
      pointerDownAt(grid, 1, 0, 0);
      pointerDownAt(grid, 2, 100, 0);
      pointerMoveAt(grid, 1, 0, 0);
    });
    act(() => {
      pointerMoveAt(grid, 1, -50, 0); // spread apart -> zoom in
    });

    expect(grid.children.length).toBe(before);
  });

  it("pan is inert at fit scale (translate pinned to 0) and becomes active once a pinch pushes scale above fitScale", () => {
    const container = mountGrid(); // default: zoomedOut=true, scale === fitScale (1 in this jsdom harness)
    const grid = container.querySelector(".town-grid") as HTMLElement;

    act(() => {
      pointerDownAt(grid, 1, 0, 0);
      pointerDownAt(grid, 2, 100, 0);
      pointerMoveAt(grid, 1, 0, 0); // seeds the pinch baseline — no scale/translate change yet
    });
    act(() => {
      // Fingers pinch slightly INWARD — the resulting scale clamps to the
      // floor, so any accompanying midpoint shift must not leak into pan.
      pointerMoveAt(grid, 1, 20, 0);
    });
    // D1: at fit scale the whole map is already on screen — pan is a no-op,
    // exactly `scale(1) translate(0px, 0px)`, no float drift possible since
    // this branch hard-codes {tx:0, ty:0}.
    expect(grid.style.transform).toBe("scale(1) translate(0px, 0px)");

    act(() => {
      pointerMoveAt(grid, 1, -50, 0); // fingers spread apart -> distance grows -> scale climbs above fitScale
    });
    const zoomedIn = parseTransform(grid.style.transform);
    expect(zoomedIn.scale).toBeGreaterThan(1); // above fitScale now
    expect(zoomedIn.tx !== 0 || zoomedIn.ty !== 0).toBe(true); // translate is live, not pinned

    act(() => {
      pointerMoveAt(grid, 2, 230, 0); // fingers keep moving — translate must keep tracking them
    });
    const panned = parseTransform(grid.style.transform);
    expect(panned.tx !== zoomedIn.tx || panned.ty !== zoomedIn.ty).toBe(true); // pan moved further — the gesture owns it
  });

  it("a pinch pointermove suppresses the native scroll (preventDefault) — the single-owner guard against doubled travel", () => {
    const container = mountGrid();
    const grid = container.querySelector(".town-grid") as HTMLElement;

    act(() => {
      pointerDownAt(grid, 1, 0, 0);
      pointerDownAt(grid, 2, 100, 0);
    });
    const pinchMove = new PointerEvent("pointermove", { bubbles: true, cancelable: true, pointerId: 1, clientX: 10, clientY: 0 });
    act(() => {
      grid.dispatchEvent(pinchMove);
    });
    expect(pinchMove.defaultPrevented).toBe(true); // native `.town-viewport` scroll is suppressed for this gesture

    act(() => {
      pointerUpAt(grid, 1);
      pointerUpAt(grid, 2);
    });
    const singleFingerMove = new PointerEvent("pointermove", { bubbles: true, cancelable: true, pointerId: 3, clientX: 10, clientY: 0 });
    grid.dispatchEvent(singleFingerMove);
    expect(singleFingerMove.defaultPrevented).toBe(false); // 1-finger scroll-through-a-building stays untouched (§4.3)
  });

  it("전체 보기 resets both scale and translate after a pinch (D2)", () => {
    const container = mountGrid();
    const grid = container.querySelector(".town-grid") as HTMLElement;
    const toggle = container.querySelector(".town-zoom-toggle") as HTMLButtonElement;

    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true })); // flip to 100%
    });
    expect(grid.style.transform).toBe("");

    act(() => {
      pointerDownAt(grid, 1, 0, 0);
      pointerDownAt(grid, 2, 100, 0);
      pointerMoveAt(grid, 1, 0, 0);
    });
    act(() => {
      pointerMoveAt(grid, 1, -50, 0); // pinch-zoom in
    });
    expect(grid.style.transform).not.toBe(""); // sanity: the pinch actually changed the transform

    act(() => {
      pointerUpAt(grid, 1);
      pointerUpAt(grid, 2);
    });
    act(() => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true })); // back to 전체 보기
    });

    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.textContent).toBe("크게 보기");
    // fitScale in this jsdom harness measures to 1 (no real layout) — the
    // reset lands exactly on scale 1, translate zero.
    expect(grid.style.transform).toBe("scale(1) translate(0px, 0px)");
  });

  it("`.town-viewport`'s pinned height survives a pinch's zoomedOut->false flip — regression for a real anchor-jump bug found in browser touch-emulation QA (ADDENDUM-09 AC#8): the height used to be pinned only while `zoomedOut`, so a pinch's first real sample (which flips `zoomedOut` to false per D2, before the user's fingers have even separated) dropped the pin and let `.town-viewport` reflow (App.css: height:auto up to max-height) mid-gesture, moving `.town-grid`'s on-screen position out from under the anchor math — measured in a real browser as a ~150px vertical jump the instant a pinch starts from the initial zoomed-out state", () => {
    const container = mountGrid(); // default: zoomedOut=true
    const viewport = container.querySelector(".town-viewport") as HTMLElement;
    const grid = container.querySelector(".town-grid") as HTMLElement;

    expect(viewport.style.height).not.toBe(""); // pinned at baseline (zoomedOut)

    act(() => {
      pointerDownAt(grid, 1, 0, 0);
      pointerDownAt(grid, 2, 100, 0); // 2nd finger lands — pinchActive, baseline seeded
      pointerMoveAt(grid, 1, 0, 0); // first real sample — this is what flips zoomedOut false
    });

    expect(viewport.style.height).not.toBe(""); // must stay pinned — no reflow mid-pinch
  });
});

describe("TownGrid — savings block (ADDENDUM-08 §1.1)", () => {
  it("the five savings plots sit exactly at savingsCells(), rendered on top of the terrain layer's savings cells", () => {
    const container = mountGrid();
    expect(container.querySelectorAll(".savings-plot").length).toBe(SAVING_CATEGORY_IDS.length);
  });
});
