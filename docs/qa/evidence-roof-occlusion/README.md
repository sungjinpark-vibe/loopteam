# Roof colour + occlusion — browser evidence (2026-08-13)

Two user instructions, captured in the real app (Playwright, 390x844 @3x, dev server), at the
map's own scale. Reproduce with:

```
PW_PACKAGE=<abs path>/node_modules/playwright/index.mjs \
  node capture.mjs --base http://localhost:5173 --tag before|after
```

Town: the `mixedFootprints` devtools fixture (`src/devtools/fixtures.ts`) loaded through the app's
own `window.__aitLoadFixture`, then a deterministic level overlay (`level = 1 + (i % 10)`) written
onto the fixture's persisted chunk — fixtures carry no `exp`/`fuse`, so every fixture building is
Lv.1 and has no overhang at all. Result: **133 buildings, 119 of them above Lv.1**, map scale
0.419 (a 40px cell renders 16.8px wide at the default fit view).

## 1. The roof carries the category colour

| | |
|---|---|
| `01-roof-colour-100pct-before.png` / `-after.png` | the same 4x3 block at 100% zoom |
| `03-town-overview-fit-scale-before.png` / `-after.png` | the whole town at the default fit scale |

Why the roof and not the signboard: at fit scale the signboard plate measures **9.1 x 3.5 px**
(`findings.json`), which is why the glyph is unreadable there. The roof is the largest
uninterrupted surface on the sprite. The signboard is **kept** — 14 categories share 8 hues, so
six pairs collide (orange food/cafe, blue transport/education, purple shopping/culture, teal
living/other_income, yellow social/bonus, green salary/sidejob) and colour alone can never name a
category. Roof = which family, at a glance; glyph = which member, when zoomed in. Within a
colliding hue the two members take a light (400) and a deep (700) tone.

Two side effects visible in the before/after pair:

* the roof no longer changes with `variantIndex` — one category was rendering in three different
  roof lightnesses, which a colour code cannot afford;
* a fused (Lv.6-10) building keeps its category roof. The fusion "material step" used to repaint
  `top`, i.e. the whole roof plane of every flat-roofed tower — the Lv.9 in `01-*-before.png` has a
  **blue** roof on a yellow building for that reason.

## 2. The occluding overhang fades — option A

| | |
|---|---|
| `02-occlusion-100pct-before.png` / `-after.png` | the worst front-tall/rear-short pair on the map |

`64 of the 133 buildings` overhang an occupied cell in this town and are faded; the rest render
exactly as before. The count is cross-checked: the app's own set (`svg[data-occludes]`) and the
harness's independent DOM sweep both report 64.

Cost: the check is one Map lookup per column a building spans, inside the ground-layer memo that
already exists — it runs when `buildings` changes, never per frame. Max overhang is 45px against a
46px row+gap, so a building can only ever reach the row directly behind it; there is no map sweep.
Grid mount, median of 5 reloads: **154.9 ms before, 153.5 ms after** (samples overlap end to end —
150.2-160.2 vs 151.4-160.1).

## 3. Option C, for comparison only — NOT shipped

`*-optionC-REJECTED-shorter-buildings.png` is the same scene with the height ladder cut
(`GROW_PER_LEVEL_PX` 5 -> 2.8, i.e. max overhang 45px -> 25px) **and the fade rule disabled**, so it
shows what "just make the buildings shorter" looks like on its own. Both constants were reverted
immediately; nothing from this variant is committed. `findings.json`'s `fadedOverhangs` for that tag
counts the attribute, which is still emitted — no fade is painted in those shots.

Compare `02-occlusion-100pct-after.png` (full height + fade) against
`02-occlusion-100pct-optionC-REJECTED-shorter-buildings.png` (short buildings, no fade) and pick.
