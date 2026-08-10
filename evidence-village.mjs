// Live-browser evidence run for ADDENDUM-05 (village life): the six director
// asks — animal NPCs, a wider town, real building illustrations, BGM, the
// currency/shop, and the NPC count rule.
//
// Not part of the build or the gate. `playwright` is deliberately NOT a
// dependency of this app — run it against an existing install:
//   npm run dev                       # separate terminal, serves :5173
//   NODE_PATH=<path-to-a-node_modules-with-playwright> node evidence-village.mjs
// `playwright` is deliberately not a dependency of this app, and NODE_PATH does
// not apply to ESM resolution — so point PW_PACKAGE at an existing install:
//   PW_PACKAGE=<abs path>/node_modules/playwright/index.mjs node evidence-village.mjs
const { chromium } = await import(process.env.PW_PACKAGE ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "docs/qa/evidence-addendum05";
mkdirSync(OUT, { recursive: true });

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

// ── onboarding ───────────────────────────────────────────────────────────────
await page.getByRole("button", { name: "다음", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "다음", exact: true }).click();
await page.waitForTimeout(200);
await page.locator(".onboarding-card input").first().fill("800000");
await page.getByRole("button", { name: "시작하기", exact: true }).click();
await page.waitForTimeout(600);

// ── F-EXP: the town is 8 plot columns wide ───────────────────────────────────
findings.gridTemplateColumnCount = await page.evaluate(() => {
  const g = document.querySelector(".town-grid");
  return getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
});
findings.hasViewportWrapper = (await page.locator(".town-viewport").count()) === 1;
findings.zoomToggleLabelInitial = await page.locator(".town-zoom-toggle").getAttribute("aria-label");

// ── F-NPC: an empty town still has exactly 1 NPC (the "base 1") ──────────────
findings.npcCountAtZeroBuildings = await page.locator(".npc-layer .npc-slot").count();
await page.screenshot({ path: `${OUT}/01-empty-town-8col-one-npc.png` });

// ── build six buildings across six categories ────────────────────────────────
async function typeAmount(digits) {
  for (const d of digits) {
    await page.locator(`.entry-keypad td[role="button"][aria-label="${d}"]`).click();
  }
}
async function addEntry(amountDigits, categoryLabel) {
  await page.locator(".town-fab").click();
  await page.waitForTimeout(250);
  await typeAmount(amountDigits);
  await page.locator(".category-grid button", { hasText: categoryLabel }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForTimeout(450);
  const buildNew = page.getByRole("button", { name: "새로 짓기", exact: true });
  if ((await buildNew.count()) > 0) {
    await buildNew.click();
    await page.waitForTimeout(400);
  }
}

const CATEGORIES = ["식비", "카페", "교통", "쇼핑", "문화", "교육"];
for (const label of CATEGORIES) {
  await addEntry("4500", label);
}

// ── F-BLD: each category renders its own archetype, not a recoloured box ─────
findings.archetypes = await page.evaluate(() =>
  [...document.querySelectorAll(".town-grid .building-tile")].map((el) => el.getAttribute("data-archetype")),
);
findings.distinctArchetypes = [...new Set(findings.archetypes)].length;
findings.buildingsRenderSvg = await page.evaluate(
  () => document.querySelectorAll(".town-grid .building-tile svg").length,
);
findings.buildingsUsingRasterOrRemote = await page.evaluate(
  () => document.querySelectorAll(".town-grid img, .town-grid image").length,
);
await page.screenshot({ path: `${OUT}/02-town-six-category-buildings.png` });

// ── F-NPC count rule: 1 + buildings ──────────────────────────────────────────
findings.buildingCount = await page.evaluate(() => document.querySelectorAll(".town-grid .building-tile").length);
findings.npcCountAfterSixBuildings = await page.locator(".npc-layer .npc-slot").count();
findings.npcRuleHolds = findings.npcCountAfterSixBuildings === 1 + findings.buildingCount;

// ── F-NPC movement: sprites actually walk ────────────────────────────────────
const readNpcTransforms = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".npc-layer .npc-slot")].map((el) => `${el.style.left}|${el.style.top}`),
  );
const npcBefore = await readNpcTransforms();
await page.waitForTimeout(6000); // > 2 steps at 2.5s
const npcAfter = await readNpcTransforms();
findings.npcMovedCount = npcBefore.filter((t, i) => t !== npcAfter[i]).length;
findings.npcMoved = findings.npcMovedCount > 0;
await page.screenshot({ path: `${OUT}/03-npcs-after-walking.png` });

// ── NPCs must never swallow a tap (pointer-events: none) ─────────────────────
findings.npcLayerPointerEvents = await page.evaluate(
  () => getComputedStyle(document.querySelector(".npc-layer")).pointerEvents,
);
findings.npcLayerIsLastGridChild = await page.evaluate(() =>
  document.querySelector(".town-grid").lastElementChild.classList.contains("npc-layer"),
);

