// Re-capture of docs/qa/evidence-fusion-ui's fusion evidence, now that the
// Lv.6-10 building art landed (commits d0e7abc, 87241b4) — that run predated
// the art and showed the old placeholder look (see its README's closing
// note). Same seeding technique, same real TownScreen driven through
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
async function clipAroundCells(cellA, cellB, pad = 28) {
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
async function zoomedShot(name, cellA, cellB) {
  await page.locator(".town-zoom-toggle").click(); // -> native 100%
  await page.waitForTimeout(150);
  await centerOnCells(cellA, cellB);
  const clip = await clipAroundCells(cellA, cellB);
  await shot(name, { clip });
  await page.locator(".town-zoom-toggle").click(); // -> back to 전체 보기 (fit)
  await page.waitForTimeout(150);
}

// 1) Before — two Lv.5 cafe buildings, final art, zoomed for legibility.
await zoomedShot("01-before-two-lv5", CELL_A, CELL_B);

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
await zoomedShot("03-after-lv6", CELL_A, CELL_B);

await page.locator(`[data-plot-index="${CELL_A}"]`).click();
await page.waitForSelector(".entry-sheet-title");
const survivorLevelText = await page.locator(".history-total-value").allTextContents();
await page.getByRole("button", { name: "닫기" }).click(); // dismiss the detail sheet's dimmer
await page.waitForTimeout(200);

// 4) Town overview — whole map at its default readable fit-to-screen zoom,
// after the fusion (freed cell + Lv.6 survivor visible in context).
await shot("04-town-overview");

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
await zoomedShot("05-optional-lv7", CELL_C, CELL_D);
await page.locator(`[data-plot-index="${CELL_C}"]`).click();
await page.waitForSelector(".entry-sheet-title");
const lv7LevelText = await page.locator(".history-total-value").allTextContents();
await page.getByRole("button", { name: "닫기" }).click();

await browser.close();

const findings = {
  base: BASE,
  today,
  primaryFusion: {
    beforeLevel: "Lv.5",
    afterLevel: survivorLevelText,
    freedCell: CELL_B,
    freedCellEmptyAfter: cellBHasBuilding === 0,
  },
  optionalHigherTierFusion: {
    beforeLevel: "Lv.6",
    afterLevel: lv7LevelText,
    freedCell: CELL_D,
    freedCellEmptyAfter: cellDHasBuilding === 0,
  },
  consoleErrorCount: consoleErrors.length,
  consoleErrors,
  shots,
};
writeFileSync(`${OUT}findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
