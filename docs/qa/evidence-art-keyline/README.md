# Evidence — building art keyline (colour/stroke) change

Before/after screenshots and live-DOM measurements for a building-art change
that touched colour and stroke only (no geometry). Two dev fixtures, loaded
through `window.__aitLoadFixture`:

- `full-town` — map filled to capacity, every expense category cycled once.
  Source of `01-town-fit`, `02-town-zoomed`, `04-town-categories`, and most of
  `measurements.json`.
- `fusion-ready-lv6` — the only fixture that seeds one category (food) at
  several distinct levels (Lv.4, Lv.5 x2, Lv.6 x2) on purpose. Source of
  `03-levels`.

## Reproduce

```bash
# terminal 1 — from app_in_toss/
npm run dev

# terminal 2 — BEFORE the art change lands (git stash the change first if needed)
PW_PACKAGE=C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs \
  node docs/qa/evidence-art-keyline/capture.mjs --base http://localhost:5173 --tag before

# terminal 2 — AFTER the art change lands
PW_PACKAGE=C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs \
  node docs/qa/evidence-art-keyline/capture.mjs --base http://localhost:5173 --tag after
```

Exits non-zero if any real page console error fires during the run (TDS
`SafeAreaInsets` warning is filtered as environment noise — there is no
native Toss host in a browser run).

## Output

Per tag: `<tag>-01-town-fit.png`, `<tag>-02-town-zoomed.png`,
`<tag>-03-levels.png`, `<tag>-04-town-categories.png`, `<tag>-measurements.json`.

## The level ladder — `capture-ladder.mjs`

`<tag>-05-level-ladder.png` comes from a second, separate script. Clipping a
region of the live map to show several levels at once kept producing a mostly
empty frame with a coach toast across it, because the fixture's Lv.4/5/6
buildings are not neighbours. So `capture-ladder.mjs` does not clip: it CLONES
one tile per distinct level into a clean strip and scales the clones 4x. The
clones are the real rendered SVG — only the arrangement and the zoom are
synthetic, which is the point: at a 40px tile no screenshot can show what a
0.8px stroke did.

```bash
PW_PACKAGE=C:/Users/user/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs \
  node docs/qa/evidence-art-keyline/capture-ladder.mjs --base http://localhost:5173 --tag after
```

It throws if fewer than 3 distinct levels end up in the frame, so a silently
empty ladder cannot ship. This pair is the clearest read of the change:

- **before**: window panes are pale washes that dissolve into the orange wall;
  the roof plane and the wall meet with no edge.
- **after**: framed panes, a defined roof/wall seam, the same silhouette.
- Unchanged in both, as the freeze requires: the base footprint is identical at
  Lv.4/5/6 and only the height grows, the roof still carries the category colour,
  and the signboard is untouched.

## Numbers — run 2026-08-15, 87 buildings measured per tag

The terrain is UNCHANGED by this work; it is measured because it is the other
half of every contrast number below (`afc7cd6`'s map look is frozen).

| CSS custom property | before | after |
|---|---|---|
| `--terrace-a` | `#fdf7ec` | `#fdf7ec` |
| `--terrace-b` | `#f2e2cd` | `#f2e2cd` |
| `--terrace-c` | `#e4cbaf` | `#e4cbaf` |
| `--town-asphalt` | `#b9bec6` | `#b9bec6` |
| `--town-grass` | `#cdeccb` | `#cdeccb` |
| `--town-water` | `#7fb8e0` | `#7fb8e0` |

Read off the live DOM. Identical for all 87 buildings, all 10 archetypes and
all 4 levels present in the fixtures (Lv.1/4/5/6) — the keyline is one neutral
colour for the whole village, not a per-category one:

| part | stroke (before) | stroke-width (before) | stroke (after) | stroke-width (after) |
|---|---|---|---|---|
| wall | `none` | 1px | `rgb(51,61,75)` = `grey800` | 3.52 |
| roof | `none` | 1px | `rgb(51,61,75)` = `grey800` | 3.52 |
| window | `none` | 1px | `rgb(51,61,75)` = `grey800` | 1.76 |

Counted across both files: buildings still missing a keyline after = **0/87**;
buildings that had one before = **0/87**.

Widths are viewBox units. `ART_UNIT` is 4.4 view units per tile px and the
rendered scale is the same for every footprint, so 3.52 is a constant 0.8px on
screen at 100% zoom whether the building is 1x1 or 2x2 — it does not thicken
with the footprint.

## Why (the contrast table)

`node scripts/check-art-contrast.mjs --json docs/qa/evidence-art-keyline/contrast.json`
writes `contrast.json` next to these shots. Summary of that run:

- 8 of 14 category roofs fall below 1.5:1 against a terrain surface they touch —
  worst are cafe `#ffa927` vs `--town-asphalt` at **1.03**, bonus at 1.04,
  sidejob 1.07, social 1.08, living 1.16, food 1.30, etc 1.42, education 1.44.
- The keyline `#333d4b` holds **5.15:1 or better against every terrain colour**
  (worst case `--town-water`), so the silhouette separates whatever is behind it.
- Window panes were the worse half: the lit pane on the clinic's white wall is
  1.14:1 by fill alone. The frame, not the fill, is what makes it read.
- Fusion ladder: 4 of the 10 material steps used to be byte-identical to a roof
  plane some category already paints (bronze === food's whole flat roof), so the
  fusion showed nothing on those categories. Now 0 collisions.

`src/components/buildingArt.contrast.test.tsx` asserts all of the above against
the rendered SVG on every `npm test`.
