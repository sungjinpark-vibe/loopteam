/**
 * Building illustration system — ported from our own prior project `lifetown`
 * (Flutter app, `C:\Users\user\app-dev-team\lifetown`):
 *  - Isometric-cube rendering approach: `docs/design/building-props/building-props.html`
 *    (92-line plain-JS SVG generator — bilinear quad windows, pyramid/flat roof, roof sign,
 *    elliptical ground shadow). Ported from JS strings to TSX here.
 *  - Shape vocabulary (body/roof tags): `app/lib/data/building_visual_defs.dart`.
 * lifetown's own category set (reading/study/work/exercise) does NOT apply here — the
 * archetype-per-category mapping below is ADDENDUM-05 §F-BLD's, written from scratch for
 * app_in_toss's spending categories.
 *
 * All colour comes from `@toss/tds-colors` tokens (same import `content.placeholder.ts`
 * already uses directly) — never a hand-picked hex.
 */
import type { ReactNode } from "react";
import { colors } from "@toss/tds-colors";
import type { BuildingCategoryId, SavingCategoryId } from "../types";
import { SAVING_CATEGORY_IDS } from "../savingsBuckets";
import { GRID_GAP_PX, MIN_TILE_WIDTH_PX, TILE_HEIGHT_PX } from "../townLayout";

/**
 * The categories that actually own building art. Savings are excluded on purpose:
 * a saving entry raises one of the five fixed savings structures (`SavingsRow`) and
 * never becomes a `Building`, so there is no archetype for it. `park` and monuments
 * have their own renderers. Keeping the key type honest is what makes the two
 * `ARCHETYPES[...]` lookups below provably total instead of possibly-`undefined`.
 */
type ArchetypeCategoryId = Exclude<BuildingCategoryId, "park" | SavingCategoryId>;

const SAVING_ID_SET: ReadonlySet<string> = new Set<string>(SAVING_CATEGORY_IDS);

function hasArchetype(categoryId: BuildingCategoryId): categoryId is ArchetypeCategoryId {
  return categoryId !== "park" && !SAVING_ID_SET.has(categoryId);
}

// ── shared geometry (ported 1:1 from building-props.html's bilinear-quad approach) ──

interface Vec {
  x: number;
  y: number;
}

function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// bilinear point on a face: A front-bottom, B side-bottom, C side-top, D front-top
function bil(A: Vec, B: Vec, C: Vec, D: Vec, u: number, v: number): Vec {
  return lerp(lerp(A, B, u), lerp(D, C, u), v);
}

function quadPts(A: Vec, B: Vec, C: Vec, D: Vec, u0: number, u1: number, v0: number, v1: number): Vec[] {
  return [bil(A, B, C, D, u0, v0), bil(A, B, C, D, u1, v0), bil(A, B, C, D, u1, v1), bil(A, B, C, D, u0, v1)];
}

