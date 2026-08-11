// Live-browser evidence run for ADDENDUM-06 (terraced terrain, 명당 prime
// lots, building art variety) — proving the terrain pass actually made the
// village read as less monotonous, and that it didn't regress NPC placement,
// tap/move interaction, or render performance.
//
// Not part of the build or the gate. `playwright` is deliberately NOT a
// dependency of this app — run it against an existing install:
//   npm run dev                       # separate terminal, serves :5173
//   PW_PACKAGE=<abs path>/node_modules/playwright/index.mjs node evidence-addendum06.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// PW_PACKAGE may be a bare specifier ("playwright") or a Windows absolute
// path (C:\...) — the latter isn't a valid ESM specifier as-is (node's
// loader mis-parses the drive letter as a URL scheme), so route it through
// pathToFileURL when it looks like a filesystem path.
const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const OUT = "docs/qa/evidence-addendum06";
mkdirSync(OUT, { recursive: true });

const findings = { verifications: {} };
const consoleErrors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") consoleErrors.push(`[${m.type()}] ${m.text()}`);
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

// ── 01: empty town — terraces + prime-lot markers on bare ground ────────────
findings.terraceCountEmptyTown = await page.evaluate(() => document.querySelectorAll(".town-terrace").length);
findings.primeLotCountEmptyTown = await page.evaluate(() => document.querySelectorAll(".town-tile--prime").length);
await page.screenshot({ path: `${OUT}/01-empty-town.png` });

// ── 04: prime-lot closeup — pink paving + ring, shot NOW while a prime lot
// is still empty (both prime lots are likely built over by the time the
// town is populated below — a bare `.town-tile--prime`'s own box is only
// ~55x55px, illegible without padding, so clip a margin around it).
{
  const rect = await page.locator(".town-tile--prime").first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const pad = 40;
  await page.screenshot({
    path: `${OUT}/04-prime-lot-closeup.png`,
    clip: { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.width + pad * 2, height: rect.height + pad * 2 },
  });
}

