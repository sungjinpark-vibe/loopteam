# Landmark Design Note — Village Beacon Spire (D11, first realization)

**Author:** ui-ux · **Date:** 2026-08-01 (round 4) · **Decides:** the form/material design for the
one landmark prop kept in scope by D11 (`VISION.md` §"Scope"). **Does not decide:** gameplay
wiring, placement rules, or unlock conditions — those are out of scope for this task by the brief
and remain a future design decision.

---

## 0. Status — script fixed for Blender 5.2, still not executed by this ui-ux session

**Round 3 finding, confirmed and fixed:** `build_landmark.py`'s `make_material()` did
`mat.node_tree.nodes.get("Principled BSDF")` and immediately dereferenced `.inputs` — on the
installed Blender 5.2.0 LTS that lookup returns `None`, raising `AttributeError` before a single
vertex was created. The header's "Run requirements: Blender 3.6+" claim was never actually tested
against this machine. **Fixed this round:** the node tree is now built explicitly by node *type*
(`ShaderNodeBsdfPrincipled` / `ShaderNodeOutputMaterial`, both stable identifiers since Blender
2.8) instead of a locale/version-fragile name lookup. `use_nodes` is only set when not already
`True`, avoiding the deprecated re-set path the finding also flagged. Every other round-3 finding
(A2 note/script mismatches, A3 no texturing, A4 no legibility numbers, A5 templated form) is
addressed below and in the script; see the script's own header changelog for the line-level list.

**What is still true, re-verified fresh this round, not carried over from memory:** this ui-ux
session has no `Bash`/PowerShell tool and no `mcp__blender__*` tool in its function schema. I
confirmed this by directly calling `mcp__blender__get_scene_info` this round (not just inferring
from the tool list) and got back:

```
Error: No such tool available: mcp__blender__get_scene_info
```

identical to round 3's result. The task brief's claim that Blender MCP tools are "granted to
ui-ux" does not match what this session was actually handed. I have not fabricated renders, an
FBX/glTF, or a `.blend` to satisfy the acceptance criteria — none exist yet on disk.

**What unblocks it — a single command, from any session with Bash + the verified local install:**

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python "C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\build_landmark.py"
```

This produces `renders/landmark_front_three_quarter.png`, `renders/landmark_side_profile.png`,
`renders/landmark_back_three_quarter.png`, `landmark_beacon.fbx`, `landmark_beacon.glb`, and
`landmark_beacon.blend`, all under `lifetown/Assets/Art/Blender/`. The script prints the absolute
path of every file it writes on success. **Recommendation to the PM:** run this from a session
that actually has Bash/shell access (the PM's own session, per `CLAUDE.md`'s tool roster) rather
than re-running the ui-ux round a fourth time against the same missing-tool wall — the design and
the script are done; only the execution step remains, and it needs a capability this role's
current tool grant does not include.

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

## 7. Handoff

`lifetown/Assets/Art/Blender/build_landmark.py` implements everything in §1–§4 as a single `bpy`
script (scene clear → materials with procedural texture → modular block build → boolean arch
cuts + cavity backdrop → beacon core + ridge collar + faceted gem finial → bunting garland → 3-point
isometric-matched lighting → 3 render/viewport screenshots at different angles → FBX + glTF +
`.blend` export). It is fixed for the confirmed Blender 5.2 crash and hardened for `--background`
execution (see script header for the line-level changelog), but **has still not been executed** —
see §0. Next step for whoever picks this up with Bash access: run the command in §0, then attach
the resulting `renders/landmark_*.png` absolute paths and the exported `landmark_beacon.fbx` /
`.glb` / `.blend` paths to this note.