function pointsAttr(pts: Vec[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

// ── colour: pull hue steps straight from @toss/tds-colors, never a hardcoded hex ──

type Hue = "grey" | "blue" | "red" | "orange" | "yellow" | "green" | "teal" | "purple";

const HUE_SHADES: Record<Hue, readonly string[]> = {
  // index 0..8 == shade 100..900
  grey: [colors.grey100, colors.grey200, colors.grey300, colors.grey400, colors.grey500, colors.grey600, colors.grey700, colors.grey800, colors.grey900],
  blue: [colors.blue100, colors.blue200, colors.blue300, colors.blue400, colors.blue500, colors.blue600, colors.blue700, colors.blue800, colors.blue900],
  red: [colors.red100, colors.red200, colors.red300, colors.red400, colors.red500, colors.red600, colors.red700, colors.red800, colors.red900],
  orange: [colors.orange100, colors.orange200, colors.orange300, colors.orange400, colors.orange500, colors.orange600, colors.orange700, colors.orange800, colors.orange900],
  yellow: [colors.yellow100, colors.yellow200, colors.yellow300, colors.yellow400, colors.yellow500, colors.yellow600, colors.yellow700, colors.yellow800, colors.yellow900],
  green: [colors.green100, colors.green200, colors.green300, colors.green400, colors.green500, colors.green600, colors.green700, colors.green800, colors.green900],
  teal: [colors.teal100, colors.teal200, colors.teal300, colors.teal400, colors.teal500, colors.teal600, colors.teal700, colors.teal800, colors.teal900],
  purple: [colors.purple100, colors.purple200, colors.purple300, colors.purple400, colors.purple500, colors.purple600, colors.purple700, colors.purple800, colors.purple900],
};

function shade(hue: Hue, n: number): string {
  const idx = Math.min(8, Math.max(0, Math.round(n / 100) - 1));
  return HUE_SHADES[hue][idx];
}

/**
 * ADDENDUM-11 §4.1 — the fuse-tier "material step" channel. Bronze -> silver ->
 * gold -> platinum -> jewel, escalating in the SAME roof/trim surfaces every
 * archetype already paints (`top`/`roofLite`/`roofDark`) — colour only, so it
 * cannot move a single vertex and therefore cannot move the §4.0 fill metric.
 * Tokens only, from `@toss/tds-colors`, same discipline as `HUE_SHADES`.
 */
// Deliberately NOT derived from the archetype's own hue (unlike HUE_SHADES) —
// a tier-1 step has to read against every category, including the orange-hued
// ones (food/cafe), so each step is picked for contrast against a LIGHT
// default roofLite (shade 100-300) rather than for hue-matching.
const FUSE_TRIM: readonly string[] = [colors.orange700, colors.grey400, colors.yellow500, colors.blue200, colors.purple600];
const FUSE_RIDGE: readonly string[] = [colors.orange800, colors.grey600, colors.yellow700, colors.blue500, colors.purple800];

/** fuseTier 0 (or absent) returns `palette` untouched — the byte-identical guarantee for unfused buildings. */
function withFuseMaterial(palette: Palette, fuseTier: number): Palette {
  if (fuseTier <= 0) return palette;
  const trim = FUSE_TRIM[fuseTier - 1];
  return { ...palette, top: trim, roofLite: trim };
}

interface Palette {
  left: string;
  right: string;
  top: string;
  roofLite: string;
  roofMid: string;
  roofDark: string;
  door: string;
  win: string;
  winDark: string;
}

/**
 * `variantIndex` drives the shade band (400/500/600) so two buildings of the
 * same category are never pixel-identical, on top of whichever roof/decor
 * variety the archetype itself carries.
 */
function paletteFor(hue: Hue, variantIndex: number, whiteWalls?: boolean): Palette {
  const band = variantIndex % 3;
  const base = 400 + band * 100;
  const swap = variantIndex % 2 === 1;
  const wallA = whiteWalls ? colors.grey50 : shade(hue, base);
  const wallB = whiteWalls ? colors.white : shade(hue, base + 100);
  return {
    left: swap ? wallB : wallA,
    right: swap ? wallA : wallB,
    top: whiteWalls ? colors.grey100 : shade(hue, Math.max(base - 100, 100)),
    roofLite: shade(hue, Math.max(base - 200, 100)),
    roofMid: shade(hue, base),
    roofDark: shade(hue, base + 200),
    door: shade(hue, Math.min(base + 300, 800)),
    // §7: lit/unlit window panes are universal tokens, not hue-derived — every
    // building's windows read the same warm-vs-dark, regardless of category colour.
    win: colors.yellow100,
    winDark: colors.grey200,
  };
}

// ── archetype vocabulary (transcribed from building_visual_defs.dart's tag set) ──

type RoofShape = "pyramid" | "flat";

interface Decor {
  awning?: boolean;
  parasol?: boolean;
  chimney?: "back" | "side";
  windowBoxes?: boolean;
  marquee?: boolean;
  ticketWindow?: boolean;
  clock?: boolean;
  flag?: boolean;
  bunting?: boolean;
  wideDoor?: boolean;
  ribbon?: boolean;
  routeStripe?: boolean;
  /** health/clinic — a facade cross, so the category reads without the emoji. */
  cross?: boolean;
  /** salary/office (bank-like) — two entrance columns flanking the door. */
  columns?: boolean;
  /** food — a dish + steam near the ground, next to the awning. */
  foodDisplay?: boolean;
  /** cafe — an outdoor table + cup beside the parasol. */
  cafeTable?: boolean;
  /** shopping — a storefront display window with goods inside. */
  displayWindow?: boolean;
  /** education — an arched transom over the entrance. */
  archEntrance?: boolean;
  /** transport — a platform canopy overhang at the roofline. */
  canopy?: boolean;
  /** living/townhouse — a small porch roof over the door. */
  porch?: boolean;
  /** culture/cinema — poster boards beside the ticket window. */
  posterBoards?: boolean;
}

interface ArchetypeSpec {
  archetype: string;
  hue: Hue;
  roof: RoofShape;
  sign: string;
  hw: number;
  hBase: number;
  whiteWalls?: boolean;
  decor?: Decor;
  /** A wide, low landmark: broader footprint + an oversized roof ornament (§4.2). */
  landmark?: true;
}

const DEFAULT_HW = 32;
const DEFAULT_H = 54;

// Category -> archetype (ADDENDUM-05 §F-BLD table). This mapping is ours —
// lifetown's own categories (reading/study/work/exercise) do not apply.
const ARCHETYPES: Record<ArchetypeCategoryId, ArchetypeSpec> = {
  food: { archetype: "restaurant", hue: "orange", roof: "flat", sign: "🍚", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { awning: true, foodDisplay: true } },
  cafe: { archetype: "cafe", hue: "orange", roof: "pyramid", sign: "☕", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { parasol: true, cafeTable: true } },
  transport: { archetype: "transport", hue: "blue", roof: "flat", sign: "🚌", hw: 42, hBase: 32, decor: { routeStripe: true, canopy: true }, landmark: true },
  shopping: { archetype: "shop", hue: "purple", roof: "flat", sign: "🛍️", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { awning: true, displayWindow: true } },
  living: { archetype: "townhouse", hue: "teal", roof: "pyramid", sign: "🏠", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { chimney: "back", windowBoxes: true, porch: true } },
  health: { archetype: "clinic", hue: "red", roof: "flat", sign: "✚", hw: DEFAULT_HW, hBase: DEFAULT_H, whiteWalls: true, decor: { cross: true } },
  culture: { archetype: "cinema", hue: "purple", roof: "flat", sign: "🎬", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { marquee: true, ticketWindow: true, posterBoards: true }, landmark: true },
  education: { archetype: "school", hue: "blue", roof: "pyramid", sign: "📚", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { clock: true, flag: true, archEntrance: true } },
  social: { archetype: "hall", hue: "yellow", roof: "flat", sign: "🎁", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { bunting: true, wideDoor: true }, landmark: true },
  etc: { archetype: "cottage", hue: "grey", roof: "pyramid", sign: "✳️", hw: DEFAULT_HW, hBase: DEFAULT_H },
  salary: { archetype: "office", hue: "green", roof: "flat", sign: "💼", hw: 24, hBase: 66, decor: { columns: true }, landmark: true },
  sidejob: { archetype: "workshop", hue: "green", roof: "pyramid", sign: "🔧", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { chimney: "side" } },
  bonus: { archetype: "gift", hue: "yellow", roof: "flat", sign: "🎀", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { ribbon: true } },
  other_income: { archetype: "cottage", hue: "teal", roof: "pyramid", sign: "💰", hw: DEFAULT_HW, hBase: DEFAULT_H },
};

/** Cosmetic cap on the level-growth visual (ADDENDUM-04 §8's maxLevel dial). */
export const MAX_VISUAL_LEVEL = 5;

/** ADDENDUM-11 §2.3/§4.1 — the fuse ladder tops out at Lv.10 = maxLevel(5) + 5. */
export const MAX_FUSE_TIER = 5;

function floorsFor(level: number): number {
  return Math.max(0, Math.min(level, MAX_VISUAL_LEVEL) - 1);
}

/** absent === 0, same discipline as `fuseOf` (ADDENDUM-11 §2.4) reads `b.fuse`. */
function clampFuseTier(fuseTier: number | undefined): number {
  return Math.max(0, Math.min(MAX_FUSE_TIER, Math.trunc(fuseTier ?? 0)));
}

/**
 * ── the tile-shaped art box (2026-08-12 "fill the cell" fix) ──
 *
 * Every footprint's viewBox now carries its TILE's aspect ratio. The default
 * `preserveAspectRatio="xMidYMid meet"` scales by `min(tileW/viewW, tileH/viewH)`
 * and centres the remainder, so a viewBox whose aspect differs from the tile's
 * ALWAYS leaves slack in one axis. Before this fix every footprint drew into a
 * fixed 120x176 box (aspect 0.68) except 2x1 (240x176, 1.36), against tiles of
 * aspect 1.0 / 2.15 / 0.465 / 1.0 — so a building floated in a large empty box
 * (measured: a 1x1's drawn geometry covered 36% x 64% of its 40x40 cell).
 *
 * Two things had to change together, and widening the box alone would have been
 * the "more empty margin" non-fix: the box aspect matches the tile AND the cube's
 * own `ux`/`uy`/`hh`/`h` are derived FROM the box instead of from fixed constants,
 * so the drawn silhouette spans it.
 *
 * `ART_UNIT` (view units per tile px) is a constant, so the rendered scale is
 * identical for every footprint (40/176 === 86/378.4 === 0.227, the pre-fix
 * value). That is what lets every absolute decor size below — signboard plate,
 * chimney, clock, emoji font-size — keep the exact on-screen pixel size it has
 * today while the building's extents change underneath them.
 *
 * ponytail: CELL/GAP are imported from townLayout.ts, the single owner of the
 * grid metrics that App.css consumes as `--town-gap` and as the inline
 * `grid-template-rows: 40px` / `grid-template-columns: minmax(40px,1fr)` tracks
 * (App.css rule R-3 forbids restating them, and so does this file). Known
 * ceiling: those columns are `minmax(40px,1fr)`, so on a viewport wide enough
 * for the 20-column grid to stretch past its minimum (946px — never a phone,
 * and the app is a Toss in-app webview) the real cell would be wider than 40px
 * and a sliver of horizontal slack returns. Upgrade path if a tablet layout
 * ever ships: measure the tile with ResizeObserver and pass the aspect in.
 */
const VIEW_H_1X1 = 176; // the pre-fix viewBox height — kept so the rendered art scale is unchanged
const ART_UNIT = VIEW_H_1X1 / TILE_HEIGHT_PX;
/** The art spans 94% of its box. The 6% is overhang room for decor that draws past the
 *  wall faces on purpose (doorstep, platform canopy, chimney) — an `<svg>` root clips to
 *  its viewBox — not letterboxing: the drawn geometry still measures 94-96% of the cell. */
const FILL = 0.94;
/** Cap on the ground diamond's half-height as a share of the art's height. A true
 *  isometric diamond is 2:1 (`spanW/4`), but a 2x1 tile is 86x40 — a full-width 2:1
 *  diamond alone would be 43px tall there, taller than the tile. Wide footprints get a
 *  slightly flatter projection instead of a building that cannot fit its own base. */
const HH_MAX_SHARE = 0.3;
/** Level growth: the box is the tile now, so a floor can no longer add absolute height —
 *  it trades ground-diamond depth for wall height (the building rises as its footprint
 *  flattens). The floor belts and window rows below carry the rest of the growth signal. */
const FLOOR_SQUEEZE = 0.07;
const RIDGE_R = 3.5;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** px a `cells`-long footprint occupies, including the gaps between the cells it spans. */
function tileSpanPx(cells: number, cellPx: number): number {
  return cells * cellPx + (cells - 1) * GRID_GAP_PX;
}

/** The tile-shaped art box for a footprint, in view units. `spanW`/`spanH` is the
 *  rectangle the drawn geometry must fill; `left`/`top` is the overhang margin. */
function artBox(w: number, h: number) {
  const vw = tileSpanPx(w, MIN_TILE_WIDTH_PX) * ART_UNIT;
  const vh = tileSpanPx(h, TILE_HEIGHT_PX) * ART_UNIT;
  return { vw, vh, left: (vw * (1 - FILL)) / 2, top: (vh * (1 - FILL)) / 2, spanW: vw * FILL, spanH: vh * FILL };
}

/**
 * `cols × rows` window quads on one wall face — the "buildings look lived-in" fix
 * (§4.1). Replaces the old single flat-colour window quad per face. One pane in
 * three is unlit, chosen by `(r*3 + c + variantIndex) % 3 === 0` — deterministic,
 * seeded from the building's own variantIndex, never `Math.random`.
 *
 * ADDENDUM-11 §4.1 "windows fully lit": `fuseTier` widens the modulo divisor
 * (fewer panes land on the unlit remainder) and tier 5 forces every pane lit —
 * a Lv.10 tower reads lit end to end. Recolours existing quads only; pane
 * count/size/position is untouched, so this cannot move the fill metric.
 */
function windowGrid(
  A: Vec,
  B: Vec,
  C: Vec,
  D: Vec,
  cols: number,
  rows: number,
  uBase: number,
  uSpan: number,
  vBase: number,
  vSpan: number,
  palette: Palette,
  variantIndex: number,
  key: string,
  fuseTier = 0,
): ReactNode[] {
  const out: ReactNode[] = [];
  const cellU = uSpan / cols;
  const cellV = vSpan / rows;
  const paneU = cellU * 0.625; // pane narrower than its cell — leaves a mullion gap
  const paneV = cellV * 0.6364;
  const unlitDivisor = 3 + fuseTier; // fuseTier 0 -> %3, byte-identical to pre-fusion behaviour
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = uBase + c * cellU;
      const v0 = vBase + r * cellV;
      const unlit = fuseTier < MAX_FUSE_TIER && (r * 3 + c + variantIndex) % unlitDivisor === 0;
      out.push(
        <polygon
          key={`${key}-${r}-${c}`}
          data-part="window"
          points={pointsAttr(quadPts(A, B, C, D, u0, u0 + paneU, v0, v0 + paneV))}
          fill={unlit ? palette.winDark : palette.win}
        />,
      );
    }
  }
  return out;
}

