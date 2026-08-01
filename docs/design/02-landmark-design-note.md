# Landmark Design Note — Village Beacon Spire (D11, first realization)

**Author:** ui-ux · **Date:** 2026-08-01 (round 4) · **Decides:** the form/material design for the
one landmark prop kept in scope by D11 (`VISION.md` §"Scope"). **Does not decide:** gameplay
wiring, placement rules, or unlock conditions — those are out of scope for this task by the brief
and remain a future design decision.

---

## 0. Status — executed and verified this round (T012 resumption, 2026-08-01)

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
| Bunting flags (7×) | the 7 category `500` hexes, §4.1 | `#B6A0EF #6FD0E8 #FFD066 #8AD3B4 #6FBFA6 #FFB37A #FF8FA3` | literal reuse of the locked category palette — no new colour introduced anywhere in this design |
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
- **Ring radius bug found and fixed.** The bunting ring was authored at `ring_r = 1.5` against a
  plaza half-width of `0.725` (steps scale 1.45/2) — the flags floated outside the plaza footprint
  entirely, not "ringing the base" as the geometry comment claimed. Fixed to `ring_r = 0.95`
  (just past the step edge).
- **Bunting minimum size.** Flags were `0.18 × 0.16` world units on a landmark ~3.57 units tall
  (steps top at z=0.15 to the finial gem top at z≈3.57, summing every block's own height from the
  script) — **5.0%/4.5% of total height**, i.e. plausibly a handful of pixels at a wide village
  camera. Enlarged to `0.30 × 0.26` (**8.4%/7.3% of height**), proportionally closer to the
  landmark's own sprite-canvas headroom: `00-art-design-system.md` §2 fixes the landmark's export
  canvas at 320×400px (vs. 256×320px for a Tier2 building, a 1.25× step, not more) — an 8%-height
  feature on a 400px-tall canvas is ~30–34px, comfortably above any reasonable minimum-legible-flat-
  shape floor and consistent with the design system's own 12px text floor (§9) as a sanity
  reference, not a direct equivalence (a flag is a shape, not type). This is a proportional
  argument, not a village-camera render — the landmark is not wired into a scene yet (this task's
  explicit boundary, §5 below), so an actual on-screen village-zoom check is still owed once it is.
- **No touch-target analysis is included** — this is a decorative static 3D prop, not an
  interactive UI element; `00-art-design-system.md` §9's 44×44px touch-target rule applies to
  buttons/tiles, not to landmark geometry. Noted so its absence isn't mistaken for an oversight.
