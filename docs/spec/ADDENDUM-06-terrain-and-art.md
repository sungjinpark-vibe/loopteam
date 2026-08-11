# ADDENDUM-06 — terraced terrain, 명당 placement, and building art variety

> Status: **draft for director approval**. Written by `planner`+`ui-ux` after reading the shipped
> system (`townLayout.ts`, `selectors.ts`, `placement.ts`, `TownGrid.tsx`, `buildingArt.tsx`,
> `npc/movement.ts`, `NpcLayer.tsx`, `App.css`) and the QA evidence at
> `docs/qa/evidence-addendum05/01,02,04.png`.
>
> Supersedes nothing. Amends ADDENDUM-01 §3.7 ("what makes it read as a village"), extends
> ADDENDUM-05 §4 (F-BLD building art) and §6 (F-ECON seed awards). **`plotFromIndex` / `TOWN_COLUMNS`
> (`selectors.ts`) are not opened by any work package here** — the storage mapping is untouched, the
> same regression rule ADDENDUM-01 §3.8 already enforces.

## 0. What the director asked

Verbatim (2026-08-11): *"마을이 너무 단조롭다. 포춘시티처럼 마을 모양을 복잡하게 만들어 건물을 적절하게
배치하는 재미도 느낄 수 있게 하라."*

Two asks, not one:

1. **Shape** — the village silhouette must stop being a flat rectangular grid. Fortune City reads as a
   stepped, terraced floating island: plateaus at different heights, a dark earth cross-section under
   the ground, an irregular outline, roads as the connectors between levels.
2. **Placement fun** — *where* you put a building must become a decision with a payoff. Today
   `pickPlot` drops a new building on a uniformly random free lot and `moveBuilding` lets you move it
   anywhere, for free, for no reason. There is nothing to decide, so there is nothing to enjoy.

Nothing else is in scope. No new screen, no new currency, no multi-tile buildings, no map editor.

### 0.1 Why the town currently reads flat (from the evidence, not from taste)

Looking at `02-town-six-category-buildings.png` and `04-town-zoomed-out-full-width.png`:

| Observation | Cause in code |
|---|---|
| Every lot is the same 52×72 box on the same white page | `.town-tile { height: var(--town-tile-h) }` + `#root`'s white background — the town has **no ground of its own**, it floats on the page |
| Buildings read as a grid of coloured rounded squares, not as buildings | `PlaceholderBuilding` paints `style={{ backgroundColor: color }}` on `.building-tile` (a 12px-radius, full-bleed category swatch) *behind* the SVG. The swatch, not the art, is what the eye sees at 52px |
| Buildings look blank | `buildingCube` emits exactly **two** window quads for the whole building (`win-l`, `win-r`), both `colors.grey50` — the same value as the wall on white-walled archetypes |
| The town has no top and no bottom | Every grid row is the same, forever, so a 6-building town and a 600-building town have the same silhouette |

All four are fixable at render time. None of them requires touching what is stored.

## 1. Non-negotiable constraints this design is built around

| # | Constraint | Source |
|---|---|---|
| C-1 | `plotFromIndex` / `TOWN_COLUMNS` (`selectors.ts`) are the **persisted** storage mapping. Not opened. | `selectors.ts:17-24`, ADDENDUM-01 §3.8 regression AC |
| C-2 | `townLayout.ts` is never persisted — "any constant below can change with no migration". Terrain lives here. | `townLayout.ts:5-8` |
| C-3 | **Rule R-2** — decoration is a pure function of `(row, col)`, never stored, never versioned. | ADDENDUM-01 §3.6 |
| C-4 | **Rule R-3** — App.css may not restate a pixel constant or a grid coordinate `townLayout.ts` owns. Values arrive as inline styles or fallback-less custom properties. | ADDENDUM-01 §3.5, `App.css:255-264` |
| C-5 | **Rule R-6** — no `Math.random` outside the injected `RandomPort`. Terrain and props are deterministic, not random. | `placement.ts:3`, eslint-enforced |
| C-6 | **Rule R-12** — the sky is off limits. `.town-screen--mood-*`'s gradient **is** F6's budget-pace signal. | ADDENDUM-05 §8, `App.css:99-117` |
| C-7 | NPC walkability is `isRoadCell(row, col)` bounded by `rowCount`; `NpcLayer` positions sprites by **measuring resolved `grid-template-*` tracks off the live DOM**. Anything that changes a track size moves every NPC. | `NpcLayer.tsx:78-117` |
| C-8 | `.town-grid` has **no z-index anywhere** — DOM order alone decides stacking. A `z-index` creates a stacking context that paints the main street's centre line over the crosswalk. | `App.css:415-420` |
| C-9 | `TownGrid.test.tsx` asserts `.town-grid`'s **exact direct-children count** twice (lines 224, 337). Any new direct grid item must appear in that formula. | `TownGrid.test.tsx:214, 333` |
| C-10 | A prior unmemoized layer regression cost **2.4× render time**. Static render layers are memoized on a minimal prop set and never re-render on an NPC tick or a store update. | `NpcLayer.tsx:152-158` |

## 2. Terrain model — terraces as a pure function of the block index

### 2.1 The mapping, in one sentence

**One plot block is one terrace.** The grid is already blocked (`BLOCK_ROWS = 2` plot rows bounded by
cross streets, `blockIndexOf(row)`), so the terracing the director asked for is already latent in the
geometry — it is simply not painted. Elevation is `blockIndexOf(row)`; nothing new is computed, nothing
new is stored, and no tile moves.

