# Landmark Design Note — Village Beacon Spire (D11, first realization)

**Author:** ui-ux · **Date:** 2026-08-01 (round 7) · **Decides:** the form/material design for the
one landmark prop kept in scope by D11 (`VISION.md` §"Scope"). **Does not decide:** gameplay
wiring, placement rules, or unlock conditions — those are out of scope for this task by the brief
and remain a future design decision.

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
| +2nd upper block, offset | **belfry block**, open arches on all 4 faces, beacon core suspended inside, dark cavity backdrop (new, §4) |
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
  dedicated cavity material (`color.text.primary`, `#5A4A6A`, §3): gold-on-cavity computes to
  **5.52:1** — above the WCAG AA 4.5:1 text threshold, applied here to an object silhouette rather
  than text, which is a stricter bar than this element actually needs but leaves real margin.
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
  computed 5.5:1-contrast interior, which none of the 7 category buildings have any equivalent of.
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

## 7. Handoff — delivered this round (round 7, 2026-08-01)

`lifetown/Assets/Art/Blender/build_landmark.py` executed successfully; every file below is the
actual output of the command in §0c, opened and inspected (renders viewed as images, `.glb` parsed
as binary JSON, pixel values and flag bounding boxes sampled with Python/PIL), not the script's
claims about what it would produce.

**Renders** (`lifetown/Assets/Art/Blender/renders/`, 1600×1600 PNG, `Standard` view transform —
8 files, up from round 6's 4; `hero_elevated_arch`/`plaza_plan_from_above`/`eye_level_approach`/
`belfry_closeup` are overwritten in place, the other 4 are new this round):
- `landmark_hero_elevated_arch.png` — az=90°, elev=42° (raised 3/4). Frames the Y-tunnel arch
  head-on; belfry arch, beacon core, ridge collar, finial gem, and garland/poles all visible, all
  clear of the (now-shrunk) base block.
- `landmark_side_profile.png` — **new, az=0°**, elev=30°. Frames the X-tunnel arch — the OTHER
  tunnel axis from every round-6 render, a genuinely different face, not a relabeled duplicate.
- `landmark_back_three_quarter.png` — **new, az=270°**, elev=38°. The face opposite the az=90
  "front" shots — no round-6 render showed this side at all.
- `landmark_plaza_plan_from_above.png` — az=45°, elev=72° (high plan view). Stepped plaza massing
  and the garland ring in plan.
- `landmark_eye_level_approach.png` — az=90°, elev=11° (low, ground-level). Full-height silhouette;
  4 flags visible in frame, none sliced by the steps or base (the round-2-of-resumption review's
  core geometry finding, now fixed and re-verified here).
- `landmark_belfry_closeup.png` — az=90°, elev=35.264°, ortho_scale=1.6. Gold beacon core against
  the dark cavity backdrop inside the real arch profile.
- `landmark_bunting_ring_detail_a.png` — **new, az=25.7°**, elev=50°, ortho_scale=2.0, tight-framed
  on the garland ring. Shows category indices 0 (lavender pennant) and 1 (cyan swallowtail) fully
  unoccluded — the cyan flag measures 242×230px on this canvas (§4).
- `landmark_bunting_ring_detail_b.png` — **new, az=205.7°** (the opposite side of the ring from
  `_a.png`), same elevation/framing. Shows category indices 3 and 4 — the exact CVD-motivated pair
  (`#8AD3B4` swallowtail / `#6FBFA6` pennant) — fully unoccluded and shape-distinct in one frame.
  Between `_a` and `_b`, all 7 category hues are visible somewhere unoccluded; no single render
  shows all 7 at once, and §0b item 4 explains the geometric reason why (tested, not assumed).

**Exports** (`lifetown/Assets/Art/Blender/`, all covered by `.gitattributes` LFS rules, lines 2-4):
- `landmark_beacon.fbx` — axis_forward=-Z, axis_up=Y, embed_textures=True, path_mode=COPY.
- `landmark_beacon.glb` — re-verified this round: **15/15 materials** carry real color data (10
  `baseColorFactor`, 5 `baseColorTexture` + embedded image), parsed directly from the binary JSON
  chunk (stdlib `struct`+`json`). All textured primitives carry `TEXCOORD_0`.
- `landmark_beacon.blend` — the editable source scene.
- **`.meta` state, honestly reported (§0b item 6):** the 4 round-6 render `.meta` files are
  committed. The 4 new render files this round have no `.meta` yet — Unity hasn't reopened the
  project since they were written, and this task's tooling has no way to trigger that. Not claimed
  resolved.

**Unity import spec** (unchanged): scale factor 1, pivot at world origin (model floor at z=0), axis
convention per the FBX exporter args above. Wiring this into a scene/prefab remains out of scope
for this task (client-dev, future task, per §6).

**What changed vs. round 6's claims, honestly stated:** round 6 fixed the lighting-consistency and
arch-geometry bugs but never checked the garland ring radius against the block it was actually
adjacent to (the plaza base, not the steps) and never re-measured a flag on an actual render (its
`0.30×0.26`/"~30-34px" doc figures didn't even match its own script's `0.26×0.22`) — both caught by
this round's review, both fixed with runtime assertions plus a real pixel measurement (§0b items
1-2, §4). See §0b/§0c for the full list of this round's fixes with root causes and measured
before/after numbers.
