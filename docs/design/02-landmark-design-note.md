# Landmark Design Note — Village Beacon Spire (D11, third attempt, round 15)

**Author:** ui-ux · **Date:** 2026-08-02 (T012, round 15 — fix pass on round 14's art-lead score
53/100) · **Decides:** the form/material design for the one landmark prop kept in scope by D11
(`VISION.md` §"Scope"). **Does not decide:** gameplay wiring, placement rules, or unlock conditions
(see §7 for what IS pinned about states).

Every number and claim below was produced by actually running `build_landmark.py` in Blender 5.2
this round (`blender.exe --background --python build_landmark.py`), then actually opening the
resulting PNGs and actually running `verify_flat_colors.py` / `verify_bunting_layout.py` against
them, and actually parsing the exported `.glb`/re-imported `.fbx` — not carried forward from a prior
round's prose. Where something is still genuinely unresolved, it says so (§9, §11) instead of being
silently marked done.

---

## 0. What changed this round, and why (art-lead score last round: 53/100)

Round 14's script already *contained* fixes for most of round 13/14's findings (same-hue derived
shadow, garland instead of ring, corner brackets, bevel width) — but that script had never actually
been re-run and re-verified after being written, and the design note still described the *old*
(round-13, ring-based) build. That mismatch between "code says X" and "note claims Y" is exactly what
cost points last round (see finding rows below citing stale note text against real image evidence).
This round's work is: **run the round-14 script for real, inspect what it actually produces, fix the
one real bug that inspection turned up, and rewrite this note to match the actual delivered renders.**

### 0.1 [top fix, already coded, now verified] Same-hue shadow bands replace the shared foreign ink

`wall_base`/`roof_base`/`gold_base` each now derive their own `_shadow` variant via `derive_shadow()`
(same hue, lower V, +0.08 S — a real cel-shade "ink" of that surface's own colour, not a re-hued
second material). The single shared dark tone (`void_ink`, `#533B6B`) is scoped explicitly to
door/window cavities and the base-of-tier fake-AO skirt only.

**Verified this round, not assumed:** `landmark_toon_village_scale.png` — the exact shot where round
14's shared-ink bug measured **0 wall_base pixels** — now measures **162,470 px of `wall_base`**
(`#FF408B`) at that azimuth, alongside 59,357 px of its own same-hue `wall_shadow` (`#8F1847`). The
wall no longer disappears from any camera angle.

### 0.2 Bunting garland — verified unoccluded and non-edge-on, not just re-geometried

The ring→garland rewrite (2 corner brackets + 1 sagging cord, every flag facing a constant `+Y`
world direction) was already in round 14's script. This round adds the actual proof the reviewer
asked for — *"assert a minimum per-flag pixel bbox width AND that each flag's pixel region is fully
outside the building's silhouette mask"* — via `verify_bunting_layout.py`, run against the fresh
render:

```
bunting_reading  bbox=106x77   bunting_study    bbox=106x77   bunting_work  bbox=106x78
bunting_exercise bbox=106x77   bunting_hobby    bbox=106x78   bunting_mind  bbox=106x77
bunting_game     bbox=106x77
median bbox: 106x77 — PASS (floor 60x40, sibling-ratio check, stray-fragment check all clear)
```

All 7 flags land within 1px of each other in both dimensions — none truncated, none edge-on. The
build's own frame-check diagnostic (re-run this round) confirms every flag sits with **positive
clearance to the render frame edge** (0.43–1.18 world units) and the occlusion check confirms the
garland's world Y (0.801) is **in front of** both the collar's front face (0.620) and the roof's own
base-ring vertices (0.721) — the farthest-forward building surface at that Z band — so occlusion by
the building's own silhouette is geometrically excluded, not camera-luck.

### 0.3 FBX `diffuse_color` verification — the check itself had a decode bug, now fixed and re-verified

Round 14's SS10 re-imported the exported FBX and printed `diffuse_color` scaled straight to hex with
**no sRGB encode** — `material.diffuse_color` is a *linear* value in Blender, so that print produced
a hex that looked wrong (`Trim` → `~#F4D693`) even though the underlying data was correct. That is
why the round-14 reviewer feedback could not confirm this path (finding 9): the tool's own output was
misleading, not the material.