/**
 * ADDENDUM-08 §7 — footprint in cells (absent === 1x1). The right wall face
 * (`RB`/`RT`) carries the grid-x extent, the left wall face (`LB`/`LT`)
 * carries the grid-y extent — the natural isometric mapping, since a box
 * wider in x only bulges its x-facing (right) side and a box deeper in y
 * only bulges its y-facing (left) side. This is what makes a 2x1 read WIDE,
 * a 1x2 read DEEP/narrow-tall, and a 2x2 read as a genuinely bigger volume
 * instead of the same landmark scale stretched over a bigger box.
 */
interface Footprint {
  w: number;
  h: number;
}

/** The isometric wall-cube skeleton, shared by every category archetype. */
function buildingCube(
  spec: ArchetypeSpec,
  palette: Palette,
  floors: number,
  variantIndex: number,
  isLandmark: boolean,
  footprint: Footprint,
  fuseTier = 0,
) {
  const { roof } = spec;
  const wide = footprint.w > 1;
  const deep = footprint.h > 1;
  const box = artBox(footprint.w, footprint.h);

  // Width: the cube spans the WHOLE box, split between the x-facing (right) and
  // y-facing (left) wall in the footprint's own w:h ratio — so a 2x1 bulges right
  // and reads genuinely wide, a 1x2 bulges left and reads deep, and both still sum
  // to the same total width their tile gives them. (Replaces the old fixed
  // `spec.hw * 1.3 * 1.28` extents, which were sized in absolute view units and so
  // could never track a tile they knew nothing about.)
  const ux = (box.spanW * footprint.w) / (footprint.w + footprint.h);
  const uy = box.spanW - ux;

  // §4.2 + the archetype's own character (transport is wide/low at hw 42 hBase 32,
  // salary narrow/tall at 24/66) survive as a diamond-vs-wall SPLIT of the fixed
  // vertical budget rather than as a silhouette size — the silhouette belongs to
  // the tile now. A squat archetype/landmark gets a deeper ground diamond and
  // shorter walls; a tall one the reverse. Total height is identical either way.
  const squat = clamp(spec.hw / DEFAULT_HW / (spec.hBase / DEFAULT_H), 0.75, 1.3) * (isLandmark ? 1.12 : 1);
  const isoHalf = box.spanW / 4; // a true isometric 2:1 ground diamond
  const hh = clamp(
    Math.min(isoHalf, box.spanH * HH_MAX_SHARE) * squat * Math.max(0.6, 1 - FLOOR_SQUEEZE * floors),
    Math.min(box.spanW / 10, box.spanH * 0.12),
    box.spanH * HH_MAX_SHARE,
  );
  // A pyramid apex rises above the cube's back corner; a flat roof's top IS that
  // corner. Whatever is left of the vertical budget is wall — which is what makes
  // the silhouette land exactly on the box floor and ceiling in both cases.
  const roofRise = roof === "pyramid" ? box.spanH * 0.1 : 0;
  const crown = roof === "pyramid" ? roofRise + RIDGE_R : 0;
  const h = box.spanH - 2 * hh - crown;
  const viewW = box.vw;
  const cx = box.left + uy; // puts LB on the box's left edge and RB on its right
  const cy = box.vh - box.top - hh; // puts FB (front corner) on the box floor

  const FB: Vec = { x: cx, y: cy + hh };
  const RB: Vec = { x: cx + ux, y: cy };
  const LB: Vec = { x: cx - uy, y: cy };
  const FT: Vec = { x: cx, y: cy + hh - h };
  const RT: Vec = { x: cx + ux, y: cy - h };
  const LT: Vec = { x: cx - uy, y: cy - h };
  const BT: Vec = { x: cx, y: cy - hh - h };

  // apex height above the wall top: the back corner (hh) plus the rise, so the
  // roof always reads as a roof no matter how deep the ground diamond got.
  const roofH = hh + roofRise;

  const parts: ReactNode[] = [];

  // Ground shadow — the ellipse inscribed in the ground diamond, nudged forward so
  // it reads as contact shade. It used to sit a further `hh + 6` BELOW the front
  // corner, which cost the art a chunk of its vertical budget for nothing; now its
  // lowest point is exactly the front corner, i.e. the box floor.
  parts.push(
    <ellipse
      key="shadow"
      cx={cx + (ux - uy) / 2}
      cy={cy + hh * 0.28}
      rx={(box.spanW / 2) * 0.98}
      ry={hh * 0.72}
      fill="rgba(90,74,106,0.14)"
    />,
  );

  // ADDENDUM-11 §4.1 "plinth / ground glow" — a second ellipse at the IDENTICAL
  // position/radii as the shadow above, tier-tinted. Reusing the shadow's own
  // extents means this can never move the fill metric: the furthest point it
  // reaches is a point the shadow ellipse (already in the frozen baseline)
  // already reaches.
  if (fuseTier > 0) {
    parts.push(
      <ellipse
        key="fuse-glow"
        data-part="fuse-glow"
        cx={cx + (ux - uy) / 2}
        cy={cy + hh * 0.28}
        rx={(box.spanW / 2) * 0.98}
        ry={hh * 0.72}
        fill={FUSE_TRIM[fuseTier - 1]}
        opacity={0.1 + 0.03 * fuseTier}
      />,
    );
  }

  // walls
  parts.push(<polygon key="wall-left" points={pointsAttr([FB, LB, LT, FT])} fill={palette.left} />);
  parts.push(<polygon key="wall-right" points={pointsAttr([FB, RB, RT, FT])} fill={palette.right} />);

  // level-growth belt lines — one per floor above the first, evenly spread up the wall
  for (let i = 0; i < floors; i++) {
    const v0 = 0.12 + (i * 0.7) / Math.max(floors, 1);
    const v1 = v0 + 0.06;
    parts.push(
      <polygon
        key={`belt-l-${i}`}
        className="building-floor-belt"
        points={pointsAttr(quadPts(FB, LB, LT, FT, 0.05, 0.95, v0, v1))}
        fill="rgba(255,255,255,0.35)"
      />,
    );
    parts.push(
      <polygon
        key={`belt-r-${i}`}
        className="building-floor-belt"
        points={pointsAttr(quadPts(FB, RB, RT, FT, 0.05, 0.95, v0, v1))}
        fill="rgba(0,0,0,0.08)"
      />,
    );
  }

  // windows (left face) — cols x rows grid, rows scale with level (§4.1),
  // cols scale with footprint depth (§7 — a deeper footprint reads denser here)
  const winRows = Math.min(4, 1 + floors);
  const leftCols = deep ? 3 : 2;
  const rightCols = wide ? 3 : 2;
  parts.push(...windowGrid(FB, LB, LT, FT, leftCols, winRows, 0.18, 0.64, 0.34, 0.44, palette, variantIndex, "win-l", fuseTier));

  // door + door windows (right face) — wideDoor widens the door quad
  const doorU1 = spec.decor?.wideDoor ? 0.48 : 0.4;
  parts.push(
    <polygon key="door" data-part="door" points={pointsAttr(quadPts(FB, RB, RT, FT, 0.14, doorU1, 0.02, 0.52))} fill={palette.door} />,
  );
  parts.push(
    <polygon key="lintel" points={pointsAttr(quadPts(FB, RB, RT, FT, 0.2, 0.34, 0.55, 0.6))} fill={colors.yellow200} />,
  );
  // doorstep/stoop — a small slab just outside the threshold, protruding past
  // the wall base (v < 0 extrapolates beyond the FB-RB ground edge on purpose).
  // Scaled off `hh`, not off the wall height: a 1x2 tower's wall is 4x a 1x1's,
  // and a fixed -0.07 of it would push the stoop clean out of the viewBox.
  const doorMidU = (0.14 + doorU1) / 2;
  const stoopV = -(hh * 0.1) / h;
  parts.push(
    <polygon key="stoop" points={pointsAttr(quadPts(FB, RB, RT, FT, doorMidU - 0.09, doorMidU + 0.09, stoopV, 0.02))} fill={palette.roofDark} opacity={0.5} />,
  );
  // right-face window grid starts clear of the door quad (doorU1 max is 0.48)
  const rightWinBase = doorU1 + 0.12;
  parts.push(
    ...windowGrid(FB, RB, RT, FT, rightCols, winRows, rightWinBase, 0.9 - rightWinBase, 0.3, 0.44, palette, variantIndex, "win-r", fuseTier),
  );
  // window sills — a thin ledge right under each face's window band
  parts.push(<polygon key="sill-l" points={pointsAttr(quadPts(FB, LB, LT, FT, 0.15, 0.85, 0.3, 0.335))} fill={palette.roofDark} opacity={0.3} />);
  parts.push(
    <polygon key="sill-r" points={pointsAttr(quadPts(FB, RB, RT, FT, rightWinBase - 0.02, 0.92, 0.26, 0.295))} fill={palette.roofDark} opacity={0.3} />,
  );
  // roof eave — a thin shadow band at the wall/roof seam so the roof reads as its own slab
  parts.push(<polygon key="eave-l" points={pointsAttr(quadPts(FB, LB, LT, FT, 0.0, 1.0, 0.93, 1.0))} fill={palette.roofDark} opacity={0.28} />);
  parts.push(<polygon key="eave-r" points={pointsAttr(quadPts(FB, RB, RT, FT, 0.0, 1.0, 0.93, 1.0))} fill={palette.roofDark} opacity={0.28} />);

  // roof
  if (roof === "pyramid") {
    const apex: Vec = { x: cx, y: cy - h - roofH };
    parts.push(<polygon key="roof-bl" points={pointsAttr([LT, BT, apex])} fill={palette.roofDark} />);
    parts.push(<polygon key="roof-br" points={pointsAttr([RT, BT, apex])} fill={palette.roofDark} />);
    parts.push(<polygon key="roof-fl" points={pointsAttr([LT, FT, apex])} fill={palette.roofLite} />);
    parts.push(<polygon key="roof-fr" points={pointsAttr([RT, FT, apex])} fill={palette.roofMid} />);
    {
      /* ADDENDUM-11 §4.1 "crown / spire ornament" — same node, same position, same
       * radius as the always-present ridge dot; fuseTier only recolours it toward the
       * material step. Zero geometry delta, so it cannot move the fill metric. */
    }
    parts.push(
      <circle key="ridge" cx={apex.x} cy={apex.y} r={RIDGE_R} fill={fuseTier > 0 ? FUSE_RIDGE[fuseTier - 1] : "#ffffff"} opacity={0.85} />,
    );
  } else {
    parts.push(<polygon key="roof-top" points={pointsAttr([FT, RT, BT, LT])} fill={palette.top} />);
    // Flat roofs have no ridge dot to recolour, so fuseTier adds a small accent
    // INSET at the roof plane's own vertical midpoint (cy - h), never at BT (the
    // topmost vertex) — its radius is capped at `hh`, so its top edge can never
    // rise past BT, the point flat-roof buildings already reach at fuseTier 0.
    if (fuseTier > 0) {
      const r = Math.min(RIDGE_R, hh * 0.6) * (0.4 + 0.12 * fuseTier);
      parts.push(
        <circle key="fuse-crown" data-part="fuse-crown" cx={cx + (ux - uy) / 4} cy={cy - h} r={r} fill={FUSE_RIDGE[fuseTier - 1]} opacity={0.85} />,
      );
    }
  }

  const signAnchor: Vec = roof === "pyramid" ? { x: cx, y: cy - h - roofH * 0.42 } : { x: cx, y: cy - h + 8 };

  return { parts, FB, FT, RT, LT, BT, RB, LB, cx, cy, h, hh, ux, uy, viewW, box, roofH, signAnchor };
}