```
grid row   what it is                        what ADDENDUM-06 paints
────────────────────────────────────────────────────────────────────────
  0        entrance cross street             — (road, unchanged)
  1        savings row                       — (savings block, unchanged)
  2        closing cross street              — (road, unchanged)
  3  ┐                                       ┐
  4  ┘     block 0's two plot rows           ┘  terrace slab 0 (tint A, edge cut a)
  5        cross street                      ← the ramp/stair between terrace 0 and 1
  6  ┐                                       ┐
  7  ┘     block 1's two plot rows           ┘  terrace slab 1 (tint B, edge cut b)
  8        cross street                      ← ramp
  …
```

The dark earth cross-section hangs from the **bottom edge of each slab into the cross-street row
below it**, painted by an absolutely-positioned pseudo-element inside the slab. The cross street is
emitted **after** the slabs in DOM order, so the road paints on top of the earth band and stays a
continuous, unbroken ribbon — that is what keeps C-7 (NPC walkability) intact by construction, not by
a check.

### 2.2 New API in `townLayout.ts` (the only file that gains terrain logic)

```ts
// ── ADDENDUM-06 §2 — terrain. Render-time only, never persisted (C-2), pure
// functions of the grid row alone (C-3). No new state, no new storage key.

/** Height of the earth cross-section hanging below a terrace slab. */
export const TERRACE_EARTH_PX = 10;
/** How far one terrace's shadow falls onto the ramp below it. */
export const TERRACE_DROP_PX = 6;
/**
 * Max horizontal bleed of a terrace slab past the plot columns, into
 * `.town-grid`'s own padding. MUST stay <= GRID_PADDING_X_PX (16) — a larger
 * value would push the slab under the viewport edge and reintroduce the
 * horizontal overflow `.town-viewport` exists to scroll. Asserted.
 */
export const TERRACE_BLEED_PX = 12;
/** Number of ground tints in the elevation ramp. */
export const TERRACE_TINTS = 3;
/** Number of distinct silhouette cuts a terrace edge can take. */
export const TERRACE_EDGE_CUTS = 3;

/** Grid row of block `b`'s FIRST plot row. Inverse of `blockIndexOf` on its first row. */
export function blockFirstRow(b: number): number {
  return TOWN_HEAD_ROWS + 1 + b * (BLOCK_ROWS + 1);
}

/** Elevation tint step for a terrace, 0..TERRACE_TINTS-1. Decoration only (R-2). */
export function terraceTintOf(b: number): number {
  return decorVariant(b, 0, TERRACE_TINTS);
}

/**
 * Silhouette inset, in px, of one terrace's left (side 0) / right (side 1)
 * edge — this is what makes the town outline irregular instead of a
 * rectangle. Reuses `decorVariant` (R-2): deterministic, never stored, never
 * `Math.random` (R-6). Always in [0, TERRACE_BLEED_PX].
 */
export function terraceEdgeInsetPx(b: number, side: 0 | 1): number {
  const cut = decorVariant(b, side + 1, TERRACE_EDGE_CUTS); // 0 | 1 | 2
  return Math.round((cut * TERRACE_BLEED_PX) / (TERRACE_EDGE_CUTS - 1)); // 0 | 6 | 12
}

/**
 * A 명당 (prime lot): the two street-front lots on a block's FIRST plot row —
 * the corner of the plaza where the cross street meets the main street, and
 * the lot that overlooks the terrace edge. Exactly 2 per block, at every town
 * size, forever.
 *
 * ⚠️ TRAP, do not drop the first clause: `isBlockFirstRow(0)` is `true`
 * (`(0 - 2 - 1) % 3 === 0` in JS's signed modulo), and row 0 is the entrance
 * CROSS STREET, not a plot row. `row > TOWN_HEAD_ROWS` is what excludes it —
 * and excludes the savings rows with it.
 */
export function isPrimeLot(row: number, col: number): boolean {
  return row > TOWN_HEAD_ROWS && isBlockFirstRow(row) && isStreetFrontCol(col);
}

/** The same predicate in plot-index space — what non-render callers (economy) use. */
export function isPrimePlotIndex(i: number): boolean {
  const { row, col } = cellFromIndex(i);
  return isPrimeLot(row, col);
}
```

`blockCount(plotCount)` (already exported) is the terrace count. Nothing else is needed.

### 2.3 Render contract (`TownGrid.tsx`)

One new direct grid item per block, emitted **first**, before `.town-main-street`:

```tsx
{terraces.map((b) => (
  <div
    key={`terrace-${b}`}
    className={`town-terrace town-terrace--t${terraceTintOf(b)}`}
    style={{
      gridColumn: "1 / -1",
      gridRow: `${blockFirstRow(b) + 1} / span ${BLOCK_ROWS}`,
      // R-3 (C-4): the two insets are per-instance values, so they arrive
      // inline as custom properties, exactly like the nine on `.town-grid`.
      "--terrace-inset-l": `${terraceEdgeInsetPx(b, 0)}px`,
      "--terrace-inset-r": `${terraceEdgeInsetPx(b, 1)}px`,
    } as CSSProperties}
  />
))}
```

`terraces` is `useMemo(() => range(blockCount(tileCount)), [tileCount])` — rebuilt only when the town
actually grows. Three shared metrics (`TERRACE_EARTH_PX`, `TERRACE_DROP_PX`, `TERRACE_BLEED_PX`) join
the existing nine custom properties on `.town-grid` as `--terrace-earth-h` / `--terrace-drop` /
`--terrace-bleed`, with **no CSS fallback** (C-4).

