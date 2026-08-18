/**
 * Rare savings-structure art (user feedback 2026-08-19, verbatim: "특수 건물은
 * 텍스트가 아니라 희귀 외형을 가진 건물이어야 한다") — replaces the flat CSS box +
 * Korean text label (`.savings-structure-board`/`-label`, `SavingsRow.tsx`) with
 * five recognisably RARE building silhouettes, one per `SavingCategoryId`.
 *
 * Ported from `buildingArt.tsx`'s own bilinear-quad isometric-cube system (see
 * that file's header comment) — same box/wall/roof vocabulary, same neutral
 * `grey900` keyline rule (2026-08-15/-18 measured-contrast fix), same
 * `@toss/tds-colors` token discipline, never a hand-picked hex.
 * `buildingArt.tsx` is a FROZEN baseline (CLAUDE.md) — its geometry helpers
 * (`lerp`/`bil`/`quadPts`/`pointsAttr`) are not exported, so this file
 * duplicates the handful of small pure functions rather than editing or
 * importing from that file. Everything past that (palettes, roof shapes,
 * per-building signals) is written fresh for these five archetypes, which are
 * simpler than an ordinary building: always a 1x1 footprint, no floors/
 * fuseTier/landmark — only the level-driven box height buildingArt's own
 * "커지지 않고 고급화" revision (2026-08-13) already established as this app's
 * level-growth convention.
 *
 * Design source: `docs/design/ai-prototypes/rare-savings/README.md` — the
 * per-building feature list + sampled hex values this file draws from. Its
 * one note: the `goal` reference PNG picked up incidental café-furniture
 * bleed-in from a style reference image; only the cottage+flag signal below
 * is drawn from it, per that README.
 */
import type { ReactNode } from "react";
import { colors } from "@toss/tds-colors";
import { MIN_TILE_WIDTH_PX, structureLevelHeightPx, TILE_HEIGHT_PX } from "../townLayout";
import type { SavingCategoryId } from "../types";

