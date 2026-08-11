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
  food: { archetype: "restaurant", hue: "orange", roof: "flat", sign: "🍚", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { awning: true } },
  cafe: { archetype: "cafe", hue: "orange", roof: "pyramid", sign: "☕", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { parasol: true } },
  transport: { archetype: "transport", hue: "blue", roof: "flat", sign: "🚌", hw: 42, hBase: 32, decor: { routeStripe: true }, landmark: true },
  shopping: { archetype: "shop", hue: "purple", roof: "flat", sign: "🛍️", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { awning: true } },
  living: { archetype: "townhouse", hue: "teal", roof: "pyramid", sign: "🏠", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { chimney: "back", windowBoxes: true } },
  health: { archetype: "clinic", hue: "red", roof: "flat", sign: "✚", hw: DEFAULT_HW, hBase: DEFAULT_H, whiteWalls: true },
  culture: { archetype: "cinema", hue: "purple", roof: "flat", sign: "🎬", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { marquee: true, ticketWindow: true }, landmark: true },
  education: { archetype: "school", hue: "blue", roof: "pyramid", sign: "📚", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { clock: true, flag: true } },
  social: { archetype: "hall", hue: "yellow", roof: "flat", sign: "🎁", hw: DEFAULT_HW, hBase: DEFAULT_H, decor: { bunting: true, wideDoor: true }, landmark: true },
  etc: { archetype: "cottage", hue: "grey", roof: "pyramid", sign: "✳️", hw: DEFAULT_HW, hBase: DEFAULT_H },
  salary: { archetype: "office", hue: "green", roof: "flat", sign: "💼", hw: 24, hBase: 66, landmark: true },
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

