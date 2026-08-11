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
const FLOOR_STEP = 9;
const VIEW_W = 120;
const VIEW_H = 176;
const CX = 60;
const CY = 142;

function floorsFor(level: number): number {
  return Math.max(0, Math.min(level, MAX_VISUAL_LEVEL) - 1);
}

/**
 * Footprint-differentiation fix (visual verification: 2x1 scored 2/5 — it rendered
 * only +67% wider than 1x1 despite occupying a tile more than double the width).
 * Root cause: `preserveAspectRatio="meet"`'s scale is `min(tileW/VIEW_W, tileH/VIEW_H)`.
 * Every footprint with h=1 has a 40px-tall tile, so `40/176=0.227` always binds —
 * widening the cube inside a FIXED-width viewBox can't widen the rendered pixels
 * proportionally, and risks clipping past VIEW_W.
 *
 * Only footprints wider than they are deep (2x1, not 1x1/1x2/2x2) get a wider
 * viewBox — `w > h` is false for all three currently-passing cases, so this
 * returns the untouched base width for them (proof: `120 * (w/h) === 120` only
 * when w===h, and the `w > h` guard skips the formula entirely for 1x2 where
 * w<h). VIEW_H stays fixed on purpose — that keeps the height-bound scale
 * (and therefore the approved 1x1 vertical proportions) unchanged.
 */
function viewWidthFor(w: number, h: number): number {
  return w > h ? VIEW_W * (w / h) : VIEW_W;
}

