// Browser evidence for the 2026-08-13 user instructions:
//   1. "레벨이 오를수록 건물이 높아져야 한다"  (buildings grow taller with level)
//   2. "무슨 건물인지 알 수 있게 지붕에 간판을 달아라" (roof signboard tells you what it is)
//
// Real TownScreen driven through Playwright at real map scale — not jsdom, which
// has no layout engine and so cannot answer "is this legible" or "does the
// overhang cover the header" at all.
//
// Seeding technique is the one docs/qa/evidence-fusion-final/capture.mjs
// established: write buildings straight into localStorage and reload, because a
// Lv.10 building otherwise needs 12 real entries plus 5 fusions. Levels 1-5 come
// from `exp` (levelOf), 6-10 from `fuse` on top of maxed exp (totalLevelOf) —
// exactly what the grid feeds the art.
//
// Usage:
//   PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:5173
//   --tag before|after   (which half of the before/after pairs to write)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const { chromium } = await import(
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright")
);

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const BASE = arg("base", "http://localhost:5173");
const TAG = arg("tag", "after");
const OUT = new URL("./", import.meta.url).pathname.replace(/^\/([a-zA-Z]):/, "$1:");
mkdirSync(OUT, { recursive: true });

// townLayout.ts's TOWN_MAP, transcribed — the capture needs cell indices and
// cannot import TS. Row 0 really does hold ground (cols 7-12): that is the
// top-row overhang case, not a theoretical one.
const TOWN_MAP = [
  "    PPP......PPP    ",
  "  .....SSSSS.....   ",
  " ################## ",
  " ...#........#...PP ",
  " ...#........#..PPP ",
  "  ..#........#....P ",
  "  ..#........#..... ",
  "  ################# ",
  " ...#..LLLL..#..... ",
  " ...#.LLLLL..#..... ",
  " ...#..LLL...#..... ",
  " ...#........#..... ",
  " ################## ",
  " ...#PPP.....#..... ",
  " ...#PPPP....#..... ",
  " ...#PPP.....#....P ",
  "  ..#........#....  ",
  "  ################  ",
  "   ...PPP........   ",
  "     PPP.......     ",
];
const idx = (row, col) => row * 20 + col;
const ground = (row, col) => TOWN_MAP[row][col] === ".";

const EXP_PER_LEVEL = 3;
const MAX_LEVEL = 5;
const MAXED_EXP = (MAX_LEVEL - 1) * EXP_PER_LEVEL;

// ── the Lv.1..Lv.10 ladder: 10 buildings side by side in ONE row, so nothing
// occludes anything and every height is directly comparable. Row 11 is the
// widest uninterrupted ground run on the map. ──
const LADDER_ROW = 11;
const LADDER_CELLS = [];
for (let c = 0; c < 20 && LADDER_CELLS.length < 10; c++) if (ground(LADDER_ROW, c)) LADDER_CELLS.push(c);

// occlusion: two buildings in vertically adjacent cells of the same column, the
// LOWER one tall — it must paint OVER the one behind it
const OCC_COL = LADDER_CELLS[1];
const OCC_ROWS = [3, 4, 5, 6].filter((r) => ground(r, OCC_COL));

// top row: a max-level building on row 0, which overhangs the top of the grid
const TOP_COL = [...Array(20).keys()].find((c) => ground(0, c));

// a spread of categories for the sign close-up and the overview
const CAT_CELLS = [];
for (let row = 13; row <= 16; row++) for (let col = 5; col <= 12; col += 2) if (ground(row, col)) CAT_CELLS.push(idx(row, col));

// filler, avoiding every cell the four staged scenes above already claim
const CLAIMED = new Set([
  ...LADDER_CELLS.map((c) => idx(LADDER_ROW, c)),
  ...OCC_ROWS.map((r) => idx(r, OCC_COL)),
  idx(0, TOP_COL),
  ...CAT_CELLS,
]);
const FILL_CELLS = [];
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++)
    if (ground(row, col) && !CLAIMED.has(idx(row, col)) && (row * 7 + col * 3) % 4 === 0) FILL_CELLS.push(idx(row, col));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await page.goto(BASE, { waitUntil: "networkidle" });

