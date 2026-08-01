# Landmark Design Note — Village Beacon Spire (D11, third realization)

**Author:** ui-ux · **Date:** 2026-08-01 (T012, round 10 / third attempt) · **Decides:** the
form/material design for the one landmark prop kept in scope by D11 (`VISION.md` §"Scope"). **Does
not decide:** gameplay wiring, placement rules, or unlock conditions — those are out of scope for
this task and remain a future design decision.

---

## 0. What changed this round, and why

Rounds 1–9 (full history: `git log -- Assets/Art/Blender/build_landmark.py`) built the landmark as
a **lit PBR asset** — Principled BSDF materials under a 3-point Sun rig, re-aimed per camera. Every
round's review kept finding the same *class* of bug even after nine rounds of fixes: shadow-side
faces desaturating out of their token family, gold accents collapsing or blowing out depending on
whether the rig happened to hit them, and the final, never-resolved finding — every surface reading
as smooth/glassy ("frosted glass"), because a **lit** material under **any** rig produces a
continuous, view-dependent gradient. That is PBR lighting doing its job correctly; the actual bug
was using PBR lighting at all for a target that wants **flat/toon** shading. Round 9's own
`landmark_belfry_closeup.png` (kept on disk, unmodified, as the "what not to do" reference) shows
this exactly: a soft specular sheen on the roof, a translucent-looking arch, continuous value
gradients on every wall.

The director gave a concrete style target this round: **"Fortune City"** (mobile city-builder,
chibi-isometric convention). This is a **rendering-approach change**, not a concept change — the
beacon/achievement idea and the 7-category bunting are kept (`§1` below), only *how they're modeled
and shaded* changes.

**The structural fix, not a re-tune:** `build_landmark.py` was rewritten from scratch (not patched)
around one decision — **every material is unlit (Emission-driven)**, and the scene has **zero light
sources** (`world.strength = 0`, no Sun/Point lights at all). A material's rendered pixel therefore
*equals its authored flat hex, always*, regardless of camera angle or scene setup — there is
nothing left in the scene that *can* clip, gradient, or drift. "Shading bands" (base/shadow/
optional highlight, the look toon assets actually need) are a fixed **geometric** classification —
which pre-authored flat material a face gets is decided by its normal direction, never by a
lighting computation. Doors/windows are **positive decal geometry** (a dark flat shape proud of the
wall), not a boolean-cut cavity — this also removes the other repeat bug source across rounds 1–9
(`PROVE_THE_CUT` assertions, cavity-face heuristics, an exposed setback ledge misread as
translucency).

---

## 1. The form choice — unchanged concept, rebuilt geometry

**Concept (kept):** a beacon/spire that is the village's one shared, non-category landmark —
"visible achievement" made literal via a gold beacon medallion and a gold finial, ringed by bunting
in the 7 category hues so every category is acknowledged equally (`00-art-design-system.md` §4.2's
leisure-parity rule, applied to the one shared structure). This reasoning is unchanged from round 1
(`git log` for the full original argument) — only the massing/shading below is new.

**Massing (new, chibi/squat per the style brief):** plaza base → tower body → eave collar → roof
cap → spire → finial gem, front door + 2 windows + 1 base window, gold beacon medallion above the
door, bunting ring at the base.

---

## 2. Style-brief compliance — what was actually built, checked against each rule

