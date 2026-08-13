// FINAL evidence for the RX1-N2 spacing rule (user pick, 2026-08-13).
//
// Unlike docs/qa/evidence-placement-patterns/, NOTHING here is mocked: the
// town below is laid out by the real, shipped `placeNew`, through the app's own
// `mixedFootprints` fixture. That is the point of this run — the mockups were a
// localStorage rewrite, these are the rule actually running.
//
// Two parts:
//   1. town overview under the new placement, at the default fit scale and at
//      100%, plus a DOM-measured occlusion count (must be 0) and run length
//      (must be <= 2).
//   2. fusion before/after, to prove the freed cell and the survivor still
//      behave. Reuses evidence-fusion-final/capture.mjs's seeding + click flow;
//      the seeded pair sits on cells 7/8, which the spacing rule allows (a run
//      of 2). The Lv.6->Lv.7 pair that run also captured is dropped: it needed
//      four buildings in a row, which the rule no longer permits.
//
// Usage:
//   PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:<port>
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

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

const EXP_PER_LEVEL = 3; // BALANCE.expPerLevel (frozen)
const MAX_LEVEL = 5; // BALANCE.maxLevel (frozen)
const MAXED_EXP = (MAX_LEVEL - 1) * EXP_PER_LEVEL;
const CELL_A = 7;
const CELL_B = 8;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

const shots = [];
async function shot(name, opts) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  shots.push(`${name}.png`);
}
async function setZoom(full) {
  const pressed = await page.getAttribute(".town-zoom-toggle", "aria-pressed");
  if ((pressed === "true") === full) await page.click(".town-zoom-toggle");
  await page.waitForTimeout(450);
}

/** Occlusion + run length, measured off the real DOM, not from the rule. */
const MEASURE = () => {
  const tiles = [...document.querySelectorAll(".town-tile")];
  const built = tiles.filter((t) => t.querySelector(".building-tile"));
  const spanOf = (t) => ({
    w: Number(String(t.style.gridColumn).split("span")[1] ?? 1),
    h: Number(String(t.style.gridRow).split("span")[1] ?? 1),
  });
  const owner = new Map();
  const mix = { "1x1": 0, "1x2": 0, "2x1": 0, "2x2": 0 };
  for (const t of built) {
    const { w, h } = spanOf(t);
    mix[`${w}x${h}`] = (mix[`${w}x${h}`] ?? 0) + 1;
    const plot = Number(t.dataset.plotIndex);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) owner.set(plot + dy * 20 + dx, String(plot));
  }
  let occlusionPairs = 0;
  for (const [cell, id] of owner) {
    const above = owner.get(cell - 20);
    if (above !== undefined && above !== id) occlusionPairs++;
  }
  let longestRun = 0;
  for (let row = 0; row < 20; row++) {
    let run = new Set();
    for (let col = 0; col < 20; col++) {
      const id = owner.get(row * 20 + col);
      if (id === undefined) {
        longestRun = Math.max(longestRun, run.size);
        run = new Set();
      } else run.add(id);
    }
    longestRun = Math.max(longestRun, run.size);
  }
  return {
    buildingsOnMap: built.length,
    footprintMix: mix,
    multiCellBuildings: built.length - mix["1x1"],
    occlusionPairs,
    longestRowRun: longestRun,
    fadedOverhangs: document.querySelectorAll(".building-tile > svg[data-occludes]").length,
  };
};

// ── part 1: the town, laid out by the REAL placer ──
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__aitLoadFixture === "function");
await page.evaluate(() => window.__aitLoadFixture("mixedFootprints")).catch(() => {});
await page.waitForLoadState("networkidle");
await page.waitForSelector(".town-grid");

// Level overlay only — positions and footprints are untouched, straight from
// `placeNew`. Without it every fixture building is Lv.1 and has no overhang at
// all, which would make a zero-occlusion result meaningless.
await page.evaluate(
  ({ EXP_PER_LEVEL, MAXED_EXP }) => {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("ait.v1.buildings.")) continue;
      const list = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(list)) continue;
      list.forEach((b, i) => {
        if (b.source?.kind === "monument") return;
        const level = 1 + (i % 10);
        b.exp = level <= 5 ? (level - 1) * EXP_PER_LEVEL : MAXED_EXP;
        if (level > 5) b.fuse = level - 5;
      });
      localStorage.setItem(key, JSON.stringify(list));
    }
  },
  { EXP_PER_LEVEL, MAXED_EXP },
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".town-grid");
await page.waitForTimeout(700);

const town = await page.evaluate(MEASURE);

await setZoom(false);
await page.evaluate(() => document.querySelector(".town-viewport")?.scrollTo(0, 0));
await page.waitForTimeout(400);
await shot("01-town-fit-scale");

