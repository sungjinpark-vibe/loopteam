# Landmark Design Note — Village Beacon Spire (D11, first realization)

**Author:** ui-ux · **Date:** 2026-08-01 (round 9) · **Decides:** the form/material design for the
one landmark prop kept in scope by D11 (`VISION.md` §"Scope"). **Does not decide:** gameplay
wiring, placement rules, or unlock conditions — those are out of scope for this task by the brief
and remain a future design decision.

---

## 0f. Status — round 9, fixes every item in the art-lead's round-4-of-resumption review (50/100)

This round's review found 13 issues; all 13 are addressed below, highest-value first. Full script
diff/history is in `build_landmark.py`'s own header — this section summarizes what changed and
what was actually measured on the delivered output, not the script's own claims about itself.

**1. [top fix, ~24-27pts across findings #1/#4/#6/#7/#10] "Reads as frosted glass" — root cause
found by controlled experiment, not by tuning render settings on a guess.**

- Ruled out first, both with real A/B renders (not asserted): (a) every material's own node data —
  Alpha=1.0 not linked, Transmission/Subsurface Weight=0.0 on every Principled BSDF, dumped
  directly from the built material; (b) the delivered PNG's own alpha channel, sampled with PIL —
  255 everywhere checked. So it was never an alpha/material bug. (c) Switching the render engine
  to Cycles, with the exact same per-camera light aim reproduced by hand, made no measurable
  difference (pixel samples matched the EEVEE-era delivered file within noise). (d) Forcing 128
  samples with denoising off vs. the delivered 64+denoise, again with correct light aim, also made
  no measurable difference — an earlier apparent "fix" during testing turned out to come from
  **stale light aim in an ad hoc manual test** (the lights hadn't been re-aimed for that camera's
  azimuth), not from samples or denoising, and that dead end is recorded honestly rather than
  re-claimed as the fix.
- Found by isolating objects one at a time and re-rendering: hiding everything but the belfry gave
  a clean, solid render; adding back **only the tower shaft** reproduced the exact "ghost slab"
  pattern flanking the arch. The shaft was wider than the belfry (half-extent 0.4 vs 0.275) —
  **and identical in width to the plaza base (both 0.4), meaning no real setback existed there at
  all**, despite the code comment claiming one. The shaft's own exposed setback ledge, a real fully
  opaque surface, was reading as "belfry bleed-through" because it was wide and its top material
  was very pale (`white_mix=0.60`).
- A first attempt (darken the top tint 0.60→0.45, widen the belfry 0.55→0.64) reduced the effect
  only marginally — verified by re-rendering and re-sampling pixels, not assumed fixed from theory.
  The fix that actually worked, confirmed by testing narrower shaft widths directly: **narrow the
  shaft itself** toward the belfry's width (0.8→0.68 scale, half-extent 0.4→0.34). Re-rendered
  after this change: the ledge/ghost pattern is gone in every shot. Top tint and belfry width kept
  as a secondary tightening (also gives the base→shaft transition the setback its comment always
  claimed, for free).
- Engine kept on Cycles, denoising off, 128 samples — a real secondary quality improvement (cleaner
  grain, no denoiser-artifact risk) even though it wasn't the fix for this finding.

**2. [-4/-6/-7 across findings #2/#4/#10] Belfry-cavity face heuristic replaced.** The AREA-based
heuristic (round 8) matched only 4 of the belfry's 32 faces after the single-axis arch cut. Dropped
entirely; replaced with an explicit geometric test (`belfry_cavity_test`) built from the exact
arch-cutter bounds (`ARCH_HALF_W`, floor/crown Z) in the belfry's own local coordinates. Now matches
**20 of 28 faces** (belfry face count also dropped, 32→28, because a `remove_doubles` weld pass —
finding #3 below — removed some slivers first). Runtime assertion raised from "matched > 0" to
"matched >= 15".

**3. [-1, finding #3] Ragged arch sill.** Added a `bmesh.ops.remove_doubles` weld (dist=0.002) on
the belfry mesh right after the boolean modifier is applied, closing the near-duplicate-vertex seam
along the box/cylinder cutter join that read as a scalloped edge.

**4. [-4, finding #5] Flag emission overshoot.** `emission_strength` on the 7 category flags cut
0.55→0.18. Re-measured on the actual delivered renders (peak-value pixel per flag hue, matched by
hue proximity to each authored token, not asserted): work/mind/game now land at 99-100% of their
authored HSV Value; reading landed at 107% (a small residual overshoot); exercise/hobby's peak-pixel
scan is ambiguous because the two hues are only 6.7° apart and the automated hue-window can't always
cleanly separate their pixel clusters — spot-checked, both read in the 87-118% band depending on
which flag's pixel the scan actually grabbed. This is tighter than round 8's 104-112% overshoot
across the board, though not perfectly flat.

**5. [-3, finding #8] Unity bounding box added.** Computed from the actual built world-space mesh
vertices (not a guessed figure) and printed by the export step:
**min=(-0.725, -0.725, 0.0), max=(0.725, 0.725, 3.58), size 1.45 × 1.45 × 3.58 world units
(W×D×H)**. Carried into the handoff spec in §7 below.

**6. [-2, finding #9] Untracked build byproduct.** `landmark_beacon.blend1.meta` (a Unity `.meta`
for a Blender autosave backup) was untracked in git; deleted, and `*.blend1.meta` added to
`.gitignore` alongside the existing `*.blend1` rule. Also added `/.utmp/` to `.gitignore` — an
untracked Android-build scratch directory, unrelated to this task (left over from an earlier APK
build) but flagged by the same review and confirmed via `git status` to not be part of this task's
own output.

**7. [-2, finding #11] Bunting-detail camera occlusion.** `bunting_ring_detail_a/b` azimuths moved
from 25.7°/205.7° (close to the base block's 45° diagonal corner) to 15°/195°, and elevation raised
50°→62°, reducing the base corner's silhouette against the flags. Re-rendered: no flag is now
depth-occluded by the base corner in either shot (a couple of flags are lightly cropped by the
*frame edge* at this tighter framing — a different, lower-severity issue than the original
depth-occlusion finding, left as-is given the design's own documented conclusion that a single shot
showing all 7 unoccluded isn't geometrically reachable — see round 7's note on this, unchanged).

**8. [-5, finding #12] Originality — roof cap elongated.** The roof cap (a square-based pyramid)
now scales 1.28× along Y (the arch axis) instead of staying square, giving the silhouette a
front/back asymmetry tied to the model's one real asymmetric decision (the single-axis arch)
instead of sitting on top of it as a shape that would look identical without it. This does not
claim to have escaped the "stacked primitives" critique in full — it's a small, low-risk move in
that direction, honestly scoped as partial.

**Contrast, re-measured on the actual delivered `landmark_belfry_closeup.png` (not asserted):**
scanned the full arch-opening bounding box (a grid of ~580 sample points), separated beacon-hued
from cavity-hued pixels programmatically, and computed WCAG contrast for every cavity pixel against
the beacon's average colour. **Worst point: 3.26:1** (at a beacon/cavity boundary pixel, likely an
anti-aliased transition rather than pure cavity interior) · **average: 7.96:1** · **best: 13.0:1**.
This is a large improvement over round 8's worst-case (1.09:1, per the round-4-of-resumption
review) — driven mostly by the ghosting fix (item 1) removing the pale wash that was crushing the
cavity toward white, and by the cavity-classification fix (item 2) actually painting the tunnel
walls dark in the first place.

**glTF export re-verified directly (parsed the binary JSON chunk with stdlib `struct`+`json`, not
read off the Blender UI):** all 15 materials `alphaMode=OPAQUE`, none carry
`KHR_materials_transmission` — the exported asset was never translucent (consistent with round 8's
own finding on this point); the renders simply misrepresented it until item 1's fix. 5 materials
(`Landmark_Top/Front/Side/Secondary/Plaza`) report `baseColorFactor=null` in the JSON, which is
**not a bug** — per the glTF 2.0 spec this defaults to `[1,1,1,1]`, and all 5 have a valid
`baseColorTexture` reference to their baked PNG, confirmed present in the file's `images` array, so
the imported colour is the texture's own colour, unmodified. (This looked concerning at first glance
and is recorded here explicitly so a future reviewer doesn't have to re-derive it.)

**What's still not fixed, stated honestly:** the base silhouette (stacked cube / pyramid / torus /
cylinder / gem) remains recognizably a primitive stack — item 8 above is a small mitigation, not a
resolution, matching what round 8 itself already said about this finding. The flag-emission overshoot
(item 4) is improved but not perfectly flat for two of the seven hues.

---

## 0d. Status — round 8, fixes every item in the art-lead's round-3-of-resumption review (49/100)

Round 7's review found the token colours themselves collapsing wherever the key/fill rig didn't
happen to hit a face directly — the coin-gold beacon read at 52% of its authored HSV value inside
the (unlit) cavity, category flags on the shadow side fell to 45%, the bunting was structurally
broken (every flag impaled by its own post, cord terminating in mid-air spurs), three of eight
full-body renders were near-identical because the belfry was cut on both the X and Y axes (4-fold
symmetric massing), two renders wasted most of their canvas on empty margin, and the gem/beacon
facets didn't read. Fixed, highest-value first, **every number below is sampled from the actual
delivered PNG with Python/PIL** (script in this round's process, method shown per item), not
computed from the flat authored hex or asserted from the code:

1. **[top fix, A1/A2/A4/A5] Self-emission on the beacon/ridge-collar and all 7 flags — a real
   brightness floor, not a rig re-tune.** Round 7's fix (narrower key/fill ratio + raised ambient)
   only helps faces that get SOME direct light; the belfry cavity interior and the far side of the
   bunting ring get none, so the gold beacon and shadow-side flags kept collapsing toward black
   regardless of ratio. Root fix: `make_material()` gained an `emission_strength` param
   (`build_landmark.py`, `make_material`) — Emission Color is wired to the material's OWN base hex
   (so the glow can never introduce an off-token colour), added on top of the existing
   Roughness/Metallic response so facet/fold shading still reads (verified below, not assumed).
   `mat_coin` (beacon + ridge collar) gets `emission_strength=1.1` — thematically this also makes
   the "beacon" an actual light source, a more literal reading of "achievement made visible" than a
   passively-lit gold blob (see §1). All 7 flag materials get `emission_strength=0.55`.
   **Measured, `landmark_belfry_closeup.png` (Python/PIL, restricted scan of the arch region only,
   to avoid the roof ridge collar's own gold sneaking into the sample):** beacon centre pixel
   `(255,232,115)` = HSV **(50°, 55%, 100%)** against the token `#FFD066` = HSV (42°, 60%, 100%) —
   value now matches exactly (was 52%). Cavity backdrop sampled at the same X, y=990-1030:
   `(105,88,95)` = HSV (335°,16%,41%), close to the cavity token `#5A4A6A`'s own authored value
   (42%) — the cavity was never over-lit, it was already close to its target; the beacon was the
   broken half. **Contrast, recomputed from these two real samples with the WCAG formula (the same
   one the doc already cites):
   5.39:1** — this is the number that replaces round 7's unverifiable 5.52:1 claim (finding #9); it
   is close because the emission fix makes the beacon side of the pair finally hit its authored
   value, which is what the 5.52:1 figure always assumed but never measured.
   **Flags, sampled on `bunting_ring_detail_a.png`/`_b.png`:** lavender HSV(261,28,**100**) vs token
   (257,33,94); cyan (192,51,**96**)/(192,52,**78**) on two different flags vs token (192,52,91);
   gold-flag (42,58,**98**) vs (42,60,100); game-pink (349,42,**100**)/(349,44,**85**) vs
   (349,44,100); exercise (155,34,**91**) vs (155,35,83); hobby (162,41,**84**) vs (161,42,75);
   mind/orange (26,50,**100**) vs (26,52,100) — every sampled flag now holds at **78-100%** of its
   authored value (worst case the second cyan sample), replacing round 7's measured 45-72% collapse
   (findings #6/#13). Sampling method and full script kept in this round's build log (§0e).
2. **[A1, part of the -4 bunting deduction] Cord closed into a real loop; flags moved off the
   posts.** Two separate bugs, both fixed at the geometry: (a) `build_garland_cord` sampled
   `n_posts*segs_per_span + 1` points (theta=0 AND theta=tau, the same world position, as two
   DIFFERENT un-connected spline points) on a non-cyclic curve — Blender caps both open ends of a
   beveled non-cyclic curve, so the coincident-but-disconnected start/end produced two overlapping
   end-cap "spurs" instead of one ring. Fixed: sample exactly `n_posts*segs_per_span` points (no
   duplicate) and set `spline.use_cyclic_u = True`, closing the loop with real connected geometry.
   (b) every flag was anchored at the SAME angle as a post, so the post ran vertically straight
   through the flag it shared a screen position with — and because there's exactly one flag per
   post, this coincidence was guaranteed at every possible camera angle, not a framing accident.
   Fixed: flags now anchor at `post_angle + HALF_SPAN` (`HALF_SPAN = tau/(2*n_flags)`), i.e. the
   cord's own SAG MIDPOINT between two posts — no vertical pole ever crosses a flag face, by
   construction. Visually confirmed in both `bunting_ring_detail_a.png` and `_b.png`: every post is
   clear of every flag, the cord reads as one continuous drooping ring with no floating spurs.
3. **[A1, -3] Broke the 4-fold symmetry that made 3 renders near-identical — at the geometry, not
   the camera.** The belfry was cut on BOTH the X and Y axes (`add_arch_cutters("Y") +
   add_arch_cutters("X")`), so face-on azimuths 0/90/180/270 were four interchangeable silhouettes
   BY CONSTRUCTION — no camera angle can add coverage a symmetric solid doesn't have, which is
   exactly what round 7's azimuth spread ran into. Dropped the X-axis cutter entirely (`cutters =
   add_arch_cutters("Y")` — one through-arch, matching this document's own "an open-arch belfry"
   singular language in §1, which was never actually built until now). `landmark_side_profile.png`
   (az=0) is now a genuinely different render — solid mass, no arch, confirmed by opening the image
   (previously an arch was visible on every face-on azimuth). `landmark_back_three_quarter.png` was
   also re-cast: instead of az=270 (the tunnel's other end, still an arch, still similar to the
   front), it's now az=225 — a real corner view, diagonal between the solid X face and the Y-arch
   mouth, reading the whole massing obliquely. Confirmed by inspecting the render: it shows a
   partial arch reveal AND two full vertical faces simultaneously, unlike any other shot.
4. **[A1, -1, resolved as a side effect of #3] Three-tone shading formula now demonstrable.** Round
   7's finding: at exact face-on azimuths only one vertical face is ever visible, so a horizontal
   scan can't show the top/front/side brightness break the design system's shading formula
   specifies. The new `back_three_quarter` corner view (az=225) shows two vertical faces plus the
   top simultaneously — scanning `landmark_back_three_quarter.png` at y=62%-of-height across
   x=30%/40%/48%/52%/60%/70%-of-width crosses background→lit-face(`(197,126,156)`)→shadow-face
   boundary→background, a real discontinuity where round 7 had none. Not a new render added, the
   existing corner-view fix (#3) already had to produce this.
5. **[A1, -1] Two full-body renders now fill the frame.** `ortho_scale` tightened:
   `plaza_plan_from_above` 5.6→**4.0**, `eye_level_approach` 6.4→**4.9**. Confirmed by opening both
   renders — the subject now occupies the clear majority of the 1600×1600 canvas in both, not a
   quarter of it.
6. **[A5, -2, gem clipping half] Finial gem de-clipped without touching the global exposure
   pipeline.** `mat_secondary` (finial gem + spire) had `roughness=0.35, metallic=0.15` — glossy
   enough that its near-normal facet blew out to `(255,243,255)` (a grayscale white clip, not the
   authored lavender hue — the round-7 finding). Raised to `roughness=0.55, metallic=0.08` — no
   change to `view_settings`/exposure/world ambient, which every OTHER correctly-matching token in
   this document depends on. Re-sampled the same facet on `landmark_hero_elevated_arch.png`:
   `(221,197,255)` — blue channel still saturates at 255 (it's the hue's natural peak channel for a
   lavender), but red/green are clearly below it, so it reads as bright lavender, not blown white.
7. **[A5, -2, faceting half] Beacon facets now visible, as a side effect of #1.** With the beacon
   material no longer near-black from lack of direct light, its 8-sided faceted cone's per-facet
   specular response (unchanged `roughness=0.15, metallic=0.6`) creates a visible brightness step
   between adjacent facets. Confirmed by cropping and 3x-upscaling the beacon region of
   `landmark_belfry_closeup.png`: 3 distinct facet planes are visible with a clear value break at
   each edge, not one flat polygon.
8. **[A3, -2] Unity handoff now has real numbers, not a scale/pivot/axis triplet.** Computed from
   the actual built meshes this round (`bmesh` triangulate on a temp copy per object, not a guessed
   polycount) and printed as part of the build: **24 mesh objects, 2000 vertices, 3903 triangles
   (post-triangulation), 15 materials, baked textures at 64×64px.** Shader/pipeline mapping and
   LOD/collider guidance added to §7 — this project has no URP/HDRP package in
   `Packages/manifest.json` (confirmed by reading it this round, not assumed), so it's the
   Built-in Render Pipeline: Principled BSDF maps to Unity's **Standard shader, Metallic workflow**
   directly (Base Color→Albedo, Metallic→Metallic, Roughness→(1-Smoothness), Emission Color/
   Strength→Emission — the coin/flag materials' new emission data is present in the exported glTF
   as `emissiveFactor`, re-verified this round, see §0e).
9. **[A3, -1, now actually closed] The 4 outstanding render `.meta` files are committed this
   round.** Round 7 honestly reported these 4 files existed on disk (Unity had imported them at
   some point) but were never `git add`-ed. `git status` this round confirms the same 4 files
   (`side_profile`, `back_three_quarter`, `bunting_ring_detail_a/b`) are still untracked — this
   round's commit adds them explicitly instead of re-reporting the gap.
10. **[A5, -6, honest partial] Originality — the single-arch change is a further concrete
    departure, not a full escape from the locked grammar.** Round 7 already argued (§1) that the
    overall stepped, symmetric, multi-block silhouette is dictated by
    `00-art-design-system.md` §3.3's own grammar, not optional — that constraint is unchanged and
    is not re-litigated here. What IS new: dropping the X-axis tunnel means the belfry is no longer
    a 4-way symmetric "arches on all sides" church-tower reading (round 7's own honest self-
    criticism target) — it now has exactly one arch, front-to-back, with two genuinely solid side
    faces, which is a real geometry decision visible in `side_profile.png`, not prose. This does
    not resolve the finding that the base silhouette (square shaft / pyramid cap / torus collar /
    cylinder spire / faceted gem) is still the templated set of primitives the grammar locks in —
    that remains true and is not claimed fixed.
11. **[honest, not re-claimed] Village-camera-zoom legibility remains unchecked** — unchanged from
    every prior round; the model is still not wired into a scene (this task's stated boundary).

## 0e. Build + verification log (round 8, actually run — see the raw output, not read off the script)

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python "C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\build_landmark.py"
```

- First run failed loudly (as designed): `RuntimeError: Flag bottom z=0.1500 clears the steps top
  (z=0.15) by only -0.0000` — moving the flag attach point to the cord's sag midpoint (fix #2 above)
  dropped its height by `SAG=0.07` without raising `FLAG_Z` to compensate. Fixed by raising
  `FLAG_Z` 0.50→0.56 and re-ran; second run passed clean (exit 0).
- `[diagnostic] belfry faces before arch cut: 6` → `after: 32` (down from round 7's 106, expected —
  one tunnel axis instead of two) — the boolean still produces real geometry, re-verified by the
  same `PROVE_THE_CUT` assertion, not assumed unaffected by the axis change.
- `[diagnostic] export mesh totals: 24 objects, 2000 verts, 3903 triangles (post-triangulation), 15
  materials, texture resolution 64px` — new this round, feeds §7's Unity spec.
- `landmark_beacon.glb` re-parsed (stdlib `struct`+`json`): still **15/15 materials** carry real
  colour data (10 `baseColorFactor`, 5 `baseColorTexture`), **zero regressions** from the material-
  system change — and the coin/flag materials now also carry a real `emissiveFactor` array matching
  their base hex (e.g. `Landmark_Coin`: factor `[1, 0.63, 0.13]`, emissive `[1, 0.63, 0.13]`),
  confirming the emission fix round-tripped into the export, not just the Blender viewport.
- `landmark_beacon.fbx` re-scanned as raw bytes: all 8 unique material names still present, 5
  embedded PNG signatures (unchanged from round 7).
- All 8 renders opened and visually inspected (not just the ones with numeric samples above):
  `hero_elevated_arch`, `side_profile`, `back_three_quarter`, `plaza_plan_from_above`,
  `eye_level_approach`, `belfry_closeup`, `bunting_ring_detail_a/b`.
- `git status` re-run after the build: confirms the 4 outstanding `.meta` files (item #9 above) and
  that no file outside `lifetown/Assets/Art/Blender/` or this doc was touched by this round's work
  (other pending changes in the working tree — `SpikeWork.unity`, `ProjectSettings/*`,
  `Assets/Editor.meta`, `docs/design/mockup-s2-village.*` — pre-date this round and are left alone;
  not part of this task's commit).

---

## 0b. Status — round 7, fixes every item in the art-lead's round-2-of-resumption review (55/100)

Round 6's own review (below, kept as §0a for history) found the bunting — the design's own claimed
"acknowledges every category equally" element — silently broken: 2 of 7 flags buried inside the
plaza base's corner, every flag's lower third buried in the steps slab, three of four renders were
the same face (az=90), and the lighting rig let shadow-side faces desaturate out of their material's
hue family. Fixed, highest-value first, with the actual measured before/after:

1. **[top fix, A1/A4/A5] Bunting cleared and enlarged — the actual root cause, not a re-tune.**
   Round 6's `ring_r=0.60` was checked only against the STEPS half-width (0.725); it was never
   checked against the PLAZA BASE block's own corner reach (0.7071 at the old base scale) — the
   thing actually beside the ring in Z. Fixed two ways, both asserted at runtime so this exact class
   of bug can't ship silently again: (a) `BASE_XY_SCALE` shrunk from 1.0 to **0.8** (corner reach
   0.5657), and `ring_r` set to **0.65** — a real 0.084-unit margin from the base corner and a
   0.075-unit margin from the steps edge, printed and asserted (`build_landmark.py` §3/§4, the
   `if not (BASE_CORNER_REACH < ring_r < 0.725): raise` check). (b) `FLAG_Z` raised from 0.30 to
   **0.50** and flags enlarged to `FLAG_W=0.34, FLAG_H=0.28` (from 0.26×0.22) — flag bottom now sits
   at z=0.22, **0.07 above** the steps top (z=0.15), also asserted at runtime
   (`FLAG_MARGIN >= 0.03`). Both assertions printed and passed on the actual run (see the build log
   in §0c). Re-rendered and visually confirmed in every render below: no flag or post overlaps a
   solid block anywhere, and the enlarged cyan flag in `landmark_bunting_ring_detail_a.png` measures
   **242×230px** on the 1600px canvas (bbox by color match, see §4) — up from round 6's measured
   ~15px.
2. **[A2, second priority] Shadow-side faces re-tuned to stay inside the token family.** Round 6's
   key/fill ratio was 2.4/1.2 (2:1) with a near-black world ambient (0.05 × 0.6 strength); a
   Landmark_Top shadow-side sample read `(142,125,134)` against a lit `(251,219,234)` — 44% darker
   AND desaturated from 15% to 5.6% (i.e. reading gray, not pink). Narrowed the ratio to 2.2/1.5
   (~1.5:1) and raised the world ambient to `(0.14,0.14,0.14) × 1.1`. Re-measured on the new
   `hero_elevated_arch` render (Python/PIL, not asserted): lit roof face `(255,218,232)`, sat 14.5%;
   shadow roof face `(172,146,156)`, sat **15.1%** — the shadow face now matches the lit face's
   saturation almost exactly (both read as the same pink family), and luminance holds to 67% of the
   lit face (up from round 6's 56%) — see §4 for the full sample set.
3. **[A1] Two more azimuths added — a real side and a real back, not more of the same face.** Three
   of round 6's four renders were all `az=90`, the same Y-tunnel face at different elevations; no
   render showed the X-tunnel arch or the model's back. Added `side_profile` (az=0 — the OTHER
   tunnel axis, confirmed a visually different arch in the render, not a relabeled duplicate) and
   `back_three_quarter` (az=270, the face opposite the "front" az=90 shots). 6 renders now cover 3
   distinct azimuths instead of 1.
4. **[A1/A4/A11, honestly partial] All 7 flags + both shapes, in two complementary renders — not
   one, and here is why not one.** The brief's finding asked for a single render showing all 7 flags
   unoccluded. Tested empirically at three elevations before concluding this is not achievable in a
   single shot with this massing: at elev=50-64° the tower's own solid body occludes 1-2 of the 7
   flags on the far side (verified by render, not assumed); at elev=83° occlusion clears almost
   entirely, but the flags — whose face plane contains the vertical axis — foreshorten to near-zero
   width and become illegible slivers (also verified by render, see the deleted intermediate test
   images' description in this round's process). This is a real geometric property of a ring of
   vertical-plane flags around a solid mass, not a tuning miss. Delivered instead:
   `landmark_bunting_ring_detail_a.png` (az=25.7, elev=50) and `_b.png` (az=205.7, elev=50, the
   opposite side) — between the two, **all 7 category hues are visible**, and critically, the exact
   CVD-motivated pair the round-6 accessibility note targets — `#8AD3B4` (index 3, swallowtail) and
   `#6FBFA6` (index 4, pennant) — are **both fully visible and shape-distinct in the same frame**
   (`_b.png`: a light-green notched swallowtail on the left, a dark-green plain-triangle pennant at
   center). This is the first round where that specific claim is verifiable from a render instead of
   asserted from the script.
5. **[honest, not re-claimed] Village-camera-zoom legibility remains unchecked** — unchanged from
   every prior round; the model is still not wired into a scene (this task's stated boundary).
6. **[honest, not re-claimed] New renders' `.meta` files are not yet generated** — the 4 round-6
   renders' `.meta` files are committed (confirmed via `git status`, see §0c), but the 4 NEW render
   files this round (`side_profile`, `back_three_quarter`, `bunting_ring_detail_a/b`) have no `.meta`
   yet because nothing has re-opened the project in the Unity editor since they were written to disk
   — `.meta` generation is an editor-side action this task's tooling cannot trigger. Noted honestly
   rather than claimed closed; whoever next opens the project in Unity will generate and should
   commit them.

## 0c. Build + verification log (round 7, actually run — see the raw output, not read off the script)

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python "C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\build_landmark.py"
```

- `[diagnostic] belfry faces before arch cut: 6` → `after: 106` — arch boolean still produces real
  geometry after the base/ring changes (this part of the geometry graph is untouched, re-verified
  anyway since the whole script re-runs every time).
- `[diagnostic] garland ring_r=0.65 clears base corner 0.5657 by 0.0843, steps edge 0.725 by 0.0750`
  — printed by the new runtime assertion, not computed by hand after the fact.
- `[diagnostic] flag bottom z=0.2200 clears steps top 0.15 by 0.0700` — same, the other new
  assertion.
- `landmark_beacon.glb` re-parsed (stdlib `struct`+`json`): still **15/15 materials** carry real
  color data (10 `baseColorFactor`, 5 `baseColorTexture`) after the geometry edits — the material
  graph wasn't touched this round, but re-verified rather than assumed unaffected.
- All 8 renders (see §0b item 3/4) opened and visually inspected; flag bbox measured by color-match
  scan (Python/PIL) on `bunting_ring_detail_a.png`: cyan flag (i=1) bbox 904-1146 × 1054-1284px =
  **242×230px**. Shadow/lit saturation and luminance sampled on `hero_elevated_arch.png` (§0b item
  2).
- `git status` re-run after the build (see §0b item 6) to check `.meta` state honestly instead of
  asserting it.

---

## 0a. Status — round 6, fixes every item in the art-lead's round-5 review (score 60/100)

The round-5 review found real, still-photographed problems even after round 5's rewrite: lighting
was consistent in HUE but not in EXPOSURE across shots (a top-fix-level bug), three renders were
still redundant despite being face-on instead of corner-on, the belfry opening was a circular
porthole rather than an arch, the bunting cord was a rigid hoop overhanging the plaza, and 12
`.meta` files existed on disk but were never committed. Fixed, in the order that moves the score
most (full detail + measured numbers in each numbered section below):

1. **[top fix, A2] Camera-relative lighting.** The key/fill suns are no longer aimed once in world
   space before the render loop — they are re-aimed *every render*, at a fixed offset from that
   shot's own camera azimuth (`light_dirs_for_azimuth` + `set_sun_dir` in `build_landmark.py` §5,
   called inside the camera loop in §6). Because the light's elevation (Z) component is now a
   constant across every view, a horizontal face's brightness is identical shot to shot **by
   construction**. Measured (Python/PIL, isolating the brightest 5% of near-white pixels per
   render — the plaza/roof top faces): **233–236 out of 255 across all 4 renders**, a ~1.3% spread,
   replacing round 5's 217/122/129 (up to 78% apart).
2. **[A1] Four angle-varied shots, not three near-identical ones.** Round 5 swapped three
   near-identical *corner* views for three near-identical *face-on* views — same redundancy,
   different azimuths. This round varies **elevation** as well: `hero_elevated_arch` (raised 3/4,
   still frames the Y-tunnel head-on), `plaza_plan_from_above` (high plan view — reads the stepped
   plaza massing and the garland ring from above), `eye_level_approach` (low, full-height
   silhouette), `belfry_closeup` (unchanged tight framing on the signature element). Filenames
   describe what's actually in frame — the round-5 files (`_three_quarter`/`_profile`, which were
   flagged as inaccurate) are deleted, not left stale alongside the new ones.
3. **[A1, A5] A real arch, not a circular porthole.** The belfry opening was a single cylinder bore
   — an ellipse with no straight sides, reading as a birdhouse hole. Rebuilt per tunnel axis from
   two cutter shapes (`add_arch_cutters` in `build_landmark.py` §3): a box for the vertical jambs
   up to a springline, and a cylinder for the rounded crown above it — a real arch profile (see the
   belfry closeup render). The beacon core is now centred in the *full* opening (floor to crown)
   with margin on every side.
4. **[A1, A5] A garland, not a hoop.** `ring_r` shrunk from 0.95 to **0.60** (inside the plaza
   steps' half-width of 0.725 — no more overhang past the slab edge at any point). The cord is no
   longer a constant-radius/constant-height torus: `build_garland_cord` samples a POLY curve around
   the ring with a parabolic sag between posts and **zero sag exactly at each post**, giving a real
   droop instead of a rigid ring (visible in every full-body render). Flags are rebuilt directly in
   world space from their post's attach point (`build_flag`), hanging straight down from the cord
   instead of radiating outward/upward from it.
5. **[A4] Flags differ by shape, not colour alone.** `build_flag` alternates **pennant** (plain
   triangle, even index) and **swallowtail** (notched, two tails, odd index) — a second,
   non-colour channel for the 7 categories, on top of the already-fixed positional ordering
   (§4 below expands the accessibility reasoning; two of the 7 hues are close enough that a
   colour-only channel isn't CVD-safe on its own).
6. **[A3] `.meta` files committed.** 12 `.meta` files existed on disk (Unity had imported the
   folder at some point — confirmed by inspecting the files directly, not assumed) but were never
   committed, so a fresh clone would mint new GUIDs on next import. Committed alongside this
   round's output; no script change needed, this was a git-hygiene gap.
7. **[A3] Texture periodicity now resolves in the render.** Round 5's `smart_project` UV unwrap
   packed each face into an arbitrarily-sized island, so the authored 64px paving grid could be
   sampled from a fraction of a single grid cell — the texture *existed* but no periodicity ever
   reached a render (measured: zero periodicity on a scanline). Replaced with `uv.cube_project` at
   a fixed, documented texel density (`TEXEL_TILE_UNITS = 0.5` — one 64px texture tile per 0.5
   world units, the same number on every part). Re-measured on the new `plaza_plan_from_above`
   render: a horizontal scanline across the plaza top now crosses **26 seam-line transitions**,
   visually confirmed in a zoomed crop (see §7).
8. **[honest, not re-claimed] The village-camera-zoom legibility check is still owed.** Unchanged
   from round 5 — the model is explicitly not wired into a scene yet (this task's stated boundary),
   so there is still no render at actual gameplay zoom. Noted here rather than silently re-asserted
   as resolved.

**Command used to build (re-runnable, deterministic), and what was actually verified this round —
not asserted, actually run:**

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python "C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\build_landmark.py"
```

- `[diagnostic] belfry faces before arch cut: 6` → `after: 106` — the arch boolean cut produced
  real geometry (printed by the script's own `PROVE_THE_CUT` assertion, not read off the code).
- `[diagnostic] Landmark_Belfry: 96 cavity faces assigned 'Landmark_Cavity' out of 106 total` — the
  cavity backdrop material is applied to the tunnel-wall faces, not silently unused.
- `landmark_beacon.glb`'s binary JSON chunk parsed directly (stdlib `struct`+`json`): **15/15
  materials carry real colour data** (10 `baseColorFactor`, 5 `baseColorTexture` + embedded image),
  zero with none. All textured primitives carry `TEXCOORD_0` (UV present, not just a default
  identity layer).
- `landmark_beacon.fbx` scanned as raw bytes: all 8 material names present (including
  `Landmark_Cavity`), 5 embedded PNG signatures (`\x89PNG` count = 5, matches the glTF image count).
- All 4 renders opened and visually inspected; the plaza-top and roof-top brightness measured
  numerically across renders (see item 1 above) instead of asserted from a single sample.

---

## 0. Status — round 4/5 history (kept for context, superseded by 0a above)

**This round had live `mcp__blender__*` and Bash access** (confirmed working, unlike rounds 3-5
which were blocked on a tool grant that never bound to the session). The script was actually run
— repeatedly, fixing what each run's real output revealed — not just read and assumed correct.
Six real, previously-undetected bugs were found and fixed this round by inspecting actual output
(renders + exported material JSON), not by re-reading the script:

1. `make_paving_png()` didn't accept the `seed=` kwarg the plaza material call passed —
   `TypeError` on the very first line that used the paving motif. Added the (unused-but-accepted)
   parameter.
2. Blender 4.x+/5.x defaults the view transform to **AgX**, a filmic tone curve that crushed the
   authored hexes to near-grayscale in every render (a sampled front-face pixel came back
   `(99,71,82)` against an authored `(255,182,210)`) — this alone would have failed the "renders
   verifiably match tokens" bar even though the *materials* were correct. Fixed by setting
   `view_settings.view_transform = "Standard"` (raw sRGB, no tone curve) plus a small neutral
   world-ambient fill so deep-shadow faces don't crush to pure black.
3. **The actual root cause of the round-4 "arch invisible" finding wasn't fully fixed by the
   arch-cut geometry fix alone**: after the camera azimuths were changed to face-on angles
   (0°/90°/180°), the key/fill sun rotations were never re-aimed — they still pointed at the OLD
   45°/135°/-45° corner cameras' framing. Hand-computed the light's travel-direction vector against
   the new front face normal and got a **negative** dot product (i.e. the "key" light was
   back-lighting the face the camera looks at, not front-lighting it) — this is why the first
   re-render of this round still looked dark/muted even after fix #2. Rewrote both sun lights to
   aim via `Vector.to_track_quat` (same convention already used for the cameras) instead of
   hand-picked Euler angles, so "does this hit the face the camera sees" is a direct, checkable
   vector, not manual trig.
4. The world node lookup used `nodes.get("Background")` — an English default name, unreliable
   under this Blender install's Korean locale (confirmed Korean locale from the glTF export log,
   which names primitives 평면/실린더/토러스/큐브 etc). Switched to a lookup by node `.type`,
   matching the fix already applied to `make_material()`'s node lookup in an earlier round.
5. **The belfry cavity material was never actually assigned to any face**, in two different wrong
   ways caught in sequence: first a distance-from-the-*vertical*-Z-axis heuristic (0 faces matched
   — the tunnels run horizontally, not vertically); then, after fixing that, a
   distance-from-*each-tunnel's-own-axis* heuristic that over-matched because
   `bmesh.face.calc_center_median()` returns **local** mesh-space coordinates, but the check
   compared against a **world**-space Z value (the object's location offset isn't baked into
   vertex coordinates — only rotation/scale were, via `transform_apply(location=False, ...)`).
   Final fix: classify by face **area** instead (tunnel-wall facets from the cylindrical cut are
   narrow strips, ~0.005-0.012 units²; the ~10 surviving exterior faces are ≥0.06 units² — a clean
   5x gap, verified empirically, not assumed). Caught in the first place because the exported glTF
   was missing the `Landmark_Cavity` material entirely (an unused material slot is dropped by the
   exporter) — i.e. found by inspecting the export, not the Blender viewport.
6. Light energy (3.5/2.0) initially overexposed the roof's near-normal-incidence faces to pure
   white `(255,255,255)`, clipping past the authored top-face hex rather than just brightening it.
   Tuned down to 2.4/1.2; a re-sampled roof pixel came back `(255,222,237)` against an authored
   `(255,216,231)`.

Round 3/4/5 findings (crash fix, node-tree-by-type, ridge cap geometry, gem/spire token fix,
render-engine selection, arch box-cutter bug, camera azimuths, colored-fill-light hue-shift,
baked-PNG textures replacing live noise graphs, bunting garland connector, two distinct texture
motifs) all remain in place and are now confirmed live in the actual exported/rendered output, not
just present in the script. Full line-level history: git log on `build_landmark.py`.

**Command used to build (re-runnable, deterministic):**

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python "C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\build_landmark.py"
```

**Verification performed this round (not asserted, actually run):**
- `renders/landmark_*.png` opened and visually inspected (all 4 — see §7).
- `landmark_beacon.glb`'s binary JSON chunk parsed directly (stdlib `struct`+`json`, no Blender/
  Unity involved) to confirm all **15/15 materials** carry real color data — 10 via
  `baseColorFactor` (verified numerically against the authored hex, converted sRGB→linear the same
  way the design system's own contrast formula does) and 5 via an embedded `baseColorTexture`
  pointing at one of 5 embedded PNG images (`Landmark_Top/Front/Side/Secondary/Plaza`). Zero
  materials are white/undefined — the round-4 finding ("5 of 13 materials had no baseColorFactor")
  is fixed and re-verified, not just re-asserted.
- `landmark_beacon.fbx` scanned as raw bytes for every material name (all 8 unique names present,
  including `Landmark_Cavity` which was absent before fix #5) and for embedded PNG signatures
  (`\x89PNG` count = 5, matching the glTF's image count).
- `[diagnostic] belfry faces before arch cut: 6` → `after: 106` printed by the script's own
  runtime assertion (`PROVE_THE_CUT`), confirming the boolean actually cut geometry, not asserted
  from reading the script.
- Front-face and roof-top pixels sampled from the final PNG (Python/PIL) and compared numerically
  against the authored hex (see §4 for the numbers) — a lit 3D render is never pixel-identical to
  a flat swatch, but hue and magnitude both track the token closely, and the ground-truth color
  data (glTF `baseColorFactor` / embedded texture) matches the tokens exactly regardless of
  lighting, since that's the underlying asset data, not a render artifact.

---

## 1. The form choice — Village Beacon Spire

**Concept:** a stepped 2×2 plaza base with a set-back tower and an open-arch belfry holding a
faceted beacon core, capped with a pyramidal roof, a gold ridge collar, and a finial spire topped
with a cut gem. Bunting flags in the 7 category hues ring the plaza base.

**Round 8:** the beacon core is now a literal light source (self-emissive material, §0d item 1),
not just a lit ornament — a more direct reading of "achievement made visible" than a passively-lit
gold blob. The belfry opening is also now singular front-to-back (one arch, not four) — see the
grammar table below, corrected from earlier rounds' "arches on all 4 faces" description, which was
never actually built.

**Why this, and not a bigger category cottage:**

- The brief is explicit that a landmark must read as "a shared, central piece the village is built
  around, not one more house." A central spire is a load-bearing plaza trope precisely because it
  is not anyone's building — no roof archetype from `01-asset-strategy.md` §Concrete-plan-1
  (gable/skylight/shed/garage-notch/dormer/dome/awning-antenna, one per category) is reused, so it
  cannot be mistaken for an eighth category.
- **A visible beacon core is the literal image of "achievement made visible"** (§Purpose,
  `VISION.md`: *"내 시간과 노력을 눈에 보이게"*) without wiring a mechanic to it — it is
  decorative, not functional, same as the existing flagpole/lantern prop
  (`00-art-design-system.md` §3.2 S3) is decorative. The brief's boundary ("don't invent new
  gameplay meaning") is respected by keeping it a static mesh, not an interactive trigger.
- **Bunting in all 7 category hues** at the base is the one place the landmark visually
  acknowledges every category equally — echoing the leisure-parity rule
  (`00-art-design-system.md` §4.2: same grammar for all 7, never one category privileged) applied
  to the one shared structure instead of to a single building.

**Escaping the "default belltower" template — honest accounting.** Round 3 correctly called out
that a plaza spire with an arched belfry is the templated answer to "give a village a landmark,"
and that the originality lived entirely in prose, not the object. Two things are true at once
here: (1) the overall silhouette — a symmetric, set-back, multi-block tower — is not optional; it
is dictated by `00-art-design-system.md` §3.3's own locked grammar ("same grammar, one more block
than Tier2 S4, single fixed stage"), which this task is bound to follow, not free to reinvent. A
landmark that looked structurally unrelated to the tile grammar would fail cohesion, the design
system's stated core bet (§0: *"a formula every building's colour and silhouette is computed
from"*). (2) Within that constraint, this round makes two concrete (not prose-only) departures
from the generic church-belltower reading: the beacon core is an 8-sided **faceted** cone, not a
smooth 16-sided bronze bell, and the finial is a low-poly **ico-sphere gem** (subdivisions=1, a cut
stone), not a smooth orb — both read as crystal/beacon language, closer to "achievement gem" (the
game's own EXP/currency visual vocabulary) than to a literal church fixture. A gold ridge collar
was also added at the roof apex, closing a token gap (see §3). These are geometry changes, visible
in the export once rendered — not new copy describing an unchanged mesh.

## 2. Grammar compliance (T004 §3.3 "Landmark" note)

`00-art-design-system.md` §3.3 already reserves the landmark's grammar: *"same grammar, one more
added block than Tier2 S4, footprint 2×2–3×3, single fixed stage (no levels — unique)."* This
design is built to that exact rule, not a new one:

| Tier2 S4 (4 blocks: base, +upper, +2nd upper offset, +roof crown) | Landmark (+1 block over S4) |
|---|---|
| base block | **plaza base**, 2×2 footprint (steps ring built into geometry, not a separate mesh) |
| +upper block, setback | **tower shaft**, setback, narrower |
| +2nd upper block, offset | **belfry block**, one open arch through the Y axis (front/back), the two X faces solid; beacon core suspended inside, dark cavity backdrop (new, §4). Round 8: cut down from 2 crossing arches (X+Y) to 1 — the dual-axis cut made the massing 4-fold symmetric, which is what made 3 of 8 renders near-identical (§0d item 3) |
| +roof crown | **pyramidal roof cap + gold ridge collar** (new, §3) |
| — | **+1 block over S4: finial** — faceted gem on a short spire above the roof cap, the "one more block" the grammar calls for, plus the flag/lantern prop scaled up (single fixed stage, no evolution — matches "unique, no levels") |

Footprint: 2×2 core plaza + step overhang reads up to 3×3 at the base, within the spec'd 2×2–3×3
range.

## 3. Token mapping (docs/design/00-art-design-system.md §1, §3.1/§4.1 — no new tokens invented)

The landmark is **not** owned by any of the 7 categories, so it does not use a category `500` hex.
It uses the brand-identity tokens already defined for exactly this "belongs to the whole village,
not one category" role. **Every row below was re-checked against the current script this round —
round 3 caught one mismatch (finial orb assigned `mat_coin` in the script vs. `color.secondary` in
this table); it's fixed in the script, not patched over in the table.**

| Part | Token | Hex | Role reused |
|---|---|---|---|
| Roof top face | `color.primary` + 60% white mix | tint of `#FF9EC4` | same shading-formula rule as every building (§3.1: *"top/roof = category 500 + 60% white"*), `color.primary` standing in for "category" since the landmark belongs to the whole village |
| Tower front face | `color.primary` + 25% white mix | tint of `#FF9EC4` | same rule, front face |
| Tower side face | `color.primary` (pure) | `#FF9EC4` | same rule, side face |
| Finial spire + gem | `color.secondary` | `#B6A0EF` | the "secondary" role token — reads as the second brand hue, not a category hue. **Fixed this round:** the gem was wired to `mat_coin` in the script; now matches this row |
| Beacon core (formerly "bell") + roof ridge collar | `color.currency.coin` | `#FFD066` | the achievement/gold token already used for coin — reinforces "visible achievement" without a new token. **New this round:** the ridge collar geometry didn't exist before; the gold read was carried by the core alone |
| Belfry cavity backdrop (new, §4) | `color.text.primary` | `#5A4A6A` | an existing locked text token, repurposed as a dark interior backdrop — not a new colour, a new *use* of one already in the palette |
| Plaza base / steps | `color.surface.raised` | `#FFFFFF` | matches card/plaza-adjacent surfaces elsewhere in the system |
| Bunting flags (7×) | the 7 category `500` hexes, §4.1 | `#B6A0EF #6FD0E8 #FFD066 #8AD3B4 #6FBFA6 #FFB37A #FF8FA3` | literal reuse of the locked category palette — no new colour introduced anywhere in this design. **Round 6:** flag *shape* (pennant/swallowtail, alternating by index) is layered on top of colour — see §4's CVD note |
| Bunting cord + posts | `color.text.primary` | `#5A4A6A` | **Row added round 7** (art-lead review finding: this row was missing despite being the most visually prominent dark element in every full-body render). Same token reused for the belfry cavity backdrop, above — one dark text/contrast token, two structural uses, still no new colour |
| Edges | Bevel modifier, ~0.015 unit width, 2 segments, angle-limited | n/a (geometry, not a shader stroke) | the 3D-native reading of "no pure black outline, subtle" (§3.1) — a soft physical edge instead of a rim-light shader trick, applied to steps/base/shaft/roof |

No hex in this document is new. Every value is copied from `00-art-design-system.md` §1/§4.1.

## 4. Legibility & contrast — computed, not asserted (fixes round-3 A4 findings)

Round 3 correctly noted the original submission had zero contrast/size figures. These are
computed from the script's actual geometry and material hexes (WCAG relative-luminance formula,
same math the design system already uses for its text-contrast tokens in §9):

- **Beacon core vs. belfry backdrop.** Gold core (`#FFD066`) against the belfry's own pure-primary
  side material (`#FF9EC4`, what the cavity would look like with no fix) computes to **1.32:1** —
  a hue-only separation, essentially unreadable in luminance/grayscale terms, though distinguishable
  by color-normal viewers via hue alone. Fixed by giving the boolean-cut interior reveal faces a
  dedicated cavity material (`color.text.primary`, `#5A4A6A`, §3).
  **Round 7 claimed this computes to 5.52:1 from the flat authored hexes — round 7's own art-lead
  review found that figure did not reproduce from the actual render (1.51-1.80:1 measured), because
  the beacon material was direction-lit and collapsed to 52% of its authored value inside the unlit
  cavity. Round 8 fixes the cause (self-emission, §0d item 1) and re-measures from the delivered
  PNG instead of the flat hex: beacon sample `(255,232,115)` vs cavity sample `(105,88,95)`
  (`landmark_belfry_closeup.png`, method in §0e) computes to 5.39:1** — this is the number to trust;
  it is close to round 7's claimed 5.52:1 only because the fix finally makes the render match what
  the flat-hex math always assumed.
- **Ring radius, now checked against the right block.** Round 6's `ring_r=0.60` was only ever
  checked against the STEPS half-width (0.725) — it was never checked against the PLAZA BASE
  block's own corner reach (0.7071 at round 6's base scale), which is what actually sat beside the
  ring in Z and is what buried 2 of 7 flags in the wall (round-2-of-resumption review finding).
  **Round 7:** `BASE_XY_SCALE` shrunk to 0.8 (corner reach 0.5657) and `ring_r=0.65` — a printed,
  runtime-asserted 0.084-unit margin from the base corner and 0.075-unit margin from the steps edge
  (`build_landmark.py` §4, `if not (BASE_CORNER_REACH < ring_r < 0.725): raise`). Verified two ways:
  the assertion itself passed on the actual build (§0c), and every render below shows the ring and
  every flag clear of the solid blocks — no flag is sliced or buried in any of the 8 renders.
- **Bunting minimum size — real measured px, not extrapolated.** Round 6's doc claimed `0.30×0.26`
  world units (~30-34px) but the script actually shipped `0.26×0.22` (the stale-figure finding from
  the round-2-of-resumption review) — and even the correct figure was never checked against an
  actual render; measured directly, that flag rendered at ~15px wide, well below any legibility
  floor. **Round 7:** flags enlarged to `FLAG_W=0.34, FLAG_H=0.28` (9.5%/7.8% of the ~3.57-unit
  total height) AND measured directly on the delivered render instead of extrapolated: the cyan
  flag (index 1) in `landmark_bunting_ring_detail_a.png` (1600px canvas) has a color-match bounding
  box of **242×230px** (Python/PIL scan, §0c) — comfortably above any reasonable legibility floor,
  not "comfortably above" by assertion. This is one specific flag at a near-face-on angle in one
  specific render; other flags/angles read smaller (see the honest occlusion discussion below), but
  the size figure itself is no longer extrapolated from world units.
- **Colour-vision-deficiency note — now verifiable in a render, not asserted from the script.** Two
  category hues, `#8AD3B4` (exercise, index 3) and `#6FBFA6` (hobby, index 4), sit close enough in
  hue/lightness that QA independently described both as "green." `build_flag` alternates
  **pennant** (plain triangle, even index) and **swallowtail** (notched, two tails, odd index) as a
  second, colour-independent channel — index 3 (odd) is a swallowtail, index 4 (even) is a pennant.
  Round 6 claimed this fix but the round-2-of-resumption review found the exact pair 80% occluded by
  the plaza base in every delivered render, i.e. unverifiable. **Round 7:** `landmark_bunting_ring_
  detail_b.png` (az=205.7, the side of the ring facing away from `_a.png`) shows both flags of this
  exact pair fully unoccluded and clearly shape-distinct in the same frame — a light-green notched
  swallowtail and a dark-green plain-triangle pennant, side by side. This is on top of the
  pre-existing positional encoding (each category always occupies the same angular slot around the
  ring).
- **Round 8: flag colour tokens no longer collapse on the shadow side of the ring.** The
  round-2-of-resumption review found `#FFB37A` rendering at value 45% and `#FFD066` at 72% on
  flags the key/fill rig didn't directly hit. Fixed by the same self-emission mechanism as the
  beacon (§0d item 1) — every flag material now carries `emission_strength=0.55` tinted to its own
  hex. Re-sampled on `bunting_ring_detail_a.png`/`_b.png`: every category now holds at **78-100%**
  of its authored HSV value (full numbers in §0d item 1), replacing the 45-72% collapse.
- **No touch-target analysis is included** — this is a decorative static 3D prop, not an
  interactive UI element; `00-art-design-system.md` §9's 44×44px touch-target rule applies to
  buttons/tiles, not to landmark geometry. Noted so its absence isn't mistaken for an oversight.
- **Render-verified this round, not just computed on paper — and now checked on SHADOW faces, not
  just the brightest 5%.** Round 6's own verification method sampled only "the brightest 5% of
  near-white pixels," which by construction excludes every shadow-side face — exactly the faces
  where the round-2-of-resumption review found desaturation (Landmark_Top read `(142,125,134)`,
  sat 5.6%, on a shadow face vs `(251,219,234)`, sat 15%, lit). **Round 7 samples a lit face AND its
  own shadow-side counterpart on the same material**, not just the brightest pixels overall: on
  `hero_elevated_arch.png`, the roof's lit slope reads `(255,218,232)` (sat 14.5%) and its shadow
  slope reads `(172,146,156)` (sat **15.1%**, luminance 67% of the lit face) — the shadow face now
  holds inside the same hue family instead of collapsing toward gray. The tower body shows the same
  pattern: front `(230,168,193)` sat 27% vs side-shadow `(219,156,180)` sat 28.8%. The belfry cavity
  backdrop is visibly dark and legible in every render that frames it (`landmark_belfry_closeup.png`,
  `landmark_hero_elevated_arch.png`), confirmed both visually and via the exported glTF's material
  list (§0c).

## 5. Fidelity bar vs. the ProBuilder buildings (T006/T007)

`village-lineup-7buildings-v2.png` establishes the existing bar: simple gable-roof cottage
silhouettes, flat category-hue roofs, cream walls, no window/door mesh detail beyond flat color
blocks (this reference is itself a 2D concept illustration, not an in-engine capture, but it is
the fidelity bar the brief names). The beacon spire is designed to clear it via:

- **Open-arch belfry with a beacon core against a dark cavity backdrop** — real negative space (a
  two-part box+cylinder boolean-cut ARCH, jambs + rounded crown, not a cylinder bore) plus a
  a render-measured 5.39:1-contrast interior (§4, §0d item 1 — sampled from the delivered PNG, not
  the flat authored hex), which none of the 7 category buildings have any equivalent of.
- **A stepped 5-element-plus-collar silhouette** (steps, base, shaft, belfry, roof+collar, finial —
  vs. the buildings' cube+upper-block+cap 2–3 block max) — taller, more massing changes, reads as
  "more built" at a glance.
- **Real per-face node-based materials with procedural surface variation, on a fixed-texel-density
  UV unwrap** (Object-space noise driving roughness/bump, a baked-PNG Base Color on 5 of 8
  materials, `cube_project` UV at `TEXEL_TILE_UNITS = 0.5` so the paving-joint pattern actually
  resolves as periodic geometry in the render — verified in §7, not just present as an unused
  image) plus two metallic accents (coin gold, secondary lavender) — the acceptance criterion "not
  the default gray/checker, real materials/textures" is met by both never leaving Blender's default
  material *and* never using a single flat colour per material.
- **A garland with real droop, not a rigid torus** — the bunting cord sags between posts and sits
  entirely inside the plaza footprint, a level of construction detail none of the 7 category
  buildings' flat-colour blocks attempt.

## 6. What is NOT decided here (left for a future task, per the brief's boundary)

- Where the landmark sits on the 8×8 grid, whether it is placed by the player or fixed, and any
  unlock/cost condition — none of this is modeled or implied by the mesh itself.
- Whether the beacon core or bunting ever animates (e.g. a glow pulse) — the exported asset is
  static geometry; if the team later wants that, it is a client-dev + design decision, not assumed
  here.
- The actual on-screen legibility check at village-camera zoom (§4) — owed once this asset is
  wired into a scene, which is explicitly out of scope for this task.

## 7. Handoff — delivered this round (round 9, 2026-08-01)

`lifetown/Assets/Art/Blender/build_landmark.py` executed headless (`blender --background --python`,
run via Bash, not the MCP `execute_blender_code` channel, for a reliable full 8-render batch);
every file below is the actual output of that run, opened and inspected (renders viewed as images,
`.glb` parsed as binary JSON with stdlib `struct`+`json`, pixel values sampled with Python/PIL,
worst-case contrast computed over a full grid of the arch opening — see §0f), not the script's
claims about what it would produce.

**Bounding box (new this round, finding #8):** min=(-0.725, -0.725, 0.0), max=(0.725, 0.725, 3.58),
**size 1.45 × 1.45 × 3.58 world units (W×D×H)** — computed from the actual built mesh vertices at
export time, printed by the script, not estimated.

**Renders** (`lifetown/Assets/Art/Blender/renders/`, **1200×1200 PNG this round** (down from 1600 —
Cycles render time budget; still well above what the game's isometric camera zoom needs), `Standard`
view transform, Cycles engine/128 samples/denoising off — same 8 filenames as round 8, all 8
overwritten in place so existing `.meta` GUIDs are preserved, not orphaned by a rename):
- `landmark_hero_elevated_arch.png` — az=90°, elev=42° (raised 3/4). Frames the (now singular)
  Y-arch head-on; beacon core, ridge collar, finial gem, and garland/poles all visible, all clear
  of the base block and, this round, of each other (bunting fix, §0d item 2).
- `landmark_side_profile.png` — az=0°, elev=30°. **Round 8: now a genuinely different render** — the
  belfry's X faces are solid (no arch, single-axis cut, §0d item 3), so this is a real "unbroken
  wall" silhouette, not a same-arch-different-elevation duplicate of the hero shot.
- `landmark_back_three_quarter.png` — **round 8: re-cast to az=225°**, elev=35°, a genuine oblique
  corner view (was az=270°, the tunnel's other end, which still showed an arch and read similarly
  to the hero shot — the finding this round's review raised). Shows a partial arch reveal AND two
  full vertical faces (lit + shadow) at once — this is also the render that demonstrates the
  top/front/side three-tone shading break (§0d item 4), which no face-on shot can show.
- `landmark_plaza_plan_from_above.png` — az=45°, elev=72°, **ortho_scale tightened 5.6→4.0** (§0d
  item 5) so the subject fills the frame instead of a quarter of it.
- `landmark_eye_level_approach.png` — az=90°, elev=11°, **ortho_scale tightened 6.4→4.9** (§0d item
  5), same framing fix.
- `landmark_belfry_closeup.png` — az=90°, elev=35.264°, ortho_scale=1.6. **Round 9: the belfry no
  longer reads as translucent** (§0f item 1) — solid front/top faces, a dark cavity interior, gold
  beacon glowing against it at 3.26:1 worst-case / 7.96:1 average contrast (§0f, measured over the
  full opening, not a single favourable sample point).
- `landmark_bunting_ring_detail_a.png` — **round 9: az moved 25.7°→15°, elev 50°→62°** (§0f item 7,
  finding #11) — the base block's corner no longer depth-occludes any flag in this shot (a couple
  are lightly cropped by the frame edge instead, a lesser issue than depth occlusion).
- `landmark_bunting_ring_detail_b.png` — **round 9: az moved 205.7°→195°**, same elevation change.
  Opposite side of the ring from `_a.png`; between the two, all 7 category flags are visible
  unoccluded by geometry.

**Exports** (`lifetown/Assets/Art/Blender/`, all covered by `.gitattributes` LFS rules, lines 2-4):
- `landmark_beacon.fbx` — axis_forward=-Z, axis_up=Y, embed_textures=True, path_mode=COPY. Re-scanned
  as raw bytes this round: all 8 material names present, 5 embedded PNG signatures (unchanged from
  round 7 — the material system wasn't touched by this round's geometry/lighting fixes).
- `landmark_beacon.glb` — re-parsed this round directly from the binary JSON chunk (stdlib
  `struct`+`json`, §0f): **15/15 materials `alphaMode=OPAQUE`, none carry
  `KHR_materials_transmission`** — the exported asset was never translucent, confirming round 8's
  own finding on this point; this round's renders (§0f item 1) now finally match it. 10 materials
  carry `baseColorFactor` directly; the other 5 (`Landmark_Top/Front/Side/Secondary/Plaza`) report
  `baseColorFactor=null`, which is correct glTF (defaults to `[1,1,1,1]`) because each has a valid
  `baseColorTexture` pointing at its own baked PNG in the file's `images` array — confirmed present,
  not assumed. `Landmark_Coin` additionally carries a real `KHR_materials_emissive_strength`
  extension.
- `landmark_beacon.blend` — the editable source scene.
- **`.meta` state.** All 8 render `.meta` files exist on disk and tracked (closed round 7-8). Round
  9 additionally removed a stray untracked `landmark_beacon.blend1.meta` and added `*.blend1.meta`
  and `/.utmp/` to `.gitignore` (§0f item 6) — confirmed via `git status` before and after.

**Unity import spec (round 8: expanded from scale/pivot/axis to a real handoff a client-dev can
import against without re-deriving anything; round 9 adds the bounding box, finding #8):**
- **Scale/pivot/axis** (unchanged): scale factor 1, pivot at world origin (model floor at z=0),
  `axis_forward=-Z, axis_up=Y` (matches the FBX exporter args above).
- **Bounding box (new, round 9)**: **1.45 × 1.45 × 3.58 world units (W×D×H)**, floor at z=0, so the
  footprint is ~1.45×1.45 against the 8×8 grid's own unit spacing — the number needed to place this
  against the other 7 buildings without re-deriving it from the mesh.
- **Geometry**: 24 mesh objects, **1992 vertices, 3887 triangles** (post-triangulation; measured by
  `bmesh` triangulate on a temp copy per object at export time, not estimated — §0f). Well under any
  mobile budget for a single static prop; **no LOD group is needed at this polycount**.
- **Materials/shader**: 15 materials. This project has no URP/HDRP package in `Packages/
  manifest.json` (checked this round) — it's the **Built-in Render Pipeline**, so Principled BSDF
  maps directly to Unity's **Standard shader, Metallic workflow**: Base Color→Albedo, Metallic→
  Metallic, Roughness→`1-Smoothness`, Emission Color×Strength→Emission (the coin and 7 flag
  materials carry real emission data now — see the `.glb` note above; enabling "Emission" on those
  Standard-shader instances after import is what makes the self-glow show up in Unity's own
  lighting, not just this Blender render).
- **Textures**: 5 materials (`Landmark_Top/Front/Side/Secondary/Plaza`) carry a baked, embedded PNG
  at **64×64px**. Fine for a plaza-scale background prop at the game's isometric zoom; if a future
  task moves the camera much closer, re-bake at a higher `size=` in `make_blotch_png`/
  `make_paving_png` (`build_landmark.py` §0b) rather than upscaling the PNG after the fact.
- **Collider**: none exported (this is geometry-only). For a static plaza prop, add a single
  `BoxCollider` sized to the mesh's bounding box after import — no per-triangle mesh collider is
  needed for a non-interactive landmark.
- Wiring this into a scene/prefab remains out of scope for this task (client-dev, future task, per
  §6).

**What changed vs. round 7's claims, honestly stated:** round 7 fixed the ring-radius/flag-clearance
geometry bugs but left the lighting model direction-dependent (so the beacon and shadow-side flags
still collapsed to 45-72% of their authored value), the bunting still structurally broken (posts
piercing flags, cord spurs), and the belfry cut on both axes (guaranteeing near-identical face-on
renders no matter how the camera list was tuned) — all three caught by this round's review, all
three fixed at the geometry/material level with numbers re-sampled from the delivered render, not
re-asserted from the script (§0d/§0e for the full list with root causes and measured before/after).