const today = await page.evaluate(() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
});
const ym = today.slice(0, 7);

await page.evaluate(
  ({ today, ym, LADDER_ROW, LADDER_CELLS, OCC_COL, OCC_ROWS, TOP_COL, CAT_CELLS, FILL_CELLS, MAXED_EXP, EXP_PER_LEVEL }) => {
    localStorage.clear(); // a prior QA run's town would otherwise survive and re-seat these
    const at = (row, col) => row * 20 + col;
    let seq = 0;
    // level 1-5 -> exp only; 6-10 -> maxed exp + fuse tier (what totalLevelOf reads)
    const atLevel = (id, plotIndex, level, categoryId = "food") => ({
      id,
      source: { kind: "entry", entryId: `e-${id}` },
      categoryId,
      variantIndex: 0,
      plotIndex,
      builtOn: today,
      createdAt: ++seq,
      exp: level <= 5 ? (level - 1) * EXP_PER_LEVEL : MAXED_EXP,
      ...(level > 5 ? { fuse: level - 5 } : {}),
    });

    const buildings = [];
    // the ladder, Lv.1 .. Lv.10 left to right
    LADDER_CELLS.forEach((col, i) => buildings.push(atLevel(`lv${i + 1}`, at(LADDER_ROW, col), i + 1)));
    // occlusion pair: upper cell Lv.1, lower cell Lv.10
    OCC_ROWS.forEach((row, i) =>
      buildings.push(atLevel(`occ${i}`, at(row, OCC_COL), i === OCC_ROWS.length - 1 ? 10 : 1, "education")),
    );
    // the top row
    buildings.push(atLevel("top", at(0, TOP_COL), 10, "culture"));
    // a spread of categories at mixed levels, so the overview and the sign
    // close-up show real variety rather than ten identical restaurants
    const cats = ["cafe", "shopping", "living", "health", "culture", "education", "social", "salary", "sidejob", "bonus"];
    CAT_CELLS.slice(0, cats.length).forEach((cell, k) => buildings.push(atLevel(`cat${k}`, cell, 1 + ((k * 3) % 10), cats[k])));
    // filler so the overview reads as a lived-in town rather than 25 lonely buildings
    FILL_CELLS.forEach((cell, k) => buildings.push(atLevel(`fill${k}`, cell, 1 + (k % 4), cats[k % cats.length])));

    localStorage.setItem(
      "ait.v1.index",
      JSON.stringify({ schemaVersion: 1, layoutVersion: 4, entryMonths: [], buildingMonths: [ym] }),
    );
    localStorage.setItem(
      "ait.v1.core",
      JSON.stringify({
        town: {
          townName: "우리 동네",
          streakDays: 0,
          longestStreakDays: 0,
          lastActOn: null,
          slotsUsedOn: "",
          slotsUsedToday: 0,
          highestTierSeen: 0,
          queue: [],
          noSpendDays: [],
          cumulativeSavingsKrw: 0,
          lastSettledPeriod: ym,
          moveHintSeen: true,
        },
        budget: { monthlyBudgetKrw: null, updatedAt: 0 },
        onboarded: true,
      }),
    );
    localStorage.setItem(`ait.v1.buildings.${ym}`, JSON.stringify(buildings));
  },
  { today, ym, LADDER_ROW, LADDER_CELLS, OCC_COL, OCC_ROWS, TOP_COL, CAT_CELLS, FILL_CELLS, MAXED_EXP, EXP_PER_LEVEL },
);

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".town-grid");
await page.waitForTimeout(500);

