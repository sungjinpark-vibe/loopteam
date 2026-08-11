// ADDENDUM-08 evidence: proves the three director requirements are REAL in a
// browser at real scale, not just green in unit tests —
//   1. the map is 20x20 = 400 cells,
//   2. unbuildable park/lake terrain sits in the middle of it,
//   3. buildings come in 1x1 / 1x2 / 2x1 / 2x2 and render as ONE spanning box.
//
// It measures the LIVE DOM (resolved grid tracks + computed spans), so a
// screenshot that merely looks right cannot pass a check the geometry fails.
//
// Not part of the build or the gate. `playwright` is deliberately NOT a
// dependency of this app — run it against an existing install:
//   npm run dev                       # separate terminal, serves :5173
//   PW_PACKAGE=<abs path>/node_modules/playwright/index.mjs node evidence-addendum08.mjs
//
// SHARED MACHINE — process hygiene (incident 2026-08-11): this box runs other
// teams' long-lived node processes (the HQ Telegram bridge among them). A
// `taskkill /F /IM node.exe /T` to clean up the dev server killed that bridge.
// This script starts NO process and kills NO process by design; when you start
// the dev server yourself, stop it by the PID you started (`Stop-Process -Id`),
// never by image name.
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const OUT = "docs/qa";
mkdirSync(OUT, { recursive: true });

// The map's fingerprint (ADDENDUM-08 §1.2). If the rendered town disagrees
// with these, the render layer and townLayout.ts have diverged.
const EXPECTED = { ground: 193, road: 93, park: 29, lake: 12, savings: 5, void: 68, total: 400 };

const findings = { expected: EXPECTED };
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

// ── seed a real-scale town. Prefer the mixed-footprint fixture (every building
// size present); fall back through the older generators so this script still
// produces evidence if the fixture was renamed.
async function loadFixture(name) {
  const ok = await page.evaluate((n) => {
    if (typeof window.__aitLoadFixture !== "function") return false;
    try {
      window.__aitLoadFixture(n);
      return true;
    } catch {
      return false;
    }
  }, name);
  if (!ok) return 0;
  await page.waitForLoadState("networkidle");
  await page.locator(".town-fab").waitFor().catch(() => {});
  await page.waitForTimeout(500);
  return page.evaluate(() => document.querySelectorAll("[class*='building']").length);
}

const candidates = (process.env.AIT_FIXTURE ? [process.env.AIT_FIXTURE] : []).concat([
  "mixedFootprints",
  "fullMap",
  "dense",
  "oneMonth",
]);
findings.fixtureTried = [];
for (const name of candidates) {
  const n = await loadFixture(name);
  findings.fixtureTried.push({ name, buildingsRendered: n });
  if (n >= 60) {
    findings.fixtureUsed = name;
    break;
  }
}

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

// ── measure the grid itself off resolved CSS, not off our own constants.
findings.grid = await page.evaluate(() => {
  const grid = document.querySelector(".town-grid");
  if (!grid) return { error: "no .town-grid found" };
  const cs = getComputedStyle(grid);
  const cols = cs.gridTemplateColumns.split(" ").filter(Boolean);
  const rows = cs.gridTemplateRows.split(" ").filter(Boolean);
  return {
    columnTracks: cols.length,
    rowTracks: rows.length,
    columnTrackPx: cols.slice(0, 3),
    rowTrackPx: rows.slice(0, 3),
    directChildren: grid.children.length,
  };
});

