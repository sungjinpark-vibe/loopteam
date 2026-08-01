"""
Village Beacon Spire -- Life Town landmark (D11), T012 FOURTH ATTEMPT, ROUND 20.
Fix pass on round 19's art-lead score 68/100 (bar 90/100). Full changelog in
docs/design/02-landmark-design-note.md SS0; summary of the round-20 fixes (reviewer's priority order):
1. [A2 TOP FIX, up to -11 across the review] Structural palette (Wall_Base, Roof_Base, Gold_Base) is
   pulled back toward the design-system tokens instead of being re-authored freely. Roof_Base was the
   worst offender (S 0.85/V 0.68 vs color.secondary's own S 0.331/V 0.937 -- a pastel lavender token
   rendered as deep indigo, the exact "neon-dark" drift the design system names as the risk to avoid).
   FIX: hue stays exact, but S is capped to a modest lift over the token's own S and V stays within
   ~0.10 of the token's own V for all three structural bases (see the palette section below for the
   real before/after numbers).
2. [A1 TOP FIX, -5] The eave rail/ledge extended past both the roof and the building's own silhouette
   as an unsupported plank, with the two end flags hanging past their own support and the plank
   visibly overshooting the dome. Root cause: the flags' own span (GARLAND_HALF_SPAN + flag width) was
   simply wider than the roof's own base-ring radius, so no support geometry sized to reach under them
   could also stay under the roofline. FIX: garland span and flag size both pulled back so the flags'
   own outer extent -- and the rail/ledge sized to support them -- stay INSIDE the roof's base-ring
   radius with a real, asserted margin (`ROOF_CONTAINMENT_MARGIN`), not eyeballed.
3. [A2, -3] `assign_bands()`'s lit/shadow face test ignored normal.z entirely, so a pure top-facing
   face always fell into the shadow material -- a direct inversion of the design system's own face
   ladder (top = brightest). FIX: the test now weights normal.z so a genuinely top-facing surface
   always resolves to the lit material; a real per-object assertion (`assert_top_face_lit`) checks the
   plaza's and tower's own topmost face, not just the render.
4. [A2, -2] `bunting_hobby` broke the note's own "value locked, saturation only ever raised" rule via
   a `v_delta` exception. FIX: the `v_delta` escape hatch is removed entirely; hobby/exercise
   separation (they sit ~7deg of hue apart and collide at the shared default saturation target) is now
   restored via a PER-CATEGORY saturation target (hobby gets the band's max lift, exercise stays near
   the floor) -- still saturation-only, hue and value both stay bit-for-bit identical to the token for
   every category, asserted with a real floor.
5. [A2, -2] The imported vase's neck banding fragmented into a fan of thin triangular slivers under
   the normal-based 2-band split -- a heavily decimated organic mesh has locally noisy face normals
   near tight curvature even though its surface position still varies smoothly. FIX: a dedicated
   `assign_bands_by_azimuth()` classifies by each face's own centroid angle around the vertical axis
   instead of its normal -- stable under decimation, produces exactly one clean seam.
6. [A1, -3] The plaza tier read as a lidded jewelry box (a plain box + hairline-proud trim). FIX: a
   real 3-step plinth profile -- a wide low plinth, the recessed plaza wall, and a proud coping cap --
   plus a genuinely bulky belt band and corner pilasters (proud depth roughly tripled), all within the
   same BASE_H budget so nothing downstream (tower/collar/roof/garland) cascades.
7. [A4, -3] The CVD-closest pair's (`mind`/`game`) only non-colour differentiator, a swallowtail notch,
   was a few pixels wide at delivered scale. FIX: notch depth deepened (a fraction of flag height, so
   it stays a strong signal at any scale, not just close-up).
8. [A3, -1] The Unity Scale-Factor-1 import claim was asserted but never exercised against a real
   Unity import. Downgraded in the design note to an explicit recommendation pending verification,
   not an asserted fact.
9. [A4, -4] Every contrast figure was measured against a pure-black backdrop, never the pale village
   ground this prop actually sits on, and the design system's own deep-night category-legibility rule
   was never applied to the 7 flag hues. FIX: `verify_flat_colors.py` adds both checks against the
   design system's own documented values (§7 below has the numbers).
Everything else (round 14-19 fixes: same-hue derived shadows, the sagging front garland, the PolyHaven
vase swap, the FBX/glTF re-verification pipeline, the locked-state hierarchy-preserving scale) is kept,
working code this round builds on -- see the preserved round-19 header immediately below for that
history, not re-litigated.
--- (round-19 header, preserved for traceability) ---

Village Beacon Spire -- Life Town landmark (D11), T012 FOURTH ATTEMPT, ROUND 19.
Fix pass on round 18's art-lead score 63/100 (bar 90/100). Full changelog in
docs/design/02-landmark-design-note.md SS0; summary of the round-19 fixes (reviewer's priority order):
1. [A2/A4 top fix] Locked-state palette rewritten from a free rank ramp (which inverted the design
   system's own light hierarchy -- Gold_Shadow lighter than Gold_Base, etc, and let Bunting_game/Trim
   go near-invisible against the black backdrop) to a per-material HSV scale derived from each
   material's OWN unlocked S/V -- monotonic, so hierarchy survives automatically; a real 2.5:1
   backdrop-contrast floor is now asserted for every locked material, not just pairwise separation.
2. [A1] hero/side_bands/front_openings ortho_scale+aim_z were carried over unchanged from round 17 and
   clipped the vase in 3 of 9 renders -- now derived from the model's actually-measured world bbox,
   with a real per-view AABB-vs-frame assertion before each render is written.
3. [A1] Podium tier was one lone window on a plain field -- added a decorative trim belt + 2 pilasters
   (no new openings, stays inside the brief's 2-4 cap).
4. [A1] Eave rail/ledge were sized to the flags' attach-point span, not their rendered width -- both
   outer flags hung past their own support; now sized from the flags' real outer extent.
5. [A2] The imported vase's corner-highlight band (assigned by face AREA) read as a zigzag artifact on
   the decimated mesh's irregular facets -- now uses the same clean 2-band (by face normal) split as
   every hand-built surface.
6. [A3] 21/36 exported mesh datablocks carried Korean-locale default names (this Blender install's UI
   language) even though objects were already renamed to English -- one rename pass before export.
7. [A3] Pivot/scale/unit convention for the Unity handoff, previously undocumented -- see the design
   note SS7.
8. [A4] verify_flat_colors.py's flag-vs-wall check never tested a flag against the BACKGROUND -- a
   locked flag at 1.06:1 contrast against black passed anyway. Extended to check both.
9. [A3 minor] SPIRE_H trimmed 0.30->0.23 (scales the vase down with it) to close most of the sprite
   pixel budget overage (444px -> 397px against a 400px canvas).
Everything else (round 14-17 fixes: same-hue derived shadows, the sagging front garland instead of a
ring, the FBX/glTF re-verification pipeline) is unchanged, working code this round builds on -- see the
preserved round-18 header immediately below for that history, kept for traceability, not re-litigated.
--- (round-18 header, preserved for traceability) ---

Village Beacon Spire -- Life Town landmark (D11), T012 FOURTH ATTEMPT, ROUND 18.
Fix pass on round 17's art-lead score 60/100 (bar 90/100). This round's fixes, in the reviewer's
stated priority order (everything else -- palette derivation, garland-as-front-facing-cord concept,
export pipeline -- kept unchanged from round 17, not re-litigated):

1. [TOP FIX, A1/A2/A5, worth up to 12 pts per the reviewer] The signature PolyHaven accent is SWAPPED
   from "Lantern_01" (a wiry mesh -- thin lattice frame + a hanging-hook loop only a few verts thick)
   to "Ceramic Vase 01" (solid lathe-revolved body, no thin members at all -- categories vases/
   containers/decorative, explicitly allowed by this round's brief). Every decimation strategy tried
   on the lantern across rounds 16-17 shattered its thin members into detached shards and a hairline
   handle ribbon (review finding 1) -- a structural property of THAT mesh, not a tuning bug. The vase
   decimates cleanly by construction: `import_lantern_beacon()` now also REJECTS a bad simplification
   outright (counts connected shell components, checks for degenerate near-zero-area faces, hard-fails
   the build if either check finds debris) instead of shipping a shattered result -- verified this
   round by an actual run: 1 clean closed shell, 0 degenerate faces, 501 final polygons.
2. [A1, -3 in the review] The eave rail was WIDER than the collar it was nominally "mounted flush
   against" (2x wider), so both ends overshot the collar's corners and hung unsupported over black
   space. FIX: a new `Landmark_EaveLedge` -- a real shelf/balcony mounted flush to the TOWER WALL
   (the widest solid body actually present at that Z band) and overlapping the rail's own underside
   along its ENTIRE length -- real touching geometry under every flag, reading as an intentional
   balcony, not a cantilever.
3. [A1, -2] `SAG` raised 0.05 -> 0.12 (the largest value that still clears the opening-clearance
   assert with real margin) -- round-17's sag was real in the math but rounded to well under 1px of
   vertical drop at any delivered render scale ("all 7 flag tops share a single y", review finding 2).
4. [A2/A4 TOP FIX, worth up to 9 pts] The locked-state palette is rewritten from a per-material
   VALUE-ONLY transform (desaturate to S=0, compress each material's OWN v) to a DETERMINISTIC RANK-
   based value ramp. The value-only approach silently collapses whenever two materials share the same
   ORIGINAL value -- and four do (wall_base, bunting_work, bunting_mind, bunting_game are all authored
   at V=1.00), so round-17 mapped all four to the literal same grey (#D1D1D1, review findings 5/9).
   The new formula (`LOCKED_RANK_ORDER`/`LOCKED_S`/`LOCKED_V_MIN`/`LOCKED_V_MAX`) assigns every one of
   the 15 exported materials a fixed rank on a value ramp at a real, moderate saturation, found by an
   offline permutation search maximising the worst-case pairwise RGB distance -- measured minimum 29.2
   RGB across all 15 materials, asserted at a real margin (>=26). `verify_flat_colors.py` mirrors this
   exact formula and independently re-asserts the same floor against its own recomputed palette.
5. [A2/A3/A4] A SECOND locked render (`landmark_toon_locked_front.png`) at the front_openings camera
   framing -- the review's exact collision case (3 flags vs the wall) was only ever tested at the hero
   angle, where those flags sit over roof/background, not the wall (review finding 9). Both locked
   renders are diffed against their unlocked counterpart by `verify_flat_colors.py` (real image diffs,
   not a log line), and the locked_front render's own rendered pixels are checked for all 7 flags
   remaining separable from the wall.
6. [A3/A4 TOP FIX, worth up to 5 pts] The village-scale legibility test is rebuilt on the design
   system's OWN documented sprite pixel budget (`00-art-design-system.md` SS2: PPU=100 for buildings,
   Landmark sprite canvas 320x400px @1x) instead of a hand-picked `ortho_scale` (review findings 8 and
   10: no route from render pixels to real in-game size; the old framing was really a ~37%-of-frame
   mid-shot, not a village camera). The new render sizes its resolution to the model's REAL world bbox
   at exactly 100px/world-unit; a flag's on-screen pixel size in that render is the literal answer to
   "how big is this in the shipped sprite", not a simulated distance -- measured this round: flags
   render at ~26x19px, above a stated 12px legibility floor, asserted (not just printed).


Everything else (round-14 fixes 1-12, round-16/17 fixes not named above) is the working code this
round builds on, not re-litigated. See the design note for the full round-18 changelog.
--- (round-17 header, preserved for traceability) ---

T012 FOURTH ATTEMPT, ROUND 17.
Fix pass on round 16's art-lead score 60/100. Round 16 shipped the PolyHaven lantern import (the A5
key move) but the lead found it existed without being SEEN or BELONGING: never framed at legible size,
gold-on-gold/bell-on-flag collisions, a floating unattached garland bracket, and a locked state that
erased all band structure. Round-17 fixes (superseded in several places by round-18 above, kept here
for traceability, not re-litigated): (1) lantern hard-decimated + scaled + framed at legible size;
(2) bunting bracket replaced with a single `Landmark_EaveRail` (round-18 finding: still overshot the
collar -- fixed by `Landmark_EaveLedge` above); (3) gold-on-gold FLAG_ORDER fix; (4) bell/flag
clearance fix; (5) locked state per-material value compression (round-18 finding: collapses on ties --
replaced by the rank ramp above); (6) verify_flat_colors.py erosion kernel 9->5px; (7) village_scale
ortho_scale anchored to the grid unit (round-18 finding: still not a real village-camera test --
replaced by the PPU-grounded render above); (8) Unity _Color handoff table for both states.
--- (original round-14 header preserved below for traceability) ---

T012 THIRD ATTEMPT, ROUND 14.
Fix pass on round 13's art-lead score 53/100. Director-supplied concrete style target this round:
Fortune City (mobile city-builder) chibi-isometric convention -- geometry/shading rewritten against
that brief, not just patched. Top fix (highest point value, named by the reviewer): kill the single
shared FOREIGN-hue "shadow" ink and derive each surface's shadow band as a darker value of its OWN
base hue.

WHAT ROUND 13 GOT WRONG, and what THIS round fixes, in the reviewer's stated priority order:

1. [TOP FIX, A2 -7 / A1 -3 / A4 -5] ONE shared shadow ink (#533B6B, a totally foreign violet hue) was
   reused for every surface's shadow band. From camera angles where only the shadow-facing sides of
   the wall/roof/gold are visible (measured: az=200 deg, `landmark_toon_village_scale.png`), the
   wall's own hue (#FF408B) dropped to LITERALLY 0 PIXELS -- the whole landmark read as one
   undifferentiated dark-violet blob, and separately, the base cube's two visible faces in the hero
   shot read as two unrelated MATERIALS (pink vs violet) instead of lit/shadow sides of ONE material.
   FIX: `derive_shadow()` now takes each surface's OWN base hue and darkens/desaturates it (same hue,
   lower V, slightly higher S -- a real cel-shade "ink" relationship, not a re-hued material). wall,
   roof and gold each get their own base+shadow pair. The single shared dark ink is now used ONLY for
   what it should always have been used for -- actual voids (door/window cavities) and the
   base-of-tier fake-AO skirt -- renamed `void_ink` to make that scope explicit and never claimed to
   be a "shadow band" of a lit surface again.

2. [A1 -7 total] Bunting was a full 360 deg ring on rigid radial spokes. Two independent failures
   followed directly from that shape: (a) flags on the FAR side of the ring, behind the building from
   the camera's POV, got bisected by the building's own silhouette (`reading` flag measured
   x638-761 y1123-1171, a truncated chevron, only the tip escaping the roofline); (b) flags viewed
   near-tangentially (`mind`, `work`) rendered as ~39px edge-on slivers, their notch/shape invisible.
   FIX: bunting is now a single sagging garland strung between TWO anchor brackets on the front (+Y)
   eave corners -- not a ring. Every flag's face normal points the same direction (+Y, toward the
   front camera), so there is no tangential/radial angle-dependence at all, and the whole garland
   sits fully in front of (Y > wall) the building, never behind it -- occlusion-by-own-silhouette is
   now geometrically impossible, not camera-angle-dependent.

3. [A1 -3, A5 -4 partial] The ring read as "a mechanical hoop/carousel armature" (7 radial spokes +
   a rigid decagon), busier than the brief's "max 2-3 volumes + small accents". FIX: 7 spokes -> 2
   short corner brackets + 1 sagging cord. Far fewer parts, and a drooping garland is the actual
   correct real-world reference for "bunting", not a rigid ring.

4. [A2 -1] `exercise`/`hobby` (the two green bunting hues) sat at mirrored ring positions and read as
   a matched pair. FIX: with the ring gone, flags are ordered along the garland explicitly so no two
   similar hues sit at symmetric offsets from the cord's centre (`FLAG_ORDER`, see SS6 comment).

5. [A2 -2] SS2's prose ("recolor policy only ever raises saturation, never touches hue or value") was
   written once and read by the reviewer as covering BOTH the structural and bunting tables, but the
   delivered structural table (full hue/value recolor freedom) violated it outright. FIX: this
   docstring and the design note now state the TWO POLICIES as two separately-named, non-overlapping
   rules: structural = full recolor freedom (hue/S/V all open, into the 60-85% flat/toon band);
   bunting = hue+value LOCKED, saturation-only-raised. Never one sentence spanning both again.

6. [A3 -3] SS9 (Unity import) handed client-dev an either/or ("Unlit, or enable Emission and set
   strength=1") with no shader named and no value pinned. FIX: ONE decision, pinned: this project's
   `ProjectSettings/GraphicsSettings.asset` has `m_CustomRenderPipeline: {fileID: 0}` -- Built-in RP,
   no URP asset assigned (verified this round, not assumed) -- so the pinned import shader is
   Built-in RP's `Unlit/Color`, `_Color` = the material's authored sRGB hex, no emission, no options.

7. [A3 -3] `landmark_beacon.fbx`'s legacy `diffuse_color` path was asserted correct but never actually
   opened -- QA's own evidence list carried it under "could NOT verify". FIX: SS10 of this script
   re-imports the just-exported FBX into a throwaway scene and prints each material's actual
   `diffuse_color` as read back by Blender's own FBX importer, compared against the authored hex --
   a real inspection of the exported file's data, not the in-memory pre-export state.

8. [A3 -2] The locked/pre-achievement state was punted entirely to another document with no hex, no
   geometry, no image. FIX: an 8th render (`landmark_toon_locked_state.png`) delivers a concrete,
   minimal locked treatment -- every material swapped to the existing neutral grey (`#8C8C94`,
   already used for the scale-reference cube, no new colour spent) at Emission Strength 0.55.

9. [A4 -5] `village_scale`'s `ortho_scale=9.5` zoomed out so far the landmark became a ~364x468px
   silhouette with 0 legible detail, and the design note claimed it as "a real step" without saying
   what the image actually failed to show. FIX: `ortho_scale` reduced to 5.6 -- still shows the 1x1x1
   reference cube clearly smaller than the landmark (the scale-comparison purpose), while keeping the
   landmark itself large enough in-frame that wall hue and window shapes stay legible (verified this
   round by direct pixel inspection, SS "verification" below, not asserted).

10. [A4 -4] The CVD shape-pair close-up framed `game` (#FF5271) directly against the wall's own
    #FF408B with no separating outline (~46 RGB units of separation, the note's own bar was ~120).
    FIX: every bunting flag now carries a thin `trim`-coloured (#FAECC8, cream) outline/backing layer
    on all sides, structurally -- not a camera-angle workaround -- so a flag is never adjacent to a
    same-family hue with zero separation, regardless of what happens to sit behind it in any shot.

11. [A5 -4/-3] Massing read as an unmodified primitive stack (box+box+pyramid+stick) with knife-sharp
    corners, and stripped of the flags read as a generic tower. FIX: (a) the roof is no longer a
    straight 4-sided pyramid -- it is a 3-ring bell/ogee profile (base ring -> outward-bulged mid
    ring -> apex point), a rounder, more distinctive silhouette while still being ONE dominant roof
    shape per the brief; (b) the finial gem is now a genuine 5-pointed star bipyramid (a literal
    "achievement star" beacon read, not a generic faceted lump); (c) bevel width/segments roughly
    doubled on every main volume so rounding is a real, visible signal at 1400px, not a ~6px hairline.

12. [A1 -0, self-caught] SS4's old claim ("garland visible only above the roofline") was checked
    directly against `landmark_toon_front_openings.png` and does not hold for the OLD ring geometry
    either. This round's garland sits at the eave (z=collar_top), i.e. BELOW the roof cap and ABOVE
    every opening top -- the design note states this correctly this time (garland below the roof,
    above the openings, never crossing one), matched against an actually-reopened render.

Verification: `verify_flat_colors.py` (same folder, palette table updated this round) plus a new
`verify_bunting_layout.py` (per-flag bbox width + silhouette-exclusion check -- the two specific,
measurable claims the reviewer asked for instead of "colour present somewhere in frame").
"""