/**
 * `cols × rows` window quads on one wall face — the "buildings look lived-in" fix
 * (§4.1). Replaces the old single flat-colour window quad per face. One pane in
 * three is unlit, chosen by `(r*3 + c + variantIndex) % 3 === 0` — deterministic,
 * seeded from the building's own variantIndex, never `Math.random`.
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
): ReactNode[] {
  const out: ReactNode[] = [];
  const cellU = uSpan / cols;
  const cellV = vSpan / rows;
  const paneU = cellU * 0.625; // pane narrower than its cell — leaves a mullion gap
  const paneV = cellV * 0.6364;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = uBase + c * cellU;
      const v0 = vBase + r * cellV;
      const unlit = (r * 3 + c + variantIndex) % 3 === 0;
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
function buildingCube(spec: ArchetypeSpec, palette: Palette, floors: number, variantIndex: number, isLandmark: boolean, footprint: Footprint) {
  const { roof } = spec;
  const wide = footprint.w > 1;
  const deep = footprint.h > 1;
  // §4.2: a landmark is broader + squatter than its neighbours inside the same tile.
  const landmarkMult = isLandmark ? 1.3 : 1;
  // right face (x-facing) extent. `w>h` (2x1, not 2x2 where w===h) swaps the
  // flat 1.28x "wide" bump for the actual w:h ratio, so a 2x1 stretches ~2x —
  // 1x1/1x2/2x2 all have w<=h and fall through to the untouched 1x/1.28x path.
  const wideMult = wide ? (footprint.w > footprint.h ? footprint.w / footprint.h : 1.28) : 1;
  const ux = spec.hw * landmarkMult * wideMult;
  const uy = spec.hw * landmarkMult * (deep ? 1.28 : 1); // left face (y-facing) extent
  let hBase = isLandmark ? spec.hBase * 0.82 : spec.hBase;
  if (wide && deep) hBase *= 1.18; // 2x2 must read as genuinely bigger, not just wide+squat
  const h = hBase + floors * FLOOR_STEP;
  const hh = (ux + uy) / 4;
  const viewW = viewWidthFor(footprint.w, footprint.h);
  const cx = viewW / 2;
  const cy = CY;

  const FB: Vec = { x: cx, y: cy + hh };
  const RB: Vec = { x: cx + ux, y: cy };
  const LB: Vec = { x: cx - uy, y: cy };
  const FT: Vec = { x: cx, y: cy + hh - h };
  const RT: Vec = { x: cx + ux, y: cy - h };
  const LT: Vec = { x: cx - uy, y: cy - h };
  const BT: Vec = { x: cx, y: cy - hh - h };

  const roofH = roof === "pyramid" ? 22 : 10;

  const parts: ReactNode[] = [];

  // ground shadow
  parts.push(
    <ellipse key="shadow" cx={cx} cy={cy + hh + 6} rx={Math.max(ux, uy) * 1.02} ry={hh * 0.7} fill="rgba(90,74,106,0.14)" />,
  );

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
  parts.push(...windowGrid(FB, LB, LT, FT, leftCols, winRows, 0.18, 0.64, 0.34, 0.44, palette, variantIndex, "win-l"));

  // door + door windows (right face) — wideDoor widens the door quad
  const doorU1 = spec.decor?.wideDoor ? 0.48 : 0.4;
  parts.push(
    <polygon key="door" data-part="door" points={pointsAttr(quadPts(FB, RB, RT, FT, 0.14, doorU1, 0.02, 0.52))} fill={palette.door} />,
  );
  parts.push(
    <polygon key="lintel" points={pointsAttr(quadPts(FB, RB, RT, FT, 0.2, 0.34, 0.55, 0.6))} fill={colors.yellow200} />,
  );
  // doorstep/stoop — a small slab just outside the threshold, protruding past
  // the wall base (v < 0 extrapolates beyond the FB-RB ground edge on purpose)
  const doorMidU = (0.14 + doorU1) / 2;
  parts.push(
    <polygon key="stoop" points={pointsAttr(quadPts(FB, RB, RT, FT, doorMidU - 0.09, doorMidU + 0.09, -0.07, 0.02))} fill={palette.roofDark} opacity={0.5} />,
  );
  // right-face window grid starts clear of the door quad (doorU1 max is 0.48)
  const rightWinBase = doorU1 + 0.12;
  parts.push(
    ...windowGrid(FB, RB, RT, FT, rightCols, winRows, rightWinBase, 0.9 - rightWinBase, 0.3, 0.44, palette, variantIndex, "win-r"),
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
    parts.push(<circle key="ridge" cx={apex.x} cy={apex.y} r={3.5} fill="#ffffff" opacity={0.85} />);
  } else {
    parts.push(<polygon key="roof-top" points={pointsAttr([FT, RT, BT, LT])} fill={palette.top} />);
  }

  const signAnchor: Vec = roof === "pyramid" ? { x: cx, y: cy - h - roofH * 0.42 } : { x: cx, y: cy - h + 8 };

  return { parts, FB, FT, RT, LT, BT, RB, LB, cx, cy, h, hh, ux, uy, viewW, signAnchor };
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
    const chimY = cy - h - 8;
    out.push(<rect key="chimney" x={chimX - 4} y={chimY - 14} width={8} height={14} fill={colors.grey600} />);
    out.push(<circle key="smoke" cx={chimX} cy={chimY - 20} r={4} fill={colors.grey200} opacity={0.7} />);
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
    const band = quadPts(FB, RB, RT, FT, -0.05, 1.05, 0.92, 1.0);
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
  const plateCy = signAnchor.y - 14;
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

/** F15 무지출 데이 — a park, not a building: trees + a bench. Kept the most distinct tile. */
function ParkArt({ variantIndex }: { variantIndex: number }) {
  const treeCount = 2 + (variantIndex % 2); // 2 or 3 trees for a little variety
  const trunks = colors.orange700;
  const canopy = [colors.green500, colors.green600, colors.green400];
  const trees = Array.from({ length: treeCount }, (_, i) => {
    const x = 30 + i * (60 / Math.max(treeCount - 1, 1));
    const y = 150 - (i % 2) * 10;
    const r = 16 - i * 2;
    return (
      <g key={i}>
        <rect x={x - 2} y={y - 4} width={4} height={16} fill={trunks} />
        <circle cx={x} cy={y - r} r={r} fill={canopy[i % canopy.length]} />
      </g>
    );
  });
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="100%" data-archetype="park" aria-hidden="true">
      <ellipse cx={CX} cy={158} rx={44} ry={14} fill={colors.green100} />
      {trees}
      <rect x={CX - 14} y={150} width={28} height={5} fill={colors.orange700} />
      <rect x={CX - 12} y={155} width={3} height={8} fill={colors.orange700} />
      <rect x={CX + 9} y={155} width={3} height={8} fill={colors.orange700} />
    </svg>
  );
}

