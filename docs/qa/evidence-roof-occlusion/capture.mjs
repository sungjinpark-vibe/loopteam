// Browser evidence for the two 2026-08-13 art instructions:
//   1. the WHOLE ROOF carries the category colour (type readable at fit scale)
//   2. "2D라서 높은 건물이 앞에 있으면 뒷 건물이 안 보이거나 겹쳐" — the occluding
//      building's overhang fades ONLY where it actually covers an occupied cell
//
// Real TownScreen through Playwright at real map scale. jsdom has no layout
// engine, so it can neither judge legibility nor prove the overhang overlap.
//
// Seeding uses the app's own sanctioned fixture path — `window.__aitLoadFixture`
// (main.tsx, dev-only) with `mixedFootprints`, the fixture whose own description
// says "QA's browser evidence run": a near-full town with all four footprints.
// Fixtures carry no `exp`/`fuse` (every fixture building is Lv.1, which has zero
// overhang and therefore no occlusion at all), so a deterministic level overlay
// is written on top of the fixture's own persisted chunk: level = 1 + (i % 10),
// i.e. ~10% of the town at every rung including Lv.10. Nothing else is seeded.
//
// Usage:
//   PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs \
//     --base http://localhost:5173 --tag before|after|optionC
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

const EXP_PER_LEVEL = 3;
const MAX_LEVEL = 5;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await page.goto(BASE, { waitUntil: "networkidle" });

// ── 1. the fixture, through the app's own loader ──
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__aitLoadFixture === "function");
// __aitLoadFixture reloads the page itself; the evaluate is torn down with it.
await page.evaluate(() => window.__aitLoadFixture("mixedFootprints")).catch(() => {});
await page.waitForLoadState("networkidle");
await page.waitForSelector(".town-grid");

// ── 2. level overlay on the fixture's own chunk (see header) ──
const seeded = await page.evaluate(
  ({ EXP_PER_LEVEL, MAX_LEVEL }) => {
    const MAXED = (MAX_LEVEL - 1) * EXP_PER_LEVEL;
    let touched = 0;
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("ait.v1.buildings.")) continue;
      const list = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(list)) continue;
      list.forEach((b, i) => {
        if (b.source?.kind === "monument") return; // monuments never grow
        const level = 1 + (i % 10);
        b.exp = level <= 5 ? (level - 1) * EXP_PER_LEVEL : MAXED;
        if (level > 5) b.fuse = level - 5;
        touched++;
      });
      localStorage.setItem(key, JSON.stringify(list));
    }
    return touched;
  },
  { EXP_PER_LEVEL, MAX_LEVEL },
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".town-grid");
await page.waitForTimeout(600);

