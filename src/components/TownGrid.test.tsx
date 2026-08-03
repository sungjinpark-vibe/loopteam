/**
 * The repo's first COMPONENT test (ADDENDUM-01 §6/§2.9) — mounted via the
 * shared bare createRoot+act helper (`testUtils/mount.ts`), the same
 * discipline the existing hook harnesses already use (no
 * `@testing-library/react`). Covers every `[dom]` AC from ADDENDUM-01 §3.8
 * this task's rendering can prove; geometry/paint (crosswalk position, roof
 * lean) is `qa`'s job in a real browser — jsdom has `css: false` and no
 * layout engine (ADDENDUM-01 §2.9).
 */
import { afterEach, describe, expect, it } from "vitest";
import { BALANCE } from "../balance.placeholder";
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
import { TownGrid } from "./TownGrid";

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

function mountGrid(nextPlotIndex: number, buildings: readonly Building[] = []): HTMLElement {
  mounted = mountComponent(
    <TownGrid nextPlotIndex={nextPlotIndex} buildings={buildings} justBuiltId={null} ladder={BALANCE.savingsTowerSegments} />,
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