await setZoom(true);
await page.evaluate(() => document.getElementById("plot-168")?.scrollIntoView({ block: "center" }));
await page.waitForTimeout(400);
await shot("02-town-100pct");

// ── part 2: fusion still works ──
const today = await page.evaluate(() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
});
const ym = today.slice(0, 7);

await page.evaluate(
  ({ today, ym, CELL_A, CELL_B, MAXED_EXP }) => {
    localStorage.clear();
    const building = (id, plotIndex, createdAt) => ({
      id,
      source: { kind: "entry", entryId: `e-${id}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex,
      builtOn: today,
      createdAt,
      exp: MAXED_EXP,
    });
    localStorage.setItem("ait.v1.index", JSON.stringify({ schemaVersion: 1, layoutVersion: 4, entryMonths: [], buildingMonths: [ym] }));
    localStorage.setItem(
      "ait.v1.core",
      JSON.stringify({
        town: {
          townName: "우리 동네", streakDays: 0, longestStreakDays: 0, lastActOn: null, slotsUsedOn: "", slotsUsedToday: 0,
          highestTierSeen: 0, queue: [], noSpendDays: [], cumulativeSavingsKrw: 0, lastSettledPeriod: ym, moveHintSeen: true,
        },
        budget: { monthlyBudgetKrw: null, updatedAt: 0 },
        onboarded: true,
      }),
    );
    localStorage.setItem(`ait.v1.buildings.${ym}`, JSON.stringify([building("fuse-a", CELL_A, 1), building("fuse-b", CELL_B, 2)]));
  },
  { today, ym, CELL_A, CELL_B, MAXED_EXP },
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".town-grid");

async function centerOnCells(a, b) {
  await page.evaluate(
    ({ a, b }) => {
      const ra = document.querySelector(`[data-plot-index="${a}"]`).getBoundingClientRect();
      const rb = document.querySelector(`[data-plot-index="${b}"]`).getBoundingClientRect();
      const vp = document.querySelector(".town-viewport");
      const r = vp.getBoundingClientRect();
      vp.scrollLeft += (Math.min(ra.left, rb.left) + Math.max(ra.right, rb.right)) / 2 - (r.left + r.width / 2);
      vp.scrollTop += (Math.min(ra.top, rb.top) + Math.max(ra.bottom, rb.bottom)) / 2 - (r.top + r.height / 2);
    },
    { a, b },
  );
  await page.waitForTimeout(120);
}
async function clipAround(a, b, pad = 32) {
  return page.evaluate(
    ({ a, b, pad }) => {
      const ra = document.querySelector(`[data-plot-index="${a}"]`).getBoundingClientRect();
      const rb = document.querySelector(`[data-plot-index="${b}"]`).getBoundingClientRect();
      const x = Math.max(0, Math.min(ra.left, rb.left) - pad);
      const y = Math.max(0, Math.min(ra.top, rb.top) - pad);
      return {
        x, y,
        width: Math.min(window.innerWidth, Math.max(ra.right, rb.right) + pad) - x,
        height: Math.min(window.innerHeight, Math.max(ra.bottom, rb.bottom) + pad) - y,
      };
    },
    { a, b, pad },
  );
}
async function zoomedShot(name, a, b) {
  await page.locator(".town-zoom-toggle").click();
  await page.waitForTimeout(200);
  await centerOnCells(a, b);
  await shot(name, { clip: await clipAround(a, b) });
  await page.locator(".town-zoom-toggle").click();
  await page.waitForTimeout(200);
}

await zoomedShot("03-fusion-before-two-lv5", CELL_A, CELL_B);
await page.locator(`[data-plot-index="${CELL_A}"]`).click();
await page.waitForSelector(".entry-sheet-title");
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
await page.locator(`[data-plot-index="${CELL_B}"]`).click();
await page.waitForSelector("text=건물을 융합할까요?");
await page.getByRole("button", { name: "합치기" }).click();
await page.waitForTimeout(400);
const freedCellEmpty = (await page.locator(`[data-plot-index="${CELL_B}"] .building-tile`).count()) === 0;
await zoomedShot("04-fusion-after-lv6-freed-cell", CELL_A, CELL_B);

await browser.close();

const findings = {
  base: BASE,
  note: "Town laid out by the REAL placeNew via the mixedFootprints fixture — not a mock. Level overlay only.",
  town,
  fusion: { beforeLevel: "Lv.5", freedCell: CELL_B, freedCellEmptyAfter: freedCellEmpty },
  consoleErrorCount: consoleErrors.length,
  consoleErrors,
  shots,
};
writeFileSync(`${OUT}findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