const shots = [];
async function shot(name, opts = {}) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}${name}-${TAG}.png`, ...opts });
  shots.push(`${name}-${TAG}.png`);
}

const zoomToggle = ".town-zoom-toggle";
async function setZoom(full) {
  const pressed = await page.getAttribute(zoomToggle, "aria-pressed");
  const isFit = pressed === "true";
  if (isFit === full) await page.click(zoomToggle);
  await page.waitForTimeout(450);
}

/** Bounding box of a set of plot indices, in page px, padded. */
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

// ── 3. facts from the real DOM ──
const facts = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll(".town-tile")];
  const anyTile = tiles.find((t) => t.getBoundingClientRect().width > 0);
  const scale = anyTile.getBoundingClientRect().width / 40; // MIN_TILE_WIDTH_PX
  const built = tiles.filter((t) => t.querySelector(".building-tile"));
  const growOf = (t) => Number(t.querySelector("svg")?.getAttribute("data-grow-px") ?? 0);
  const byPlot = new Map(built.map((t) => [Number(t.dataset.plotIndex), t]));

  // "is this building hiding another?" — one look at the cell(s) directly behind
  // (row - 1), because the max overhang (45px) is under one row + gap (46px).
  // A multi-cell building owns one tile element for its whole footprint, so the
  // occupancy set has to be expanded from the grid spans — a plain "is there a
  // tile at index N" check silently misses every cell a 2x2 covers.
  const spanOf = (tile) => ({
    w: Number(String(tile.style.gridColumn).split("span")[1] ?? 1),
    h: Number(String(tile.style.gridRow).split("span")[1] ?? 1),
  });
  const occupied = new Map();
  for (const [plot, tile] of byPlot) {
    const { w, h } = spanOf(tile);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.set(plot + dy * 20 + dx, tile);
  }
  const candidates = [];
  for (const [plot, tile] of byPlot) {
    const grow = growOf(tile);
    if (grow <= 0 || plot < 20) continue;
    const { w } = spanOf(tile);
    for (let dx = 0; dx < w; dx++) {
      const behind = occupied.get(plot - 20 + dx);
      if (behind) {
        candidates.push({ front: plot, behind: plot - 20 + dx, grow, behindGrow: growOf(behind) });
        break; // one building can only occlude once, however many cells it spans
      }
    }
  }
  candidates.sort((a, b) => b.grow - a.grow - (b.behindGrow - a.behindGrow));

  const faded = document.querySelectorAll(".building-tile > svg[data-occludes]").length;
  const plate = document.querySelector('[data-part="signboard"]')?.getBoundingClientRect() ?? null;
  return {
    mapScale: +scale.toFixed(3),
    buildingsOnMap: built.length,
    tallBuildings: built.filter((t) => growOf(t) > 0).length,
    occlusionPairs: candidates.length,
    fadedOverhangs: faded,
    worstCase: candidates[0] ?? null,
    tileWidthPx: +anyTile.getBoundingClientRect().width.toFixed(1),
    signboardPx: plate ? { w: +plate.width.toFixed(1), h: +plate.height.toFixed(1) } : null,
  };
});

// ── 4. render timing: full grid mount, median of 5 reloads ──
async function timeGridMount(runs = 5) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    await page.reload({ waitUntil: "commit" });
    const ms = await page.evaluate(async () => {
      const t0 = performance.now();
      while (document.querySelectorAll(".town-tile").length < 50) await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      return performance.now() - t0;
    });
    samples.push(+ms.toFixed(1));
  }
  samples.sort((a, b) => a - b);
  return { samples, medianMs: samples[Math.floor(samples.length / 2)] };
}
const timing = await timeGridMount();
await page.waitForSelector(".town-grid");
await page.waitForTimeout(400);

// ── 5. the shots ──
// (a) roof colour at 100%: a block of neighbouring buildings of mixed categories
await setZoom(true);
// A CONTIGUOUS 4x3 block, chosen as the window holding the most distinct
// archetypes — scattered "one cell per archetype" picks produce a mostly-empty
// clip that shows nothing about how the colours read side by side.
const roofCells = await page.evaluate(() => {
  const kindAt = new Map();
  for (const t of document.querySelectorAll(".town-tile")) {
    const art = t.querySelector(".building-tile");
    if (art) kindAt.set(Number(t.dataset.plotIndex), art.dataset.archetype);
  }
  let best = { score: -1, cells: [] };
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 17; col++) {
      const cells = [];
      const kinds = new Set();
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 4; dx++) {
          const i = (row + dy) * 20 + col + dx;
          cells.push(i);
          if (kindAt.has(i)) kinds.add(kindAt.get(i));
        }
      const score = kinds.size;
      if (score > best.score) best = { score, cells };
    }
  }
  return best.cells;
});
await page.evaluate((i) => document.getElementById(`plot-${i}`)?.scrollIntoView({ block: "center" }), roofCells[6]);
await page.waitForTimeout(400);
await shot("01-roof-colour-100pct", { clip: await boxOf(roofCells, { t: 70, r: 20, b: 20, l: 20 }) });

// (b) occlusion: the worst front-tall/rear-short pair on the map
if (facts.worstCase) {
  await page.evaluate((i) => document.getElementById(`plot-${i}`)?.scrollIntoView({ block: "center" }), facts.worstCase.behind);
  await page.waitForTimeout(400);
  await shot("02-occlusion-100pct", {
    clip: await boxOf([facts.worstCase.behind, facts.worstCase.front], { t: 90, r: 80, b: 40, l: 80 }),
  });
}

// (c) the whole town at the DEFAULT fit scale — where colour coding is judged
await setZoom(false);
await page.evaluate(() => document.querySelector(".town-viewport").scrollTo(0, 0));
await page.waitForTimeout(500);
await shot("03-town-overview-fit-scale");

const file = `${OUT}findings.json`;
const prior = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
prior[TAG] = { fixture: "mixedFootprints", levelOverlay: "level = 1 + (i % 10)", buildingsLevelled: seeded, ...facts, gridMountMs: timing, shots };
writeFileSync(file, JSON.stringify(prior, null, 2));
console.log(JSON.stringify({ tag: TAG, ...facts, timing, shots }, null, 2));

await browser.close();