function decorParts(spec: ArchetypeSpec, palette: Palette, geo: ReturnType<typeof buildingCube>): ReactNode[] {
  const d = spec.decor;
  if (!d) return [];
  const out: ReactNode[] = [];
  const { FB, FT, RT, RB, LB, LT, cx, cy, h, hh, ux, uy } = geo;
  const doorU1 = spec.decor?.wideDoor ? 0.48 : 0.4;

  if (d.awning) {
    const a = quadPts(FB, RB, RT, FT, 0.05, 0.25, 0.56, 0.66);
    const b = quadPts(FB, RB, RT, FT, 0.25, 0.45, 0.56, 0.66);
    out.push(<polygon key="awning-a" points={pointsAttr(a)} fill={colors.white} />);
    out.push(<polygon key="awning-b" points={pointsAttr(b)} fill={colors.red400} />);
  }

  if (d.parasol) {
    const px = cx + ux * 0.25;
    const py = cy - h - 26;
    out.push(<ellipse key="parasol-canopy" cx={px} cy={py} rx={12} ry={5} fill={colors.red400} />);
    out.push(<rect key="parasol-pole" x={px - 1} y={py} width={2} height={12} fill={colors.grey600} />);
  }

  if (d.chimney) {
    const cxOff = d.chimney === "side" ? -uy * 0.6 : ux * 0.15;
    const chimX = cx + cxOff;
    // the stack now runs from the wall top to just under the ridge — a fixed 14-tall
    // one would be swallowed whole by a roof that scales with the ground diamond
    const chimTop = cy - h - geo.roofH + 2;
    const chimW = 8 + geo.hh * 0.1;
    out.push(<rect key="chimney" x={chimX - chimW / 2} y={chimTop} width={chimW} height={cy - h - chimTop} fill={colors.grey600} />);
    out.push(<circle key="smoke" cx={chimX} cy={chimTop - 5} r={3.5} fill={colors.grey200} opacity={0.7} />);
  }

  if (d.windowBoxes) {
    const box = quadPts(FB, LB, LT, FT, 0.32, 0.58, 0.36, 0.41);
    out.push(<polygon key="window-box" points={pointsAttr(box)} fill={colors.green600} />);
  }

  if (d.marquee) {
    const band = quadPts(FB, RB, RT, FT, 0.05, 0.95, 0.58, 0.68);
    out.push(<polygon key="marquee" points={pointsAttr(band)} fill={colors.yellow400} />);
    for (let i = 0; i < 3; i++) {
      const p = bil(FB, RB, RT, FT, 0.2 + i * 0.25, 0.63);
      out.push(<circle key={`bulb-${i}`} cx={p.x} cy={p.y} r={1.4} fill={colors.white} />);
    }
  }

  if (d.ticketWindow) {
    const win = quadPts(FB, LB, LT, FT, 0.15, 0.32, 0.2, 0.36);
    out.push(<polygon key="ticket-window" points={pointsAttr(win)} fill={colors.grey50} />);
  }

  if (d.cross) {
    const vBar = quadPts(FB, RB, RT, FT, 0.46, 0.54, 0.58, 0.86);
    const barH = quadPts(FB, RB, RT, FT, 0.38, 0.62, 0.68, 0.76);
    out.push(<polygon key="cross-v" points={pointsAttr(vBar)} fill={colors.red500} />);
    out.push(<polygon key="cross-h" points={pointsAttr(barH)} fill={colors.red500} />);
  }

  if (d.columns) {
    const colA = quadPts(FB, RB, RT, FT, 0.04, 0.11, 0.03, 0.5);
    const colB = quadPts(FB, RB, RT, FT, 0.43, 0.5, 0.03, 0.5);
    out.push(<polygon key="col-a" points={pointsAttr(colA)} fill={palette.roofLite} />);
    out.push(<polygon key="col-b" points={pointsAttr(colB)} fill={palette.roofLite} />);
  }

  if (d.foodDisplay) {
    const bx = cx - ux * 0.4;
    const by = cy + hh * 0.45;
    out.push(<ellipse key="dish" cx={bx} cy={by} rx={6} ry={3} fill={colors.white} stroke={palette.roofDark} strokeWidth={0.8} />);
    out.push(<circle key="dish-a" cx={bx - 1.6} cy={by - 0.8} r={1.2} fill={colors.orange500} />);
    out.push(<circle key="dish-b" cx={bx + 1.6} cy={by - 0.8} r={1.2} fill={colors.red400} />);
  }

  if (d.cafeTable) {
    const tx = cx + ux * 0.42;
    const ty = cy + hh * 0.5;
    out.push(<rect key="table-top" x={tx - 5} y={ty - 1} width={10} height={2} fill={colors.grey600} />);
    out.push(<line key="table-leg" x1={tx} y1={ty + 1} x2={tx} y2={ty + 6} stroke={colors.grey600} strokeWidth={1.2} />);
    out.push(<circle key="cup" cx={tx - 3} cy={ty - 3} r={1.6} fill={colors.white} stroke={palette.roofDark} strokeWidth={0.6} />);
  }

  if (d.displayWindow) {
    const win = quadPts(FB, LB, LT, FT, 0.14, 0.34, 0.2, 0.4);
    out.push(<polygon key="display-window" points={pointsAttr(win)} fill={colors.grey50} stroke={palette.roofDark} strokeWidth={0.6} />);
    const g1 = bil(FB, LB, LT, FT, 0.2, 0.28);
    const g2 = bil(FB, LB, LT, FT, 0.28, 0.3);
    out.push(<rect key="goods-a" x={g1.x - 1.5} y={g1.y - 3} width={3} height={4} fill={colors.purple400} />);
    out.push(<circle key="goods-b" cx={g2.x} cy={g2.y - 2} r={1.6} fill={colors.yellow400} />);
  }

  if (d.archEntrance) {
    const doorTopL = bil(FB, RB, RT, FT, 0.14, 0.52);
    const doorTopR = bil(FB, RB, RT, FT, doorU1, 0.52);
    const midX = (doorTopL.x + doorTopR.x) / 2;
    const topY = Math.min(doorTopL.y, doorTopR.y) - 5;
    out.push(
      <path
        key="arch"
        d={`M ${doorTopL.x.toFixed(1)} ${doorTopL.y.toFixed(1)} Q ${midX.toFixed(1)} ${topY.toFixed(1)} ${doorTopR.x.toFixed(1)} ${doorTopR.y.toFixed(1)} Z`}
        fill={palette.roofLite}
      />,
    );
  }

  if (d.canopy) {
    // ±0.03, not the old ±0.05: `ux` is now tile-sized, and on a 2x1 a 5% overhang
    // past RB is wider than the box's whole overhang margin (the svg would clip it)
    const band = quadPts(FB, RB, RT, FT, -0.03, 1.03, 0.92, 1.0);
    out.push(<polygon key="canopy" points={pointsAttr(band)} fill={palette.roofDark} opacity={0.85} />);
  }

  if (d.porch) {
    const roofBand = quadPts(FB, RB, RT, FT, 0.08, 0.46, 0.6, 0.66);
    out.push(<polygon key="porch-roof" points={pointsAttr(roofBand)} fill={palette.roofMid} />);
    const p1 = bil(FB, RB, RT, FT, 0.1, 0.6);
    const p2 = bil(FB, RB, RT, FT, 0.44, 0.6);
    out.push(<line key="porch-post-a" x1={p1.x} y1={p1.y} x2={p1.x} y2={p1.y + 8} stroke={palette.roofDark} strokeWidth={1} />);
    out.push(<line key="porch-post-b" x1={p2.x} y1={p2.y} x2={p2.x} y2={p2.y + 8} stroke={palette.roofDark} strokeWidth={1} />);
  }

  if (d.posterBoards) {
    const p1 = quadPts(FB, LB, LT, FT, 0.42, 0.52, 0.22, 0.34);
    const p2 = quadPts(FB, LB, LT, FT, 0.55, 0.65, 0.22, 0.34);
    out.push(<polygon key="poster-a" points={pointsAttr(p1)} fill={colors.yellow200} />);
    out.push(<polygon key="poster-b" points={pointsAttr(p2)} fill={colors.blue200} />);
  }

  if (d.clock) {
    const p = geo.signAnchor;
    out.push(<circle key="clock" cx={p.x} cy={p.y + 20} r={6} fill={colors.white} stroke={colors.grey600} strokeWidth={1} />);
    out.push(<line key="clock-h" x1={p.x} y1={p.y + 20} x2={p.x} y2={p.y + 16} stroke={colors.grey700} strokeWidth={1} />);
    out.push(<line key="clock-m" x1={p.x} y1={p.y + 20} x2={p.x + 3} y2={p.y + 20} stroke={colors.grey700} strokeWidth={1} />);
  }

  if (d.flag) {
    const p = geo.signAnchor;
    const poleTop = p.y - 16;
    out.push(<line key="flag-pole" x1={p.x} y1={p.y} x2={p.x} y2={poleTop} stroke={colors.grey700} strokeWidth={1.5} />);
    out.push(<polygon key="flag" points={pointsAttr([{ x: p.x, y: poleTop }, { x: p.x + 8, y: poleTop + 3 }, { x: p.x, y: poleTop + 6 }])} fill={colors.red400} />);
  }

  if (d.bunting) {
    for (let i = 0; i < 4; i++) {
      const p = bil({ x: cx, y: cy + hh }, RB, RT, FT, 0.1 + i * 0.22, 1.0);
      out.push(
        <polygon
          key={`bunting-${i}`}
          points={pointsAttr([{ x: p.x - 3, y: p.y }, { x: p.x + 3, y: p.y }, { x: p.x, y: p.y + 6 }])}
          fill={i % 2 === 0 ? colors.red400 : colors.blue400}
        />,
      );
    }
  }

  if (d.ribbon) {
    const vBand = quadPts({ x: cx, y: cy + hh }, RB, RT, FT, 0.44, 0.56, 0.02, 0.6);
    out.push(<polygon key="ribbon-v" points={pointsAttr(vBand)} fill={colors.red500} />);
    const bowY = cy - h - 4;
    out.push(<circle key="bow" cx={cx} cy={bowY} r={5} fill={colors.red500} />);
  }

  if (d.routeStripe) {
    const band = quadPts({ x: cx, y: cy + hh }, RB, RT, FT, 0.05, 0.95, 0.15, 0.28);
    out.push(<polygon key="route-stripe" points={pointsAttr(band)} fill={colors.white} />);
  }

  return out;
}

