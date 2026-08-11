# ADDENDUM-08 — Fixed 20×20 map, natural unbuildable terrain, multi-tile buildings

Status: **approved by the director (2026-08-11)**, three explicit requirements. This addendum
**replaces** the growing-town geometry of ADDENDUM-01/05 and the 8-plot-column + block-edge-masking
system of ADDENDUM-06/07. Their *visual intent* (terraced elevation tone, 명당 prime lots, irregular
outline) is re-applied on the new grid; their *mechanisms* are deleted.

---

## §0 — The three director requirements (verbatim intent)

1. **The map is 20×20 = 400 cells.** Fixed. It does not grow.
2. **Unbuildable natural terrain sits in the middle of the map** — parks and lakes, Fortune City
   style. Deterministic (seed-fixed) placement, rendered as park/lake art, not as holes.
3. **New buildings get a random footprint** — one of 1×1 / 1×2 / 2×1 / 2×2. Placement, move, and
   collision all understand multi-cell footprints.

---

## §1 — The map is one authored constant

The entire map — roads, parks, lakes, the savings district, the buildable ground, and the town's
irregular outline — is **one 20-line ASCII constant in `src/townLayout.ts`**. Not a seeded procedural
generator. Deterministic by construction (there is no seed to drift), editable by a human without
reading code, and it is the single source of truth every consumer reads: rendering, placement, NPC
walkability, and the terrain art layer.

> This deletes `ROAD_COLUMN`, `SERPENTINE_COLUMNS`, `isCrossStreetRow`, `crossStreetColumnRange`,
> `blockColumnInset`, `isMaskedPlotCol`/`isMaskedCell`/`isMaskedPlotIndex`, `MAX_EDGE_INSET`,
> `MIN_UNMASKED_LOTS_PER_BLOCK`, `unmaskedLotsInBlock`, `unmaskedCapacity`, `LOTS_PER_BLOCK`,
> `blockGridColumnStart/End`, `blockCount`, `gridRowCount`, `crossStreetRowCount`,
> `renderedTileCount`, and the whole serpentine (`indexFromPlot`, `cellFromPlot`, `plotFromIndex`'s
> serpentine body). Delete them. Do not keep dead re-exports.

### §1.1 Legend

| Char  | Kind        | Buildable | NPC-walkable | Rendered as |
|-------|-------------|-----------|--------------|-------------|
| `.`   | `ground`    | **yes**   | no           | empty lot / building |
| `#`   | `road`      | no        | **yes**      | street |
| `P`   | `park`      | no        | **yes**      | park art (grass, trees, a bench) |
| `L`   | `lake`      | no        | no           | water art (shoreline + ripple) |
| `S`   | `savings`   | no (reserved) | no       | the 5 savings structures (ADDENDUM-01, unchanged) |
| ` `   | `void`      | no        | no           | nothing — this is what makes the outline jagged |

### §1.2 THE MAP (normative — copy exactly, 20 rows × 20 chars)

```
row  0: "    PPP......PPP    "
row  1: "  .....SSSSS.....   "
row  2: " ################## "
row  3: " ...#........#...PP "
row  4: " ...#........#..PPP "
row  5: "  ..#........#....P "
row  6: "  ..#........#..... "
row  7: "  ################# "
row  8: " ...#..LLLL..#..... "
row  9: " ...#.LLLLL..#..... "
row 10: " ...#..LLL...#..... "
row 11: " ...#........#..... "
row 12: " ################## "
row 13: " ...#PPP.....#..... "
row 14: " ...#PPPP....#..... "
row 15: " ...#PPP.....#....P "
row 16: "  ..#........#....  "
row 17: "  ################  "
row 18: "   ...PPP........   "
row 19: "     PPP.......     "
```

Expected census (**assert all six in `townLayout.test.ts`** — these numbers are the map's fingerprint;
if an edit changes them, the test forces the editor to look):