// ── build across many categories for archetype variety ───────────────────────
async function typeAmount(digits) {
  for (const d of digits) {
    await page.locator(`.entry-keypad td[role="button"][aria-label="${d}"]`).click();
  }
}
async function addEntry(amountDigits, typeLabel, categoryLabel) {
  await page.locator(".town-fab").click();
  await page.waitForTimeout(250);
  if (typeLabel !== "지출") {
    await page.getByText(typeLabel, { exact: true }).click();
    await page.waitForTimeout(150);
  }
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

// 14 distinct categories = 14 distinct archetypes, each a FIRST-of-category
// build (no grow dialog), across expense + income types — food/cafe/
// transport/shopping/living/health/culture/education/social/etc/salary/
// sidejob/bonus/other_income. dailyBuildSlots is 10 (balance.approved.ts) —
// past that, a same-day entry queues as a material instead of building
// immediately, so the last 4 categories use the dev-only TimeTravel hook
// (main.tsx's window.__aitSetTimeTravelDate, S7/§11.B) to land on a fresh
// "tomorrow" with its own slot budget, same shortcut the app's own S7 sheet
// would give a real user, just driven from the console instead of a UI that
// doesn't exist yet.
const EXPENSE_CATS = ["식비", "카페", "교통", "쇼핑", "생활", "건강", "문화", "교육", "경조사", "기타"];
const INCOME_CATS = ["급여", "부업", "보너스", "기타수입"];
// Local-date arithmetic throughout (matches clock.ts's own toYmd — getters,
// never toISOString/UTC) — a UTC round-trip silently produces the SAME
// calendar date under a positive UTC offset (KST etc), which is exactly the
// bug that first shipped here: the "tomorrow" build silently landed on
// "today" again and queued instead of building.
const realToday = await page.evaluate(() => {
  if (window.__aitGetTimeTravelDate()) return window.__aitGetTimeTravelDate();
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
for (const label of EXPENSE_CATS) await addEntry("4500", "지출", label);
const tomorrow = await page.evaluate((today) => {
  const [y, m, d] = today.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1); // local time, handles month/year rollover
  const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  window.__aitSetTimeTravelDate(nextStr);
  return nextStr;
}, realToday);
findings.timeTravelledTo = tomorrow;
await page.waitForTimeout(200);
for (const label of INCOME_CATS) await addEntry("450000", "수입", label);
// Back to the real date before the rest of the run (screenshots, NPC/perf
// checks) so nothing downstream reads a fake "tomorrow".
await page.evaluate(() => window.__aitSetTimeTravelDate(null));
await page.waitForTimeout(300);

findings.buildingCount = await page.evaluate(() => document.querySelectorAll(".town-grid .building-tile").length);
findings.archetypes = await page.evaluate(() =>
  [...document.querySelectorAll(".town-grid .building-tile")].map((el) => el.getAttribute("data-archetype")),
);
findings.distinctArchetypes = [...new Set(findings.archetypes)].length;
await page.screenshot({ path: `${OUT}/02-town-populated.png` });

// ── 03: zoomed-out full-width — the money shot ───────────────────────────────
await page.locator(".town-zoom-toggle").click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-town-zoomed-out.png` });
await page.locator(".town-zoom-toggle").click();
await page.waitForTimeout(300);

// ── prime-lot marker still present once the lot is built over (04 itself
// was already shot above, on the empty town) ─────────────────────────────
findings.verifications.primeLotVisibleOnPopulatedTown = (await page.locator(".town-tile--prime").count()) > 0;

// ── 05: level up a building to >= 4 (landmark proportions + roof signage) ────
// The real path is repeated 키우기 (grow) picks — expensive to script nine
// times over. Same shortcut evidence-village.mjs uses for seeds: bump the
// persisted building's `exp` directly (exp is render-only derived state,
// selectors.ts's levelOf, never re-derives anything storage needs to agree
// with), then reload so TownGrid re-renders it at the new level.
// Local-date ym (matches clock.ts's toYmd — see the "tomorrow" note above;
// a UTC-derived key here would 404 on the same KST edge).
const ym = await page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});
findings.levelledBuildingId = await page.evaluate((ym) => {
  const key = `ait.v1.buildings.${ym}`;
  const list = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (list.length === 0) return null;
  list[0].exp = 12; // 1 + floor(12/3) = level 5, clamps to maxLevel anyway
  localStorage.setItem(key, JSON.stringify(list));
  return list[0].id;
}, ym);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
// Several of the 14 builds ALSO auto-earned exp on founding (expAmountTiers
// grants founding exp for a big-enough single entry, entryActions.ts) — so
// the bumped building is not necessarily the FIRST `.building-level-badge`
// in DOM/plot order. Read every badge and confirm at least one is >= 4,
// scrolling to THAT one for the screenshot instead of assuming "first".
const badgeLevels = await page.evaluate(() =>
  [...document.querySelectorAll(".building-level-badge")].map((el) => Number(el.textContent.replace("Lv.", ""))),
);
findings.landmarkBadgeCount = badgeLevels.length;
findings.badgeLevels = badgeLevels;
findings.levelledBuildingLevel = badgeLevels.length ? `Lv.${Math.max(...badgeLevels)}` : null;
findings.verifications.atLeastOneLandmarkLevel4Plus = badgeLevels.some((lv) => lv >= 4);
const maxBadgeIndex = badgeLevels.indexOf(Math.max(...badgeLevels, 0));
const levelledTile = page.locator(".building-level-badge").nth(Math.max(0, maxBadgeIndex));
if ((await levelledTile.count()) > 0) {
  await levelledTile.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
}
await page.screenshot({ path: `${OUT}/05-levelled-landmark.png` });

// ── 06: NPCs walking, terrain landed ─────────────────────────────────────────
findings.npcCount = await page.locator(".npc-layer .npc-slot").count();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/06-npc-walking.png` });