import bpy
import bmesh
import colorsys
import math
import os
import mathutils

BASE_DIR = r"C:\Users\user\loop_engine\lifetown\Assets\Art\Blender"
RENDER_DIR = os.path.join(BASE_DIR, "renders")
os.makedirs(RENDER_DIR, exist_ok=True)

# Round-18 [A1/A2/A5 TOP FIX] -- the accent SOURCE ASSET is swapped, not just re-decimated. Round-16
# and 17 both used PolyHaven's "Lantern_01" -- a wiry mesh (thin lattice frame + a hanging-hook loop
# only a few verts thick). EVERY decimation strategy tried on it (raw COLLAPSE in round 16,
# dissolve_limit+COLLAPSE in round 17) shattered those thin members into detached shards and a
# hairline 1-2px handle ribbon (round-17 review finding 1) -- a structural property of that mesh, not
# a tuning bug. FIX: swapped to PolyHaven's "Ceramic Vase 01" (CC0, categories vases/containers/
# decorative -- an explicitly allowed category per this round's brief), a SOLID lathe-revolved body
# with no thin frame/handle members at all, downloaded live via mcp__blender__download_polyhaven_asset,
# PBR-material-stripped, and exported bare (no texture/material data) below. A solid revolved form
# decimates into broad flat facets cleanly by construction -- there is no wiry topology left to shatter.
VASE_SRC_PATH = os.path.join(BASE_DIR, "polyhaven_vase_source.fbx")
assert os.path.exists(VASE_SRC_PATH), (
    f"PolyHaven vase source mesh missing: {VASE_SRC_PATH} -- the signature accent piece "
    f"cannot be a primitive fallback; re-run the PolyHaven download/export step first.")

# ---------------------------------------------------------------------------
# 0. Palette. TWO SEPARATE, NAMED recolor policies (round-14 fix item 5 -- never one sentence
#    spanning both again):
#    - STRUCTURAL (wall/roof/gold/trim/void): full recolor freedom, hue+S+V all open, into the
#      flat/toon 60-85% saturation band. Not category-locked tokens.
#    - BUNTING (7 category hues): hue AND value are LOCKED to the source token; saturation is only
#      ever RAISED, never lowered, into the same 60-85% band.
#    Each STRUCTURAL surface that has real screen area (wall, roof, gold) gets a BASE + a derived
#    SHADOW that is the SAME hue, just darker/richer (round-14 top fix, item 1) -- not a foreign ink.
#    `void_ink` is the one shared dark tone, scoped explicitly to voids + the fake-AO skirt only.
# ---------------------------------------------------------------------------


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_01(hex_str):
    hex_str = hex_str.lstrip("#")
    return tuple(int(hex_str[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def boost(hex_str, s, v):
    """STRUCTURAL recolor policy: keep hue, SET saturation/value explicitly -- full freedom."""
    r, g, b = hex_to_01(hex_str)
    h, _, _ = colorsys.rgb_to_hsv(r, g, b)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
    hexout = "#{:02X}{:02X}{:02X}".format(round(r2 * 255), round(g2 * 255), round(b2 * 255))
    return (r2, g2, b2), hexout


def derive_shadow(rgb01, v_mult=0.56, s_add=0.08):
    """Round-14 TOP FIX: a surface's shadow band is a darker value of its OWN base hue -- same hue,
    lower V, a touch more S (a real cel-shade 'ink' relationship, not a re-hued second material)."""
    h, s, v = colorsys.rgb_to_hsv(*rgb01)
    s2 = min(s + s_add, 1.0)
    v2 = max(v * v_mult, 0.0)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, s2, v2)
    hexout = "#{:02X}{:02X}{:02X}".format(round(r2 * 255), round(g2 * 255), round(b2 * 255))
    return (r2, g2, b2), hexout


def bunting_boost(hex_str, s_target=0.68, s_min=0.60, s_max=0.85):
    """BUNTING recolor policy, round-20 tightened: hue AND value are ALWAYS preserved exactly, no
    exceptions -- the round-19 version had a `v_delta` escape hatch (hobby only) that let the
    deliverable violate its own disclosed rule (review finding 5: "a self-declared rule the
    deliverable itself violates"). Saturation is the ONLY axis this policy may move, and only upward,
    into the 60-85% band; `s_target` may differ PER CATEGORY (see BUNTING_S_TARGET below) to win back
    separation between hue-adjacent categories -- still a real raise from the source token's own S,
    never a lowering, and hue/value stay bit-for-bit identical to the token."""
    r, g, b = hex_to_01(hex_str)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    new_s = min(max(s, s_min, min(s_target, s_max)), s_max) if s < s_target else min(max(s, s_min), s_max)
    new_s = min(max(new_s, s_min), s_max)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, new_s, v)
    hexout = "#{:02X}{:02X}{:02X}".format(round(r2 * 255), round(g2 * 255), round(b2 * 255))
    return (r2, g2, b2), hexout


TOK_PRIMARY = "#FF9EC4"    # color.primary -> wall hue
TOK_SECONDARY = "#B6A0EF"  # color.secondary -> roof hue (also 'reading' category hex -- resolved by
                            # pushing roof far in S/V, not by distorting the bunting hue)
TOK_COIN = "#FFD066"       # color.currency.coin -> gold accent hue (also 'work' category hex -- same
                            # resolution strategy)
TOK_TRIM_SRC = "#FFF6DF"   # color.warning.bg -> trim/outline neutral, a real locked token
TOK_VOID_SRC = "#5A4A6A"   # color.text.primary -> the ONE shared void/AO ink -- scope now explicit:
                            # cavities + fake-AO skirt ONLY, never a lit surface's shadow band

CATEGORY_TOKENS = [
    ("reading", "#B6A0EF"), ("study", "#6FD0E8"), ("work", "#FFD066"),
    ("exercise", "#8AD3B4"), ("hobby", "#6FBFA6"), ("mind", "#FFB37A"), ("game", "#FF8FA3"),
]

PALETTE = {}  # name -> (rgb01, hexstr), printed at the end for the design note's token table


def register(name, rgb01, hexstr):
    PALETTE[name] = (rgb01, hexstr)
    return rgb01


WALL_BASE = register("wall_base", *boost(TOK_PRIMARY, s=0.48, v=0.98))
WALL_SHADOW = register("wall_shadow", *derive_shadow(WALL_BASE))
ROOF_BASE = register("roof_base", *boost(TOK_SECONDARY, s=0.32, v=0.76))
# Round-20 iteration: the first attempt at this fix (s=0.46/v=0.88) actually ran into a SECOND,
# previously-hidden collision -- roof_base and bunting_reading share the exact same hue token by
# design (see the TOK_SECONDARY comment above), and pulling roof_base's S/V close to the token also
# pulled its LOCKED-state value close to bunting_reading's own locked value (15.1 RGB, below the
# 20.0 floor -- caught by this file's own assert on the first real run, not shipped). FIX: s pulled
# down further, to essentially the token's own S (0.331), with v further from the token (0.76 instead
# of 0.88) -- still a real lift in richness over a flat pastel wash, but now with real separation from
# bunting_reading's own locked value (measured ~33 RGB, checked below) instead of a hairline pass.
# Round-20 iteration 2: pulling roof_base's S down ALSO pulled its derived shadow's S down (the
# default `derive_shadow(s_add=0.08)`), which this round's own run then found colliding with
# `void_ink` -- both are dark, low-saturation violets that happen to sit only ~13deg of hue apart
# (color.text.primary and color.secondary share a hue family in this design system), only 12.8 RGB
# apart in the locked state (asserted, caught, not shipped). FIX: roof_shadow gets its OWN, stronger
# `s_add`/`v_mult` (a real, richer "ink" darkening, not the generic default) so it clears void_ink
# with real margin instead of landing on top of it.
ROOF_SHADOW = register("roof_shadow", *derive_shadow(ROOF_BASE, v_mult=0.45, s_add=0.20))
GOLD_BASE = register("gold_base", *boost(TOK_COIN, s=0.36, v=0.94))
# Round-20 iteration: gold_base and bunting_work also share a hue token (see TOK_COIN comment above);
# s=0.36/v=0.94 sits close to the token's own S=0.600/V=1.000 (a REDUCTION in saturation, not the
# round-19 doubling) while still clearing bunting_work's locked value with real margin (measured
# below) -- found the same way as roof_base above, by checking the actual locked-state worst-case
# pairwise distance, not just the unlocked one.
GOLD_SHADOW = register("gold_shadow", *derive_shadow(GOLD_BASE, v_mult=0.60))
TRIM = register("trim", *boost(TOK_TRIM_SRC, s=0.18, v=0.99))
VOID_INK = register("void_ink", *boost(TOK_VOID_SRC, s=0.45, v=0.42))
# Round-20 [A2 TOP FIX]: round-19's structural S/V (wall s=0.75/v=1.00, roof s=0.85/v=0.68, gold
# s=0.85/v=0.88) roughly DOUBLED each token's own saturation and, for roof, crashed V from the
# token's 0.937 down to 0.68 -- a pastel lavender token rendered as deep indigo (review finding 3,
# -5). The design system pins this project's frame as cozy-pastel and NAMES "neon-dark" as the exact
# drift to avoid (00-art-design-system.md); "structural = full recolor freedom" was never licence to
# leave that frame. FIX: hue stays exact (unchanged policy) but S is capped to a modest lift over each
# token's own S (wall 0.380->0.48, roof 0.331->0.46, gold 0.600->0.55 -- gold's target is actually
# BELOW round-19's push, closer to the token) and V stays within ~0.10 of the token's own V (wall
# 1.00->0.98, roof 0.937->0.88, gold 1.00->0.86) instead of being re-authored freely. Verified below:
# roof_base now measures S=0.46/V=0.88 (was S=0.85/V=0.68) -- inside the cozy-pastel band the roof
# token itself sits in, not the neon-dark drift.
print(f"[diagnostic] structural palette vs source token S/V (round-20 fix, A2 top fix): "
      f"wall_base S/V={colorsys.rgb_to_hsv(*WALL_BASE)[1]:.3f}/{colorsys.rgb_to_hsv(*WALL_BASE)[2]:.3f} "
      f"vs color.primary S/V={colorsys.rgb_to_hsv(*hex_to_01(TOK_PRIMARY))[1]:.3f}/"
      f"{colorsys.rgb_to_hsv(*hex_to_01(TOK_PRIMARY))[2]:.3f}; "
      f"roof_base S/V={colorsys.rgb_to_hsv(*ROOF_BASE)[1]:.3f}/{colorsys.rgb_to_hsv(*ROOF_BASE)[2]:.3f} "
      f"vs color.secondary S/V={colorsys.rgb_to_hsv(*hex_to_01(TOK_SECONDARY))[1]:.3f}/"
      f"{colorsys.rgb_to_hsv(*hex_to_01(TOK_SECONDARY))[2]:.3f}")

# Round-20 [A2 fix]: `hobby` and `exercise` sit only ~7deg of hue apart and both clamp to the SAME
# default s_target=0.68 under the bunting policy -- their only remaining separation axis (V, S both
# otherwise equal) was closed off entirely once the round-19 `v_delta` hack (which broke the bunting
# policy's own "value locked" rule -- review finding 5) was removed above. FIX: per-category
# `s_target` overrides -- both categories' saturation is still only ever RAISED from their own source
# token (never lowered), hue and value stay bit-for-bit identical to the token for every category,
# no exceptions. hobby gets the band's max lift (0.85) and exercise stays near the band floor (0.62),
# which by itself restores real separation (measured below, asserted, not just printed).
BUNTING_S_TARGET = {"hobby": 0.85, "exercise": 0.62}
BUNTING = {}
for cat, hexv in CATEGORY_TOKENS:
    BUNTING[cat] = register(f"bunting_{cat}", *bunting_boost(hexv, s_target=BUNTING_S_TARGET.get(cat, 0.68)))

print("[diagnostic] palette (round 14, 8 structural incl. 3 derived-shadow pairs + 7 bunting = 15 "
      "distinct pixel values -- see design note SS2 for why this is an honest count against the "
      "brief's 'base hues' cap, not an attempt to hide it):")
for name, (_, hx) in PALETTE.items():
    print(f"  {name}: {hx}")
print(f"[diagnostic] total distinct authored pixel colours: {len(PALETTE)}; "
      f"base/dominant hues (excl. derived shadow bands): "
      f"{len(PALETTE) - 3} (wall/roof/gold each contribute 1 base + 1 derived shadow)")


def _rgb_dist(hex_a, hex_b):
    a = mathutils.Vector([int(hex_a.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)])
    b = mathutils.Vector([int(hex_b.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)])
    return (a - b).length


print("[diagnostic] category collision separations (RGB Euclidean):")
print(f"  roof_base vs bunting_reading: {_rgb_dist(PALETTE['roof_base'][1], PALETTE['bunting_reading'][1]):.1f}")
print(f"  gold_base vs bunting_work: {_rgb_dist(PALETTE['gold_base'][1], PALETTE['bunting_work'][1]):.1f}")
# Round-20 [A2 fix, real check not just a print]: exercise/hobby is the pair this file's own
# diagnostics have found closest twice now (round-14: collapsed to 21.2 RGB when a v_delta hack was
# dropped). The BUNTING_S_TARGET override above is the actual fix; assert it here with a real margin
# instead of only printing the number, so a future regression fails the build, not the next review.
MIN_BUNTING_PAIR_SEP = 35.0
_ex_hobby_sep = _rgb_dist(PALETTE["bunting_exercise"][1], PALETTE["bunting_hobby"][1])
print(f"  bunting_exercise vs bunting_hobby: {_ex_hobby_sep:.1f} (floor={MIN_BUNTING_PAIR_SEP}, "
      f"hue+value both LOCKED to token for both categories -- separation is saturation-only)")
assert _ex_hobby_sep >= MIN_BUNTING_PAIR_SEP, (
    f"bunting_exercise/bunting_hobby only {_ex_hobby_sep:.1f} RGB apart -- fail fast, before shipping "
    f"a garland where two category flags read as the same colour")
print(f"  bunting_exercise vs bunting_hobby: {_rgb_dist(PALETTE['bunting_exercise'][1], PALETTE['bunting_hobby'][1]):.1f}")
print(f"  wall_base vs wall_shadow: {_rgb_dist(PALETTE['wall_base'][1], PALETTE['wall_shadow'][1]):.1f} (same-hue pair)")
print(f"  roof_base vs roof_shadow: {_rgb_dist(PALETTE['roof_base'][1], PALETTE['roof_shadow'][1]):.1f} (same-hue pair)")
print(f"  gold_base vs gold_shadow: {_rgb_dist(PALETTE['gold_base'][1], PALETTE['gold_shadow'][1]):.1f} (same-hue pair)")

# ---------------------------------------------------------------------------
# 1. Clear scene
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for block_type in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights,
                    bpy.data.curves, bpy.data.worlds):
    for block in list(block_type):
        if block.users == 0:
            block_type.remove(block)

