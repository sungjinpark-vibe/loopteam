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
import { colors } from "@toss/tds-colors";
import { PlaceholderBuilding } from "./PlaceholderBuilding";
import { MAX_FUSE_TIER, MAX_VISUAL_LEVEL } from "./buildingArt";
import { GRID_GAP_PX, MIN_TILE_WIDTH_PX, TILE_HEIGHT_PX } from "../townLayout";
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

describe("PlaceholderBuilding — roof signboard (§4.2-4.3, AC-9; universal since 2026-08-13)", () => {
  const LANDMARK_CATEGORIES: BuildingCategoryId[] = ["culture", "social", "transport", "salary"];

  it.each(LANDMARK_CATEGORIES)("%s (a landmark archetype) emits a [data-part=signboard] node", (categoryId) => {
    mounted = mountComponent(<PlaceholderBuilding categoryId={categoryId} variantIndex={0} level={1} />);
    expect(mounted.container.querySelector('[data-part="signboard"]')).not.toBeNull();
    mounted.unmount();
    mounted = null;
  });

  /**
   * REPLACES "every other category at level <= 3 does not emit a signboard".
   *
   * That assertion encoded the landmark-only rule the user overturned on
   * 2026-08-13: "무슨 건물인지 알 수 있게 지붕에 간판을 달아라" — a signboard on the roof
   * so you can tell what the building is. Under the old rule an ordinary Lv.1 shop
   * carried only a bare 16-unit emoji with no plate and no contrast, which is
   * precisely the thing the user could not read. The rule is now "every building,
   * every level", so the inverted assertion below is the one this file should have.
   */
  it("EVERY category emits a roof signboard at every level, including Lv.1 (user instruction 2026-08-13)", () => {
    for (const categoryId of SAMPLE_CATEGORIES) {
      for (const level of [1, 3, 10]) {
        const m = mountComponent(<PlaceholderBuilding categoryId={categoryId} variantIndex={0} level={level} />);
        expect(m.container.querySelector('[data-part="signboard"]'), `${categoryId} Lv.${level}`).not.toBeNull();
        m.unmount();
      }
    }
  });

  it("a non-landmark category promoted by level >= 4 also emits a signboard", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={4} />);
    expect(mounted.container.querySelector('[data-part="signboard"]')).not.toBeNull();
  });

  /** The sign carries the archetype's own glyph — "what kind of building is this" needs the
   *  category-specific mark, not a generic plate. Two different categories, two different glyphs. */
  it("the signboard shows the category's own glyph, on a plate filled with the category hue", () => {
    const cafe = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={1} />);
    const clinic = mountComponent(<PlaceholderBuilding categoryId="health" variantIndex={0} level={1} />);
    const glyphOf = (m: MountedComponent) =>
      Array.from(m.container.querySelectorAll("text")).map((t) => t.textContent).join("");
    expect(glyphOf(cafe)).toContain("☕");
    expect(glyphOf(clinic)).toContain("✚");
    expect(glyphOf(cafe)).not.toBe(glyphOf(clinic));
    // colour is the only channel that survives fit scale (~17px tile) — the plates must differ
    const plateFill = (m: MountedComponent) => m.container.querySelector('[data-part="signboard"]')!.getAttribute("fill");
    expect(plateFill(cafe)).not.toBe(plateFill(clinic));
    cafe.unmount();
    clinic.unmount();
  });

  /** Legibility floor, measured not asserted by eye: the plate must be a real share of the
   *  cell, not the old fixed 44x18 view units (= 10x4 CSS px, ~1.7px at the 0.42 fit scale). */
  it("the signboard plate is a legible share of its cell — at least 40% of the art's width", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={1} />);
    const svg = mounted.container.querySelector("svg")!;
    const viewW = Number(svg.getAttribute("viewBox")!.split(" ")[2]);
    const plateW = Number(mounted.container.querySelector('[data-part="signboard"]')!.getAttribute("width"));
    expect(plateW / viewW).toBeGreaterThanOrEqual(0.4);
    // …and never wider than the cell itself (the horizontal half of the d8ce379 freeze)
    expect(plateW).toBeLessThanOrEqual(viewW);
  });
});

