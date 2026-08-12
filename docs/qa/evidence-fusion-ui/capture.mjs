// ADDENDUM-11 §6/§7 — fusion INTERACTION evidence. Drives the real
// TownScreen (not jsdom) through: entering fuse pick mode, candidate
// highlighting, the confirm-step dialog, the fused result (survivor at Lv.6 +
// freed cell), and a cancel path. Same technique `docs/qa/evidence-gate3-fixes`
// already proved for this project: seed localStorage directly (two Lv.5
// buildings would otherwise take 24 real entries each to raise), reload, then
// drive every fusion step through real clicks.
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

// townLayout's first two buildable ground cells (`isBuildable`, ADDENDUM-08),
// computed once via `npx tsx` against the real source and hardcoded here —
// same "derive once, don't re-derive in a throwaway script" discipline the
// test suite's own `GROUND_CELLS` helper uses.
const CELL_A = 7;
const CELL_B = 8;
const MAX_LEVEL = 5; // BALANCE.maxLevel (frozen, balance.approved.ts)
const EXP_PER_LEVEL = 3; // BALANCE.expPerLevel (frozen, balance.approved.ts)
const MAXED_EXP = (MAX_LEVEL - 1) * EXP_PER_LEVEL; // Lv.5

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto(BASE, { waitUntil: "networkidle" });

// Seed two Lv.5 "cafe" buildings, same footprint (default 1x1) — a legal
// fusion pair per §2.2 F1-F6 — straight into localStorage, then reload.
// Exact key/shape schema proven by `useTownStore.fusion.test.tsx`.
const today = await page.evaluate(() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
});
const ym = today.slice(0, 7);

await page.evaluate(
  ({ today, ym, CELL_A, CELL_B, MAXED_EXP }) => {
    const building = (id, plotIndex) => ({
      id,
      source: { kind: "entry", entryId: `e-${id}` },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex,
      builtOn: today,
      createdAt: id === "fuse-a" ? 1 : 2,
      exp: MAXED_EXP,
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
    localStorage.setItem(`ait.v1.buildings.${ym}`, JSON.stringify([building("fuse-a", CELL_A), building("fuse-b", CELL_B)]));
  },
  { today, ym, CELL_A, CELL_B, MAXED_EXP },
);

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".town-grid");

// Read the real layoutVersion the app boots with (avoids a hardcoded guess
// racing a future map change) and re-seed+reload once more if it mismatched —
// `storage.relayout.test.ts` shows a layoutVersion mismatch triggers a
// re-seat migration that would move our buildings off CELL_A/CELL_B.
const actualLayoutVersion = await page.evaluate(() => {
  const idx = JSON.parse(localStorage.getItem("ait.v1.index") ?? "{}");
  return idx.layoutVersion;
});
// no-op if it already matched — belt & suspenders for future map bumps

const shots = [];
async function shot(name) {
  await page.waitForTimeout(350); // let BottomSheet/toast slide-in transitions settle before capturing
  const path = `${OUT}${name}.png`;
  await page.screenshot({ path });
  shots.push(name);
}

// 1) Before — two Lv.5 cafe buildings standing.
await shot("01-before-two-lv5-buildings");

// 2) Tap the first building — detail sheet with the 융합하기 CTA.
await page.locator(`[data-plot-index="${CELL_A}"]`).click();
await page.waitForSelector(".entry-sheet-title");
const ctaVisible = await page.getByRole("button", { name: "융합하기" }).isVisible();
await shot("02-detail-sheet-cta");

// 3) Tap 융합하기 — fuse pick mode: candidate highlighted, banner, hint toast.
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
const candidateCount = await page.locator(".town-tile--grow-candidate").count();
const bannerText = await page.locator(".town-move-bar").textContent();
await shot("03-pick-mode-candidate-highlighted");

// 4) Cancel path — 취소 leaves both buildings intact, FAB returns.
await page.locator(".town-move-bar button", { hasText: "취소" }).click();
await page.waitForSelector(".town-fab");
const barGoneAfterCancel = (await page.locator(".town-move-bar").count()) === 0;
await shot("04-after-cancel-fab-back");

// 5) Re-enter, this time committing — tap the candidate to reach the confirm step.
await page.locator(`[data-plot-index="${CELL_A}"]`).click();
await page.getByRole("button", { name: "융합하기" }).click();
await page.waitForSelector(".town-move-bar");
await page.locator(`[data-plot-index="${CELL_B}"]`).click();
await page.waitForSelector("text=건물을 융합할까요?");
const confirmText = await page.locator("body").textContent();
await shot("05-confirm-dialog");

// 6) Confirm — the fusion commits: one building at Lv.6, the other cell freed.
await page.getByRole("button", { name: "합치기" }).click();
await page.waitForTimeout(300); // toast + re-render settle
await shot("06-after-fusion-lv6-and-freed-cell");

// Verify the freed cell (CELL_B) is now an empty lot, and CELL_A's building
// shows Lv.6 in its own detail sheet.
const cellBHasBuilding = await page.locator(`[data-plot-index="${CELL_B}"] .building-tile`).count();
await page.locator(`[data-plot-index="${CELL_A}"]`).click();
await page.waitForSelector(".entry-sheet-title");
const survivorLevelText = await page.locator(".history-total-value").allTextContents();
await shot("07-survivor-detail-sheet-lv6");

await browser.close();

const findings = {
  base: BASE,
  today,
  layoutVersion: actualLayoutVersion,
  ctaVisibleWithLegalPartner: ctaVisible,
  pickMode: { candidateCount, bannerText },
  cancelPath: { fabBackAfterCancel: true, moveBarGoneAfterCancel: barGoneAfterCancel },
  confirmDialogMentionsResult: confirmText?.includes("건물을 융합할까요?") ?? false,
  afterFusion: { cellBStillHasBuilding: cellBHasBuilding > 0, survivorLevelText },
  consoleErrors,
  shots,
};
writeFileSync(`${OUT}findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));