| ground | road | park | lake | savings | void | total |
|--------|------|------|------|---------|------|-------|
| 193    | 93   | 29   | 12   | 5       | 68   | 400   |

Structural invariants, each its own test:
- Every row is exactly 20 chars; exactly 20 rows.
- Exactly 5 `S` cells, contiguous on row 1 (cols 7–11).
- **The road network is one connected component** (flood-fill from any `#` reaches all 93).
- Every `S` cell is orthogonally adjacent to a road cell (savings must be reachable).
- At least 40 distinct valid 2×2 anchors exist on an empty map (a 2×2 building must always have a
  home at game start).
- Every `.` cell is reachable-adjacent to the road network within 3 cells (no landlocked lots).

---

## §2 — Coordinates and persistence

**`plotIndex` stays a single number and stays the persisted position field.** Its meaning changes:

```
plotIndex = row * 20 + col      // 0..399, the building's TOP-LEFT (anchor) cell
```

Renaming it to `{row, col}` would touch storage chunking, the move flow, reconcile, and ~20 test
files for no behavioural gain. It stays a number.

`cellFromIndex(i) = { row: Math.floor(i / 20), col: i % 20 }` and `indexFromCell({row, col}) = row * 20 + col`.
The serpentine is gone; these two are trivial inverses and both live in `townLayout.ts`.
`selectors.ts` re-exports nothing geometric — `TOWN_COLUMNS` is deleted, `plotFromIndex` is deleted.

### §2.1 Building footprint

`src/types.ts`, `Building` gains exactly two optional fields:

```ts
  w?: 1 | 2;  // footprint width in cells;  absent === 1
  h?: 1 | 2;  // footprint height in cells; absent === 1
```

**Optional, absent-means-1.** That is the entire backward-compat story for the ~thousands of already
persisted 1×1 buildings — no data migration, no defaulting pass, old JSON stays valid. Provide one
helper, used everywhere instead of reading `w`/`h` raw:

```ts
export function footprintOf(b: Pick<Building, "w" | "h">): { w: number; h: number }
export function footprintCells(anchorIndex: number, w: number, h: number): number[]   // townLayout.ts
```

Allowed footprints are exactly `1×1, 1×2, 2×1, 2×2`. Nothing larger. A footprint never rotates after
placement — moving a 2×1 keeps it 2×1.

### §2.2 Size roll

At creation (`placement.ts`, using the injected `RandomPort` — never `Math.random`):

| footprint | weight |
|-----------|--------|
| 1×1       | 60%    |
| 1×2 (w1 h2) | 15%  |
| 2×1 (w2 h1) | 15%  |
| 2×2       | 10%    |

`rollFootprint(rng): {w, h}`. Test: 10 000 draws with a seeded RNG land within ±3pp of each weight,
and only the four legal shapes are ever produced.

**Monuments (F16) and savings structures do not roll.** Savings structures are not buildings and keep
their fixed `S` cells. F16 monuments **ask for 2×2 specifically** and get it whenever a 2×2 anchor
exists — they are the town's landmark and this is the one place a big footprint is intended. If the
town is too full for any 2×2, the monument falls back through the normal downgrade chain (§3.1) and
is stored at the smaller size.

> **Invariant, and it is not negotiable: a building's stored `w`/`h` is always the footprint
> placement actually granted.** Never write a footprint that was not reserved. Forcing a stored 2×2
> onto a slot where only one cell was reserved leaves the other 3 cells outside `occupiedCells`, so
> the next building gets seated *inside* the monument — a visible overlap that lasts the whole
> session, which the next boot's reconcile then "repairs" by moving the player's monument. A smaller
> monument is correct; an overlapping one is not.

---

## §3 — Placement

`placement.ts` loses the whole pool/growth API (`requiredLots`, `poolSize`, `openPlotCount`,
`freePlots`, `blocksForUnmaskedCapacity`). All 193 ground cells are open from the first launch — the
map is fully visible on day one, exactly like the reference. `TownState.nextPlotIndex` / `plotsOpened`
become dead: **delete the field and its writers**; leave the persisted key readable-and-ignored so old
saves still parse.

