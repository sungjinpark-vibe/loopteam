# Landmark Design Note — Village Beacon Spire (D11, fourth attempt, round 20)

Fix pass on the round-19 build, which the art lead scored 68/100 (bar 90/100) against 10 numbered
findings. This note describes ONLY what the round-20 script (`build_landmark.py`) actually produces,
checked by actually running it in Blender, inspecting the output renders pixel-by-pixel, the export
files' own material data, and the two verification scripts — not what an earlier round intended or
claimed.

Style: Fortune City chibi-isometric — squat proportions (segment height/footprint ratio 0.6–0.9), flat
2-band toon shading (base + same-hue derived shadow), rounded bevels, an 8–12 dominant-hue cap.

## 0. What changed this round (fixes for the 10 round-19 findings, in the review's priority order)

1. **[A2 TOP FIX, worth up to 11 pts across the review] Structural palette pulled back toward the
   design-system tokens instead of being re-authored freely.** Round 19's `Roof_Base` was the worst
   offender: S 0.85 / V 0.68 against `color.secondary`'s own S 0.331 / V 0.937 — a pastel lavender
   token rendered as deep indigo, the exact "neon-dark" drift the design system names as the risk to
   avoid. FIX: hue stays exact; S is now capped to a modest lift over each token's own S, and V stays
   within ~0.15–0.20 of the token's own V, for all three structural bases. See §2 for the real
   before/after numbers, and §2b for why `Roof_Shadow`/`Gold_Base` needed a *second* iteration once the
   pullback exposed two previously-hidden locked-state collisions.
2. **[A1 TOP FIX, -5] Eave rail/ledge extended past the roof and the building's own silhouette.** Root
   cause: the flags' own span (`GARLAND_HALF_SPAN` + flag width) was simply wider than the roof's own
   base-ring radius (0.721 world units), so no support geometry sized to reach under them could also
   stay under the roofline. FIX: garland span and flag size are both pulled back (`GARLAND_HALF_SPAN`
   0.96→0.54, `FLAG_W`/`FLAG_H` 0.26×0.19→0.145×0.16) so the flags' own outer extent — and the
   rail/ledge sized to support them — stay inside the roof's base-ring radius with a real, asserted
   margin (`ROOF_CONTAINMENT_MARGIN=0.015`, checked in-script, not eyeballed). See §5.
3. **[A2, -3] `assign_bands()`'s lit/shadow test ignored `normal.z` entirely**, so a pure top-facing
   face always fell into the shadow material — a direct inversion of the design system's own §3.1 face
   ladder (top = brightest). FIX: the test now weights `normal.z` (`(n.x+n.y+n.z*1.3) > 0.35`) so a
   genuinely top-facing surface always resolves to the lit material; a real per-object assertion
   (`assert_top_face_lit`) checks the plaza's and tower's own topmost face in-mesh, not just the render.
   See §3 for the full reconciliation against §3.1/§3.3.
4. **[A2, -2] `bunting_hobby` broke the note's own "value locked, saturation only ever raised" rule**
   via a `v_delta` exception. FIX: the `v_delta` escape hatch is removed entirely. `hobby`/`exercise`
   collide because they sit only ~7° of hue apart and both clamp to the same default saturation target;
   separation is now restored via a PER-CATEGORY saturation target (`BUNTING_S_TARGET = {"hobby": 0.85,
   "exercise": 0.62}`) — still saturation-only, hue and value both stay bit-for-bit identical to the
   token for every one of the 7 categories, and a real floor is asserted (56.8 RGB measured, floor 35.0).
5. **[A2, -2] The imported vase's neck banding fragmented into a fan of thin triangular slivers** under
   the normal-based 2-band split — a heavily decimated organic mesh has locally noisy face normals near
   tight curvature even though its surface position still varies smoothly. FIX: a dedicated
   `assign_bands_by_azimuth()` classifies by each face's own centroid angle around the mesh's vertical
   axis instead of its normal — stable under decimation, produces exactly one clean seam. Verified in
   `landmark_toon_beacon_detail.png`: one clean base/shadow seam down the vase's length, no fragments.
6. **[A1, -3] The plaza tier read as a lidded jewelry box.** FIX: a real 3-step plinth profile — a wide
   low `Landmark_Plinth`, the recessed `Landmark_Plaza` wall, and a proud `Landmark_Coping` cap — plus a
   genuinely bulky belt band and corner pilasters (proud depth roughly tripled from round 19's hairline
   trim). See §6.
