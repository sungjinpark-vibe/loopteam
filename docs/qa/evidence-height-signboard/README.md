# Height ladder + roof signboard — browser evidence (2026-08-13)

User instructions being verified:

1. **"레벨이 오를수록 건물이 높아져야 한다"** — buildings must get taller as level rises.
2. **"무슨 건물인지 알 수 있게 지붕에 간판을 달아라"** — a roof signboard so you can tell what the building is.

Governance: these revoke ADDENDUM-11 §4.0's "커지지 않고 고급화" and amend the
`d8ce379` art freeze — by the user himself, recorded in `CLAUDE.md` (commit
`8b296cb`). The horizontal half of `d8ce379` still holds and is verified below:
the base footprint fills its cell and never spills sideways.

Commits: `4f3096b` (height), `66d10e3` + follow-up (signboard).

## How to reproduce

```
npm run dev                       # granite dev; read the URL from the output
PW_PACKAGE=<abs path>/node_modules/playwright/index.mjs \
  node capture.mjs --base http://localhost:5173 --tag after
```

`--tag before` against a checkout of `8b296cb` produces the `-before` half.
All numbers in `measurements.json` are read from the live DOM
(`getBoundingClientRect`), never from the source constants.

## 1. Height — measured, at 100% zoom (tile = 40px)

| | before | after |
|---|---|---|
| Lv.1 art height | 40.0px | **40.0px** (exactly its tile) |
| Lv.5 art height | 40.0px | **60.0px** (+20 above the cell) |
| Lv.10 art height | 40.0px | **85.0px** (+45 above the cell) |
| art **width**, every level | 40.0px | **40.0px** (unchanged — the d8ce379 invariant) |

Before, all ten levels rendered at an identical 40px: there was no height
signal at all. After, every level is 5px taller than the one below it —
strictly monotonic across both halves of the ladder (EXP levels 1-5 and fuse
tiers 6-10, which is the cap the old wall geometry saturated at).

At the default **fit scale (measured 0.419)**: Lv.1 16.8px, Lv.5 25.2px,
Lv.10 35.6px. A Lv.10 building is 2.1x the height of a Lv.1 one and reads as a
tower at a glance — see `05-town-overview-fit-scale-after.png`.

- `01a-ladder-lv1-to-lv9-100pct-after.png` — Lv.1 … Lv.9, one grid row.
- `01b-ladder-lv2-to-lv10-100pct-after.png` — the tall end, same row, same
  baseline. Two shots because `.town-viewport` maxes out near 480px wide and
  the 10-cell ladder spans ~500px.
- `01*-before.png` — the same ten buildings, all the same height.

## 2. Signboard — measured legibility

| | before | after |
|---|---|---|
| Lv.1 building | **no signboard at all** | plate on the roof |
| plate at 100% zoom | 10.0 x 4.1px (landmarks only) | **21.8 x 8.3px** |
| plate at fit scale (0.419) | 4.2 x 1.7px | **9.1 x 3.5px** |

**What is actually legible, measured rather than asserted:**

- **At fit scale the glyph is not readable and cannot be** — a 1x1 cell is
  16.8 screen px, and the plate is 3.5px tall. No font renders at that size.
  What survives is **colour**: the plate is filled with a saturated shade of
  the category's own hue, so at fit scale each roof carries a distinctly
  coloured marker. Korean text was never a candidate here.
- **At 100% zoom the glyph reads clearly** — see
  `02-signboards-100pct-after.png`: 🛍️ shopping, ✚ health, 🏠 living,
  🎀 bonus, 🔧 sidejob, 💼 salary, 🎬 culture, ☕ cafe are each identifiable.
  The white chip under the glyph is what keeps flat-coloured signs like ✚
  legible against the saturated plate.

The old landmark-only plate at 1.7px tall (fit) / 4.1px (100%) was invisible at
both scales, which is why the user could not tell buildings apart.

## 3. The three things the overflow could have broken

**Occlusion** — `03-occlusion-lower-row-in-front-after.png`. Three buildings in
one column; the Lv.10 at the bottom paints OVER the row behind it, the
isometric convention. Ground tiles are emitted row-major, so DOM order (which
is paint order for auto-z-index siblings) already gives this. Pinned by
`TownGrid.test.tsx` → "ground tiles are emitted in row-major order…", which also
scans `App.css` for any `z-index` on `.town-tile` (`--moving` is the one
deliberate exception).

**Tap targets** — the art carries `pointer-events: none`. Without it the part
hanging over the tile above is a live target that bubbles to the LOWER tile, so
a tap meant for the upper tile selects the building in front of it — and the
same for long-press move and the fusion pick. The hit area is still the
`.town-tile` div. Pinned by "the overflowing art never steals a tap…" in
`TownGrid.test.tsx`, and verified with real layout by `tap-target-check.mjs`
(`tap-target-check.out.txt`), which jsdom cannot do:

```
overhangHeightPx        39      a Lv.10 building overhangs 39px into the tile above
lowerArtRisesPx         45
hitOwnerPlot            65      a tap in that overlap resolves to the UPPER tile ✓
lowerCentreOwner        85      the lower tile still owns its own centre ✓
samePointWithoutTheGuard 85     same pixel with pointer-events re-enabled: STOLEN
```

The last line is the counter-check — the guard is load-bearing, not incidental.

**The top row** — `04-top-row-clear-of-header-after.png`. `TOWN_MAP` row 0 holds
ground at cols 7-12, so `.town-grid` reserves `--art-overhang` (45px) as top
padding. Measured with the map scrolled to the top: grid box top **188.5px**,
highest point any art reaches **196.5px** — 8px inside the grid, so nothing
approaches the header. Because the reservation is inside the grid box it scales
with the zoom transform: at fit scale, grid top 188.5 vs highest art 191.9.

## Files

| file | what it shows |
|---|---|
| `01a`/`01b-ladder-*` | Lv.1 → Lv.10 height ladder at 100% zoom |
| `02-signboards-100pct` | roof signs across categories, native scale |
| `03-occlusion-lower-row-in-front` | lower row paints over upper |
| `04-top-row-clear-of-header` | a row-0 Lv.10 building vs the header |
| `05-town-overview-fit-scale` | the whole town at the default view |
| `measurements.json` | every number above, before and after |
| `capture.mjs` | the harness |