// ── VERIFY: NPC positions must land on a road cell, not floating over
// terrain (the top regression risk — NpcLayer measures resolved
// grid-template-* off the live DOM, and terrain is new DOM the grid now
// carries, so a wrong px translation is the failure mode to catch). Uses
// getBoundingClientRect overlap, NOT elementsFromPoint/elementFromPoint —
// both the npc-slot and .town-terrace are `pointer-events: none`, which the
// CSSOM hit-testing spec explicitly excludes from elementFromPoint, so that
// approach would silently skip both and always read as "safe". A terrace
// slab also spans the full block WIDTH (grid-column: 1 / -1, includes the
// road column) by design, so terrace-bbox containment isn't a meaningful
// "not on terrain" signal either — the only real signal is: does the npc's
// rendered center actually land inside a painted road strip's own rect.
// Reused again below for the tall town (§dev-team follow-up — more blocks =
// more chances for the px translation to drift).
async function checkNpcPlacement() {
  return page.evaluate(() => {
    const npcs = [...document.querySelectorAll(".npc-layer .npc-slot")];
    const roadRects = [...document.querySelectorAll(".town-main-street, .town-cross-street")].map((el) =>
      el.getBoundingClientRect(),
    );
    // `.town-grid`'s OWN getBoundingClientRect is NOT the walkable content
    // area: it's a block-level grid container with `width:auto` (fills
    // `.town-viewport`, e.g. 390px on a phone), while its fixed-px column
    // tracks legitimately total MORE than that (8 plot cols + road, per
    // ADDENDUM-05 F-EXP) and paint past the box with `overflow: visible` —
    // it's the ANCESTOR `.town-viewport` (`overflow-x: auto`) that actually
    // scrolls that overflow. So the true content rect is the viewport's own
    // box, widened by the grid's real `scrollWidth`/`scrollHeight` and offset
    // by however far it's currently scrolled — not the grid element's box.
    const viewport = document.querySelector(".town-viewport");
    const grid = document.querySelector(".town-grid");
    const vpBox = viewport.getBoundingClientRect();
    const gridBox = grid.getBoundingClientRect();
    const contentLeft = vpBox.left - viewport.scrollLeft;
    const contentRight = contentLeft + grid.scrollWidth;
    const contentTop = gridBox.top;
    const contentBottom = contentTop + grid.scrollHeight;
    return npcs.map((npc) => {
      const box = npc.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const onRoad = roadRects.some((r) => cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom);
      const insideGrid = cx >= contentLeft && cx <= contentRight && cy >= contentTop && cy <= contentBottom;
      return { onRoad, insideGrid, cx: Math.round(cx), cy: Math.round(cy) };
    });
  });
}
findings.npcPlacement = await checkNpcPlacement();
findings.verifications.allNpcsOnRoad = findings.npcPlacement.every((n) => n.onRoad);
findings.verifications.allNpcsInsideGrid = findings.npcPlacement.every((n) => n.insideGrid);

// ── VERIFY: tap interaction — a plain tap on an ordinary building is a
// documented no-op in this app (only 기념비/monument tiles open a detail
// sheet — MonumentDetailSheet, F16; regular buildings have none, see
// TownScreen.tsx's handlePlotTap). No monument exists in this run (that
// requires claiming a real no-spend day), so this checks the actual
// contract instead of a sheet that doesn't apply here: a tap on a normal
// building must NOT crash and must NOT silently start move mode.
const firstPlot = page.locator(".town-tile", { has: page.locator(".building-tile") }).first();
await firstPlot.click();
await page.waitForTimeout(300);
findings.verifications.plainTapOnBuildingIsNoop = (await page.locator(".town-move-bar").count()) === 0;

// ── VERIFY: move mode — long-press (>= 500ms) grabs a building, tap a
// droppable (terrace-painted) lot to complete the move. Terraces are
// pointer-events:none and DOM-order-first (App.css/TownGrid.tsx), so they
// must never intercept either gesture.
const movePlotIndex = await firstPlot.getAttribute("data-plot-index");
await firstPlot.click({ delay: 650 }); // long-press: mousedown->(650ms)->mouseup, crosses LONG_PRESS_MS=500
await page.waitForTimeout(300);
findings.verifications.longPressEnteredMoveMode = (await page.locator(".town-move-bar").count()) > 0;
const droppableTile = page.locator(".town-tile--droppable").first();
const dropPlotIndex = await droppableTile.getAttribute("data-plot-index");
await droppableTile.click();
await page.waitForTimeout(500);
const movedBuildingNowAt = await page.evaluate(
  (plot) => document.querySelector(`.town-tile[data-plot-index="${plot}"] .building-tile`) !== null,
  dropPlotIndex,
);
const originalPlotNowEmpty = await page.evaluate(
  (plot) => document.querySelector(`.town-tile[data-plot-index="${plot}"] .building-tile`) === null,
  movePlotIndex,
);
findings.verifications.moveCompleted = movedBuildingNowAt && originalPlotNowEmpty;
findings.movePlotIndex = movePlotIndex;
findings.dropPlotIndex = dropPlotIndex;

