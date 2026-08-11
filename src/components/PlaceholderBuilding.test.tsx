/**
 * PlaceholderBuilding tests — ADDENDUM-04 §8 (level growth) + ADDENDUM-05
 * §F-BLD (illustrated buildings). Plain divs/SVG, no TDS component (only
 * `colors`, a plain object, from `@toss/tds-colors`) — no ThemeProvider
 * needed, same call TierCelebration.test.tsx already makes for a component
 * with the same shape.
 *
 * The old CSS-shape assertions (`.building-roof-*`, `.building-floors`) are
 * gone — ADDENDUM-05 replaced that markup with `BuildingArt`'s inline SVG
 * (buildingArt.tsx). This file now pins the NEW contract: a distinct
 * archetype per category, the level signal expressed as SVG floor-belt
 * count, variantIndex producing visible variety, and park/monument each
 * rendering their own distinct form — while keeping the still-true
 * invariants (level 1 no-regression baseline, Lv.N badge, monument markup).
 */
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { afterEach, describe, expect, it } from "vitest";
import { PlaceholderBuilding } from "./PlaceholderBuilding";
import { MAX_VISUAL_LEVEL } from "./buildingArt";
import type { BuildingCategoryId } from "../types";

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

  it("level 1 shows no floor-growth belts and no Lv. badge", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={1} />);
    expect(mounted.container.querySelectorAll(".building-floor-belt").length).toBe(0);
    expect(mounted.container.querySelector(".building-level-badge")).toBeNull();
  });

  it("level 3 renders more floor-growth belts in the SVG than level 2 — more levels, more floors", () => {
    const two = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={2} />);
    const three = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={3} />);
    const twoBelts = two.container.querySelectorAll(".building-floor-belt").length;
    const threeBelts = three.container.querySelectorAll(".building-floor-belt").length;
    expect(threeBelts).toBeGreaterThan(twoBelts);
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

  it(`a level above the visual cap (${MAX_VISUAL_LEVEL}) still fits — clamped rather than growing without bound`, () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={99} />);
    const belts = mounted.container.querySelectorAll(".building-floor-belt").length;
    const capped = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={MAX_VISUAL_LEVEL} />);
    expect(belts).toBe(capped.container.querySelectorAll(".building-floor-belt").length);
    capped.unmount();
  });

  it("the rise-in animation class still applies when justBuilt is true", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} justBuilt />);
    expect(mounted.container.querySelector(".building-tile")!.classList.contains("building-tile-rise")).toBe(true);
  });
});

describe("PlaceholderBuilding — F16 monument", () => {
  it("shows the engraved YYYY-MM label, gets a distinct class, and never shows a Lv.N badge", () => {
    mounted = mountComponent(
      <PlaceholderBuilding categoryId={null} variantIndex={0} monumentPeriod="2026-07" level={1} />,
    );
    const tile = mounted.container.querySelector(".building-tile") as HTMLElement;
    expect(tile.classList.contains("building-tile--monument")).toBe(true);
    expect(mounted.container.querySelector(".building-monument-period")?.textContent).toBe("2026-07");
    expect(mounted.container.querySelector(".building-level-badge")).toBeNull();
    expect(tile.title).toBe("2026-07");
  });

  it("a non-monument null-categoryId tile (none exist today, but the fallback stays inert) renders no monument label or class", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId={null} variantIndex={0} />);
    expect(mounted.container.querySelector(".building-tile")!.classList.contains("building-tile--monument")).toBe(false);
    expect(mounted.container.querySelector(".building-monument-period")).toBeNull();
  });
});

// ── ADDENDUM-05 §F-BLD — illustrated buildings ──

const SAMPLE_CATEGORIES: BuildingCategoryId[] = [
  "food",
  "cafe",
  "transport",
  "shopping",
  "living",
  "health",
  "culture",
  "education",
  "social",
  "salary",
  "sidejob",
  "bonus",
];