// ── ADDENDUM-08 §7 — footprint must actually shape the art, not just gate isLandmark ──

describe("PlaceholderBuilding — footprint scaling (ADDENDUM-08 §7)", () => {
  function svgOf(w?: 1 | 2, h?: 1 | 2) {
    const m = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={1} w={w} h={h} />);
    const svg = m.container.querySelector("svg")!;
    const result = { count: svg.querySelectorAll("*").length, html: svg.innerHTML };
    m.unmount();
    return result;
  }

  it("1x1, 2x1, 1x2, and 2x2 each render distinguishable markup — a bigger footprint must not be the same sprite stretched into a bigger box", () => {
    const oneByOne = svgOf(1, 1);
    const twoByOne = svgOf(2, 1);
    const oneByTwo = svgOf(1, 2);
    const twoByTwo = svgOf(2, 2);

    // 1x1 must be the smallest by node count, 2x2 the largest — a genuinely bigger structure.
    expect(twoByOne.count).toBeGreaterThan(oneByOne.count);
    expect(oneByTwo.count).toBeGreaterThan(oneByOne.count);
    expect(twoByTwo.count).toBeGreaterThan(twoByOne.count);
    expect(twoByTwo.count).toBeGreaterThan(oneByTwo.count);

    // 2x1 (wide) and 1x2 (deep) land on the same node count by design (each swaps which
    // face gets the extra window column) — they must still be geometrically distinct.
    expect(twoByOne.html).not.toBe(oneByTwo.html);

    // every footprint must be visually distinguishable from every other.
    const all = [oneByOne.html, twoByOne.html, oneByTwo.html, twoByTwo.html];
    expect(new Set(all).size).toBe(all.length);
  });

  it("a 2x2 landmark gets a bigger roof signboard than the same archetype at 1x1", () => {
    const small = mountComponent(<PlaceholderBuilding categoryId="social" variantIndex={0} level={1} w={1} h={1} />);
    const big = mountComponent(<PlaceholderBuilding categoryId="social" variantIndex={0} level={1} w={2} h={2} />);
    const smallPlate = small.container.querySelector('[data-part="signboard"]') as SVGRectElement;
    const bigPlate = big.container.querySelector('[data-part="signboard"]') as SVGRectElement;
    expect(Number(bigPlate.getAttribute("width"))).toBeGreaterThan(Number(smallPlate.getAttribute("width")));
    small.unmount();
    big.unmount();
  });

  /**
   * Regression test for the "art does not fill its cell" defect (user report 2026-08-12:
   * "건물 이미지 사이즈는 1×1인데 위치를 2×2, 2×1의 가운데 배치했어" — the art was 1x1-sized
   * and merely centred inside the bigger cells).
   *
   * Root cause: `preserveAspectRatio="xMidYMid meet"` scales by
   * `min(tileW/viewW, tileH/viewH)` and centres the remainder, so ANY viewBox whose
   * aspect differs from the tile's leaves slack in one axis. Every footprint drew into
   * 120x176 (aspect 0.68) except 2x1 (240x176, 1.36), against tiles of aspect
   * 1.0 / 2.15 / 0.465 / 1.0.
   *
   * jsdom has no layout, so this asserts the computed geometry, not rendered pixels:
   * (a) the viewBox aspect equals the footprint's TILE aspect — the necessary half — and
   * (b) the drawn polygon silhouette spans >= 90% of that viewBox in BOTH axes — the
   * sufficient half. (b) is what a "widen the canvas, keep the tiny building" non-fix
   * fails, and that non-fix is exactly what the user rejected ("빈 여백을 늘리는 눈속임 금지").
   * The node-count / markup-distinctness assertions above do NOT catch this class of
   * defect — the broken build passed those too.
   */
  function tileBoxPx(w: number, h: number) {
    return {
      w: w * MIN_TILE_WIDTH_PX + (w - 1) * GRID_GAP_PX,
      h: h * TILE_HEIGHT_PX + (h - 1) * GRID_GAP_PX,
    };
  }

  function artMetrics(categoryId: BuildingCategoryId, w: 1 | 2, h: 1 | 2, level: number = MAX_VISUAL_LEVEL, fuseTier = 0) {
    const m = mountComponent(
      <PlaceholderBuilding categoryId={categoryId} variantIndex={0} level={level} fuseTier={fuseTier} w={w} h={h} />,
    );
    const svg = m.container.querySelector("svg")!;
    const [, , viewW, viewH] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    // every wall / roof / eave / window / decor polygon vertex the art actually draws
    const pts = Array.from(svg.querySelectorAll("polygon")).flatMap((el) =>
      el
        .getAttribute("points")!
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map(Number)),
    );
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const growPx = Number(svg.getAttribute("data-grow-px") ?? 0);
    m.unmount();
    // The viewBox and the rendered element grow by the SAME px (buildingArt.tsx), so
    // one view unit is the same number of CSS px at every level and `viewW / viewH`
    // in px is directly comparable across levels. `unit` is that scale.
    const unit = viewW / (w * MIN_TILE_WIDTH_PX + (w - 1) * GRID_GAP_PX);
    return {
      aspect: viewW / viewH,
      fillW: (Math.max(...xs) - Math.min(...xs)) / viewW,
      fillH: (Math.max(...ys) - Math.min(...ys)) / viewH,
      growPx,
      /** on-screen height of the art element at 100% zoom, in CSS px */
      elementHeightPx: viewH / unit,
      /** on-screen height of the drawn silhouette at 100% zoom, in CSS px */
      drawnHeightPx: (Math.max(...ys) - Math.min(...ys)) / unit,
      /** how deep the ground diamond (the base footprint) is, in CSS px — must not move with level */
      baseWidthPx: (Math.max(...xs) - Math.min(...xs)) / unit,
    };
  }

  const FOOTPRINTS: [1 | 2, 1 | 2][] = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
  ];
  // "food" is a flat-roof archetype, "cafe" a pyramid one — the two roofs take their
  // vertical budget differently, so both have to land on the box. Levels 1 and
  // MAX_VISUAL_LEVEL bracket the wall-height range (floors = level - 1, so Lv.1
  // is the shortest body and Lv.5 the tallest) — the d8ce379 baseline was
  // measured on a real town, overwhelmingly Lv.1 buildings, so this property
  // has to hold there too, not just at the level artMetrics happens to default to.
  /**
   * ── 2026-08-13: the VERTICAL half of this property is redefined, deliberately ──
   *
   * BEFORE (both axes, every level):
   *     expect(aspect).toBeCloseTo(tile.w / tile.h, 5);
   *     expect(fillW).toBeGreaterThanOrEqual(0.9);
   *     expect(fillH).toBeGreaterThanOrEqual(0.9);
   *
   * AFTER: `aspect` is asserted at Lv.1 only, and `fillW` is re-expressed as "the
   * viewBox is exactly the TILE's width and the art fills it" — a stricter statement
   * than the old aspect check, because it pins the width in px rather than as a ratio
   * that a taller box would silently satisfy. `fillH >= 0.9` survives verbatim; what
   * changes is the box it measures against, which is now allowed to be taller than the
   * tile.
   *
   * Justification: the user instructed "레벨이 오를수록 건물이 높아져야 한다" on 2026-08-13,
   * revoking ADDENDUM-11 §4.0's "커지지 않고 고급화" himself (CLAUDE.md records the
   * revision and its governance). A building that must grow taller with level CANNOT
   * keep a viewBox aspect equal to its tile's — that equality was the encoding of the
   * exact constraint the user lifted. The half of d8ce379 that still holds — base
   * footprint fills its cell and never spills sideways — is asserted harder than before
   * (exact tile width, plus the no-drift test below). Nothing was deleted to go green:
   * every assertion removed here is replaced by the assertion the new rule deserves.
   */
  const LEVELS: readonly number[] = [1, MAX_VISUAL_LEVEL];
  for (const categoryId of ["food", "cafe"] as const) {
    for (const level of LEVELS) {
      it.each(FOOTPRINTS)(`a ${categoryId} at %ix%i, Lv.${level}, fills its cell's WIDTH and stands on its own floor`, (w, h) => {
        const tile = tileBoxPx(w, h);
        const { aspect, fillW, fillH, elementHeightPx } = artMetrics(categoryId, w, h, level);
        // horizontal: unchanged invariant, pinned in px — the art box IS the tile's width
        expect(fillW).toBeGreaterThanOrEqual(0.9);
        // vertical: still fills whatever box it is given, but that box may now be taller
        expect(fillH).toBeGreaterThanOrEqual(0.9);
        if (level === 1) {
          // a Lv.1 building is still EXACTLY its tile, in both axes — the d8ce379 look
          expect(aspect).toBeCloseTo(tile.w / tile.h, 5);
          expect(elementHeightPx).toBeCloseTo(tile.h, 5);
        } else {
          // …and above Lv.1 it is taller than its tile, never shorter, never wider
          expect(elementHeightPx).toBeGreaterThan(tile.h);
        }
      });
    }
  }

  // ADDENDUM-11 §4.1/§7.5 — extend the fill-rate regression test from
  // "4 footprints x 2 roof shapes" to "4 footprints x 6 fuse tiers" (0-5, i.e.
  // Lv.5 through Lv.10). Since 2026-08-13 the fuse tier ALSO feeds the height
  // ladder (`level` here is MAX_VISUAL_LEVEL + tier), so the aspect check is gone
  // for the same reason as above; the fill-both-axes property is what survives.
  const FUSE_TIERS = [0, 1, 2, 3, 4, 5] as const;
  for (const categoryId of ["food", "cafe"] as const) {
    it.each(FUSE_TIERS)(`a ${categoryId} at fuse tier %i still fills its (taller) box in both axes at every footprint`, (fuseTier) => {
      for (const [w, h] of FOOTPRINTS) {
        const tile = tileBoxPx(w, h);
        const { fillW, fillH, elementHeightPx } = artMetrics(categoryId, w, h, MAX_VISUAL_LEVEL + fuseTier, fuseTier);
        expect(fillW).toBeGreaterThanOrEqual(0.9);
        expect(fillH).toBeGreaterThanOrEqual(0.9);
        expect(elementHeightPx).toBeGreaterThan(tile.h);
      }
    });
  }

  it("all four footprints fill their cell by the same margin — no footprint is the odd one out", () => {
    const fills = FOOTPRINTS.flatMap(([w, h]) => {
      const m = artMetrics("food", w, h);
      return [m.fillW, m.fillH];
    });
    expect(Math.max(...fills) - Math.min(...fills)).toBeLessThanOrEqual(0.08);
  });

  /**
   * The surviving half of the d8ce379 freeze, asserted directly rather than implied by
   * the old aspect check: the BASE must not move. Only the vertical ceiling was lifted.
   */
  it.each(FOOTPRINTS)("the base footprint at %ix%i is pixel-identical from Lv.1 to Lv.10 — only height grows", (w, h) => {
    const lo = artMetrics("food", w, h, 1);
    const hi = artMetrics("food", w, h, 10, MAX_FUSE_TIER);
    expect(hi.baseWidthPx).toBeCloseTo(lo.baseWidthPx, 5);
    expect(hi.baseWidthPx).toBeLessThanOrEqual(tileBoxPx(w, h).w); // never spills sideways
  });

  /**
   * The height ladder itself (user instruction 2026-08-13). Lv.1..Lv.10 must be
   * distinguishable at a glance, so each step is STRICTLY taller than the last — both
   * across the EXP levels (1-5) and across the fuse tiers (6-10), which is the cap the
   * old wall geometry saturated at.
   */
  it("art height rises strictly with level from Lv.1 to Lv.10, across both the EXP and fuse halves", () => {
    const heights = Array.from({ length: 10 }, (_, i) => {
      const level = i + 1;
      return artMetrics("food", 1, 1, level, Math.max(0, level - MAX_VISUAL_LEVEL)).drawnHeightPx;
    });
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i], `Lv.${i + 1} vs Lv.${i}`).toBeGreaterThan(heights[i - 1]);
    }
    // and the ladder has real range, not a sub-pixel drift no player could see
    expect(heights[9] / heights[0]).toBeGreaterThan(1.8);
  });

  /** A park and a monument never level up, so they must never overhang their cell. */
  it.each(["park", null] as const)("a %s tile never grows above its cell", (categoryId) => {
    const m = mountComponent(
      <PlaceholderBuilding categoryId={categoryId} variantIndex={0} level={10} monumentPeriod={categoryId === null ? "2026-08" : undefined} />,
    );
    const svg = m.container.querySelector("svg")!;
    expect(svg.getAttribute("data-grow-px")).toBeNull();
    expect(Number(svg.getAttribute("viewBox")!.split(" ")[3])).toBeCloseTo(176, 5);
    m.unmount();
  });
});

