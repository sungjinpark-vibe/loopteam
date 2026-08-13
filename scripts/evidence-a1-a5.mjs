// Gate-3 round-5 (A1-A5) browser evidence + the A4 duplicate-toast
// reproduction, driven through the real UI (no fixture hook, no store pokes) —
// the panel's own path.
//
// `playwright` is deliberately NOT a dependency of this app (same contract
// `evidence-art-fill.mjs` documents) — run it against an existing install:
//   npm run dev                       # separate terminal
//   PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node scripts/evidence-a1-a5.mjs --url http://localhost:5173/
//
// SHARED MACHINE — process hygiene (incident 2026-08-11): this box runs other
// teams' long-lived node processes (the HQ Telegram bridge among them). This
// script starts NO process and kills NO process by design; when you start the
// dev server yourself, stop it by the PID you started (`Stop-Process -Id`),
// never by image name.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const pwSpecifier = process.env.PW_PACKAGE;
const pwImportTarget =
  pwSpecifier && /^[a-zA-Z]:[\\/]/.test(pwSpecifier) ? pathToFileURL(pwSpecifier).href : (pwSpecifier ?? "playwright");
const { chromium } = await import(pwImportTarget);

const urlIdx = process.argv.indexOf("--url");
const URL = urlIdx > -1 ? process.argv[urlIdx + 1] : "http://localhost:5173/";
const tagIdx = process.argv.indexOf("--tag");
const TAG = tagIdx > -1 ? process.argv[tagIdx + 1] : "after";
const OUT = "docs/qa/evidence-a1-a5";
mkdirSync(OUT, { recursive: true });

const findings = { tag: TAG, url: URL, steps: [] };
const note = (k, v) => {
  findings.steps.push({ [k]: v });
  console.log(`[${k}]`, typeof v === "string" ? v : JSON.stringify(v));
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
// TDS `Button` nests its label, so `button:text-is()` (which matches the
// button's own immediate text) finds nothing — go through the accessible name.
const byText = (t) => page.getByRole("button", { name: t, exact: true }).first();

/**
 * The A4 measurement. Counts the toast string three independent ways so a
 * "captured twice" claim can be attributed: how many times it occurs in the
 * body's text dump, how many DISTINCT elements carry it as their own text
 * (a real second toast node), and how many times it appears across every
 * attribute value (aria-label/title — a copy that only an accessibility or
 * attribute-inclusive dump would see).
 */
async function countToast(fragment) {
  return page.evaluate((frag) => {
    const occurrences = (hay) => hay.split(frag).length - 1;
    const leaves = [...document.body.querySelectorAll("*")].filter(
      (el) => el.childElementCount === 0 && (el.textContent ?? "").includes(frag),
    );
    let attrHits = 0;
    for (const el of document.body.querySelectorAll("*")) {
      for (const a of el.attributes) if (a.value.includes(frag)) attrHits += 1;
    }
    return {
      inTextContent: occurrences(document.body.textContent ?? ""),
      inInnerText: occurrences(document.body.innerText ?? ""),
      leafElementCount: leaves.length,
      leafPaths: leaves.map((el) => `${el.tagName}.${el.className}`),
      // THE VERDICT FIELD for A4a. A second occurrence parked far off-viewport
      // (top ~ -9994) is the vendor toast's own off-screen copy, which a text
      // dump sees and a player never does — an extraction artifact, not a
      // second toast. Two boxes both inside the viewport would be a real
      // double render.
      leafBoxes: leaves.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), onScreen: r.top >= 0 && r.top <= window.innerHeight };
      }),
      onScreenCount: leaves.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top <= window.innerHeight;
      }).length,
      attributeHits: attrHits,
      fullText: leaves[0]?.textContent ?? null,
    };
  }, fragment);
}

await page.goto(URL, { waitUntil: "networkidle" });
await page.locator(".onboarding-card").waitFor({ timeout: 15000 });
await page.waitForTimeout(600);

