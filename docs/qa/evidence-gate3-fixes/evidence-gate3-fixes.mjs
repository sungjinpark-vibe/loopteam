// Gate-3 follow-up A1-A6 browser evidence. Starts no process, kills no process.
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
const { chromium } = await import(pathToFileURL(process.env.PW_PACKAGE).href);
const OUT = process.env.OUT;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().split("\n")[0]));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
const findings = {};

// ── A4: onboarding CTA validation, on a genuinely fresh install ──
await page.goto(process.env.URL ?? "http://localhost:5182/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.locator('button:has-text("다음")').click();
await page.locator('button:has-text("다음")').click();
await page.waitForTimeout(300);
const cta = page.locator('button:has-text("시작하기")');
findings.a4 = { emptyDisabled: await cta.isDisabled() };
await page.screenshot({ path: `${OUT}/a4-01-start-disabled-empty.png` });
const input = page.locator(".onboarding-card input").first();
await input.fill("0");
await page.waitForTimeout(200);
findings.a4.zeroDisabled = await cta.isDisabled();
await page.screenshot({ path: `${OUT}/a4-02-start-disabled-zero.png` });
await input.fill("800000");
await page.waitForTimeout(200);
findings.a4.validEnabled = !(await cta.isDisabled());
await page.screenshot({ path: `${OUT}/a4-03-start-enabled.png` });
await cta.click();
await page.waitForTimeout(600);

const geom = () => page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
  const layer = document.querySelector('#tds-mobile-portal-container > [aria-live="polite"]');
  const tabBtn = document.querySelectorAll(".bottom-tab")[1];
  const tr = tabBtn.getBoundingClientRect();
  const onTab = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
  const fab = document.querySelector(".town-fab");
  const fr = fab?.getBoundingClientRect();
  const onFab = fr ? document.elementFromPoint(fr.left + fr.width / 2, fr.top + fr.height / 2) : null;
  return {
    tabBar: r(document.querySelector(".bottom-tab-bar")),
    toastCard: r(layer?.querySelector(":scope > *:not([aria-hidden='true'])")),
    toastText: layer?.textContent?.trim().slice(0, 70) ?? null,
    banner: r(document.querySelector(".tier-celebration")),
    bannerText: document.querySelector(".tier-celebration")?.textContent ?? null,
    tabBarReachable: tabBtn.contains(onTab) || onTab === tabBtn,
    fabReachable: fab ? fab.contains(onFab) || onFab === fab : "fab-hidden",
    moveBar: r(document.querySelector(".town-move-bar")),
    moveBarText: document.querySelector(".town-move-bar")?.textContent ?? null,
  };
});

async function addEntry(amount, cat) {
  await page.locator(".town-fab").dispatchEvent("click");
  await page.waitForTimeout(500);
  for (const d of String(amount)) await page.locator(`td[role="button"]:has-text("${d}")`).first().dispatchEvent("mousedown");
  await page.locator(`button:has-text("${cat}")`).first().dispatchEvent("click");
  await page.waitForTimeout(200);
  await page.locator('button:has-text("저장")').first().dispatchEvent("click");
  await page.waitForTimeout(800);
}

// ── A2: first founding ──
await addEntry(1000, "카페");
await page.screenshot({ path: `${OUT}/a2-01-first-founding-banner.png` });
findings.a2 = await geom();
await page.locator(".tier-celebration-dismiss").click();
await page.waitForTimeout(400);

// ── A5/A6: second build — reward toast with unit + balance, clear of the tab bar ──
await addEntry(30000, "교통");
await page.screenshot({ path: `${OUT}/a5-a6-01-reward-toast.png` });
findings.a5a6 = await geom();

await page.waitForTimeout(4000);
// ── A5: the spend surface ──
await page.locator(".shop-fab").dispatchEvent("click");
await page.waitForTimeout(700);
findings.a5shop = { balanceChip: await page.locator(".shop-balance").textContent(), firstPrice: await page.locator(".shop-row-buy").first().textContent() };
await page.screenshot({ path: `${OUT}/a5-02-shop-balance-and-prices.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
await page.mouse.click(195, 300);
await page.waitForTimeout(500);

// ── A1: grow-pick mode. Needs TWO standing 카페 buildings, so the second 카페
// save takes 새로 짓기 (one candidate would otherwise grow straight away).
async function saveCafe(amount) {
  await page.locator(".town-fab").dispatchEvent("click");
  await page.waitForTimeout(500);
  for (const d of String(amount)) await page.locator(`td[role="button"]:has-text("${d}")`).first().dispatchEvent("mousedown");
  await page.locator('button:has-text("카페")').first().dispatchEvent("click");
  await page.waitForTimeout(200);
  await page.locator('button:has-text("저장")').first().dispatchEvent("click");
  await page.waitForTimeout(800);
}
await saveCafe(2000);
await page.locator('button:has-text("새로 짓기")').first().dispatchEvent("click");
await page.waitForTimeout(4500);
await saveCafe(5000);
const growBtn = page.locator('button:has-text("키우기")');
findings.a1 = { growDialog: await growBtn.count() };
if (findings.a1.growDialog) {
  await growBtn.first().dispatchEvent("click");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/a1-01-pick-mode-banner-and-hint.png` });
  findings.a1.onEnter = await geom();
  // tap a non-candidate tile (empty ground)
  const candidatePlots = await page.evaluate(() =>
    [...document.querySelectorAll(".town-tile--grow-candidate")].map((e) => e.getAttribute("data-plot-index")));
  findings.a1.candidateCount = candidatePlots.length;
  await page.evaluate((taken) => {
    const target = [...document.querySelectorAll("[data-plot-index]")].find((e) => !taken.includes(e.getAttribute("data-plot-index")));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, candidatePlots);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/a1-02-pick-mode-reject-hint.png` });
  findings.a1.afterStrayTap = await geom();
  await page.locator('.town-move-bar button:has-text("취소")').dispatchEvent("click");
  await page.waitForTimeout(500);
  findings.a1.afterCancel = { moveBar: await page.locator(".town-move-bar").count(), fab: await page.locator(".town-fab").count() };
  await page.screenshot({ path: `${OUT}/a1-03-after-cancel-fab-back.png` });
}

// ── A3 ──
findings.a3 = { consoleErrors: errors.length, distinct: [...new Set(errors)] };
writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2), "utf-8");
console.log(JSON.stringify(findings, null, 1));
await browser.close();