- **Render-verified this round, not just computed on paper.** Sampling `landmark_front_three_quarter.png`
  (Python/PIL, exact pixel coordinates in git history) after the lighting/exposure fixes (§0 items
  2, 3, 6): the tower front face (`color.primary` + 25% white, authored sRGB `(255,182,210)`)
  sampled at `(223,164,189)` — same hue ordering (R>B>G) and same rough magnitude, the gap being
  ordinary lit-surface shading falloff, not a hue-shift artifact (the round-4 colored-fill-light
  bug that caused a genuine hue shift is confirmed gone — see §0 item 3's before/after). The roof
  top face (authored `(255,216,231)`) sampled at `(255,222,237)` — a 6-point difference, i.e. an
  effectively exact match. The belfry cavity backdrop, previously computed at a theoretical 5.52:1
  gold-on-cavity contrast (above) but never actually rendered with the cavity material applied
  (§0 item 5 — the material was silently unused before this round's fix), is now visibly dark and
  applied in every render that frames the belfry (`landmark_belfry_closeup.png`,
  `landmark_front_three_quarter.png`), confirmed both visually and via the exported glTF's
  material list (§0).

## 5. Fidelity bar vs. the ProBuilder buildings (T006/T007)

`village-lineup-7buildings-v2.png` establishes the existing bar: simple gable-roof cottage
silhouettes, flat category-hue roofs, cream walls, no window/door mesh detail beyond flat color
blocks (this reference is itself a 2D concept illustration, not an in-engine capture, but it is
the fidelity bar the brief names). The beacon spire is designed to clear it via:

- **Open-arch belfry with a beacon core against a dark cavity backdrop** — real negative space (a
  boolean-cut arch) plus a computed 5.5:1-contrast interior, which none of the 7 category
  buildings have any equivalent of.
- **A stepped 5-element-plus-collar silhouette** (steps, base, shaft, belfry, roof+collar, finial —
  vs. the buildings' cube+upper-block+cap 2–3 block max) — taller, more massing changes, reads as
  "more built" at a glance.
- **Real per-face node-based materials with procedural surface variation** (Object-space noise
  driving base-color tint, roughness, and bump on every structural block — not a single flat
  Base Color value) plus two metallic accents (coin gold, secondary lavender) — the acceptance
  criterion "not the default gray/checker, real materials/textures" is met by both never leaving
  Blender's default material *and* never using a single flat colour per material.

## 6. What is NOT decided here (left for a future task, per the brief's boundary)

- Where the landmark sits on the 8×8 grid, whether it is placed by the player or fixed, and any
  unlock/cost condition — none of this is modeled or implied by the mesh itself.
- Whether the beacon core or bunting ever animates (e.g. a glow pulse) — the exported asset is
  static geometry; if the team later wants that, it is a client-dev + design decision, not assumed
  here.
- The actual on-screen legibility check at village-camera zoom (§4) — owed once this asset is
  wired into a scene, which is explicitly out of scope for this task.

## 7. Handoff — delivered, this round (2026-08-01)

`lifetown/Assets/Art/Blender/build_landmark.py` executed successfully; every file below is the
actual output of the command in §0, opened and inspected (renders viewed as images, `.glb` parsed
as binary JSON, `.fbx` scanned as raw bytes), not the script's claims about what it would produce.

**Renders** (`lifetown/Assets/Art/Blender/renders/`, 1600×1600 PNG, `Standard` view transform):
- `landmark_front_three_quarter.png` — face-on (azimuth 90°) view of the front (+Y) face; belfry
  arch, beacon core, bunting garland/poles all clearly visible.
- `landmark_side_profile.png` — face-on (azimuth 0°) view of the +X side face.
- `landmark_back_three_quarter.png` — face-on (azimuth 180°) view of the −X side face.
- `landmark_belfry_closeup.png` — tight-framed (ortho_scale 1.6) shot centred on the belfry band;
  the gold beacon core against the dark cavity backdrop, the specific signature element round 4
  scored as invisible, is unambiguous here.

**Exports** (`lifetown/Assets/Art/Blender/`, all covered by `.gitattributes` LFS rules — verified
present, lines 2-4):
- `landmark_beacon.fbx` — axis_forward=-Z, axis_up=Y, embed_textures=True, path_mode=COPY. Contains
  all 8 unique material names (verified by raw byte scan) and 5 embedded PNGs.
- `landmark_beacon.glb` — 15/15 materials carry real color data (10 `baseColorFactor`, 5
  `baseColorTexture` + embedded image), verified by parsing the binary JSON chunk directly with
  stdlib `struct`+`json` (no Blender/Unity dependency in the verification step itself).
- `landmark_beacon.blend` — the editable source scene.

**Unity import spec** (unchanged from earlier rounds, still applies): scale factor 1, pivot at
world origin (model floor sits at z=0), axis convention matches the FBX exporter args above.
Wiring this into a scene/prefab is out of scope for this task (client-dev, future task, per the
brief's boundary in §6).

**What changed vs. earlier rounds' claims, honestly stated:** rounds 3-5 described fixes that were
never actually run or verified (no Bash/Blender access in those sessions). This round found and
fixed six additional real bugs that only running the script surfaced — a `TypeError` on the first
paving-texture call, AgX view-transform desaturation, a light-rig/camera mismatch left over from
the camera-azimuth fix, a locale-fragile node lookup, a belfry-cavity material that was silently
never applied (two wrong fix attempts before the working one), and light-energy overexposure on
the roof. See §0 for the full list with root causes. Every acceptance criterion in the task brief
is now backed by an inspected artifact, not a script read-through.
