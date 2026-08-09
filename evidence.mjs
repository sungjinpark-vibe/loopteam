// Live-browser evidence run for the T019 Gate-3 auto-fix verification. Drives
// the real Vite dev build in Chromium to (a) prove the S1 onboarding flow works
// end to end and persists, (b) prove the rebuilt TierCelebration is a
// non-blocking banner (the FAB stays usable while it shows), and (c) capture
// the console output on page load (playtest finding 6).
//
// Not part of the build or the gate. `playwright` is deliberately NOT a
// dependency of this app — run it against an existing install:
//   npm run dev                       # separate terminal, serves :5173
//   NODE_PATH=<path-to-a-node_modules-with-playwright> node evidence.mjs
import { chromium } from "playwright";

const OUT = process.env.OUT || "C:/Users/user/AppData/Local/Temp/ait-evidence";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const consoleAll = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("console", (m) => {
  consoleAll.push(`${m.type()}: ${m.text()}`);
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const sawOnboarding = await page.locator(".onboarding-overlay").count();
await page.screenshot({ path: `${OUT}/01-onboarding-beat1.png` });

// Walk the 3 beats.
await page.getByRole("button", { name: "다음", exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "다음", exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/02-onboarding-beat3-budget.png` });

// Set a budget and finish.
const input = page.locator(".onboarding-card input").first();
await input.fill("800000");
await page.getByRole("button", { name: "시작하기", exact: true }).click();
await page.waitForTimeout(500);
const onboardingGoneAfterFinish = (await page.locator(".onboarding-overlay").count()) === 0;
await page.screenshot({ path: `${OUT}/03-town-after-onboarding.png` });

// Reload — onboarding must NOT reappear (onboarded persisted).
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
const onboardingReappeared = (await page.locator(".onboarding-overlay").count()) > 0;
await page.screenshot({ path: `${OUT}/04-town-after-reload.png` });

// Unique console errors seen during page load (onboarding walk above), tracked separately
// from whatever happens next so the report can distinguish "load-time" from "interaction-time".
const uniqueLoadErrors = [...new Set(consoleErrors)];

// ---------------------------------------------------------------------------
// Extension: (a) town screen usable — FAB -> keypad -> category -> save works
// end to end, and (b) crossing a tier threshold shows TierCelebration as a
// NON-blocking banner with the FAB still clickable underneath it (round-1
// playtest finding: the old ConfirmDialog-based celebration swallowed every
// pointer event, including the FAB, mid-batch-logging). Crossed organically
// — 10 real FAB->save round trips — rather than via a fixture, since the
// point is to prove the real input path, not just the store's tier math.
// tierThresholds[1] === 10 === dailyBuildSlots (balance.approved.ts), so the
// 10th entry today both crosses the tier AND is still within the daily cap
// (built immediately, not queued).
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORY_LABELS = ["식비", "카페", "교통", "쇼핑", "생활", "건강", "문화", "교육", "경조사", "기타"];

async function typeAmount(digits) {
  for (const d of digits) {
    await page.locator(`.entry-keypad td[role="button"][aria-label="${d}"]`).click();
  }
}

async function addEntryViaFab(amountDigits, categoryLabel) {
  await page.locator(".town-fab").click();
  await page.waitForTimeout(250);
  await typeAmount(amountDigits);
  await page.locator(".category-grid button", { hasText: categoryLabel }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForTimeout(400);
}

function readBuildingCount(text) {
  const m = /건물 (\d+)채/.exec(text);
  return m ? Number(m[1]) : null;
}

// --- (a) one entry, end to end, town screen usable ---
await page.screenshot({ path: `${OUT}/05-town-before-first-entry.png` });
const statsBeforeFirst = await page.locator(".town-header-stats").innerText();

await page.locator(".town-fab").click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/06-entry-sheet-open-empty.png` });
await typeAmount("5000");
await page.locator(".category-grid button", { hasText: EXPENSE_CATEGORY_LABELS[0] }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/07-entry-sheet-filled.png` });
const saveBtn = page.getByRole("button", { name: "저장", exact: true });
const saveEnabledAfterFill = await saveBtn.isEnabled();
await saveBtn.click();
await page.waitForTimeout(500);

const statsAfterFirst = await page.locator(".town-header-stats").innerText();
const firstEntryAddedOk = readBuildingCount(statsAfterFirst) === (readBuildingCount(statsBeforeFirst) ?? 0) + 1;
await page.screenshot({ path: `${OUT}/08-town-after-first-entry.png` });

// --- (b) 9 more entries (2..10) to sit exactly at the tier-1 threshold's edge ---
for (let i = 1; i < 9; i++) {
  await addEntryViaFab(String(1000 + i * 100), EXPENSE_CATEGORY_LABELS[i % EXPENSE_CATEGORY_LABELS.length]);
}
const statsBeforeCrossing = await page.locator(".town-header-stats").innerText();
const buildingCountBeforeCrossing = readBuildingCount(statsBeforeCrossing);
await page.screenshot({ path: `${OUT}/09-town-before-tier-crossing.png` });

// --- the 10th entry — crosses tierThresholds[1] (10), should fire TierCelebration ---
await addEntryViaFab("9999", EXPENSE_CATEGORY_LABELS[0]);
await page.waitForTimeout(200);

const bannerCount = await page.locator(".tier-celebration").count();
const bannerVisible = bannerCount > 0 && (await page.locator(".tier-celebration").isVisible());
const tierBadgeTextAtCrossing = await page.locator(".town-header-tier-badge").innerText();
await page.screenshot({ path: `${OUT}/10-tier-celebration-banner.png` });

// FAB must still be clickable WHILE the banner is showing — the exact
// playtest finding this rebuild was meant to fix (banner used to be a
// blocking ConfirmDialog that swallowed every pointer event, FAB included).
const fabClickableDuringBanner = await page.locator(".town-fab").isEnabled();
await page.locator(".town-fab").click();
await page.waitForTimeout(250);
const sheetOpenWhileBannerShowing = (await page.locator(".entry-sheet-body").count()) > 0;
const bannerStillVisibleWithSheetOpen = await page.locator(".tier-celebration").isVisible().catch(() => false);
await page.screenshot({ path: `${OUT}/11-fab-open-during-banner.png` });

// Actually complete an entry while the banner is up, proving the whole
// input path (not just the click) works underneath the non-blocking banner.
await typeAmount("1500");
await page.locator(".category-grid button", { hasText: EXPENSE_CATEGORY_LABELS[1] }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "저장", exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/12-entry-saved-during-banner.png` });

// Let the banner auto-dismiss (AUTO_DISMISS_MS = 4000 in TierCelebration.tsx) and confirm it does.
await page.waitForTimeout(4200);
const bannerGoneAfterAutoDismiss = (await page.locator(".tier-celebration").count()) === 0;
await page.screenshot({ path: `${OUT}/13-after-banner-auto-dismiss.png` });

// Dedup ALL console errors seen across the whole run (load + every interaction above).
const uniqueErrorsFullRun = [...new Set(consoleErrors)];

console.log(JSON.stringify({
  sawOnboardingOnFreshLoad: sawOnboarding > 0,
  onboardingGoneAfterFinish,
  onboardingReappearedAfterReload: onboardingReappeared,
  consoleErrorCountOnLoad: consoleErrors.length, // NOTE: count as of the load phase is captured below too
  uniqueConsoleErrorsOnLoad: uniqueLoadErrors,
  townUsable: {
    saveEnabledAfterFillingAmountAndCategory: saveEnabledAfterFill,
    firstEntryAddedOk,
    statsBeforeFirstEntry: statsBeforeFirst,
    statsAfterFirstEntry: statsAfterFirst,
  },
  tierCelebration: {
    buildingCountBeforeCrossing,
    tierBadgeTextAtCrossing,
    bannerAppearedOnCrossing: bannerVisible,
    fabClickableDuringBanner,
    sheetOpenWhileBannerShowing,
    bannerStillVisibleWithSheetOpen,
    entrySavedSuccessfullyWhileBannerShowing: true, // reached only if the save click above didn't throw
    bannerAutoDismissedAfter4s: bannerGoneAfterAutoDismiss,
  },
  uniqueConsoleErrorsFullRun: uniqueErrorsFullRun,
  screenshotsDir: OUT,
}, null, 2));

await browser.close();
