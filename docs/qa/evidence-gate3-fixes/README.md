# Gate-3 follow-up A1–A6 — browser evidence

Captured against a real dev server (`npx vite --port 5182`, 390×844 @2x,
Playwright chromium), NOT jsdom. `findings.json` is the raw measurement dump.

| Shot | Fix | What it shows |
|---|---|---|
| `a4-01-start-disabled-empty.png` | A4 | 시작하기 disabled with an empty budget |
| `a4-02-start-disabled-zero.png` | A4 | still disabled at a literal "0" |
| `a4-03-start-enabled.png` | A4 | enabled once a real amount is typed |
| `a2-01-first-founding-banner.png` | A2 | the first founding raises the non-blocking celebration banner, alone, clear of the tab bar and the FAB column |
| `a5-a6-01-reward-toast.png` | A5/A6 | reward toast naming the unit and the running balance, clear of the tab bar |
| `a5-02-shop-balance-and-prices.png` | A5 | the spend surface: balance chip and prices both name the unit |
| `a1-01-pick-mode-banner-and-hint.png` | A1 | pick mode: entry hint toast + instruction banner + 취소 |
| `a1-02-pick-mode-reject-hint.png` | A1 | a stray tap answers ("표시된 건물 중에서 골라주세요") and the mode stays open |
| `a1-03-after-cancel-fab-back.png` | A1 | 취소 leaves pick mode and the FAB is back |

## Numbers that decide each fix

- **A1** — 2 candidates highlighted; hint toast on entry; banner text flips to
  the reject hint on a non-candidate tap and back; after 취소, `.town-move-bar`
  count 0 and `.town-fab` count 1.
- **A2** — banner 585–668, no toast alongside it (before this fix the two
  stacked at 585–668 / 598–648 and the toast covered the banner's copy).
- **A3** — 0 console errors for the whole session, and 0 across a separate
  4-load + 4-reload run. Before: 2 per load, ~16 per session, the
  `getSafeAreaInsets is not a constant handler` line.
- **A4** — `emptyDisabled: true`, `zeroDisabled: true`, `validEnabled: true`.
- **A5** — toast `"🚌 교통 건물이 생겼어요 (+씨앗 3개 · 모은 6개)"`; shop chip
  `"씨앗 6개"`; price `"씨앗 150개"`.
- **A6** — toast card 598–648 vs tab bar 788–844 (140px clear);
  `tabBarReachable: true` and `fabReachable: true` while a toast is up. Before:
  the toast wrapper was returned by `elementFromPoint()` inside the tab bar.

Reproduce: start a dev server on a free port, then run the harness from the
scratchpad with `PW_PACKAGE` pointing at an existing Playwright install
(`playwright` is deliberately not a dependency of this app). Stop the server by
the PID you started — never by image name; this box runs other teams' node
processes.
