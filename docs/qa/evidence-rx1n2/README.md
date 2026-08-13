# RX1-N2 spacing rule — final evidence

The user's 2026-08-13 request was to fix the 2D front/back occlusion structurally instead of with the
`4e29bab` opacity fade. He picked **RX1-N2** from the mockups in `docs/qa/evidence-placement-patterns/`.

**This run is not a mock.** The mockups in that other folder were produced by rewriting `plotIndex` in
localStorage; the town here is laid out by the real, shipped `placeNew` through the app's own
`mixedFootprints` fixture. Only a level overlay (`level = 1 + (i % 10)`) is written on top, because
every fixture building is otherwise Lv.1 — and a Lv.1 building has zero overhang, which would make a
zero-occlusion result meaningless.

## The rule (`src/placement.ts`)

- **vertical** — no other building in the row directly above the footprint's top edge or directly below
  its bottom edge, in any column it spans. Art overhangs at most 45px, a row + gap is 46px, so the row
  behind is the only row a building can ever hide. Symmetric on purpose: a one-sided "row above must be
  clear" rule lets a building seated later, *above* an existing one, pass its own check and still occlude it.
- **horizontal** — at most `MAX_ROW_RUN` (2) buildings shoulder-to-shoulder before a gap, counted in
  **buildings, not cells**. That is why every footprint survives: a 2x1 is one building over two cells
  and never trips its own limit.

`canPlace = fits && spacingOk` is the single predicate; `anchorsFor` and `moveBuilding` are the only two
routes to it. `reconcilePlacement` deliberately keeps bare `fits` — existing towns are grandfathered.

## Measured off the real DOM (`findings.json`)

| | |
|---|---|
| buildings on map | 75 |
| footprint mix (1x1 / 1x2 / 2x1 / 2x2) | 52 / 6 / 12 / 5 |
| multi-cell buildings | 23 |
| **front/back occlusion pairs** | **0** |
| **longest row run** | **2** |
| faded overhangs (`4e29bab`) | 0 — nothing left to fade in a rule-built town |
| console errors | 0 |

The occlusion count is re-derived from cell ownership in the finished DOM, not from `spacingOk`, so it
cannot pass by agreeing with the rule that produced it.

## Screenshots

| file | what |
|---|---|
| `01-town-fit-scale.png` | the whole town at the default fit-whole-map zoom |
| `02-town-100pct.png` | the same town at 100% |
| `03-fusion-before-two-lv5.png` | two Lv.5 cafés on cells 7/8 (a legal run of 2) |
| `04-fusion-after-lv6-freed-cell.png` | after fusing — Lv.6 survivor, cell 8 freed |

Fusion is unaffected: the survivor keeps its plot and footprint, and the freed cell is genuinely empty
(`freedCellEmptyAfter: true`).

## What the fade does now

`4e29bab` **stays**. A town built under the rule has nothing to fade, but existing saves are
grandfathered — they still contain vertically adjacent buildings, and the fade is still what keeps
those readable. Deleting it would regress every pre-existing town.

## Reproducing

```
npm run dev            # read the port from the output
PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:<port>
```