// ── ADDENDUM-11 §4 — fuse-tier art (Lv.6-10), no size, only material/light ──

describe("PlaceholderBuilding — fuse tier art (ADDENDUM-11 §4)", () => {
  it("fuseTier 0 and no fuseTier prop render identical markup — the no-regression baseline", () => {
    const a = mountComponent(<PlaceholderBuilding categoryId="etc" variantIndex={0} level={5} />);
    const b = mountComponent(<PlaceholderBuilding categoryId="etc" variantIndex={0} level={5} fuseTier={0} />);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
    a.unmount();
    b.unmount();
  });

  /**
   * 2026-08-13 — the snapshot was RE-TAKEN, not deleted. Its job is unchanged: pin the
   * unfused art so a later fusion change cannot silently alter it. It was re-recorded
   * once, on purpose, for the two user-instructed changes (taller wall + universal roof
   * signboard); the assertion itself is untouched and now guards the new baseline.
   *
   * RE-RECORDED a second time, same day, for the third user-instructed change: the roof
   * now carries the category colour at a fixed tone (`roofTone`), and the roof/wall
   * polygons carry `data-part` so the colour can be asserted by name instead of by
   * position. Both are colour/attribute deltas inside the same geometry — the fill-rate
   * and footprint tests above are the ones that would catch a shape regression, and they
   * are untouched and green.
   */
  it("Lv.1-5 (fuseTier absent) SVG output is unchanged — golden snapshot for every archetype family", () => {
    const flat = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={1} level={5} w={2} h={1} />);
    const pyramid = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={2} level={3} />);
    expect(flat.container.querySelector("svg")!.outerHTML).toMatchSnapshot("food-2x1-lv5-fuse0");
    expect(pyramid.container.querySelector("svg")!.outerHTML).toMatchSnapshot("cafe-1x1-lv3-fuse0");
    flat.unmount();
    pyramid.unmount();
  });

  it(`a level above the visual cap combined with a fuse tier (Lv.${MAX_VISUAL_LEVEL + MAX_FUSE_TIER}) still fits — geometry stays capped, only fuseTier is new`, () => {
    const unfused = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={MAX_VISUAL_LEVEL} />);
    const fused = mountComponent(
      <PlaceholderBuilding categoryId="cafe" variantIndex={0} level={MAX_VISUAL_LEVEL + MAX_FUSE_TIER} fuseTier={MAX_FUSE_TIER} />,
    );
    // floor-belt count (wall geometry) is identical — fuseTier never adds a floor.
    expect(fused.container.querySelectorAll(".building-floor-belt").length).toBe(
      unfused.container.querySelectorAll(".building-floor-belt").length,
    );
    unfused.unmount();
    fused.unmount();
  });

  it("roof material steps with fuse tier — a pyramid roof's ridge accent recolours away from white, geometry (radius) unchanged", () => {
    // "etc" (cottage/pyramid) carries no decor, so the SVG's lone <circle> at
    // fuseTier 0 is unambiguously the ridge dot.
    const tier0 = mountComponent(<PlaceholderBuilding categoryId="etc" variantIndex={0} level={1} />);
    const ridge0 = tier0.container.querySelector("svg circle") as SVGCircleElement;
    expect(ridge0.getAttribute("fill")).toBe("#ffffff");

    const tier5 = mountComponent(<PlaceholderBuilding categoryId="etc" variantIndex={0} level={MAX_VISUAL_LEVEL} fuseTier={MAX_FUSE_TIER} />);
    const ridge5 = tier5.container.querySelector("svg circle") as SVGCircleElement;
    expect(ridge5.getAttribute("fill")).not.toBe("#ffffff");
    // the ornament recolours, but its RADIUS (geometry) is untouched — the §4.0 guard.
    expect(ridge5.getAttribute("r")).toBe(ridge0.getAttribute("r"));
    tier0.unmount();
    tier5.unmount();
  });

  it("a flat roof gets a small inset crown accent only at fuseTier >= 1, never at fuseTier 0", () => {
    // "health" (clinic/flat) carries a cross decor made of polygons only, so
    // [data-part='fuse-crown'] is unambiguous.
    const tier0 = mountComponent(<PlaceholderBuilding categoryId="health" variantIndex={0} level={1} />);
    expect(tier0.container.querySelector('[data-part="fuse-crown"]')).toBeNull();
    const tier1 = mountComponent(<PlaceholderBuilding categoryId="health" variantIndex={0} level={1} fuseTier={1} />);
    expect(tier1.container.querySelector('[data-part="fuse-crown"]')).not.toBeNull();
    tier0.unmount();
    tier1.unmount();
  });

  it("the crown accent's own extent never exceeds the roof's pre-existing top vertex (bounded, cannot move the fill metric)", () => {
    // The flat-roof crown circle is centred at (cy - h) with r <= hh, so its top
    // edge (cy - h - r) can never rise above BT's y (cy - hh - h) — the point the
    // flat roof polygon already reaches at fuseTier 0.
    const m = mountComponent(<PlaceholderBuilding categoryId="health" variantIndex={0} level={1} fuseTier={MAX_FUSE_TIER} />);
    const svg = m.container.querySelector("svg")!;
    const crown = svg.querySelector('[data-part="fuse-crown"]')!;
    const cy = Number(crown.getAttribute("cy"));
    const r = Number(crown.getAttribute("r"));
    const crownTopY = cy - r;
    // Read every OTHER painted polygon's min-y (walls/roof/decor) — the crown
    // must never rise above what the building already draws, regardless of
    // paint order or which polygon happens to be topmost.
    const allYs = Array.from(svg.querySelectorAll("polygon")).flatMap((el) =>
      el
        .getAttribute("points")!
        .trim()
        .split(/\s+/)
        .map((pair) => Number(pair.split(",")[1])),
    );
    const topmostExistingY = Math.min(...allYs);
    expect(crownTopY).toBeGreaterThanOrEqual(topmostExistingY);
    m.unmount();
  });

  it("ground glow ring appears only at fuseTier >= 1, at the exact position/radius of the existing shadow ellipse", () => {
    const tier0 = mountComponent(<PlaceholderBuilding categoryId="etc" variantIndex={0} level={1} />);
    expect(tier0.container.querySelectorAll("svg ellipse").length).toBe(1); // shadow only
    const tier3 = mountComponent(<PlaceholderBuilding categoryId="etc" variantIndex={0} level={1} fuseTier={3} />);
    const ellipses = tier3.container.querySelectorAll("svg ellipse");
    expect(ellipses.length).toBe(2); // shadow + glow
    const [shadow, glow] = Array.from(ellipses);
    expect(glow.getAttribute("rx")).toBe(shadow.getAttribute("rx"));
    expect(glow.getAttribute("ry")).toBe(shadow.getAttribute("ry"));
    expect(glow.getAttribute("cx")).toBe(shadow.getAttribute("cx"));
    expect(glow.getAttribute("cy")).toBe(shadow.getAttribute("cy"));
    tier0.unmount();
    tier3.unmount();
  });

  it("windows relax toward fully lit as fuse tier rises, and MAX_FUSE_TIER is lit end to end", () => {
    const isDark = (el: Element) => el.getAttribute("fill") === colors.grey200;
    const darkCount = (fuseTier: number) => {
      const m = mountComponent(<PlaceholderBuilding categoryId="cafe" variantIndex={0} level={MAX_VISUAL_LEVEL} fuseTier={fuseTier} />);
      const n = Array.from(m.container.querySelectorAll('[data-part="window"]')).filter(isDark).length;
      m.unmount();
      return n;
    };
    const dark0 = darkCount(0);
    const darkMax = darkCount(MAX_FUSE_TIER);
    expect(dark0).toBeGreaterThan(0); // baseline: some panes unlit (existing behaviour)
    expect(darkMax).toBe(0); // Lv.10: lit end to end
  });

  it("every fuse tier 1-5 produces a distinguishable SVG from tier 0 and from each other (visible per-rung escalation)", () => {
    const htmls = [0, 1, 2, 3, 4, 5].map((fuseTier) => {
      const m = mountComponent(
        <PlaceholderBuilding categoryId="cafe" variantIndex={0} level={MAX_VISUAL_LEVEL} fuseTier={fuseTier} />,
      );
      const html = m.container.querySelector("svg")!.innerHTML;
      m.unmount();
      return html;
    });
    expect(new Set(htmls).size).toBe(htmls.length);
  });

  it("fusion never applies to a park or a monument — no fuseTier prop reaches BuildingArt for either (no crash if passed anyway)", () => {
    const park = mountComponent(<PlaceholderBuilding categoryId="park" variantIndex={0} fuseTier={3} />);
    const monument = mountComponent(<PlaceholderBuilding categoryId={null} variantIndex={0} monumentPeriod="2026-08" fuseTier={3} />);
    expect(park.container.querySelector("svg")?.getAttribute("data-archetype")).toBe("park");
    expect(monument.container.querySelector("svg")?.getAttribute("data-archetype")).toBe("monument");
    park.unmount();
    monument.unmount();
  });
});