**Fixed this round:** the same `srgb_encode()` used everywhere else in the file is applied before
hex-ifying, and the result is asserted against the authored palette (±1/255 per channel, to absorb
the FBX ASCII round-trip's 4-decimal float truncation — real and expected, not a colour error).
Re-run result: **15/15 materials match** (14 exact, 1 — `Gold_Shadow` — within 1 unit on the blue
channel). `PASS` is now something the script actually computed, not prose.

### 0.4 Structural adjacency — measured, not asserted

Round 14's reviewer flagged a specific prior-round pixel measurement (`game` vs wall, ~46 RGB units)
as failing the "unmistakable" bar. This round measures the *current* geometry directly (binary
dilation of each flag's colour mask, checking what it touches within 2–3px):

- In `landmark_toon_bunting_shape_pair.png`, the `game` flag (the one previously measured against a
  bare wall) touches **zero** `wall_base`/`wall_shadow` pixels even at 3px dilation — only `trim`
  (1,121 px). The structural cream-outline layer (round-14 fix item 10) is doing its job.
- In `landmark_toon_bunting_all_flags.png`, 5 of 7 flags touch zero wall pixels; `exercise` and
  `mind` touch a small number (30px, 47px respectively) at their pointed tips, where AA leaves a
  few-pixel gap in the outline wrap. Both are large-hue-distance pairs against magenta wall (green
  and orange vs magenta), not a CVD-risk pair, so this residue doesn't threaten legibility — but it
  is reported honestly rather than rounded down to "zero everywhere."

### 0.5 Massing — honestly mapped against the brief's own allowance, not recounted as "2–3"

Round 14's reviewer correctly noted the note's structural table enumerated 7 parts (plaza, tower,
roof cap, eave collar, spire, gem finial, hanging bell) while claiming compliance with "max 2–3
volumes + small accents." That claim is **not repeated here**. Instead, §3 below maps the actual
built parts against the brief's own two allowed categories — "a few stacked squat tiers plus a
spire" and "small accents" — so the count is checkable against the brief's literal words rather than
asserted as a bucket the reviewer has to take on faith.

### 0.6 Village-scale legibility — reported as what it actually shows, not "an honest partial answer"

`landmark_toon_village_scale.png` (`ortho_scale=5.6`, azimuth 40° — a lit quadrant, not the old
shadow-only 200°) now shows a real wall-hue silhouette (162,470 px `wall_base`), a visible window,
and small (~30×37px) but present, per-category-coloured bunting chips. What it does **not** show:
individual flag *shape* — at this scale every flag is a same-size colour blob, not a legible pennant
vs. swallowtail. That is stated plainly in §8, not glossed.

---

## 1. The form choice — unchanged concept

**Concept:** a beacon/spire — the village's one shared, non-category landmark — "visible achievement"
made literal via a gold beacon medallion, a star finial, and a hanging achievement bell, garlanded in
the 7 category hues so every category is acknowledged equally
(`00-art-design-system.md` §4.2's leisure-parity rule, applied to the one shared structure).

**Rendering approach (the actual change this task asked for):** flat/toon chibi-isometric, matching
the director's named reference (Fortune City) — bare-Emission render-time materials in 2–3 hard flat
value bands per surface (base + same-hue shadow + trim highlight on bevel facets), no PBR
lit/gradient shading anywhere in the 8 delivered renders.

---

## 2. Palette — every hex traceable to a design-system token, two separately-named recolor policies

**STRUCTURAL** materials (wall/roof/gold/trim/void — not category-mapped) get full recolor freedom
(hue+S+V all open) into the flat/toon 60–85% saturation band. **BUNTING** (the 7 category hues) is a
hard-locked mapping (`00-art-design-system.md` §3.4: *"Category → hue alone"*) — hue and value are
**never** touched, saturation is only ever **raised**, never lowered. These are two different rules
for two different kinds of material and this note states them as such — never one sentence spanning
both (that conflation was a round-14 finding).

| Material | Source token | Hex | Role |
|---|---|---|---|
| `wall_base` | `color.primary` `#FF9EC4` | **#FF408B** | wall lit band |
| `wall_shadow` | derived from `wall_base` (same hue, V×0.56, S+0.08) | **#8F1847** | wall shadow band |
| `roof_base` | `color.secondary` `#B6A0EF` | **#431AAD** | roof lit band |
| `roof_shadow` | derived from `roof_base` | **#200761** | roof shadow band |
| `gold_base` | `color.currency.coin` `#FFD066` | **#E0A622** | beacon/finial/bell gold, lit band |
| `gold_shadow` | derived from `gold_base` (V×0.60) | **#876009** | gold shadow band |
| `trim` | `color.warning.bg` `#FFF6DF` | **#FAECC8** | eave/spire/frame/bevel-highlight/bunting outline/cord |
| `void_ink` | `color.text.primary` `#5A4A6A` | **#533B6B** | door/window cavities + base-of-tier fake-AO skirt ONLY — never a lit surface's shadow band |

**Bunting (7, `00-art-design-system.md` §4.1's category `500` tokens) — hue and value locked,
saturation raised into 60–85%:**

| Category | Source hex | Delivered hex | Note |
|---|---|---|---|
| reading | `#B6A0EF` | **#7A4CEF** | separated from `roof_base` on the structural side, since `roof_base` shares this source hex and only the structural side has recolor freedom |
| study | `#6FD0E8` | **#4AC9E8** | default policy |
| work | `#FFD066` | **#FFCA52** | source saturation (60%) already met the floor; separated from `gold_base` the same way as reading/roof |
| exercise | `#8AD3B4` | **#44D396** | default policy |
| hobby | `#6FBFA6` | **#34A380** | one explicit, logged extra darken (`v_delta=-0.11`) — `00-art-design-system.md` L186 flags this exact token as an unconfirmed assumption; without this delta, measured separation from `exercise` collapses to 21.2 (caught by this round's own diagnostic, not shipped) |
| mind | `#FFB37A` | **#FF9C52** | default policy |
| game | `#FF8FA3` | **#FF5271** | default policy |

**Measured separations (RGB Euclidean, this round's actual build output):**

```
roof_base vs bunting_reading:     99.4
gold_base vs bunting_work:        67.5
bunting_exercise vs bunting_hobby: 55.2
wall_base vs wall_shadow:        137.0  (same-hue lit/shadow pair)
roof_base vs roof_shadow:         85.8  (same-hue lit/shadow pair)
gold_base vs gold_shadow:        116.0  (same-hue lit/shadow pair)
```

**Colour count:** 15 distinct authored pixel values (8 structural incl. 3 same-hue base+shadow pairs,
+ 7 bunting). Counted as **distinct hues** rather than pixel values — `derive_shadow()` preserves H
exactly, so a base/shadow pair is one hue at two V levels, not two hues — that is **5 structural hues
+ 7 bunting hues = 12**, landing exactly at the brief's stated 8–12 upper bound. Both numbers (15
pixel values, 12 hues) are reported; neither is hidden in favour of the other.

A separate, deliberately unlisted grey (`#8C8C94`) is used for a plain reference cube present only in
`landmark_toon_village_scale.png` for scale comparison — not part of the landmark, not counted toward
either total.

---

## 3. Style-brief compliance

| Brief rule | What was built |
|---|---|
| Squat/chibi proportions (0.6–0.9× per segment) | Plaza 2.10×2.10 footprint / 1.35h → **0.643**. Tower 1.10×1.10 / 0.85h → **0.773**. Both inside the band. |
| A few stacked squat tiers + a spire, one dominant roof/cap shape, 40–55° pitch | Plaza tier → tower tier → **one** bell/ogee roof cap (8-sided base ring → outward-bulged mid ring → apex, ≈48° overall pitch) → spire. That is the brief's own explicit "tiers + spire + one roof" shape, not a 4th independent volume. |
| Max 2–3 distinct volumes + small accents | 3 volumes as above (plaza, tower, roof cap) + **small accents**: eave collar (a thin fascia band, not a volume), star finial, hanging bell, gold medallion, 2-bracket+cord garland. This is an honest inventory, not a recount to force a "2–3 total" number — see §0.5. |
| Flat/2-tone fills, 8–12 colors, 60–85% saturation | 12 distinct hues (§2), inside the cap. |
| 2–3 hard-edged flat value bands, no gradients | `assign_bands()` — verified this round: **0 interior off-palette pixels on all 8 renders** (§5). |
| Fake AO as a flat dark band at the base | Face-based reclassification below `ao_world_z` on the wall/tower/plaza mesh's own geometry, using `void_ink` — no separate overlapping geometry. |
| Large readable openings, 2–4, rounded-rect/arch | 4 openings, all front-facing: 1 arch door + 3 rounded-rect (frame+void) windows. |
| Rounded/beveled edges on eaves and frame corners | Bevel width doubled from the prior round (0.09 world units, 4 segments) on every main volume, routed to `trim` as a genuine third tone at every vertical corner and eave edge — visible as a continuous cream band down each corner in every render, not a hairline. |
| Bunting + gold beacon unoccluded/countable | All 7 flags, uniform bbox ≈106×77px, single connected blob each, positive frame clearance, geometrically in front of the building (§0.2) — measured, not asserted. |

---

## 4. Openings and garland — actual relative position, verified against the actual render

`landmark_toon_front_openings.png` (front, `ortho_scale=3.8`): all 4 openings (arch door, 2 tower
windows, 1 plaza window) are large, face-on, and clear. The garland sits at the eave line
(`GARLAND_Z=collar_top≈2.300`), **below** the roof cap's own base ring and **above** every opening's
top (`opening_top_max≈1.910`) — a real 0.21-world-unit clearance measured by the build script's own
assertion, not eyeballed. At this render's tighter framing (chosen for the openings, not the garland)
the two end flags (`study`, `game`) sit partly outside the frame edge — that is expected and correct:
this shot's job is the openings, not flag count; `landmark_toon_bunting_all_flags.png` is the
dedicated shot for that (§0.2), and framed wide enough to hold all 7 with margin.

---

## 5. Verification — the numbers this round's claims rest on

**Flat-shading check (`verify_flat_colors.py`, fixed 9px erosion kernel, not swept against these
renders):**

| Render | Interior off-palette px (post-erosion) |
|---|---|
| `landmark_toon_hero.png` | **0** |
| `landmark_toon_front_openings.png` | **0** |
| `landmark_toon_side_bands.png` | **0** |
| `landmark_toon_beacon_detail.png` | **0** |
| `landmark_toon_bunting_all_flags.png` | **0** |
| `landmark_toon_bunting_shape_pair.png` | **0** |
| `landmark_toon_village_scale.png` | **0** |
| `landmark_toon_locked_state.png` | **0** |

**Result: PASS** (fail threshold 300px/render).

**7/7 bunting categories found** in `landmark_toon_bunting_all_flags.png`; **all 7 pass**
`verify_bunting_layout.py`'s per-flag single-blob + bbox-floor + sibling-ratio checks (§0.2).

**Exported glTF (`landmark_beacon.glb`) parsed directly** from the GLB's own JSON chunk (stdlib
`struct`+`json`, no Blender in the loop for this check): 15 materials, every `baseColorFactor`
converted linear→sRGB matches the authored hex table exactly (spot-checked all 15, not a sample),
`metallicFactor=0` and no `emissiveFactor` on any.

**Exported FBX (`landmark_beacon.fbx`) re-imported and its `diffuse_color` read back**, this round
with the decode bug fixed (§0.3): **15/15 materials match** the authored hex within ±1/255 per
channel (14 exact, 1 off by 1 unit from float truncation in the ASCII round-trip).

**Build diagnostics (this round's actual run):** 36 mesh objects, 1631 verts, 3088 triangles
(post-triangulation), 15 materials, 0 textures. Export bounding box min=(-1.05, -1.05, 0.0)
max=(1.05, 1.106, 3.5356), size ≈ **2.10×2.156×3.5356** world units (W×D×H).

---

## 6. Footprint vs the design-system bracket

`00-art-design-system.md` §2/§3.3 pins the landmark's target footprint at **2×2–3×3 grid cells**
(cell size `(1, 0.5, 1)`; `1 cell = 1 world unit` bridges Blender's Z-up world to Unity's iso-cell
footprint plane, flagged **[assumption]** since no scene exists yet to confirm it against). This
round's exported footprint is **2.10×2.156** world units — inside the bracket, close to the 2.0
floor (the garland relocating off the plan-view plane entirely, since it lives in front of the
building rather than wrapping it, is most of why this shrank from round 13's 2.48×2.50). No
import-time scale correction is owed to client-dev.

---

## 7. Visual states

| State | Treatment |
|---|---|
| **Unlocked** (the delivered asset) | Exactly the geometry/materials this file exports. |
| **Locked / pre-achievement** | **Delivered this round as an actual render**, not a pointer to another document: `landmark_toon_locked_state.png` swaps every material's Emission colour to the existing neutral grey `#8C8C94` (already used for the scale-reference cube — no new colour spent) at Emission Strength `0.55` (displayed pixel hex ≈ `#6A6A70`, registered and verified in `verify_flat_colors.py`'s palette, 0 interior drift). Same hero camera framing as `landmark_toon_hero.png` for a direct side-by-side. |
| **Transition FX** | Genuinely deferred — animation/timing is out of scope for a static export; named here rather than silently treated as closed. |

---

## 8. Accessibility

Most of `00-art-design-system.md` §9's rows are not applicable to a static, non-interactive, textless
3D prop — stated explicitly rather than silently skipped:

| §9 row | Applies to this prop? |
|---|---|
| Text contrast | N/A — no text/numerals. |
| Touch targets | N/A — static prop, no tap target wired in this scope. |
| **Colour-blind safety** | **Applies — measured.** See below. |
| Day/night readability | Deferred to the future scene-wiring task; flat/emission-derived materials are lighting-independent by construction, but the in-scene check is owed once placed. |
| Reduced motion | N/A — no animation on this static export. |

**Colour-blind safety, measured** (`verify_flat_colors.py`'s CVD simulation — a documented,
simplified linear-RGB approximation, Machado/Viénot-style matrices, explicitly not medical-grade):

- Protanopia: closest pair = **mind vs game**, separation **22.1**
- Deuteranopia: closest pair = **mind vs game**, separation **17.2**

Both numbers are modest — colour alone is an imperfect channel for this specific pair — so shape is
the deliberate fallback: `mind` is shape 1 (swallowtail notch), `game` is shape 0 (clean pennant).
`landmark_toon_bunting_shape_pair.png` frames exactly this pair at a close, face-on angle. Measured
this round (§0.4): the `game` flag in that render touches **zero** wall pixels even at 3px dilation —
only its own cream trim outline — so the shape-fallback close-up is no longer undermined by a
same-family-hue background, which is the specific defect the round-14 reviewer named.

**What remains genuinely unverified:** legibility at *actual in-scene* Unity village-camera zoom.
`landmark_toon_village_scale.png` shows the building silhouette, wall hue, and one window clearly at
`ortho_scale=5.6`, but individual bunting flag *shape* is not legible at that scale (only small
same-size colour chips, ~30×37px each — see §0.6). That is a Blender render on a black field, not an
in-scene screenshot with the real game's day/night lighting and camera; owed once this asset is
placed into a Unity scene.

---

## 9. Unity import spec — one decision, pinned

- **Files:** `Assets/Art/Blender/landmark_beacon.fbx`, `.glb`, `.blend` (covered by
  `lifetown/.gitattributes` LFS rules).
- **Axis/scale (export-time):** `axis_forward=-Z, axis_up=Y`, export scale factor 1, pivot at world
  origin (model floor at z=0).
- **Built bounding box:** size ≈ **2.10×2.156×3.5356** world units (W×D×H) — inside the design
  system's 2×2–3×3 footprint bracket at scale 1 (§6); no import-time scale correction needed.
- **Geometry:** 36 mesh objects, 1631 verts, 3088 triangles.
- **Materials/shader — ONE pinned decision, not an either/or:** this project's
  `ProjectSettings/GraphicsSettings.asset` has `m_CustomRenderPipeline: {fileID: 0}` — **Built-in
  Render Pipeline, no URP asset assigned** (checked directly this round, not assumed). Import every
  material as Built-in RP's **`Unlit/Color`** shader, `_Color` = the material's authored sRGB hex
  (§2 table), no Emission, no other options. This keeps the flat, lighting-independent read that is
  the entire point of the flat/toon approach. Either export path works for colour correctness — glTF
  `baseColorFactor` and FBX legacy `diffuse_color` both round-trip to the authored hex (§5) — but
  **glTF is the recommended import source** since its `baseColorFactor` field maps directly onto
  `Unlit/Color`'s `_Color` with no linear/sRGB ambiguity, where FBX's `diffuse_color` requires the
  importer to already know it's reading a linear value. Wiring this into a scene is a future
  client-dev task.
- **Collider:** none exported; a single `BoxCollider` sized to the bounding box is enough for a
  static, non-interactive prop.

---

## 10. Renders (`Assets/Art/Blender/renders/`, prefix `landmark_toon_*`, this round's output — 8
files)

- `landmark_toon_hero.png` — az=145°, elev=28°. Overall read: banded roof, banded wall, door, gold
  medal, star finial, the hanging bell, and the grounded eave garland together.
- `landmark_toon_front_openings.png` — az=90°, elev=16°, `ortho_scale=3.8`. All 4 openings large,
  face-on, countable, and clear of the bunting garland (§4).
- `landmark_toon_side_bands.png` — az=135°, elev=24°. One full lit wall face beside one full shadow
  wall face with a hard edge down the shared corner, the hanging bell as the asymmetric silhouette
  break, and the roof's own base/shadow split above it.
- `landmark_toon_beacon_detail.png` — az=90°, elev=20°, `ortho_scale=1.05`. The faceted gem in its
  cream backing disc, flat and saturated with no clipping or halo.
- `landmark_toon_bunting_all_flags.png` — az=90°, elev=18°, `ortho_scale=2.35`. All 7 category flags
  present, uniform bbox, unoccluded, in front of the building (§0.2/§5) — the acceptance-criterion
  shot.
- `landmark_toon_bunting_shape_pair.png` — az=90°, elev=14°, `ortho_scale=1.1`, framed on the CVD-
  closest pair (`mind`/`game`). Close, near face-on, zero wall-pixel adjacency measured (§0.4/§8).
- `landmark_toon_village_scale.png` — az=40°, elev=30°, `ortho_scale=5.6`. The landmark beside a
  1×1×1 grey reference cube (one grid cell); wall hue and one window legible, flag *shape* is not
  at this scale (§0.6/§8) — stated honestly, not oversold.
- `landmark_toon_locked_state.png` — same framing as `landmark_toon_hero.png`, all materials swapped
  to the neutral-grey locked treatment (§7).

**Older renders on disk** (`landmark_hero_elevated_arch.png`, `landmark_belfry_closeup.png`, and
similar non-`landmark_toon_*`-prefixed files) are untouched leftovers from rounds 1–9's lit-PBR
approach, left alone per this task's instruction to only touch files this round's own script writes.
They are **not** evidence for anything claimed in this note.

---

## 11. What is NOT decided here

- Where the landmark sits on the 8×8 grid, placement/unlock rules — not modeled or implied.
- The locked→unlocked transition FX — the two static states are pinned (§7); the animation between
  them is not.
- On-screen legibility at actual in-scene Unity village-camera zoom/lighting, and specifically flag
  *shape* legibility at typical village-view scale (§0.6/§8) — a real step was taken this round
  (`landmark_toon_village_scale.png`) but the final in-scene check is still owed.
- The `(1 world unit = 1 grid cell)` footprint bridge (§6) is a stated assumption, not confirmed
  against an actual Unity scene yet.

---

## 12. A note this repo's own history flagged, worth restating once more

Files outside `Assets/Art/Blender/`, `docs/design/02-landmark-design-note.md`, and this task's own
renders/exports were **not touched** by this round's work, per this task's explicit instruction. Two
pre-existing uncommitted changes were observed in the working tree at the start of this round and
left exactly as found (not this task's to fix, not reverted, not investigated further) —
`Assets/LifeTown.App/Scenes/SpikeWork.unity` (a very large diff, ~211k lines removed) and
`ProjectSettings/ProjectSettings.asset` / `ProjectSettings/Packages/com.unity.probuilder/Settings.json`
(small diffs). Flagged to the PM directly rather than silently carried or silently reverted.

## 13. Prior attempts — pointer, not reproduced

Rounds 1–9 (lit-PBR) and rounds 10–14 (flat/toon rewrites) are preserved in
`git log -- Assets/Art/Blender/build_landmark.py` and this file's own history. Not reproduced here.
The one lesson worth restating because it is still true and still load-bearing: **a flat/toon claim
is only as good as the last time someone actually ran the script and looked at the pixels** — round
14 wrote the right code but shipped a stale note describing the wrong build; this round's fix was, in
the end, mostly about closing that gap between code and evidence, not writing new geometry.