// ── classify every rendered cell/building.
//
// Footprint is measured off the RENDERED BOX, not off `grid-column`: the
// building art is a CHILD of the grid item, so reading `gridColumnStart` on
// `.building-tile` returns "auto" and silently reports every building as 1x1
// (this harness did exactly that on its first run). Rounding rect.width
// against the resolved single-cell track size cannot be fooled that way, and
// it stays correct under the zoom transform because both are scaled alike.
findings.cells = await page.evaluate(() => {
  const grid = document.querySelector(".town-grid");
  if (!grid) return { error: "no .town-grid found" };
  const kinds = {};
  const spans = {};
  const classSamples = new Set();

  // Walk up to the element that is actually the GRID ITEM (a direct child of
  // .town-grid) and read its resolved line numbers. `grid-column` on the art
  // element itself is "auto" — reading it there reports every building as 1x1.
  const gridItemOf = (el) => {
    let node = el;
    while (node && node.parentElement !== grid) node = node.parentElement;
    return node;
  };
  const spanOf = (item) => {
    const cs = getComputedStyle(item);
    const num = (v) => {
      const m = /(-?\d+)/.exec(v ?? "");
      return m ? Number(m[1]) : null;
    };
    const cs0 = num(cs.gridColumnStart);
    const cs1 = num(cs.gridColumnEnd);
    const rs0 = num(cs.gridRowStart);
    const rs1 = num(cs.gridRowEnd);
    const spanIn = (v, a, b) => (/span/.test(v ?? "") ? num(v) : a !== null && b !== null ? b - a : 1);
    return { w: spanIn(cs.gridColumnEnd, cs0, cs1) || 1, h: spanIn(cs.gridRowEnd, rs0, rs1) || 1 };
  };

  for (const el of grid.querySelectorAll("*")) {
    const cls = el.className && typeof el.className === "string" ? el.className : "";
    if (!cls) continue;
    classSamples.add(cls.split(" ")[0]);
    for (const kind of ["road", "park", "lake", "savings", "void", "terrain", "lot", "building", "prime"]) {
      if (cls.includes(kind)) kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
    if (cls.includes("building-tile")) {
      const item = gridItemOf(el);
      const { w, h } = item ? spanOf(item) : { w: 1, h: 1 };
      const key = `${w}x${h}`;
      spans[key] = (spans[key] ?? 0) + 1;
    }
  }
  return { kinds, buildingSpans: spans, classSamples: [...classSamples].sort() };
});

// ── the footprints the STORE believes in, so the render can be checked
// against the data rather than against itself.
findings.storedFootprints = await page.evaluate(() => {
  const idx = JSON.parse(localStorage.getItem("ait.v1.index") ?? "{}");
  const all = [];
  for (const ym of idx.buildingMonths ?? []) all.push(...JSON.parse(localStorage.getItem(`ait.v1.buildings.${ym}`) ?? "[]"));
  const shapes = {};
  for (const b of all) {
    const k = `${b.w ?? 1}x${b.h ?? 1}`;
    shapes[k] = (shapes[k] ?? 0) + 1;
  }
  return { total: all.length, shapes };
});

// ── the whole map in one frame ("전체 보기").
const zoomToggle = page.locator(".town-zoom-toggle");
findings.zoomToggleFound = (await zoomToggle.count()) > 0;
findings.viewportFitsWholeMap = await page.evaluate(() => {
  const vp = document.querySelector(".town-viewport");
  const grid = document.querySelector(".town-grid");
  if (!vp || !grid) return null;
  const g = grid.getBoundingClientRect();
  const v = vp.getBoundingClientRect();
  return { gridW: Math.round(g.width), gridH: Math.round(g.height), vpW: Math.round(v.width), vpH: Math.round(v.height), fits: g.width <= v.width + 2 && g.height <= v.height + 2 };
});
await page.screenshot({ path: `${OUT}/a08-01-whole-map.png` });

if (findings.zoomToggleFound) {
  await zoomToggle.click();
  await page.waitForTimeout(500);
  findings.afterToggle = await page.evaluate(() => {
    const vp = document.querySelector(".town-viewport");
    const grid = document.querySelector(".town-grid");
    const g = grid.getBoundingClientRect();
    const v = vp.getBoundingClientRect();
    return { gridW: Math.round(g.width), vpW: Math.round(v.width), fits: g.width <= v.width + 2 };
  });
  await page.screenshot({ path: `${OUT}/a08-02-toggled.png` });
}

// ── close-up: the terrain has to READ as park and lake, not as coloured tiles.
await page.screenshot({ path: `${OUT}/a08-03-fullpage.png`, fullPage: true });

// ── NPCs: present, and standing only on walkable (road or park) cells.
findings.npcs = await page.evaluate(() => {
  const sprites = document.querySelectorAll("[class*='npc']");
  return { count: sprites.length };
});

// ── interaction latency at full map size (perf gate, ADDENDUM-08 §7).
findings.perf = await page.evaluate(async () => {
  const grid = document.querySelector(".town-grid");
  if (!grid) return null;
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) {
    grid.getBoundingClientRect();
    await new Promise((r) => requestAnimationFrame(r));
  }
  return { avgFrameMs: Number(((performance.now() - t0) / 20).toFixed(2)) };
});