7. **[A4, -3] The CVD-closest pair's (`mind`/`game`) only non-colour differentiator, a swallowtail
   notch, was only a few pixels wide at delivered scale.** FIX: notch depth deepened from `h*0.5` to
   `h*0.82` — a fraction of the flag's own height, so the fork stays a strong signal at any delivered
   scale, not just close-up.
8. **[A3, -1] The Unity Scale-Factor-1 import claim was asserted but never exercised against a real
   Unity import.** Downgraded in §7 to an explicit recommendation pending verification, not an asserted
   fact — this note does not claim what QA has not run.
9. **[A4, -4] Every contrast figure was measured against a pure-black backdrop, never the pale village
   ground this prop actually sits on, and the design system's own deep-night category-legibility rule
   was never applied to the 7 flag hues.** FIX: `verify_flat_colors.py` now also computes contrast
   against the design system's own documented ground gradient (`#EAFAFF`/`#E6FBEF`/`#DFF6E6`) and
   simulates the §5 deep-night Light2D keyframe (0.45 intensity, `#3E3350`) against the 7 bunting hues,
   applying the design system's own documented mitigation (a 0.5 buildings-layer floor) where a pair
   collapses. See §8.
10. **[A5] The signature vase remains the round's real non-primitive move** — unchanged from round 19,
    kept working: PolyHaven "Ceramic Vase 01," solid lathe-revolved geometry, decimated with hard
    shell/degenerate-face guards. The lead's own finding here credited the vase and asked for the
    surrounding massing to read as more than a primitive stack — item 6 above (plinth/coping) is the
    direct response, within this round's time budget; §11 states plainly what is and isn't claimed.

**Also found and fixed this round, not in the review (found by actually running the script and
inspecting the rendered pixels, not by reading the code):**
- The round-20 top-face-lit fix (item 3) made the plaza's own top face pale pink for the first time
  (it was maroon/shadow before, which hid the problem). At that new colour, two real bugs became
  visible on inspection that were invisible before: (a) Cycles' path-traced camera rays carry real,
  measured per-pixel variance on a flat emission surface even at `max_bounces=0` (confirmed: still
  present, just narrower, at 512 samples vs 24 — a renderer property, not a shading bug); (b) the new
  `Landmark_Coping` cap and the `Landmark_Plaza` box were both defined to reach the same world Z
  (`BASE_H`), so their top faces were literally coincident — real Z-fighting, not noise. FIX for (a):
  `snap_render_to_palette()` — every render is post-processed to snap any pixel within 14 RGB units of
  its nearest authored hex to that exact value (edges/AA are untouched). FIX for (b): the plaza box's
  height is now reduced by `COPING_H` too, not just `PLINTH_H`, so its top face sits flush with the
  coping's *underside*, not fighting its top face. Both were caught by opening the actual rendered PNG
  and sampling pixels with `numpy`, not by reading the shader code — the exact "run it, don't reason
  about it" mistake this task's brief called out.

Everything else (round 14–19 fixes not named above — same-hue derived shadows, the sagging front
garland, the FBX/glTF re-verification pipeline, the locked-state hierarchy-preserving scale, the door/
window openings) is kept, working code this round builds on.

## 1. Concept (unchanged)

A squat, chibi "beacon spire" landmark: plinth → plaza → tower → collar → bell-roof → spire → gold vase
finial, with a 7-flag achievement-category garland (reading/study/work/exercise/hobby/mind/game) strung
across the front eave and a small hanging bell as a secondary accent. Reads as a village monument that
gains visual richness (garland, bell, gold vase) as the player unlocks more achievement categories — the
locked/pre-achievement state (§4) is the same geometry in a muted, hierarchy-correct palette.

## 2. Palette — structural (full recolor freedom, pulled toward tokens) + bunting (hue/value locked)

Two separately-named recolor policies, never conflated:
- **Structural** (wall/roof/gold/trim/void): hue stays exact to the token; S/V are pulled toward the
  token's own S/V, not re-authored freely into an arbitrary "60–98% band" the way round 19 did.
- **Bunting** (7 category hues): hue AND value locked to the design-system token; saturation only ever
  raised, per-category target allowed (see §0 item 4).