// ── VERIFY: performance — NPC tick cost, terraces present vs removed.
// NpcLayer re-renders every STEP_INTERVAL_MS (2500ms) off one setInterval;
// if its DOM measurement (or the extra terrain DOM) were expensive, the
// wall-clock gap between successive position updates would drift above
// 2500ms. Poll cheaply (100ms) and time the gap between detected position
// changes — same page instance, same buildings/npcCount, terraces removed
// mid-run so the comparison isolates the terrain DOM's cost.
async function measureNpcTickIntervals(windowMs) {
  const start = Date.now();
  let lastSig = await page.evaluate(() =>
    [...document.querySelectorAll(".npc-layer .npc-slot")].map((el) => el.style.left + "," + el.style.top).join("|"),
  );
  let lastChangeAt = Date.now();
  const gaps = [];
  while (Date.now() - start < windowMs) {
    await page.waitForTimeout(100);
    const sig = await page.evaluate(() =>
      [...document.querySelectorAll(".npc-layer .npc-slot")].map((el) => el.style.left + "," + el.style.top).join("|"),
    );
    if (sig !== lastSig) {
      const now = Date.now();
      gaps.push(now - lastChangeAt);
      lastChangeAt = now;
      lastSig = sig;
    }
  }
  return gaps;
}

const terraceCountBeforePerf = await page.evaluate(() => document.querySelectorAll(".town-terrace").length);
const gapsWithTerraces = await measureNpcTickIntervals(8000); // ~3 ticks at 2.5s
await page.evaluate(() => document.querySelectorAll(".town-terrace").forEach((e) => e.remove()));
const terraceCountAfterPerf = await page.evaluate(() => document.querySelectorAll(".town-terrace").length);
const gapsWithoutTerraces = await measureNpcTickIntervals(8000);

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
findings.performance = {
  terraceCountBeforeRemoval: terraceCountBeforePerf,
  terraceCountAfterRemoval: terraceCountAfterPerf,
  npcTickGapsMsWithTerraces: gapsWithTerraces,
  npcTickGapsMsWithoutTerraces: gapsWithoutTerraces,
  avgTickGapMsWithTerraces: avg(gapsWithTerraces),
  avgTickGapMsWithoutTerraces: avg(gapsWithoutTerraces),
  note:
    "Gap = wall-clock ms between detected npc-slot style changes, 100ms poll granularity, STEP_INTERVAL_MS=2500 is the expected floor. Terraces removed mid-run (DOM node reduction only, not a re-mount) to isolate terrain's paint/layout cost from the fixed 2500ms tick.",
};
if (avg(gapsWithTerraces) && avg(gapsWithoutTerraces)) {
  findings.performance.ratio = avg(gapsWithTerraces) / avg(gapsWithoutTerraces);
}

// ── Follow-up (dev-team): does the terrace effect actually read as stepped
// multi-level terrain at a REALISTIC town size, or only at 14 buildings?
// blockCount = ceil(ceil(plotCount/8)/2) (townLayout.ts, TOWN_COLUMNS=8,
// BLOCK_ROWS=2) — 65+ buildings is the threshold for a 5th terrace block.
// The perf test above stripped `.town-terrace` from the live DOM (not a
// re-mount) — reload first to get them back before judging them.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

