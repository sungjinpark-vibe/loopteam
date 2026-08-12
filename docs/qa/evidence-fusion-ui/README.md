# ADDENDUM-11 §6 — fusion INTERACTION evidence

Captured against a real dev server (`granite dev --port 5199`, internally
`vite` on port 5174), NOT jsdom. Chromium via Playwright (installed to a
scratch dir — `playwright` is deliberately not a dependency of this app, same
discipline `scripts/evidence-art-fill.mjs` and `evidence-gate3-fixes` already
use), 390×844 @2x. `findings.json` is the raw measurement dump; `capture.mjs`
reproduces it.

Two Lv.5 "cafe" buildings (same footprint, same category — a legal §2.2 pair)
were seeded straight into `localStorage` before load, the same technique
`useTownStore.fusion.test.tsx` uses — 24 real entries per Lv.5 building would
otherwise be needed to raise the fixture through the UI.

| Shot | What it shows |
|---|---|
| `01-before-two-lv5-buildings.png` | Two Lv.5 cafe buildings standing, before any fusion |
| `02-detail-sheet-cta.png` | Tapping one opens its detail sheet; the 융합하기 CTA renders because a legal partner exists |
| `03-pick-mode-candidate-highlighted.png` | Tapping 융합하기 closes the sheet and enters fuse pick mode: the partner tile is highlighted, the "융합할 건물을 선택하세요" banner + 취소 show, and the entry-hint toast fires (same A1 affordance grow-pick has) |
| `04-after-cancel-fab-back.png` | Cancel path — 취소 exits pick mode with nothing committed: both Lv.5 buildings still standing, the banner is gone, and the FAB/mini-FAB are back |
| `05-confirm-dialog.png` | Tapping the highlighted candidate does NOT fuse immediately — a confirm dialog opens naming the category, current level, and resulting level ("카페 Lv.5 두 채를 합쳐 Lv.6 건물 하나로 만들어요. 사라지는 건물은 되돌릴 수 없어요.") |
| `06-after-fusion-lv6-and-freed-cell.png` | Confirming (합치기) commits: one Lv.6 building remains, the consumed building's cell is a plain empty lot, and the toast names the result + the seed award |
| `07-survivor-detail-sheet-lv6.png` | The survivor's own detail sheet now reads "레벨 Lv.6" (not the EXP-capped Lv.5) |

## Numbers that decide each behaviour

- CTA only renders with a legal partner: `ctaVisibleWithLegalPartner: true`.
- Pick mode highlights exactly the partner, not the initiator: `candidateCount: 1`.
- Cancel leaves both buildings intact and restores the FAB: `fabBackAfterCancel: true`, `moveBarGoneAfterCancel: true`.
- The confirm dialog is a real gate, not cosmetic: nothing is fused between shot 03 and 05 (still 2 boxes on the grid in `05-confirm-dialog.png`).
- After confirming: the consumed building's cell has no `.building-tile` (`cellBStillHasBuilding: false`), and the survivor's own sheet reads `Lv.6`.
- Zero console/page errors across the whole run (`consoleErrors: []`).

Note: the two seeded buildings render with the existing "Lv.5 shipping box"
placeholder look — this run predates the Lv.6-10 art landing (separate agent's
lane, `src/components/buildingArt.tsx`); the survivor keeps that same
placeholder look post-fusion, just reading Lv.6 in its badge/sheet. Re-run
`capture.mjs` once that art lands to see it applied.

Reproduce: start a dev server on a free port (`npx vite --port <free>` or
`granite dev --port <free>` — this box runs other teams' servers too, use a
port nobody else has), then:

```
PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:<port>
```

Stop the server by the PID you started — never by image name; this box runs
other teams' node processes (the Telegram HQ bridge among them).