const shots = [];
async function shot(name, opts = {}) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}${name}-${TAG}.png`, ...opts });
  shots.push(`${name}-${TAG}.png`);
}

/** The bounding box of a set of plot indices, in page px, padded. */
async function boxOf(plotIndices, pad = { t: 60, r: 20, b: 20, l: 20 }) {
  return page.evaluate(
    ({ plotIndices, pad }) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const i of plotIndices) {
        const el = document.getElementById(`plot-${i}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
        x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      return { x: Math.max(0, x0 - pad.l), y: Math.max(0, y0 - pad.t), width: x1 - x0 + pad.l + pad.r, height: y1 - y0 + pad.t + pad.b };
    },
    { plotIndices, pad },
  );
}

const zoomToggle = ".town-zoom-toggle";
async function setZoom(full) {
  // App opens zoomed-to-fit; the toggle flips to native 100%
  const pressed = await page.getAttribute(zoomToggle, "aria-pressed");
  const isFit = pressed === "true";
  if (isFit === full) await page.click(zoomToggle);
  await page.waitForTimeout(450);
}

// ── measurements: the numbers the report quotes, taken from the real DOM ──
// Looked up by the tile's own `Lv.N` title rather than by seeded plot index:
// `reconcile` may re-seat a building, and an index lookup would then silently
// measure an empty lot (which is exactly what the first run of this did).
async function measure(label) {
  return page.evaluate(
    ({ label }) => {
      const grid = document.querySelector(".town-grid");
      const anyTile = document.querySelector(".town-tile");
      const scale = anyTile.getBoundingClientRect().width / 40; // MIN_TILE_WIDTH_PX
      const byLevel = new Map();
      for (const tile of document.querySelectorAll(".town-tile")) {
        const art = tile.querySelector(".building-tile");
        const svg = tile.querySelector("svg");
        if (!art || !svg) continue;
        const m = /Lv\.(\d+)/.exec(art.getAttribute("title") ?? "");
        const level = m ? Number(m[1]) : 1;
        if (byLevel.has(level)) continue; // one representative per level is enough
        const s = svg.getBoundingClientRect();
        const t = tile.getBoundingClientRect();
        const plate = svg.querySelector('[data-part="signboard"]');
        const p = plate?.getBoundingClientRect();
        byLevel.set(level, {
          level,
          artHeightPx: +s.height.toFixed(1),
          artWidthPx: +s.width.toFixed(1),
          tileWidthPx: +t.width.toFixed(1),
          risesAboveCellPx: +(t.top - s.top).toFixed(1),
          signWidthPx: p ? +p.width.toFixed(1) : null,
          signHeightPx: p ? +p.height.toFixed(1) : null,
        });
      }
      const header = document.querySelector(".balance-banner")?.getBoundingClientRect() ?? null;
      // the highest point ANY art reaches, vs where the grid box starts
      let highestArtTop = Infinity;
      for (const svg of document.querySelectorAll(".building-tile > svg"))
        highestArtTop = Math.min(highestArtTop, svg.getBoundingClientRect().top);
      return {
        label,
        mapScale: +scale.toFixed(3),
        gridTop: +grid.getBoundingClientRect().top.toFixed(1),
        perLevel: [...byLevel.values()].sort((a, b) => a.level - b.level),
        headerBottom: header ? +header.bottom.toFixed(1) : null,
        highestArtTop: Number.isFinite(highestArtTop) ? +highestArtTop.toFixed(1) : null,
      };
    },
    { label },
  );
}

const measurements = [];

