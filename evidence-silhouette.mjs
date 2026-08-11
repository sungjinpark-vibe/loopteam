// REAL-SCALE silhouette evidence: proves (or disproves) that a town with 74
// buildings — exactly 5 plot blocks (blockCount(74) === 5, townLayout.ts) —
// reads as more than one rectangle, with the WHOLE town visible in one frame.
//
// Previous rounds passed on small (few-building) screenshots and then failed
// once the director looked at the app at real scale. This harness never
// takes a "small" shot: it always seeds 74 buildings first.
//
// Not part of the build or the gate. `playwright` is deliberately NOT a
// dependency of this app (see other evidence-*.mjs headers) — run it against
// an existing install:
//   npm run dev                       # separate terminal, serves :5173
//   PW_PACKAGE=<abs path>/node_modules/playwright/index.mjs node evidence-silhouette.mjs
//
// SHARED MACHINE — process hygiene (incident 2026-08-11): this box runs other
// teams' long-lived node processes (the HQ Telegram bridge among them). A
// `taskkill /F /IM node.exe /T` to clean up the dev server killed that bridge.
// This script starts NO process and kills NO process by design; when you start
// the dev server yourself, stop it by the PID you started (`Stop-Process -Id`),
// never by image name.
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const OUT = "docs/qa";
mkdirSync(OUT, { recursive: true });

// 74 buildings = 5 plot blocks: blockCount(n) = ceil(ceil(n/TOWN_COLUMNS)/BLOCK_ROWS)
// = ceil(ceil(74/8)/2) = ceil(10/2) = 5 (townLayout.ts, TOWN_COLUMNS=8, BLOCK_ROWS=2).
const TARGET_BUILDINGS = 74;

const findings = {};
const consoleErrors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// ── seed a fixture with >= TARGET_BUILDINGS buildings, then trim to exactly
// TARGET_BUILDINGS (keeping the smallest plotIndex values, which are
// contiguous 0..N-1 in every generator fixture — see fixtures.ts's
// generateMonth/plotCursor) so the town renders as a clean 5-block town with
// no gaps. `oneMonth` (~90 entries, light) is tried first; `dense` (~5,400
// buildings) is the fallback if `oneMonth`'s random entry mix ever lands
// under 74 buildable (expense/income) entries.
async function loadFixtureAndCount(name) {
  await page.evaluate((n) => window.__aitLoadFixture(n), name).catch(() => {});
  await page.waitForLoadState("networkidle");
  await page.locator(".town-fab").waitFor();
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const idx = JSON.parse(localStorage.getItem("ait.v1.index") ?? "{}");
    let total = 0;
    for (const ym of idx.buildingMonths ?? []) {
      total += JSON.parse(localStorage.getItem(`ait.v1.buildings.${ym}`) ?? "[]").length;
    }
    return total;
  });
}

let fixtureUsed = "oneMonth";
let buildingCountBeforeTrim = await loadFixtureAndCount(fixtureUsed);
if (buildingCountBeforeTrim < TARGET_BUILDINGS) {
  fixtureUsed = "dense";
  buildingCountBeforeTrim = await loadFixtureAndCount(fixtureUsed);
}
findings.fixtureUsed = fixtureUsed;
findings.buildingCountBeforeTrim = buildingCountBeforeTrim;
if (buildingCountBeforeTrim < TARGET_BUILDINGS) {
  throw new Error(`Even the "dense" fixture only produced ${buildingCountBeforeTrim} buildings, need ${TARGET_BUILDINGS}`);
}

// ── trim to exactly TARGET_BUILDINGS, keeping the lowest plotIndex values
// (contiguous 0..N-1) so the rendered town is exactly 5 whole blocks with no
// holes. Pure localStorage surgery — reuses the fixture's own chunked-storage
// key layout (storage.ts), no new storage machinery invented.
const trimResult = await page.evaluate((target) => {
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
  return { totalBefore: all.length, kept: keepIds.size, maxPlotIndexKept: Math.max(...all.slice(0, target).map((b) => b.plotIndex)) };
}, TARGET_BUILDINGS);
findings.trimResult = trimResult;

await page.reload({ waitUntil: "networkidle" });
await page.locator(".town-fab").waitFor();
await page.waitForTimeout(600);

findings.buildingCountDom = await page.evaluate(() => document.querySelectorAll(".town-grid .building-tile").length);
findings.buildingCountStorage = await page.evaluate(() => {
  const idx = JSON.parse(localStorage.getItem("ait.v1.index") ?? "{}");
  let total = 0;
  for (const ym of idx.buildingMonths ?? []) {
    total += JSON.parse(localStorage.getItem(`ait.v1.buildings.${ym}`) ?? "[]").length;
  }
  return total;
});
findings.verifiedExactly74 = findings.buildingCountDom === TARGET_BUILDINGS && findings.buildingCountStorage === TARGET_BUILDINGS;

// ── shot 1: zoom-to-fit ("전체 보기") toggle ON, at the real 390x844 phone
// viewport — the whole town must be visible in ONE frame, no scrolling.
const zoomToggle = page.locator(".town-zoom-toggle");
findings.zoomToggleFound = (await zoomToggle.count()) > 0;
if (findings.zoomToggleFound) {
  await zoomToggle.click();
  await page.waitForTimeout(500);
  findings.zoomToggleAriaPressed = await zoomToggle.getAttribute("aria-pressed");
}
await page.screenshot({ path: `${OUT}/silhouette-01-zoomed-fit-74-buildings.png` });
if (findings.zoomToggleFound) {
  await zoomToggle.click(); // reset to natural scale for the full-page shot below
  await page.waitForTimeout(300);
}

// ── shot 2: full-page capture at natural scale — cheap, and the clearest
// read on the actual SILHOUETTE (does the outline vary block-to-block, or is
// it still one uniform rectangle?), since it captures the whole scrollable
// town regardless of viewport height.
await page.screenshot({ path: `${OUT}/silhouette-02-fullpage-outline-74-buildings.png`, fullPage: true });

findings.consoleErrors = [...new Set(consoleErrors)];
findings.screenshots = [
  `${OUT}/silhouette-01-zoomed-fit-74-buildings.png`,
  `${OUT}/silhouette-02-fullpage-outline-74-buildings.png`,
];
for (const p of findings.screenshots) {
  findings[`size_${p}`] = statSync(p).size;
}

writeFileSync(`${OUT}/silhouette-findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));

await browser.close();
