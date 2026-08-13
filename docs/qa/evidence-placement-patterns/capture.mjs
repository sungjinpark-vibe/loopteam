// MOCKUP screenshots for the four anti-occlusion placement options.
//
// THIS IS A THROWAWAY HARNESS. `src/placement.ts` is NOT changed by anything
// here. The mockups are produced by loading the real app + the real
// `mixedFootprints` fixture, then REWRITING the persisted `plotIndex`/`w`/`h`
// of each building in localStorage to the layout the option's rule would have
// produced (computed by `capacity.mjs`, which is the same roll/downgrade/
// first-fit arithmetic `placement.ts` uses, plus the option's extra constraint).
// Everything the screenshots show downstream of position — art, height ladder,
// roof colour, terrain, zoom — is the real shipped app.
//
// Options:
//   current  no constraint (baseline, = what ships today)
//   H        only every other ROW is buildable (odd rows; the better parity)
//   X        checkerboard, (row+col) odd (the better parity)
//   R        any cell, but no building vertically adjacent to another in a
//            shared column (symmetric: row above AND row below both clear)
//
// Usage:
//   PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:5173
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fillTown } from "./capacity.mjs";

const pwSpecifier = process.env.PW_PACKAGE;
const { chromium } = await import(
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright")
);

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:5173");
const OUT = new URL("./", import.meta.url).pathname.replace(/^\/([a-zA-Z]):/, "$1:");
mkdirSync(OUT, { recursive: true });

const EXP_PER_LEVEL = 3;
const MAX_LEVEL = 5;
const SEED = 977;

// The layout each option produces, precomputed. `placed[i]` is where the i-th
// oldest building ends up; buildings past the end have no seat (plotIndex -1,
// exactly what reconcile does when the town is full — invisible but not lost).
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const ALL = {
  current: "current",
  H: "H1",
  X: "X1",
  R: "R",
  // hybrids — R's vertical rule + X's horizontal rhythm (see README)
  "RX1-N1": "RX1-N1",
  "RX1-N2": "RX1-N2",
  "RX1-N3": "RX1-N3",
  RX2: "RX2",
};
const LAYOUTS = Object.fromEntries(
  Object.entries(ALL)
    .filter(([tag]) => !ONLY || ONLY.includes(tag))
    .map(([tag, opt]) => [tag, fillTown(opt, SEED).placed]),
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const findings = {};

for (const [tag, placed] of Object.entries(LAYOUTS)) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__aitLoadFixture === "function");
  await page.evaluate(() => window.__aitLoadFixture("mixedFootprints")).catch(() => {});
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(".town-grid");

  // Rewrite positions + the same level overlay the 4e29bab evidence used, so
  // the height ladder (and therefore the occlusion) is visible at all.
  const seeded = await page.evaluate(
    ({ placed, EXP_PER_LEVEL, MAX_LEVEL }) => {
      const MAXED = (MAX_LEVEL - 1) * EXP_PER_LEVEL;
      // every building across every month chunk, oldest first — the same order
      // `reconcilePlacement` seats them in.
      const chunks = Object.keys(localStorage).filter((k) => k.startsWith("ait.v1.buildings."));
      const all = [];
      for (const key of chunks) {
        const list = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(list)) for (const b of list) all.push({ key, b });
      }
      all.sort((x, y) => x.b.createdAt - y.b.createdAt || (x.b.id < y.b.id ? -1 : 1));
      // Buildings past the option's capacity are DROPPED from the mockup, not
      // parked at -1: the app's own boot reconcile would re-seat a -1 building
      // at the first free cell under the SHIPPED rules, scattering them back
      // into the pattern's gaps and destroying the very thing being shown.
      // Dropping them is also the honest picture — that many buildings simply
      // do not fit on the map under this option.
      let seatedN = 0, unseatedN = 0;
      const kept = [];
      all.forEach(({ key, b }, i) => {
        const seat = placed[i];
        if (!seat) { unseatedN++; return; }
        b.plotIndex = seat.anchor;
        if (seat.w === 1) delete b.w; else b.w = seat.w;
        if (seat.h === 1) delete b.h; else b.h = seat.h;
        seatedN++;
        const level = 1 + (i % 10);
        if (b.source?.kind !== "monument") {
          b.exp = level <= 5 ? (level - 1) * EXP_PER_LEVEL : MAXED;
          if (level > 5) b.fuse = level - 5; else delete b.fuse;
        }
        kept.push({ key, b });
      });
      const byKey = new Map(chunks.map((k) => [k, []]));
      for (const { key, b } of kept) byKey.get(key).push(b);
      for (const [key, list] of byKey) localStorage.setItem(key, JSON.stringify(list));
      return { total: all.length, seated: seatedN, unseated: unseatedN };
    },
    { placed, EXP_PER_LEVEL, MAX_LEVEL },
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".town-grid");
  await page.waitForTimeout(700);

  // What the real DOM says about this layout.
  const facts = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll(".town-tile")];
    const built = tiles.filter((t) => t.querySelector(".building-tile"));
    const spanOf = (t) => ({
      w: Number(String(t.style.gridColumn).split("span")[1] ?? 1),
      h: Number(String(t.style.gridRow).split("span")[1] ?? 1),
    });
    const mix = { "1x1": 0, "1x2": 0, "2x1": 0, "2x2": 0 };
    const occupied = new Map();
    for (const t of built) {
      const { w, h } = spanOf(t);
      mix[`${w}x${h}`] = (mix[`${w}x${h}`] ?? 0) + 1;
      const plot = Number(t.dataset.plotIndex);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occupied.set(plot + dy * 20 + dx, t);
    }
    // real vertical-adjacency pairs = the occlusion the user complained about
    let pairs = 0;
    for (const t of built) {
      const plot = Number(t.dataset.plotIndex);
      const { w } = spanOf(t);
      const grow = Number(t.querySelector("svg")?.getAttribute("data-grow-px") ?? 0);
      if (grow <= 0 || plot < 20) continue;
      for (let dx = 0; dx < w; dx++) if (occupied.has(plot - 20 + dx)) { pairs++; break; }
    }
    return {
      buildingsOnMap: built.length,
      footprintMix: mix,
      multiCellBuildings: built.length - mix["1x1"],
      occlusionPairs: pairs,
      fadedOverhangs: document.querySelectorAll(".building-tile > svg[data-occludes]").length,
    };
  });
  findings[tag] = { ...seeded, ...facts };

  const zoom = async (full) => {
    const pressed = await page.getAttribute(".town-zoom-toggle", "aria-pressed");
    if ((pressed === "true") === full) await page.click(".town-zoom-toggle");
    await page.waitForTimeout(500);
  };

  await zoom(false); // default: fit-whole-map
  await page.evaluate(() => document.querySelector(".town-viewport")?.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${tag}-01-fit-scale.png` });

  await zoom(true); // 100%
  await page.evaluate(() => document.getElementById("plot-168")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${tag}-02-100pct.png` });
}

writeFileSync(`${OUT}findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
await browser.close();
