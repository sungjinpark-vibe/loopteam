// Behavioural check that jsdom cannot do: with real layout, does a tap on the
// pixel where a TALL building's art overhangs the tile above still hit the
// UPPER tile? Uses elementFromPoint, which is exactly what the browser's own
// hit-testing uses to route a pointerdown.
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PW_PACKAGE).href);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

const today = await page.evaluate(() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
});
const ym = today.slice(0, 7);

// row 3 col 5 (upper, Lv.1) and row 4 col 5 (lower, Lv.10) — both ground
const UPPER = 3 * 20 + 5;
const LOWER = 4 * 20 + 5;

await page.evaluate(
  ({ today, ym, UPPER, LOWER }) => {
    localStorage.clear();
    const b = (id, plotIndex, exp, fuse) => ({
      id, source: { kind: "entry", entryId: `e-${id}` }, categoryId: "food",
      variantIndex: 0, plotIndex, builtOn: today, createdAt: id === "up" ? 1 : 2,
      exp, ...(fuse ? { fuse } : {}),
    });
    localStorage.setItem("ait.v1.index", JSON.stringify({ schemaVersion: 1, layoutVersion: 4, entryMonths: [], buildingMonths: [ym] }));
    localStorage.setItem("ait.v1.core", JSON.stringify({
      town: { townName: "우리 동네", streakDays: 0, longestStreakDays: 0, lastActOn: null, slotsUsedOn: "", slotsUsedToday: 0, highestTierSeen: 0, queue: [], noSpendDays: [], cumulativeSavingsKrw: 0, lastSettledPeriod: ym, moveHintSeen: true },
      budget: { monthlyBudgetKrw: null, updatedAt: 0 }, onboarded: true,
    }));
    localStorage.setItem(`ait.v1.buildings.${ym}`, JSON.stringify([b("up", UPPER, 0), b("low", LOWER, 12, 5)]));
  },
  { today, ym, UPPER, LOWER },
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".town-grid");
await page.click(".town-zoom-toggle"); // 100% scale
await page.waitForTimeout(600);

const result = await page.evaluate(
  ({ UPPER, LOWER }) => {
    const up = document.getElementById(`plot-${UPPER}`);
    const low = document.getElementById(`plot-${LOWER}`);
    up.scrollIntoView({ block: "center", inline: "center" });
    const u = up.getBoundingClientRect();
    const l = low.getBoundingClientRect();
    const lowArt = low.querySelector("svg").getBoundingClientRect();
    // a point INSIDE the upper tile that the lower building's art overhangs
    const overlapTop = Math.max(u.top, lowArt.top);
    const overlapBottom = Math.min(u.bottom, lowArt.bottom);
    const probeY = (overlapTop + overlapBottom) / 2;
    const probeX = u.left + u.width / 2;
    const hit = document.elementFromPoint(probeX, probeY);
    const owner = hit?.closest(".town-tile");
    return {
      overhangHeightPx: +(u.bottom - lowArt.top).toFixed(1),
      lowerArtRisesPx: +(l.top - lowArt.top).toFixed(1),
      probeInsideUpperTile: probeY > u.top && probeY < u.bottom,
      hitTag: hit?.tagName,
      hitOwnerPlot: owner?.dataset.plotIndex ?? null,
      expectedPlot: String(UPPER),
      // and the lower tile's own centre must still hit the lower tile
      lowerCentreOwner:
        document.elementFromPoint(l.left + l.width / 2, l.top + l.height / 2)?.closest(".town-tile")?.dataset.plotIndex ?? null,
    };
  },
  { UPPER, LOWER },
);

// Counter-check: the same probe with `pointer-events: none` disabled must FAIL,
// or the guard above is not what is producing the pass.
await page.addStyleTag({ content: ".building-tile > svg { pointer-events: auto !important; }" });
await page.waitForTimeout(200);
const without = await page.evaluate(
  ({ UPPER, LOWER }) => {
    const up = document.getElementById(`plot-${UPPER}`);
    const low = document.getElementById(`plot-${LOWER}`);
    const u = up.getBoundingClientRect();
    const lowArt = low.querySelector("svg").getBoundingClientRect();
    const probeY = (Math.max(u.top, lowArt.top) + Math.min(u.bottom, lowArt.bottom)) / 2;
    return document.elementFromPoint(u.left + u.width / 2, probeY)?.closest(".town-tile")?.dataset.plotIndex ?? null;
  },
  { UPPER, LOWER },
);
result.samePointWithoutTheGuard = without;
console.log(JSON.stringify(result, null, 2));
const pass =
  result.hitOwnerPlot === result.expectedPlot &&
  result.lowerCentreOwner === String(LOWER) &&
  result.overhangHeightPx > 5 &&
  result.samePointWithoutTheGuard === String(LOWER); // the bug the guard prevents
console.log(pass ? "PASS — guard holds, and removing it reproduces the stolen tap" : "FAIL");
await browser.close();
process.exit(pass ? 0 : 1);