/**
 * Two posts + a rounded plate + the archetype's glyph at 22px — the oversized
 * roof ornament landmarks get instead of the bare emoji (§4.3). Applied
 * uniformly to every landmark archetype and to any building promoted to
 * landmark rendering by level. `big` (ADDENDUM-08 §7 — a genuine 2x2
 * footprint) scales the plate up further and adds a small cap above it, so a
 * 2x2 landmark's roof ornament reads as bigger than a 1x1 landmark's, not
 * just the same signboard on a wider box.
 */
function roofSignboard(spec: ArchetypeSpec, palette: Palette, geo: ReturnType<typeof buildingCube>, big: boolean): ReactNode[] {
  const { signAnchor } = geo;
  const plateW = big ? 56 : 44;
  const plateH = big ? 22 : 18;
  const plateCx = signAnchor.x;
  // clamped to the box ceiling: on a flat roof the plate hangs 14+plateH/2 above the
  // roof deck, which used to be free space and is now the top of the art
  const plateCy = Math.max(signAnchor.y - 14, geo.box.top + plateH / 2 + (big ? 5 : 0));
  const plateTop = plateCy - plateH / 2;
  const plateBottom = plateCy + plateH / 2;
  const out: ReactNode[] = [
    <line key="post-l" x1={plateCx - 10} y1={plateBottom} x2={plateCx - 10} y2={signAnchor.y} stroke={palette.roofDark} strokeWidth={2} />,
    <line key="post-r" x1={plateCx + 10} y1={plateBottom} x2={plateCx + 10} y2={signAnchor.y} stroke={palette.roofDark} strokeWidth={2} />,
    <rect
      key="plate"
      data-part="signboard"
      x={plateCx - plateW / 2}
      y={plateTop}
      width={plateW}
      height={plateH}
      rx={3}
      fill={palette.roofLite}
      stroke={palette.roofDark}
    />,
    <text key="plate-sign" x={plateCx} y={plateCy + 7} fontSize={big ? 26 : 22} textAnchor="middle">
      {spec.sign}
    </text>,
  ];
  // three marquee bulbs along the plate's bottom edge — the same trick d.marquee already uses
  for (let i = 0; i < 3; i++) {
    out.push(<circle key={`bulb-${i}`} cx={plateCx - 12 + i * 12} cy={plateBottom} r={1.2} fill={colors.white} />);
  }
  // 2x2 landmark cap — a small parapet block above the plate, the "extra roof
  // structure" ADDENDUM-08 §7 asks for on genuinely bigger buildings.
  if (big) {
    out.push(<rect key="cap" x={plateCx - 6} y={plateTop - 5} width={12} height={5} fill={palette.roofDark} />);
  }
  return out;
}

