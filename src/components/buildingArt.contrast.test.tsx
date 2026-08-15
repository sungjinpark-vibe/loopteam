/**
 * Colour-legibility guards for the town art (2026-08-15, `ui-ux-pro-max`).
 *
 * The skill's #1 rule is contrast and its casual-game row asks for chunky
 * bordered shapes. Both are checkable, so they are checked here rather than left
 * to whoever next opens a screenshot:
 *
 *  1. a keyline separates every building surface from the ground it stands on,
 *  2. no fusion material step is invisible because it happens to equal the roof
 *     plane it is painted on,
 *  3. the light/deep tone split that tells two same-hue categories apart holds.
 *
 * Everything is read off the RENDERED SVG, never off a constant — a test that
 * imports the palette can only prove the palette agrees with itself, and cannot
 * notice a stroke that stopped being applied. Terrain colours come out of
 * `App.css`, which stays their single owner (App.css rule R-3), so a future map
 * retune that darkens the ground fails here instead of quietly killing the roof
 * contrast.
 *
 * Freeze note (afc7cd6 / d8ce379): nothing here asserts geometry. The fill-rate
 * and base-footprint guards in PlaceholderBuilding.test.tsx own that.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { PlaceholderBuilding } from "./PlaceholderBuilding";
import { MAX_FUSE_TIER, MAX_VISUAL_LEVEL } from "./buildingArt";
import type { BuildingCategoryId } from "../types";

let mounted: MountedComponent | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const CATEGORIES: BuildingCategoryId[] = [
  "food",
  "cafe",
  "transport",
  "shopping",
  "living",
  "health",
  "culture",
  "education",
  "social",
  "etc",
  "salary",
  "sidejob",
  "bonus",
  "other_income",
];

/** The six hue collisions: roof says which family, the signboard glyph which member. */
const SAME_HUE_PAIRS: ReadonlyArray<readonly [BuildingCategoryId, BuildingCategoryId]> = [
  ["food", "cafe"],
  ["transport", "education"],
  ["shopping", "culture"],
  ["living", "other_income"],
  ["social", "bonus"],
  ["salary", "sidejob"],
];

function relativeLuminance(hex: string): number {
  const ch = hex.replace("#", "").match(/../g);
  if (!ch) throw new Error(`not a hex colour: ${hex}`);
  const [r, g, b] = ch.map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio. 1 === the two colours have identical lightness. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Terrain surfaces a building stands on or beside, straight out of App.css. */
function terrainColors(): Array<[string, string]> {
  // process.cwd(), not import.meta.url — the jsdom environment rewrites the
  // module URL to http:, which readFileSync cannot take.
  const css = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");
  const wanted = ["--terrace-a", "--terrace-b", "--terrace-c", "--town-asphalt", "--town-grass", "--town-water"];
  return wanted.map((name) => {
    const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`${name} is gone from src/App.css — this guard is out of date`);
    return [name, m[1]] as [string, string];
  });
}

function render(categoryId: BuildingCategoryId, level = 1, fuseTier = 0): MountedComponent {
  return mountComponent(<PlaceholderBuilding categoryId={categoryId} variantIndex={0} level={level} fuseTier={fuseTier} />);
}

function attrsOf(m: MountedComponent, part: string, attr: string): string[] {
  return Array.from(m.container.querySelectorAll(`[data-part="${part}"]`))
    .map((el) => el.getAttribute(attr))
    .filter((v): v is string => v !== null);
}

const TERRAIN = terrainColors();