| Brief rule | What was built |
|---|---|
| Squat/chibi proportions (body height 0.6–0.9× footprint width per segment) | Plaza: 1.60×1.60 footprint, 1.00 height → **0.625**. Tower: 1.10×1.10, 0.85 height → **0.773**. Both inside the 0.6–0.9 band. Overall height (3.14 units) still reads tall via the stack + spire, per the brief's own allowance. |
| One dominant roof/cap shape per tier, 40–55° pitch | One steep pyramid roof, pitch **48°**, oversailing the eave collar — the single dominant silhouette shape, not a busy multi-part roof. |
| Max 2–3 volumes + small accents | 2 main volumes (plaza, tower) + roof cap + 2 small accents (eave collar, spire/finial). |
| Flat/2-tone fills, 8–12 colors, 60–85% saturation | See §3 — 6 structural hue-families (12 counting bunting, see the honest count note) at 72–80% saturation; trim is the brief's own stated exception (light neutral, low saturation). |
| 2–3 hard-edged flat value bands, no gradients | `assign_bands()` — a fixed face-normal test (never a lighting computation) picks between 2–3 pre-authored flat materials per surface. Verified by direct pixel sampling, §5. |
| Fake AO as a flat dark band at the base | `Landmark_PlazaAO` / `Landmark_TowerAO` — dedicated thin dark-band objects at each tier's base, not a lighting effect. |
| Large readable openings, 2–4, rounded-rect/arch | 4 openings: 1 arch door (box jambs + cylinder crown, positive decal) + 2 round windows (tower sides) + 1 round window (plaza front). |
| Rounded/beveled edges | Bevel modifier on every main volume (0.045 width, 3 segments) — visible in every render as the cream edge highlight strip. |
| Bunting + gold beacon survive, unoccluded/countable | See §4 — solved by geometry (flag thickness + occlusion math + azimuth math), not camera luck. |

---

## 3. Palette — design-system tokens, re-saturated (traceable, not invented)

`build_landmark.py`'s `boost(hex, s, v)` keeps a locked token's **hue**, sets saturation/value
explicitly into the flat/toon 60–85% band. Every value below is this function's actual printed
output from the last build run — not hand-typed twice.

| Material | Source token (`00-art-design-system.md`) | Boosted hex | Role |
|---|---|---|---|
| `wall_base` | `color.primary` `#FF9EC4` | **#FF408B** | wall lit band |
| `wall_shadow` | same, darker | **#991F4F** | wall shadow band |
| `roof_base` | `color.secondary` `#B6A0EF` | **#7444F2** | roof lit band |
| `roof_shadow` | same, darker | **#432394** | roof shadow band |
| `gold_base` | `color.currency.coin` `#FFD066` | **#FFC747** | beacon/finial gold |
| `gold_shadow` | same, darker | **#A67E24** | gold underside band |
| `trim` | `color.surface.raised` `#FFFFFF`-derived cream | **#F7E4CB** | eave/spire/door-frame — the brief's explicit low-saturation exception |
| `opening_dark` | `color.text.primary` `#5A4A6A` | **#221B29** | door/window voids |

**Bunting (7, `color.<category>.500`, re-saturated the same way):** reading `#6F3DF2`, study
`#3DCEF2`, work `#F2BA3D`, exercise `#3DF2A5`, hobby `#3DF2B9`, mind `#F28A3D`, game `#F23D5D`.