/**
 * F15 무지출 데이 — a park, not a building: trees + a bench. Kept the most distinct
 * tile. Laid out from `artBox` like the cube is: the lawn is the ground diamond's
 * inscribed ellipse spanning the box's full width, and the first (tallest) tree
 * reaches the box ceiling — so a park fills its cell the same way a building does
 * instead of being the one tile that still floats.
 */
function ParkArt({ variantIndex, w, h }: { variantIndex: number; w: number; h: number }) {
  const box = artBox(w, h);
  const hh = Math.min(box.spanW / 4, box.spanH * HH_MAX_SHARE);
  const cx = box.vw / 2;
  const cy = box.vh - box.top - hh; // lawn centre — its front edge lands on the box floor
  const treeCount = 2 + (variantIndex % 2); // 2 or 3 trees for a little variety
  const trunks = colors.orange700;
  const canopy = [colors.green500, colors.green600, colors.green400];
  const trees = Array.from({ length: treeCount }, (_, i) => {
    const x = box.left + (box.spanW * (i + 0.5)) / treeCount;
    const base = cy + hh * (i % 2 === 0 ? 0.25 : -0.15);
    const tall = (base - box.top) * (i === 0 ? 1 : 0.78 - (i - 1) * 0.12);
    const r = tall * 0.34;
    return (
      <g key={i}>
        <rect x={x - r * 0.14} y={base - tall + r} width={r * 0.28} height={tall - r} fill={trunks} />
        <circle cx={x} cy={base - tall + r} r={r} fill={canopy[i % canopy.length]} />
      </g>
    );
  });
  const benchW = box.spanW * 0.18;
  const benchY = cy + hh * 0.42;
  return (
    <svg viewBox={`0 0 ${box.vw} ${box.vh}`} width="100%" height="100%" data-archetype="park" aria-hidden="true">
      <ellipse cx={cx} cy={cy} rx={box.spanW / 2} ry={hh} fill={colors.green100} />
      {trees}
      <rect x={cx - benchW / 2} y={benchY} width={benchW} height={hh * 0.12} fill={colors.orange700} />
      <rect x={cx - benchW * 0.42} y={benchY + hh * 0.12} width={hh * 0.08} height={hh * 0.22} fill={colors.orange700} />
      <rect x={cx + benchW * 0.34} y={benchY + hh * 0.12} width={hh * 0.08} height={hh * 0.22} fill={colors.orange700} />
    </svg>
  );
}