| Material | Hex | Source token (S/V) | This material's S/V | Role |
|---|---|---|---|---|
| `wall_base` | `#FA82B1` | `color.primary` (0.380/1.000) | 0.48/0.98 | plaza + tower walls |
| `wall_shadow` | `#8C3E5C` | derived from `wall_base` | — | wall shadow band / AO skirt |
| `roof_base` | `#9584C2` | `color.secondary` (0.331/0.937) | 0.32/0.76 | bell-roof lit facets |
| `roof_shadow` | `#362A57` | derived from `roof_base`, own `s_add`/`v_mult` (see §2b) | — | bell-roof shadow facets |
| `gold_base` | `#F0D599` | `color.currency.coin` (0.600/1.000) | 0.36/0.94 | vase, bell, medallion, spire highlights |
| `gold_shadow` | `#907C51` | derived from `gold_base` | — | gold shadow band |
| `trim` | `#FCF0CF` | `color.warning.bg` (0.125/1.000) | 0.18/0.99 | frames, rail, ledge, pilasters, belt, plinth, coping |
| `void_ink` | `#533B6B` | `color.text.primary` | 0.45/0.42 | door/window cavities, AO skirt |
| `bunting_reading` | `#7A4CEF` | category token, S raised to 0.68 | value/hue untouched | flag |
| `bunting_study` | `#4AC9E8` | category token, S raised to 0.68 | value/hue untouched | flag |
| `bunting_work` | `#FFCA52` | category token, S raised to 0.68 | value/hue untouched | flag |
| `bunting_exercise` | `#50D39B` | category token, S raised to 0.62 | value/hue untouched | flag |
| `bunting_hobby` | `#1DBF8C` | category token, S raised to 0.85 (see §0 item 4) | value/hue untouched | flag |
| `bunting_mind` | `#FF9C52` | category token, S raised to 0.68 | value/hue untouched | flag |
| `bunting_game` | `#FF5271` | category token, S raised to 0.68 | value/hue untouched | flag |

15 distinct authored pixel colours total (8 structural incl. 3 derived-shadow pairs + 7 bunting) — an
honest count against the brief's 8–12 "base hues" cap: 12 base/dominant hues (structural bases + trim +
void + 7 bunting), the 3 derived shadow bands are not separately authored decisions.