// ── onboarding ──────────────────────────────────────────────────────────────
// Beat count is a spec detail that has moved before — advance while a 다음 is
// on screen rather than hardcoding how many there are.
for (let i = 0; i < 6 && (await byText("다음").count()) > 0; i++) {
  await byText("다음").click();
  await page.waitForTimeout(350);
}
await page.locator(".onboarding-card input").fill("800000");
await byText("시작하기").click();
await page.locator(".town-grid").waitFor();
await page.waitForTimeout(800);

// ── found one building (Lv.1) ───────────────────────────────────────────────
async function saveEntry(categoryLabel, digits) {
  await page.locator(".town-fab").click();
  await page.waitForTimeout(400);
  for (const d of digits) {
    await page.locator(`td[role="button"]:text-is("${d}")`).first().dispatchEvent("mousedown");
  }
  await page.locator(`button:has-text("${categoryLabel}")`).first().click();
  await byText("저장").click();
  await page.waitForTimeout(600);
}

await saveEntry("카페", "1000");
await page.waitForTimeout(2500); // let the first-founding banner clear
await page.locator(".town-header").click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.waitForTimeout(500);

// A1 + A3 — header readout and the founded Lv.1 building's badge.
await shot(`${TAG}-a1-header-next-tier`);
note("a1_header_stats", await page.locator(".town-header-stats").innerText());
note("a1_next_tier", await page.locator(".town-header-next-tier").innerText().catch(() => "MISSING"));
note("a3_level_badges", await page.locator(".building-level-badge").allInnerTexts());
await page.locator(".building-tile").first().scrollIntoViewIfNeeded().catch(() => {});
await shot(`${TAG}-a3-lv1-badge`);

// ── A2 — the choice dialog ──────────────────────────────────────────────────
await page.locator(".town-fab").click();
await page.waitForTimeout(400);
for (const d of "50000") {
  await page.locator(`td[role="button"]:text-is("${d}")`).first().dispatchEvent("mousedown");
}
await page.locator('button:has-text("카페")').first().click();
await byText("저장").click();
await page.waitForTimeout(700);
await shot(`${TAG}-a2-grow-dialog`);
note("a2_dialog_text", await page.evaluate(() => document.body.innerText.split("\n").filter((l) => l.includes("슬롯") || l.includes("합쳐") || l.includes("레벨")).join(" | ")));

// ── A4 — grow, then count the level-up toast ────────────────────────────────
await byText("키우기").click();
await page.waitForTimeout(500);

const FRAGMENT = "모은";
note("a4_toast_immediately_after_grow", await countToast(FRAGMENT));
await shot(`${TAG}-a4-levelup-toast`);

// Sampled across the toast's whole life, because "captured twice in one body
// dump" could be a transition window in which an outgoing and an incoming
// toast are both mounted.
const samples = [];
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(250);
  const c = await countToast(FRAGMENT);
  samples.push({ tMs: 500 + (i + 1) * 250, inTextContent: c.inTextContent, leaves: c.leafElementCount, onScreen: c.onScreenCount });
}
note("a4_toast_samples_over_time", samples);
note("a4_max_simultaneous", Math.max(...samples.map((s) => s.leaves)));

// A second grow immediately after the first — the back-to-back case where an
// exiting toast could still be mounted as the next one enters.
await page.locator(".town-fab").click();
await page.waitForTimeout(300);
for (const d of "50000") {
  await page.locator(`td[role="button"]:text-is("${d}")`).first().dispatchEvent("mousedown");
}
await page.locator('button:has-text("카페")').first().click();
await byText("저장").click();
await page.waitForTimeout(500);
await byText("키우기").click();
const rapid = [];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(120);
  const c = await countToast(FRAGMENT);
  rapid.push({ tMs: (i + 1) * 120, inTextContent: c.inTextContent, leaves: c.leafElementCount, onScreen: c.onScreenCount });
}
note("a4_back_to_back_grow_samples", rapid);
note("a4_back_to_back_max_simultaneous", Math.max(...rapid.map((s) => s.leaves)));
await shot(`${TAG}-a4-back-to-back`);

findings.consoleErrors = consoleErrors;
writeFileSync(`${OUT}/${TAG}-findings.json`, JSON.stringify(findings, null, 2));
console.log("consoleErrors:", consoleErrors.length);

await browser.close();