/**
 * F16 — a monument: obelisk + engraved plaque. Never grows, never uses the cube
 * renderer. The obelisk alone is far narrower than any cell, so it now stands on a
 * full-width isometric stone plinth: the monument occupies its whole footprint
 * (2x2 monuments exist — `rollFootprint` applies to every building) while the shaft
 * keeps its own slender proportions. Plinth front edge on the box floor, tip on the
 * box ceiling. The engraved YYYY-MM plaque is unchanged and still absolute-sized, so
 * the label renders at exactly the pixel size it does today.
 */
function MonumentArt({ monumentPeriod, w, h }: { monumentPeriod?: string; w: number; h: number }) {
  const box = artBox(w, h);
  const stone = colors.grey500;
  const stoneDark = colors.grey700;
  const stoneLite = colors.grey300;
  const halfW = box.spanW / 2;
  const hh = Math.min(box.spanW / 4, box.spanH * HH_MAX_SHARE);
  const plinthH = Math.min(hh * 0.5, box.spanH * 0.08);
  const cx = box.vw / 2;
  const cy = box.vh - box.top - hh - plinthH; // plinth top-face centre
  const F = { x: cx, y: cy + hh };
  const R = { x: cx + halfW, y: cy };
  const B = { x: cx, y: cy - hh };
  const L = { x: cx - halfW, y: cy };
  const drop = (p: Vec): Vec => ({ x: p.x, y: p.y + plinthH });
  const baseHalf = Math.max(halfW * 0.26, 18);
  const shaftHalf = baseHalf * 0.55;
  const tip = { x: cx, y: box.top };
  const shoulderY = tip.y + (cy - tip.y) * 0.16;
  return (
    <svg viewBox={`0 0 ${box.vw} ${box.vh}`} width="100%" height="100%" data-archetype="monument" aria-hidden="true">
      <polygon points={pointsAttr([L, F, drop(F), drop(L)])} fill={stoneDark} />
      <polygon points={pointsAttr([F, R, drop(R), drop(F)])} fill={stone} />
      <polygon points={pointsAttr([F, R, B, L])} fill={stoneLite} />
      <polygon points={pointsAttr([{ x: cx - shaftHalf, y: shoulderY }, { x: cx - baseHalf, y: cy }, { x: cx, y: cy }, tip])} fill={stoneDark} />
      <polygon points={pointsAttr([{ x: cx + shaftHalf, y: shoulderY }, { x: cx + baseHalf, y: cy }, { x: cx, y: cy }, tip])} fill={stoneLite} />
      <polygon points={pointsAttr([{ x: cx - shaftHalf, y: shoulderY }, tip, { x: cx + shaftHalf, y: shoulderY }, { x: cx, y: shoulderY + 6 }])} fill={stone} />
      <rect x={cx - 16} y={cy - 28} width={32} height={20} rx={2} fill={colors.grey100} stroke={colors.grey400} />
      {monumentPeriod && (
        <text x={cx} y={cy - 15} fontSize={9} textAnchor="middle" fill={colors.grey800}>
          {monumentPeriod}
        </text>
      )}
    </svg>
  );
}

