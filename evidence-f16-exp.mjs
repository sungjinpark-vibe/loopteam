// QA evidence run for ADDENDUM-04 (amount-proportional building EXP) and F16
// (monthly settlement + 기념비 monuments). Drives the real Vite dev build in
// Chromium. Sibling of `evidence.mjs` (unmodified) — same launch contract:
//
//   npm run dev                       # serves :5173
//   PW=<abs path to an existing playwright/index.mjs> node evidence-f16-exp.mjs
//
// (ESM ignores NODE_PATH, so the out-of-tree playwright is reached by absolute
// file URL instead — same "playwright is not a dependency of this app" rule.)
//
// Screenshots land in docs/qa/evidence/. Prints one JSON blob at the end.
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PW = process.env.PW || "C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
const { chromium } = await import(pathToFileURL(PW).href);

const OUT = process.env.OUT || "C:/Users/user/loop_engine/app_in_toss/docs/qa/evidence";
mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const consoleWarnings = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
  if (m.type() === "warning") consoleWarnings.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

async function typeAmount(digits) {
  for (const d of digits) await page.locator(`.entry-keypad td[role="button"][aria-label="${d}"]`).click();
}

/** Opens the FAB sheet, types the amount, picks the category, saves. Leaves any grow dialog untouched. */
async function fillAndSave(amountDigits, categoryLabel) {
  await page.locator(".town-fab").click();
  await page.locator(".entry-keypad").waitFor();
  await typeAmount(amountDigits);
  await page.locator(".category-grid button", { hasText: categoryLabel }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForTimeout(400); // one settle tick; store writes are debounced
}

async function resetToFreshTown() {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".onboarding-overlay").waitFor();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.locator(".onboarding-card input").first().fill("800000");
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.locator(".town-fab").waitFor();
}

/** Ground truth straight out of localStorage: growthScore === buildings.length + Σ exp (ADDENDUM-04 §3). */
async function readGrowth() {
  return page.evaluate(() => {
    const all = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      let v;
      try {
        v = JSON.parse(localStorage.getItem(k) ?? "");
      } catch {
        continue;
      }
      if (Array.isArray(v) && v.every((b) => b && typeof b === "object" && "plotIndex" in b)) all.push(...v);
    }
    return {
      buildingCount: all.length,
      expSum: all.reduce((n, b) => n + (b.exp ?? 0), 0),
      growthScore: all.length + all.reduce((n, b) => n + (b.exp ?? 0), 0),
    };
  });
}

/** plotIndex -> badge text (null when the tile shows no Lv.N badge), for every occupied tile. */
async function readTiles() {
  return page.evaluate(() =>
    [...document.querySelectorAll(".town-tile")]
      .filter((t) => t.querySelector(".building-tile"))
      .map((t) => ({
        plot: Number(t.getAttribute("data-plot-index")),
        badge: t.querySelector(".building-level-badge")?.textContent ?? null,
        floors: t.querySelectorAll(".building-floors").length,
        monument: t.querySelector(".building-monument-period")?.textContent ?? null,
      })),
  );
}

const growBtn = () => page.getByRole("button", { name: "키우기", exact: true });
const buildNewBtn = () => page.getByRole("button", { name: "새로 짓기", exact: true });

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await resetToFreshTown();

// ── S1: small entry (< ₩10,000 -> gain 1 -> exp 0 -> Lv.1, no badge) ──
await fillAndSave("5000", "식비");
const s1Tiles = await readTiles();
const s1Growth = await readGrowth();
await shot("s1-small-entry");

// ── S2: large entry (₩200,000 -> gain 5 -> founding exp 4 -> Lv.2) ──
const beforeS2 = new Set((await readTiles()).map((t) => t.plot));
await fillAndSave("200000", "카페");
const s2Tiles = await readTiles();
const s2New = s2Tiles.find((t) => !beforeS2.has(t.plot)) ?? null;
const s2Growth = await readGrowth();
await shot("s2-large-entry-founded");

// ── S3a: grow parity — same category again, pick 기존 건물 키우기 ──
const s3GrowthBefore = await readGrowth();
const s3TierBefore = await page.locator(".town-header-tier-badge").innerText();
const s3StatsBefore = await page.locator(".town-header-stats").innerText();
await fillAndSave("250000", "카페");
const s3DialogShown = (await growBtn().count()) > 0 && (await buildNewBtn().count()) > 0;
await shot("s3-grow-dialog");
await growBtn().click();
await page.waitForTimeout(500);
const s3Tiles = await readTiles();
const s3Host = s3Tiles.find((t) => t.plot === s2New?.plot) ?? null;
const s3GrowthAfter = await readGrowth();
const s3TierAfter = await page.locator(".town-header-tier-badge").innerText();
const s3StatsAfter = await page.locator(".town-header-stats").innerText();
await shot("s3-after-grow");

