# Placement-pattern investigation — structural fix for front/back occlusion

User request 2026-08-13: *"마을에 건물 배치를 앞/뒤로 겹치지 않도록 건물 건설 위치를 다시 구성해줘. 예를 들어,
건설은 가로 라인으로만 가능하고 세로는 못하게 하거나, 띄엄띄엄 바둑판/체스판 대각처럼 배치하도록."* — i.e. fix the
occlusion structurally instead of with the `4e29bab` opacity fade.

**Nothing here changes app behaviour.** `src/placement.ts` is untouched. Both files in this folder are
investigation harnesses.

## The geometry (verified, not assumed)

`MAX_ART_OVERHANG_PX = growPxFor(10) = (10-1) * 5 = 45` (`buildingArt.tsx:336-352`).
One grid row + gap = `TILE_HEIGHT_PX + GRID_GAP_PX = 40 + 6 = 46` (`townLayout.ts:232-234`).
45 < 46, so a building's art can only ever reach the row **directly** above it.

Horizontally the art cannot spill at all: the `<svg>` root clips to its viewBox and the box is the
tile (`buildingArt.tsx:299-304`, the d8ce379 freeze). **There is no diagonal occlusion**, only vertical.

So "no front/back overlap" ⇔ **no building sits in the row immediately above another building, in a
shared column.**

## The options

| | rule |
|---|---|
| `current` | no constraint (what ships today) |
| `H` | only every other **row** is buildable |
| `X` | checkerboard — only cells where `(row+col)` has one fixed parity |
| `R` | any cell, but no building may be vertically adjacent to another in a shared column |
| `RX1-N<n>` | **R + a horizontal run limit**: at most `n` buildings shoulder-to-shoulder in a row before an empty cell is forced |
| `RX2` | R, plus X's checkerboard mask applied to **1x1 only** (multi-cell footprints exempt) |

The hybrids answer the follow-up request *"R안이랑 X안을 적절하게 섞을 수 있을까?"* — keep R's vertical
rule (what actually guarantees zero overlap) and borrow X's horizontal spacing.

`RX1`'s run limit counts **buildings, not cells**. That distinction is the whole reason it passes: a
2x1 is one building occupying two cells, so it never trips its own limit. A cell-based run cap would
eliminate 2x1 and 2x2 at `n=1` exactly the way `X` does.

`R` must be checked **symmetrically** — the row above the footprint's top edge *and* the row below its
bottom edge. A one-sided "row above must be free" rule is not sufficient: a building seated later
*above* an existing one passes its own check and still occludes it.

## Files

- `capacity.mjs` — pure arithmetic (no `src/` import, runs on plain node). Re-implements the shipped
  map census, `fits`/`anchorsFor`, the 60/15/15/10 footprint roll and the `2x2→2x1→1x2→1x1` downgrade
  chain, then fills the town to exhaustion 8× per option. Also simulates a `forceReseat` relayout of
  an existing 143-building town. `node capacity.mjs`.
- `capture.mjs` — **mockup** screenshots. Loads the real app + the real `mixedFootprints` fixture, then
  rewrites each building's persisted `plotIndex`/`w`/`h` to the layout `capacity.mjs` computed for that
  option, plus the `4e29bab` level overlay (`level = 1 + (i % 10)`) so the height ladder is visible.
  Buildings past the option's capacity are **dropped from the mockup** — leaving them at `plotIndex -1`
  makes the app's own boot reconcile re-seat them under the *shipped* rules, scattering them back into
  the pattern's gaps. Everything downstream of position (art, height, roof colour, terrain, zoom) is the
  real shipped app.

```
PW_PACKAGE=<abs>/node_modules/playwright/index.mjs node capture.mjs --base http://localhost:<port>
```

## Results (`findings.json`, measured off the real DOM)

| option | buildings on map | 1x1 / 1x2 / 2x1 / 2x2 | occlusion pairs |
|---|---|---|---|
| current | 133 | 97 / 11 / 18 / 7 | **60** |
| H | 82 | 67 / **0** / 15 / **0** | 0 |
| X | 98 | 98 / **0** / **0** / **0** | 0 |
| R | 92 | 68 / 9 / 8 / 7 | 0 |
| RX1-N1 | 70 | 55 / 4 / 7 / 4 | 0 |
| RX1-N2 | 81 | 60 / 6 / 10 / 5 | 0 |
| RX1-N3 | 88 | 67 / 7 / 8 / 6 | 0 |
| RX2 | 77 | 55 / 6 / 10 / 6 | 0 |

Max count of a single footprint type on an empty map — **gate 1**, all four must be non-zero:

| option | 1x1 | 2x1 | 1x2 | 2x2 | cells used (of 193) |
|---|---|---|---|---|---|
| current | 193 | 84 | 81 | 35 | 193 (100%) |
| H | 97 | 41 | **0** | **0** | 97 (50%) |
| X | 98 | **0** | **0** | **0** | 98 (51%) |
| R | 112 | 47 | 48 | 20 | 127.6 (66%) |
| RX1-N1 | 98 | 43 | 44 | 18 | 93.8 (48.6%) |
| RX1-N2 | 105 | 43 | 46 | 18 | 115.0 (59.6%) |
| RX1-N3 | 108 | 46 | 47 | 20 | 120.4 (62.4%) |
| RX2 | 98 | 47 | 48 | 20 | 115.2 (59.7%) |

**Gate 2** (zero front/back overlap) is proved independently of the rule that produced the layout:
`overlapPairs()` re-derives cell ownership from the finished town and counts every cell whose
directly-above neighbour belongs to a different building. `current` scores 90; H, X, R and every
hybrid score **0**. The browser run agrees (`occlusionPairs` in `findings.json`, measured off the DOM).

**RX2 is eliminated on its own evidence.** The multi-cell exemption fires on 22 of 77 buildings — 29% —
so the checkerboard rhythm is not legible in the mockup; it reads as scatter, not as a pattern.

Relayout (`reconcilePlacement`, `forceReseat`) of an existing full 143-building town:

| option | seated | shrunk to 1x1 | left unplaced (invisible, queued) |
|---|---|---|---|
| current | 143 | 0 | 0 |
| H | 86 | 14 | **57** |
| X | 98 | 27 | **45** |
| R | 92 | 0 | **51** |

## Screenshots

`<option>-01-fit-scale.png` (the default fit-whole-map view) and `<option>-02-100pct.png` (100% zoom),
390x844 @3x.

## Tier reachability

`townScale = Σ 2 ** fuseOf(b)` (`selectors.ts:114-118`), top threshold 200 (`balance.approved.ts`,
untouched). `MAX_FUSE_TIER = 5` → 32 scale per building. Fusion is exactly tier-neutral *and* frees a
cell, so `townScale` equals lifetime foundings and accumulates past the concurrent-capacity cap —
confirmed. Tier 200 stays reachable under every option; what changes is how many fusions are needed to
hold 200 within capacity (`200 − capacity`):

| option | capacity | scale ceiling | min fusions for 200 |
|---|---|---|---|
| current | 136 | 4352 | 64 |
| H | 81 | 2592 | 119 |
| X | 98 | 3136 | 102 |
| R | 89 | 2848 | 111 |
| RX1-N1 | 68 | 2176 | **132** |
| RX1-N2 | 80 | 2560 | 120 |
| RX1-N3 | 85 | 2720 | 115 |

The capacity cut compounds as expected — RX1-N1 costs 68 more fusions than today, RX1-N2 costs 56.