// ── geometry (duplicated from buildingArt.tsx's bilinear-quad helpers — see its header) ──
interface Vec {
  x: number;
  y: number;
}
function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function bil(A: Vec, B: Vec, C: Vec, D: Vec, u: number, v: number): Vec {
  return lerp(lerp(A, B, u), lerp(D, C, u), v);
}
function quadPts(A: Vec, B: Vec, C: Vec, D: Vec, u0: number, u1: number, v0: number, v1: number): Vec[] {
  return [bil(A, B, C, D, u0, v0), bil(A, B, C, D, u1, v0), bil(A, B, C, D, u1, v1), bil(A, B, C, D, u0, v1)];
}
function pointsAttr(pts: Vec[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The tile-shaped art box. Savings cells are always 1x1 (townLayout.ts's
 * `SAVINGS_CELLS`), so `vw` is `buildingArt.tsx`'s own `artBox(1,1)` width,
 * at the same `ART_UNIT` view-units-per-px scale. `vh` is NOT the tile's own
 * height though: `SavingsRow.tsx` reserves a per-LEVEL box height for the
 * structure (`structureLevelHeightPx`, taller than one tile once level >= 2)
 * — the savings-block equivalent of buildingArt.tsx's `growPxFor`. Growing
 * the viewBox by the same ratio (rather than leaving it tile-square) is what
 * makes the building genuinely taller at a higher level instead of the same
 * art shrunk to fit inside a taller box (`preserveAspectRatio="xMidYMid meet"`
 * would otherwise scale by the narrower dimension and centre the rest away).
 */
const VIEW_H_1X1 = 176; // buildingArt.tsx's own constant — kept so the two art systems share one on-screen scale
const ART_UNIT = VIEW_H_1X1 / TILE_HEIGHT_PX;
const FILL = 0.94;
const HH_MAX_SHARE = 0.3;

interface Box {
  vw: number;
  vh: number;
  left: number;
  top: number;
  spanW: number;
  spanH: number;
}
function tileBox(level: number): Box {
  const vw = MIN_TILE_WIDTH_PX * ART_UNIT;
  const vh = structureLevelHeightPx(level) * ART_UNIT;
  return { vw, vh, left: (vw * (1 - FILL)) / 2, top: (vh * (1 - FILL)) / 2, spanW: vw * FILL, spanH: vh * FILL };
}

/**
 * ── the keyline (buildingArt.tsx, 2026-08-15/-18) ──
 * Opaque neutral `grey900` on every wall/roof/window/door — MEASURED to clear
 * contrast against every terrain colour these buildings can stand next to,
 * not a taste choice. Same token, same rule, applied here for the same reason.
 */
const EDGE = colors.grey900;
const EDGE_W = ART_UNIT * 2.1;
const PANE_EDGE_W = ART_UNIT * 0.55;
/** Cross-cutting "rare" grammar (design README): every one of the five gets
 *  this same gold cornice band, on top of its own distinguishing signal below
 *  — the fast, colour-only cue that says "special building" as a category. */
const GOLD = colors.yellow600;

interface Palette {
  left: string;
  right: string;
  roofLite: string;
  roofMid: string;
  roofDark: string;
  door: string;
  win: string;
}

interface Geo {
  FB: Vec;
  RB: Vec;
  LB: Vec;
  FT: Vec;
  RT: Vec;
  LT: Vec;
  BT: Vec;
  cx: number;
  cy: number;
  h: number;
  hh: number;
  halfW: number;
}

function wallCube(box: Box, wide: number, squat: number, roofShare: number): Geo {
  const halfW = (box.spanW / 2) * wide;
  const isoHalf = box.spanW / 4; // a true isometric 2:1 ground diamond, same convention as buildingArt.tsx
  const hh = clamp(isoHalf * squat, box.spanH * 0.08, box.spanH * HH_MAX_SHARE);
  const cx = box.left + box.spanW / 2;
  const cy = box.vh - box.top - hh; // front corner sits on the box floor
  const roofBudget = box.spanH * roofShare;
  const h = Math.max(box.spanH * 0.28, box.spanH - 2 * hh - roofBudget);
  const FB: Vec = { x: cx, y: cy + hh };
  const RB: Vec = { x: cx + halfW, y: cy };
  const LB: Vec = { x: cx - halfW, y: cy };
  const FT: Vec = { x: cx, y: cy + hh - h };
  const RT: Vec = { x: cx + halfW, y: cy - h };
  const LT: Vec = { x: cx - halfW, y: cy - h };
  const BT: Vec = { x: cx, y: cy - hh - h };
  return { FB, RB, LB, FT, RT, LT, BT, cx, cy, h, hh, halfW };
}

function shadow(geo: Geo): ReactNode {
  return (
    <ellipse
      key="shadow"
      cx={geo.cx}
      cy={geo.cy + geo.hh * 0.3}
      rx={geo.halfW * 1.04}
      ry={geo.hh * 0.8}
      fill="rgba(30,25,45,0.22)"
      style={{ filter: "blur(2px)" }}
    />
  );
}

function walls(geo: Geo, palette: Palette): ReactNode[] {
  const edge = { stroke: EDGE, strokeWidth: EDGE_W, strokeLinejoin: "round" as const };
  return [
    <polygon key="wall-l" data-part="wall" points={pointsAttr([geo.FB, geo.LB, geo.LT, geo.FT])} fill={palette.left} {...edge} />,
    <polygon key="wall-r" data-part="wall" points={pointsAttr([geo.FB, geo.RB, geo.RT, geo.FT])} fill={palette.right} {...edge} />,
  ];
}

function corniceBand(geo: Geo): ReactNode[] {
  const edge = { stroke: EDGE, strokeWidth: PANE_EDGE_W };
  return [
    <polygon key="cornice-l" points={pointsAttr(quadPts(geo.FB, geo.LB, geo.LT, geo.FT, 0, 1, 0.82, 0.92))} fill={GOLD} {...edge} />,
    <polygon key="cornice-r" points={pointsAttr(quadPts(geo.FB, geo.RB, geo.RT, geo.FT, 0, 1, 0.82, 0.92))} fill={GOLD} {...edge} />,
  ];
}

function windowQuad(geo: Geo, face: "l" | "r", palette: Palette): ReactNode {
  const [A, B, C, D] = face === "l" ? [geo.FB, geo.LB, geo.LT, geo.FT] : [geo.FB, geo.RB, geo.RT, geo.FT];
  return (
    <polygon
      key={`win-${face}`}
      data-part="window"
      points={pointsAttr(quadPts(A, B, C, D, 0.26, 0.5, 0.28, 0.42))}
      fill={palette.win}
      stroke={EDGE}
      strokeWidth={PANE_EDGE_W}
    />
  );
}

function plainDoor(geo: Geo, palette: Palette): ReactNode {
  return (
    <polygon
      key="door"
      data-part="door"
      points={pointsAttr(quadPts(geo.FB, geo.RB, geo.RT, geo.FT, 0.3, 0.5, 0.02, 0.55))}
      fill={palette.door}
      stroke={EDGE}
      strokeWidth={PANE_EDGE_W}
    />
  );
}

// ── roof shapes ──

function pyramidRoof(geo: Geo, roofRise: number, palette: Palette): { parts: ReactNode[]; apex: Vec } {
  const apex: Vec = { x: geo.cx, y: geo.BT.y - roofRise };
  const edge = { stroke: EDGE, strokeWidth: EDGE_W, strokeLinejoin: "round" as const };
  return {
    parts: [
      <polygon key="roof-bl" data-part="roof" points={pointsAttr([geo.LT, geo.BT, apex])} fill={palette.roofDark} {...edge} />,
      <polygon key="roof-br" data-part="roof" points={pointsAttr([geo.RT, geo.BT, apex])} fill={palette.roofDark} {...edge} />,
      <polygon key="roof-fl" data-part="roof" points={pointsAttr([geo.LT, geo.FT, apex])} fill={palette.roofLite} {...edge} />,
      <polygon key="roof-fr" data-part="roof" points={pointsAttr([geo.RT, geo.FT, apex])} fill={palette.roofMid} {...edge} />,
    ],
    apex,
  };
}

/** stock — a pyramid roof drawn tall/narrow (via the spec's own `wide`/`roofRiseShare`),
 *  plus a gold ring collar where the spire meets the tower body (README §2). */
function spireRoof(geo: Geo, roofRise: number, palette: Palette): { parts: ReactNode[]; apex: Vec } {
  const { parts, apex } = pyramidRoof(geo, roofRise, palette);
  const ring = (
    <ellipse
      key="spire-ring"
      cx={geo.cx}
      cy={geo.FT.y}
      rx={geo.halfW * 0.62}
      ry={geo.hh * 0.35}
      fill="none"
      stroke={GOLD}
      strokeWidth={PANE_EDGE_W * 1.4}
    />
  );
  return { parts: [...parts, ring], apex };
}

/** emergency — a rounded, riveted dome (README §3), flatter than a full hemisphere. */
function domeRoof(geo: Geo, roofRise: number, palette: Palette): { parts: ReactNode[]; apex: Vec } {
  const topY = geo.FT.y - roofRise;
  const apex: Vec = { x: geo.cx, y: topY };
  const d =
    `M ${geo.LT.x.toFixed(1)} ${geo.LT.y.toFixed(1)} ` +
    `Q ${geo.cx.toFixed(1)} ${topY.toFixed(1)} ${geo.RT.x.toFixed(1)} ${geo.RT.y.toFixed(1)} ` +
    `Q ${geo.cx.toFixed(1)} ${(geo.FT.y + geo.hh * 0.4).toFixed(1)} ${geo.LT.x.toFixed(1)} ${geo.LT.y.toFixed(1)} Z`;
  return {
    parts: [<path key="dome" data-part="roof" d={d} fill={palette.roofDark} stroke={EDGE} strokeWidth={EDGE_W} strokeLinejoin="round" />],
    apex,
  };
}

/** other_saving — a sawtooth zigzag roofline, 3 triangular teeth (README §5). */
function sawtoothRoof(geo: Geo, roofRise: number, palette: Palette): { parts: ReactNode[]; apex: Vec } {
  const teeth = 3;
  const topY = geo.FT.y;
  const pts: Vec[] = [geo.LT];
  for (let i = 0; i < teeth; i++) {
    const xPeak = geo.LT.x + ((geo.RT.x - geo.LT.x) * (i + 0.5)) / teeth;
    const xBase = geo.LT.x + ((geo.RT.x - geo.LT.x) * (i + 1)) / teeth;
    pts.push({ x: xPeak, y: topY - roofRise });
    pts.push({ x: xBase, y: topY });
  }
  const lip = quadPts(geo.FB, geo.RB, geo.RT, geo.FT, 0, 1, 0.9, 1);
  return {
    parts: [
      <polygon key="sawtooth" data-part="roof" points={pointsAttr(pts)} fill={palette.roofDark} stroke={EDGE} strokeWidth={EDGE_W} strokeLinejoin="round" />,
      <polygon key="sawtooth-lip" data-part="roof" points={pointsAttr(lip)} fill={palette.roofMid} stroke={EDGE} strokeWidth={PANE_EDGE_W} />,
    ],
    apex: { x: geo.cx, y: topY - roofRise },
  };
}

// ── the five per-building "rare" signals (design README §1-5) ──

/** deposit — gold-capped classical columns flanking the door; no other archetype has columns. */
function columns(geo: Geo): ReactNode[] {
  return ([[0.04, 0.13], [0.68, 0.77]] as const).flatMap(([u0, u1], i) => [
    <polygon
      key={`col-${i}`}
      points={pointsAttr(quadPts(geo.FB, geo.RB, geo.RT, geo.FT, u0, u1, 0.02, 0.56))}
      fill={colors.white}
      stroke={EDGE}
      strokeWidth={PANE_EDGE_W}
    />,
    <polygon
      key={`col-cap-${i}`}
      points={pointsAttr(quadPts(geo.FB, geo.RB, geo.RT, geo.FT, u0 - 0.01, u1 + 0.01, 0.52, 0.58))}
      fill={GOLD}
      stroke={EDGE}
      strokeWidth={PANE_EDGE_W}
    />,
  ]);
}

/** stock — a numberless clock dial on the facade, echoing "market ticker" without text. */
function clockFace(geo: Geo): ReactNode[] {
  const c: Vec = { x: geo.cx, y: geo.FT.y - geo.hh * 0.7 };
  const r = geo.hh * 0.6;
  return [
    <circle key="clock-face" cx={c.x} cy={c.y} r={r} fill={colors.white} stroke={EDGE} strokeWidth={PANE_EDGE_W} />,
    <line key="clock-h" x1={c.x} y1={c.y} x2={c.x} y2={c.y - r * 0.55} stroke={colors.grey700} strokeWidth={PANE_EDGE_W} />,
    <line key="clock-m" x1={c.x} y1={c.y} x2={c.x + r * 0.4} y2={c.y} stroke={colors.grey700} strokeWidth={PANE_EDGE_W} />,
  ];
}

/** emergency — a round vault door with a steel wheel handle, entirely replacing the plain doorway. */
function vaultDoor(geo: Geo, palette: Palette): ReactNode[] {
  const center = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.4, 0.3);
  const r = geo.hh * 0.85;
  return [
    <circle key="vault-ring" data-part="door" cx={center.x} cy={center.y} r={r} fill={palette.door} stroke={EDGE} strokeWidth={EDGE_W} />,
    <circle key="vault-hub" cx={center.x} cy={center.y} r={r * 0.32} fill={GOLD} stroke={EDGE} strokeWidth={PANE_EDGE_W} />,
    <line key="vault-spoke-h" x1={center.x - r * 0.75} y1={center.y} x2={center.x + r * 0.75} y2={center.y} stroke={EDGE} strokeWidth={PANE_EDGE_W} />,
    <line key="vault-spoke-v" x1={center.x} y1={center.y - r * 0.75} x2={center.x} y2={center.y + r * 0.75} stroke={EDGE} strokeWidth={PANE_EDGE_W} />,
  ];
}
/** emergency, secondary flavour — gold rivets along the wall edge (README §3: "gold rivets and gold trim accents"). */
function rivets(geo: Geo): ReactNode[] {
  return [0.15, 0.85].map((v, i) => {
    const p = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.9, v);
    return <circle key={`rivet-${i}`} cx={p.x} cy={p.y} r={PANE_EDGE_W} fill={GOLD} stroke={EDGE} strokeWidth={1} />;
  });
}

