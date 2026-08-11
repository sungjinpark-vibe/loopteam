# ADDENDUM-07 — block-edge masking (outer silhouette) — QA evidence

Director feedback: "the village is still a rectangle." Root cause (confirmed): the terrace
slab, cross streets, and plot tiles all spanned the FULL grid width per block
(`gridColumn: "1 / -1"`), so `terraceEdgeInsetPx`'s 0/6/12px bleed (~2-3% of a ~400px-wide
grid) could never break the rectangle. Fix: mask 0..2 whole plot columns off each block's
LEFT/RIGHT outer edge (deterministic, never the street-front/명당 columns), and make the
terrace slab / cross streets / tile loop render the block's actual live footprint instead
of the full grid.

## Verdict

Implementation complete. All gates green:

- `npx vitest run` — **687 / 687 tests pass** (57 files), zero failures.
- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean.

`LAYOUT_VERSION` bumped 2 -> 3 (the town's shape genuinely changes; every building relocates
on screen on next boot).

## Block widths (the director's own worked example)

`decorVariant(b, side+1, 3)` (MAX_EDGE_INSET = 2) gives insets that cycle with period 3:

| block (b) | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| left inset (plot cols) | 2 | 0 | 1 | 2 | 0 |
| right inset (plot cols) | 1 | 2 | 0 | 1 | 2 |
| **width (plot cols)** | **5** | **6** | **7** | **5** | **6** |
| lots/block (× BLOCK_ROWS=2) | 10 | 12 | 14 | 10 | 12 |

Matches the task's stated expectation exactly (5, 6, 7, 5, 6). No two adjacent blocks share a
width, and the spread (max−min = 2) exceeds the required minimum. No hash adjustment was
needed — verified, not assumed.

Plot columns 3 and 4 (grid columns `ROAD_COLUMN±1`, the street-front / 명당 columns) can
never be masked: `MAX_EDGE_INSET = 2` caps the left mask at plot cols {0,1} and the right
mask at {6,7}, leaving cols 2..5 always live for ANY inset value ≤ 2 — asserted directly
(`townLayout.test.ts`, "street-front / 명당 plot columns can NEVER be masked", b = 0..200).

## Capacity / pacing impact (measured, not assumed)

**Tier pacing is unaffected.** `tier()` (selectors.ts) is driven purely by `growthScore`
(building/EXP count) via `BALANCE.tierThresholds` — it has no dependency on plot geometry,
block count, or rendered tile count. Confirmed by reading every call site
(`useTownStore.ts`, `entryActions.ts`, `noSpendActions.ts`, `queueActions.ts`,
`historyActions.ts`) — none references `renderedTileCount`/`blockCount`/`poolSize`.