**Five hard render rules.** These are what make the terrain provably free of layout risk:

- **T-R1 — no z-index, ever.** Terraces paint behind everything because they are emitted first (C-8).
- **T-R2 — a terrace may not change a grid track size.** It may paint only via negative margins into
  `.town-grid`'s padding and via `position: absolute` pseudo-elements inside its own box. It declares
  no `height`, no `width`, no `padding` that grows the row. This is the rule that protects C-7: if a
  row's resolved height changes, every NPC sprite moves, because `NpcLayer` measures those tracks.
- **T-R3 — `pointer-events: none`.** A terrace is under the tiles; it must never win a hit-test.
- **T-R4 — `aria-hidden="true"`, no `role`.** It is ground, not a control.
- **T-R5 — the earth band hangs into the cross-street row, never over it.** The band is
  `.town-terrace::after { position: absolute; top: 100%; height: var(--terrace-earth-h) }`, and the
  cross street is a later sibling, so the road wins the paint. Verified visually, not just by rule.

### 2.4 Does `LAYOUT_VERSION` bump? **No.**

Rule R-1 bumps `LAYOUT_VERSION` when a constant changes such that **every building relocates on
screen** — which is what fires the one-time `relayout` notice ("마을에 도로가 새로 놓였어요…").

Nothing in §2 changes `cellFromIndex`, `GRID_TEMPLATE_COLUMNS`, `TILE_HEIGHT_PX`, `GRID_GAP_PX`,
`ROAD_*_PX`, `MIN_TILE_WIDTH_PX`, `GRID_PADDING_X_PX`, `TOWN_HEAD_ROWS` or `BLOCK_ROWS`. Every
building stays on the exact grid cell it occupied before this ships; the ground under it is painted
differently. Bumping would fire a false "your buildings moved" toast at every existing player for a
change that moved nothing. **`LAYOUT_VERSION` stays 2.**

> **Trigger to revisit:** if an implementer finds the earth band needs real row height (i.e. T-R2
> cannot be satisfied and `TILE_HEIGHT_PX` or `ROAD_HEIGHT_PX` must grow), that change *does* relocate
> every building, and `LAYOUT_VERSION` must go 2 → 3 in the same commit. Do not ship a track-size
> change without the bump.

### 2.5 Deliberately rejected

| Rejected | Why | Add when |
|---|---|---|
| Real per-terrace `transform: translateY()` elevation | Desyncs every NPC sprite from the road it is standing on (C-7) and every tile from its own hit-test box. The stepped *look* comes from the earth band + drop shadow, which cost nothing. | never |
| Isometric / rotated grid | Rewrites `cellFromIndex`, the gesture hook's `closest("[data-plot-index]")` hit-testing, `NpcLayer`'s track measurement, and every AC in ADDENDUM-01 §3.8. Weeks of work, and the director asked for *shape*, not *projection*. | never in this addendum |
| Narrowing the actual grid toward the top | Column widths are `minmax(52px,1fr)` and shared by every row; per-row narrowing means per-row templates, which breaks `NpcLayer`'s single measured column array. The silhouette cut (§2.2 `terraceEdgeInsetPx`) buys the irregular outline for 3 lines. | never |
| Multi-tile / wide plots | Breaks `cellFromIndex` injectivity, `occupiedPlots`, `moveBuilding`'s V3/V4, `freePlots`, the frontage invariant, and the pool arithmetic in `placement.ts` — the single most load-bearing proof in the codebase. See §3.1. | never |

## 3. Placement fun — 명당 (prime lots)

### 3.1 What was evaluated, and what was picked

| Option | Verdict |
|---|---|
| **Tile size variety** (some plots wide/premium) | **Rejected.** A plot that spans two grid columns is a second plot-index space. `placement.ts`'s entire G1/G2 proof (`poolSize`, `requiredLots`, `pickPlotIn`, `moveBuilding` V3/V4) assumes one index = one cell = one occupant. Rewriting it to support widths is the largest change in this document and delivers the *least* of the director's two asks — a wide building is art, not a decision. §4 gets the "wide landmark" **look** with zero geometry change. |
| **Terrace tiers unlocking as the town grows** | **Already shipped.** `blockCount(plotCount)` grows blocks with the town today; the terrain layer (§2) is what makes that growth *legible*. Nothing to build. |
| **Prime spots (명당)** | **Picked.** One pure predicate (`isPrimeLot`, §2.2), one visual marker, one balance dial. Nothing persisted, no new currency, no new screen. |

### 3.2 The mechanic, in full