describe("art contrast — the keyline separates a building from the ground", () => {
  /**
   * Why a keyline at all, asserted rather than asserted-about: the roof FILLS
   * alone do not separate. cafe #ffa927 sits at 1.03:1 on --town-asphalt and
   * bonus at 1.04:1 on --town-water. Retuning fourteen category colours to fix
   * that would have rewritten the colour code the user approved on 2026-08-13,
   * so a neutral stroke does the work instead. If a future map retune ever made
   * every roof clear 1.5 on its own, this test says so and the keyline could be
   * reconsidered.
   */
  it("at least one category roof still needs it — the fills alone do not separate", () => {
    const weak = CATEGORIES.filter((categoryId) => {
      const m = render(categoryId);
      const fills = attrsOf(m, "roof", "fill");
      m.unmount();
      return fills.some((f) => TERRAIN.some(([, t]) => contrastRatio(f, t) < 1.5));
    });
    expect(weak.length).toBeGreaterThan(0);
  });

  it.each(CATEGORIES)("%s draws a keyline on its roof, its walls and its windows", (categoryId) => {
    mounted = render(categoryId);
    for (const part of ["roof", "wall", "window"]) {
      const strokes = attrsOf(mounted, part, "stroke");
      expect(strokes.length, `${categoryId} paints no ${part}`).toBeGreaterThan(0);
      for (const s of strokes) expect(s, `${categoryId} ${part} has no keyline`).toMatch(/^#[0-9a-f]{6}$/i);
      const widths = attrsOf(mounted, part, "stroke-width").map(Number);
      for (const w of widths) expect(w, `${categoryId} ${part} keyline has no width`).toBeGreaterThan(0);
    }
  });

  it.each(TERRAIN)("the keyline holds 4.5:1 against %s, so the silhouette reads on it", (_name, hex) => {
    mounted = render("food");
    const stroke = attrsOf(mounted, "roof", "stroke")[0];
    expect(contrastRatio(stroke, hex)).toBeGreaterThanOrEqual(4.5);
  });

  it("the keyline is one neutral colour for every category — a hue-matched outline would fail the pale categories", () => {
    const strokes = new Set(
      CATEGORIES.flatMap((categoryId) => {
        const m = render(categoryId);
        const s = [...attrsOf(m, "roof", "stroke"), ...attrsOf(m, "wall", "stroke")];
        m.unmount();
        return s;
      }),
    );
    expect(strokes.size).toBe(1);
  });

  /**
   * The window is the cue that says "building" at all, and the lit pane sits at
   * 1.14:1 on the clinic's white wall. Its frame — not its fill — is what makes
   * it read there.
   */
  it("a window pane is legible on the white-walled clinic, where its fill alone is 1.14:1", () => {
    mounted = render("health");
    const panes = Array.from(mounted.container.querySelectorAll('[data-part="window"]'));
    expect(panes.length).toBeGreaterThan(0);
    const wall = mounted.container.querySelector('[data-part="wall"]')!.getAttribute("fill")!;
    for (const pane of panes) {
      const fill = pane.getAttribute("fill")!;
      const stroke = pane.getAttribute("stroke")!;
      expect(contrastRatio(fill, wall), "the pane fill alone was supposed to be the weak half").toBeLessThan(1.5);
      expect(contrastRatio(stroke, wall)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("art contrast — the fusion material step is never invisible", () => {
  /** Every colour any category paints on a roof plane, and who paints it. */
  const roofPlaneOwners = new Map<string, string[]>();
  for (const categoryId of CATEGORIES) {
    const m = render(categoryId);
    for (const fill of attrsOf(m, "roof", "fill")) {
      roofPlaneOwners.set(fill, [...(roofPlaneOwners.get(fill) ?? []), categoryId]);
    }
    m.unmount();
  }

  /**
   * Four of the ten steps used to be BYTE-IDENTICAL to a roof plane some
   * category already paints (bronze === food's whole flat roof, silver ===
   * etc's, jewel === culture's, gold's ridge === bonus's), so on exactly those
   * categories the fusion the player just paid for showed nothing at all.
   */
  it.each([1, 2, 3, 4, 5])("tier %i's material step is not the same colour as the roof it lands on", (fuseTier) => {
    for (const categoryId of CATEGORIES) {
      const m = render(categoryId, MAX_VISUAL_LEVEL + fuseTier, fuseTier);
      const roofFills = attrsOf(m, "roof", "fill");
      const steps = [
        ...Array.from(m.container.querySelectorAll('[data-part="fuse-crown"]')).map((el) => el.getAttribute("fill")!),
        // a pyramid roof's tier signal is the roofLite face + the ridge dot;
        // both are already inside `roofFills`, so what must not collide is the
        // tier colour against the OTHER planes of the same roof.
      ];
      for (const step of steps) {
        expect(roofFills.filter((f) => f === step), `tier ${fuseTier} step ${step} is invisible on ${categoryId}`).toEqual([]);
      }
      m.unmount();
    }
  });

  it("every tier 1-5 recolours something a tier-0 building does not have — the ladder is visible at each rung", () => {
    const seen = new Set<string>();
    for (let fuseTier = 1; fuseTier <= MAX_FUSE_TIER; fuseTier++) {
      const m = render("food", MAX_VISUAL_LEVEL + fuseTier, fuseTier);
      const crown = m.container.querySelector('[data-part="fuse-crown"]')?.getAttribute("fill");
      m.unmount();
      expect(crown, `tier ${fuseTier} paints no crown`).toBeTruthy();
      expect(seen.has(crown!), `tier ${fuseTier} reuses an earlier tier's colour`).toBe(false);
      seen.add(crown!);
    }
  });
});

describe("art contrast — the light/deep split still tells same-hue categories apart", () => {
  /**
   * Compared as the MEAN luminance of the whole roof, not plane-for-plane: three
   * of the six pairs put a flat roof against a pyramid one, which have different
   * plane counts and paint them in a different order, so any single-plane
   * comparison measures the roof SHAPE rather than the tone split it is supposed
   * to be checking. What the player sees at a 16.8px tile is the roof's overall
   * lightness, which is what this reads.
   */
  const roofLightness = (m: MountedComponent) => {
    const fills = attrsOf(m, "roof", "fill");
    return fills.reduce((sum, f) => sum + relativeLuminance(f), 0) / fills.length;
  };

  it.each(SAME_HUE_PAIRS)("%s and %s wear visibly different roofs despite sharing a hue", (a, b) => {
    const ma = render(a);
    const mb = render(b);
    const [la, lb] = [roofLightness(ma), roofLightness(mb)];
    expect(attrsOf(ma, "roof", "fill")).not.toEqual(attrsOf(mb, "roof", "fill"));
    ma.unmount();
    mb.unmount();
    // 1.3, not a round 1.5: this is a REGRESSION floor, not an aspiration. The
    // tightest of the six pairs today is food/cafe at 1.35 (both orange, and the
    // deep tone orange700 is already the darkest step that still reads as
    // orange). Widening it means changing a category colour the user approved on
    // 2026-08-13, which is his call, not this test's — so the bar sits just under
    // where the approved code actually lands and fails if anything narrows it.
    expect((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)).toBeGreaterThanOrEqual(1.3);
  });
});