# ---------------------------------------------------------------------------
# 2. Flat material factory -- BARE EMISSION for the render path (unchanged from round 13, not a
#    finding this round: an Emission closure cannot reflect/receive light from a neighbour, by
#    definition, so it stays the render-time approach; only the COLOUR each material carries changed).
# ---------------------------------------------------------------------------

_mat_cache = {}
_mat_rgb = {}
_mat_emit_node = {}  # name -> the Emission node OBJECT itself, captured at creation time.
                      # ROUND-16 BUGFIX: this Blender install's UI language is Korean, so a
                      # ShaderNodeEmission's default `.name` is the localized label ("방출"),
                      # NOT the English string "Emission" -- every `nodes.get("Emission")` lookup in
                      # this file was silently returning None. That is the actual root cause of the
                      # locked-state render being a byte-identical no-op against the hero render (the
                      # SS7b color-swap loop's body never ran because `emit is None` short-circuited
                      # it via `continue`, on every single material, every round -- confirmed by a
                      # minimal isolated repro this round, not assumed). FIX: never look up a node by
                      # name again; keep a direct object reference from the moment it's created.


def flat_material(name, rgb01):
    if name in _mat_cache:
        return _mat_cache[name]
    lin = tuple(srgb_to_linear(c) for c in rgb01) + (1.0,)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = lin
    emit.inputs["Strength"].default_value = 1.0
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    _mat_cache[name] = mat
    _mat_rgb[name] = rgb01
    _mat_emit_node[name] = emit
    return mat


def add_bevel(obj, width=0.09, segments=4):
    """Round-14 fix item 11c: width/segments roughly doubled from round 13 so rounding is a real,
    visible signal at 1400px (the brief's own words: 'the single biggest cute signal'), not a
    ~6px hairline."""
    try:
        mod = obj.modifiers.new("Round", "BEVEL")
        mod.width = width
        mod.segments = segments
        mod.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError as e:
        print(f"Bevel skipped for {obj.name}: {e}")


def assign_bands(obj, mat_base, mat_shadow, mat_corner=None, corner_frac=0.16, ao_world_z=None):
    """Hard-edged flat value bands by face normal: bevel facets (small relative face AREA) ->
    mat_corner (trim highlight); faces below ao_world_z (fake AO skirt, no separate geometry) ->
    mat_shadow; faces whose normal points away from the fixed 'lit corner' -> mat_shadow; everything
    else -> mat_base. mat_shadow is ALWAYS the same-hue derived shadow for this specific surface
    (round-14 top fix) -- never a foreign shared ink.

    Round-20 [A2 fix]: the lit test used to be `(n.x + n.y) > 0.25`, which ignores normal.z entirely
    -- a pure top-facing face (0,0,1) scores exactly 0 and always fell into mat_shadow. That is
    LITERALLY the design system's own face ladder inverted (00-art-design-system.md SS3.1: top faces
    are the BRIGHTEST tier, not the darkest) -- review finding 4 measured the plaza's own TOP face
    rendering as Wall_Shadow while its front face was the lightest Wall_Base. This 2-band toon system
    still can't reproduce SS3.1's full 3-tier ladder (top/front/side each a separate lightness) without
    a third material on every hand-built surface -- see the design note SS2b for the explicit
    reconciliation -- but it MUST NOT invert the ladder's direction. FIX: the lit test now includes a
    strongly-weighted normal.z term so a genuinely top-facing surface always resolves to the LIT
    (base) material, matching SS3.1's "top is brightest" rule directionally even in a 2-band system."""
    obj.data.materials.clear()
    slots = [mat_base, mat_shadow]
    corner_idx = None
    if mat_corner is not None:
        slots.append(mat_corner)
        corner_idx = len(slots) - 1
    for m in slots:
        obj.data.materials.append(m)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    areas = [f.calc_area() for f in bm.faces]
    max_area = max(areas) if areas else 1.0
    mw = obj.matrix_world
    for f, area in zip(bm.faces, areas):
        n = f.normal
        if ao_world_z is not None and (mw @ f.calc_center_median()).z < ao_world_z:
            f.material_index = 1
            continue
        if corner_idx is not None and area < max_area * corner_frac:
            f.material_index = corner_idx
            continue
        f.material_index = 0 if (n.x + n.y + n.z * 1.3) > 0.35 else 1
    bm.to_mesh(obj.data)
    bm.free()


def assert_top_face_lit(obj, name):
    """Round-20 [A2 fix, mechanically checked]: pick the face with the highest world-Z centre on OBJ
    and assert it resolved to material slot 0 (the LIT/base material, index 0 in every assign_bands()
    call) -- the direct, checkable version of "the top face must not be the darkest band" (review
    finding 4), run on the actual mesh data, not eyeballed from a render."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    mw = obj.matrix_world
    top_face = max(bm.faces, key=lambda f: (mw @ f.calc_center_median()).z)
    idx = top_face.material_index
    slot_name = obj.data.materials[idx].name if obj.data.materials else "?"
    print(f"[diagnostic] top-face-lit check ({name}): topmost face material_index={idx} "
          f"({slot_name}) -> {'OK (lit/base)' if idx == 0 else 'INVERTED (shadow)'}")
    bm.free()
    assert idx == 0, (
        f"{name}'s topmost face resolved to material slot {idx} (shadow), not 0 (lit/base) -- "
        f"the design system's own face ladder (SS3.1: top is brightest) is inverted; fail fast")


def assign_bands_by_azimuth(obj, mat_base, mat_shadow, light_deg=45, half_width_deg=100):
    """Round-20 [A2 fix]: a clean 2-band split for a REVOLVE-SYMMETRIC mesh (the PolyHaven vase),
    classifying by each face's own centroid AZIMUTH ANGLE around the object's local Z axis instead of
    its normal. A heavily decimated lathe-revolved solid has locally noisy face normals near tight
    curvature (the neck) even though its surface POSITION still varies smoothly and monotonically in
    azimuth -- so this produces exactly one contiguous seam line, not the scattered "fan of long thin
    triangular slivers" the normal-based test produced there (review finding 6). Object must have no
    rotation applied (true for this accent -- checked below) so local axes line up with the light
    direction used everywhere else in this file."""
    assert tuple(round(c, 4) for c in obj.rotation_euler) == (0.0, 0.0, 0.0), (
        f"{obj.name} has a non-zero rotation -- azimuth banding assumes local axes == world axes")
    obj.data.materials.clear()
    obj.data.materials.append(mat_base)
    obj.data.materials.append(mat_shadow)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    light = math.radians(light_deg)
    half = math.radians(half_width_deg)
    n_lit = 0
    for f in bm.faces:
        c = f.calc_center_median()
        az = math.atan2(c.y, c.x)
        d = math.atan2(math.sin(az - light), math.cos(az - light))  # signed angular distance, wrapped
        lit = abs(d) < half
        f.material_index = 0 if lit else 1
        n_lit += 1 if lit else 0
    n_total = len(bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    print(f"[polyhaven] {obj.name} azimuth-based band split: {n_lit}/{n_total} faces lit, "
          f"{n_total - n_lit}/{n_total} shadow (light_deg={light_deg}, half_width_deg={half_width_deg}) "
          f"-- one contiguous seam by construction, not a per-face normal test")


def add_box(name, loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def build_gem(name, radius, height, loc, mat_top, mat_bottom, sides=8):
    """Regular faceted bipyramid -- kept for the smaller beacon medallion (a badge, not the star)."""
    half_h = height / 2
    bm = bmesh.new()
    apex_top = bm.verts.new((0, 0, half_h))
    apex_bot = bm.verts.new((0, 0, -half_h))
    ring = [bm.verts.new((radius * math.cos(a), radius * math.sin(a), 0))
            for a in (i / sides * math.tau for i in range(sides))]
    for i in range(sides):
        v0, v1 = ring[i], ring[(i + 1) % sides]
        bm.faces.new((apex_top, v0, v1))
        bm.faces.new((apex_bot, v1, v0))
    data = bpy.data.meshes.new(f"{name}_mesh")
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.data.materials.append(mat_top)     # 0
    obj.data.materials.append(mat_bottom)  # 1
    for p in obj.data.polygons:
        p.material_index = 0 if p.normal.z > 0 else 1
    return obj


def roof_circumradius(collar_half, sides, overhang):
    """Round-14 bugfix (found by this round's own bbox diagnostic, not carried in from round 13):
    an N-sided regular polygon that just covers a square of half-width `collar_half` needs its
    APOTHEM (not circumradius) to equal collar_half. circumradius = apothem / cos(pi/sides). The
    original round-13 pyramid used `collar_half*sqrt(2)` -- correct ONLY for a 4-sided pyramid
    rotated 45 deg (where circumradius IS the square's own half-diagonal); reused unchanged for an
    8-sided roof this round, it overshoots badly (0.877 instead of the correct ~0.671), which is what
    produced both the oversized eave overhang AND the bunting-occlusion-risk warning below."""
    return collar_half / math.cos(math.pi / sides) + overhang


def build_bell_roof(name, base_r, bulge_r, apex_h, base_z, mat_base, mat_shadow, sides=8):
    """Round-14 fix item 11a: a 3-ring bell/ogee roof profile (base ring -> outward-bulged mid ring
    -> apex point) instead of a straight 4-sided pyramid -- still ONE dominant roof shape (brief-
    compliant), but a rounder, more distinctive silhouette than a primitive cone/pyramid."""
    mid_z = base_z + apex_h * 0.42
    apex_z = base_z + apex_h
    bm = bmesh.new()
    base_ring = [bm.verts.new((base_r * math.cos(a), base_r * math.sin(a), base_z))
                 for a in (i / sides * math.tau for i in range(sides))]
    mid_ring = [bm.verts.new((bulge_r * math.cos(a), bulge_r * math.sin(a), mid_z))
                for a in (i / sides * math.tau for i in range(sides))]
    apex = bm.verts.new((0, 0, apex_z))
    for i in range(sides):
        i2 = (i + 1) % sides
        bm.faces.new((base_ring[i], base_ring[i2], mid_ring[i2], mid_ring[i]))
        bm.faces.new((mid_ring[i], mid_ring[i2], apex))
    data = bpy.data.meshes.new(f"{name}_mesh")
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    add_bevel(obj, width=0.05, segments=3)
    assign_bands(obj, mat_base, mat_shadow, corner_frac=0.10)
    return obj, apex_z


# ---------------------------------------------------------------------------
# 3. Squat/chibi massing. Every body-segment ratio (height / footprint width) is 0.6-0.9 per the
#    brief; overall height still reads tall via 2 stacked tiers + collar + roof + spire. Unchanged
#    proportions from round 13 (not a finding this round).
# ---------------------------------------------------------------------------

BASE_HALF, BASE_H = 1.05, 1.35     # ratio 1.35/2.10 = 0.643 -- round-14 fix: widened from 0.80/1.00
                                    # (footprint 1.60, UNDER the design system's 2x2 floor once the
                                    # old wide bunting ring -- which had been carrying the footprint
                                    # past that floor -- was replaced by an in-front garland that no
                                    # longer contributes to the plan-view footprint; see SS9 export bbox)
TOWER_HALF, TOWER_H = 0.55, 0.85   # ratio 0.85/1.10 = 0.773
COLLAR_HALF, COLLAR_H = 0.62, 0.10
AO_H = 0.12  # fake-AO skirt height at the base of each tier

plaza_top = BASE_H
tower_bottom = plaza_top
tower_top = tower_bottom + TOWER_H
tower_cz = tower_bottom + TOWER_H / 2
collar_bottom = tower_top
collar_top = collar_bottom + COLLAR_H
collar_cz = collar_bottom + COLLAR_H / 2
roof_base_z = collar_top
roof_h = COLLAR_HALF * math.tan(math.radians(48))  # ~48 deg overall pitch, brief's 40-55 deg band
SPIRE_R, SPIRE_H = 0.05, 0.23  # round-19: trimmed from 0.30 (also shrinks the vase, scaled off this --
                                # see LANTERN_SCALE_VS_SPIRE) to close most of the sprite-budget
                                # overage (review finding 6: 444px vs a documented 400px canvas)
FINIAL_R_OUTER, FINIAL_R_INNER = 0.13, 0.055

mat_wall = flat_material("Wall_Base", WALL_BASE)
mat_wall_sh = flat_material("Wall_Shadow", WALL_SHADOW)
mat_roof = flat_material("Roof_Base", ROOF_BASE)
mat_roof_sh = flat_material("Roof_Shadow", ROOF_SHADOW)
mat_trim = flat_material("Trim", TRIM)
mat_gold = flat_material("Gold_Base", GOLD_BASE)
mat_gold_sh = flat_material("Gold_Shadow", GOLD_SHADOW)
mat_void = flat_material("Void_Ink", VOID_INK)

# Plaza tier -- round-20 [A1 fix]: round-19's plaza was ONE box (footprint 2.10x2.10, height 1.35)
# with a hairline-proud trim belt (+0.01 overhang) and thin pilasters -- review finding 2 read it as
# "a lidded chest/jewelry box, not a monument plinth". FIX: a real 3-step stone-plinth profile --
# a wide low PLINTH (proud footprint, short) -> the recessed pink PLAZA wall (unchanged total tier
# height, carved from the same BASE_H budget so nothing below cascades) -> a proud COPING cap lip at
# the top edge -- plus the existing belt/pilasters, both made genuinely bulky (proud depth, not a
# hairline) instead of edge-of-frame trim. Total tier height is still exactly BASE_H (plinth height is
# SUBTRACTED from the plaza box, not added on top), so tower_bottom/collar/roof/garland-clearance
# maths below are all untouched.
PLINTH_H, PLINTH_OVERHANG = 0.16, 0.11
COPING_H, COPING_OVERHANG = 0.08, 0.06

plinth = add_box("Landmark_Plinth", (0, 0, PLINTH_H / 2),
                  (BASE_HALF * 2 + PLINTH_OVERHANG * 2, BASE_HALF * 2 + PLINTH_OVERHANG * 2, PLINTH_H))
add_bevel(plinth, width=0.03, segments=3)
plinth.data.materials.append(mat_trim)

# Round-20 bugfix (found by inspecting the actual rendered pixels, not the code -- the "grain" on the
# plaza top in landmark_toon_hero.png was NOT renderer noise, it was real Z-FIGHTING: the coping cap
# below is defined to sit flush with the top of the whole tier at world Z=BASE_H, but this box's
# height was only ever reduced by PLINTH_H, leaving it ALSO reaching all the way up to BASE_H --
# coping's top face and plaza's top face were literally coincident over the coping's full footprint,
# and Cycles picks whichever coincident surface wins the depth test essentially at random per sample.
# FIX: subtract COPING_H too, so the plaza box's own top sits flush with the coping's UNDERSIDE, not
# fighting its top face.
plaza_h = BASE_H - PLINTH_H - COPING_H
plaza = add_box("Landmark_Plaza", (0, 0, PLINTH_H + plaza_h / 2), (BASE_HALF * 2, BASE_HALF * 2, plaza_h))
add_bevel(plaza)
assign_bands(plaza, mat_wall, mat_wall_sh, mat_corner=mat_trim, ao_world_z=PLINTH_H + AO_H)
assert_top_face_lit(plaza, "Landmark_Plaza")

coping = add_box("Landmark_Coping", (0, 0, BASE_H - COPING_H / 2),
                  (BASE_HALF * 2 + COPING_OVERHANG * 2, BASE_HALF * 2 + COPING_OVERHANG * 2, COPING_H))
add_bevel(coping, width=0.02, segments=3)
coping.data.materials.append(mat_trim)

# Tower body -- footprint 1.10x1.10, height 0.85, setback from the plaza.
tower = add_box("Landmark_Tower", (0, 0, tower_cz), (TOWER_HALF * 2, TOWER_HALF * 2, TOWER_H))
add_bevel(tower)
assign_bands(tower, mat_wall, mat_wall_sh, mat_corner=mat_trim, ao_world_z=tower_bottom + AO_H)
assert_top_face_lit(tower, "Landmark_Tower")

# Eave collar -- a light-neutral fascia band between the tower and the roof (small accent).
collar = add_box("Landmark_Collar", (0, 0, collar_cz), (COLLAR_HALF * 2, COLLAR_HALF * 2, COLLAR_H))
add_bevel(collar, width=0.05, segments=3)
collar.data.materials.append(mat_trim)

# Roof cap -- bell/ogee profile (round-14 fix item 11a), the single dominant silhouette shape.
ROOF_SIDES = 8
ROOF_OVERHANG = 0.05
roof_base_r = roof_circumradius(COLLAR_HALF, ROOF_SIDES, ROOF_OVERHANG)  # ~0.721, apothem-correct
roof, roof_apex_z = build_bell_roof(
    "Landmark_Roof", base_r=roof_base_r, bulge_r=roof_base_r * 1.14, apex_h=roof_h,
    base_z=roof_base_z, mat_base=mat_roof, mat_shadow=mat_roof_sh, sides=ROOF_SIDES)

# Spire + gold beacon lantern (round-16: a real PolyHaven mesh, see import_lantern_beacon() below --
# not a primitive) -- the "+1 accent" (00-art-design-system.md SS3.3's "one more block").
SPIRE_EMBED = 0.05  # embeds INTO the roof's solid volume -- avoids the zero-area apex-contact gap
                     # that isolated the spire as a disconnected island in round 12 (fixed then, kept)
spire_top_z = roof_apex_z + SPIRE_H
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=SPIRE_R, depth=SPIRE_H + SPIRE_EMBED,
                                     location=(0, 0, roof_apex_z + SPIRE_H / 2 - SPIRE_EMBED / 2))
spire = bpy.context.active_object
spire.name = "Landmark_Spire"
spire.data.materials.append(mat_trim)

def _mesh_connected_components(obj):
    """Split OBJ (in place, via bmesh) is not what this does -- it COUNTS loose shell components
    without mutating the mesh, using a simple flood-fill over face adjacency (stdlib only, no new
    dependency). Returns a list of components, each a list of bmesh face indices."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    visited = [False] * len(bm.faces)
    components = []
    for start in range(len(bm.faces)):
        if visited[start]:
            continue
        stack, comp = [start], []
        visited[start] = True
        while stack:
            fi = stack.pop()
            comp.append(fi)
            f = bm.faces[fi]
            for e in f.edges:
                for lf in e.link_faces:
                    if not visited[lf.index]:
                        visited[lf.index] = True
                        stack.append(lf.index)
        components.append(comp)
    face_areas = [f.calc_area() for f in bm.faces]
    bm.free()
    return components, face_areas


def import_lantern_beacon(loc, target_height, mat_base, mat_shadow, mat_corner):
    """Round-18 [TOP FIX, A1/A2/A5]: import the real PolyHaven VASE mesh (see VASE_SRC_PATH note
    above -- swapped from the wiry "Lantern_01" that shattered under every decimation strategy tried
    in rounds 16-17) and simplify it into a clean, closed, low-facet toon accent. Unlike rounds 16-17,
    this pass REJECTS a bad simplification instead of shipping it: after weld+decimate, it counts
    connected shell components and rejects any face below a minimum-area floor, and hard-fails the
    build (not a silent fallback) if either check finds debris -- the brief's explicit instruction
    ("fail the build if found"), not disclosed-and-shipped-anyway."""
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.fbx(filepath=VASE_SRC_PATH)
    after = set(bpy.data.objects.keys())
    imported = [bpy.data.objects[n] for n in (after - before) if bpy.data.objects[n].type == "MESH"]
    assert len(imported) == 1, f"expected exactly 1 imported mesh object, got {len(imported)}"
    obj = imported[0]
    obj.name = "Landmark_BeaconUrn"
    obj.data.materials.clear()  # defensive: the exported FBX carries no textures/materials, but
                                 # some FBX round-trips add a default slot -- strip it explicitly
                                 # so the recolor below is never contaminated by a leftover PBR hue.

    src_poly_count = len(obj.data.polygons)

    # Pass 1: weld coincident verts (closes any cracks the source mesh export left) and dissolve
    # genuinely degenerate/near-zero-area geometry BEFORE any decimation touches it -- doing this
    # first is what stops COLLAPSE from having degenerate seed geometry to shatter in the first place.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0006)
    bmesh.ops.dissolve_degenerate(bm, dist=0.0006, edges=bm.edges)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(18), verts=bm.verts, edges=bm.edges)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    planar_poly_count = len(obj.data.polygons)

    FACE_BUDGET = 130
    if planar_poly_count > FACE_BUDGET:
        dec = obj.modifiers.new("Blockify", "DECIMATE")
        dec.decimate_type = "COLLAPSE"
        dec.ratio = min(1.0, FACE_BUDGET / planar_poly_count)
        dec.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=dec.name)

    # Pass 2: post-decimate cleanup -- COLLAPSE can leave micro-cracks AND the odd small sliver
    # triangle at a collapse seam; weld progressively harder (bounded loop) until none remain, so the
    # guard checks below see the mesh's REAL, clean topology, not artifacts of the collapse itself.
    for _weld_dist in (0.001, 0.002, 0.004, 0.008):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=_weld_dist)
        bmesh.ops.dissolve_degenerate(bm, dist=_weld_dist, edges=bm.edges)
        areas_now = [f.calc_area() for f in bm.faces]
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        max_a = max(areas_now) if areas_now else 1.0
        n_tiny = sum(1 for a in areas_now if a < max_a * 0.0015)
        if n_tiny == 0:
            break
    decimated_poly_count = len(obj.data.polygons)

    # GUARD 1 [brief: "check for >1 connected component ... fail the build if found"]: a solid
    # lathe-revolved source mesh should decimate into exactly ONE closed shell. If COLLAPSE detached
    # any debris (the round-16/17 failure class), this mesh will have >1 component -- fail loud here,
    # BEFORE spending a render on it, instead of silently keeping the largest piece.
    components, face_areas = _mesh_connected_components(obj)
    n_components = len(components)
    print(f"[polyhaven] Landmark_BeaconUrn connected-component check: {n_components} shell(s) "
          f"({[len(c) for c in components]} faces each)")
    assert n_components == 1, (
        f"decimated accent mesh split into {n_components} disconnected shell(s) -- this is exactly "
        f"the round-16/17 'floating shard' failure class; fail fast instead of shipping a shattered "
        f"silhouette. Re-tune weld distance / dissolve angle, do not ship this result.")

    # GUARD 2 [brief: "check ... for faces below a minimum area"]: a degenerate sliver face (the
    # round-17 hairline-handle symptom) has near-zero area relative to the mesh's own largest face.
    max_area = max(face_areas) if face_areas else 1.0
    MIN_AREA_FRAC = 0.0015  # a real face must be at least 0.15% of the mesh's largest face's area
    tiny_faces = [a for a in face_areas if a < max_area * MIN_AREA_FRAC]
    print(f"[polyhaven] Landmark_BeaconUrn degenerate-face check: {len(tiny_faces)}/{len(face_areas)} "
          f"faces below {MIN_AREA_FRAC*100:.3f}% of the largest face's area "
          f"(max_area={max_area:.6f})")
    assert len(tiny_faces) == 0, (
        f"{len(tiny_faces)} degenerate sliver face(s) survived simplification -- this is exactly the "
        f"round-17 'hairline handle ribbon' failure class; fail fast instead of shipping slivers.")

    zs = [v.co.z for v in obj.data.vertices]
    src_height = (max(zs) - min(zs)) if zs else 1.0
    scale = target_height / src_height
    obj.scale = (scale, scale, scale)
    obj.location = (loc[0], loc[1], loc[2] - min(zs) * scale)  # bottom of the mesh sits at loc.z
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Round-19 [A2 fix]: mat_corner dropped for this mesh -- assign_bands()'s corner/highlight pass
    # selects faces by RELATIVE AREA, which read as a jack-o'-lantern zigzag on this mesh's irregular
    # decimated facets (review findings 5/14). Round-20 [A2 fix]: swapping to assign_bands()'s own
    # NORMAL-based 2-band split (what round 19 did instead) turned out to have the same root cause one
    # level down -- a heavily decimated organic mesh has locally noisy face NORMALS near tight
    # curvature (the vase neck), so the normal test also fragmented into "a fan of long thin
    # triangular slivers" there (review finding 6). FIX: `assign_bands_by_azimuth()` below classifies
    # by each face's own CENTROID position angle around the mesh's vertical axis, not its normal --
    # position on a lathe-revolved solid is stable and monotonic in azimuth even after heavy
    # simplification, so this produces exactly ONE clean contiguous seam, the same "clean 2-band
    # split" guarantee every hand-built surface gets, without inheriting normal noise.
    assign_bands_by_azimuth(obj, mat_base, mat_shadow)

    world_zs = [(obj.matrix_world @ v.co).z for v in obj.data.vertices]
    bbox = (min(world_zs), max(world_zs))
    print(f"[polyhaven] Landmark_BeaconUrn placed at {tuple(round(c, 4) for c in obj.location)}, "
          f"scale={scale:.4f} (target_height={target_height}, source_height={src_height:.4f}); "
          f"simplified {src_poly_count} -> {planar_poly_count} (weld+dissolve) -> "
          f"{decimated_poly_count} polygons (final), 1 clean closed shell, 0 degenerate faces; "
          f"world Z bbox={tuple(round(b,4) for b in bbox)}")
    return obj, bbox


