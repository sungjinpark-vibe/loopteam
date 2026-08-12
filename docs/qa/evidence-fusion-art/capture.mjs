// ADDENDUM-11 §4/§7.5 — fusion art evidence capture. Measures fill % (same
// technique as scripts/evidence-art-fill.mjs: union of every painted leaf's
// bounding rect, clamped to the tile wrapper's own box) against the harness
// grid (harness.tsx) instead of the real town, because the fusion MODEL had
// not landed a `fuse`-tagged fixture at capture time (see harness.tsx's own
// header comment for the full reasoning).
//
// Usage (mirrors evidence-art-fill.mjs's own PW_PACKAGE convention):
//   PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:5174
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const baseIdx = process.argv.indexOf("--base");
const BASE = baseIdx > -1 ? process.argv[baseIdx + 1] : "http://localhost:5174";
const OUT = new URL("./", import.meta.url).pathname.replace(/^\/([a-zA-Z]):/, "$1:");

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto(`${BASE}/docs/qa/evidence-fusion-art/harness.html`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__fusionEvidenceReady === true);
await page.waitForSelector("[data-tile]");

// full-page screenshot (all four rows, readable zoom)
await page.screenshot({ path: `${OUT}all-levels-overview.png`, fullPage: true });

// per-row screenshots
const rowTitles = await page.locator("[data-row]").all();
for (let i = 0; i < rowTitles.length; i++) {
  await rowTitles[i].screenshot({ path: `${OUT}row-${String.fromCharCode(65 + i)}.png` });
}

// per-tile measurement — identical union-of-painted-leaves technique to
// scripts/evidence-art-fill.mjs, against the tile wrapper div instead of
// `.building-tile` (harness has no CSS grid, so no zoom-normalisation needed).
const rows = await page.evaluate(() => {
  const out = [];
  for (const tile of document.querySelectorAll("[data-tile]")) {
    const svg = tile.querySelector("svg");
    if (!svg) continue;
    const box = tile.getBoundingClientRect();
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
    out.push({
      totalLevel: Number(tile.getAttribute("data-total-level")),
      fuseTier: Number(tile.getAttribute("data-fuse-tier")),
      footprint: tile.getAttribute("data-footprint"),
      category: tile.getAttribute("data-category"),
      viewBox: svg.getAttribute("viewBox"),
      dataFuseTierAttr: svg.getAttribute("data-fuse-tier"),
      tilePxW: +box.width.toFixed(2),
      tilePxH: +box.height.toFixed(2),
      fillW: +((r - l) / box.width).toFixed(4),
      fillH: +((b - t) / box.height).toFixed(4),
    });
  }
  return out;
});

// aggregate per (footprint, fuseTier) — the table the acceptance criteria asks for
const byKey = {};
for (const row of rows) {
  const key = `${row.footprint}__fuse${row.fuseTier}`;
  (byKey[key] ??= { footprint: row.footprint, fuseTier: row.fuseTier, samples: [] }).samples.push(row);
}
const table = Object.values(byKey)
  .map((g) => {
    const fillW = g.samples.map((s) => s.fillW);
    const fillH = g.samples.map((s) => s.fillH);
    const avg = (a) => +(a.reduce((s, v) => s + v, 0) / a.length * 100).toFixed(2);
    return {
      footprint: g.footprint,
      fuseTier: g.fuseTier,
      n: g.samples.length,
      meanFillWPct: avg(fillW),
      meanFillHPct: avg(fillH),
      minFillWPct: +(Math.min(...fillW) * 100).toFixed(2),
      minFillHPct: +(Math.min(...fillH) * 100).toFixed(2),
    };
  })
  .sort((a, b) => a.footprint.localeCompare(b.footprint) || a.fuseTier - b.fuseTier);

const realErrors = consoleErrors.filter((e) => !e.includes("SafeAreaInsets"));
const findings = { rows, table, consoleErrors: realErrors };
mkdirSync(OUT.replace(/\/$/, ""), { recursive: true });
writeFileSync(`${OUT}fill-measurements.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify({ table, consoleErrors: realErrors }, null, 2));

await browser.close();