// ── 1. the ladder at native 100% scale — this is where height is judged ──
await setZoom(true);
await page.evaluate((i) => document.getElementById(`plot-${i}`)?.scrollIntoView({ block: "center" }), idx(LADDER_ROW, LADDER_CELLS[0]));
await page.waitForTimeout(400);
measurements.push(await measure("100% zoom"));
// A 390px phone window shows ~8 cells; the town-viewport widens to ~510px in a
// wider window, which is exactly what the 10-cell ladder needs. Tile width is
// unaffected (the grid's minmax(40px,1fr) columns only stretch past a 946px
// viewport), so this is the same art at the same scale, just more of it visible.
await page.setViewportSize({ width: 900, height: 700 });
await page.waitForTimeout(400);
// The ladder is 10 cells wide (~500px) and `.town-viewport` is a fixed-width
// horizontal scroller — widening the browser window does NOT widen it. Scroll it
// so the leftmost ladder tile sits just inside the left edge; the whole ladder
// then fits, and the clip is vertical-only (a multi-cell neighbour swallows the
// `plot-N` element of every cell it covers, so an index-derived x-extent silently
// drops cells off the right).
const ladderClip = await page.evaluate(
  ({ row, firstCol }) => {
    const vp = document.querySelector(".town-viewport");
    const first = document.getElementById(`plot-${row * 20 + firstCol}`);
    vp.scrollLeft += first.getBoundingClientRect().left - vp.getBoundingClientRect().left - 8;
    let y0 = 1e9, y1 = -1e9;
    for (const t of document.querySelectorAll(".town-tile")) {
      if (Number(String(t.style.gridRow).split("/")[0].trim()) !== row + 1) continue;
      const r = t.getBoundingClientRect();
      y0 = Math.min(y0, r.top); y1 = Math.max(y1, r.bottom);
    }
    const v = vp.getBoundingClientRect();
    return { x: v.left, y: Math.max(0, y0 - 80), width: v.width, height: y1 - y0 + 110 };
  },
  { row: LADDER_ROW, firstCol: LADDER_CELLS[0] },
);
await page.waitForTimeout(300);
await shot("01a-ladder-lv1-to-lv9-100pct", { clip: ladderClip });
// `.town-viewport` maxes out around 480px wide and the 10-cell ladder spans ~500,
// so the tall end gets its own shot from the same row at the same baseline — the
// two together read as one ladder.
await page.evaluate(() => {
  const vp = document.querySelector(".town-viewport");
  vp.scrollLeft = vp.scrollWidth;
});
await page.waitForTimeout(400);
await shot("01b-ladder-lv2-to-lv10-100pct", { clip: ladderClip });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);

// ── 2. signboard close-up: the mixed-category block, native scale ──
const catCells = CAT_CELLS;
await page.evaluate((i) => document.getElementById(`plot-${i}`)?.scrollIntoView({ block: "center" }), catCells[0]);
await page.waitForTimeout(400);
await shot("02-signboards-100pct", { clip: await boxOf(catCells, { t: 70, r: 24, b: 24, l: 24 }) });

// ── 3. occlusion: the lower row must paint OVER the row above it ──
await page.evaluate((i) => document.getElementById(`plot-${i}`)?.scrollIntoView({ block: "center" }), idx(OCC_ROWS[0], OCC_COL));
await page.waitForTimeout(400);
await shot("03-occlusion-lower-row-in-front", { clip: await boxOf(OCC_ROWS.map((r) => idx(r, OCC_COL)), { t: 70, r: 70, b: 24, l: 70 }) });

// ── 4. the top row: a Lv.10 building on row 0 must not reach the header ──
await page.evaluate(() => document.querySelector(".town-viewport").scrollTo(0, 0));
await page.waitForTimeout(400);
measurements.push(await measure("100% zoom, scrolled to top"));
await shot("04-top-row-clear-of-header", { clip: { x: 0, y: 0, width: 390, height: 320 } });

// ── 5. the whole town at the DEFAULT fit scale — the legibility reality check ──
await setZoom(false);
await page.evaluate(() => document.querySelector(".town-viewport").scrollTo(0, 0));
await page.waitForTimeout(500);
measurements.push(await measure("fit scale (default view)"));
await shot("05-town-overview-fit-scale", { fullPage: false });

const file = `${OUT}measurements.json`;
const prior = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
prior[TAG] = measurements;
writeFileSync(file, JSON.stringify(prior, null, 2));
console.log(JSON.stringify({ tag: TAG, shots, measurements }, null, 2));

await browser.close();