New surface:

```ts
export function occupiedCells(buildings: Building[]): Set<number>
export function fits(anchor: number, w: number, h: number, occupied: Set<number>): boolean
export function anchorsFor(w: number, h: number, occupied: Set<number>): number[]
export function pickAnchor(buildings: Building[], w: number, h: number, rng: RandomPort): number | null
export function placeNew(buildings: Building[], rng: RandomPort): { anchor: number; w: number; h: number } | null
export function moveBuilding(buildings, buildingId, toAnchor): MoveResult
export function reconcilePlacement(buildings: Building[]): ReconcileResult
```

`fits` is true iff every cell of the footprint is (a) in bounds, (b) `ground`, (c) not in `occupied`.
A footprint may never straddle a road, park, lake, savings cell, void, or the map edge.

### §3.1 Placement-failure fallback (director asked this be pinned down)

`placeNew` rolls a footprint, then:

1. Try the rolled footprint. If `anchorsFor` is non-empty → pick uniformly at random. Done.
2. **Downgrade chain**, in this fixed order, taking the first that has an anchor:
   `2×2 → 2×1 → 1×2 → 1×1`. (`2×1` and `1×2` both downgrade straight to `1×1`.)
3. If even 1×1 has no anchor, the town is genuinely full → the building goes to the **existing
   pending queue** (`queueActions.ts`, the same path already used when no lot is available) and is
   placed on a later drain. **Nothing is ever dropped.**

Re-rolling a different random size was considered and rejected: a deterministic downgrade is
testable, and a re-roll can loop. The player sees a smaller building, never a lost one.

### §3.2 Reconcile (self-heal, runs on every boot)

Sort buildings by `(createdAt, id, plotIndex)`. For each in order:
- stored anchor is a legal `fits` against the cells already claimed by earlier winners → **keep it**;
- otherwise re-seat at the **first** legal anchor scanning in reading order (row 0 col 0 → row 19 col 19);
- if its footprint has no anchor anywhere, **shrink to 1×1** and retry;
- if 1×1 also has no anchor, the building is queued (§3.1 step 3), not deleted.

Loser buildings keep `id`, `source`, `categoryId`, `exp`, `builtOn`, `createdAt`, `monumentSummary`.
Only `plotIndex` (and, in the shrink case, `w`/`h`) changes. This is the existing contract, extended.

---

## §4 — Migration of existing saves

`LAYOUT_VERSION: 3 → 4` in `townLayout.ts`.

The existing mechanism is already exactly right and is **not** replaced: `loadBoot()` sees
`index.layoutVersion < LAYOUT_VERSION` with `buildings.length > 0`, rewrites the index, and fires the
one-time `{kind:"relayout"}` notice. What changes is that every old `plotIndex` is now meaningless in
the new coordinate space — so:

- **On a version-4 relayout, every building is force-re-seated**: reconcile treats *all* stored
  anchors as invalid for that one boot and lays the whole town out fresh in `(createdAt, id)` order
  per §3.2. Chronology is preserved: the oldest building gets the lowest free cell.
- Old buildings have no `w`/`h` → they stay 1×1 (§2.1). Existing towns do not retroactively grow
  big buildings; only newly created ones roll a footprint.
- Capacity: 193 ground cells ≫ any existing save. A test asserts a 193-building save relayouts with
  **zero losses**, and that the 194th building is queued rather than dropped.
- The relayout notice copy (Korean, user-facing) should say the town was rebuilt on a wider map —
  `ui-ux`/PM wording, not an implementer decision.

**Explicitly preserved through migration, each with a test**: F16 monuments (incl. `monumentSummary`
and their 2×2 promotion), savings structures and their ladders, building `exp` and the EXP→tier
thresholds, shop SKUs and purchased NPC slots, the move-building flow.

### §4.1 Tier reachability under a capped map (the one real interaction found)