describe("PlaceholderBuilding — archetype per category (ADDENDUM-05 §F-BLD)", () => {
  it("each category reads as a DIFFERENT archetype, not just a different colour (director's whole point)", () => {
    const archetypes = SAMPLE_CATEGORIES.map((categoryId) => {
      const m = mountComponent(<PlaceholderBuilding categoryId={categoryId} variantIndex={0} />);
      const value = (m.container.querySelector(".building-tile") as HTMLElement).getAttribute("data-archetype");
      m.unmount();
      return value;
    });
    // "etc" and "other_income" deliberately share the generic-cottage archetype
    // per the ADDENDUM-05 table (income palette is the only difference) — every
    // OTHER category in this sample must be visually distinct from every other.
    expect(new Set(archetypes).size).toBe(SAMPLE_CATEGORIES.length);
  });

  it("the SVG carries a data-archetype attribute matching the category (e.g. food -> restaurant, health -> clinic)", () => {
    const food = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} />);
    const health = mountComponent(<PlaceholderBuilding categoryId="health" variantIndex={0} />);
    expect(food.container.querySelector("svg")?.getAttribute("data-archetype")).toBe("restaurant");
    expect(health.container.querySelector("svg")?.getAttribute("data-archetype")).toBe("clinic");
    food.unmount();
    health.unmount();
  });

  it("etc and other_income deliberately share the cottage archetype (director's table), distinguished only by palette", () => {
    const etc = mountComponent(<PlaceholderBuilding categoryId="etc" variantIndex={0} />);
    const otherIncome = mountComponent(<PlaceholderBuilding categoryId="other_income" variantIndex={0} />);
    expect(etc.container.querySelector("svg")?.getAttribute("data-archetype")).toBe("cottage");
    expect(otherIncome.container.querySelector("svg")?.getAttribute("data-archetype")).toBe("cottage");
    expect(etc.container.querySelector("svg")?.innerHTML).not.toBe(otherIncome.container.querySelector("svg")?.innerHTML);
    etc.unmount();
    otherIncome.unmount();
  });

  it("variantIndex changes the rendered output within one category (roof/colour variant, so two buildings differ)", () => {
    const v0 = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} />);
    const v1 = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={1} />);
    const v2 = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={2} />);
    const html0 = v0.container.querySelector("svg")!.innerHTML;
    const html1 = v1.container.querySelector("svg")!.innerHTML;
    const html2 = v2.container.querySelector("svg")!.innerHTML;
    expect(html0).not.toBe(html1);
    expect(html1).not.toBe(html2);
    v0.unmount();
    v1.unmount();
    v2.unmount();
  });

  it("the park tile (F15) renders its own distinct form — not the building cube — and stays visually unique", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="park" variantIndex={0} />);
    const svg = mounted.container.querySelector("svg");
    expect(svg?.getAttribute("data-archetype")).toBe("park");
    // a building cube always draws a "door" polygon; the park never does.
    expect(svg?.querySelector('[data-part="door"]')).toBeNull();
    expect(svg?.querySelectorAll("circle").length).toBeGreaterThan(0); // tree canopies
  });

  it("the monument tile (F16) renders its own distinct form, separate from both buildings and the park", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId={null} variantIndex={0} monumentPeriod="2026-08" />);
    const svg = mounted.container.querySelector("svg");
    expect(svg?.getAttribute("data-archetype")).toBe("monument");
    expect(svg?.textContent).toContain("2026-08");
  });

  it("no raster <img> and no external URL anywhere in the rendered art (inline SVG only, no hotlinks)", () => {
    const samples = [...SAMPLE_CATEGORIES, "park" as const];
    for (const categoryId of samples) {
      const m = mountComponent(<PlaceholderBuilding categoryId={categoryId} variantIndex={0} level={3} />);
      expect(m.container.querySelector("img")).toBeNull();
      expect(m.container.innerHTML).not.toMatch(/https?:\/\//);
      expect(m.container.innerHTML).not.toContain("url(");
      m.unmount();
    }
  });
});

// ── ADDENDUM-06 §4.1/§4.4 — window grid + the swatch-tint AC (AC-10) ──

describe("PlaceholderBuilding — window grid (§4.1, AC-10)", () => {
  it("a level 1 building emits at least 4 window quads (today: 2)", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={1} />);
    const windows = mounted.container.querySelectorAll('[data-part="window"]');
    expect(windows.length).toBeGreaterThanOrEqual(4);
  });

  it("a level 4 building emits strictly more window quads than a level 1 building of the same category", () => {
    const level1 = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={1} />);
    const level4 = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={4} />);
    const count1 = level1.container.querySelectorAll('[data-part="window"]').length;
    const count4 = level4.container.querySelectorAll('[data-part="window"]').length;
    expect(count4).toBeGreaterThan(count1);
    level1.unmount();
    level4.unmount();
  });

  it("the tile's inline background colour is still a non-empty string (the derived tint, ADDENDUM-06 §4.4)", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} />);
    const tile = mounted.container.querySelector(".building-tile") as HTMLElement;
    expect(tile.style.backgroundColor).not.toBe("");
  });
});

// ── ADDENDUM-06 §4.2/§4.3 — landmark roof signboard (AC-9) ──

describe("PlaceholderBuilding — landmark roof signboard (§4.2-4.3, AC-9)", () => {
  const LANDMARK_CATEGORIES: BuildingCategoryId[] = ["culture", "social", "transport", "salary"];

  it.each(LANDMARK_CATEGORIES)("%s (a landmark archetype) emits a [data-part=signboard] node", (categoryId) => {
    mounted = mountComponent(<PlaceholderBuilding categoryId={categoryId} variantIndex={0} level={1} />);
    expect(mounted.container.querySelector('[data-part="signboard"]')).not.toBeNull();
    mounted.unmount();
    mounted = null;
  });

  it("every other category at level <= 3 does not emit a signboard", () => {
    const nonLandmark = SAMPLE_CATEGORIES.filter((c) => !LANDMARK_CATEGORIES.includes(c));
    for (const categoryId of nonLandmark) {
      const m = mountComponent(<PlaceholderBuilding categoryId={categoryId} variantIndex={0} level={3} />);
      expect(m.container.querySelector('[data-part="signboard"]')).toBeNull();
      m.unmount();
    }
  });

  it("a non-landmark category promoted by level >= 4 also emits a signboard", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={4} />);
    expect(mounted.container.querySelector('[data-part="signboard"]')).not.toBeNull();
  });
});