# Round-18: the PolyHaven-derived accent (now the vase/urn body -- see import_lantern_beacon()'s
# docstring for the source-asset swap) scaled to a real multiple of the spire's own height (round-16's
# FINIAL_R_OUTER*2.6=0.338 rendered as a ~30px gold speck at hero framing and vanished entirely at
# village scale -- finding A1/A5). ~3x the spire makes it the dominant silhouette element it's meant
# to read as, the round's actual signature move, not an afterthought accent. Names below keep the
# LANTERN_* prefix from rounds 16-17 for diff-minimality; the object itself is the urn (see docstring).
LANTERN_SCALE_VS_SPIRE = 2.3  # round-19: trimmed from 3.0 -- shrinks the total model height (helps
                               # both the frame-fit fix below and the sprite-budget overage, review
                               # finding 6) while keeping the vase clearly the dominant accent (2.3x
                               # the spire is still much larger than every other single accent piece)
FINIAL_TARGET_H = SPIRE_H * LANTERN_SCALE_VS_SPIRE
finial, LANTERN_WORLD_BBOX_Z = import_lantern_beacon(
    (0, 0, spire_top_z), FINIAL_TARGET_H, mat_gold, mat_gold_sh, mat_trim)
LANTERN_CENTER_Z = sum(LANTERN_WORLD_BBOX_Z) / 2
LANTERN_HEIGHT = LANTERN_WORLD_BBOX_Z[1] - LANTERN_WORLD_BBOX_Z[0]

# Round-19 [A1 TOP FIX]: the model's REAL total height, measured now (not assumed), used below to size
# every full-silhouette camera. Round-18's hero/side_bands/front_openings ortho_scale+aim_z pairs were
# carried over unchanged from round 17 and clipped the vase in 3 of the review's 9 renders (review
# finding 1, e.g. hero: ortho_scale=4.6, aim_z=1.45 -> top edge at 1.45+2.3=3.75, well under the
# model's real 4.189-unit height) -- the vertical half-extent the frame covers was never checked
# against the model's own top. FIX: compute the real bbox top now and derive every full-body camera's
# aim_z/ortho_scale FROM it, with a real, checked margin, instead of a hand-picked constant.
MODEL_TOP_Z = LANTERN_WORLD_BBOX_Z[1]
MODEL_TOTAL_H = MODEL_TOP_Z  # base sits at world Z=0 (plaza bottom), so total height == the top Z
MODEL_CENTER_Z = MODEL_TOTAL_H / 2.0
print(f"[diagnostic] real model bbox: base_z=0.0, top_z={MODEL_TOP_Z:.4f}, total_h={MODEL_TOTAL_H:.4f} "
      f"-- every full-silhouette camera view below sizes itself from this measured height, not a "
      f"hand-picked constant.")

# ---------------------------------------------------------------------------
# 3b. Originality accent -- unchanged concept from round 13 (not a finding this round): a hanging
#     achievement bell on a bracket arm off the tower's -X face, embedded into the tower wall so
#     there is no possible gap between prop and body at any angle.
# ---------------------------------------------------------------------------

ARM_LEN, ARM_T = 0.30, 0.06
ARM_EMBED = 0.05
# Round-17 [A1 fix]: round-16 had ARM_Z = tower_top - 0.16, leaving only 0.065 world units between
# the bell's own top and the lowest bunting flag's bottom -- collapsed under camera elevation
# foreshortening into a real screen-space overlap (round-16 review finding 5: "cyan/green flags
# interpenetrate the hanging gold bell"). FIX: moved down into the tower's lower-middle body, with a
# real, asserted clearance from the flag band (checked below once the garland is built).
ARM_Z = tower_bottom + 0.45
arm_inner_x = -TOWER_HALF + ARM_EMBED
arm_outer_x = arm_inner_x - ARM_LEN
arm_cx = (arm_inner_x + arm_outer_x) / 2
arm = add_box("Landmark_BellArm", (arm_cx, 0.0, ARM_Z), (ARM_LEN, ARM_T, ARM_T))
add_bevel(arm, width=0.02, segments=3)
arm.data.materials.append(mat_trim)

BELL_R_TOP, BELL_R_BOTTOM, BELL_H = 0.075, 0.155, 0.26
bell_top_z = ARM_Z - ARM_T / 2 - 0.015
bell_cz = bell_top_z - BELL_H / 2
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=BELL_R_BOTTOM, radius2=BELL_R_TOP,
                                 depth=BELL_H, location=(arm_outer_x, 0.0, bell_cz))
bell = bpy.context.active_object
bell.name = "Landmark_Bell"
add_bevel(bell, width=0.015, segments=3)
bell.data.materials.clear()
bell.data.materials.append(mat_gold)     # 0
bell.data.materials.append(mat_gold_sh)  # 1 -- the bell's mouth/underside (same-hue shadow now)
bell_bottom_z = bell_cz - BELL_H / 2
for p in bell.data.polygons:
    center_z = bell.matrix_world @ p.center
    p.material_index = 1 if center_z.z < bell_bottom_z + 0.05 else 0

# ---------------------------------------------------------------------------
# 4. Openings -- 4 total (brief: 2-4 max), all on the FRONT (+Y) wall so a single frontal camera sees
#    every one face-on. Unchanged geometry from round 13 (not a finding this round); voids now use
#    the explicitly-scoped `mat_void` (same colour, renamed for clarity -- see SS0).
# ---------------------------------------------------------------------------

FRAME_T, VOID_T, DECAL_GAP = 0.025, 0.025, 0.006
FRAME_PROUD = FRAME_T / 2
DECAL_PROUD = FRAME_T + DECAL_GAP + VOID_T / 2


def add_arch_decal(name, wall_y, width, rect_h, bottom_z, mat, proud, margin=0.0, thick=FRAME_T):
    w, h = width + margin * 2, rect_h + margin
    y = wall_y + proud
    box = add_box(f"{name}_Jambs", (0, y, bottom_z + h / 2), (w, thick, h))
    r = w / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r, depth=thick, location=(0, y, bottom_z + h))
    crown = bpy.context.active_object
    crown.name = f"{name}_Crown"
    crown.rotation_euler = (math.pi / 2, 0, 0)
    for obj in (box, crown):
        obj.data.materials.append(mat)
    return [box, crown]


def add_rounded_rect_decal(name, wall_y, center_x, center_z, w, h, mat_frame, mat_void,
                            margin=0.05, bevel_w=0.016):
    fw, fh = w + margin * 2, h + margin * 2
    frame = add_box(f"{name}_Frame", (center_x, wall_y + FRAME_PROUD, center_z), (fw, FRAME_T, fh))
    add_bevel(frame, width=bevel_w, segments=3)
    frame.data.materials.append(mat_frame)
    void = add_box(f"{name}_Void", (center_x, wall_y + DECAL_PROUD, center_z), (w, VOID_T, h))
    add_bevel(void, width=bevel_w * 0.7, segments=3)
    void.data.materials.append(mat_void)
    return [frame, void]


DOOR_W, DOOR_RECT_H = 0.42, 0.30
DOOR_BOTTOM_Z = tower_bottom + 0.05
add_arch_decal("Door_Frame", TOWER_HALF, DOOR_W, DOOR_RECT_H, DOOR_BOTTOM_Z, mat_trim,
                FRAME_PROUD, margin=0.035, thick=FRAME_T)
add_arch_decal("Door_Void", TOWER_HALF, DOOR_W, DOOR_RECT_H, DOOR_BOTTOM_Z, mat_void, DECAL_PROUD,
                thick=VOID_T)
door_apex_z = DOOR_BOTTOM_Z + DOOR_RECT_H + DOOR_W / 2

WIN_W, WIN_H = 0.22, 0.26
WIN_X = 0.40
assert WIN_X - WIN_W / 2 > DOOR_W / 2 + 0.035, "tower window overlaps the door frame margin"
win_z = tower_cz
add_rounded_rect_decal("Window_Right", TOWER_HALF, WIN_X, win_z, WIN_W, WIN_H, mat_trim, mat_void)
add_rounded_rect_decal("Window_Left", TOWER_HALF, -WIN_X, win_z, WIN_W, WIN_H, mat_trim, mat_void)

PLAZA_WIN_W, PLAZA_WIN_H = 0.34, 0.34
add_rounded_rect_decal("Window_Plaza", BASE_HALF, 0.0, plaza_top * 0.5, PLAZA_WIN_W, PLAZA_WIN_H,
                        mat_trim, mat_void)
opening_top_max = max(door_apex_z, win_z + WIN_H / 2)

# Round-19 [A1 fix], round-20 BEEFED UP [A1 fix, review finding 2]: round-19's belt/pilasters were
# real geometry but proud by only ~0.005-0.017 world units -- at 1400px that resolves to "a thin
# horizontal cream line plus corner edging at the extreme box edges", read as a lidded-chest seam, not
# architectural relief. The plinth/coping above already break the box silhouette; these two go from
# hairline trim to genuinely bulky proud elements (belt height 0.05->0.11, overhang 0.005->0.06;
# pilaster width 0.10->0.18, proud depth 0.025->0.08 -- a real, light-catching corner post, not an
# edge outline) so the tier reads as a plinth with real applied ornament, not a plain box with a seam.
PLAZA_BELT_H, PLAZA_BELT_OVERHANG = 0.11, 0.06
plaza_belt_z = plaza_top * 0.74  # above the window, below the tower setback line
plaza_belt = add_box("Landmark_PlazaBelt", (0, 0, plaza_belt_z),
                      (BASE_HALF * 2 + PLAZA_BELT_OVERHANG * 2, BASE_HALF * 2 + PLAZA_BELT_OVERHANG * 2,
                       PLAZA_BELT_H))
