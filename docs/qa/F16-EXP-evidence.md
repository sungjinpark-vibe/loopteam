# QA evidence — ADDENDUM-04 (amount-proportional EXP) + F16 (settlement / 기념비)

Date: 2026-08-09 · Driver: `evidence-f16-exp.mjs` (Chromium, Playwright 1.62.1 out-of-tree, no new dependency)
Build under test: `npm run dev` (Vite 6.4.3, http://localhost:5173) · Screenshots: `docs/qa/evidence/`

## Gate 1 — mechanical

`gate/gate-node.ps1` → **exit code 0**, GATE: PASS.
All 8 checks passed: project-exists, npm-available, install, typecheck, build, test, lint, gate:extra.
JSON: `docs/qa/gate-f16-exp.json`.

## Scenarios

| # | Scenario | Result | Observation |
|---|---|---|---|
| S1 | Small entry (₩5,000 지출, 식비) | **PASS** | 1 building on plot 8, **no `Lv.` badge**, 0 floor divs. Stored `exp` sum = 0, growthScore = 1. Gain 1 → founding exp 0 → Lv.1 renders exactly as before ADDENDUM-04. `s1-small-entry.png` |
| S2 | Large entry (₩200,000 지출, 카페 — different category) | **PASS** | New building on plot 7 with badge text **`Lv.2`** and 1 stacked floor div. Stored exp = 4, growthScore = 6. Matches the parity rule (gain 5 → founding exp = G−1 = 4 → level 1+⌊4/3⌋ = 2). `s2-large-entry-founded.png` |
| S3 | Grow parity (₩250,000, same category 카페) | **PASS** | Grow dialog appeared with both `새로 짓기` and `키우기`. Chose `키우기` → host on plot 7 went **`Lv.2` → `Lv.4`** (exp 4 → 9), building count unchanged (`건물 2채` before and after), tier readout **`Tier 1` → `Tier 2`**. growthScore 6 → 11, **delta +5**. Counterfactual run on an identical town choosing `새로 짓기` instead: growthScore 6 → 11, **delta +5** (3 buildings, exp sum 8). **Parity holds exactly.** `s3-grow-dialog.png`, `s3-after-grow.png`, `s3b-after-build-new.png` |
| S4 | F16 monuments (`unsettled` fixture via `window.__aitLoadFixture`, `lastSettledPeriod` = 2026-04, 3 months stale) | **PASS with one deviation** | Exactly **3** monument tiles, engraved `2026-05`, `2026-06`, `2026-07` — one per unsettled month, each with its own period. "지난달 결산" card appeared **once**, showing the most recent settled month: `2026년 7월 결산 — 여유로웠어요 / 지출 392,660원 · 수입 2,189,142원 · 저축 380,900원`. **Deviation:** the monuments are NOT in ascending plot order — plots were 56 → `2026-05`, 57 → `2026-07`, 59 → `2026-06`. See note below. `s4-monuments-and-settlement-card.png` |
| S5 | Idempotency + dismissal (reload) | **PASS** | After dismissing the card and reloading: still exactly **3** monuments with the same three periods, **0** settlement cards. No re-minting, no card reappearance. `s5-after-reload-idempotent.png` |
| S6 | Monument detail popover | **PASS** | Tapping the `2026-05` monument opened a sheet headed `2026년 5월 결산` with `여유로웠어요`, 지출 403,097원 / 수입 1,904,132원 / 저축 231,418원 / 기록한 날 20일. `s6-monument-detail.png` |
| S7 | Console | **PASS (pre-existing noise only)** | 2 unique errors, 0 warnings. Both are the same TDS host-bridge error: `SafeAreaInsets를 가져오는 중 에러가 발생했습니다: Error: getSafeAreaInsets is not a constant handler`, thrown from `@toss/tds-mobile-ait`'s mount effect. Environmental — the app is running in a bare browser, not the Toss host — and unrelated to either feature. No app-code error, no React warning. |

## Note on S4's plot order

The AC as written says monuments land "in chronological plot order". In the real build they are **minted** in chronological order (`settleMonths` maps `unsettledPeriods` oldest-first, `buildingIdFor(i)` sequential), but the plot each one lands on comes from `placement.allocatePlots(...rng)`, which draws a **random** lot from the open pool (ADDENDUM-02 §3.2 rule R-5). So ascending plot index is only guaranteed by `settlementActions.test.ts`'s stub allocator (`[10, 11, 12]`), never in the app.

This is a design/AC wording mismatch, not a functional defect: the count, the per-month engraving, the chronological mint order, idempotency and the detail popover are all correct. Decide whether monuments should be exempted from random placement (a deliberate monument row) or whether the AC should drop "plot order".

## How to reproduce

```
npm run dev
PW=<abs path to an existing playwright/index.mjs> node evidence-f16-exp.mjs
```

`playwright` is deliberately not a dependency of this app; the script imports it by absolute file URL (ESM ignores `NODE_PATH`). Default path points at the npx cache copy already on this machine.