The director asked whether tier thresholds are independent of geometry. **They are not fully
independent, and the naive claim is false** — verified against the code, not assumed:

`tier()` is fed `growthScore(buildings) = buildings.length + Σ exp` (`selectors.ts`, ADDENDUM-04 §3),
**not** raw EXP. Thresholds are `BALANCE.tierThresholds = [0, 10, 30, 80, 200]`.

The old town grew without bound, so the `buildings.length` term alone could reach 200. The new map is
capped: **193 buildable cells**, and footprints average `1×0.6 + 2×0.15 + 2×0.15 + 4×0.10 = 1.6`
cells per building, so a full town holds roughly **120 buildings**, and never more than 193.
**The `buildings.length` term can therefore no longer reach the top threshold on its own.**

This is not a break, because the `Σ exp` term is uncapped — growing an existing building raises
`growthScore` with no cell cost, which is exactly what ADDENDUM-04 introduced grows for. All five
tiers stay reachable; tier 4 now requires grows rather than pure sprawl.

- **Do not change `tierThresholds`.** The values stay `[0, 10, 30, 80, 200]` (`balance.approved.ts`
  is not touched by this addendum).
- Required tests: a literal snapshot of the threshold array (it must not drift); `growthScore` is
  unchanged in definition; and **tier 4 is reachable on a full map** — seed a town filled to capacity
  and add EXP via grows until `tier === 4`, proving no tier became unreachable.
- Flag to the director in the final report: reaching the top tier now takes growing buildings, not
  only adding them.

---

## §5 — Roads, NPCs, and the walkable set

- `isRoadCell(row, col)` → `terrainAt(row, col) === "road"`. Same name, new body, same callers.
- **`isWalkable(row, col)` = road ∨ park.** The director asked that parks be strollable; lakes are
  not. This is the only predicate `npc/movement.ts` uses, replacing its road-only test.
- NPCs spawn spaced evenly over the walkable set (existing `initialNpcStates`, unchanged logic).
- **NPC count rule is unchanged**: `min(1 + buildings.length + purchasedNpcSlots, NPC_MAX_VISIBLE)`.
- `NpcLayer` keeps measuring resolved grid tracks off the live DOM. On a uniform 20×20 grid every
  track is the same size, which makes this strictly simpler — but **do not replace it with computed
  constants**, because the zoom transform (§7) would then desync the sprites from the tiles.
- A park is walkable but never buildable, so an NPC can stand where no building will ever be — that
  is the point: the parks are where the town looks alive.

### §5.1 Known limitation: 7 decorative park cells (deliberate, verified)

The walkable set is 122 cells (93 road + 29 park). Only **115** are in the road-connected component.
The 7 outside it are `r0c4-c6`, `r0c13-c15` (the northern greenbelt strip, which sits above the
savings row and never touches a road) and `r15c18` (a lone east-fringe cell).

`initialNpcStates` therefore spawns **only inside the road-connected component**, so no NPC can be
stranded in a pocket. The 7 cells still render as parks — they are decorative greenbelt.

This is accepted rather than fixed in the map: connecting them means converting a `ground` cell to
`park`, which changes the §1.2 census that is now asserted in `townLayout.test.ts`,
`placement.test.ts` (the 83/115/148/193 anchor counts) and the store tests. Seven decorative cells do
not justify that churn. If the map is ever re-cut, re-check this number — the test that reports it
must stay.

---

## §6 — Art: preserving ADDENDUM-06/07 intent on the new grid