export interface BuildingArtProps {
  categoryId: BuildingCategoryId | null;
  variantIndex: number;
  level: number;
  monumentPeriod?: string;
  /** ADDENDUM-08 §7 — the building's footprint in cells (absent === 1x1). A footprint > 1 cell always gets the landmark treatment (broader/squatter + roof signboard) so a 2x2 reads as a deliberately bigger structure, not a 1x1 sprite stretched to fill a larger box. */
  w?: number;
  h?: number;
  /**
   * ADDENDUM-11 §4.1 — fuse tier (0-5), a visual channel independent of `level`.
   * Absent/0 renders BYTE-IDENTICALLY to pre-fusion art (§4.0/§4.1's whole
   * compatibility story). `level` still drives floor count/wall height exactly
   * as before and stays clamped at `MAX_VISUAL_LEVEL` — fuseTier never touches
   * geometry, only roof/trim material, window lighting, and a ground glow.
   */
  fuseTier?: number;
}

/**
 * Resolves a category to the archetype string it renders as — exported for tests/debugging.
 *
 * eslint-disable-next-line react-refresh/only-export-components: this sits beside
 * `BuildingArt` on purpose. The mapping and the art it selects are one decision,
 * and splitting them into two files to satisfy a dev-only fast-refresh heuristic
 * would let the table and the shapes drift apart. Fast refresh degrades to a full
 * reload for this module; that is the whole cost.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function archetypeFor(categoryId: BuildingCategoryId | null, monumentPeriod?: string): string {
  if (monumentPeriod) return "monument";
  if (categoryId === "park") return "park";
  if (categoryId === null) return "monument";
  // Savings never reach here (they raise a SavingsRow structure, not a Building);
  // the guard is what proves the lookup below is total.
  if (!hasArchetype(categoryId)) return "monument";
  return ARCHETYPES[categoryId].archetype;
}

/** Inline SVG building/park/monument art. `width/height: 100%` with the default
 * `preserveAspectRatio="xMidYMid meet"`, and a viewBox carrying the footprint's own TILE
 * aspect (`artBox`) — so `meet` has no slack to centre away and the art fills the cell in
 * BOTH axes, at one rendered scale shared by every footprint. See `artBox` for why the box
 * aspect and the cube's re-derived extents had to change together. */
export function BuildingArt({ categoryId, variantIndex, level, monumentPeriod, w = 1, h = 1, fuseTier }: BuildingArtProps) {
  if (monumentPeriod || categoryId === null) {
    return <MonumentArt monumentPeriod={monumentPeriod} w={w} h={h} />;
  }
  if (categoryId === "park") {
    return <ParkArt variantIndex={variantIndex} w={w} h={h} />;
  }
  if (!hasArchetype(categoryId)) {
    return <MonumentArt monumentPeriod={monumentPeriod} w={w} h={h} />;
  }

  const spec = ARCHETYPES[categoryId];
  const fuse = clampFuseTier(fuseTier);
  const palette = withFuseMaterial(paletteFor(spec.hue, variantIndex, spec.whiteWalls), fuse);
  const floors = floorsFor(level);
  // §4.2: landmark archetypes render wide/squat always; any building also gets
  // promoted at level >= 4 ("placement + growth reads on screen") or by
  // occupying a multi-cell footprint (ADDENDUM-08 §7 — a 2x2 must read as a
  // deliberately bigger building, not a 1x1 sprite stretched into a big box).
  const isLandmark = !!spec.landmark || level >= 4 || w * h > 1;
  const geo = buildingCube(spec, palette, floors, variantIndex, isLandmark, { w, h }, fuse);
  const decor = decorParts(spec, palette, geo);
  const big2x2 = w === 2 && h === 2;

  return (
    <svg
      viewBox={`0 0 ${geo.viewW} ${geo.box.vh}`}
      width="100%"
      height="100%"
      data-archetype={spec.archetype}
      data-fuse-tier={fuse || undefined}
      aria-hidden="true"
    >
      {geo.parts}
      {decor}
      {isLandmark ? (
        roofSignboard(spec, palette, geo, big2x2)
      ) : (
        <text x={geo.signAnchor.x} y={geo.signAnchor.y + 8} fontSize={16} textAnchor="middle">
          {spec.sign}
        </text>
      )}
    </svg>
  );
}