const TALL_TOWN_TARGET = 74; // -> blockCount = ceil(ceil(74/8)/2) = 5
// Start from `tomorrow` (already used above for 4 of its 10 slots, in the
// original 14-building phase) so the loop's first advance lands on a
// genuinely FRESH day — starting from `realToday` would re-advance onto
// that same partially-used day and undercount by however many slots were
// already spent there.
let tallTownDay = tomorrow;
while ((await page.evaluate(() => document.querySelectorAll(".town-grid .building-tile").length)) < TALL_TOWN_TARGET) {
  tallTownDay = await page.evaluate((today) => {
    const [y, m, d] = today.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    window.__aitSetTimeTravelDate(nextStr);
    return nextStr;
  }, tallTownDay);
  // dailyBuildSlots is 10/day (balance.approved.ts) — every category already
  // has a building past day 1, so every save here hits the grow-vs-build
  // dialog; addEntry always clicks 새로 짓기 (build new), never 키우기, so
  // this reliably grows the BUILDING COUNT, not just one building's exp.
  for (let i = 0; i < 10; i++) {
    const label = EXPENSE_CATS[i % EXPENSE_CATS.length];
    await addEntry("4500", "지출", label);
  }
}
await page.evaluate(() => window.__aitSetTimeTravelDate(null));
await page.waitForTimeout(300);

findings.tallTown = {
  buildingCount: await page.evaluate(() => document.querySelectorAll(".town-grid .building-tile").length),
  terraceCount: await page.evaluate(() => document.querySelectorAll(".town-terrace").length),
  terraceTints: await page.evaluate(() =>
    [...document.querySelectorAll(".town-terrace")].map((el) => [...el.classList].find((c) => c.startsWith("town-terrace--t"))),
  ),
};

// Filenames for the tall-town pair are parameterizable — re-shot as 09/10
// after a terrain-depth CSS pass (dev-team follow-up), same script/seeding,
// like-for-like against the original 07/08 which stay on disk untouched.
const TALL_ZOOM_NAME = process.env.EVID06_TALL_ZOOM_NAME ?? "07-town-tall-zoomed-out.png";
const TALL_EDGE_NAME = process.env.EVID06_TALL_EDGE_NAME ?? "08-terrace-edges-closeup.png";

// ── 07: the whole terrace stack in one frame — the decisive shot ────────────
await page.locator(".town-zoom-toggle").click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/${TALL_ZOOM_NAME}` });
await page.locator(".town-zoom-toggle").click();
await page.waitForTimeout(300);

// ── 08: the boundary between two adjacent terraces, at 1:1 zoom so the
// tint/earth-band/silhouette detail is legible (not compressed by the
// zoom-to-fit scale transform above).
{
  const terraceCount = await page.locator(".town-terrace").count();
  if (terraceCount >= 2) {
    // Scroll the SECOND terrace to the vertical center of the viewport so
    // both it and the tail end of the first terrace (the boundary between
    // them) land safely inside the viewport together, then read live
    // (post-scroll, viewport-relative) rects — no manual scroll-offset math.
    await page.locator(".town-terrace").nth(1).evaluate((el) => {
      el.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(200);
    const rects = await page.evaluate(() => {
      const els = [...document.querySelectorAll(".town-terrace")].slice(0, 2);
      return els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
    });
    const [a, b] = rects;
    const pad = 30;
    const clipTop = Math.max(0, a.bottom - pad);
    const clipBottom = Math.min(844, b.top + pad + 40); // a little into the second plateau too
    await page.screenshot({
      path: `${OUT}/${TALL_EDGE_NAME}`,
      clip: {
        x: Math.max(0, Math.min(a.left, b.left) - 5),
        y: clipTop,
        width: Math.max(a.right, b.right) - Math.min(a.left, b.left) + 10,
        height: Math.max(20, clipBottom - clipTop),
      },
    });
  } else {
    findings.tallTown.terraceCloseupSkipped = `only ${terraceCount} .town-terrace element(s) — need >= 2 for a boundary shot`;
  }
}

// ── VERIFY: NPCs still on the road at 5x the town size ───────────────────────
findings.tallTown.npcPlacement = await checkNpcPlacement();
findings.verifications.tallTownAllNpcsOnRoad = findings.tallTown.npcPlacement.every((n) => n.onRoad);
findings.verifications.tallTownAllNpcsInsideGrid = findings.tallTown.npcPlacement.every((n) => n.insideGrid);

findings.consoleErrors = [...new Set(consoleErrors)];

writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));

await browser.close();
