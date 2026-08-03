/**
 * `SavingsRow` in isolation, mounted directly rather than through `TownGrid`
 * — the seam the 저축 블록 task extends (round-1 finding C3). Placement/
 * fragment-emission is already covered end-to-end via `TownGrid.test.tsx`;
 * this file only guards that `SavingsRow` itself mounts as a bare fragment
 * with no wrapping element (§2.4a's trap).
 */
import { afterEach, describe, expect, it } from "vitest";
import { SAVING_CATEGORY_IDS } from "../savingsBuckets";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { freeSavingsCells, savingsCellFor } from "../townLayout";
import { SavingsRow } from "./SavingsRow";

let mounted: MountedComponent | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("SavingsRow (ADDENDUM-01 §2.4a/§3.4 item 4)", () => {
  it("mounts as a bare fragment: parent's direct children are exactly the plots + the signpost", () => {
    mounted = mountComponent(
      <div className="town-grid">
        <SavingsRow ladder={[1, 2, 3]} />
      </div>,
    );
    const grid = mounted.container.querySelector(".town-grid") as HTMLElement;
    expect(grid.children.length).toBe(SAVING_CATEGORY_IDS.length + freeSavingsCells().length);
  });

  it("places every plot at savingsCellFor(id) and stays empty (real structures land in the next task)", () => {
    mounted = mountComponent(
      <div className="town-grid">
        <SavingsRow ladder={[1, 2, 3]} />
      </div>,
    );
    const plots = [...mounted.container.querySelectorAll(".savings-plot")] as HTMLElement[];
    expect(plots.length).toBe(SAVING_CATEGORY_IDS.length);
    for (const plot of plots) {
      const id = plot.dataset.structureId as (typeof SAVING_CATEGORY_IDS)[number];
      const cell = savingsCellFor(id);
      expect(Number(plot.style.gridColumn)).toBe(cell.col + 1);
      expect(Number(plot.style.gridRow)).toBe(cell.row + 1);
      expect(plot.classList.contains("savings-plot--empty")).toBe(true);
    }
  });

  it("a longer ladder grows the reserved plot height", () => {
    mounted = mountComponent(
      <div className="town-grid">
        <SavingsRow ladder={[1, 2, 3]} />
      </div>,
    );
    const shortHeight = Number((mounted.container.querySelector(".savings-plot") as HTMLElement).style.height.replace("px", ""));
    mounted.unmount();

    mounted = mountComponent(
      <div className="town-grid">
        <SavingsRow ladder={[1, 2, 3, 4, 5, 6, 7, 8]} />
      </div>,
    );
    const longHeight = Number((mounted.container.querySelector(".savings-plot") as HTMLElement).style.height.replace("px", ""));
    expect(longHeight).toBeGreaterThan(shortHeight);
  });
});