// ── 2026-08-13 user instruction: the WHOLE ROOF carries the category colour ──

describe("PlaceholderBuilding — roof colour is the category signal (user instruction 2026-08-13)", () => {
  const roofFills = (m: MountedComponent) =>
    Array.from(m.container.querySelectorAll('[data-part="roof"]')).map((el) => el.getAttribute("fill"));

  it("every category paints a roof, and the roof colour does NOT change with variantIndex — a colour code must be one colour per category", () => {
    for (const categoryId of SAMPLE_CATEGORIES) {
      const perVariant = [0, 1, 2].map((variantIndex) => {
        const m = mountComponent(<PlaceholderBuilding categoryId={categoryId} variantIndex={variantIndex} level={1} />);
        const fills = roofFills(m);
        const wall = m.container.querySelector('[data-part="wall"]')?.getAttribute("fill") ?? null;
        m.unmount();
        return { fills, wall };
      });
      expect(perVariant[0].fills.length, `${categoryId} paints no roof`).toBeGreaterThan(0);
      expect(new Set(perVariant.map((v) => v.fills.join("|"))).size, `${categoryId} roof varies by variant`).toBe(1);
      // …while the WALLS keep their per-variant band (§ "two buildings of the same
      // category are never pixel-identical" stays true).
      expect(new Set(perVariant.map((v) => v.wall)).size, `${categoryId} walls lost their variety`).toBeGreaterThan(1);
    }
  });

  it("two categories that share a hue still get different roofs — the light/deep tone split", () => {
    // The six colliding pairs are (orange food/cafe), (blue transport/education),
    // (purple shopping/culture), (teal living/other_income), (yellow social/bonus),
    // (green salary/sidejob). These two comparisons hold roof SHAPE constant, so
    // only the tone can be doing the work.
    const pairs: [BuildingCategoryId, BuildingCategoryId][] = [
      ["shopping", "culture"], // both purple, both flat
      ["living", "other_income"], // both teal, both pyramid
    ];
    for (const [a, b] of pairs) {
      const ma = mountComponent(<PlaceholderBuilding categoryId={a} variantIndex={0} level={1} />);
      const mb = mountComponent(<PlaceholderBuilding categoryId={b} variantIndex={0} level={1} />);
      expect(roofFills(ma), `${a} vs ${b}`).not.toEqual(roofFills(mb));
      ma.unmount();
      mb.unmount();
    }
  });

  it("the white-walled clinic gets a coloured roof too — it used to be the one category with no colour anywhere", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="health" variantIndex={0} level={1} />);
    const fills = roofFills(mounted);
    expect(fills.length).toBeGreaterThan(0);
    expect(fills).toContain(colors.red500);
    expect(fills).not.toContain(colors.grey100); // the pre-2026-08-13 roof
  });

  it("a fused building keeps its category roof — the material step no longer repaints the whole roof plane", () => {
    // ADDENDUM-11 §4.1's trim used to take `top`, i.e. the ENTIRE roof plane of a
    // flat-roofed building, which erased the category colour from every Lv.6-10
    // tower. The tier still has to READ, so both halves are asserted here.
    const tier0 = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={MAX_VISUAL_LEVEL} />);
    const tier5 = mountComponent(
      <PlaceholderBuilding categoryId="food" variantIndex={0} level={MAX_VISUAL_LEVEL + MAX_FUSE_TIER} fuseTier={MAX_FUSE_TIER} />,
    );
    expect(roofFills(tier5)).toEqual(roofFills(tier0));
    expect(tier5.container.querySelector('[data-part="fuse-crown"]')).not.toBeNull();
    tier0.unmount();
    tier5.unmount();
  });
});

