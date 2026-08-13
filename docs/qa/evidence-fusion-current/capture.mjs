// Re-capture of docs/qa/evidence-fusion-final's fusion evidence, now that
// buildings GROW TALLER with level and carry a roof signboard (commits
// 4f3096b, 66d10e3, 7fdc885, 255d0fc) — that run predated the height/sign
// change and shows the old shorter, sign-less buildings. Added here: on-screen
// pixel height of the survivor's art before vs after the fusion, since proving
// the growth is visible on screen is the whole point of the change.
// Same seeding technique, same real TownScreen driven through
// Playwright (not jsdom): two Lv.5 same-category/footprint buildings straight
// into localStorage (24 real entries each would otherwise be needed), reload,
// then real clicks through pick mode -> confirm -> fusion.
//
// Difference from evidence-fusion-ui/capture.mjs: this run also toggles the
// grid's own `.town-zoom-toggle` (App default is zoomed-to-fit, which shrinks
// a 40px tile to ~16px — illegible) to native 100% scale and clips the
// screenshot tightly around the two building tiles, because these shots are
// for the user's visual approval of the ART, not just interaction proof.
//
// Usage:
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
mkdirSync(OUT, { recursive: true });

// Same first-4 buildable ground cells townLayout.ts's isBuildable yields
// (ADDENDUM-08), derived the same way evidence-fusion-ui/capture.mjs derived
// CELL_A/CELL_B: `npx tsx -e "...isBuildable..."` against real source.
const CELL_A = 7;
const CELL_B = 8;
// Optional higher-tier example pair — already-fused (fuse:1 => Lv.6) so
// fusing them lands on Lv.7 without a second real fusion's worth of setup.
const CELL_C = 9;
const CELL_D = 10;
const MAX_LEVEL = 5; // BALANCE.maxLevel (frozen, balance.approved.ts)
const EXP_PER_LEVEL = 3; // BALANCE.expPerLevel (frozen, balance.approved.ts)
const MAXED_EXP = (MAX_LEVEL - 1) * EXP_PER_LEVEL; // Lv.5

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto(BASE, { waitUntil: "networkidle" });

const today = await page.evaluate(() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
});
const ym = today.slice(0, 7);