**What a 명당 is.** The two street-front lots on each block's first plot row — the plaza corner where a
cross street meets the main street. Exactly 2 per block, structurally scarce, and structurally
*visible* (they are the lots the player's eye already lands on).

**What it pays.** At monthly settlement (F16), the existing seed award gains a standing bonus for
every live building sitting on a 명당:

```ts
// economy/awards.ts — AwardEvent's settlement case gains ONE field.
| { kind: "settlement"; period: string; outcomeBucket: number; primeLotCount: number }

case "settlement":
  return {
    eventKey: `seed:settlement:${event.period}`,     // UNCHANGED — same idempotency key
    amount:
      (BALANCE.seedAwards.settlementByOutcomeBucket[event.outcomeBucket] ?? 0) +
      Math.min(
        BALANCE.seedAwards.primeLotMax,
        BALANCE.seedAwards.primeLot * Math.max(0, event.primeLotCount),
      ),
  };
```

```ts
// balance.approved.ts — two new dials inside the EXISTING seedAwards block.
seedAwards: {
  // …build / nospend / tier / settlementByOutcomeBucket unchanged…
  primeLot: 3,      // ADDENDUM-06 §3 — seeds per building standing on a 명당, per settlement
  primeLotMax: 30,  // ceiling, so a very large town cannot farm this into the shop's price floor
},
```

The count is computed at the one existing call site (`useTownStore.ts:510`) from state already in
hand: `buildings.filter((b) => isPrimePlotIndex(b.plotIndex)).length`.

**Why this shape and not the obvious alternatives:**

- **Not EXP.** ADDENDUM-04 §3's parity rule is explicit — every logging act adds exactly
  `expGainFor(amountKrw)` to the growth score, whichever branch it takes. A location bonus on EXP
  changes tier pacing for every existing save. Off limits.
- **Not a one-shot bonus at build time.** A new building lands *randomly* (`pickPlot`); a one-shot
  bonus would pay the dice, not the player. Paying the **standing arrangement** at settlement is what
  makes the existing, currently-pointless move gesture worth using.
- **Not a new currency.** 씨앗 already exist, already have an idempotent grant ledger
  (`grantedEventKeys`), already have a sink (the shop). ADDENDUM-05 §6's invariant is untouched: 씨앗
  still buy cosmetics and NPC slots only, and no purchase changes what a building says about spending.
- **`pickPlot` stays uniformly random.** Biasing placement toward 명당 would hand the player the perk
  for free and delete the decision. The whole point is that the good lots are *taken by choice*.

**The loop, end to end:** the terraces make each block read as its own plateau → the two plaza corners
are marked → the player long-presses a building and moves it there (a gesture that already exists and
today has no reason to exist) → settlement pays more → the shop has more in it.

### 3.3 Visual marker + affordance

- **Always visible:** a 명당's `EmptyLot` and its tile gain `.town-tile--prime`: a pink plaza paving
  patch (`--plaza-paving`) with a `--prime-marker` ring, plus the existing streetlamp. **The
  `decorVariant(blockIndexOf(row), 0, 2) === 0` "every second block" filter on
  `.town-tile--streetlight` is dropped** — the lamp now marks every 명당, so the lamp *means* something
  instead of being noise.
- **In move mode:** a droppable tile that is also a 명당 gets `.town-tile--droppable.town-tile--prime`
  and its `aria-label` becomes `"명당 빈 터, 여기로 옮기기"` (vs. today's `"빈 터, 여기로 옮기기"`).
  This is the a11y requirement — the perk must never be conveyed by colour alone.
- **No tutorial, no tooltip, no coach mark.** The settlement toast already reports the award; the lamp
  + paving + label are the teaching. If playtest says players never discover it, add one line to the
  settlement summary — not a modal.

## 4. Building art variety (`buildingArt.tsx`)

**SVG only, self-authored, no image files, no external assets, no fonts.** Every shape below is drawn
with the existing `quadPts` / `pointsAttr` / `bil` helpers on the existing 120×176 viewBox. Colour
comes from `@toss/tds-colors` tokens — the rule this file's header already sets. **`BuildingVisualProps`
stays byte-identical** (ADDENDUM-05 §4's standing promise); no call site moves.

### 4.1 Window light — the highest value-per-line change

Today `buildingCube` emits **two** window quads for an entire building, both `colors.grey50`. That is
why buildings read as blank boxes at 52px. Replace with a window grid and a warm pane:

```ts
/** `cols × rows` window quads on one face — the whole "buildings look lived-in" fix. */
function windowGrid(A: Vec, B: Vec, C: Vec, D: Vec, cols: number, rows: number, fill: string, key: string) {
  const out: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = 0.18 + (c * 0.64) / cols, v0 = 0.34 + (r * 0.44) / rows;
      out.push(<polygon key={`${key}-${r}-${c}`} points={pointsAttr(quadPts(A, B, C, D, u0, u0 + 0.4 / cols, v0, v0 + 0.28 / rows))} fill={fill} />);
    }
  }
  return out;
}
```

- `Palette.win` changes `colors.grey50` → **`colors.yellow100`** (a lit pane), and a new
  `Palette.winDark` = `colors.grey200` for the unlit ones.
- Rows scale with level: `windowRows = 1 + floorsFor(level)` (0 floors → 1 row, capped at 4).
- Roughly one pane in three is unlit, chosen by `(r * 3 + c + variantIndex) % 3 === 0` — deterministic
  (C-5), and it is what stops a building looking like graph paper.

### 4.2 Size classes: 1-tile shop → wide landmark, inside one tile

No grid change. `ArchetypeSpec` gains one optional field:

```ts
/** A wide, low landmark: broader footprint + an oversized roof ornament. */
landmark?: true;
```

Set on exactly four archetypes (the ones the reference calls out): `culture` (cinema), `social`
(hall), `transport` (bus terminal), `salary` (office block). A landmark renders with
`hw = spec.hw * 1.3` and `hBase = spec.hBase * 0.82` — visibly wider and squatter than its neighbours
inside the same 52×72 tile, because `preserveAspectRatio`'s default `meet` fits the whole viewBox
regardless (already verified for 52/56/64/72px, ADDENDUM-05 §4).

**Any building at `level >= 4` is promoted to landmark rendering.** That is the second half of the
"placement + growth reads on screen" payoff, and it costs one `||`.

### 4.3 Oversized roof ornament

Today every building carries a bare emoji at `signAnchor` (`<text fontSize={16}>`). Landmarks get a
**mounted signboard** instead — one function, applied uniformly:

```ts
/** Two posts + a rounded plate + the archetype's glyph at 22px. The "big roof decoration" look. */
function roofSignboard(spec: ArchetypeSpec, geo: Geo): ReactNode[]
```

- Plate: `<rect rx={3}>` in `palette.roofLite`, stroked `palette.roofDark`, ~44×18 centred on
  `signAnchor`, lifted 14px above the roof.
- Two 2px posts from the plate down to the roof plane.
- The existing `spec.sign` glyph rendered at `fontSize={22}` on the plate.
- Three bulb `<circle r={1.2} fill={colors.white}>` along the plate's bottom edge — the same trick
  `d.marquee` already uses, reused rather than reinvented.

Non-landmark buildings keep today's bare 16px glyph. **Nothing else in `decorParts` changes.**

### 4.4 Kill the category swatch (the "grid of coloured squares" cause)

`.building-tile`'s full-bleed `backgroundColor` is the strongest flat-grid signal in the evidence.
It **cannot simply be removed**: `TownGrid.test.tsx` asserts "a real building's tile gets a non-empty
inline background colour", and that assertion is load-bearing (it is the only test proving
`@toss/tds-colors` resolves under Vitest).

Resolution — keep the contract, change the paint:

- `PlaceholderBuilding` keeps `style={{ backgroundColor: … }}`, so the test passes **unmodified**.
- The value becomes a **derived 10%-alpha tint** of the category colour, not the raw token.
- `.building-tile` loses `border-radius: 12px` and `overflow: hidden`, and its
  `box-shadow: inset 0 -2px 0 …` is replaced by a soft elliptical ground shade that reads as the
  building sitting *on* the terrace rather than inside a card.
- `.building-tile--monument`'s plaque ring is unchanged (F16 must look identical).

### 4.5 Deliberately skipped

- **Per-archetype unique silhouettes** (domes, L-shapes, towers). The existing roof/decor vocabulary
  plus §4.1-4.3 already produces enough variety at 52px. Add when the tile is ever larger than 72px.
- **Animated signage / neon.** Motion budget belongs to the NPCs and the rise-in. Add never.

## 5. Props and decoration layer

**There is no props layer.** The laziest thing that works: the terrace slab from §2 is already one
element per block, and it has two free pseudo-elements. Props ride on them.

```
.town-terrace::before  → left-edge prop   (tree cluster | bench+lamp)
.town-terrace::after   → the earth cross-section band (§2.3 T-R5)
.town-terrace--prop-r::before → right-edge prop, when decorVariant says so
```

Selected by `decorVariant(blockIndex, side, 2)` — the same R-2 function the rest of the town's
decoration already uses. Content is a **self-authored inline SVG `data:` URI** in `App.css`
(`background-image: url("data:image/svg+xml,…")`), not an emoji and not a file: two shapes total, a
three-tree cluster and a lamp-with-bench, both flat two-tone in the §6 palette.

**Performance rules — stated because they were violated before (C-10):**

| # | Rule |
|---|---|
| P-1 | Props and terrain are **static render**. No timer, no `setState`, no animation. |
| P-2 | The terrace list is `useMemo(…, [tileCount])`. It does **not** depend on `buildings`, `movingId`, `cursorIndex`, `npcCount`, `justBuiltId` or `growCandidateIds` — an NPC tick, a keyboard cursor move, or an EXP grow must not rebuild one terrace node. |
| P-3 | Node cost is **O(blocks), not O(tiles)**. The dense fixture (5,400 plots) adds 450 nodes, against 5,400 tiles that already exist — under 8% more DOM, with zero per-tile work. |
| P-4 | No new component, no new memo boundary, no new stylesheet import. Terrain paint lives in `App.css`'s existing grid section (owned by one worker, ADDENDUM-05 §10). |

**Rejected: a dedicated `<TownProps>` overlay layer.** It would need its own memo boundary, its own
absolute positioning against measured grid tracks (the exact machinery that made `NpcLayer` expensive),
and its own direct-children exemption. Pseudo-elements on nodes we are already adding cost nothing.
**Add one when a prop must become interactive or animated** — e.g. a tappable 분수 — and not before.

## 6. Seasonal theming — **deferred**

Not built. The shop already sells three town-wide ground skins (`deco.town.cherryBlossom.v1` /
`snowyVillage.v1` / `nightMarket.v1`, `economy/skus.ts`) that are **purchasable today and have no
renderer**. Seasonal theming is the same hook: one class on `.town-grid` swapping the §7 terrain
tokens. **Trigger to build: when the town-skin renderer for those three already-sold SKUs lands.**
Building a second, parallel seasonal system before that one exists would guarantee two of them.

## 7. Palette and visual tone

**Direction:** *sunlit clay terraces*, not the reference's night market. Pastel cream/pink ground with
warm clay earth and exactly one saturated accent (the 명당 marker). Taken from `ui-ux-pro-max`'s
`--domain color` "Casual Puzzle Game" row (`#FDF2F8` pink-cream background, `#EC4899` primary,
`#F59E0B` reward gold) and warmed toward clay so the earth cross-section reads as ground rather than
as UI chrome; `--domain style` "Pixel Art" contributed the discipline of a **limited palette and flat
fills with no gradients**, which is also what keeps the terrain cheap to paint. The `frontend-design`
skill's "spend your boldness in one place" is why there is exactly one saturated hue in the whole
terrain set: the 명당 ring. Everything else is a two-step tint of the same clay.

```css
/* App.css — pure paint, no coordinate, sits beside the existing --town-asphalt. */
.town-grid {
  --terrace-a:        #FBF3E7;              /* plateau, tint 0 — highest/lightest */
  --terrace-b:        #F6EADD;              /* plateau, tint 1 */
  --terrace-c:        #F1E1D3;              /* plateau, tint 2 — lowest/warmest */
  --terrace-rim:      #E3CDB8;              /* 1px plateau rim highlight */
  --terrace-earth:    #A8785C;              /* earth cross-section, top band */
  --terrace-earth-dk: #7C523C;              /* earth cross-section, shadow band */
  --terrace-shadow:   rgba(124, 82, 60, 0.22); /* the step one terrace casts on the ramp below */
  --plaza-paving:     #FDE7EF;              /* 명당 paving */
  --prime-marker:     #EC6A9C;              /* 명당 ring — the ONLY saturated hue in the terrain set */
  --prop-foliage:     #7FB98A;              /* tree canopy in the prop SVGs */
  --prop-foliage-dk:  #5E9C6C;
}
```

Building-side (TS, `buildingArt.tsx`) — **TDS tokens only**, never these hexes:

| Role | Token |
|---|---|
| Lit window pane | `colors.yellow100` |
| Unlit window pane | `colors.grey200` |
| Signboard plate / stroke | `palette.roofLite` / `palette.roofDark` (already derived) |
| Signboard bulbs | `colors.white` |

### 7.1 How this coexists with `theme.ts` and the existing tokens

There are two colour channels in this codebase and this addendum keeps them apart:

| Channel | Rule | Where |
|---|---|---|
| **TS art colour** | `@toss/tds-colors` tokens only, never a hand-picked hex | `buildingArt.tsx`, `content.placeholder.ts` |
| **CSS pure paint** | A hex literal is allowed *only* when it is paint that no TS arithmetic reads | `App.css` — the precedent is `--town-asphalt: #b9bec6` (`App.css:282`, commented "pure paint — no coordinate, stays here") and the four mood gradients |

**The terrain tokens above are pure paint and go in `App.css`. They are NOT added to `theme.ts`** —
`theme.ts` exists solely to bind CSS custom properties to TDS tokens, and there is no TDS clay ramp to
bind. Adding a hand hex there would break that file's one stated purpose.

**The sky is untouched.** No night background, no dark mode for the town. `.town-screen--mood-*`'s
gradient is F6's budget-pace signal (C-6 / R-12) — taking it for art deletes a shipped feature. The
terrain palette is chosen to sit under the existing `#eaf4ff → white` neutral sky without fighting it:
warm ground against cool sky is what gives the town depth in the first place.

**Contrast.** Terrain is `aria-hidden` decoration, so 4.5:1 does not apply to it — but `--prime-marker`
on `--plaza-paving` is 2.6:1 and therefore **must not be the only signal**: §3.3 pairs it with the lamp
glyph and the `aria-label` change. Building text (the `Lv.N` badge, the monument's `YYYY-MM`) is
unchanged and keeps its existing contrast.

## 8. Compatibility checklist

Highest risk first.

| Area | What could break | The rule that prevents it |
|---|---|---|
| **NPC walkability** ⚠ **highest risk** | `NpcLayer` positions every sprite by measuring resolved `grid-template-columns` / `grid-template-rows` off the live DOM (`NpcLayer.tsx:86-97`). Any terrain change that alters a track's resolved height moves every NPC off the road it stands on. | **T-R2**: a terrace may paint only via negative margins into `.town-grid`'s padding and `position: absolute` pseudo-elements; it declares no height/width/padding. **AC-6** asserts every resolved track size is byte-identical before and after. |
| **NPC walk-path continuity across terraces** | If the earth band painted *over* the cross-street row, the road would read as broken even though `isRoadCell` still returns true — a village whose animals walk through a cliff. | **T-R5**: the band is `top: 100%` inside the slab and the cross street is a later DOM sibling with no z-index (C-8), so the road always paints on top. `isRoadCell` / `stepNpcs` / `movement.ts` are **not opened by any work package**. |
| **F16 monuments** | A monument is a building with `categoryId === null`; §4.4 touches `.building-tile`'s paint. | `MonumentArt` and `.building-tile--monument` are explicitly out of scope for WP-B. **AC-8**: `settlementActions.test.ts` passes with zero diff (the same guard ADDENDUM-05 §9.8 already set). |
| **Building move (drag / tap-to-move)** | Terraces are new grid items; a hit-test that reached one instead of a tile would kill the gesture. `useTileGestures` resolves `event.target.closest("[data-plot-index]")`. | **T-R3** `pointer-events: none` + terraces carry no `data-plot-index`. `moveBuilding`'s V1-V4 are unchanged — a 명당 is not a new destination class, it is an ordinary free lot that pays more. |
| **Shop SKUs** | `deco.town.*` skins are sold and unrendered; a hardcoded terrain palette could make them unimplementable. | Terrain colour is entirely in custom properties on `.town-grid` (§7), so a future skin is one class that redefines them. §6 names this as the seasonal-theming trigger. |
| **Savings block cells** | Terraces span `blockFirstRow(b)` onward; `blockFirstRow(0) = TOWN_HEAD_ROWS + 1 = 3`, strictly below every savings row. | Structural, not checked at runtime — the same `+ TOWN_HEAD_ROWS` term that makes ADDENDUM-01 §2.1's invariant structural. **AC-5** asserts no terrace's `gridRow` start is `<= TOWN_HEAD_ROWS`. |
| **Empty lots** | `EmptyLot`'s three `decorVariant(row, col, 3)` ground variants (🌳/🌱) on top of a painted terrace could read as clutter. | `EmptyLot`'s dashed border and `background: rgba(0,0,0,0.02)` are replaced by a transparent background so the terrace shows through; the variant glyphs stay. `EmptyLotProps` is unchanged (WP-A owns the CSS, not the component). |
| **Onboarding** | Onboarding mounts the town at `plotCount = 0`; `blockCount(0) = 1`, so exactly one terrace renders. | `blockCount` already floors at 1 (`townLayout.ts:210`). **AC-2** covers the empty town. |
| **Existing tests** | `TownGrid.test.tsx` asserts `.town-grid`'s exact direct-children count **twice** (lines 224 and 337). | Both formulas gain `+ blockCount(0)`; the empty-town expectation goes **29 → 30**. Named here so it is a planned edit, not a surprise failure. |
| **Zoom-to-fit** | `scrollWidth`/`scrollHeight` are measured pre-transform; a terrace bleeding past the plot columns could widen `scrollWidth`. | `TERRACE_BLEED_PX (12) <= GRID_PADDING_X_PX (16)`, asserted (**AC-1**) — the bleed lives inside padding the grid already reserves, so `scrollWidth` is unchanged. |
| **`prefers-reduced-motion`** | Terrain adds no motion at all (P-1), so nothing new to gate. | — |
| **Storage / migration** | Nothing new is persisted. No storage key, no schema field, no `LAYOUT_VERSION` bump (§2.4). | **AC-7**: no terrain/prime/prop field appears in any serialized storage key — the same R-2 scan `storage.test.ts` already runs. |

## 9. Implementation split — 1 foundation + 3 parallel packages

Ownership is non-overlapping **after WP-0 lands**. WP-0 is small and goes alone first, the same
"Phase 2 foundation" pattern ADDENDUM-05 §10 used.

### WP-0 — terrain + 명당 pure functions (alone, first, ~40 lines)

| Owns | |
|---|---|
| `src/townLayout.ts` | append-only: the five constants and six functions in §2.2 |
| `src/townLayout.test.ts` | AC-1, AC-4, AC-5 |

Nobody else edits `townLayout.ts`. Ships with tests, blocks the other three.

### WP-A — terrain render + 명당 marker

| Owns | |
|---|---|
| `src/components/TownGrid.tsx` | the terrace items (§2.3), the `--terrace-*` custom properties, `.town-tile--prime`, the `aria-label` change, dropping the every-second-block streetlight filter |
| `src/App.css` | **grid section only** (lines ~255-480): `.town-terrace*`, the §7 palette, the prop `data:` URIs, `.town-tile--prime`, `.empty-lot` background, `.town-tile--streetlight` |
| `src/components/TownGrid.test.tsx` | AC-2, AC-3, AC-6, and the two direct-children formulas |

### WP-B — building art

| Owns | |
|---|---|
| `src/components/buildingArt.tsx` | §4.1 `windowGrid` + palette, §4.2 `landmark`, §4.3 `roofSignboard` |
| `src/components/PlaceholderBuilding.tsx` | §4.4 derived tint only — prop shape unchanged |
| `src/buildings.css` | `.building-tile` paint (§4.4) |
| `src/components/PlaceholderBuilding.test.tsx` | AC-9, AC-10 |

Does not touch `App.css`, `townLayout.ts`, or anything under `economy/`.

### WP-C — 명당 payoff

| Owns | |
|---|---|
| `src/economy/awards.ts` | the `primeLotCount` field + arithmetic (§3.2) |
| `src/balance.approved.ts` | `seedAwards.primeLot` / `primeLotMax` |
| `src/useTownStore.ts` | **exactly one line**, at the existing settlement `awardFor` call (`useTownStore.ts:510`), passing the count. No other line of this file is opened by anyone. |
| `src/economy/awards.test.ts`, `src/settlementActions.test.ts` | AC-11, AC-12 |

Does not touch any component, any CSS, or `townLayout.ts`.

**Merge-conflict surface: zero.** Three files are shared conceptually (`townLayout.ts` by WP-0 only,
`App.css` by WP-A only, `useTownStore.ts` by WP-C only, one line).

## 10. Acceptance criteria

### Mechanical

| # | AC | How |
|---|---|---|
| AC-1 | `TERRACE_BLEED_PX <= GRID_PADDING_X_PX`; `terraceEdgeInsetPx(b, s) ∈ [0, TERRACE_BLEED_PX]` for `b = 0..200`, `s ∈ {0,1}`; `terraceTintOf(b) ∈ [0, TERRACE_TINTS)` | `[unit]` `townLayout.test.ts` |
| AC-2 | `.town-terrace` node count `=== blockCount(openPlotCount(...))` at `plotCount ∈ {0, 12, 13, 100}`; at 0 it is exactly 1. `.town-grid`'s direct-children count matches the updated formula (**30** at `plotCount = 0`, was 29) — both existing assertions, lines 224 and 337 | `[dom]` `TownGrid.test.tsx` |
| AC-3 | Every `.town-terrace` has `pointer-events: none`, `aria-hidden="true"`, no `data-plot-index`, no `z-index`, and is emitted **before** `.town-main-street` in DOM order; `.npc-layer` is still `lastElementChild` | `[dom]` |
| AC-4 | `blockFirstRow(blockIndexOf(r)) <= r` and `isBlockFirstRow(blockFirstRow(b))` for `b = 0..200`; `blockFirstRow(0) === TOWN_HEAD_ROWS + 1` | `[unit]` |
| AC-5 | `isPrimeLot` — **exactly 2** true cells per block for `b = 0..50`; `isPrimeLot(0, ROAD_COLUMN - 1) === false` (**the row-0 signed-modulo trap, §2.2**); `isPrimeLot(row, ROAD_COLUMN) === false` for all rows; `isPrimePlotIndex(i)` agrees with `isPrimeLot(cellFromIndex(i))` for `i = 0..600`; no terrace `gridRow` start is `<= TOWN_HEAD_ROWS` | `[unit]` + `[dom]` |
| AC-6 | **The NPC-safety AC.** Mount the grid at `plotCount = 24` with and without terraces and assert `getComputedStyle(grid).gridTemplateRows` and `.gridTemplateColumns` are **string-identical**; `NpcLayer.test.tsx` passes unmodified | `[dom]` |
| AC-7 | No terrain / 명당 / prop field appears in any storage key's serialized JSON; `LAYOUT_VERSION === 2` (unchanged) and no `relayout` notice fires on a v2 boot — `storage.relayout.test.ts` passes unmodified | `[unit]` |
| AC-8 | **F16 unchanged:** `settlementActions.test.ts`'s placement/idempotency/outcome-bucket cases pass with zero diff to their assertions; `archetypeFor(null, "2026-07") === "monument"` | `[unit]` |
| AC-9 | Every one of the 16 category ids still renders its §ADDENDUM-05-§4 archetype (`PlaceholderBuilding.test.tsx` passes unmodified on that contract); `culture`/`social`/`transport`/`salary` additionally emit a `[data-part="signboard"]` node, and every other category at `level <= 3` does not | `[dom]` |
| AC-10 | A `level = 1` building emits `>= 4` window quads (today: 2) and a `level = 4` building emits strictly more than a `level = 1` one of the same category; the tile's inline `style.backgroundColor` is still a **non-empty** string (the existing `TownGrid.test.tsx` assertion passes unmodified) | `[dom]` |
| AC-11 | `awardFor({kind:"settlement", period:"2026-07", outcomeBucket:1, primeLotCount:0})` returns today's exact amount and today's exact `eventKey`; `primeLotCount: 4` returns `base + 12`; `primeLotCount: 999` returns `base + primeLotMax`; a negative count returns `base` | `[unit]` `awards.test.ts` |
| AC-12 | Settlement remains idempotent with the bonus: calling the award path twice for the same period credits once (`grantedEventKeys` guard, key unchanged) | `[unit]` |
| AC-13 | `npm run lint` clean (no `Math.random` outside `RandomPort`, R-6); the existing R-3 stylesheet text guard passes over the new `.town-terrace*` rules — **no `grid-column` / `grid-row` / `grid-template-*` declaration and no `var(--terrace-*, …)` with a fallback** | `[unit]` |
| AC-14 | Test count does not regress: `npx vitest run --reporter=dot` total `>=` the pre-change total; no test file deleted without a replacement pinning the same behaviour | CI gate |

### Visual — what a screenshot must show to count as "not monotonous"

Re-shot at 390×844, same fixtures as `docs/qa/evidence-addendum05/`. All six must be true in **one**
screenshot of a ~20-building town:

| # | Must be visible |
|---|---|
| V-1 | **Terraces, plural.** At least three plateaus at visibly different ground tints, each with a dark earth cross-section under its lower edge and a shadow falling on the ramp below. Directly comparable to `02-town-six-category-buildings.png`, where the ground is uniform white. |
| V-2 | **An irregular outline.** The left and right edges of the town do not form a single straight vertical line top to bottom — at least two terraces are visibly narrower than their neighbours. |
| V-3 | **The road is continuous.** The main street runs unbroken through every terrace and every earth band; every cross street is unbroken end to end; an NPC is standing on the road, not inside a cliff. |
| V-4 | **명당 are findable in under three seconds** by someone who has not read this document — pink paving + lamp + ring, exactly two per block, at the plaza corners. |
| V-5 | **Buildings have lit windows** and at least two visibly different footprints (a wide landmark next to a 1-tile shop). No building reads as a flat coloured square. |
| V-6 | **Props.** At least two terraces carry an edge prop (trees or lamp+bench) that is clearly not an emoji sitting on top of the ground. |
| V-7 | The sky gradient is **unchanged** from the pre-change screenshot at the same mood tier (R-12 / C-6). |

## 11. What was deliberately skipped, and when to add it

| Skipped | Add when |
|---|---|
| Seasonal theming (§6) | The renderer for the three already-sold `deco.town.*` skins lands — same hook, one class |
| A dedicated props/decoration layer (§5) | A prop needs to be interactive or animated |
| Multi-tile / wide plots (§3.1) | Never in this addendum — it rewrites `placement.ts`'s G1/G2 proof |
| Isometric projection, real Y-elevation, per-row column templates (§2.5) | Never — each one desyncs NPCs, hit-testing, or both |
| Night sky / dark town (§7.1) | Never — the sky is F6's pace signal (R-12) |
| Per-archetype unique silhouettes (§4.5) | The tile is ever larger than 72px |
| A 명당 tutorial / coach mark (§3.3) | Playtest shows players never discover it — and then it is one line in the settlement summary, not a modal |
| A cap on terrace count for the dense fixture | `blockCount` node cost is O(blocks) = 450 on 5,400 plots, under 8% DOM growth (P-3). Add a ceiling only if a profile says so |