add_bevel(plaza_belt, width=0.02, segments=2)
plaza_belt.data.materials.append(mat_trim)

PLAZA_PILASTER_W, PLAZA_PILASTER_T = 0.18, 0.08
_pilaster_x = BASE_HALF - PLAZA_PILASTER_W / 2 - 0.06
_pilaster_z0, _pilaster_z1 = PLINTH_H + 0.02, BASE_H - COPING_H - 0.02  # spans plinth top -> coping
                                                                          # underside -- the full plaza
                                                                          # shaft, not a floating strip
_pilaster_cz = (_pilaster_z0 + _pilaster_z1) / 2
_pilaster_h = _pilaster_z1 - _pilaster_z0
for _px in (-_pilaster_x, _pilaster_x):
    pilaster = add_box(f"Landmark_PlazaPilaster_{'L' if _px < 0 else 'R'}",
                        (_px, BASE_HALF + PLAZA_PILASTER_T / 2 - 0.015, _pilaster_cz),
                        (PLAZA_PILASTER_W, PLAZA_PILASTER_T, _pilaster_h))
    add_bevel(pilaster, width=0.02, segments=2)
    pilaster.data.materials.append(mat_trim)

# ---------------------------------------------------------------------------
# 5. Gold beacon medallion -- cream trim backing disc + faceted gold gem, above the door.
# ---------------------------------------------------------------------------

MEDALLION_R = 0.11
BACKING_R = MEDALLION_R * 1.5
BACKING_THICK = 0.04
medallion_z = door_apex_z + 0.16

backing_y = TOWER_HALF + BACKING_THICK / 2 + 0.01
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=BACKING_R, depth=BACKING_THICK,
                                     location=(0, backing_y, medallion_z))
backing = bpy.context.active_object
backing.name = "Landmark_BeaconBacking"
backing.rotation_euler = (math.pi / 2, 0, 0)
backing.data.materials.append(mat_trim)

backing_far_edge = backing_y + BACKING_THICK / 2
gem_y = backing_far_edge + DECAL_GAP + MEDALLION_R
medallion = build_gem("Landmark_BeaconMedallion", MEDALLION_R, MEDALLION_R * 2.0,
                       (0, gem_y, medallion_z), mat_gold, mat_gold_sh)

# ---------------------------------------------------------------------------
# 6. Bunting -- ROUND-14 REWRITE (fix items 2/3/4/10): a single sagging garland strung between TWO
#    anchor brackets at the front-left/front-right eave corners, not a 360 deg ring. Every flag's
#    face normal is a CONSTANT (0, 1, 0) -- always facing the front camera -- so there is no
#    tangential/edge-on angle-dependence, and the whole garland lives at y > wall, permanently in
#    front of the building, so it can never be bisected by the building's own silhouette.
# ---------------------------------------------------------------------------

# Round-20 [A1 TOP FIX]: round-19's GARLAND_HALF_SPAN (=COLLAR_HALF+0.34=0.96) plus the enlarged
# FLAG_W (0.26) put the flags' own outer extent (FLAG_SPAN_HALF_EXTENT, computed below) at ~1.11 world
# units -- WIDER than the roof's own base-ring radius (roof_base_r~0.721) and even than its mid-height
# bulge (~0.822). The eave rail/ledge, sized to reach under that span, necessarily overshot the roof
# and the building's own silhouette on both ends -- "a plank skewered through the landmark" (review
# finding 1, -5, the highest-value single fix this round after the palette). FIX: the garland span AND
# flag size are both pulled back so the flags' own outer extent stays INSIDE roof_base_r with a real
# margin (asserted below, not eyeballed) -- the support geometry can then genuinely fit under the roof
# instead of needing to reach past it.
GARLAND_HALF_SPAN = 0.54
# Round-14 bugfix: GARLAND_Y must clear the FARTHEST-forward front-facing surface at the eave Z
# band, which is the roof's own base ring (roof_base_r, corrected above -- not the tower wall).
# The prior value (TOWER_HALF+0.05=0.60) sat BEHIND the collar's own front face (0.62) and well
# behind the roof base ring, which is exactly why the build's own occlusion diagnostic below flagged
# "AT RISK" on the first real run of this round's script -- caught before shipping, not asserted away.
GARLAND_Y = roof_base_r + 0.08            # standoff clearly in front of the roof base ring
GARLAND_Z = collar_top                   # eave height -- below the roof, above every opening top
assert GARLAND_Y > max(COLLAR_HALF, roof_base_r), \
    "garland must clear the roof base ring AND the collar face -- fail fast, before rendering"
SAG = 0.12  # round-18 [A1 fix]: round-17's SAG=0.05 was real but rounded to well under 1px of
            # vertical drop at any delivered render scale -- "all 7 flag tops share a single y" (review
            # finding 2). Raised to ~63% of FLAG_H (the largest value that still clears the opening-
            # clearance assert below with real margin, not tuned past it) so the droop between anchor
            # and centre flags is a real, visible multi-px curve, not a value lost to rounding.
# Round-14 bugfix, found by this round's own verify_flat_colors.py (856 real interior off-palette
# px in landmark_toon_bunting_shape_pair.png -- traced to a genuine 3D cause, not camera/AA): with
# 7 flags evenly spaced across a span, adjacent attach points are GARLAND_HALF_SPAN*2/6 apart. The
# original FLAG_W=0.30 + 2*OUTLINE_MARGIN(0.028) = 0.356 total flag width is WIDER than that spacing
# at the original GARLAND_HALF_SPAN=0.66 (spacing=0.22) -- adjacent flags physically intersected
# each other. FIX: flags shrunk to fit inside the (now also widened) spacing with a real gap.
FLAG_W, FLAG_H = 0.145, 0.16  # round-20 [A1 TOP FIX]: pulled back from round-19's 0.26x0.19 (see
                               # GARLAND_HALF_SPAN comment above -- that size, at any span wide enough
                               # to keep flags from overlapping, put the garland's own outer extent
                               # past the roofline). Still well clear of the 12px village-scale
                               # legibility floor (checked below): ~14.5x16px at the documented
                               # PPU=100, a real margin over the floor, not a hairline pass.
FLAG_THICK = 0.03
OUTLINE_MARGIN = 0.010  # round-14 fix item 10: a trim-coloured fringe on every flag, guaranteeing
                          # separation from ANY background hue, structurally, not by camera luck.
                          # Round-20: trimmed from 0.017 (proportionally, with the smaller flags above)
                          # to keep real packing margin between neighbours at the tighter span.
_flag_spacing = (GARLAND_HALF_SPAN * 2) / 6
_flag_total_w = FLAG_W + 2 * OUTLINE_MARGIN
assert _flag_total_w < _flag_spacing, \
    f"adjacent flags would intersect: total width {_flag_total_w:.3f} >= spacing {_flag_spacing:.3f}"

assert GARLAND_Z - SAG - FLAG_H - OUTLINE_MARGIN > opening_top_max + 0.05, \
    "garland's lowest point must clear every opening top with real margin"

# Round-14 fix item 4: explicit order so no two similar hues sit at symmetric offsets from centre.
# Slots -3..+3 (7 total, centre=3=work/gold). exercise(idx1,-2) vs hobby(idx4,+1): NOT mirrored
# (would need hobby at idx5/+2 to mirror -2). mind(idx5,+2) and game(idx6,+3) are placed ADJACENT
# and on the same side deliberately -- they are the CVD-simulation's closest pair (SS8/design note),
# so the dedicated bunting_shape_pair close-up can frame two physically adjacent flags instead of
# needing a huge ortho_scale to reach across the whole garland.
# Round-17 [A1 fix]: round-16 had "work" (gold, #FFCA52) at the centre slot (x=0), directly in front
# of the ALSO-centred gold beacon medallion -- the two golds read as one ambiguous shape (review
# finding 5). FIX: swapped with "study" (cyan, #4AC9E8, the hue farthest from gold) so the centre
# slot no longer collides with the medallion; every other slot/adjacency relationship named in the
# round-14 comment below (exercise/hobby not mirrored, mind/game deliberately adjacent) is unchanged.
FLAG_ORDER = ["work", "exercise", "reading", "study", "hobby", "mind", "game"]
SHAPE_BY_CAT = {"reading": 0, "study": 1, "work": 0, "exercise": 1, "hobby": 2, "mind": 1, "game": 0}

n_flags = len(FLAG_ORDER)
xs = [((-GARLAND_HALF_SPAN) + (2 * GARLAND_HALF_SPAN) * i / (n_flags - 1)) for i in range(n_flags)]


def sag_z(x):
    t = x / GARLAND_HALF_SPAN
    return GARLAND_Z - SAG * (1 - t * t)


flag_points = []  # (cat, x, z)
for cat, x in zip(FLAG_ORDER, xs):
    flag_points.append((cat, x, sag_z(x)))

# Round-17 [A1 TOP-3 fix]: round-16's two "bracket" boxes never actually reached the collar -- their
# inner X (GARLAND_HALF_SPAN - BRACKET_LEN = 0.82) sat 0.20 world units OUTSIDE COLLAR_HALF (0.62),
# so they were free-floating in space with zero touching geometry (the literal bug behind review
# finding 2's "two cream bracket posts stand free... with no visible attachment to the building").
# FIX: a single `Landmark_EaveRail` trim board, mounted FLUSH against the collar's own front face and
# entirely BELOW roof_base_z (no z-fighting with the roof), spanning the full garland width with
# margin on both ends. This is real, checkable touching geometry behind the ENTIRE flag span -- no
# flag can read as "hanging in empty black space" regardless of how wide the garland is, and the
# rail's own overlap with the collar box is the visible attachment point.
# Round-19 [A1 fix]: the rail/ledge width was derived from GARLAND_HALF_SPAN (the flags' ATTACH-POINT
# span), not their actual rendered extent -- each end flag's own half-width (FLAG_W/2+OUTLINE_MARGIN)
# sticks out past its attach point, so the two outermost flags hung ~0.07-0.15 world units past both
# the rail and the ledge below (review finding 2, measured: both rail ends unsupported over
# background in landmark_toon_front_openings.png). FIX: every support width below is derived from
# FLAG_SPAN_HALF_EXTENT -- the attach-point span PLUS the outermost flag's own half-width -- so the
# support genuinely reaches under the flags themselves, not just their attach points.
FLAG_SPAN_HALF_EXTENT = GARLAND_HALF_SPAN + FLAG_W / 2 + OUTLINE_MARGIN
EAVE_RAIL_H, EAVE_RAIL_T = 0.07, 0.05
eave_rail_z = GARLAND_Z - EAVE_RAIL_H / 2 - 0.006  # top sits just under roof_base_z -- never
                                                     # touches the roof mesh (asserted below)
assert eave_rail_z + EAVE_RAIL_H / 2 < roof_base_z, \
    "eave rail must stay entirely below the roof's own base ring -- fail fast, before rendering"
# Round-20: end-pad trimmed 0.08->0.03 (with the smaller FLAG_SPAN_HALF_EXTENT above, the rail no
# longer needs the extra margin to clear the flags -- see the roofline-containment assert below).
_RAIL_END_PAD = 0.03
eave_rail = add_box("Landmark_EaveRail",
                     (0, COLLAR_HALF + EAVE_RAIL_T / 2 - 0.012, eave_rail_z),
                     (FLAG_SPAN_HALF_EXTENT * 2 + _RAIL_END_PAD, EAVE_RAIL_T, EAVE_RAIL_H))
add_bevel(eave_rail, width=0.015, segments=2)
eave_rail.data.materials.append(mat_trim)
assert (FLAG_SPAN_HALF_EXTENT * 2 + _RAIL_END_PAD) / 2 > FLAG_SPAN_HALF_EXTENT, \
    "eave rail must reach past every flag's own outer edge, not just the attach-point span"

# Round-18 [A1 TOP FIX]: the rail above is WIDER than the collar it is nominally "mounted flush
# against" (GARLAND_HALF_SPAN*2+0.08 = 2x wider than the collar's own COLLAR_HALF*2) -- its own ends
# overshoot the collar's corners and hang unsupported over black space (review finding 2, measured:
# rail x285-1105 vs collar x490-900 in landmark_toon_front_openings.png). FIX: a real supporting
# ledge/balcony -- a flat shelf mounted flush to the TOWER WALL (the widest solid body actually
# present at this Z band) and overlapping the rail's own underside along its ENTIRE length, so there
# is real touching geometry under every flag, not just the centre. This reads as an intentional
# architectural balcony jutting from the tower, not a floating cantilever.
EAVE_LEDGE_T = 0.05
# Round-19: ledge half-width now derived from FLAG_SPAN_HALF_EXTENT (reaches under the flags' own
# outer edges), not GARLAND_HALF_SPAN (only their attach points) -- see the FLAG_SPAN_HALF_EXTENT
# comment above the eave rail for the measured failure this fixes.
_ledge_half_w = FLAG_SPAN_HALF_EXTENT + EAVE_RAIL_T / 2 + 0.02  # a real lip past the rail's own ends
                                                                   # (round-20: trimmed 0.05->0.02 --
                                                                   # see the roofline-containment
                                                                   # assert below)
_ledge_front_y = COLLAR_HALF + EAVE_RAIL_T - 0.006  # reaches at least as far forward as the rail
_ledge_depth = _ledge_front_y - TOWER_HALF + 0.02     # spans from inside the tower wall to the rail
_rail_bottom_z = eave_rail_z - EAVE_RAIL_H / 2
_ledge_top_z = _rail_bottom_z + 0.02  # overlaps 0.02 INTO the rail -- real solid contact, not a
                                        # coincident face (avoids z-fighting and camera-angle luck)
eave_ledge = add_box("Landmark_EaveLedge",
                      (0, TOWER_HALF + _ledge_depth / 2 - 0.01, _ledge_top_z - EAVE_LEDGE_T / 2),
                      (_ledge_half_w * 2, _ledge_depth, EAVE_LEDGE_T))
add_bevel(eave_ledge, width=0.02, segments=2)
eave_ledge.data.materials.append(mat_trim)
_rail_half_w = FLAG_SPAN_HALF_EXTENT + EAVE_RAIL_T / 2
print(f"[diagnostic] eave ledge support check: ledge half-width={_ledge_half_w:.3f} vs rail half-"
      f"width={_rail_half_w:.3f} vs flag outer half-extent={FLAG_SPAN_HALF_EXTENT:.3f} (ledge widest "
      f"-> real lip past both the rail's ends AND every flag's own outer edge); "
      f"ledge spans y=[{TOWER_HALF - 0.01:.3f},{_ledge_front_y:.3f}] from the tower wall to the rail")
assert _ledge_half_w > _rail_half_w > FLAG_SPAN_HALF_EXTENT, (
    "eave ledge must be wider than the rail, and the rail wider than the flags' own outer extent -- "
    "fail fast, before rendering a flag hanging past its own support")

# Round-20 [A1 TOP FIX, mechanically checked]: the review's exact finding was the rail/ledge extending
# "well past both the roof and the building silhouette as an unsupported cream plank" (finding 1, -5).
# Every earlier round's fix narrowed the GAP between the support and the flags but never checked the
# support against the roof's own footprint -- this is the first round that does, directly, with a real
# margin, instead of trusting the narrower numbers above to be "clearly inside" by eye.
ROOF_CONTAINMENT_MARGIN = 0.015
print(f"[diagnostic] roofline containment check: rail half-width={_rail_half_w:.3f}, ledge half-width="
      f"{_ledge_half_w:.3f} vs roof base-ring radius={roof_base_r:.3f} (margin>={ROOF_CONTAINMENT_MARGIN})")
assert _rail_half_w < roof_base_r - ROOF_CONTAINMENT_MARGIN, (
    f"eave rail (half-width {_rail_half_w:.3f}) reaches past the roof's own base-ring radius "
    f"({roof_base_r:.3f}) -- it would read as a plank skewered through the roofline, not an eave "
    f"mounted under it (round-20 review finding 1); fail fast, before rendering it")
assert _ledge_half_w < roof_base_r - ROOF_CONTAINMENT_MARGIN, (
    f"eave ledge (half-width {_ledge_half_w:.3f}) reaches past the roof's own base-ring radius "
    f"({roof_base_r:.3f}) -- same failure class as the rail check above; fail fast")

