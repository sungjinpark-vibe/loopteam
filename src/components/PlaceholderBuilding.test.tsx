/**
 * PlaceholderBuilding level-growth test — ADDENDUM-04 §8. Plain divs/span, no
 * TDS component (only `colors`, a plain object, from `@toss/tds-colors`) —
 * no ThemeProvider needed, same call TierCelebration.test.tsx already makes
 * for a component with the same shape.
 *
 * The hard requirement this locks in: level 1 (default or explicit) must
 * render BYTE-IDENTICAL markup to today's PlaceholderBuilding — every
 * existing save's buildings are level 1, and nothing may visually regress
 * for them.
 */
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { afterEach, describe, expect, it } from "vitest";
import { PlaceholderBuilding } from "./PlaceholderBuilding";

let mounted: MountedComponent | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("PlaceholderBuilding — level (ADDENDUM-04 §8)", () => {
  it("level 1 and no `level` prop render identical markup — the no-regression baseline", () => {
    const a = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} />);
    const b = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={1} />);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
    a.unmount();
    b.unmount();
  });

  it("level 1 shows no floors div and no Lv. badge", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={1} />);
    expect(mounted.container.querySelector(".building-floors")).toBeNull();
    expect(mounted.container.querySelector(".building-level-badge")).toBeNull();
  });

  it("level 3 renders a taller floor stack than a hypothetical level 2 — more levels, more floors", () => {
    const two = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={2} />);
    const three = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={3} />);
    const twoHeight = parseFloat((two.container.querySelector(".building-floors") as HTMLElement).style.height);
    const threeHeight = parseFloat((three.container.querySelector(".building-floors") as HTMLElement).style.height);
    expect(threeHeight).toBeGreaterThan(twoHeight);
    two.unmount();
    three.unmount();
  });

  it("the Lv.N badge appears from level 2 up, not at level 1", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={4} />);
    const badge = mounted.container.querySelector(".building-level-badge");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("Lv.4");
  });

  it("the accessible title mentions the level for level >= 2, and is unchanged (category label only) at level 1", () => {
    const level1 = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={1} />);
    const level5 = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={5} />);
    const tile1 = level1.container.querySelector(".building-tile") as HTMLElement;
    const tile5 = level5.container.querySelector(".building-tile") as HTMLElement;
    expect(tile1.title).toBe("카페");
    expect(tile1.title).not.toContain("Lv.");
    expect(tile5.title).toBe("카페 Lv.5");
    level1.unmount();
    level5.unmount();
  });

  it("a level above the visual cap (5) still fits — clamped rather than growing past the tile", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={99} />);
    const floors = mounted.container.querySelector(".building-floors") as HTMLElement;
    const capped = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={5} />);
    expect(floors.style.height).toBe((capped.container.querySelector(".building-floors") as HTMLElement).style.height);
    capped.unmount();
  });
});