// ── S3b: the parity counterfactual — identical town, 새로 짓기 instead ──
await resetToFreshTown();
await fillAndSave("5000", "식비");
await fillAndSave("200000", "카페");
const s3bGrowthBefore = await readGrowth();
await fillAndSave("250000", "카페");
await buildNewBtn().click();
await page.waitForTimeout(500);
const s3bGrowthAfter = await readGrowth();
await shot("s3b-after-build-new");

// ── S4: F16 settlement — `unsettled` fixture, lastSettledPeriod 3 months stale ──
await page.evaluate(() => window.__aitLoadFixture("unsettled")).catch(() => {});
await page.waitForLoadState("networkidle");
await page.locator(".town-fab").waitFor();
await page.waitForTimeout(600);
const s4Monuments = (await readTiles()).filter((t) => t.monument !== null);
const s4CardCount = await page.locator(".tier-celebration").count();
const s4CardText = s4CardCount > 0 ? await page.locator(".tier-celebration").innerText() : null;
await shot("s4-monuments-and-settlement-card");

// ── S6 (before dismissing anything): tap a monument ──
const s6Plot = s4Monuments[0]?.plot;
if (s6Plot !== undefined) await page.locator(`.town-tile[data-plot-index="${s6Plot}"]`).click();
await page.waitForTimeout(500);
const s6SheetText = await page
  .locator(".entry-sheet-body")
  .first()
  .innerText()
  .catch(() => null);
const s6HeaderText = await page
  .locator(".entry-sheet-title")
  .first()
  .innerText()
  .catch(() => null);
await shot("s6-monument-detail");
await page
  .getByRole("button", { name: "닫기", exact: true })
  .last()
  .click()
  .catch(() => {});
await page.waitForTimeout(300);

// ── S5: dismiss the card, reload, nothing new is minted and no card returns ──
await page
  .locator(".tier-celebration-dismiss")
  .click()
  .catch(() => {});
await page.waitForTimeout(300);
await page.reload({ waitUntil: "networkidle" });
await page.locator(".town-fab").waitFor();
await page.waitForTimeout(800);
const s5Monuments = (await readTiles()).filter((t) => t.monument !== null);
const s5CardCount = await page.locator(".tier-celebration").count();
await shot("s5-after-reload-idempotent");

console.log(
  JSON.stringify(
    {
      S1_smallEntry: {
        tiles: s1Tiles,
        growth: s1Growth,
        expectation: "1 building, badge null (gain 1 -> exp 0 -> Lv.1)",
      },
      S2_largeEntry: {
        newTile: s2New,
        allTiles: s2Tiles,
        growth: s2Growth,
        expectation: "badge 'Lv.2' (₩200,000 -> gain 5 -> founding exp 4)",
      },
      S3a_growParity: {
        dialogShown: s3DialogShown,
        hostTileAfterGrow: s3Host,
        growthBefore: s3GrowthBefore,
        growthAfter: s3GrowthAfter,
        growthDelta: s3GrowthAfter.growthScore - s3GrowthBefore.growthScore,
        tierBefore: s3TierBefore,
        tierAfter: s3TierAfter,
        statsBefore: s3StatsBefore,
        statsAfter: s3StatsAfter,
      },
      S3b_buildNewCounterfactual: {
        growthBefore: s3bGrowthBefore,
        growthAfter: s3bGrowthAfter,
        growthDelta: s3bGrowthAfter.growthScore - s3bGrowthBefore.growthScore,
      },
      S4_monuments: {
        count: s4Monuments.length,
        periods: s4Monuments.map((m) => m.monument),
        plots: s4Monuments.map((m) => m.plot),
        settlementCardCount: s4CardCount,
        settlementCardText: s4CardText,
      },
      S5_idempotency: {
        monumentCountAfterReload: s5Monuments.length,
        periodsAfterReload: s5Monuments.map((m) => m.monument),
        settlementCardCountAfterReload: s5CardCount,
      },
      S6_monumentDetail: { header: s6HeaderText, body: s6SheetText },
      S7_console: {
        errors: [...new Set(consoleErrors)],
        warnings: [...new Set(consoleWarnings)],
      },
      screenshotsDir: OUT,
    },
    null,
    2,
  ),
);

await browser.close();