/** goal — a pennant flag on a pole at the roof peak; no other archetype flies one (README §4's "cheapest special cue"). */
function flagAtApex(apex: Vec): ReactNode[] {
  const poleTop: Vec = { x: apex.x, y: apex.y - 18 };
  return [
    <line key="flag-pole" x1={apex.x} y1={apex.y} x2={poleTop.x} y2={poleTop.y} stroke={colors.grey700} strokeWidth={PANE_EDGE_W} />,
    <polygon
      key="flag"
      points={pointsAttr([poleTop, { x: poleTop.x + 12, y: poleTop.y + 4 }, { x: poleTop.x, y: poleTop.y + 8 }])}
      fill={colors.red400}
      stroke={EDGE}
      strokeWidth={PANE_EDGE_W * 0.8}
    />,
  ];
}

/** other_saving — a large arched double door (rounded top, split leaves), entirely replacing the plain doorway. */
function archedDoors(geo: Geo, palette: Palette): ReactNode[] {
  const bl = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.14, 0.02);
  const tl = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.14, 0.5);
  const tr = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.62, 0.5);
  const br = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.62, 0.02);
  const archTop = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.38, 0.62);
  const midTop = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.38, 0.5);
  const midBottom = bil(geo.FB, geo.RB, geo.RT, geo.FT, 0.38, 0.02);
  const d =
    `M ${bl.x.toFixed(1)} ${bl.y.toFixed(1)} L ${tl.x.toFixed(1)} ${tl.y.toFixed(1)} ` +
    `Q ${archTop.x.toFixed(1)} ${archTop.y.toFixed(1)} ${tr.x.toFixed(1)} ${tr.y.toFixed(1)} ` +
    `L ${br.x.toFixed(1)} ${br.y.toFixed(1)} Z`;
  return [
    <path key="door-arch" data-part="door" d={d} fill={palette.door} stroke={EDGE} strokeWidth={EDGE_W} strokeLinejoin="round" />,
    <line key="door-split" x1={midBottom.x} y1={midBottom.y} x2={midTop.x} y2={midTop.y} stroke={EDGE} strokeWidth={PANE_EDGE_W} />,
  ];
}