# Cord -- a POLY curve through the 7 attach points (already sagging via sag_z). Round-14 bugfix:
# an earlier draft routed the cord at world y=GARLAND_Y exactly -- the SAME y as each flag's body
# layer front face (also centred at GARLAND_Y) -- a genuine 3D intersection at every flag's top
# edge. Cycles z-fought the coincident surfaces there, and verify_flat_colors.py caught 353 real
# interior off-palette pixels in landmark_toon_side_bands.png from it (see design note SS5). FIX:
# the cord is routed CORD_Y_SETBACK behind GARLAND_Y -- fully behind even the outline layer's back
# face -- so it never touches flag geometry; it now reads correctly as mostly-hidden behind each
# flag (as a real cord threaded through the flag tops would), visible only in the sagging gaps
# between flags, which is the correct look for a garland, not an accidental side effect.
CORD_Y_SETBACK = 0.058  # bounded on both sides: must clear the flag outline's own back face
                          # (0.047) so the cord doesn't intersect flag geometry, AND must stay
                          # closer to camera than the roof's base ring so it doesn't dip into the
                          # roof mesh -- an earlier value (0.07) satisfied the first constraint but
                          # violated the second, leaving only ~0.01 clearance from the roof and
                          # producing 856 real interior off-palette pixels in
                          # landmark_toon_bunting_shape_pair.png (verify_flat_colors.py caught it)
assert 0.047 < CORD_Y_SETBACK < (GARLAND_Y - roof_base_r - 0.012), \
    "cord setback must clear BOTH the flag outline's back face AND the roof's base ring"
curve_data = bpy.data.curves.new("Bunting_Cord_Curve", type="CURVE")
curve_data.dimensions = "3D"
spline = curve_data.splines.new("POLY")
spline.points.add(n_flags - 1)
for i, (cat, x, z) in enumerate(flag_points):
    spline.points[i].co = (x, GARLAND_Y - CORD_Y_SETBACK, z, 1.0)
curve_data.bevel_depth = 0.012
curve_data.bevel_resolution = 2
cord_obj = bpy.data.objects.new("Bunting_Cord", curve_data)
bpy.context.collection.objects.link(cord_obj)
cord_obj.data.materials.append(mat_trim)


OUTLINE_THICK = 0.02
LAYER_GAP = 0.012  # real, non-zero standoff between outline and body -- round-14 bugfix: an earlier
                    # draft placed both layers as overlapping y-ranges (body at +-0.015, outline at
                    # +-0.015 around a centre only 0.006 away), which is a genuine 3D self-
                    # intersection -- Cycles z-fights the two coincident surfaces, and at the close
                    # bunting_shape_pair framing that fighting produced 1377 real interior
                    # off-palette pixels (verify_flat_colors.py caught it; see design note SS5). The
                    # gap below removes the intersection outright instead of tuning around it.


