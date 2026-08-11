// Measures the town's ACTUAL painted horizontal extent, row band by row band,
// so the "is it still one rectangle?" verdict is a number and not a squint.
// Same run contract as evidence-silhouette.mjs (dev server already on :5173).
//   PW_PACKAGE=<abs path>/node_modules/playwright/index.mjs node evidence-silhouette-probe.mjs
//
// SHARED MACHINE: starts no process, kills no process. Stop the dev server by
// the PID you started it with (`Stop-Process -Id`), never by image name.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Same 74-building seed as evidence-silhouette.mjs — an empty town has one
// block and measures nothing.
const TARGET_BUILDINGS = 74;
await page.evaluate((n) => window.__aitLoadFixture(n), "oneMonth").catch(() => {});
await page.waitForLoadState("networkidle");
await page.locator(".town-fab").waitFor();
await page.waitForTimeout(400);
await page.evaluate((target) => {
  const idx = JSON.parse(localStorage.getItem("ait.v1.index") ?? "{}");
  const buildingKeys = (idx.buildingMonths ?? []).map((ym) => `ait.v1.buildings.${ym}`);
  const all = [];
  for (const key of buildingKeys) {
    for (const b of JSON.parse(localStorage.getItem(key) ?? "[]")) all.push(b);
  }
  all.sort((a, b) => a.plotIndex - b.plotIndex);
  const keepIds = new Set(all.slice(0, target).map((b) => b.id));
  for (const key of buildingKeys) {
    const kept = JSON.parse(localStorage.getItem(key) ?? "[]").filter((b) => keepIds.has(b.id));
    localStorage.setItem(key, JSON.stringify(kept));
  }
  const core = JSON.parse(localStorage.getItem("ait.v1.core"));
  core.town.nextPlotIndex = target;
  localStorage.setItem("ait.v1.core", JSON.stringify(core));
}, TARGET_BUILDINGS);
await page.reload({ waitUntil: "networkidle" });
await page.locator(".town-fab").waitFor();
await page.waitForTimeout(600);

const report = await page.evaluate(() => {
  const grid = document.querySelector(".town-grid");
  const gridBox = grid.getBoundingClientRect();
  const rel = (b) => ({ l: +(b.left - gridBox.left).toFixed(1), r: +(b.right - gridBox.left).toFixed(1) });

  const spans = (sel) =>
    [...document.querySelectorAll(sel)].map((el) => {
      const b = rel(el.getBoundingClientRect());
      return { ...b, w: +(b.r - b.l).toFixed(1), top: +(el.getBoundingClientRect().top - gridBox.top).toFixed(1) };
    });

  const terraces = spans(".town-terrace").sort((a, b) => a.top - b.top);
  const crossStreets = spans(".town-cross-street").sort((a, b) => a.top - b.top);
  const tiles = spans(".town-tile");

  // The decisive number: how many DISTINCT left edges and right edges does the
  // land actually have? One of each == still a rectangle.
  const uniq = (xs) => [...new Set(xs.map((v) => Math.round(v)))].sort((a, b) => a - b);
  return {
    gridWidth: +gridBox.width.toFixed(1),
    terraceCount: terraces.length,
    terraceSpans: terraces.map((t) => ({ l: t.l, r: t.r, w: t.w })),
    distinctTerraceLeftEdges: uniq(terraces.map((t) => t.l)),
    distinctTerraceRightEdges: uniq(terraces.map((t) => t.r)),
    crossStreetSpans: crossStreets.map((c) => ({ l: c.l, r: c.r, w: c.w })),
    distinctCrossLeftEdges: uniq(crossStreets.map((c) => c.l)),
    distinctCrossRightEdges: uniq(crossStreets.map((c) => c.r)),
    tileCount: tiles.length,
    tileMinLeft: Math.min(...tiles.map((t) => t.l)),
    tileMaxRight: Math.max(...tiles.map((t) => t.r)),
  };
});

writeFileSync("docs/qa/silhouette-probe.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