// ── per-building spec table (palette + silhouette shape + the one signal above) ──

interface SavingsSpec {
  palette: Palette;
  /** Silhouette width as a share of the tile (1 = fills it, per README's "wider than tall" / "narrow" cues). */
  wide: number;
  /** Ground-diamond depth factor — squat archetypes (emergency) read heavier/lower. */
  squat: number;
  /** Share of the box's vertical budget spent on the roof. */
  roofShare: number;
  roofRiseShare: number;
  roof: "pyramid" | "spire" | "dome" | "sawtooth";
  /** Overrides the plain doorway entirely when the door itself IS the distinguishing signal. */
  door?: (geo: Geo, palette: Palette) => ReactNode | ReactNode[];
  signal: (geo: Geo, palette: Palette, apex: Vec) => ReactNode[];
}

const ROOF_RENDERERS: Record<SavingsSpec["roof"], (geo: Geo, roofRise: number, palette: Palette) => { parts: ReactNode[]; apex: Vec }> = {
  pyramid: pyramidRoof,
  spire: spireRoof,
  dome: domeRoof,
  sawtooth: sawtoothRoof,
};

const SPECS: Record<SavingCategoryId, SavingsSpec> = {
  deposit: {
    // README §1: grand bank, gold columns — body teal (current `bank` fill), gold trim.
    palette: {
      left: colors.teal300,
      right: colors.teal500,
      roofLite: colors.teal400,
      roofMid: colors.teal500,
      roofDark: colors.teal700,
      door: colors.teal700,
      win: colors.yellow100,
    },
    wide: 1.05,
    squat: 1.15,
    roofShare: 0.24,
    roofRiseShare: 0.14,
    roof: "pyramid",
    signal: (geo) => columns(geo),
  },
  stock: {
    // README §2: exchange tower, clock face + spire — tall/narrow, body purple (current `exchange` fill).
    palette: {
      left: colors.purple300,
      right: colors.purple500,
      roofLite: colors.purple400,
      roofMid: colors.purple600,
      roofDark: colors.purple800,
      door: colors.purple700,
      win: colors.yellow100,
    },
    wide: 0.78,
    squat: 0.6,
    roofShare: 0.32,
    roofRiseShare: 0.34,
    roof: "spire",
    signal: (geo) => clockFace(geo),
  },
  emergency: {
    // README §3: vault, round wheel door — squat/heavy, steel-grey body (current `vault` fill) + blue accent.
    palette: {
      left: colors.grey300,
      right: colors.grey500,
      roofLite: colors.grey400,
      roofMid: colors.grey600,
      roofDark: colors.grey700,
      door: colors.blue500,
      win: colors.yellow100,
    },
    wide: 1.06,
    squat: 1.35,
    roofShare: 0.2,
    roofRiseShare: 0.16,
    roof: "dome",
    door: vaultDoor,
    signal: (geo) => rivets(geo),
  },
  goal: {
    // README §4: premium house + flag — the plainest silhouette of the five on purpose (rarity comes from roof+flag).
    palette: {
      left: colors.orange300,
      right: colors.orange500,
      roofLite: colors.orange400,
      roofMid: colors.orange600,
      roofDark: colors.orange800,
      door: colors.orange800,
      win: colors.yellow100,
    },
    wide: 0.95,
    squat: 1.0,
    roofShare: 0.26,
    roofRiseShare: 0.16,
    roof: "pyramid",
    signal: (_geo, _palette, apex) => flagAtApex(apex),
  },
  other_saving: {
    // README §5: ornate warehouse, arched double doors — widest footprint, silver-grey body (current `warehouse` fill).
    palette: {
      left: colors.grey200,
      right: colors.grey400,
      roofLite: colors.grey300,
      roofMid: colors.grey500,
      roofDark: colors.grey600,
      door: colors.grey100,
      win: colors.yellow100,
    },
    wide: 1.08,
    squat: 1.05,
    roofShare: 0.2,
    roofRiseShare: 0.12,
    roof: "sawtooth",
    door: archedDoors,
    signal: () => [],
  },
};

