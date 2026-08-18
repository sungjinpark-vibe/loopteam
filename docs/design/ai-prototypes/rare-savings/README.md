# Rare savings-building reference art

Reference concepts for the five 저축 (savings) special buildings, replacing the
current flat CSS box + text label with recognisably RARE art (`SavingsRow.tsx`,
`content.placeholder.ts`'s `SAVINGS_STRUCTURE`). These PNGs are **not shipped
assets** — a sibling agent redraws them as SVG using the shared bilinear-quad
isometric-cube system in `src/components/buildingArt.tsx`. This README's
per-building feature list is the actual handoff; the PNGs are supporting
reference only.

## Style target (studied before generating)

`proto-building-shop.png` / `proto-building-cafe.png` (same folder) — flat-shaded
isometric-ish miniature buildings, thick dark-grey keyline outline, flat colour
fills, no gradients, no photo realism, plain background, readable at a small
tile size. `path-b-integration.md` confirms the project's working rule: AI
output is a style/shape reference that gets hand-traced into the app's own
vector primitives, never imported as a raster asset.

## Generation

Tool: `C:\Users\user\tools\flux.py`, batch form, one process for all five
(model warmup is ~9 min/process). Both proto-building PNGs passed as `--ref`
so the style carried over.

```
py C:\Users\user\tools\flux.py --jobs rare-savings-jobs.json ^
  --ref docs\design\ai-prototypes\proto-building-shop.png ^
  --ref docs\design\ai-prototypes\proto-building-cafe.png
```

`rare-savings-jobs.json` (prompt per output path — every prompt explicitly
required "no text, no lettering, no signage words, no numbers", which is the
entire point of this task):

| Output | Prompt |
|---|---|
| `rare-deposit.png` | flat vector game art, isometric three-quarter view, miniature grand bank building, columned portico with round classical columns, triangular gabled roof, gold trim and gold accents on the cornice, marble-white and teal walls, small domed cupola on roof peak, thick dark grey keyline outline around every shape, flat colour fills only, no gradient, no shading blend, no text, no lettering, no signage words, no numbers, plain solid white background, centered single building, small mobile game asset, isolated object, clean silhouette, premium rare building |
| `rare-stock.png` | flat vector game art, isometric three-quarter view, miniature stock exchange tower, tall slender spire on top, round clock face with no numbers on the upper facade, purple and violet walls, gold ring trim around the spire base, glass-look flat panel windows, thick dark grey keyline outline around every shape, flat colour fills only, no gradient, no text, no lettering, no signage words, no numbers, plain solid white background, centered single building, small mobile game asset, isolated object, clean tall silhouette, premium rare building |
| `rare-emergency.png` | flat vector game art, isometric three-quarter view, miniature heavy bank vault building, rounded armoured dome roof, thick riveted steel plating, large round vault door on the front with a big steel wheel handle, blue and steel-grey walls, gold rivets and gold trim accents, thick dark grey keyline outline around every shape, flat colour fills only, no gradient, no text, no lettering, no signage words, no numbers, plain solid white background, centered single building, small mobile game asset, isolated object, sturdy compact silhouette, premium rare building |
| `rare-goal.png` | flat vector game art, isometric three-quarter view, miniature premium cottage house, steep pitched roof, small flag pennant on a pole at the roof peak, orange and gold walls, warm wood trim, tiny round window, thick dark grey keyline outline around every shape, flat colour fills only, no gradient, no text, no lettering, no signage words, no numbers, plain solid white background, centered single building, small mobile game asset, isolated object, cozy charming silhouette, premium rare building |
| `rare-other_saving.png` | flat vector game art, isometric three-quarter view, miniature ornate storage warehouse, sawtooth zigzag roofline, two large arched double doors on the front with silver metal frames, silver-grey and gold walls, decorative cornice trim, thick dark grey keyline outline around every shape, flat colour fills only, no gradient, no text, no lettering, no signage words, no numbers, plain solid white background, centered single building, small mobile game asset, isolated object, wide sturdy silhouette, premium rare building |

Defaults used: 1024x1024, 4 steps, seed 0 (flux.py's distilled-model defaults).

## Accepted / rejected

**All 5 accepted, 0 rejected, 0 retries.** Every image: no baked-in text, flat
keyline-outline style consistent with the two proto references, distinct
silhouette from every other building and from an ordinary town building, and
each stays readable when mentally scaled to ~40-80px.

One note, not a rejection: `rare-goal.png` picked up incidental café furniture
(a little table, umbrella, cup) bled in from the `proto-building-cafe.png`
reference image. That furniture is noise — the feature list below excludes it;
only the cottage + roof + flag is the actual signal to draw.

## Per-building feature list (the real deliverable)

Hex values below are sampled from the app's own live tokens — `theme.ts`
binds `@toss/tds-colors` to the `--town-*` CSS vars this file's `App.css`
already paints the placeholder boxes with (`savings-plot--<kind>` rules), and
`buildingArt.tsx` sources every other archetype's colour the same way (never
a hand-picked hex). Reusing them keeps the five rare buildings in the same
palette family as the rest of the town instead of introducing a sixth ad hoc
colour system.

### 1. deposit — 예적금 은행 (`rare-deposit.png`)
- **Silhouette**: square-based temple/portico, wider than tall, symmetrical.
- **Crown/roof**: shallow triangular pediment (gable) roof with a small domed
  finial at the peak — matches the existing `capShape: "gable"` already wired
  in `content.placeholder.ts`.
- **Palette**: body teal `#30b6b6` (`--town-teal400`, current `bank` fill),
  trim gold (new accent, not yet a token — nearest existing warm is
  `colors.yellow500`/`colors.orange400`), keyline `#191f28` (`--town-grey900`).
- **Rare signal**: round classical columns (2+) flanking the front face, with
  gold capitals — no other archetype in `buildingArt.tsx` has columns.

### 2. stock — 중장기 저축 (`rare-stock.png`)
- **Silhouette**: tall and narrow, the only savings structure taller than it
  is wide — reads as a tower from across the grid.
- **Crown/roof**: sharp slender pyramid spire, gold ring collar where the
  spire meets the tower body — matches existing `capShape: "spire"`.
- **Palette**: body purple `#b44bd7` (`--town-purple400`, current `exchange`
  fill), spire a darker violet shade of the same hue, gold ring trim, keyline
  `#191f28`.
- **Rare signal**: a round clock face (numberless dial) set into the upper
  facade, echoing "market ticker" without literal text.

### 3. emergency — 비상금 금고 (`rare-emergency.png`)
- **Silhouette**: squat and heavy, wider/lower than the others — reads as
  armoured and immovable.
- **Crown/roof**: rounded riveted dome, flatter than a full hemisphere —
  matches existing `capShape: "dome"`.
- **Palette**: body steel-grey `#b0b8c1` (`--town-grey400`, current `vault`
  fill) with blue accent panels `#4593fc` (`--town-blue400`), gold rivets,
  keyline `#191f28`.
- **Rare signal**: a large round vault door with a visible steel wheel handle
  on the front face — the one archetype with a functional "door mechanism"
  instead of a plain doorway.

### 4. goal — 목표 저축 (`rare-goal.png`)
- **Silhouette**: small and simple cottage, most "ordinary-building-shaped"
  of the five — rarity here has to come from roof + flag, not exotic massing.
- **Crown/roof**: steep pitched roof with a small pennant flag on a pole at
  the peak — matches existing `capShape: "pitched"`. Ignore the café
  table/umbrella/cup in the reference PNG — reference-bleed, not the signal.
- **Palette**: body/roof orange-gold `#ffa927` (`--town-orange400`, current
  `house` fill), warm wood-brown trim, keyline `#191f28`.
- **Rare signal**: the pennant flag itself — no other archetype flies a flag;
  it is the single cheapest "this one is special" cue and reads at small
  sizes even when the rest of the silhouette is plain.

### 5. other_saving — 저축 창고 (`rare-other_saving.png`)
- **Silhouette**: wide and squarish, widest footprint of the five — reads as
  bulk storage.
- **Crown/roof**: sawtooth zigzag roofline (3+ triangular teeth) — matches
  existing `capShape: "sawtooth"`.
- **Palette**: body silver-grey `#b0b8c1` (`--town-grey400`, current
  `warehouse` fill) with gold cornice trim, keyline `#191f28`.
- **Rare signal**: a large arched double door (rounded top, split leaves) on
  the front face — every ordinary building in the shop/cafe references uses a
  plain rectangular door or window, so the arch alone reads as upgraded.

## Cross-cutting rule for the SVG pass

Every one of the five gets **one shared "rare" grammar element** on top of its
own signal above: a thin gold trim line somewhere on the roof/cornice. That is
the fastest way for a player to learn "gold trim = special building" as a
category, independent of which of the five it is — the individual signals
(columns / clock / vault wheel / flag / arched door) are what tell the five
apart from *each other*.