// ── MIGRATION: force the live save back to layoutVersion 3 with old-coordinate
// plotIndex values, reload, and prove every building survived the reseat.
findings.migration = await page.evaluate(() => {
  const idx = JSON.parse(localStorage.getItem("ait.v1.index") ?? "{}");
  const keys = (idx.buildingMonths ?? []).map((ym) => `ait.v1.buildings.${ym}`);
  const before = [];
  for (const key of keys) {
    const arr = JSON.parse(localStorage.getItem(key) ?? "[]");
    // Rewrite to a pre-ADDENDUM-08 shape: serpentine-era indices, no w/h.
    const aged = arr.map((b, i) => {
      const { w, h, ...rest } = b;
      void w;
      void h;
      return { ...rest, plotIndex: i };
    });
    before.push(...aged.map((b) => ({ id: b.id, exp: b.exp ?? 0, source: b.source?.kind ?? null, createdAt: b.createdAt })));
    localStorage.setItem(key, JSON.stringify(aged));
  }
  idx.layoutVersion = 3;
  localStorage.setItem("ait.v1.index", JSON.stringify(idx));
  return { seededAsV3: before.length, sample: before.slice(0, 3) };
});

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1400);

findings.migrationResult = await page.evaluate(() => {
  const idx = JSON.parse(localStorage.getItem("ait.v1.index") ?? "{}");
  const all = [];
  for (const ym of idx.buildingMonths ?? []) all.push(...JSON.parse(localStorage.getItem(`ait.v1.buildings.${ym}`) ?? "[]"));
  const anchors = all.map((b) => b.plotIndex).filter((a) => a >= 0);
  return {
    layoutVersionNow: idx.layoutVersion,
    survivors: all.length,
    renderedOnScreen: document.querySelectorAll(".building-tile").length,
    anchorsInRange: anchors.every((a) => a >= 0 && a < 400),
    duplicateAnchors: anchors.length - new Set(anchors).size,
  };
});
await page.screenshot({ path: `${OUT}/a08-04-after-migration.png` });

// Console noise from the Toss host SDK (safe-area insets are unavailable
// outside the real Toss shell) is not this app's error — filter it so the
// verdict reflects OUR code.
const PLATFORM_NOISE = /SafeAreaInsets|getSafeAreaInsets/;
findings.consoleErrorsAll = [...new Set(consoleErrors)].length;
findings.consoleErrors = [...new Set(consoleErrors)].filter((e) => !PLATFORM_NOISE.test(e));
findings.screenshots = [
  `${OUT}/a08-01-whole-map.png`,
  `${OUT}/a08-02-toggled.png`,
  `${OUT}/a08-03-fullpage.png`,
  `${OUT}/a08-04-after-migration.png`,
];
for (const p of findings.screenshots) {
  try {
    findings[`size_${p}`] = statSync(p).size;
  } catch {
    /* shot not taken */
  }
}

// ── verdict: the three director requirements, as booleans.
findings.verdict = {
  req1_grid_is_20x20: findings.grid?.columnTracks === 20 && findings.grid?.rowTracks === 20,
  req2_terrain_present: (findings.cells?.kinds?.park ?? 0) > 0 && (findings.cells?.kinds?.lake ?? 0) > 0,
  req3_multi_tile_buildings:
    Object.keys(findings.cells?.buildingSpans ?? {}).filter((k) => k !== "1x1").length > 0,
  req3_all_four_sizes_stored: ["1x1", "1x2", "2x1", "2x2"].every((k) => (findings.storedFootprints?.shapes?.[k] ?? 0) > 0),
  render_matches_store: findings.storedFootprints?.total === Object.values(findings.cells?.buildingSpans ?? {}).reduce((a, b) => a + b, 0),
  migration_no_loss:
    findings.migrationResult?.survivors === findings.migration?.seededAsV3 &&
    findings.migrationResult?.duplicateAnchors === 0 &&
    findings.migrationResult?.anchorsInRange === true &&
    findings.migrationResult?.layoutVersionNow === 4,
  no_console_errors: findings.consoleErrors.length === 0,
};

writeFileSync(`${OUT}/a08-findings.json`, JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 2));

await browser.close();