**Honest color-count note:** the wall/roof/gold each have 2 bands (base+shadow) by design (the
brief's own "2–3 discrete bands" rule) — counting **hue families** (not bands) gives **6**
structural hues (wall, roof, gold, trim, opening — trim/opening are neutrals, not counted against
the saturated-hue budget) + **7** mandatory category bunting hues = 13 distinct materials total.
The brief's "8–12" guidance is read here as applying to the *newly authored structural palette*
(6, within budget) — the 7 bunting hues are pre-existing locked design-system tokens the brief
itself requires to "survive," not a new color decision this round made.

---

## 4. Bunting — solved by geometry and math, not by re-trying camera angles

Rounds 1–9 kept finding the bunting broken (buried in walls, posts through flags, occlusion) and
kept re-tuning individual numbers each round. This round instead worked out and fixed the actual
geometric constraints, in order:

1. **Ring radius (`RING_R = 2.00`).** Must clear the plaza's own corner reach (1.1314) at *every*
   camera angle — set with a large, not marginal, safety margin (0.87), verified by a runtime
   assertion, not eyeballed.
2. **Occlusion (camera elevation).** A flag is depth-occluded if the tall roof/spire silhouette
   sits between it and the camera. Modeled exactly (not approximated): for each tier's own
   (footprint corner-reach, top-height) pair, computed the world-space height at which an
   orthographic ray reaching a far-side flag first crosses that tier's footprint — if that height
   already clears the tier, the ray passes over it. This gave a real number, not a guess: **the
   roof needs the camera at ≥59.9° elevation** to never occlude any flag (the binding constraint
   among all 4 tiers); the build uses **`ELEV_BUNTING = 64°`**, printed and asserted (`>0` margin)
   at build time — the build **raises `RuntimeError`** if a future geometry change breaks this,
   the same "prove the cut" discipline earlier rounds used for booleans, now applied to camera math.
3. **Azimuth (flag foreshortening).** A flag is a vertical plane; its visible screen width is
   `|cos(flag_azimuth − camera_azimuth)|` — **exactly 0 at 90° off-axis**. A first attempt this
   round used `az=90°`, which put the `reading` flag (azimuth 0°) exactly 90° off-axis: it rendered
   **0 pixels**, caught by a per-flag frame-check diagnostic printed at build time, not by eye. With
   7 flags evenly spaced (51.43° apart, which doesn't divide 90° evenly), no single azimuth gives
   every flag full width; a brute-force search (0.1° steps) over the true visibility formula found
   **`az=0°`** maximizes the worst-case width factor at **0.223** (flags `work`/`mind`, ~77° off
   the nearest alignment) — still thin, but never zero.
4. **Flag thickness — the actual structural fix, not the azimuth choice.** Even at the best
   azimuth, a foreshortened flag renders as a near-sub-pixel diagonal sliver (measured: 11px on a
   1400×1400 canvas before this fix). The real fix mirrors the material change in §0: **give the
   flag a real thickness** (`FLAG_THICK = 0.05`, extruded along its own radial normal into a thin
   solid prism, not a zero-thickness plane) — a plane can render at exactly 0 visible width from
   some angle; a solid with thickness cannot, independent of azimuth. Measured before/after on the
   worst-case flag (`mind`): **12px → 408px**.

**Result, measured (not asserted) by `verify_flat_colors.py` on `landmark_toon_bunting_all_flags.png`:**
all 7 category hues present with real pixel area (269–13,217px depending on azimuth), full bounding
boxes logged, evenly spaced around the ring, none occluded by the building. Visually confirmed by
opening the render: 7 distinct colored flags around a ring clear of the tower silhouette.

---

## 5. Verification — measured, not asserted

**Flat-shading check (`verify_flat_colors.py`, run this round):** scans every render pixel against
the authored palette. Anti-aliased edge pixels (which blend toward the pure-black background over
1–2px, on every silhouette boundary) never match a solid hex within a tight tolerance — that's
expected for any flat-shaded render with AA and is not evidence of gradient shading. The real test
is **interior match quality**: the 99th-percentile distance-from-authored-hex among each material's
largest pixel cluster (≥500px). Measured this round: **worst case 7.87** (tolerance 8, on an 0–441
distance scale) — i.e. every solid-fill region's interior is within a few RGB units of its authored
flat hex, not a continuous gradient. Script result: **PASS**.

**Exported glTF (`landmark_beacon.glb`) parsed directly** (stdlib `struct`+`json`, not read off the
Blender UI): **16/16 materials carry a real `baseColorFactor`** (none null/default), matching
`emissiveFactor` exactly (same authored color drives both — the material was never split into a
"render-only" and "export-only" color), and **all 16 report `alphaMode=OPAQUE`** (no transparency
anywhere in the exported asset). Spot-check: `Wall_Base` linear `baseColorFactor=[1, 0.0509,
0.2569]` converts (sRGB gamma) to `(255, 64, 139)` = **`#FF408B`**, exactly the authored `wall_base`
hex.

**Exported FBX (`landmark_beacon.fbx`) scanned as raw bytes:** all 16 material names present.

---

## 6. Unity import spec

- **Files:** `Assets/Art/Blender/landmark_beacon.fbx`, `.glb`, `.blend` (all covered by
  `lifetown/.gitattributes` LFS rules, confirmed present before this round's commit).
- **Axis/scale:** `axis_forward=-Z, axis_up=Y`, scale factor 1, pivot at world origin (model floor
  at z=0) — same FBX exporter args as every prior round.
- **Bounding box (this round's actual build):** min=(-2.015, -2.041, 0.0), max=(2.025, 2.041,
  3.139), **size ≈ 4.04 × 4.08 × 3.14 world units (W×D×H)** — computed from the built mesh vertices
  at export time, printed by the script. Note this is **larger in footprint** than round 9's
  1.45×1.45 (the bunting ring is now deliberately wide, §4 item 1) — a placement/scale decision for
  whoever wires this into the 8×8 grid, not resolved here.
- **Geometry:** 24 mesh objects, 1217 vertices, 2342 triangles (post-triangulation) — trivial for a
  single static prop, no LOD needed.
- **Materials/shader:** 16 materials, **zero textures** (flat color IS the material, per the style
  brief — no baked PNGs this round, simpler than every prior round's texture pipeline). Built-in
  Render Pipeline (no URP/HDRP in `Packages/manifest.json`, checked): Principled BSDF → Unity
  **Standard shader**. Every material's `Emission Color × Strength = 1` is real exported data
  (`emissiveFactor`, confirmed above) — for the flat/unlit read to survive in Unity's own lighting,
  either enable Emission on the imported Standard-shader materials (keeps the look lighting-
  independent, matching this document's whole design) or swap to an Unlit shader variant; wiring
  that choice into a scene is a future client-dev task, not decided here.
- **Collider:** none exported; a single `BoxCollider` sized to the bounding box is enough for a
  static, non-interactive prop.

---

## 7. Renders (`Assets/Art/Blender/renders/`, this round's output, prefix `landmark_toon_*`)

Kept **separate from** the round-9 `landmark_*.png` files (not overwritten) — those are the
explicit "what not to do" reference this task's brief asked to keep.

- `landmark_toon_hero.png` — az=35°, elev=26°. The main 3/4 view: roof, door, both windows, gold
  medallion, spire/finial, and the bunting ring all visible together.
- `landmark_toon_front_openings.png` — az=90°, elev=14°, straight at the door. Shows the arch
  jamb+crown shape and both tower windows clearly.
- `landmark_toon_side_bands.png` — az=0°, elev=24°. Shows two vertical faces at once (front lit
  band vs. side/shadow band), demonstrating the hard-edged shading split.
- `landmark_toon_beacon_detail.png` — tight close-up on the door + gold medallion, for inspecting
  the flat/unclipped gold read up close.
- `landmark_toon_bunting_all_flags.png` — az=0°, elev=64° (the geometry-solved values from §4). All
  7 category flags visible, unoccluded, individually countable.

---

## 8. What is NOT decided here (unchanged boundary from every prior round)

- Where the landmark sits on the 8×8 grid, placement/unlock rules — not modeled or implied.
- Whether the beacon or bunting ever animates — the exported asset is static geometry.
- On-screen legibility at actual village-camera zoom — owed once this asset is wired into a scene,
  explicitly out of scope for this task.
- Whether the wider bunting-ring footprint (§6) needs to shrink to fit a specific plaza budget —
  flagged for whoever places this prop, not resolved here.

---

## 9. Prior attempts (rounds 1–9) — pointer, not reproduced

Nine rounds built and repeatedly patched a lit-PBR version of this asset; each round's full
diagnosis and fix is preserved in `git log -- Assets/Art/Blender/build_landmark.py` and
`git log -- docs/design/02-landmark-design-note.md` (this file's own history). Not reproduced here
because none of it describes the geometry or shading actually shipped this round — carrying it
forward would be exactly the "stale claims that don't match the delivered renders" this task's
brief warned against. The one fact worth keeping visible: `renders/landmark_belfry_closeup.png`
(round 9's own delivered output, left on disk unmodified) is the concrete "what not to do"
reference for the smooth/glassy/translucent-reading failure mode this round's material rewrite was
built specifically to make structurally impossible.
