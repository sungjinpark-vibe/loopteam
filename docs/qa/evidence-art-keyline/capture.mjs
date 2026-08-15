// Before/after evidence for the building-art colour/stroke (keyline) change.
//
// Two real fixtures, loaded through the dev-only `window.__aitLoadFixture`
// hook (src/main.tsx) and driven with real Playwright layout — not jsdom,
// which cannot answer "does the keyline actually separate a building from
// the ground it stands on" at all:
//
//   "full-town"        — the map filled to RX1-N2's real capacity, cycling
//                         every expense category (src/devtools/fixtures.ts
//                         `fullTown()`). Used for the whole-town, zoomed, and
//                         categories shots — it is the most saturated fixture
//                         that exists, exactly what a colour/stroke change
//                         needs to be seen against.
//   "fusion-ready-lv6"  — the only fixture that seeds ONE category at several
//                         DIFFERENT levels on purpose (food: Lv.4, Lv.5 x2,
//                         Lv.6 x2 — src/devtools/fixtures.ts `fusionScenario`).
//                         `full-town`'s buildings are all freshly founded
//                         (exp defaults to 0), so it alone cannot show a level
//                         ladder; this fixture exists for exactly that gap.
//                         Used only for the "levels" shot.
//
// Not part of the build or the gate. `playwright` is deliberately NOT a
// dependency of this app — run it against an existing install:
//   npm run dev                       # separate terminal, serves :5173
//   PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:5173 --tag before
//
// SHARED MACHINE — process hygiene: this box runs other teams' long-lived
// node processes. This script starts NO process and kills NO process by
// design; start the dev server yourself in a separate terminal and stop it
// by the PID you started, never by image name.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const BASE = arg("base", "http://localhost:5173");
const TAG = arg("tag", "after");
const OUT = new URL("./", import.meta.url).pathname.replace(/^\/([a-zA-Z]):/, "$1:");
mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 390, height: 844 };
const CSS_VARS = ["--terrace-a", "--terrace-b", "--terrace-c", "--town-asphalt", "--town-grass", "--town-water"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 3 });

const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto(BASE, { waitUntil: "networkidle" });

/** Loads a dev fixture through the real hook. The hook reloads the page
 * itself (src/main.tsx `loadScenario`), so our own reload can lose the race
 * — the same workaround scripts/evidence-art-fill.mjs uses. */
async function loadFixture(name) {
  const result = await page.evaluate((name) => {
    if (typeof window.__aitLoadFixture !== "function") return "NO_HOOK";
    window.__aitLoadFixture(name);
    return name;
  }, name);
  if (result === "NO_HOOK") throw new Error("window.__aitLoadFixture is not present — dev build required (npm run dev)");
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator(".town-grid").waitFor();
  await page.waitForTimeout(300);
}

const zoomToggle = ".town-zoom-toggle";
/** App opens zoomed-to-fit; the toggle flips to native 100%. Reused from
 * docs/qa/evidence-height-signboard/capture.mjs verbatim. */
async function setZoom(full) {
  const pressed = await page.getAttribute(zoomToggle, "aria-pressed");
  const isFit = pressed === "true";
  if (isFit === full) await page.click(zoomToggle);
  await page.waitForTimeout(450);
}