**Raw block/pool size DOES grow faster than before**, because a block's average buildable
density dropped from 16 lots (100%) to ~12 lots (75%, cycling 10/12/14). The guaranteed floor
is 8 lots/block (`MIN_UNMASKED_LOTS_PER_BLOCK`, never actually hit by today's hash — the
real minimum achieved is 10). Measured via the real `poolSize` pipeline, growth-frontier only
(no buildings, matching production's non-corrupt path):

| buildings (nextPlotIndex) | old blocks | old raw pool | new blocks | new raw pool |
|---|---|---|---|---|
| 12 | 1 | 16 | 2 | 32 |
| 24 | 2 | 32 | 3 | 48 |
| 74 (the reference 74-building town, `docs/qa/silhouette-findings.json`) | 5 | 80 | 7 | 112 |
| 200 | 13 | 208 | 17 | 272 |
| 600 | 38 | 608 | 51 | 816 |

So the town's visual extent (rows/blocks rendered) grows roughly 1.3-1.35x faster than
before for the same building count — this is the direct, intended cost of trading raw tile
density for a ragged silhouette. It changes nothing gameplay-mechanical (no gate, slot, or
unlock reads block/tile count); it only means the town scrolls/zooms over more rows sooner.

## G2 (a free lot always exists) — restated and re-proven for masking

Old proof: `poolSize > taken.size` always (any `(plotsOpened, taken)` pair). New proof
(`placement.ts`, `poolSize`'s doc comment in full): `poolSize` now grows in units of
"add whole blocks until their **UNMASKED** capacity clears `need`" instead of "until their
RAW capacity clears `need`". Each block still contributes >= 8 (`MIN_UNMASKED_LOTS_PER_BLOCK`)
guaranteed-unmasked lots regardless of the hash, so growing the pool by one block always
restores G2. `requiredLots`'s own escape-valve threshold (`framedPool`) had to become
masking-aware too — see "bug found and fixed" below.

## Bug found and fixed during implementation: escape-valve runaway

First pass wired `poolSize` to the new masking-aware block search but left
`requiredLots`'s corrupt-data escape-valve threshold (`framedPool`) on the OLD
`renderedTileCount(frontier + 1)` (raw-only). Because the new raw pool is legitimately wider
than `renderedTileCount` alone accounts for, an ordinary `pickPlot` draw routinely landed past
that stale threshold, spuriously firing the "this occupied index looks corrupt" escape valve
on completely normal input — and since the valve's own effect is to widen the pool further,
this compounded every draw into an unbounded runaway. Caught via a scripted repro of AC-P1's
1,000-placement trial: `pool` grew past 100,000 by build ~200, and `pickPlotIn` eventually
threw `RangeError: Invalid array length`. Fixed by making `framedPool` itself
`blocksForUnmaskedCapacity(frontier) * LOTS_PER_BLOCK` — the same formula `poolSize` uses —
closing the gap between the threshold `requiredLots` checks and the pool `poolSize` actually
returns. Re-ran the 1,000-placement trial after the fix: stable, no runaway (`pool` bound
under 5,000 throughout an equivalent trial).

## Frontage invariant (spec §3.2)

Every UNMASKED (rendered) lot keeps road frontage — proven structurally, not just tested:
`crossStreetColumnRange(row)` spans the UNION of its two neighboring blocks' own live column
ranges, which by construction always covers each neighbor's own full footprint. Verified for
b = 0..600 (`townLayout.test.ts`) and re-asserted over the move-destination space
(`placement.test.ts`'s AC-M11). Masked cells are void and excluded from the invariant (they
were never rendered lots).

## NPC walkability

`isRoadCell(row, col)` now reads the exact same `crossStreetColumnRange` TownGrid uses to
paint the street, so a cross-street NPC route can never include a column outside what's
actually rendered. No changes were needed to `NpcLayer.tsx` itself — it already calls
`isRoadCell` and nothing else. Verified with a concrete regression
(`townLayout.test.ts`, "NPC walkability regression") plus a general consistency check across
every cross-street row, 0..600.

## Files changed

- `src/townLayout.ts` — masking primitives (`MAX_EDGE_INSET`, `blockColumnInset`,
  `isMaskedPlotCol/Cell/PlotIndex`, `blockGridColumnStart/End`, `crossStreetColumnRange`,
  `unmaskedLotsInBlock`, `unmaskedCapacity`, `LOTS_PER_BLOCK`), `isRoadCell` rewrite,
  `LAYOUT_VERSION` 2 -> 3.
- `src/placement.ts` — `poolSize`/`requiredLots` masking-aware (+ the escape-valve fix above),
  `freePlots`/`pickPlotIn` exclude masked indices, `moveBuilding` rejects a masked destination
  as `"out-of-town"`, `reconcilePlacement` treats a masked `plotIndex` as a loser and never
  re-seats onto another masked cell.
- `src/components/TownGrid.tsx` — terrace slab spans the block's own live column range
  (not `1 / -1`); cross street spans the union of its two neighbors; tile loop skips a
  masked+unoccupied cell entirely (a masked+occupied one still renders, DE-2/G1).
- `src/devtools/fixtures.ts` — plot allocation now goes through the real `pickPlotIn`
  pipeline (a dedicated RNG stream per fixture, independent of the fixture's own
  entry-generation RNG, so every other fixture-derived assertion stays byte-identical) instead
  of a raw incrementing counter, so every devtools fixture (`dense` included, ~5,400
  buildings) stays a "valid, no repair needed" town under the new masking rule.
- Tests: `townLayout.test.ts`, `placement.test.ts`, `components/TownGrid.test.tsx`,
  `useTownStore.test.tsx`, `useTownStore.move.test.tsx`, `useTownStore.reconcile.test.tsx`,
  `devtools/moveModeDense.test.tsx` — new masking coverage plus fixes to fixtures/assertions
  that hard-coded plot indices now inside block 0's masked set (block 0 always masks plot
  cols {0,1,7} -> raw indices {0,1,7,8,14,15}).

## Constraints re-verified intact

- 명당 (`isPrimeLot`/`isPrimePlotIndex`) — structurally unmaskable (see above); its own test
  suite untouched and still green.
- F16 monument, move mode, NPC-roads-only, savings block, zoom-to-fit — no code touched
  outside what's listed above; their existing test suites pass unchanged (only literal plot
  indices that happened to land in block 0's masked set were adjusted, never the behavior
  under test).