export interface SavingsArtProps {
  id: SavingCategoryId;
  /** The structure's current level (>= 1 — the caller never mounts this for an empty, level-0 lot). */
  level: number;
}

/**
 * Inline SVG art for a filled (non-empty) savings structure. The caller
 * (`SavingsRow.tsx`) decides whether to render this at all — a level-0 lot
 * renders `.savings-structure-hint` instead, never this: an empty lot must
 * stay an empty lot, not a building. `aria-hidden`, same convention
 * `buildingArt.tsx`'s `BuildingArt` uses — the accessible name lives on the
 * plot's own `aria-label` (`SavingsRow.tsx`), not on this decorative SVG.
 */
export function SavingsArt({ id, level }: SavingsArtProps) {
  const spec = SPECS[id];
  const box = tileBox(level);
  const geo = wallCube(box, spec.wide, spec.squat, spec.roofShare);
  const roofRise = box.spanH * spec.roofRiseShare;
  const { parts: roofParts, apex } = ROOF_RENDERERS[spec.roof](geo, roofRise, spec.palette);
  const doorParts = spec.door ? spec.door(geo, spec.palette) : plainDoor(geo, spec.palette);
  return (
    <svg viewBox={`0 0 ${box.vw} ${box.vh}`} width="100%" height="100%" data-savings-art={id} aria-hidden="true">
      {shadow(geo)}
      {walls(geo, spec.palette)}
      {windowQuad(geo, "l", spec.palette)}
      {doorParts}
      {corniceBand(geo)}
      {roofParts}
      {spec.signal(geo, spec.palette, apex)}
    </svg>
  );
}