async function shot(name, opts = {}) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}${TAG}-${name}.png`, ...opts });
  return `${TAG}-${name}.png`;
}

/** Bounding box (page px, already in the same coordinate space `clip`
 * expects — getBoundingClientRect reflects the zoom-to-fit CSS transform) of
 * every element matching `selector`, padded. */
async function bboxOfSelector(selector, pad = { t: 30, r: 20, b: 20, l: 20 }) {
  return page.evaluate(
    ({ selector, pad }) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const el of document.querySelectorAll(selector)) {
        const r = el.getBoundingClientRect();
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
        x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      if (!Number.isFinite(x0)) return null;
      return { x: Math.max(0, x0 - pad.l), y: Math.max(0, y0 - pad.t), width: x1 - x0 + pad.l + pad.r, height: y1 - y0 + pad.t + pad.b };
    },
    { selector, pad },
  );
}

/** Clip must stay inside the actual viewport for a non-fullPage screenshot. */
function clampClip(box) {
  const x = Math.max(0, Math.min(box.x, VIEWPORT.width - 1));
  const y = Math.max(0, Math.min(box.y, VIEWPORT.height - 1));
  return { x, y, width: Math.max(1, Math.min(box.width, VIEWPORT.width - x)), height: Math.max(1, Math.min(box.height, VIEWPORT.height - y)) };
}

/** Every rendered building: category/archetype, level, and the LIVE computed
 * stroke + stroke-width of its wall/roof/window parts, plus the terrain CSS
 * custom properties (defined on `.town-grid`, App.css R-3 — not `:root`). */
async function measure(source) {
  return page.evaluate(
    ({ source, CSS_VARS }) => {
      const grid = document.querySelector(".town-grid");
      const gridStyle = grid ? getComputedStyle(grid) : null;
      const cssVars = {};
      for (const name of CSS_VARS) cssVars[name] = gridStyle ? gridStyle.getPropertyValue(name).trim() || null : null;

      const readPart = (svg, part) => {
        const el = svg.querySelector(`[data-part="${part}"]`);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { stroke: cs.stroke || el.getAttribute("stroke"), strokeWidth: cs.strokeWidth || el.getAttribute("stroke-width") };
      };

      const buildings = [];
      for (const tile of document.querySelectorAll(".building-tile[data-archetype]")) {
        const svg = tile.querySelector("svg");
        if (!svg) continue;
        const title = tile.getAttribute("title") ?? "";
        const m = /Lv\.(\d+)/.exec(title);
        buildings.push({
          source,
          archetype: tile.getAttribute("data-archetype"),
          label: title.replace(/\s*Lv\.\d+\s*$/, "").trim() || null,
          level: m ? Number(m[1]) : null,
          plotIndex: tile.parentElement?.getAttribute("data-plot-index") ?? null,
          wall: readPart(svg, "wall"),
          roof: readPart(svg, "roof"),
          window: readPart(svg, "window"),
        });
      }
      return { cssVars, buildings };
    },
    { source, CSS_VARS },
  );
}

const shots = [];
const allBuildings = [];
let cssVars = null;

// ── "full-town" — the saturated fixture: whole-town, zoomed, categories ──
await loadFixture("full-town");

// 1. the whole town at default fit zoom — does the village read as one scene
await setZoom(false);
await page.evaluate(() => document.querySelector(".town-viewport")?.scrollTo(0, 0));
await page.waitForTimeout(300);
shots.push(await shot("01-town-fit"));

{
  const m = await measure("full-town @ fit");
  cssVars = m.cssVars;
  allBuildings.push(...m.buildings);
}

// 2. zoomed in far enough that individual buildings are legible — the
// `.town-zoom-toggle` IS the app's own pinch/zoom mechanism (native 100%)
await setZoom(true);
await page.evaluate(() => document.querySelector(".town-viewport")?.scrollTo(0, 0));
await page.waitForTimeout(300);
shots.push(await shot("02-town-zoomed"));

// 4. as many distinct categories as possible — mark the first tile of every
// distinct archetype, then clip to their bounding box. `full-town` cycles
// every expense category once per building index, so a contiguous run of
// plots already covers most/all of them without needing to scroll.
await setZoom(false);
await page.evaluate(() => document.querySelector(".town-viewport")?.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.evaluate(() => {
  const seen = new Set();
  for (const tile of document.querySelectorAll(".building-tile[data-archetype]")) {
    const a = tile.getAttribute("data-archetype");
    if (seen.has(a)) continue;
    seen.add(a);
    tile.setAttribute("data-cat-sample", "1");
  }
});
const catBox = await bboxOfSelector('[data-cat-sample="1"]');
shots.push(await shot("04-town-categories", catBox ? { clip: clampClip(catBox) } : {}));

// ── "fusion-ready-lv6" — the only fixture that seeds one category at
// several real levels on purpose (food: Lv.4, Lv.5 x2, Lv.6 x2) ──
await loadFixture("fusion-ready-lv6");
{
  const m = await measure("fusion-ready-lv6 @ fit");
  allBuildings.push(...m.buildings);
}

// 3. one category at several levels side by side.
//
// `fusion-ready-lv6` places its buildings via a seeded-random plot allocator
// (fixtures.ts `makePlotAllocator`) across the whole 20x20 grid — same-
// archetype buildings routinely land many rows apart. Measured directly: even
// the closest 3-distinct-level cluster in this fixture spans ~9 rows, so ANY
// single clip around the set (whole-set union, or the densest subset of it)
// is mostly empty ground, and at that height starts pulling in the fixed
// bottom-tab-bar too. Fix: capture one tightly-cropped shot per distinct
// level, then stitch them side by side into a single frame — composited via
// a throwaway Playwright page (HTML + `<img>` data URLs), no new dependency
// needed for image work.
await setZoom(true);

// Hide the move-hint coach toast and the floating action buttons — real
// selectors, not guesses:
//   - toast: TDS mounts every `openToast()` into `#tds-mobile-portal-container`
//     as a `[aria-live="polite"]` wrapper (App.css's "Toast layer" comment, A6).
//   - `.town-fab` (⊕) / `.shop-fab` (꾸미기) / `.town-zoom-toggle` (전체 보기 /
//     크게 보기) / `.bottom-tab-bar` are all `position: fixed` (App.css), so
//     any of them can end up inside a clip placed near a screen edge.
await page.addStyleTag({
  content:
    ".town-fab, .shop-fab, .town-zoom-toggle, .bottom-tab-bar, #tds-mobile-portal-container > [aria-live='polite'] { display: none !important; }",
});

