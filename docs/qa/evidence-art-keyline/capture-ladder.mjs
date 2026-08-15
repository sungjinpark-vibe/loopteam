// Level-ladder shot for the keyline evidence (2026-08-15).
//
// Separate from `capture.mjs` on purpose. Clipping a region of the live map to
// show several levels at once kept producing a mostly-empty frame with a coach
// toast across it — the fixture's Lv.4/5/6 buildings are not neighbours. So this
// does not clip: it CLONES the tiles it wants into a clean strip and shoots that.
// The clones are the real rendered SVG, so the art is exactly what the map draws;
// only the arrangement is synthetic, and the caption says so.
//
// SHARED MACHINE (incident 2026-08-11): starts no process, kills no process.
// Run it against a dev server you started yourself.
//
//   PW_PACKAGE=C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs \
//     node docs/qa/evidence-art-keyline/capture-ladder.mjs --base http://localhost:5173 --tag after
import { pathToFileURL } from "node:url";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = arg("--base", "http://localhost:5173");
const TAG = arg("--tag", "after");
const OUT = `docs/qa/evidence-art-keyline/${TAG}-05-level-ladder.png`;

const spec = process.env.PW_PACKAGE;
const { chromium } = await import(spec && /^[a-zA-Z]:[\\/]/.test(spec) ? pathToFileURL(spec).href : (spec ?? "playwright"));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));
page.on("console", (m) => m.type() === "error" && !/SafeAreaInsets/.test(m.text()) && errors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
// the only fixture that seeds one category at several distinct levels
await page.evaluate(() => window.__aitLoadFixture("fusion-ready-lv6"));
await page.reload({ waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(1500);
await page.locator(".town-grid").waitFor();

const levels = await page.evaluate(() => {
  const badgeLevel = (tile) => {
    const t = tile.querySelector(".building-level-badge")?.textContent ?? "";
    const m = t.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };
  // one representative tile per distinct level, lowest first
  const byLevel = new Map();
  for (const tile of document.querySelectorAll(".building-tile[data-archetype]")) {
    const lv = badgeLevel(tile);
    if (lv !== null && !byLevel.has(lv)) byLevel.set(lv, tile);
  }
  const picked = [...byLevel.entries()].sort((a, b) => a[0] - b[0]);

  const strip = document.createElement("div");
  strip.id = "ladder-strip";
  // A tile is ~40px tall; at that size a screenshot proves nothing about paint.
  // The clone is scaled up so the keyline and windows are actually inspectable —
  // scale, not a re-render at a bigger size, so the art is byte-for-byte the map's.
  const SCALE = 4;
  strip.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:var(--terrace-b,#f2e2cd);display:flex;align-items:flex-end;justify-content:center;gap:40px;padding:36px 24px 20px";
  for (const [lv, tile] of picked) {
    const cell = document.createElement("div");
    cell.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:10px";
    const holder = document.createElement("div");
    // the tile paints at its grid size; give the clone the same box it had
    const r = tile.getBoundingClientRect();
    holder.style.cssText =
      `position:relative;width:${r.width * SCALE}px;height:${r.height * SCALE}px;` +
      // transform-origin is the bottom, so the art grows UPWARD — the reserved
      // space has to go on top (and to both sides), not below.
      `transform:scale(${SCALE});transform-origin:bottom center;` +
      `width:${r.width}px;height:${r.height}px;` +
      `margin:${r.height * (SCALE - 1) + 40}px ${(r.width * (SCALE - 1)) / 2}px 0`;
    const clone = tile.cloneNode(true);
    clone.style.position = "absolute";
    clone.style.inset = "0";
    // the in-map level badge would be scaled 4x too and cover the roof; the
    // caption below the clone carries the level instead
    clone.querySelector(".building-level-badge")?.remove();
    holder.appendChild(clone);
    const cap = document.createElement("div");
    cap.textContent = `Lv.${lv}`;
    cap.style.cssText = "font:600 13px/1 system-ui;color:#333d4b";
    cell.append(holder, cap);
    strip.appendChild(cell);
  }
  document.body.appendChild(strip);
  return picked.map(([lv]) => lv);
});

if (levels.length < 3) throw new Error(`the ladder needs >= 3 distinct levels, got ${levels.length}: ${levels.join(",")}`);

await page.waitForTimeout(400);
await page.locator("#ladder-strip").screenshot({ path: OUT });
await browser.close();

console.log(JSON.stringify({ tag: TAG, out: OUT, levels, consoleErrors: errors }, null, 2));
if (errors.length) process.exit(1);
