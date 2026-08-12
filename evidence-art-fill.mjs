// "Building art must fill its cell" evidence (user report 2026-08-12).
//
// Measures, per footprint, the RENDERED bounding box of the building's drawn
// geometry against the tile it occupies, in real browser pixels. A screenshot
// that merely looks right cannot pass a check the geometry fails, and — the
// point of this particular fix — a viewBox that got wider around an unchanged
// building fails it too, because the box measured here is the union of the
// SVG's own painted children, not the SVG element's box.
//
// Not part of the build or the gate. `playwright` is deliberately NOT a
// dependency of this app — run it against an existing install:
//   npm run dev                       # separate terminal, serves :5173
//   PW_PACKAGE=<abs path>/node_modules/playwright/index.mjs node evidence-art-fill.mjs [--tag before] [--no-shots]
//
// SHARED MACHINE — process hygiene (incident 2026-08-11): this box runs other
// teams' long-lived node processes (the HQ Telegram bridge among them). This
// script starts NO process and kills NO process by design; when you start the
// dev server yourself, stop it by the PID you started (`Stop-Process -Id`),
// never by image name.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const tagIdx = process.argv.indexOf("--tag");
const TAG = tagIdx > -1 ? process.argv[tagIdx + 1] : "after";
const SHOTS = !process.argv.includes("--no-shots");
const OUT = "docs/qa/evidence-art-footprint-fill";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const fixture = await page.evaluate(() => {
  if (typeof window.__aitLoadFixture !== "function") return "NO_HOOK";
  window.__aitLoadFixture("mixedFootprints");
  return "mixedFootprints";
});
// the fixture hook reloads the page itself, so our own reload can lose the race
await page.reload({ waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(1500);
await page.locator(".town-grid").waitFor();

// One measurement pass over every building on the map. Footprint is derived
// from the RENDERED box against the resolved single-cell track (reading
// `gridColumnStart` off `.building-tile` returns "auto" — the art is a child
// of the grid item, not the item).
const measured = await page.evaluate(() => {
  const grid = document.querySelector(".town-grid");
  if (!grid) return { error: "no .town-grid" };
  const cs = getComputedStyle(grid);
  const cellW = parseFloat(cs.gridTemplateColumns.split(" ")[0]);
  const cellH = parseFloat(cs.gridTemplateRows.split(" ")[0]);
  const gap = parseFloat(cs.columnGap);
  // the town renders under a zoom-to-fit transform, so client rects are scaled
  // while the resolved track sizes are not — normalise before counting cells
  const zoom = grid.getBoundingClientRect().width / grid.offsetWidth;

  const rows = [];
  for (const tile of grid.querySelectorAll(".building-tile")) {
    const svg = tile.querySelector("svg");
    if (!svg) continue;
    const box = svg.getBoundingClientRect(); // the SVG is inset:0 in the tile
    const w = Math.round((box.width / zoom + gap) / (cellW + gap));
    const h = Math.round((box.height / zoom + gap) / (cellH + gap));

    // union of every PAINTED leaf's rendered rect, clamped to the svg's own box
    // (an <svg> root clips to its viewBox, so anything outside is not visible)
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    for (const el of svg.querySelectorAll("polygon, ellipse, circle, rect, line, path, text")) {
      const q = el.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) continue;
      l = Math.min(l, Math.max(q.left, box.left));
      t = Math.min(t, Math.max(q.top, box.top));
      r = Math.max(r, Math.min(q.right, box.right));
      b = Math.max(b, Math.min(q.bottom, box.bottom));
    }
    if (!Number.isFinite(l)) continue;
    rows.push({
      footprint: `${w}x${h}`,
      archetype: tile.getAttribute("data-archetype"),
      plotIndex: tile.parentElement?.getAttribute("data-plot-index") ?? null,
      viewBox: svg.getAttribute("viewBox"),
      tilePxW: +box.width.toFixed(2),
      tilePxH: +box.height.toFixed(2),
      artPxW: +(r - l).toFixed(2),
      artPxH: +(b - t).toFixed(2),
      fillW: +((r - l) / box.width).toFixed(4),
      fillH: +((b - t) / box.height).toFixed(4),
    });
  }
  return { cellW, cellH, gap, zoom, count: rows.length, rows };
});

// aggregate per footprint, and pick one representative building of each for a shot
const byFootprint = {};
for (const row of measured.rows ?? []) {
  const g = (byFootprint[row.footprint] ??= { n: 0, fillW: [], fillH: [], sample: row });
  g.n += 1;
  g.fillW.push(row.fillW);
  g.fillH.push(row.fillH);
}
const avg = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(4);
const summary = {};
for (const [fp, g] of Object.entries(byFootprint)) {
  summary[fp] = {
    buildings: g.n,
    tilePx: `${g.sample.tilePxW} x ${g.sample.tilePxH}`,
    viewBox: g.sample.viewBox,
    viewBoxAspect: +(() => {
      const [, , vw, vh] = g.sample.viewBox.split(" ").map(Number);
      return vw / vh;
    })().toFixed(4),
    tileAspect: +(g.sample.tilePxW / g.sample.tilePxH).toFixed(4),
    meanFillW: avg(g.fillW),
    meanFillH: avg(g.fillH),
    minFillW: Math.min(...g.fillW),
    minFillH: Math.min(...g.fillH),
    sampleArchetype: g.sample.archetype,
    samplePlotIndex: g.sample.plotIndex,
  };
}

if (SHOTS) {
  for (const [fp, g] of Object.entries(byFootprint)) {
    const el = page.locator(`[data-plot-index="${g.sample.plotIndex}"]`).first();
    await el.screenshot({ path: `${OUT}/${TAG}-${fp}.png`, scale: "device" }).catch(() => {});
    const cell = await el.boundingBox();
    if (cell) {
      await page.screenshot({
        path: `${OUT}/${TAG}-${fp}-context.png`,
        clip: {
          x: Math.max(0, cell.x - 60),
          y: Math.max(0, cell.y - 60),
          width: Math.min(390, cell.width + 120),
          height: Math.min(844, cell.height + 120),
        },
      });
    }
  }
  await page.locator(".town-viewport").screenshot({ path: `${OUT}/${TAG}-town-overview.png` }).catch(() => {});
}

// the TDS `getSafeAreaInsets` warning fires in every browser run (there is no
// native Toss host here) — it is environment noise, not a finding
const realErrors = consoleErrors.filter((e) => !e.includes("SafeAreaInsets"));
const findings = {
  tag: TAG,
  fixture,
  grid: { cellW: measured.cellW, cellH: measured.cellH, gap: measured.gap, zoom: measured.zoom },
  buildingsMeasured: measured.count,
  summary,
  consoleErrors: realErrors,
};
writeFileSync(`${OUT}/${TAG}-fill.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));

await browser.close();