| ADDENDUM-06/07 concept | How it survives on 20×20 |
|---|---|
| Terraced elevation (계단식 고원 톤) | **Elevation band = `Math.floor(row / 5)`** → 4 bands. Each band paints one tint step and a small earth lip along its bottom edge (rows 4/9/14 boundaries). Pure function of `row`, render-only, never stored (rule R-2). `TERRACE_TINTS`, `TERRACE_EARTH_PX`, `TERRACE_DROP_PX` are reused as-is. |
| 명당 (prime lots) | **Derived, not authored**: a `ground` cell orthogonally adjacent to a road **and** orthogonally adjacent to a park or lake — the scenic street corner. `isPrimeCell(row,col)` / `isPrimePlotIndex(i)`. Same economy hook as today (`isPrimePlotIndex` keeps its name and meaning, so `useTownStore`'s award logic needs no change). Assert the count is in `[8, 60]` and print the actual value in the test name. A multi-cell building counts as prime if **any** cell of its footprint is prime. |
| Irregular outline (ADDENDUM-07 masking) | **`void` cells in the map itself.** The jagged edge is authored directly in §1.2 rather than computed by a masking hash. Same visual result, one less mechanism. |
| Terrace bleed / edge cuts | Dropped. `terraceEdgeInsetPx`, `TERRACE_EDGE_CUTS`, `TERRACE_BLEED_PX` are deleted — the void cells now do this job. |

Park art: grass base tint + 2–3 deterministic tree/bench glyphs chosen by `decorVariant(row, col, n)`
(kept — it is the existing R-2 decoration hash). Lake art: water fill, a lighter shoreline ring on
lake cells that touch a non-lake cell, one deterministic ripple. Both are CSS/SVG, no image assets
(the team cannot generate real artwork — `CLAUDE.md` Limitations).

---

## §7 — Viewport, and performance at 400 cells

The map is 20 columns wide. At the old `MIN_TILE_WIDTH_PX = 52` that is ~1160px — far past a phone.

- **`MIN_TILE_WIDTH_PX: 52 → 40`**, `TILE_HEIGHT_PX: 72 → 40` (cells become square; a square grid is
  what makes a 2×2 building read as a square building).
- `.town-viewport` gains `overflow-y: auto` alongside its existing `overflow-x: auto` and a bounded
  height, so the player pans the map by native scroll in both axes. No gesture library.
- The existing **zoom-to-fit toggle is kept and extended**: it must now fit *both* axes
  (`min(vw/scrollWidth, vh/scrollHeight)`) so "전체 보기" genuinely shows all 400 cells at once. Two
  states only — fit-whole-map ↔ 100%. No pinch zoom, no zoom levels.
- On first launch the map opens **fit-to-whole-map**, so the player's first impression is the town, not
  a corner of it.

Performance:
- The terrain layer (road/park/lake/void/elevation-band cells — ~207 of the 400) **never changes**.
  Render it from a `memo()`'d component that takes no props, so React never re-renders it after mount.
- Ground cells: one element per cell; buildings render as a single element spanning
  `grid-column: col+1 / span w; grid-row: row+1 / span h`. Do not render 4 sub-tiles for a 2×2.
- `anchorsFor` is O(400) per call — fine at this size. `occupiedCells` is built once per placement
  call, not per candidate. **`ponytail:` O(cells) rescan per placement; index by cell if the map ever
  grows past a few thousand.**
- QA must record a frame-time / interaction-latency number on a full map (~150 buildings) and compare
  it against the ADDENDUM-06 evidence baseline. A regression is a gate failure.

---

## §8 — Out of scope

Terrain that changes at runtime, buying/clearing park land, water features the player can place,
footprints larger than 2×2, rotation, and diagonal roads. None of these were asked for.

---

## §9 — Definition of done

1. Gate 1 (mechanical): `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm test` all green.
2. Every invariant in §1.2, §2.2, §3.1, §3.2, §4, §6 has a test that fails if the rule breaks.
3. Browser evidence at real scale (the `evidence-silhouette.mjs` pattern): a save seeded with ~150
   buildings **including every footprint size**, screenshotted at fit-whole-map and at 100%, showing
   the 20×20 grid, the parks and lake, and visibly multi-cell buildings.
4. A relayout screenshot: a version-3 save loaded, showing all buildings survived.
5. `docs/PLAY_GUIDE.md` updated for the new map and building sizes (Korean, non-technical).
6. Committed and pushed.
