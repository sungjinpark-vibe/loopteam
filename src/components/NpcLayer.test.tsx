import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { gridRowCount } from "../townLayout";
import { NpcLayer } from "./NpcLayer";

let mounted: MountedComponent | null = null;
const rowCount = gridRowCount(0); // a real, small town grid's row count — enough road cells to spawn on

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches, media: "(prefers-reduced-motion: reduce)", addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

describe("NpcLayer", () => {
  beforeEach(() => mockReducedMotion(false));

  it("renders exactly `npcCount` sprites", () => {
    mounted = mountComponent(<NpcLayer npcCount={5} rowCount={rowCount} />);
    expect(mounted.container.querySelectorAll(".npc-slot")).toHaveLength(5);
  });

  it("renders 0 sprites when npcCount is 0", () => {
    mounted = mountComponent(<NpcLayer npcCount={0} rowCount={rowCount} />);
    expect(mounted.container.querySelectorAll(".npc-slot")).toHaveLength(0);
  });

  it("sets pointer-events: none and spans the full grid, so it never eats a tile tap or long-press", () => {
    mounted = mountComponent(<NpcLayer npcCount={3} rowCount={rowCount} />);
    const root = mounted.container.querySelector<HTMLElement>(".npc-layer");
    expect(root?.style.pointerEvents).toBe("none");
    expect(root?.style.gridColumn).toBe("1 / -1");
    // NOT `1 / -1` for rows: `.town-grid` declares no `grid-template-rows`, so
    // `-1` resolves to the first row line and the layer collapses to a single
    // 22px row with every NPC stacked on the town's entrance street. Spanning
    // the real row count is what makes it as tall as the town.
    expect(root?.style.gridRow).toBe(`1 / span ${rowCount}`);
  });

  it("renders all 12 species without throwing across a count that exceeds the species table", () => {
    mounted = mountComponent(<NpcLayer npcCount={12} rowCount={rowCount} />);
    expect(mounted.container.querySelectorAll(".npc-slot svg")).toHaveLength(12);
  });

  it("starts a single repaint interval (~2.5s) on mount and clears it on unmount", () => {
    const setSpy = vi.spyOn(window, "setInterval");
    const clearSpy = vi.spyOn(window, "clearInterval");
    mounted = mountComponent(<NpcLayer npcCount={2} rowCount={rowCount} />);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(expect.any(Function), 2500);
    const id = setSpy.mock.results[0]?.value;
    mounted.unmount();
    mounted = null;
    expect(clearSpy).toHaveBeenCalledWith(id);
  });

  it("does not start the repaint interval under prefers-reduced-motion (NPCs render in place, never move)", () => {
    mockReducedMotion(true);
    const setSpy = vi.spyOn(window, "setInterval");
    mounted = mountComponent(<NpcLayer npcCount={2} rowCount={rowCount} />);
    expect(setSpy).not.toHaveBeenCalled();
  });
});
