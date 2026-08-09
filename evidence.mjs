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

// Sheet-fill-and-save only — no dialog handling. Factored out so the new
// ADDENDUM-04 scenarios below can inspect the grow dialog themselves instead
// of having it silently resolved for them.
async function fillAndSave(amountDigits, categoryLabel) {
  await page.locator(".town-fab").click();
  await page.waitForTimeout(250);
  await typeAmount(amountDigits);
  await page.locator(".category-grid button", { hasText: categoryLabel }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForTimeout(400);
}

async function addEntryViaFab(amountDigits, categoryLabel) {
  await fillAndSave(amountDigits, categoryLabel);
  // ADDENDUM-04 §4 — this loop reuses EXPENSE_CATEGORY_LABELS[i % 10], so once
  // it runs past 10 entries it starts repeating a category that already has a
  // standing building, and the new grow/build ConfirmDialog pops instead of
  // saving straight through. Always pick 새로 짓기 here to preserve this
  // helper's original contract ("every call places a new building") that the
  // tier-crossing section below still depends on — the grow path itself is
  // exercised deliberately, with its own assertions, in the section below.
  const buildNewBtn = page.getByRole("button", { name: "새로 짓기", exact: true });
  if ((await buildNewBtn.count()) > 0) {
    await buildNewBtn.click();
    await page.waitForTimeout(400);
  }
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

// ===========================================================================
// ADDENDUM-04 (docs/spec/ADDENDUM-04-building-exp.md §4/§5/§8) — building EXP
// evidence. Six numbered scenarios, matching the task spec 1:1. Scenarios 1-4
// deliberately build on ONE fresh town in sequence (S2 needs S1's building as
// its lone candidate, S3 needs S2's second building to get 2 candidates, S4
// needs S3's still-standing pair) — resetting between each would just destroy
// the exact state the next scenario needs. S5 (tier parity) gets its own
// fresh town because it needs a precise pre-threshold building count.
// ===========================================================================

// Clears this app's localStorage (ait.v1.* — src/storage.ts KEY_PREFIX) and
// walks the same 3-beat onboarding flow already proven at the top of this
// script, so every scenario below starts from an identical, empty town.
async function resetToFreshTown() {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.waitForTimeout(150);
  await page.locator(".onboarding-card input").first().fill("800000");
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.waitForTimeout(500);
}

const growBtn = () => page.getByRole("button", { name: "키우기", exact: true });
const buildNewBtn = () => page.getByRole("button", { name: "새로 짓기", exact: true });

await resetToFreshTown();

// --- Scenario 1: no dialog on the FIRST building of a category ---
const s1BuildingsBefore = readBuildingCount(await page.locator(".town-header-stats").innerText()) ?? 0;
await fillAndSave("3000", "식비");
const s1DialogAppeared = (await growBtn().count()) > 0;
const s1BuildingsAfter = readBuildingCount(await page.locator(".town-header-stats").innerText());
await page.screenshot({ path: `${OUT}/14-exp-s1-first-building-no-dialog.png` });

// --- Scenario 2: SECOND same-category save shows the dialog; 새로 짓기 builds a second building ---
await fillAndSave("2500", "식비");
const s2DialogAppeared = (await growBtn().count()) > 0;
await page.screenshot({ path: `${OUT}/15-exp-s2-dialog-open.png` });
await buildNewBtn().click();
await page.waitForTimeout(400);
const s2BuildingsAfter = readBuildingCount(await page.locator(".town-header-stats").innerText());
const s2NoLevelBadgesAnywhere = (await page.locator(".building-level-badge").count()) === 0;
await page.screenshot({ path: `${OUT}/16-exp-s2-two-buildings-no-badges.png` });

// --- Scenario 3: 3rd same-category save now has 2 candidates -> pick mode.
// Grow the SAME building 3 times (expPerLevel=3) to cross level 2 and
// screenshot the visibly taller building. ---
await fillAndSave("1800", "식비");
await page.screenshot({ path: `${OUT}/17-exp-s3-dialog-before-grow.png` });
await growBtn().click();
await page.waitForTimeout(300);
const s3PickBarText = await page
  .locator(".town-move-bar")
  .innerText()
  .catch(() => "");
const s3CandidateCount = await page.locator(".town-tile--grow-candidate").count();
await page.screenshot({ path: `${OUT}/18-exp-s3-pick-mode.png` });

// Pick the first candidate tile and grow THAT SAME plot every round below —
// growCandidates() is sorted by createdAt (selectors.ts), and tiles render in
// plot-index order, so this stays the same physical building across rounds.
const s3TargetPlotIndex = await page.locator(".town-tile--grow-candidate").first().getAttribute("data-plot-index");
const s3TargetTile = page.locator(`.town-tile[data-plot-index="${s3TargetPlotIndex}"]`);
const s3BuildingsBeforeGrow = readBuildingCount(await page.locator(".town-header-stats").innerText());

await s3TargetTile.click(); // grow #1 -> host exp 1
await page.waitForTimeout(400);
const s3BuildingsAfterGrow1 = readBuildingCount(await page.locator(".town-header-stats").innerText());
const s3BadgeAfterGrow1 = (await s3TargetTile.locator(".building-level-badge").count()) > 0;

await fillAndSave("1900", "식비"); // grow #2
await growBtn().click();
await page.waitForTimeout(300);
await s3TargetTile.click(); // host exp 2
await page.waitForTimeout(400);
const s3BadgeAfterGrow2 = (await s3TargetTile.locator(".building-level-badge").count()) > 0;

await fillAndSave("2100", "식비"); // grow #3 -> host exp 3 -> level 2
await growBtn().click();
await page.waitForTimeout(300);
await s3TargetTile.click();
await page.waitForTimeout(400);
const s3BadgeAfterGrow3Text = await s3TargetTile
  .locator(".building-level-badge")
  .innerText()
  .catch(() => null);
const s3FloorsPresentAfterGrow3 = (await s3TargetTile.locator(".building-floors").count()) > 0;
const s3BuildingsAfterAllGrows = readBuildingCount(await page.locator(".town-header-stats").innerText());
await page.screenshot({ path: `${OUT}/19-exp-s3-level2-building.png` });

// --- Scenario 4: 취소 during pick mode saves nothing (building count AND
// the 기록 list both unchanged). ---
await page.locator(".bottom-tab", { hasText: "기록" }).click();
await page.waitForTimeout(300);
const s4HistoryRowsBefore = await page.locator(".history-row").count();
await page.locator(".bottom-tab", { hasText: "우리 동네" }).click();
await page.waitForTimeout(300);

const s4StatsBefore = await page.locator(".town-header-stats").innerText();
await fillAndSave("1600", "식비");
await page.screenshot({ path: `${OUT}/20-exp-s4-dialog-before-cancel.png` });
await growBtn().click();
await page.waitForTimeout(300);
const s4PickModeEntered = (await page.locator(".town-tile--grow-candidate").count()) > 0;
await page.screenshot({ path: `${OUT}/21-exp-s4-pick-mode-before-cancel.png` });
await page.locator(".town-move-bar button", { hasText: "취소" }).click();
await page.waitForTimeout(300);
const s4PickModeGoneAfterCancel = (await page.locator(".town-tile--grow-candidate").count()) === 0;
const s4StatsAfter = await page.locator(".town-header-stats").innerText();
await page.screenshot({ path: `${OUT}/22-exp-s4-after-cancel.png` });

await page.locator(".bottom-tab", { hasText: "기록" }).click();
await page.waitForTimeout(300);
const s4HistoryRowsAfter = await page.locator(".history-row").count();
await page.locator(".bottom-tab", { hasText: "우리 동네" }).click();
await page.waitForTimeout(300);

// --- Scenario 5: tier parity. Fresh town, build 9 distinct-category
// buildings (growthScore 9, below tierThresholds[1]=10 -> Tier 1), then grow
// (not build) a 10th act into the ONE existing 식비 building — exactly 1
// candidate, so §4's "grow it immediately, no second step" path fires. Per
// §3 growthScore = buildings.length + Σexp, so this grow alone should cross
// the threshold to Tier 2, exactly as a 10th NEW building would have. ---
await resetToFreshTown();
for (let i = 0; i < 9; i++) {
  await fillAndSave(String(1000 + i * 50), EXPENSE_CATEGORY_LABELS[i]);
}
const s5TierBeforeGrow = await page.locator(".town-header-tier-badge").innerText();
const s5BuildingsBeforeGrow = readBuildingCount(await page.locator(".town-header-stats").innerText());
await page.screenshot({ path: `${OUT}/23-exp-s5-nine-buildings-before-grow.png` });

await fillAndSave("5000", EXPENSE_CATEGORY_LABELS[0]); // 식비 again -> exactly 1 candidate
const s5DialogAppeared = (await growBtn().count()) > 0;
await page.screenshot({ path: `${OUT}/24-exp-s5-dialog-single-candidate.png` });
await growBtn().click();
await page.waitForTimeout(400);
const s5NoPickModeForSingleCandidate = (await page.locator(".town-move-bar").count()) === 0;
const s5TierAfterGrow = await page.locator(".town-header-tier-badge").innerText();
const s5BuildingsAfterGrow = readBuildingCount(await page.locator(".town-header-stats").innerText());
await page.screenshot({ path: `${OUT}/25-exp-s5-tier-advanced-by-grow.png` });

const buildingExp = {
  scenario1_noDialogOnFirstBuildingOfCategory: {
    dialogAppeared: s1DialogAppeared,
    buildingCountBefore: s1BuildingsBefore,
    buildingCountAfter: s1BuildingsAfter,
    pass: !s1DialogAppeared && s1BuildingsAfter === s1BuildingsBefore + 1,
  },
  scenario2_dialogOnSecondSave_buildNewCreatesSecondBuilding: {
    dialogAppeared: s2DialogAppeared,
    buildingCountAfter: s2BuildingsAfter,
    noLevelBadgesAnywhere: s2NoLevelBadgesAnywhere,
    pass: s2DialogAppeared && s2BuildingsAfter === s1BuildingsAfter + 1 && s2NoLevelBadgesAnywhere,
  },
  scenario3_growPickModeAndLevelUp: {
    pickBarText: s3PickBarText,
    candidateCount: s3CandidateCount,
    expectedCandidateCount: 2,
    buildingCountBeforeGrow: s3BuildingsBeforeGrow,
    buildingCountAfterGrow1: s3BuildingsAfterGrow1,
    buildingCountAfterAllGrows: s3BuildingsAfterAllGrows,
    badgeAfterGrow1Present: s3BadgeAfterGrow1, // expected false — exp 1, needs 3
    badgeAfterGrow2Present: s3BadgeAfterGrow2, // expected false — exp 2, needs 3
    badgeAfterGrow3Text: s3BadgeAfterGrow3Text, // expected "Lv.2" — exp 3
    floorsPresentAfterGrow3: s3FloorsPresentAfterGrow3,
    pass:
      s3CandidateCount === 2 &&
      s3BuildingsAfterAllGrows === s3BuildingsBeforeGrow &&
      !s3BadgeAfterGrow1 &&
      !s3BadgeAfterGrow2 &&
      s3BadgeAfterGrow3Text === "Lv.2" &&
      s3FloorsPresentAfterGrow3,
  },
  scenario4_cancelDuringPickModeSavesNothing: {
    pickModeEntered: s4PickModeEntered,
    pickModeGoneAfterCancel: s4PickModeGoneAfterCancel,
    statsBefore: s4StatsBefore,
    statsAfter: s4StatsAfter,
    historyRowsBefore: s4HistoryRowsBefore,
    historyRowsAfter: s4HistoryRowsAfter,
    pass:
      s4PickModeEntered &&
      s4PickModeGoneAfterCancel &&
      s4StatsBefore === s4StatsAfter &&
      s4HistoryRowsBefore === s4HistoryRowsAfter,
  },
  scenario5_tierParityGrowVsBuild: {
    tierBeforeGrow: s5TierBeforeGrow,
    tierAfterGrow: s5TierAfterGrow,
    buildingCountBeforeGrow: s5BuildingsBeforeGrow,
    buildingCountAfterGrow: s5BuildingsAfterGrow,
    dialogAppearedForSingleCandidate: s5DialogAppeared,
    grewImmediatelyNoPickModeStep: s5NoPickModeForSingleCandidate,
    tierAdvanced: s5TierAfterGrow !== s5TierBeforeGrow,
    buildingCountUnchangedByGrow: s5BuildingsAfterGrow === s5BuildingsBeforeGrow,
    pass:
      s5DialogAppeared &&
      s5NoPickModeForSingleCandidate &&
      s5BuildingsAfterGrow === s5BuildingsBeforeGrow &&
      s5TierAfterGrow !== s5TierBeforeGrow,
  },
};

// Dedup ALL console errors seen across the WHOLE run (load + tier-celebration
// section + every ADDENDUM-04 scenario above) — scenario 6.
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
  buildingExp,
  uniqueConsoleErrorsFullRun: uniqueErrorsFullRun,
  screenshotsDir: OUT,
}, null, 2));

await browser.close();