// ── F-EXP: zoom-to-fit toggle ────────────────────────────────────────────────
await page.locator(".town-zoom-toggle").click();
await page.waitForTimeout(400);
findings.zoomToggleAriaPressedAfterClick = await page.locator(".town-zoom-toggle").getAttribute("aria-pressed");
findings.gridTransformWhenZoomedOut = await page.evaluate(
  () => getComputedStyle(document.querySelector(".town-grid")).transform,
);
await page.screenshot({ path: `${OUT}/04-town-zoomed-out-full-width.png` });
await page.locator(".town-zoom-toggle").click();
await page.waitForTimeout(300);

// ── F-BGM: the header mute toggle, and that it persists ──────────────────────
const bgmBtn = page.locator(".town-header-bgm-toggle").first();
findings.bgmToggleFound = (await bgmBtn.count()) > 0;
if (findings.bgmToggleFound) {
  findings.bgmPressedBefore = await bgmBtn.getAttribute("aria-pressed");
  await bgmBtn.click();
  await page.waitForTimeout(300);
  findings.bgmPressedAfter = await bgmBtn.getAttribute("aria-pressed");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  findings.bgmPressedAfterReload = await page
    .locator(".town-header-bgm-toggle")
    .first()
    .getAttribute("aria-pressed");
  findings.bgmPersisted = findings.bgmPressedAfter === findings.bgmPressedAfterReload;
}
await page.screenshot({ path: `${OUT}/05-bgm-toggle-state.png` });

// ── F-ECON: seeds were actually earned by logging ────────────────────────────
findings.seedsEarnedFromLogging = await page.evaluate(() => {
  const raw = localStorage.getItem("ait.v1.economy");
  return raw ? JSON.parse(raw).seeds : null;
});

// Top the balance up so the purchase path itself can be exercised in one run
// (six builds earn far less than the cheapest cosmetic, by design — the
// catalogue is paced in weeks, not minutes). The purchase below is real.
await page.evaluate(() => {
  const raw = localStorage.getItem("ait.v1.economy");
  const eco = raw ? JSON.parse(raw) : null;
  if (eco) {
    eco.seeds = 5000;
    localStorage.setItem("ait.v1.economy", JSON.stringify(eco));
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

// ── F-ECON: the shop ─────────────────────────────────────────────────────────
await page.locator(".shop-fab").click();
await page.waitForTimeout(500);
findings.shopOpened = (await page.locator(".shop-sheet-body").count()) > 0;
findings.shopSectionCount = await page.locator(".shop-section").count();
findings.shopSkuCount = await page.locator(".shop-row-list li").count();
findings.shopBalanceText = await page.locator(".shop-balance").innerText();
await page.screenshot({ path: `${OUT}/06-shop-sheet.png` });

// Buy the first affordable item for real.
const buyBtn = page.locator(".shop-row-buy:not(.shop-row-buy--unaffordable)").first();
findings.buyButtonLabel = await buyBtn.innerText();
await buyBtn.click();
await page.waitForTimeout(600);
findings.shopBalanceAfterPurchase = await page.locator(".shop-balance").innerText();
findings.ownedRowCount = await page.locator(".shop-row-owned").count();
findings.purchaseDeductedSeeds = findings.shopBalanceText !== findings.shopBalanceAfterPurchase;
await page.screenshot({ path: `${OUT}/07-shop-after-purchase.png` });

// Apply a town cosmetic and prove the sky is untouched (R-12).
const skyBefore = await page.evaluate(() => document.querySelector(".town-screen").className);
const applyBtn = page.locator(".shop-row-apply").first();
if ((await applyBtn.count()) > 0) {
  await applyBtn.click();
  await page.waitForTimeout(400);
}
findings.skyClassBefore = skyBefore;
findings.skyClassAfter = await page.evaluate(() => document.querySelector(".town-screen").className);
findings.skyUnchangedByCosmetic = findings.skyClassBefore === findings.skyClassAfter;

// ── F-ECON: the 충전소 stub must never look successful ───────────────────────
const seedsBeforeCharge = await page.evaluate(() => JSON.parse(localStorage.getItem("ait.v1.economy")).seeds);
await page.locator(".shop-charge-entry").click();
// The charge sheet opens only after the shop has finished closing (see
// TownScreen's `chargePending` — the two back guards must not overlap).
await page.waitForTimeout(1200);
findings.chargeSheetOpened = (await page.locator(".charge-stub-banner").count()) > 0;
await page.screenshot({ path: `${OUT}/08-charge-sheet-stub.png` });
const chargeCta = page.locator(".charge-buy-btn").first();
if ((await chargeCta.count()) > 0) {
  await chargeCta.click();
  await page.waitForTimeout(500);
}
findings.chargeStubMessageShown = (await page.getByText("토스 결제 연동은 추후 지원됩니다").count()) > 0;
findings.seedsAfterCharge = await page.evaluate(() => JSON.parse(localStorage.getItem("ait.v1.economy")).seeds);
findings.chargeGrantedNothing = seedsBeforeCharge === findings.seedsAfterCharge;
await page.screenshot({ path: `${OUT}/09-charge-tapped-stub-message.png` });

findings.consoleErrors = [...new Set(consoleErrors)];

writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));

await browser.close();