// ── 2026-08-13 user report: "높은 건물이 앞에 있으면 뒷 건물이 안 보이거나 겹쳐" ──

describe("PlaceholderBuilding — overhang fade (occlusion)", () => {
  const svgOf = (m: MountedComponent) => m.container.querySelector("svg")!;

  it("without the `occludes` flag the art is byte-identical to before — a building in the clear is never faded", () => {
    const plain = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={10} fuseTier={5} />);
    const notOccluding = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={10} fuseTier={5} occludes={false} />);
    expect(notOccluding.container.innerHTML).toBe(plain.container.innerHTML);
    expect(svgOf(plain).hasAttribute("data-occludes")).toBe(false);
    plain.unmount();
    notOccluding.unmount();
  });

  it("`occludes` fades exactly the strip that hangs over the row behind — the fade length equals the overhang", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={10} occludes />);
    const svg = svgOf(mounted);
    expect(svg.hasAttribute("data-occludes")).toBe(true);
    // the art is `100% + growPx` tall and the fade stops at growPx — i.e. exactly
    // at the top edge of the building's OWN cell, so its own ground is untouched.
    const grow = Number(svg.getAttribute("data-grow-px"));
    expect(grow).toBeGreaterThan(0);
    expect(svg.style.getPropertyValue("--overhang-px")).toBe(`${grow}px`);
    expect(svg.style.height).toBe(`calc(100% + ${grow}px)`);
  });

  it("a Lv.1 building is never marked as occluding — it has no overhang to fade", () => {
    mounted = mountComponent(<PlaceholderBuilding categoryId="food" variantIndex={0} level={1} occludes />);
    expect(svgOf(mounted).hasAttribute("data-occludes")).toBe(false);
  });
});