/** The isometric wall-cube skeleton, shared by every category archetype. */
function buildingCube(spec: ArchetypeSpec, palette: Palette, floors: number, variantIndex: number, isLandmark: boolean) {
  const { roof } = spec;
  // §4.2: a landmark is broader + squatter than its neighbours inside the same tile.
  const hw = isLandmark ? spec.hw * 1.3 : spec.hw;
  const hBase = isLandmark ? spec.hBase * 0.82 : spec.hBase;
  const h = hBase + floors * FLOOR_STEP;
  const hh = hw / 2;
  const cx = CX;
  const cy = CY;

  const FB: Vec = { x: cx, y: cy + hh };
  const RB: Vec = { x: cx + hw, y: cy };
  const LB: Vec = { x: cx - hw, y: cy };
  const FT: Vec = { x: cx, y: cy + hh - h };
  const RT: Vec = { x: cx + hw, y: cy - h };
  const LT: Vec = { x: cx - hw, y: cy - h };
  const BT: Vec = { x: cx, y: cy - hh - h };

  const roofH = roof === "pyramid" ? 22 : 10;

  const parts: ReactNode[] = [];

  // ground shadow
  parts.push(
    <ellipse key="shadow" cx={cx} cy={cy + hh + 6} rx={hw * 1.02} ry={hh * 0.7} fill="rgba(90,74,106,0.14)" />,
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

  // windows (left face) — cols x rows grid, rows scale with level (§4.1)
  const winRows = Math.min(4, 1 + floors);
  parts.push(...windowGrid(FB, LB, LT, FT, 2, winRows, 0.18, 0.64, 0.34, 0.44, palette, variantIndex, "win-l"));

  // door + door windows (right face) — wideDoor widens the door quad
  const doorU1 = spec.decor?.wideDoor ? 0.48 : 0.4;
  parts.push(
    <polygon key="door" data-part="door" points={pointsAttr(quadPts(FB, RB, RT, FT, 0.14, doorU1, 0.02, 0.52))} fill={palette.door} />,
  );
  parts.push(
    <polygon key="lintel" points={pointsAttr(quadPts(FB, RB, RT, FT, 0.2, 0.34, 0.55, 0.6))} fill={colors.yellow200} />,
  );
  // right-face window grid starts clear of the door quad (doorU1 max is 0.48)
  const rightWinBase = doorU1 + 0.12;
  parts.push(
    ...windowGrid(FB, RB, RT, FT, 2, winRows, rightWinBase, 0.9 - rightWinBase, 0.3, 0.44, palette, variantIndex, "win-r"),
  );

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

  return { parts, FT, RT, LT, BT, RB, cx, cy, h, hh, hw, signAnchor };
}

function decorParts(spec: ArchetypeSpec, geo: ReturnType<typeof buildingCube>): ReactNode[] {
  const d = spec.decor;
  if (!d) return [];
  const out: ReactNode[] = [];
  const { FT, RT, RB, cx, cy, h, hh, hw } = geo;

  if (d.awning) {
    const a = quadPts({ x: cx, y: cy + hh }, RB, RT, FT, 0.05, 0.25, 0.56, 0.66);
    const b = quadPts({ x: cx, y: cy + hh }, RB, RT, FT, 0.25, 0.45, 0.56, 0.66);
    out.push(<polygon key="awning-a" points={pointsAttr(a)} fill={colors.white} />);
    out.push(<polygon key="awning-b" points={pointsAttr(b)} fill={colors.red400} />);
  }

  if (d.parasol) {
    const px = cx + hw * 0.25;
    const py = cy - h - 26;
    out.push(<ellipse key="parasol-canopy" cx={px} cy={py} rx={12} ry={5} fill={colors.red400} />);
    out.push(<rect key="parasol-pole" x={px - 1} y={py} width={2} height={12} fill={colors.grey600} />);
  }

  if (d.chimney) {
    const cxOff = d.chimney === "side" ? -hw * 0.6 : hw * 0.15;
    const chimX = cx + cxOff;
    const chimY = cy - h - 8;
    out.push(<rect key="chimney" x={chimX - 4} y={chimY - 14} width={8} height={14} fill={colors.grey600} />);
    out.push(<circle key="smoke" cx={chimX} cy={chimY - 20} r={4} fill={colors.grey200} opacity={0.7} />);
  }

  if (d.windowBoxes) {
    const box = quadPts({ x: cx, y: cy + hh }, { x: cx - hw, y: cy }, geo.LT, geo.FT, 0.32, 0.58, 0.36, 0.41);
    out.push(<polygon key="window-box" points={pointsAttr(box)} fill={colors.green600} />);
  }

  if (d.marquee) {
    const band = quadPts({ x: cx, y: cy + hh }, RB, RT, FT, 0.05, 0.95, 0.58, 0.68);
    out.push(<polygon key="marquee" points={pointsAttr(band)} fill={colors.yellow400} />);
    for (let i = 0; i < 3; i++) {
      const p = bil({ x: cx, y: cy + hh }, RB, RT, FT, 0.2 + i * 0.25, 0.63);
      out.push(<circle key={`bulb-${i}`} cx={p.x} cy={p.y} r={1.4} fill={colors.white} />);
    }
  }

  if (d.ticketWindow) {
    const win = quadPts({ x: cx, y: cy + hh }, { x: cx - hw, y: cy }, geo.LT, geo.FT, 0.15, 0.32, 0.2, 0.36);
    out.push(<polygon key="ticket-window" points={pointsAttr(win)} fill={colors.grey50} />);
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
 * landmark rendering by level.
 */
function roofSignboard(spec: ArchetypeSpec, palette: Palette, geo: ReturnType<typeof buildingCube>): ReactNode[] {
  const { signAnchor } = geo;
  const plateW = 44;
  const plateH = 18;
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
    <text key="plate-sign" x={plateCx} y={plateCy + 7} fontSize={22} textAnchor="middle">
      {spec.sign}
    </text>,
  ];
  // three marquee bulbs along the plate's bottom edge — the same trick d.marquee already uses
  for (let i = 0; i < 3; i++) {
    out.push(<circle key={`bulb-${i}`} cx={plateCx - 12 + i * 12} cy={plateBottom} r={1.2} fill={colors.white} />);
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

/** Inline SVG building/park/monument art. Fixed viewBox, `width/height: 100%` — never clips
 * regardless of tile size (52/56/64/72px all verified: `preserveAspectRatio`'s default `meet`
 * always fits the whole viewBox inside the box). */
export function BuildingArt({ categoryId, variantIndex, level, monumentPeriod }: BuildingArtProps) {
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
  // promoted at level >= 4 — "placement + growth reads on screen".
  const isLandmark = !!spec.landmark || level >= 4;
  const geo = buildingCube(spec, palette, floors, variantIndex, isLandmark);
  const decor = decorParts(spec, geo);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="100%" data-archetype={spec.archetype} aria-hidden="true">
      {geo.parts}
      {decor}
      {isLandmark ? (
        roofSignboard(spec, palette, geo)
      ) : (
        <text x={geo.signAnchor.x} y={geo.signAnchor.y + 8} fontSize={16} textAnchor="middle">
          {spec.sign}
        </text>
      )}
    </svg>
  );
}