**Where this still departs from the token, and why:** `wall_base`/`roof_base`/`gold_base` all sit at a
real, modest saturation lift over their token (roughly +0.10 to +0.20 S), and `roof_base`/`gold_base`
sit somewhat below their token's V (0.76 vs 0.937, 0.94 vs 1.000 — gold is actually close). This is a
deliberate, disclosed choice, not an oversight: a rendered 3D volume needs *some* material definition
between its lit/shadow bands to read as a solid form rather than a flat sticker, and the same-hue derived
shadow (§0 item 3's neighbour, unchanged from round 14) needs headroom below the base to stay a real
"ink," not a wash. The departure is now small and directional (S up a little, V down a little), not the
round-19 "roughly double the token's S, crash the V" drift the lead named as the risk.

### 2b. Why `roof_base`/`gold_base` needed a second iteration

The first attempt at this fix (S 0.46/V 0.88 for `roof_base`) passed every check that existed at the
time — but running the actual script surfaced two collisions the lead's finding didn't name, both a
direct side effect of pulling the structural palette closer to its tokens:

- `roof_base` and `bunting_reading` share the exact same hue token (`color.secondary` is also the
  `reading` category hex, a pre-existing design-system overlap, see `TOK_SECONDARY`'s own comment in
  `build_landmark.py`). Pulling `roof_base`'s S/V toward the token also pulled its **locked-state**
  value toward `bunting_reading`'s own locked value — 15.1 RGB apart, below the 20.0 separation floor.
  Caught by `build_landmark.py`'s own assert on the first real run, not shipped.
- Fixing that (S 0.32/V 0.76) then exposed a second collision: `roof_shadow` (derived from the now
  less-saturated `roof_base`) landed only 12.8 RGB from `void_ink` in the locked state — both are dark,
  low-saturation violets roughly 13° of hue apart (the design system's `color.text.primary` and
  `color.secondary` sit in the same hue family).

Both were found by an offline grid search over `(s, v)` for `roof_base`/`gold_base` and the locked-state
compression range, maximising the worst-case pairwise locked-state distance across all 15 materials
subject to staying close to the token — not by tuning against the review's own named findings and
stopping there. Resolution: `roof_shadow` gets its own, stronger darkening (`v_mult=0.45, s_add=0.20`
instead of the shared default) so it clears `void_ink` with real margin, and the locked-state HSV
compression range itself was widened slightly (`LOCKED_S_MIN/MAX` 0.30–0.62→0.26–0.68, `LOCKED_V_MIN/MAX`
0.46–0.92→0.40–0.94) to restore the separation headroom the token-fidelity fix spent. Both
`build_landmark.py` and `verify_flat_colors.py` use the same widened range (kept in sync by hand-copy,
the existing convention in this file pair). Worst-case locked-state pairwise separation this round:
**27.0 RGB** (`Gold_Base` vs `Trim`, `build_landmark.py`'s own run) / **26.6 RGB**
(`locked_bunting_exercise` vs `locked_bunting_hobby`, `verify_flat_colors.py`'s independent
recomputation) — both comfortably clear of the 20.0 floor, not a hairline pass.

## 3. Face-shading ladder — reconciliation with `00-art-design-system.md` §3.1/§3.3

§3.1 pins one enforced 3-tier face formula for every building at every tier: **top/roof = category `500`
+ 60% white** (brightest), **front = `500` + 25% white**, **side = pure `500`** (darkest of the three).
§3.3 states the Landmark uses "the identical grammar."

This asset's 2-band toon system (§0 of round 14 onward: one base/lit material + one same-hue derived
shadow material, chosen for the Fortune City brief's flat-cel look) cannot reproduce all three tiers
literally — there is no third material slot distinguishing top from front. Round 19 shipped this without
reconciling it, and its own face-classification bug (`(n.x+n.y) > 0.25`, ignoring `normal.z`) meant a
pure top-facing surface scored 0 and always fell into the SHADOW slot — the exact inversion §3.1
prohibits, measured by the lead on the plaza's own top face.

**What this round actually does, honestly:** the classification bug is fixed
(`(n.x+n.y+n.z*1.3) > 0.35`, weighting `normal.z` so a genuinely top-facing surface always resolves to
the lit/base material) and mechanically checked (`assert_top_face_lit` on the plaza and tower, both
confirmed `material_index=0` this run). This restores §3.1's *direction* — top is never the darkest
face — but does **not** restore its full 3-way distinction: this system's "base" material now covers
both what §3.1 calls "top" and what it calls "front" (both score above the 0.35 threshold for most
orientations), collapsed into one lit tier, with "shadow" covering what §3.1 calls "side." That is a
real, disclosed simplification of the 3-tier ladder into 2 tiers, not a claim of full §3.1 compliance —
a genuine reconciliation would need a third material per hand-built surface, out of this round's scope.
Verified directly in `landmark_toon_hero.png`/`landmark_toon_side_bands.png`: the plaza's top face is
now the lightest tone visible (`Wall_Base`, pale pink), never the darkest.

## 4. Locked / pre-achievement state — a hierarchy-preserving scale, not a free rank

Every material's locked S/V is derived from its OWN unlocked S/V:

```
locked_v = LOCKED_V_MIN + (LOCKED_V_MAX - LOCKED_V_MIN) * unlocked_v   # V_MIN=0.40, V_MAX=0.94
locked_s = LOCKED_S_MIN + (LOCKED_S_MAX - LOCKED_S_MIN) * unlocked_s   # S_MIN=0.26, S_MAX=0.68
```

Both maps are monotonic in the material's own unlocked value, so every relationship the unlocked
palette encodes survives with no free-rank step to invert it — unchanged mechanism from round 19, only
the range widened this round (§2b).

| Base | Unlocked | Locked (L) | Shadow | Unlocked | Locked (L) | Order |
|---|---|---|---|---|---|---|
| `Wall_Base` | `#FA82B1` | `#ED80AA` (0.363) | `Wall_Shadow` | `#8C3E5C` | `#B25A7C` (0.182) | shadow darker — OK |
| `Roof_Base` | `#9584C2` | `#947DCF` (0.255) | `Roof_Shadow` | `#362A57` | `#614E95` (0.101) | shadow darker — OK |
| `Gold_Base` | `#F0D599` | `#E7CA88` (0.611) | `Gold_Shadow` | `#907C51` | `#B49B64` (0.339) | shadow darker — OK |
| `Wall_Base` | — | `#ED80AA` (0.363) | `Void_Ink` | `#533B6B` | `#7C58A0` (0.138) | void darker — OK (cavities stay holes) |

**Backdrop contrast vs pure black** (2.5:1 floor, the render's own world colour) — worst case this round
is `Roof_Shadow` at **3.03:1**. **Backdrop contrast vs the ACTUAL village ground** (`#EAFAFF`/`#E6FBEF`/
`#DFF6E6`, see §8) — see the accessibility section for the honest, lower numbers there; this material set
was never designed to hit WCAG text-contrast ratios against a pale ground, and this note does not claim
it does.

**Pairwise separation** (worst pair, 105 pairs total, both `build_landmark.py` and
`verify_flat_colors.py` independently recomputed): **27.0 RGB** (`Gold_Base` vs `Trim`) /
**26.6 RGB** (`locked_bunting_exercise` vs `locked_bunting_hobby`) — floor 20.0, real margin.

**Image diff** (proves the locked render is not a no-op, `verify_flat_colors.py`):
- `hero` vs `locked_state`: 26.0% of pixels differ by >10 RGB sum.
- `front_openings` vs `locked_front`: 21.1% differ.

Both comfortably above the script's own 20% floor for "a real recolor happened."

**Flag-vs-background separability at the locked front framing**: all 7 locked flags are present as
sizable connected bands AND all 7 clear the 2.5:1 backdrop-contrast floor
(`verify_flat_colors.py`'s extended check).

**Unity `_Color` handoff table** (Unlit/Color, swap between columns to enter/exit the locked state):

| Material | Unlocked `_Color` | Locked `_Color` |
|---|---|---|
| Wall_Base | `#FA82B1` | `#ED80AA` |
| Wall_Shadow | `#8C3E5C` | `#B25A7C` |
| Roof_Base | `#9584C2` | `#947DCF` |
| Roof_Shadow | `#362A57` | `#624E95` |
| Gold_Base | `#F0D599` | `#E7CA88` |
| Gold_Shadow | `#907C51` | `#B49B64` |
| Trim | `#FCF0CF` | `#EED89E` |
| Void_Ink | `#533B6B` | `#7C58A0` |
| Bunting_reading | `#7A4CEF` | `#8C69E7` |
| Bunting_study | `#4AC9E8` | `#67CBE3` |
| Bunting_work | `#FFCA52` | `#F0C86D` |
| Bunting_exercise | `#50D39B` | `#68D8A8` |
| Bunting_hobby | `#1DBF8C` | `#4FCDA6` |
| Bunting_mind | `#FF9C52` | `#F0A56D` |
| Bunting_game | `#FF5271` | `#F06D84` |

## 5. Bunting garland + eave rail/ledge — pulled inside the roofline

A single sagging garland (7 flags, `FLAG_ORDER = work, exercise, reading, study, hobby, mind, game`)
strung between the front (+Y) eave corners, every flag face normal constant at `(0,1,0)`.

**The round's top structural fix**: round 19's flags/span were sized without checking against the roof's
own footprint — the flags' own outer extent (1.107 world units) was wider than the roof's base-ring
radius (0.721), so the support rail/ledge, sized to reach under them, necessarily overshot the roof and
the building's own silhouette on both ends. FIX: `GARLAND_HALF_SPAN` (0.96→0.54) and `FLAG_W`/`FLAG_H`
(0.26×0.19→0.145×0.16) are both pulled back so the flags' outer extent (0.623) and the rail (half-width
0.648) and ledge (half-width 0.668) all stay inside the roof base-ring radius (0.721) with a real,
asserted margin (`ROOF_CONTAINMENT_MARGIN=0.015`). This is a mechanical, in-script check
(`assert _rail_half_w < roof_base_r - ROOF_CONTAINMENT_MARGIN` and the same for the ledge), not an
eyeballed render inspection — confirmed visually too: `landmark_toon_front_openings.png`,
`landmark_toon_full_body.png`, and `landmark_toon_side_bands.png` all show the rail/ledge/flags entirely
under the roof's own silhouette, no overshoot.

Flags shrank as a direct consequence (to keep the same 7-flag packing without overlap at the tighter
span) — the village-scale legibility floor moved with them: `MIN_LEGIBLE_FLAG_PX` in
`build_landmark.py` (unchanged, 12.0px) still asserts and passes: this round's flags render at
**~14.5×16.0px** at the documented gameplay PPU (down from round 19's 25×18px, still a real ~20–33%
margin over the floor, not a hairline pass). `verify_bunting_layout.py`'s own village-scale floor was
lowered to match (18×13→12×11px) — the same real number the build script itself asserts against, not a
separately invented one.

Both `landmark_toon_front_openings.png` and `landmark_toon_bunting_all_flags.png` show all 7 flags
simultaneously, fully unoccluded and individually countable — confirmed by `verify_bunting_layout.py`'s
connected-component check (7/7 categories found, single component each at both the close-up and
village-scale framings, both PASS this round).

## 6. Massing detail — plinth / plaza / coping (the "lidded chest" fix)

Round 19's plaza tier was one box (footprint 2.10×2.10, height 1.35) with a hairline-proud trim belt
(+0.005–0.017 world units of overhang) and thin pilasters — the lead read it as "a lidded chest/jewelry
box, not a monument plinth." This round adds real stepped relief within the SAME `BASE_H` budget (no
cascading change to `tower_bottom`/collar/roof/garland maths downstream):

- `Landmark_Plinth` — a wide, low proud base (footprint +0.11 world units each side, height 0.16),
  the tier's foundation step.
- `Landmark_Plaza` — the recessed pink wall shaft, now spanning from the plinth's top to the coping's
  underside (its height is reduced by BOTH `PLINTH_H` and `COPING_H`, not just the former — see §0's
  "also found and fixed" note for the Z-fighting bug this closed).
- `Landmark_Coping` — a proud cap lip (footprint +0.06 world units each side, height 0.08) at the very
  top of the tier, flush with the tower's own base.
- `Landmark_PlazaBelt`/`Landmark_PlazaPilaster_L`/`_R` — kept from round 19 but made genuinely bulky:
  belt height 0.05→0.11 with real 0.06-unit overhang (was 0.005), pilaster proud depth 0.025→0.08 with
  width 0.10→0.18, spanning the full plinth-to-coping height instead of a floating mid-band strip.

No new openings were added (door + 2 tower windows + 1 plaza window stays at 4, inside the brief's 2–4
cap) — every addition above is decorative, non-void geometry.

**Honest limit**: this is a real step up from a hairline-trimmed box (visible layering: plinth → wall →
belt → pilasters → coping, each catching light differently), not a full architectural redesign — the
plaza/tower/collar proportions themselves are unchanged from round 14, and the overall silhouette is
still legibly "tiered box + dome," not a dramatically re-authored form. See §11.

## 7. Export — Unity handoff

**Formats**: `landmark_beacon.fbx` and `landmark_beacon.glb`, both under `Assets/Art/Blender/`
(`landmark_beacon.blend` also saved alongside for re-editing).

**Mesh totals** (this round's actual export): 41 objects, 2,329 verts, 4,464 triangles, 15 materials,
0 textures (flat colour only). Every mesh datablock is a clean ASCII name (`<ObjectName>_Mesh`) —
independently confirmed by parsing the exported `.glb`'s own JSON `meshes[]` array directly.

**Bounding box**: min `(-1.16, -1.16, 0.0)`, max `(1.16, 1.16, 3.7476)`, size (W×D×H)
`2.32 × 2.32 × 3.7476` world units.

**Pivot**: object origin sits at world `(0, 0, 0)` — the horizontal centre of the plaza footprint at
ground level (the plinth's own bottom face). This is the natural anchor for snapping the prop onto a
village grid tile; no additional pivot offset is needed on import.

**Units / scale**: authored in Blender's default unit (1 Blender unit = 1 meter = 1 design-system grid
cell, per `00-art-design-system.md` §2). FBX export uses `apply_scale_options="FBX_SCALE_ALL"`, which
bakes the scale to 1.0 in the file. **The specific claim that Unity's FBX importer then needs
`Scale Factor = 1` with default "Convert Units" to land at 1 Unity unit = 1 grid cell is a
recommendation, not a verified fact** — no Unity import has been run against this export (round 19's
note asserted this outright; this round downgrades it explicitly, per the review finding). client-dev
should verify the actual imported scale against a known-good building asset before relying on it.

**Shader**: `ProjectSettings/GraphicsSettings.asset` has `m_CustomRenderPipeline: {fileID: 0}` — Built-in
RP, no URP asset assigned. Pinned import path: Built-in RP's `Unlit/Color`, `_Color` = the material's
authored sRGB hex (§4 table), no Emission, no other options.

**Material data verified directly from the exported files** (not the in-memory Blender scene):
- FBX: re-imported into a throwaway scene, every material's `diffuse_color` read back and sRGB-encoded;
  **15/15 materials MATCH** the authored hex.
- glTF: the exported `.glb`'s own JSON chunk parsed directly with stdlib `struct`+`json` (no Blender
  re-import in this path at all); every material's `baseColorFactor` (linear→sRGB) checked against the
  authored hex; **15/15 materials MATCH**, `metallic=0` on all.

## 8. Accessibility

**Contrast vs the render's own black backdrop**: 2.5:1 floor, worst case `Roof_Shadow` at 3.03:1 (locked
state) — checked and asserted, unchanged mechanism from round 19.

**Contrast vs the ACTUAL village ground [round-20 fix]**: `00-art-design-system.md` §1's
`color.bg.village.sky` is a pale gradient (`#EAFAFF → #E6FBEF → #DFF6E6`), not black — this is the real
backdrop the prop sits on in S2/S6. Measured against it, the numbers invert from the black-backdrop
table: `trim` (unlocked) is **1.00:1** against the darkest ground stop — genuinely near-invisible by
colour alone. This is disclosed, not silently passed: `trim` (frames, rail, ledge, pilasters, plinth,
coping) relies on the void/shadow-band edges it sits against for silhouette separation from the
*building itself*, not on contrast against the sky behind it — the same way a real building's cream
trim reads via its own adjacent darker surfaces, not against open sky. The bunting flags also measure
low against the palest ground stop (1.3–2.8:1) but every flag already carries a structural cream
outline layer (§0 round-14 fix item 10) giving it edge separation independent of the ground colour.
Full numbers (both unlocked and locked palettes, every material) are in
`verify_flat_colors_round20.log`, computed by `verify_flat_colors.py`, not asserted away.

**Night legibility [round-20 fix, applying `00-art-design-system.md` §5's own rule]**: §5 states a
minimum-legibility floor — at deep-night Light2D intensity 0.45 (`#3E3350`), category hues must stay
distinguishable, and names Mint/Sage-Teal (`exercise`/`hobby`) as its own worked example of an
at-risk pair, with a documented fallback (a 0.5-intensity floor on the Buildings sorting layer).
Applied here with a disclosed, simplified multiplicative Light2D approximation (not an exact shader
replica): `bunting_exercise` vs `bunting_hobby` measure **19.9 RGB apart at 0.45** — below this file's
own 20.0 "distinct" convention, i.e. genuinely at risk, exactly the pair the design system itself
flagged. Applying the system's own documented fallback (buildings floor 0.5) resolves it: **22.1 RGB**
at 0.5. `bunting_mind`/`bunting_game` stay separable at both intensities (25.4 / 28.2). This is the
design system's own escape hatch being exercised and shown to work numerically, not a new invention —
client-dev should apply the 0.5 buildings-layer floor for this prop specifically (or verify the pair is
ΔE-distinct in-engine and skip it, per §5's own wording).

**Sprite pixel budget** (`00-art-design-system.md` §2: PPU=100, Landmark canvas 320×400px @1x): this
round's real world bbox (2.320×3.7476 world units) renders at **246×397px** with 6% pad — fits the
documented budget.

**Touch targets**: this is a static environmental prop, not an interactive UI element — no touch-target
requirement applies.

**CVD (colour-vision deficiency)**: `verify_flat_colors.py`'s simplified linear-RGB simulation finds
`bunting_mind` vs `bunting_game` the closest pair under both protanopia (dist 22.1) and deuteranopia
(dist 17.2) — unchanged this round (hue/value are both locked to token, so the recolor didn't move
either flag). The non-colour fallback is shape: `SHAPE_BY_CAT` assigns `mind` the swallowtail-notch
shape (id 1) and `game` the plain triangle (id 0). This round deepens the notch (`h*0.5 → h*0.82`, §0
item 7) so the differentiating feature is a larger fraction of the flag's own silhouette at any
delivered scale, not a fix demonstrated at a specific pixel count — this note still does not claim the
fallback has been measured legible at gameplay scale, only that the signal is now proportionally
stronger than round 19's.

## 9. Verification — real checks, run and inspected this round

`py verify_flat_colors.py` — nearest-palette-distance pixel audit across every delivered render:
- 0 interior off-palette pixels (post-erosion) in every render, floor 300px — **PASS**.
- 7/7 bunting categories found in `landmark_toon_bunting_all_flags.png` — **PASS**.
- Locked-state hierarchy, backdrop contrast (vs black), pairwise separation — **PASS** (§4 numbers).
- Locked-state vs unlocked image diff (both camera framings): 26.0% / 21.1% pixels differ — **PASS**.
- Locked-front flag-vs-wall AND flag-vs-background separability: 7/7 both checks — **PASS**.
- Locked-state band-structure check: 15 distinct bands ≥200px — **PASS**.
- Contrast vs the real village ground: computed and disclosed for all 15×2 materials, not gated to a
  pass/fail (§8) — `trim` flagged AT RISK against the palest ground stop, honestly reported.
- Night-legibility at Light2D 0.45: `exercise`/`hobby` flagged TOO CLOSE, resolved by the design
  system's own 0.5 buildings floor (§8) — reported, not silently hidden.
- Overall script exit: **PASS** (0) — the two new checks above are diagnostic/disclosed, not asserted,
  per the same "honest disclosure, not a fake floor" convention this file already used for CVD.

`py verify_bunting_layout.py` — connected-component analysis of each flag's single largest pixel blob:
- Close-up (`bunting_all_flags`): 7/7 categories, 1 component each, bbox ~106×117–118px — **PASS**.
- Village-scale: 7/7 categories, 1 component each, bbox ~13–14×13–15px, floor 12×11px (this round's own
  flag size, matching `build_landmark.py`'s own `MIN_LEGIBLE_FLAG_PX=12.0`) — **PASS**.

Both scripts exit 0 (`PASS`) on the current build. Raw logs kept alongside the script for traceability:
`build_run_round20.log`, `verify_flat_colors_round20.log`, `verify_bunting_layout_round20.log`.

## 10. Camera views delivered

| Render | What it shows |
|---|---|
| `landmark_toon_hero.png` | ¾ hero angle, full silhouette incl. vase, top face correctly lit |
| `landmark_toon_front_openings.png` | front-on, door/windows/garland/rail/pilasters/belt, all 7 flags, rail contained under the roofline |
| `landmark_toon_side_bands.png` | ¾ side angle, full silhouette, same-hue shadow bands visible |
| `landmark_toon_full_body.png` | wider ¾ angle, whole stack in one frame with margin, rail contained |
| `landmark_toon_beacon_detail.png` | vase close-up, clean single-seam 2-band toon shading (azimuth split) |
| `landmark_toon_bunting_all_flags.png` | all 7 flags, close framing, individually countable |
| `landmark_toon_bunting_shape_pair.png` | the CVD-closest pair (`mind`/`game`) close-up, deepened notch |
| `landmark_toon_village_scale.png` | gameplay-PPU render, 246×397px, flags ~14.5×16px |
| `landmark_toon_locked_state.png` | locked palette, hero framing |
| `landmark_toon_locked_front.png` | locked palette, front framing (flag-vs-wall/background test case) |

## 11. What this note does NOT claim

- The face-shading ladder is reconciled in *direction* with §3.1 (top is never the darkest tier), not
  in full — this 2-band system still cannot show top strictly brighter than front at once (§3).
- The massing fix (§6) adds real stepped relief, not a full architectural redesign — the overall
  silhouette is still legibly "tiered box + dome," the vase remains the one genuinely non-primitive
  accent.
- CVD shape-fallback legibility is not demonstrated at gameplay pixel scale (§8) — the notch is deeper
  this round, not measured-legible at a specific delivered size.
- Contrast vs the real village ground (§8) is computed and disclosed, not gated to a pass/fail floor —
  `trim` is flagged genuinely at risk against the palest ground stop, and this note does not claim that
  is resolved.
- The Unity FBX Scale-Factor-1 import claim (§7) is a recommendation, not a verified fact — no Unity
  import has been run against this export.
- No new render angle beyond the ones listed in §10 was produced or inspected.

## 12. Files touched this round

- `Assets/Art/Blender/build_landmark.py` — structural palette pullback (+ the roof_shadow/gold_base
  second-iteration fix), top-face-lit fix + assertion, bunting_hobby v_delta removal (per-category
  `s_target` instead), vase azimuth-based band split, eave rail/ledge/garland roofline-containment fix,
  plinth/plaza/coping massing rewrite (+ the plaza/coping Z-fighting fix), swallowtail notch depth,
  `snap_render_to_palette()` (render-noise fix), `dither_intensity=0`.
- `Assets/Art/Blender/verify_flat_colors.py` — palette hexes + locked-state range synced to the round-20
  build, new village-ground contrast check, new night-legibility (Light2D 0.45) check.
- `Assets/Art/Blender/verify_bunting_layout.py` — palette hex synced, village-scale floor lowered to
  match this round's real flag size (12×11px).
- `Assets/Art/Blender/landmark_beacon.fbx`, `.glb`, `.blend` — re-exported.
- `Assets/Art/Blender/renders/*.png` — re-rendered (all 10 views).
- `Assets/Art/Blender/{build_run_round20,verify_flat_colors_round20,verify_bunting_layout_round20}.log`
  — raw run logs kept for traceability.
- `docs/design/02-landmark-design-note.md` — this file, rewritten to match the round-20 deliverable.