/** F16 — a monument: obelisk + engraved plaque. Never grows, never uses the cube renderer. */
function MonumentArt({ monumentPeriod }: { monumentPeriod?: string }) {
  const stone = colors.grey500;
  const stoneDark = colors.grey700;
  const stoneLite = colors.grey300;
  const top = { x: CX, y: 40 };
  const topL = { x: CX - 10, y: 56 };
  const topR = { x: CX + 10, y: 56 };
  const baseL = { x: CX - 18, y: 140 };
  const baseR = { x: CX + 18, y: 140 };
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="100%" data-archetype="monument" aria-hidden="true">
      <ellipse cx={CX} cy={148} rx={30} ry={9} fill="rgba(90,74,106,0.14)" />
      <polygon points={pointsAttr([topL, baseL, { x: CX, y: 140 }, top])} fill={stoneDark} />
      <polygon points={pointsAttr([topR, baseR, { x: CX, y: 140 }, top])} fill={stoneLite} />
      <polygon points={pointsAttr([topL, top, topR, { x: CX, y: 62 }])} fill={stone} />
      <rect x={CX - 16} y={118} width={32} height={20} rx={2} fill={colors.grey100} stroke={colors.grey400} />
      {monumentPeriod && (
        <text x={CX} y={131} fontSize={9} textAnchor="middle" fill={colors.grey800}>
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

/** Inline SVG building/park/monument art. `width/height: 100%` — never clips regardless of
 * tile size (52/56/64/72px all verified: `preserveAspectRatio`'s default `meet` always fits
 * the whole viewBox inside the box). The viewBox width is fixed at 120 EXCEPT for footprints
 * wider than they are deep (2x1), where `viewWidthFor` widens it proportionally so the cube's
 * extra width isn't clipped and can actually render wider (see `viewWidthFor` for why). */
export function BuildingArt({ categoryId, variantIndex, level, monumentPeriod, w = 1, h = 1 }: BuildingArtProps) {
  if (monumentPeriod || categoryId === null) {
    return <MonumentArt monumentPeriod={monumentPeriod} />;
  }
  if (categoryId === "park") {
    return <ParkArt variantIndex={variantIndex} />;
  }
  if (!hasArchetype(categoryId)) {
    return <MonumentArt monumentPeriod={monumentPeriod} />;
  }

  const spec = ARCHETYPES[categoryId];
  const palette = paletteFor(spec.hue, variantIndex, spec.whiteWalls);
  const floors = floorsFor(level);
  // §4.2: landmark archetypes render wide/squat always; any building also gets
  // promoted at level >= 4 ("placement + growth reads on screen") or by
  // occupying a multi-cell footprint (ADDENDUM-08 §7 — a 2x2 must read as a
  // deliberately bigger building, not a 1x1 sprite stretched into a big box).
  const isLandmark = !!spec.landmark || level >= 4 || w * h > 1;
  const geo = buildingCube(spec, palette, floors, variantIndex, isLandmark, { w, h });
  const decor = decorParts(spec, palette, geo);
  const big2x2 = w === 2 && h === 2;

  return (
    <svg viewBox={`0 0 ${geo.viewW} ${VIEW_H}`} width="100%" height="100%" data-archetype={spec.archetype} aria-hidden="true">
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