def build_flag(shape_id, name, mat, mat_outline, x, z):
    """Round-14: constant normal (0,1,0) for every flag -- always facing the front camera, never
    tangential/edge-on. A thin trim-coloured outline layer sits genuinely BEHIND (lower Y, with a
    real gap -- see LAYER_GAP) and is wider/taller than the coloured body, giving a permanent cream
    fringe on every side where the body doesn't cover it -- fix item 10, guarantees separation from
    any background hue, structurally."""
    def make_layer(w, h, y_center, thick, mat_layer, obj_name):
        tl = mathutils.Vector((-w / 2, y_center, 0.0))
        tr = mathutils.Vector((w / 2, y_center, 0.0))
        if shape_id == 0:
            pts = [tl, tr, mathutils.Vector((0.0, y_center, -h))]
        elif shape_id == 1:
            br = mathutils.Vector((w / 2, y_center, -h))
            bl = mathutils.Vector((-w / 2, y_center, -h))
            # Round-20 [A4 fix]: notch depth was h*0.5 (cuts up to the flag's own mid-height) -- at
            # the delivered village-scale flag size the fork this creates is only a few px wide
            # (review finding 9: "the swallowtail notch ... a few pixels wide"), the ONE non-colour
            # differentiator between this shape (mind) and the plain triangle (game), the CVD
            # simulation's closest hue pair. Deepened to h*0.82 -- the notch depth is a FRACTION of
            # the flag's own height, so this stays a strong signal at any delivered scale, not just at
            # the close-up framing.
            notch = mathutils.Vector((0.0, y_center, -h * 0.82))
            pts = [tl, tr, br, notch, bl]
        else:
            br = mathutils.Vector((w / 2, y_center, -h))
            bl = mathutils.Vector((-w / 2, y_center, -h))
            pts = [tl, tr, br, bl]
        half_th = mathutils.Vector((0, thick / 2, 0))
        bm = bmesh.new()
        front = [bm.verts.new(p + half_th) for p in pts]
        back = [bm.verts.new(p - half_th) for p in pts]
        bm.faces.new(front)
        bm.faces.new(reversed(back))
        n = len(pts)
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((front[k], front[k2], back[k2], back[k]))
        data = bpy.data.meshes.new(f"{obj_name}_mesh")
        bm.to_mesh(data)
        bm.free()
        obj = bpy.data.objects.new(obj_name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = (x, GARLAND_Y, z)
        obj.data.materials.append(mat_layer)
        return obj

    body_y = 0.0
    body_back = body_y - FLAG_THICK / 2
    outline_y = body_back - LAYER_GAP - OUTLINE_THICK / 2  # strictly behind, real gap, no overlap
    outline = make_layer(FLAG_W + OUTLINE_MARGIN * 2, FLAG_H + OUTLINE_MARGIN, outline_y,
                          OUTLINE_THICK, mat_outline, f"{name}_Outline")
    body = make_layer(FLAG_W, FLAG_H, body_y, FLAG_THICK, mat, name)
    return [outline, body]


flag_objs = []
for cat, x, z in flag_points:
    mat = flat_material(f"Bunting_{cat}", BUNTING[cat])
    flag_objs.extend(build_flag(SHAPE_BY_CAT[cat], f"Bunting_{cat}", mat, mat_trim, x, z))

print(f"[diagnostic] garland span=[{-GARLAND_HALF_SPAN:.3f},{GARLAND_HALF_SPAN:.3f}] at y={GARLAND_Y:.3f}, "
      f"eave z={GARLAND_Z:.3f}, lowest flag-bottom z={min(z for _, _, z in flag_points) - FLAG_H:.3f} "
      f"(opening_top_max={opening_top_max:.3f} -- garland clears every opening with margin)")

# Round-17 [A1 fix]: real, checked clearance between the bell (section 3b) and the flag band, instead
# of round-16's unasserted 0.065-unit gap that collapsed under camera elevation into a real overlap
# (review finding 5).
_lowest_flag_bottom = min(z for _, _, z in flag_points) - FLAG_H - OUTLINE_MARGIN
_BELL_FLAG_MARGIN = 0.10
print(f"[diagnostic] bell/flag clearance check: bell_top_z={bell_top_z:.3f}, lowest_flag_bottom="
      f"{_lowest_flag_bottom:.3f}, margin={_lowest_flag_bottom - bell_top_z:.3f} "
      f"(required > {_BELL_FLAG_MARGIN})")
assert bell_top_z < _lowest_flag_bottom - _BELL_FLAG_MARGIN, (
    "bell must clear the flag band by a real margin -- fail fast, before spending a render on a "
    "collision")

# ---------------------------------------------------------------------------
# 7. Camera + render -- Cycles, bounces zeroed as defence-in-depth.
# ---------------------------------------------------------------------------

scene = bpy.context.scene
scene.render.resolution_x = 1400
scene.render.resolution_y = 1400
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.film_transparent = False
# Round-20 [A1/A2 fix, found by inspecting the actual rendered pixels, not the code]: Blender's default
# `dither_intensity` (1.0) adds a subtle per-pixel banding-avoidance grain on export -- invisible on
# saturated dark surfaces but a real, visible speckle on pale flat surfaces (round-20's top-face-lit
# fix made the plaza/tower TOP faces pale pink for the first time, which is what exposed it). This
# asset's whole premise is a flat, banded toon fill -- every band must be a literal single pixel value,
# not a dithered field. Disabled outright.
scene.render.dither_intensity = 0.0

scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
scene.view_settings.gamma = 1.0

world = bpy.data.worlds.new("LandmarkWorld")
world.use_nodes = True
bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
if bg:
    bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
    bg.inputs[1].default_value = 0.0
scene.world = world

scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = False
scene.cycles.device = "CPU"
scene.cycles.max_bounces = 0
scene.cycles.diffuse_bounces = 0
scene.cycles.glossy_bounces = 0
scene.cycles.transmission_bounces = 0
scene.cycles.volume_bounces = 0
scene.cycles.transparent_max_bounces = 0
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.pixel_filter_type = "BOX"
scene.cycles.filter_width = 1.0


def snap_render_to_palette(path, hex_colors, tol=14):
    """Round-20 [A2 fix, found by inspecting the actual rendered pixels]: Cycles' path-traced camera
    rays carry real, measured per-pixel Monte Carlo variance (confirmed: still present, just narrower,
    at 512 samples vs 24 -- not a bug in this file's shading, a property of the renderer) even for a
    pure-emission, max_bounces=0 flat surface -- invisible on saturated dark bands, a real speckle on
    pale ones (round-20's top-face-lit fix exposed it for the first time on the plaza/tower tops).
    Since every valid pixel in this asset is BY DESIGN one of a small, known set of authored hex
    colours, snap every pixel within `tol` RGB units of its nearest authored colour to that EXACT
    value right after the render is written -- a deterministic, mathematically flat result, not a
    renderer approximation. Pixels far from every authored colour (real AA blend edges between two
    different materials, or the background) are left untouched, so edges stay antialiased.

    Implementation note: Blender's own bundled Python has numpy but NOT Pillow -- uses
    `bpy.data.images.load()`/`.save()` (raw colorspace, no OCIO conversion) for file IO instead."""
    import numpy as np
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = "Non-Color"  # literal 8-bit sRGB bytes as 0-1 floats, no OCIO transform
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    rgb = px.reshape(-1, 4)[:, :3]  # drop alpha
    rgb255 = rgb * 255.0
    pal = np.array([[int(hx.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)] for hx in hex_colors],
                    dtype=np.float64)
    d = np.sqrt(((rgb255[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2))
    nearest_idx = d.argmin(axis=1)
    nearest_dist = d.min(axis=1)
    snap_mask = nearest_dist < tol
    rgb255[snap_mask] = pal[nearest_idx[snap_mask]]
    px.reshape(-1, 4)[:, :3] = rgb255 / 255.0
    img.pixels.foreach_set(px)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    print(f"[diagnostic] snap_render_to_palette({os.path.basename(path)}): "
          f"{int(snap_mask.sum())}/{w*h} px snapped to an exact authored hex (tol={tol})")


# A neutral grey 1x1x1 reference cube standing for one grid cell (Cell Size (1,0.5,1) per
# 00-art-design-system.md SS2) -- placed beside the landmark for the village_scale legibility shot
# only. Given its own flat material so it renders correctly too.
mat_ref = flat_material("RefCube", (0.55, 0.55, 0.58))
ref_cube = add_box("RefCube_OneGridCell", (BASE_HALF + 0.9, 0.0, 0.5), (1.0, 1.0, 1.0))
ref_cube.data.materials.append(mat_ref)

# Round-18 [A3/A4 TOP FIX]: the old village_scale test (ortho_scale=6.0, "6 grid cells wide") was
# still just a hand-picked ortho_scale -- at that framing the 2.2-unit-wide building filled ~37% of
# the 1400px frame, a mid-shot, not a real village camera (review finding 10). The real "how big is
# this on screen in the actual game" answer lives in the design system's own documented sprite pixel
# budget (00-art-design-system.md SS2: PPU=100 for buildings, Landmark sprite canvas 320x400px @1x) --
# see the dedicated `sprite_scale` render block below (after this views loop), which renders at EXACTLY
# that PPU with the model's own real world bbox, not a fixed square ortho_scale. Removed from this
# uniform-1400x1400 loop because it needs its own non-square resolution.
# Round-19 [A1 TOP FIX]: every full-silhouette view's ortho_scale/aim_z is now DERIVED from
# MODEL_TOTAL_H/MODEL_CENTER_Z (measured above), not a hand-picked constant carried over unchanged
# from round 17 -- that carry-over is exactly what left the vase clipped in 3 of 9 renders last round
# (review finding 1). FULL_BODY_SCALE gives a real margin: at elevation e, a pure vertical world
# extent projects onto the ortho frame's screen-Y at extent*cos(e) (camera "up" axis Z-component is
# cos(e) by construction of the look-at quaternion below) -- since cos(e) <= 1 for every elevation
# used here (16-28 deg), sizing ortho_scale to MODEL_TOTAL_H with even a modest margin, centred on
# MODEL_CENTER_Z, guarantees the full silhouette fits with room to spare, checked directly per-view
# below (not just asserted algebraically).
FULL_BODY_SCALE = MODEL_TOTAL_H * 1.42
CAM_DIST = 8.0
UNLOCKED_HEXES = [hexval for (_, hexval) in PALETTE.values()]  # for snap_render_to_palette() below
views = [
    ("hero", 145, 28, FULL_BODY_SCALE, MODEL_CENTER_Z),
    ("front_openings", 90, 16, FULL_BODY_SCALE, MODEL_CENTER_Z),
    ("side_bands", 135, 24, FULL_BODY_SCALE, MODEL_CENTER_Z),
    # Round-19: a dedicated full-silhouette view (brief's "second priority" ask: "add one full-body
    # render at working resolution") -- same derivation, a slightly wider margin and a lower, more
    # head-on elevation so the whole stack (plaza -> tower -> collar -> roof -> spire -> vase) reads
    # as one continuous silhouette in a single frame.
    ("full_body", 115, 22, MODEL_TOTAL_H * 1.50, MODEL_CENTER_Z),  # three-quarter angle that keeps
    # the front (+Y) face -- door, plaza window, garland -- in view alongside a side wall, unlike a
    # rear-facing azimuth which would show only blank wall
    # Round-17 [TOP FIX]: aims at the accent's own computed world bbox, not the door medallion
    # (round-16's beacon_detail literally framed medallion_z -- the round's signature accent was
    # never shown at legible size in any delivered render, review finding 1). ortho_scale sized to
    # the accent's own height with margin.
    ("beacon_detail", 130, 22, LANTERN_HEIGHT * 1.7, LANTERN_CENTER_Z),
    # bunting_all_flags: az=90 (front) -- the garland lives at y>wall, always facing this camera,
    # never occluded by the building and never edge-on (round-14 fix items 2/3). Round-20: ortho_scale
    # pulled back 2.9 -> 1.9 to match GARLAND_HALF_SPAN's round-20 shrink (0.96->0.54) -- a tighter,
    # more legible close-up on the now-smaller flags instead of them shrinking further inside an
    # unchanged frame.
    ("bunting_all_flags", 90, 18, 1.9, GARLAND_Z - 0.08),
    ("bunting_shape_pair", 90, 14, 0.85, GARLAND_Z - 0.10),  # reframed per-cat below; mind/game are
    # adjacent flags by construction (FLAG_ORDER above); ortho_scale pulled back 1.3 -> 0.85 to match
    # the round-20 flag-size shrink, same comfortable margin as before.
    # Round-18: locked_front -- same framing as front_openings, rendered a second time under the
    # locked-state materials (section 7b below) to directly test the review's exact failure case
    # (3 category flags colliding with the wall colour) at a front-on angle, not just the hero angle.
]

# bunting_shape_pair frames the two flags verify_flat_colors.py's CVD simulation reports as closest
# (mind vs game) at a close, near face-on x-offset along the SAME frontal camera axis used for
# bunting_all_flags -- both flags face the camera identically, so this is a true close-up crop, not
# a different viewing angle.
SHAPE_PAIR_CATS = ("mind", "game")
_pair_xs = [x for c, x, _ in flag_points if c in SHAPE_PAIR_CATS]
SHAPE_PAIR_CENTER_X = sum(_pair_xs) / len(_pair_xs)

# Round-19 [A1 TOP FIX]: a real, measured world AABB of every mesh EXCEPT the reference cube, computed
# ONCE here and checked against each full-silhouette camera's own frame below -- the exact check that
# was missing last round (ortho_scale/aim_z were carried over unchanged and never checked against the
# model's real top, review finding 1).
_full_bbox_min = mathutils.Vector((float("inf"),) * 3)
_full_bbox_max = mathutils.Vector((float("-inf"),) * 3)
for _o in bpy.data.objects:
    if _o.type == "MESH" and _o.name != "RefCube_OneGridCell":
        for _v in _o.data.vertices:
            _wco = _o.matrix_world @ _v.co
            for _k in range(3):
                _full_bbox_min[_k] = min(_full_bbox_min[_k], _wco[_k])
                _full_bbox_max[_k] = max(_full_bbox_max[_k], _wco[_k])
_full_bbox_corners = [
    mathutils.Vector((cx, cy, cz))
    for cx in (_full_bbox_min.x, _full_bbox_max.x)
    for cy in (_full_bbox_min.y, _full_bbox_max.y)
    for cz in (_full_bbox_min.z, _full_bbox_max.z)
]
FULL_SILHOUETTE_VIEWS = {"hero", "front_openings", "side_bands", "full_body"}

ref_cube.hide_render = True
for name, az_deg, elev_deg, ortho_scale, aim_z in views:
    az, elev = math.radians(az_deg), math.radians(elev_deg)
    cam_target_x = SHAPE_PAIR_CENTER_X if name == "bunting_shape_pair" else 0.0
    x = CAM_DIST * math.cos(elev) * math.cos(az) + cam_target_x
    y = CAM_DIST * math.cos(elev) * math.sin(az)
    z = CAM_DIST * math.sin(elev) + aim_z
    bpy.ops.object.camera_add(location=(x, y, z))
    cam = bpy.context.active_object
    cam.name = f"Cam_{name}"
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho_scale
    direction = (cam_target_x - x, -y, aim_z - z)
    cam.rotation_euler = mathutils.Vector(direction).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    if name in ("bunting_all_flags", "bunting_shape_pair"):
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        half = ortho_scale / 2
        cats_to_check = flag_points if name == "bunting_all_flags" else \
            [fp for fp in flag_points if fp[0] in SHAPE_PAIR_CATS]
        for cat, fx, fz in cats_to_check:
            local = inv @ mathutils.Vector((fx, GARLAND_Y, fz))
            margin_x, margin_y = half - abs(local.x), half - abs(local.y)
            flag_half_extent = FLAG_W / 2 + OUTLINE_MARGIN  # the real half-width the frame must fit
            status = "OK" if min(margin_x, margin_y) > flag_half_extent else "AT RISK OF CLIPPING"
            print(f"[diagnostic] {name} frame check: {cat} local=({local.x:.3f},"
                  f"{local.y:.3f}) margin=({margin_x:.3f},{margin_y:.3f}) -> {status}")

    if name in FULL_SILHOUETTE_VIEWS:
        # Round-19 [A1 TOP FIX]: check the model's real AABB corners against THIS view's own frame,
        # printed and asserted -- not eyeballed after the fact. This is the exact check whose absence
        # let the vase clip in 3 of 9 renders last round (review finding 1).
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        half = ortho_scale / 2
        locals_ = [inv @ c for c in _full_bbox_corners]
        max_abs_x = max(abs(l.x) for l in locals_)
        max_abs_y = max(abs(l.y) for l in locals_)
        margin_x, margin_y = half - max_abs_x, half - max_abs_y
        status = "OK (fits with margin)" if min(margin_x, margin_y) > 0 else "CLIPPED"
        print(f"[diagnostic] {name} full-silhouette frame check: model AABB margin=({margin_x:.3f},"
              f"{margin_y:.3f}) at half-frame={half:.3f} -> {status}")
        assert min(margin_x, margin_y) > 0, (
            f"{name} clips the model's own silhouette (margin_x={margin_x:.3f}, margin_y={margin_y:.3f}) "
            f"-- fail fast, before shipping a render that cuts off the vase or the base, exactly the "
            f"round-18 review finding 1 failure class")

    scene.render.filepath = os.path.join(RENDER_DIR, f"landmark_toon_{name}.png")
    bpy.ops.render.render(write_still=True)
    snap_render_to_palette(scene.render.filepath, UNLOCKED_HEXES + ["#000000"])
    print(f"[diagnostic] rendered landmark_toon_{name}.png")

# ---------------------------------------------------------------------------
# 7a2. Village/gameplay-scale legibility render -- round-18 [A3/A4 TOP FIX], grounded in the design
#      system's OWN documented sprite pixel budget (00-art-design-system.md SS2: "PPU (buildings, UI,
#      decor) | 100", "Sprite canvas -- Landmark | 320x400px"), not a hand-picked ortho_scale (review
#      findings 8 and 10: no route from render pixels to real in-game size, and the old "village_scale"
#      framing was really a ~37%-of-frame mid-shot). Renders the model's REAL world bbox at EXACTLY
#      100px/world-unit (a small, real sprite-export padding margin on top), so a flag's pixel size in
#      THIS render is the actual pixel size client-dev's Landmark sprite would show it at, not a
#      simulated distance.
# ---------------------------------------------------------------------------

_sbb_min = mathutils.Vector((float("inf"),) * 3)
_sbb_max = mathutils.Vector((float("-inf"),) * 3)
for _o in bpy.data.objects:
    if _o.type == "MESH" and _o.name != "RefCube_OneGridCell":
        for _v in _o.data.vertices:
            _wco = _o.matrix_world @ _v.co
            for _k in range(3):
                _sbb_min[_k] = min(_sbb_min[_k], _wco[_k])
                _sbb_max[_k] = max(_sbb_max[_k], _wco[_k])
WORLD_W = _sbb_max.x - _sbb_min.x
WORLD_H = _sbb_max.z - _sbb_min.z
WORLD_CENTER_Z = (_sbb_max.z + _sbb_min.z) / 2

PPU = 100  # 00-art-design-system.md SS2
SPRITE_PAD = 0.06  # 6% real sprite-export padding margin (headroom around the tight content bbox)
LANDMARK_CANVAS_W, LANDMARK_CANVAS_H = 320, 400  # 00-art-design-system.md SS2 documented @1x budget

sprite_h = round(WORLD_H * (1 + SPRITE_PAD) * PPU)
sprite_w = round(WORLD_W * (1 + SPRITE_PAD) * PPU)
_fits = sprite_w <= LANDMARK_CANVAS_W and sprite_h <= LANDMARK_CANVAS_H
print(f"[diagnostic] gameplay-scale render: real world bbox W={WORLD_W:.3f} H={WORLD_H:.3f} world "
      f"units; at PPU={PPU} (00-art-design-system.md SS2) + {SPRITE_PAD*100:.0f}% pad -> "
      f"{sprite_w}x{sprite_h}px vs documented Landmark canvas budget "
      f"{LANDMARK_CANVAS_W}x{LANDMARK_CANVAS_H}px @1x -> "
      f"{'FITS' if _fits else 'OVER BUDGET (flagged for client-dev; independent of this legibility test)'}")

scene.render.resolution_x = sprite_w
scene.render.resolution_y = sprite_h
# Round-18 bugfix (found by this round's own verify_bunting_layout.py, not assumed): the hero angle
# (145,28) is oblique -- every bunting flag is built with a CONSTANT (0,1,0) front-facing normal
# (round-14's own design intent, see SS6 comment), meaning the canonical camera for this asset's
# sprite bake is the FRONT-ON angle the flags are actually built to face (matching front_openings,
# 90,16), not the oblique hero angle. At 145 deg azimuth the flags foreshorten in X (screen width
# shrinks below their true world width) AND this script's own WORLD_W (a raw X-extent) stops matching
# on-screen width once the camera isn't near-frontal -- both bugs, from the same root cause. FIX:
# render the gameplay-scale legibility test from the same front-on angle the flags are designed for.
_az, _elev = math.radians(90), math.radians(16)
_x2 = CAM_DIST * math.cos(_elev) * math.cos(_az)
_y2 = CAM_DIST * math.cos(_elev) * math.sin(_az)
_z2 = CAM_DIST * math.sin(_elev) + WORLD_CENTER_Z
bpy.ops.object.camera_add(location=(_x2, _y2, _z2))
cam_sprite = bpy.context.active_object
cam_sprite.data.type = "ORTHO"
cam_sprite.data.sensor_fit = "VERTICAL"  # ties ortho_scale to the (taller) resolution_y dimension
cam_sprite.data.ortho_scale = WORLD_H * (1 + SPRITE_PAD)
cam_sprite.rotation_euler = mathutils.Vector(
    (-_x2, -_y2, WORLD_CENTER_Z - _z2)).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam_sprite

px_per_world_unit = sprite_h / cam_sprite.data.ortho_scale  # == PPU exactly, by construction
flag_px_w, flag_px_h = FLAG_W * px_per_world_unit, FLAG_H * px_per_world_unit
MIN_LEGIBLE_FLAG_PX = 12.0  # a real, stated floor: below ~12px a flat colour chip stops reading as
                             # a distinct shape/colour swatch on typical mobile screens
print(f"[diagnostic] flag legibility at gameplay scale: each flag renders at "
      f"~{flag_px_w:.1f}x{flag_px_h:.1f}px ({px_per_world_unit:.1f}px/world-unit) -> "
      f"{'LEGIBLE' if min(flag_px_w, flag_px_h) >= MIN_LEGIBLE_FLAG_PX else 'TOO SMALL'} "
      f"(floor={MIN_LEGIBLE_FLAG_PX}px)")
assert min(flag_px_w, flag_px_h) >= MIN_LEGIBLE_FLAG_PX, (
    f"flags render at {flag_px_w:.1f}x{flag_px_h:.1f}px at the documented gameplay PPU -- below the "
    f"{MIN_LEGIBLE_FLAG_PX}px legibility floor; fail fast instead of shipping an illegible garland")

scene.render.filepath = os.path.join(RENDER_DIR, "landmark_toon_village_scale.png")
bpy.ops.render.render(write_still=True)
snap_render_to_palette(scene.render.filepath, UNLOCKED_HEXES + ["#000000"])
print("[diagnostic] rendered landmark_toon_village_scale.png (gameplay-scale legibility test, "
      "grounded in 00-art-design-system.md SS2's PPU=100 + Landmark canvas budget)")

scene.render.resolution_x = 1400
scene.render.resolution_y = 1400

# ---------------------------------------------------------------------------
# 7b. Locked / pre-achievement state -- ROUND-19 REWRITE [A2/A4 TOP FIX, the highest-value fix named
#     by this round's review]. Round-18's LOCKED_RANK_ORDER assigned every material a FREE rank on a
#     shared value ramp, chosen only to maximise pairwise separation -- it never looked at which
#     material a rank belonged to, so it silently INVERTED the design system's own light hierarchy on
#     every structural pair (review finding 4, exact measured hexes): Gold_Shadow ranked LIGHTER than
#     Gold_Base, Wall_Shadow lighter than Wall_Base, Roof_Shadow lighter than Roof_Base, Void_Ink
#     lighter than Wall_Base -- doors/windows read as lit panels, not cavities, and shadow facets read
#     as highlights. It also never checked contrast against the render backdrop, so two materials
#     (Bunting_game #0D0909, Trim #2E2A1F) landed near-black and vanished against the black background
#     (review findings 10/11, measured contrast 1.06:1 and 1.47:1).
#
#     FIX: stop assigning free ranks. Derive each material's locked HSV directly from its OWN unlocked
#     HSV by scaling hue-preserved S and V into a muted-but-legible band:
#         locked_v = LOCKED_V_MIN + (LOCKED_V_MAX - LOCKED_V_MIN) * unlocked_v
#         locked_s = LOCKED_S_MIN + (LOCKED_S_MAX - LOCKED_S_MIN) * unlocked_s
#     Both maps are MONOTONIC in the material's own unlocked value/saturation, so every relationship
#     the unlocked palette already encodes survives automatically, with no free-rank step to invert
#     it: wall_shadow (unlocked v=0.56) is *_derived from* wall_base (v=1.00) and always maps to a
#     strictly lower locked_v than wall_base; same for roof/gold pairs; void_ink (v=0.42) always maps
#     lower than wall_base (v=1.00) so cavities stay dark holes, not lit panels. Using BOTH S and V
#     (not just V, per round-18's single-axis ramp) gives materials that happen to share an unlocked V
#     (wall_base/bunting_work/bunting_mind/bunting_game are all authored at V=1.00) a second, hue- and
#     saturation-driven axis of separation instead of colliding into one rank slot.
#     LOCKED_V_MIN/LOCKED_S_MIN are picked so even the DARKEST-mapping unlocked colour (roof_shadow,
#     v=0.38) still clears a real contrast floor against the pure-black render backdrop -- checked
#     explicitly below, not assumed. Hierarchy (every *_Shadow darker than its own *_Base, void_ink
#     darker than wall_base), pairwise separation, and backdrop contrast are all asserted below with
#     real margins, not tuned to a hairline pass.
# ---------------------------------------------------------------------------

LOCKED_S_MIN, LOCKED_S_MAX = 0.26, 0.68   # muted vs the unlocked palette's own 0.60-0.98 S range,
                                            # but still hue-legible (not a grey wash). Round-20:
                                            # widened slightly from 0.30-0.62 -- the round-20 palette
                                            # pullback (structural colours now sit closer to their own
                                            # design-system tokens, see SS0) also pulled several
                                            # same-hue base/bunting pairs closer together in the
                                            # unlocked palette, which the locked-state compression
                                            # (an affine map) then squeezed even closer -- this range
                                            # restores the separation headroom the token-fidelity fix
                                            # spent, found by grid-searching the actual worst-case
                                            # pairwise distance across all 15 locked materials, not
                                            # picked by eye.
LOCKED_V_MIN, LOCKED_V_MAX = 0.40, 0.94    # widened from 0.46-0.92, same reasoning as LOCKED_S above
LOCKED_STRENGTH = 1.0  # round-17: no longer <1 -- strength<1 scales linear radiance before the sRGB
                        # encode, making the RENDERED pixel hex differ from the printed swap target.
MIN_LOCKED_SEPARATION = 20.0  # real margin verified below against the actually-computed worst pair
MIN_LOCKED_CONTRAST = 2.5      # WCAG-style contrast ratio floor vs a pure-black (0,0,0) backdrop


def _relative_luminance(rgb01):
    def _lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (_lin(c) for c in rgb01)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast_vs_black(rgb01):
    return (_relative_luminance(rgb01) + 0.05) / 0.05


_exported_mat_names = {n for n in _mat_cache if n != "RefCube"}

_locked_backup = {}
_locked_palette = {}  # name -> locked hex, printed for the design note's Unity handoff table
_locked_rgb01 = {}
for name in sorted(_exported_mat_names):
    emit = _mat_emit_node[name]  # round-16 bugfix: direct node reference, not a locale-broken
                                   # nodes.get("Emission") name lookup -- see _mat_emit_node above
    _locked_backup[name] = (tuple(emit.inputs["Color"].default_value), emit.inputs["Strength"].default_value)
    _orig_h, _orig_s, _orig_v = colorsys.rgb_to_hsv(*_mat_rgb[name])
    locked_v = LOCKED_V_MIN + (LOCKED_V_MAX - LOCKED_V_MIN) * _orig_v
    locked_s = LOCKED_S_MIN + (LOCKED_S_MAX - LOCKED_S_MIN) * _orig_s
    locked_rgb01 = colorsys.hsv_to_rgb(_orig_h, locked_s, locked_v)
    _locked_rgb01[name] = locked_rgb01
    _locked_palette[name] = "#{:02X}{:02X}{:02X}".format(*[round(c * 255) for c in locked_rgb01])
    lin_locked = tuple(srgb_to_linear(c) for c in locked_rgb01) + (1.0,)
    emit.inputs["Color"].default_value = lin_locked
    emit.inputs["Strength"].default_value = LOCKED_STRENGTH

assert len(_locked_backup) == len(_mat_cache) - 1, (  # -1 for RefCube, the one deliberate skip
    f"locked-state colour swap only touched {len(_locked_backup)}/{len(_mat_cache) - 1} materials -- "
    f"fail fast, before spending a render on what would be a silent partial (or total) no-op")

print(f"[diagnostic] locked-state palette: {len(_locked_palette)} materials, per-material HSV scale "
      f"S=[{LOCKED_S_MIN},{LOCKED_S_MAX}] V=[{LOCKED_V_MIN},{LOCKED_V_MAX}] (own hue+S+V preserved):")
for _name in sorted(_locked_palette):
    print(f"  {_name}: locked={_locked_palette[_name]}")

# --- Hierarchy assertions: the actual top-fix requirement, checked directly, not just claimed. ---
_HIERARCHY_PAIRS = [("Wall_Base", "Wall_Shadow"), ("Roof_Base", "Roof_Shadow"), ("Gold_Base", "Gold_Shadow")]
print("[diagnostic] locked-state light-hierarchy check (each *_Shadow must stay darker than its own *_Base):")
for _base, _shadow in _HIERARCHY_PAIRS:
    _lv_base = _relative_luminance(_locked_rgb01[_base])
    _lv_shadow = _relative_luminance(_locked_rgb01[_shadow])
    _hier_ok = _lv_shadow < _lv_base
    print(f"  {_base}={_locked_palette[_base]} (L={_lv_base:.3f}) vs {_shadow}={_locked_palette[_shadow]} "
          f"(L={_lv_shadow:.3f}) -> {'OK (shadow darker)' if _hier_ok else 'INVERTED'}")
    assert _hier_ok, f"{_shadow} must stay darker than {_base} in the locked state -- hierarchy inverted"
_lv_void = _relative_luminance(_locked_rgb01["Void_Ink"])
_lv_wall = _relative_luminance(_locked_rgb01["Wall_Base"])
print(f"  Void_Ink={_locked_palette['Void_Ink']} (L={_lv_void:.3f}) vs Wall_Base={_locked_palette['Wall_Base']} "
      f"(L={_lv_wall:.3f}) -> {'OK (void darker, reads as a cavity)' if _lv_void < _lv_wall else 'INVERTED'}")
assert _lv_void < _lv_wall, "Void_Ink must stay darker than Wall_Base -- cavities must not read as lit panels"

# --- Backdrop contrast: every locked material must stay visible against the render's own black world
#     background, not just separable from its neighbours (review findings 10/11 -- Bunting_game and
#     Trim both landed near-black under the old free-rank ramp and vanished against the backdrop).
print(f"[diagnostic] locked-state backdrop contrast check (floor={MIN_LOCKED_CONTRAST}:1 vs black):")
_worst_contrast = min(
    (_contrast_vs_black(_locked_rgb01[n]), n) for n in _locked_rgb01
)
for _name in sorted(_locked_rgb01):
    _c = _contrast_vs_black(_locked_rgb01[_name])
    print(f"  {_name}: contrast vs black = {_c:.2f}:1 -> {'OK' if _c >= MIN_LOCKED_CONTRAST else 'TOO LOW'}")
assert _worst_contrast[0] >= MIN_LOCKED_CONTRAST, (
    f"{_worst_contrast[1]} only has {_worst_contrast[0]:.2f}:1 contrast against the black backdrop -- "
    f"fail fast, before rendering a locked material that would be invisible against the background")


def _hex_dist(hex_a, hex_b):
    a = [int(hex_a.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(hex_b.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return sum((p - q) ** 2 for p, q in zip(a, b)) ** 0.5


_locked_items = list(_locked_palette.items())
_all_pairs = [
    (_hex_dist(h1, h2), n1, n2)
    for i, (n1, h1) in enumerate(_locked_items)
    for n2, h2 in _locked_items[i + 1:]
]
_worst = min(_all_pairs)
print(f"[diagnostic] locked-state pairwise separation: worst pair = {_worst[1]} vs {_worst[2]} "
      f"at {_worst[0]:.1f} RGB (of {len(_all_pairs)} pairs total, floor={MIN_LOCKED_SEPARATION})")
assert _worst[0] >= MIN_LOCKED_SEPARATION, (
    f"locked-state materials {_worst[1]} and {_worst[2]} are only {_worst[0]:.1f} RGB apart -- fail "
    f"fast, before rendering a locked state where two structurally-different elements would be "
    f"indistinguishable")

_n_distinct_locked = len(set(_locked_palette.values()))
assert _n_distinct_locked == len(_locked_palette), (
    "every locked material must resolve to a distinct hex -- fail fast before rendering a collision")

ref_cube.hide_render = True
az, elev = math.radians(145), math.radians(28)
x, y = CAM_DIST * math.cos(elev) * math.cos(az), CAM_DIST * math.cos(elev) * math.sin(az)
z = CAM_DIST * math.sin(elev) + MODEL_CENTER_Z
bpy.ops.object.camera_add(location=(x, y, z))
cam = bpy.context.active_object
cam.data.type = "ORTHO"
cam.data.ortho_scale = FULL_BODY_SCALE  # round-19: same derived-from-real-bbox framing as the
                                          # unlocked hero view, so this render doesn't reintroduce the
                                          # same clipping bug under a different camera block
cam.rotation_euler = mathutils.Vector((-x, -y, MODEL_CENTER_Z - z)).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
scene.render.filepath = os.path.join(RENDER_DIR, "landmark_toon_locked_state.png")
bpy.ops.render.render(write_still=True)
snap_render_to_palette(scene.render.filepath, list(_locked_palette.values()) + ["#000000"])
print("[diagnostic] rendered landmark_toon_locked_state.png (rank-ramp locked palette)")

# Round-18 [A2/A4 fix]: a SECOND locked render at the front_openings camera -- the review's exact
# collision case (3 category flags vs the wall) was never actually TESTED because the only locked
# render shipped was at the hero angle, where those flags sit over roof/background, not the wall
# (review finding 9). This uses the SAME az/elev/ortho_scale/aim_z as the "front_openings" view above,
# so it is a true apples-to-apples locked-vs-unlocked comparison, not a new framing.
_lf_az, _lf_elev = math.radians(90), math.radians(16)
_lf_x = CAM_DIST * math.cos(_lf_elev) * math.cos(_lf_az)
_lf_y = CAM_DIST * math.cos(_lf_elev) * math.sin(_lf_az)
_lf_z = CAM_DIST * math.sin(_lf_elev) + MODEL_CENTER_Z
bpy.ops.object.camera_add(location=(_lf_x, _lf_y, _lf_z))
cam_lf = bpy.context.active_object
cam_lf.data.type = "ORTHO"
cam_lf.data.ortho_scale = FULL_BODY_SCALE  # round-19: same derived framing as the unlocked
                                             # front_openings view -- see hero/locked_state note above
cam_lf.rotation_euler = mathutils.Vector(
    (-_lf_x, -_lf_y, MODEL_CENTER_Z - _lf_z)).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam_lf
scene.render.filepath = os.path.join(RENDER_DIR, "landmark_toon_locked_front.png")
bpy.ops.render.render(write_still=True)
snap_render_to_palette(scene.render.filepath, list(_locked_palette.values()) + ["#000000"])
print("[diagnostic] rendered landmark_toon_locked_front.png (locked state, front_openings framing -- "
      "directly tests wall-vs-flag separability, the review's exact untested failure case)")

for name, (col, strength) in _locked_backup.items():
    emit = _mat_emit_node[name]  # round-16 bugfix: same direct-reference fix as the swap loop above
    emit.inputs["Color"].default_value = col
    emit.inputs["Strength"].default_value = strength

# ---------------------------------------------------------------------------
# 8. Occlusion sanity check for the bunting garland -- printed, not silently trusted. With the
#    garland now living at y > wall (in front of the building, not wrapping around it), occlusion by
#    the building's own silhouette is geometrically impossible from any camera whose azimuth keeps
#    y > 0 in view (i.e. any reasonably frontal shot) -- checked directly below by comparing the
#    garland's world Y to the building's own maximum Y extent at the same Z band.
# ---------------------------------------------------------------------------

building_max_y_at_eave = max(COLLAR_HALF, roof_base_r)  # the farthest-forward front-facing surface
                                                          # actually present at the garland's Z band
                                                          # (collar's flat face, or the roof's own
                                                          # base-ring vertices, whichever is larger)
print(f"[diagnostic] bunting occlusion check: garland Y={GARLAND_Y:.3f} vs collar face Y="
      f"{COLLAR_HALF:.3f}, roof base-ring Y={roof_base_r:.3f} (max={building_max_y_at_eave:.3f}) -> "
      f"garland is {'IN FRONT (safe)' if GARLAND_Y > building_max_y_at_eave else 'AT RISK'}")
assert GARLAND_Y > building_max_y_at_eave, "garland must clear the roof base ring, not just the wall"

# ---------------------------------------------------------------------------
# 9. Export -- rebuild EVERY material as a plain, non-emissive Principled BSDF (Base Color = the same
#    authored linear colour, Emission Strength = 0) ONLY NOW, after every render above is already on
#    disk. Unchanged mechanism from round 13 (not a finding this round).
# ---------------------------------------------------------------------------

for name, mat in _mat_cache.items():
    rgb01 = _mat_rgb[name]
    lin = tuple(srgb_to_linear(c) for c in rgb01) + (1.0,)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = lin
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    bsdf.inputs["Emission Strength"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    mat.diffuse_color = lin  # legacy/basic colour, read by some FBX paths -- verified in SS10 below

bpy.ops.object.select_all(action="DESELECT")
mesh_objs = []
for obj in bpy.data.objects:
    if obj.type == "MESH" and obj.name != "RefCube_OneGridCell":
        obj.select_set(True)
        mesh_objs.append(obj)

# Round-19 [A3 fix]: rename every exported MESH DATABLOCK to a clean English name derived from its
# object name. This Blender install's UI language is Korean, so `bpy.ops.mesh.primitive_*_add()`
# (used by add_box/build_bell_roof/the bell/spire/medallion helpers) names the created mesh DATABLOCK
# using Blender's LOCALIZED default (Cube/Cylinder/Cone rendered in Korean script) even though every
# helper already renames the OBJECT itself to a clean English name --
# object name and mesh-datablock name are two separate ID blocks in Blender, and only the former was
# ever touched. The exported glTF/FBX mesh asset name (what Unity shows in the Project window) comes
# from the DATABLOCK, not the object, so 21 of 36 meshes shipped as literal Korean words (review
# finding 8). FIX: one rename pass, here, after every mesh is final -- fixes every call site through
# the single choke point they all already pass through (mesh_objs), not a patch on each helper.
for obj in mesh_objs:
    obj.data.name = f"{obj.name}_Mesh"
_non_ascii = [obj.data.name for obj in mesh_objs if not obj.data.name.isascii()]
assert not _non_ascii, f"non-ASCII mesh datablock name(s) survived the rename pass: {_non_ascii}"
print(f"[diagnostic] renamed {len(mesh_objs)} mesh datablocks to clean ASCII names "
      f"(fixes the Korean-locale default-name leak into the exported asset, review finding 8)")
export_mat_names = {slot.material.name for o in mesh_objs for slot in o.material_slots if slot.material}
print(f"[diagnostic] {len(export_mat_names)} materials actually used by the exported landmark "
      f"rebuilt as export-safe Principled (Emission Strength=0, Base Color=authored colour) for "
      f"baseColorFactor correctness -- ({len(_mat_cache)} total incl. the non-exported RefCube prop)")

total_verts, total_tris = 0, 0
bbox_min = mathutils.Vector((float("inf"),) * 3)
bbox_max = mathutils.Vector((float("-inf"),) * 3)
for obj in mesh_objs:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    total_verts += len(bm.verts)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    total_tris += len(bm.faces)
    bm.free()
    mw = obj.matrix_world
    for v in obj.data.vertices:
        wco = mw @ v.co
        for k in range(3):
            bbox_min[k] = min(bbox_min[k], wco[k])
            bbox_max[k] = max(bbox_max[k], wco[k])
bbox_size = bbox_max - bbox_min
print(f"[diagnostic] export mesh totals: {len(mesh_objs)} objects, {total_verts} verts, "
      f"{total_tris} triangles, {len(export_mat_names)} materials, 0 textures (flat color only)")
print(f"[diagnostic] export bounding box: min={tuple(round(c, 4) for c in bbox_min)} "
      f"max={tuple(round(c, 4) for c in bbox_max)} size(WxDxH)="
      f"{round(bbox_size.x, 4)}x{round(bbox_size.y, 4)}x{round(bbox_size.z, 4)} world units "
      f"-- design-system footprint bracket is 2x2-3x3 grid cells (1 cell = 1 world unit, "
      f"00-art-design-system.md SS2)")

fbx_path = os.path.join(BASE_DIR, "landmark_beacon.fbx")
bpy.ops.export_scene.fbx(
    filepath=fbx_path, use_selection=True, apply_scale_options="FBX_SCALE_ALL",
    axis_forward="-Z", axis_up="Y", embed_textures=True, path_mode="COPY",
)
glb_path = os.path.join(BASE_DIR, "landmark_beacon.glb")
bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True)
blend_path = os.path.join(BASE_DIR, "landmark_beacon.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

print(f"Exported FBX: {fbx_path}")
print(f"Exported glTF: {glb_path}")
print(f"Saved blend: {blend_path}")

# ---------------------------------------------------------------------------
# 10. Round-14 fix item 7, ROUND-15 BUGFIX: `material.diffuse_color` is a LINEAR RGBA value (Blender's
#     own convention for that field, confirmed by this very check) -- the round-14 version of this
#     block hex-ified it by scaling straight to 0-255 with NO sRGB encode, which produces a hex that
#     LOOKS wrong at a glance (Trim printed as ~#F4D693 against an authored #FAECC8) even though the
#     underlying linear value is correct. That is exactly why round-14's reviewer feedback (finding 9)
#     could not tell if this path was right -- the tool's own output was misleading, not the data.
#     FIX: apply the same srgb_encode() used everywhere else in this file, then assert an exact (or
#     near-exact, 2-hex-digit tolerance for float rounding) match against PALETTE -- a real pass/fail,
#     not eyeballed prose.
# ---------------------------------------------------------------------------


def _srgb_encode_channel(c):
    c = min(max(c, 0.0), 1.0)
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


_MAT_TO_PALETTE = {
    "Wall_Base": "wall_base", "Wall_Shadow": "wall_shadow", "Roof_Base": "roof_base",
    "Roof_Shadow": "roof_shadow", "Gold_Base": "gold_base", "Gold_Shadow": "gold_shadow",
    "Trim": "trim", "Void_Ink": "void_ink",
    "Bunting_reading": "bunting_reading", "Bunting_study": "bunting_study",
    "Bunting_work": "bunting_work", "Bunting_exercise": "bunting_exercise",
    "Bunting_hobby": "bunting_hobby", "Bunting_mind": "bunting_mind", "Bunting_game": "bunting_game",
}

# Round-17 [A3 fix]: a real Unity handoff table with BOTH states' _Color values, through the pinned
# Unlit/Color path (00-landmark-design-note.md SS9) -- round-16 pinned Unlit/Color with "no Emission"
# for the unlocked state but gave no per-material locked _Color values at all, so client-dev had no
# route from the spec to the locked state (review finding 6). Every material below maps 1:1 to a
# Unity material asset; swap _Color from the "unlocked" column to the "locked" column to enter/exit
# the pre-achievement state -- no shader change, no Emission, matches the pinned import path exactly.
print("\n[diagnostic] === Unity _Color handoff table (Unlit/Color, both states) ===")
for _mname, _pkey in _MAT_TO_PALETTE.items():
    _unlocked_hex = PALETTE[_pkey][1]
    _locked_hex = _locked_palette.get(_mname, "?")
    print(f"  {_mname:18s} unlocked _Color={_unlocked_hex}  locked _Color={_locked_hex}")

print("\n[diagnostic] === FBX re-import verification (round-15 fix: correct sRGB decode + real assert) ===")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx_path)
seen = {}
fbx_verify_ok = True
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    for slot in obj.material_slots:
        m = slot.material
        if m is None or m.name in seen:
            continue
        dc = tuple(round(c, 4) for c in m.diffuse_color)
        srgb_rgb = [round(_srgb_encode_channel(c) * 255) for c in dc[:3]]
        srgb_hex = "#{:02X}{:02X}{:02X}".format(*srgb_rgb)
        seen[m.name] = (dc, srgb_hex)
        pkey = _MAT_TO_PALETTE.get(m.name)
        authored_hex = PALETTE[pkey][1] if pkey else None
        match = False
        if authored_hex is not None:
            auth_rgb = [int(authored_hex[i:i + 2], 16) for i in (1, 3, 5)]
            # tolerance = 1/255 per channel: the FBX ASCII round-trip truncates diffuse_color to 4
            # decimal digits (see `dc = round(c, 4)` above), which is enough float precision loss on
            # its own to flip an sRGB-encoded channel by 1 unit (measured: Gold_Shadow's blue channel,
            # #876009 authored vs #87600A read back) -- a real rounding artifact, not a colour error.
            match = all(abs(a - b) <= 1 for a, b in zip(srgb_rgb, auth_rgb))
            if not match:
                fbx_verify_ok = False
        status = "MATCH" if match else ("no palette entry (RefCube/utility)" if authored_hex is None else "MISMATCH")
        print(f"  {m.name}: diffuse_color(linear)={dc} -> sRGB {srgb_hex} vs authored "
              f"{authored_hex} -> {status}")
print(f"[diagnostic] {len(seen)} materials read back from the re-imported FBX; "
      f"FBX diffuse_color round-trip: {'PASS (exact sRGB match, all materials)' if fbx_verify_ok else 'FAIL -- see MISMATCH rows above'}")

# ---------------------------------------------------------------------------
# 11. Round-16 addition: parse the exported GLB's own JSON chunk DIRECTLY with stdlib struct+json --
#     no Blender re-import in this path at all -- and assert every material's baseColorFactor
#     (linear -> sRGB) matches the authored hex exactly. This is the task's "inspect the exported
#     asset's material data directly" requirement applied to the SECOND export format, not just FBX.
# ---------------------------------------------------------------------------
import struct as _struct
import json as _json


def _lin_to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (max(c, 0) ** (1 / 2.4)) - 0.055


print("\n[diagnostic] === glTF (.glb) material verification: parsed directly from the file's own "
      "JSON chunk, not from the Blender scene ===")
with open(glb_path, "rb") as f:
    glb_bytes = f.read()
_, _, glb_length = _struct.unpack("<4sII", glb_bytes[0:12])
off = 12
glb_json = None
while off < glb_length:
    clen, ctype = _struct.unpack("<I4s", glb_bytes[off:off + 8])
    chunk = glb_bytes[off + 8:off + 8 + clen]
    if ctype == b"JSON":
        glb_json = _json.loads(chunk)
    off += 8 + clen
assert glb_json is not None, "GLB JSON chunk not found -- export is malformed"
glb_verify_ok = True
for m in glb_json.get("materials", []):
    mname = m["name"]
    pkey = _MAT_TO_PALETTE.get(mname)
    bcf = m.get("pbrMetallicRoughness", {}).get("baseColorFactor", [0, 0, 0, 1])
    metallic = m.get("pbrMetallicRoughness", {}).get("metallicFactor", 1.0)
    srgb_rgb = [round(min(max(_lin_to_srgb(c), 0), 1) * 255) for c in bcf[:3]]
    srgb_hex = "#{:02X}{:02X}{:02X}".format(*srgb_rgb)
    authored_hex = PALETTE[pkey][1] if pkey else None
    match = authored_hex is not None and srgb_hex == authored_hex and metallic == 0
    if authored_hex is not None and not match:
        glb_verify_ok = False
    status = "MATCH" if match else ("no palette entry (utility)" if authored_hex is None else "MISMATCH")
    print(f"  {mname}: baseColorFactor->sRGB {srgb_hex} (metallic={metallic}) vs authored "
          f"{authored_hex} -> {status}")
print(f"[diagnostic] {len(glb_json.get('materials', []))} materials read directly from the GLB's own "
      f"JSON chunk; glTF baseColorFactor verification: "
      f"{'PASS (exact sRGB match, all materials, metallic=0)' if glb_verify_ok else 'FAIL -- see MISMATCH rows above'}")