await page.evaluate(
  ({ today, ym, CELL_A, CELL_B, CELL_C, CELL_D, MAXED_EXP }) => {
    // createdAt must be UNIQUE per building (real buildings get a Date.now()
    // timestamp) — reusing 1/2/1/2 across the two pairs broke candidate-tap
    // resolution during capture (repro'd in isolation: same seed minus the
    // duplicate createdAt values fixes it). Not an app defect, a fixture bug.
    const order = { "fuse-a": 1, "fuse-b": 2, "fuse-c": 3, "fuse-d": 4 };
    const building = (id, plotIndex, fuse) => ({
      id,
      source: { kind: "entry", entryId: `e-${id}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex,
      builtOn: today,
      createdAt: order[id],
      exp: MAXED_EXP,
      ...(fuse ? { fuse } : {}),
    });
    localStorage.setItem(
      "ait.v1.index",
      JSON.stringify({ schemaVersion: 1, layoutVersion: 1, entryMonths: [], buildingMonths: [ym] }),
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
    localStorage.setItem(
      `ait.v1.buildings.${ym}`,
      JSON.stringify([
        building("fuse-a", CELL_A),
        building("fuse-b", CELL_B),
        // already Lv.6 (fuse:1) — fusing this pair reaches Lv.7 for the optional shot
        building("fuse-c", CELL_C, 1),
        building("fuse-d", CELL_D, 1),
      ]),
    );
  },
  { today, ym, CELL_A, CELL_B, CELL_C, CELL_D, MAXED_EXP },
);

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".town-grid");

const shots = [];
async function shot(name, opts) {
  await page.waitForTimeout(350); // let BottomSheet/toast slide-in transitions settle before capturing
  const path = `${OUT}${name}.png`;
  await page.screenshot({ path, ...opts });
  shots.push(name);
}

// Center the viewport on the midpoint of two plot tiles — scrollIntoView
// only guarantees ONE element is visible ("nearest"), which can leave its
// 46px-away neighbor cut off past the viewport edge.
async function centerOnCells(cellA, cellB) {
  await page.evaluate(
    ({ cellA, cellB }) => {
      const a = document.querySelector(`[data-plot-index="${cellA}"]`);
      const b = document.querySelector(`[data-plot-index="${cellB}"]`);
      const viewport = document.querySelector(".town-viewport");
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const vp = viewport.getBoundingClientRect();
      const midX = (Math.min(ra.left, rb.left) + Math.max(ra.right, rb.right)) / 2;
      const midY = (Math.min(ra.top, rb.top) + Math.max(ra.bottom, rb.bottom)) / 2;
      viewport.scrollLeft += midX - (vp.left + vp.width / 2);
      viewport.scrollTop += midY - (vp.top + vp.height / 2);
    },
    { cellA, cellB },
  );
  await page.waitForTimeout(100);
}

// clip tight around two plot tiles + padding, so the building art reads
// clearly at phone-screen size instead of shrinking into the whole-map fit.
// Clamped to the viewport's own bounds — an unclamped clip that pokes past
// the edge produces a truncated/garbage screenshot instead of erroring.
// pad raised from evidence-fusion-final's 28 to 64: the art now stands TALLER
// than its tile (Lv.5 = 60px art in a 40px tile, Lv.7 = 70px), so a pad sized
// to the tile rect alone would shear the roof signboard off the top.
async function clipAroundCells(cellA, cellB, pad = 64) {
  return page.evaluate(
    ({ cellA, cellB, pad }) => {
      const ra = document.querySelector(`[data-plot-index="${cellA}"]`).getBoundingClientRect();
      const rb = document.querySelector(`[data-plot-index="${cellB}"]`).getBoundingClientRect();
      const x = Math.max(0, Math.min(ra.left, rb.left) - pad);
      const y = Math.max(0, Math.min(ra.top, rb.top) - pad);
      const right = Math.min(window.innerWidth, Math.max(ra.right, rb.right) + pad);
      const bottom = Math.min(window.innerHeight, Math.max(ra.bottom, rb.bottom) + pad);
      return { x, y, width: right - x, height: bottom - y };
    },
    { cellA, cellB, pad },
  );
}

// Every CLICK below happens at the app's default zoomed-to-fit scale — the
// same scale evidence-fusion-ui/capture.mjs proved the whole interaction
// flow works at. The zoom toggle is only touched transiently, bracketing a
// single clipped screenshot, then flipped straight back before the next
// click — mixing native-scale clicking into the flow scrolled tiles
// unpredictably and silently dropped the candidate tap (see git history: the
// first attempt at this script did that and hung on the confirm dialog).
// On-screen pixel height of the building art in a cell, measured at native
// 100% zoom so before/after are directly comparable (the whole point of the
// 2026-08-13 "buildings grow taller with level" instruction). Tile height is
// reported alongside because the art now deliberately overhangs its cell.
async function measureCell(cell) {
  return page.evaluate((cell) => {
    const tile = document.querySelector(`[data-plot-index="${cell}"]`);
    const svg = tile?.querySelector(".building-tile svg") ?? tile?.querySelector("svg");
    const sign = svg?.querySelector('[data-part="signboard"]');
    const r = svg?.getBoundingClientRect();
    const t = tile?.getBoundingClientRect();
    return {
      artHeightPx: r ? +r.height.toFixed(1) : null,
      artWidthPx: r ? +r.width.toFixed(1) : null,
      tileHeightPx: t ? +t.height.toFixed(1) : null,
      hasSignboard: !!sign,
      signboardHeightPx: sign ? +sign.getBoundingClientRect().height.toFixed(1) : null,
    };
  }, cell);
}

async function zoomedShot(name, cellA, cellB, measureCellIndex) {
  await page.locator(".town-zoom-toggle").click(); // -> native 100%
  await page.waitForTimeout(150);
  await centerOnCells(cellA, cellB);
  const measurement = measureCellIndex === undefined ? null : await measureCell(measureCellIndex);
  const clip = await clipAroundCells(cellA, cellB);
  await shot(name, { clip });
  await page.locator(".town-zoom-toggle").click(); // -> back to 전체 보기 (fit)
  await page.waitForTimeout(150);
  return measurement;
}

// 1) Before — two Lv.5 cafe buildings, final art, zoomed for legibility.
const beforeMeasure = await zoomedShot("01-before-two-lv5", CELL_A, CELL_B, CELL_A);

// 2) Drive to the confirm dialog (tap building -> 융합하기 -> tap candidate).
await page.locator(`[data-plot-index="${CELL_A}"]`).click();
await page.waitForSelector(".entry-sheet-title");
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
await page.locator(`[data-plot-index="${CELL_B}"]`).click();
await page.waitForSelector("text=건물을 융합할까요?");
await shot("02-confirm");

// 3) Confirm — fusion commits: Lv.6 survivor with final art + freed cell.
await page.getByRole("button", { name: "합치기" }).click();
await page.waitForTimeout(300); // toast + re-render settle
const cellBHasBuilding = await page.locator(`[data-plot-index="${CELL_B}"] .building-tile`).count();
const afterMeasure = await zoomedShot("03-after-lv6", CELL_A, CELL_B, CELL_A);

await page.locator(`[data-plot-index="${CELL_A}"]`).click();
await page.waitForSelector(".entry-sheet-title");
const survivorLevelText = await page.locator(".history-total-value").allTextContents();
await page.getByRole("button", { name: "닫기" }).click(); // dismiss the detail sheet's dimmer
await page.waitForTimeout(200);

// 4) Town context at native 100% — the fit-to-screen view shrinks a 40px tile
// to ~16px, where a 60px-vs-70px height difference is unreadable. Scroll the
// fused survivor's column into view at 1:1 so the tall seeded buildings and
// the shorter stock town buildings a few rows down appear in the same frame.
await page.locator(".town-zoom-toggle").click(); // -> native 100%
await page.waitForTimeout(150);
await page.evaluate((cell) => {
  const vp = document.querySelector(".town-viewport");
  const r = document.querySelector(`[data-plot-index="${cell}"]`).getBoundingClientRect();
  const v = vp.getBoundingClientRect();
  vp.scrollLeft += r.left - v.left - 60; // survivor near the left edge
  vp.scrollTop += r.top - v.top - 40; // its row near the top, rows below in frame
}, CELL_A);
await shot("04-town-overview");
await page.locator(".town-zoom-toggle").click(); // -> back to 전체 보기 (fit)
await page.waitForTimeout(150);

// 4b) Same moment at the app's default fit-to-screen zoom — whole-map context
// (freed cell + survivor in the full town), kept because it is what the user
// actually sees on open.
await shot("04b-town-fit-scale");

// 5) Optional — Lv.6 + Lv.6 fusing to Lv.7, cheap because fuse:1 was seeded
// directly rather than run through a real Lv.5->Lv.6 fusion first.
await page.locator(`[data-plot-index="${CELL_C}"]`).click();
await page.waitForSelector(".entry-sheet-title");
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
await page.locator(`[data-plot-index="${CELL_D}"]`).click();
await page.waitForSelector("text=건물을 융합할까요?");
await page.getByRole("button", { name: "합치기" }).click();
await page.waitForTimeout(300);
const cellDHasBuilding = await page.locator(`[data-plot-index="${CELL_D}"] .building-tile`).count();
const lv7Measure = await zoomedShot("05-optional-lv7", CELL_C, CELL_D, CELL_C);
await page.locator(`[data-plot-index="${CELL_C}"]`).click();
await page.waitForSelector(".entry-sheet-title");
const lv7LevelText = await page.locator(".history-total-value").allTextContents();
await page.getByRole("button", { name: "닫기" }).click();

await browser.close();

const findings = {
  base: BASE,
  today,
  artUnderTest: "4f3096b (height ladder) + 66d10e3/7fdc885 (roof signboard) + 255d0fc (tap-target proof)",
  supersedes: "docs/qa/evidence-fusion-final (captured before the height/signboard change)",
  measurementNote:
    "artHeightPx measured at native 100% zoom (.town-zoom-toggle off), survivor cell only, viewport 390x844 CSS px.",
  primaryFusion: {
    beforeLevel: "Lv.5",
    afterLevel: survivorLevelText[0],
    beforeArt: beforeMeasure,
    afterArt: afterMeasure,
    artHeightGrowthPx: +(afterMeasure.artHeightPx - beforeMeasure.artHeightPx).toFixed(1),
    freedCell: CELL_B,
    freedCellEmptyAfter: cellBHasBuilding === 0,
  },
  optionalHigherTierFusion: {
    beforeLevel: "Lv.6",
    afterLevel: lv7LevelText[0],
    afterArt: lv7Measure,
    freedCell: CELL_D,
    freedCellEmptyAfter: cellDHasBuilding === 0,
  },
  consoleErrorCount: consoleErrors.length,
  consoleErrors,
  shots,
};
writeFileSync(`${OUT}findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