const byArchetype = await page.evaluate(() => {
  const map = {};
  for (const tile of document.querySelectorAll(".building-tile[data-archetype]")) {
    const a = tile.getAttribute("data-archetype");
    const m = /Lv\.(\d+)/.exec(tile.getAttribute("title") ?? "");
    if (!m) continue;
    (map[a] ??= []).push(Number(m[1]));
  }
  return map;
});
let levelsArchetype = null;
let levelsList = [];
for (const [a, levels] of Object.entries(byArchetype)) {
  const distinct = [...new Set(levels)].sort((x, y) => x - y);
  if (distinct.length > levelsList.length) {
    levelsArchetype = a;
    levelsList = distinct;
  }
}
// Assert: the frame we're about to ship must contain >= 3 distinct level
// badges — throw loud instead of silently shipping a bad shot again.
if (levelsList.length < 3) {
  throw new Error(`fusion-ready-lv6 has no archetype with >= 3 distinct levels (best: ${levelsArchetype} -> ${JSON.stringify(levelsList)})`);
}

async function findLevelTileBox(archetype, level) {
  return page.evaluate(
    ({ a, level }) => {
      for (const tile of document.querySelectorAll(`.building-tile[data-archetype="${a}"]`)) {
        const m = /Lv\.(\d+)/.exec(tile.getAttribute("title") ?? "");
        if (m && Number(m[1]) === level) {
          const r = tile.getBoundingClientRect();
          return { x: r.left, y: r.top, width: r.width, height: r.height };
        }
      }
      return null;
    },
    { a: archetype, level },
  );
}

const crops = [];
for (const level of levelsList) {
  await page.evaluate(
    ({ a, level }) => {
      for (const tile of document.querySelectorAll(`.building-tile[data-archetype="${a}"]`)) {
        const m = /Lv\.(\d+)/.exec(tile.getAttribute("title") ?? "");
        if (m && Number(m[1]) === level) {
          tile.scrollIntoView({ block: "center", inline: "center" });
          return;
        }
      }
    },
    { a: levelsArchetype, level },
  );
  await page.waitForTimeout(200); // let scrollIntoView settle before measuring/clipping
  const box = await findLevelTileBox(levelsArchetype, level);
  if (!box) throw new Error(`lost the Lv.${level} tile for archetype ${levelsArchetype} between selection and capture`);
  const pad = 12;
  const clip = clampClip({ x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 });
  const buf = await page.screenshot({ clip });
  crops.push({ level, dataUrl: `data:image/png;base64,${buf.toString("base64")}` });
}

const levelInfo = { archetype: levelsArchetype, levels: levelsList };

const stitchHtml = `<!doctype html><html><body style="margin:0;padding:16px;display:flex;gap:16px;align-items:flex-end;background:#ffffff;font-family:sans-serif;">
${crops
  .map(
    (c) =>
      `<figure style="margin:0;text-align:center;"><img src="${c.dataUrl}" style="display:block;height:220px;width:auto;border:1px solid #ddd;" /><figcaption style="font-size:14px;margin-top:4px;">Lv.${c.level}</figcaption></figure>`,
  )
  .join("")}
</body></html>`;
const stitchPage = await browser.newPage({ deviceScaleFactor: 3 });
await stitchPage.setContent(stitchHtml, { waitUntil: "load" });
await stitchPage.screenshot({ path: `${OUT}${TAG}-03-levels.png`, fullPage: true });
await stitchPage.close();
shots.push(`${TAG}-03-levels.png`);

// ── measurements ──
const measurementsFile = `${OUT}${TAG}-measurements.json`;
writeFileSync(
  measurementsFile,
  JSON.stringify(
    {
      tag: TAG,
      fixtures: ["full-town", "fusion-ready-lv6"],
      cssVars,
      levelsShotArchetype: levelInfo,
      buildingCount: allBuildings.length,
      buildings: allBuildings,
    },
    null,
    2,
  ),
);

const realErrors = consoleErrors.filter((e) => !e.includes("SafeAreaInsets"));
console.log(JSON.stringify({ tag: TAG, shots, buildingCount: allBuildings.length, consoleErrors: realErrors }, null, 2));

await browser.close();

if (realErrors.length > 0) {
  console.error(`${realErrors.length} page console error(s) — see output above`);
  process.exit(1);
}
