// End-to-end drive of every QA scenario in `docs/qa/SCENARIOS.md`, using ONLY
// the documented invocation an outside agent has: a URL (`?scenario=<name>`)
// and two console calls. Nothing here hand-seeds localStorage — contrast
// `../evidence-fusion-final/capture.mjs`, which had to write four buildings,
// a core blob and an index blob by hand because there was no other way to
// reach a fusable town. That hand-seeding IS the gap this run closes.
//
// Not part of the build or the gate. `playwright` is deliberately NOT a
// dependency of this app — run it against an existing install:
//   npm run dev                       # separate terminal, serves :5173
//   PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:5173
//
// SHARED MACHINE — kill only the dev-server PID you started; never by image name.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const baseIdx = process.argv.indexOf("--base");
const BASE = baseIdx > -1 ? process.argv[baseIdx + 1] : "http://localhost:5173";
const OUT = new URL("./", import.meta.url).pathname.replace(/^\/([a-zA-Z]):/, "$1:");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

const shots = [];
async function shot(name) {
  await page.waitForTimeout(400); // sheets/toasts slide in
  await page.screenshot({ path: `${OUT}${name}.png` });
  shots.push(name);
}

/** The documented one-step invocation. Nothing else may seed state in this file. */
async function scenario(name) {
  await page.goto(`${BASE}/?scenario=${name}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".town-grid, .onboarding, form", { timeout: 15_000 });
  await page.waitForTimeout(700);
}

/** The documented next-morning / month-rollover hop: pin the clock, then reload. */
async function hopTo(date) {
  await page.evaluate((d) => window.__aitSetTimeTravelDate(d), date);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
}

const economy = () =>
  page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem("ait.v1.economy") ?? "null");
    } catch {
      return "UNPARSEABLE";
    }
  });

const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
const buildingTiles = () => page.locator('.town-tile[aria-label^="건물"]');
// The OPEN detail sheet's own 레벨 row. Deliberately not a body-wide /Lv\.\d/
// regex: `document.body.innerText` starts with the grid, so that reads
// whichever level badge renders first (the Lv.4 decoy), not the survivor.
const sheetLevel = async () => (await page.locator(".history-total-value").first().textContent())?.trim() ?? null;

/** Clicks building tiles until one offers 융합하기; leaves that sheet open. Returns its plot index. */
async function openFusableSheet() {
  const tiles = await page.locator(".town-tile[aria-label]").all();
  for (const tile of tiles) {
    const label = await tile.getAttribute("aria-label");
    if (!label?.startsWith("건물")) continue;
    await tile.click();
    await page.waitForSelector(".entry-sheet-title", { timeout: 5000 });
    if ((await page.getByRole("button", { name: "융합하기" }).count()) > 0) {
      return Number(await tile.getAttribute("data-plot-index"));
    }
    await page.getByRole("button", { name: "닫기" }).click();
    await page.waitForTimeout(150);
  }
  return null;
}

const findings = { base: BASE, scenarios: {}, defects: [] };
const note = (id, what) => findings.defects.push({ id, what });

// ───────────────────────── 1. fusion-ready ─────────────────────────
// Both cancel paths first (they must leave the town untouched), then commit.
await scenario("fusion-ready");
const fusionStart = { buildings: await buildingTiles().count(), today: await page.evaluate(() => window.__aitGetTimeTravelDate()) };
await shot("01-fusion-ready-town");

const initiator = await openFusableSheet();
await shot("02-fusion-detail-sheet-cta");

// Cancel path A — back out of pick mode before choosing a partner.
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
const candidateCount = await page.locator(".town-tile--grow-candidate").count();
await shot("03-fusion-pick-mode-candidates");
await page.locator(".town-move-bar").getByRole("button", { name: "취소" }).click();
await page.waitForTimeout(300);
const afterCancelA = await buildingTiles().count();
await shot("04-fusion-cancel-a-pick-mode");

// Cancel path B — back out of the two-step confirm dialog.
await page.locator(`[data-plot-index="${initiator}"]`).click();
await page.waitForSelector(".entry-sheet-title");
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
const partnerPlot = Number(await page.locator(".town-tile--grow-candidate").first().getAttribute("data-plot-index"));
await page.locator(`[data-plot-index="${partnerPlot}"]`).click();
await page.waitForSelector("text=건물을 융합할까요?");
await shot("05-fusion-confirm-dialog");
await page.getByRole("button", { name: "취소" }).click();
await page.waitForTimeout(400);
const afterCancelB = await buildingTiles().count();
await shot("06-fusion-cancel-b-confirm-dialog");

// Commit.
await page.locator(`[data-plot-index="${initiator}"]`).click();
await page.waitForSelector(".entry-sheet-title");
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
await page.locator(`[data-plot-index="${partnerPlot}"]`).click();
await page.waitForSelector("text=건물을 융합할까요?");
await page.getByRole("button", { name: "합치기" }).click();
await page.waitForTimeout(600);
const afterFuse = { buildings: await buildingTiles().count(), partnerCellEmpty: (await page.locator(`[data-plot-index="${partnerPlot}"][aria-label^="건물"]`).count()) === 0 };
await shot("07-fusion-committed");
await page.locator(`[data-plot-index="${initiator}"]`).click();
await page.waitForSelector(".entry-sheet-title");
const survivorLevel = await sheetLevel();
await shot("08-fusion-survivor-sheet-lv6");
await page.getByRole("button", { name: "닫기" }).click();

findings.scenarios["fusion-ready"] = {
  initiatorPlot: initiator,
  partnerPlot,
  candidateCount,
  buildingsBefore: fusionStart.buildings,
  afterCancelPickMode: afterCancelA,
  afterCancelConfirmDialog: afterCancelB,
  afterCommit: afterFuse.buildings,
  partnerCellEmptyAfterCommit: afterFuse.partnerCellEmpty,
  survivorLevelShown: survivorLevel,
  clockPin: fusionStart.today,
};
if (survivorLevel !== "Lv.6") note("fusion-ready", `survivor should read Lv.6 after one fusion, sheet says ${survivorLevel}`);
if (candidateCount !== 1) note("fusion-ready", `expected exactly 1 highlighted partner (3 decoys must be rejected), saw ${candidateCount}`);
if (afterCancelA !== fusionStart.buildings || afterCancelB !== fusionStart.buildings) note("fusion-ready", "a cancel path changed the building count");

// ───────────────────────── 2. fusion-ready-lv6 ─────────────────────────
await scenario("fusion-ready-lv6");
const lv6Start = await buildingTiles().count();
const lv6Initiator = await openFusableSheet();
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
const lv6Candidates = await page.locator(".town-tile--grow-candidate").count();
await shot("09-fusion-lv6-pick-mode");
const lv6Partner = Number(await page.locator(".town-tile--grow-candidate").first().getAttribute("data-plot-index"));
await page.locator(`[data-plot-index="${lv6Partner}"]`).click();
await page.waitForSelector("text=건물을 융합할까요?");
const lv6DialogText = await bodyText();
await shot("10-fusion-lv6-confirm");
await page.getByRole("button", { name: "합치기" }).click();
await page.waitForTimeout(600);
await page.locator(`[data-plot-index="${lv6Initiator}"]`).click();
await page.waitForSelector(".entry-sheet-title");
const lv7Level = await sheetLevel();
await shot("11-fusion-lv7-survivor");
await page.getByRole("button", { name: "닫기" }).click();
findings.scenarios["fusion-ready-lv6"] = {
  buildingsBefore: lv6Start,
  candidateCount: lv6Candidates,
  confirmDialogCopy: /건물을 융합할까요\?.{0,140}/.exec(lv6DialogText)?.[0] ?? null,
  survivorLevelShown: lv7Level,
};
if (lv7Level !== "Lv.7") note("fusion-ready-lv6", `Lv.6 + Lv.6 should read Lv.7, sheet says ${lv7Level}`);

// ───────────────────────── 3. month-end (+ rollover) ─────────────────────────
await scenario("month-end");
const monthEndBefore = { buildings: await buildingTiles().count(), monuments: await page.locator('.town-tile[aria-label^="기념비"]').count(), body: await bodyText() };
await shot("12-month-end-last-open-day");
await hopTo("2026-08-01");
const monthEndAfter = { buildings: await buildingTiles().count(), monuments: await page.locator('.town-tile[aria-label^="기념비"]').count(), body: await bodyText() };
await shot("13-month-end-after-rollover-settlement");
const monument = page.locator('.town-tile[aria-label^="기념비"]').first();
let monumentSheet = null;
if ((await monument.count()) > 0) {
  await monument.click();
  await page.waitForTimeout(500);
  monumentSheet = await bodyText();
  await shot("14-month-end-monument-sheet");
}
findings.scenarios["month-end"] = {
  monumentsBeforeRollover: monthEndBefore.monuments,
  monumentsAfterRollover: monthEndAfter.monuments,
  settlementNoticeShown: /정산|이번 달|기념비/.test(monthEndAfter.body),
  monumentSheetExcerpt: monumentSheet?.slice(0, 260) ?? null,
};
if (monthEndAfter.monuments <= monthEndBefore.monuments) note("month-end", "crossing into the next month minted no monument");

// ───────────────────────── 4. no-spend-ready ─────────────────────────
await scenario("no-spend-ready");
const nsBefore = await buildingTiles().count();
const nsPillVisible = (await page.getByRole("button", { name: "오늘 무지출!" }).count()) > 0;
await shot("15-no-spend-pill-claimable");
if (nsPillVisible) {
  await page.getByRole("button", { name: "오늘 무지출!" }).click();
  await page.waitForTimeout(800);
}
const nsAfter = { buildings: await buildingTiles().count(), body: await bodyText(), pillGone: (await page.getByRole("button", { name: "오늘 무지출!" }).count()) === 0 };
await shot("16-no-spend-park-built");
findings.scenarios["no-spend-ready"] = {
  pillVisible: nsPillVisible,
  buildingsBefore: nsBefore,
  buildingsAfter: nsAfter.buildings,
  pillGoneAfterClaim: nsAfter.pillGone,
  toast: /오늘은 무지출![^.]{0,60}/.exec(nsAfter.body)?.[0] ?? null,
};
if (nsAfter.buildings !== nsBefore + 1) note("no-spend-ready", `claim should build exactly one park: ${nsBefore} -> ${nsAfter.buildings}`);

// ───────────────────────── 5. full-town (park DEFERS) ─────────────────────────
await scenario("full-town");
const ftBefore = await buildingTiles().count();
await shot("17-full-town");
const ftPill = (await page.getByRole("button", { name: "오늘 무지출!" }).count()) > 0;
if (ftPill) {
  await page.getByRole("button", { name: "오늘 무지출!" }).click();
  await page.waitForTimeout(800);
}
const ftAfterClaim = { buildings: await buildingTiles().count(), body: await bodyText() };
await shot("18-full-town-park-deferred");
await hopTo("2026-08-11");
const ftNextMorning = { buildings: await buildingTiles().count(), body: await bodyText() };
await shot("19-full-town-next-morning");
findings.scenarios["full-town"] = {
  buildings: ftBefore,
  pillVisible: ftPill,
  buildingsAfterClaim: ftAfterClaim.buildings,
  deferralToast: /오늘은 무지출![^.]{0,60}/.exec(ftAfterClaim.body)?.[0] ?? null,
  buildingsNextMorning: ftNextMorning.buildings,
  headerQueuePromiseAfterClaim: /내일 지을 건물 \d+개 대기 중/.exec(ftAfterClaim.body)?.[0] ?? null,
  headerQueuePromiseNextMorning: /내일 지을 건물 \d+개 대기 중/.exec(ftNextMorning.body)?.[0] ?? null,
};
if (findings.scenarios["full-town"].headerQueuePromiseAfterClaim === null)
  note("full-town", "the deferred park is invisible: the header's 내일 지을 건물 N개 대기 중 promise never appeared");
if (ftAfterClaim.buildings !== ftBefore) note("full-town", "a full town still placed the park instead of deferring it");

// ───────── 6. capExceeded — the next-morning drain, and its seed award ─────────
await scenario("capExceeded");
const capBefore = { buildings: await buildingTiles().count(), economy: await economy(), body: await bodyText() };
await shot("20-cap-exceeded-queue");
await hopTo("2026-08-03");
const capMorning = { buildings: await buildingTiles().count(), economy: await economy(), body: await bodyText() };
await shot("21-cap-exceeded-next-morning-drain");
// Reload AGAIN on the same date: the drain already ran, so nothing may be
// awarded a second time — this is the "exactly once across the hop" proof.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
const capReload = { buildings: await buildingTiles().count(), economy: await economy() };
await shot("22-cap-exceeded-reload-idempotent");
findings.scenarios["capExceeded (next-morning drain)"] = {
  buildingsBeforeHop: capBefore.buildings,
  buildingsAfterHop: capMorning.buildings,
  buildingsAfterSecondBoot: capReload.buildings,
  seedsBeforeHop: capBefore.economy?.seeds ?? null,
  seedsAfterHop: capMorning.economy?.seeds ?? null,
  seedsAfterSecondBoot: capReload.economy?.seeds ?? null,
  grantedKeysAfterHop: capMorning.economy?.grantedEventKeys ?? null,
  grantedKeysAfterSecondBoot: capReload.economy?.grantedEventKeys ?? null,
};
if (capMorning.buildings <= capBefore.buildings) note("capExceeded", "the next morning's boot drained nothing");
if ((capReload.economy?.seeds ?? 0) !== (capMorning.economy?.seeds ?? -1))
  note("capExceeded", `seed award was not once-only across the hop: ${capMorning.economy?.seeds} -> ${capReload.economy?.seeds}`);

// ───────────────────────── 7. fresh (onboarding + 건너뛰기) ─────────────────────────
await scenario("fresh");
const onboardingBody = await bodyText();
const skip = page.getByRole("button", { name: "건너뛰기" });
const skipVisible = (await skip.count()) > 0;
await shot("23-fresh-onboarding");
if (skipVisible) {
  await skip.click();
  await page.waitForTimeout(900);
}
const afterSkip = { body: await bodyText(), grid: (await page.locator(".town-grid").count()) > 0, buildings: await buildingTiles().count() };
await shot("24-fresh-after-skip");
findings.scenarios["fresh"] = {
  onboardingRendered: /건너뛰기/.test(onboardingBody),
  skipVisible,
  townGridAfterSkip: afterSkip.grid,
  buildingsAfterSkip: afterSkip.buildings,
  emptyStateCopy: /첫 지출을 기록하면[^.]{0,30}/.exec(afterSkip.body)?.[0] ?? null,
};
if (!skipVisible) note("fresh", "onboarding did not render a 건너뛰기 control");

await browser.close();

findings.consoleErrorCount = consoleErrors.length;
findings.consoleErrors = consoleErrors.slice(0, 20);
findings.shots = shots;
writeFileSync(`${OUT}findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
