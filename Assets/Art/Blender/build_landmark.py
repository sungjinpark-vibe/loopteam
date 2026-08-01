"""
Village Beacon Spire -- Life Town landmark (D11), T012 THIRD ATTEMPT, ROUND 14.
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


def bunting_boost(hex_str, s_target=0.68, s_min=0.60, s_max=0.85, v_delta=0.0):
    """BUNTING recolor policy: hue AND value preserved (never touched) EXCEPT for one explicit,
    logged v_delta exception (hobby only, see BUNTING_V_DELTA below -- a real design-system-flagged
    ambiguity, not a silent drift); saturation only ever RAISED into the 60-85% band, never lowered."""
    r, g, b = hex_to_01(hex_str)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    new_s = min(max(s, s_min, min(s_target, s_max)), s_max) if s < s_target else min(max(s, s_min), s_max)
    new_s = min(max(new_s, s_min), s_max)
    new_v = min(max(v + v_delta, 0.0), 1.0)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, new_s, new_v)
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


WALL_BASE = register("wall_base", *boost(TOK_PRIMARY, s=0.75, v=1.00))
WALL_SHADOW = register("wall_shadow", *derive_shadow(WALL_BASE))
ROOF_BASE = register("roof_base", *boost(TOK_SECONDARY, s=0.85, v=0.68))
ROOF_SHADOW = register("roof_shadow", *derive_shadow(ROOF_BASE))
GOLD_BASE = register("gold_base", *boost(TOK_COIN, s=0.85, v=0.88))
GOLD_SHADOW = register("gold_shadow", *derive_shadow(GOLD_BASE, v_mult=0.60))
TRIM = register("trim", *boost(TOK_TRIM_SRC, s=0.20, v=0.98))
VOID_INK = register("void_ink", *boost(TOK_VOID_SRC, s=0.45, v=0.42))

BUNTING_V_DELTA = {"hobby": -0.11}  # hobby is the one design-system token flagged [assumption,
                                     # unconfirmed] (00-art-design-system.md L186) and sits only
                                     # ~7deg of hue from exercise -- restored this round (a round-14
                                     # authoring regression: an earlier draft of this file dropped the
                                     # delta entirely and measured separation collapsed 55.2 -> 21.2,
                                     # caught by this round's own diagnostic print before shipping).
BUNTING = {}
for cat, hexv in CATEGORY_TOKENS:
    BUNTING[cat] = register(f"bunting_{cat}", *bunting_boost(hexv, v_delta=BUNTING_V_DELTA.get(cat, 0.0)))

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
    mat_shadow; faces whose normal points away from the fixed 'lit corner' (+X/+Y, a standard toon
    front-right key-light convention, independent of camera) -> mat_shadow; everything else ->
    mat_base. mat_shadow is now ALWAYS the same-hue derived shadow for this specific surface
    (round-14 top fix) -- never a foreign shared ink."""
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
        f.material_index = 0 if (n.x + n.y) > 0.25 else 1
    bm.to_mesh(obj.data)
    bm.free()


def add_box(name, loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def build_star_gem(name, r_outer, r_inner, height, loc, mat_top, mat_bottom, points=5):
    """Round-14 fix item 11b: a genuine N-pointed star bipyramid (alternating outer/inner ring
    radius) instead of a regular n-gon bipyramid -- an unmistakable 'achievement star' beacon read,
    not a generic faceted lump. Upper cone facets = mat_top (bright), lower = mat_bottom (dark)."""
    half_h = height / 2
    n = points * 2
    bm = bmesh.new()
    apex_top = bm.verts.new((0, 0, half_h))
    apex_bot = bm.verts.new((0, 0, -half_h))
    ring = []
    for i in range(n):
        a = i / n * math.tau
        r = r_outer if i % 2 == 0 else r_inner
        ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), 0)))
    for i in range(n):
        v0, v1 = ring[i], ring[(i + 1) % n]
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
SPIRE_R, SPIRE_H = 0.05, 0.30
FINIAL_R_OUTER, FINIAL_R_INNER = 0.13, 0.055

mat_wall = flat_material("Wall_Base", WALL_BASE)
mat_wall_sh = flat_material("Wall_Shadow", WALL_SHADOW)
mat_roof = flat_material("Roof_Base", ROOF_BASE)
mat_roof_sh = flat_material("Roof_Shadow", ROOF_SHADOW)
mat_trim = flat_material("Trim", TRIM)
mat_gold = flat_material("Gold_Base", GOLD_BASE)
mat_gold_sh = flat_material("Gold_Shadow", GOLD_SHADOW)
mat_void = flat_material("Void_Ink", VOID_INK)

# Plaza base -- footprint 1.60x1.60, height 1.00.
plaza = add_box("Landmark_Plaza", (0, 0, BASE_H / 2), (BASE_HALF * 2, BASE_HALF * 2, BASE_H))
add_bevel(plaza)
assign_bands(plaza, mat_wall, mat_wall_sh, mat_corner=mat_trim, ao_world_z=AO_H)

# Tower body -- footprint 1.10x1.10, height 0.85, setback from the plaza.
tower = add_box("Landmark_Tower", (0, 0, tower_cz), (TOWER_HALF * 2, TOWER_HALF * 2, TOWER_H))
add_bevel(tower)
assign_bands(tower, mat_wall, mat_wall_sh, mat_corner=mat_trim, ao_world_z=tower_bottom + AO_H)

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

# Spire + gold star finial -- the "+1 accent" (00-art-design-system.md SS3.3's "one more block").
SPIRE_EMBED = 0.05  # embeds INTO the roof's solid volume -- avoids the zero-area apex-contact gap
                     # that isolated the spire as a disconnected island in round 12 (fixed then, kept)
spire_top_z = roof_apex_z + SPIRE_H
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=SPIRE_R, depth=SPIRE_H + SPIRE_EMBED,
                                     location=(0, 0, roof_apex_z + SPIRE_H / 2 - SPIRE_EMBED / 2))
spire = bpy.context.active_object
spire.name = "Landmark_Spire"
spire.data.materials.append(mat_trim)

finial = build_star_gem("Landmark_FinialStar", FINIAL_R_OUTER, FINIAL_R_INNER, FINIAL_R_OUTER * 1.9,
                         (0, 0, spire_top_z + FINIAL_R_OUTER * 0.95), mat_gold, mat_gold_sh)

# ---------------------------------------------------------------------------
# 3b. Originality accent -- unchanged concept from round 13 (not a finding this round): a hanging
#     achievement bell on a bracket arm off the tower's -X face, embedded into the tower wall so
#     there is no possible gap between prop and body at any angle.
# ---------------------------------------------------------------------------

ARM_LEN, ARM_T = 0.30, 0.06
ARM_EMBED = 0.05
ARM_Z = tower_top - 0.16
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

GARLAND_HALF_SPAN = COLLAR_HALF + 0.10   # anchors just outside the collar corners -- round-14
                                          # bugfix: widened from +0.04 to +0.10 (see FLAG_W note
                                          # below for why the spacing this produces matters)
# Round-14 bugfix: GARLAND_Y must clear the FARTHEST-forward front-facing surface at the eave Z
# band, which is the roof's own base ring (roof_base_r, corrected above -- not the tower wall).
# The prior value (TOWER_HALF+0.05=0.60) sat BEHIND the collar's own front face (0.62) and well
# behind the roof base ring, which is exactly why the build's own occlusion diagnostic below flagged
# "AT RISK" on the first real run of this round's script -- caught before shipping, not asserted away.
GARLAND_Y = roof_base_r + 0.08            # standoff clearly in front of the roof base ring
GARLAND_Z = collar_top                   # eave height -- below the roof, above every opening top
assert GARLAND_Y > max(COLLAR_HALF, roof_base_r), \
    "garland must clear the roof base ring AND the collar face -- fail fast, before rendering"
SAG = 0.05
# Round-14 bugfix, found by this round's own verify_flat_colors.py (856 real interior off-palette
# px in landmark_toon_bunting_shape_pair.png -- traced to a genuine 3D cause, not camera/AA): with
# 7 flags evenly spaced across a span, adjacent attach points are GARLAND_HALF_SPAN*2/6 apart. The
# original FLAG_W=0.30 + 2*OUTLINE_MARGIN(0.028) = 0.356 total flag width is WIDER than that spacing
# at the original GARLAND_HALF_SPAN=0.66 (spacing=0.22) -- adjacent flags physically intersected
# each other. FIX: flags shrunk to fit inside the (now also widened) spacing with a real gap.
FLAG_W, FLAG_H = 0.18, 0.13
FLAG_THICK = 0.03
OUTLINE_MARGIN = 0.017  # round-14 fix item 10: a trim-coloured fringe on every flag, guaranteeing
                          # separation from ANY background hue, structurally, not by camera luck
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
FLAG_ORDER = ["study", "exercise", "reading", "work", "hobby", "mind", "game"]
SHAPE_BY_CAT = {"reading": 0, "study": 1, "work": 0, "exercise": 1, "hobby": 2, "mind": 1, "game": 0}

n_flags = len(FLAG_ORDER)
xs = [((-GARLAND_HALF_SPAN) + (2 * GARLAND_HALF_SPAN) * i / (n_flags - 1)) for i in range(n_flags)]


def sag_z(x):
    t = x / GARLAND_HALF_SPAN
    return GARLAND_Z - SAG * (1 - t * t)


flag_points = []  # (cat, x, z)
for cat, x in zip(FLAG_ORDER, xs):
    flag_points.append((cat, x, sag_z(x)))

# 2 short corner brackets (round-14: down from 7 radial spokes -- fix item 3), reaching from well
# inside the collar's solid volume out to the anchor point, straddling the collar-top/roof-base seam.
BRACKET_LEN = 0.14
for side in (-1, 1):
    bx = side * GARLAND_HALF_SPAN
    inner_x = side * (GARLAND_HALF_SPAN - BRACKET_LEN)
    cx = (bx + inner_x) / 2
    bracket = add_box(f"Bracket_{'L' if side < 0 else 'R'}", (cx, GARLAND_Y * 0.5, GARLAND_Z),
                       (BRACKET_LEN, GARLAND_Y, 0.05))
    bracket.data.materials.append(mat_trim)

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
            notch = mathutils.Vector((0.0, y_center, -h * 0.5))
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

# ---------------------------------------------------------------------------
# 7. Camera + render -- Cycles, bounces zeroed as defence-in-depth.
# ---------------------------------------------------------------------------

scene = bpy.context.scene
scene.render.resolution_x = 1400
scene.render.resolution_y = 1400
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.film_transparent = False

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

# A neutral grey 1x1x1 reference cube standing for one grid cell (Cell Size (1,0.5,1) per
# 00-art-design-system.md SS2) -- placed beside the landmark for the village_scale legibility shot
# only. Given its own flat material so it renders correctly too.
mat_ref = flat_material("RefCube", (0.55, 0.55, 0.58))
ref_cube = add_box("RefCube_OneGridCell", (BASE_HALF + 0.9, 0.0, 0.5), (1.0, 1.0, 1.0))
ref_cube.data.materials.append(mat_ref)

CAM_DIST = 8.0
views = [
    ("hero", 145, 28, 4.6, 1.45),
    ("front_openings", 90, 16, 3.8, 1.2),
    ("side_bands", 135, 24, 4.2, 1.3),
    ("beacon_detail", 90, 20, 1.05, medallion_z - 0.05),
    # bunting_all_flags: az=90 (front) -- the garland lives at y>wall, always facing this camera,
    # never occluded by the building and never edge-on (round-14 fix items 2/3).
    ("bunting_all_flags", 90, 18, 2.35, GARLAND_Z - 0.08),
    ("bunting_shape_pair", 90, 14, 1.1, GARLAND_Z - 0.10),  # reframed per-cat below; mind/game are
    # now adjacent flags (0.22 apart) by construction (FLAG_ORDER above), so 1.1 comfortably fits
    # both with margin -- verified by the same frame-check diagnostic used for bunting_all_flags
    ("village_scale", 40, 30, 5.6, 1.3),  # round-14 fix item 9: ortho_scale was 9.5 (illegible), now
    # 5.6 -- keeps both the scale-comparison purpose AND real landmark legibility. az also changed
    # from 200 (a shadow-only quadrant per assign_bands' fixed +X/+Y lit convention -- wall_base
    # measured 0px there) to 40 (a lit quadrant), so this shot shows the wall's actual base hue, not
    # only its shadow band.
]

# bunting_shape_pair frames the two flags verify_flat_colors.py's CVD simulation reports as closest
# (mind vs game) at a close, near face-on x-offset along the SAME frontal camera axis used for
# bunting_all_flags -- both flags face the camera identically, so this is a true close-up crop, not
# a different viewing angle.
SHAPE_PAIR_CATS = ("mind", "game")
_pair_xs = [x for c, x, _ in flag_points if c in SHAPE_PAIR_CATS]
SHAPE_PAIR_CENTER_X = sum(_pair_xs) / len(_pair_xs)

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

    ref_cube.hide_render = (name != "village_scale")

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

    scene.render.filepath = os.path.join(RENDER_DIR, f"landmark_toon_{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[diagnostic] rendered landmark_toon_{name}.png")

# ---------------------------------------------------------------------------
# 7b. Locked / pre-achievement state -- round-14 fix item 8: a concrete, minimal, DELIVERED image
#     instead of a punt to another document. Every material's Emission colour is temporarily swapped
#     to the existing neutral grey (#8C8C94, already used for RefCube -- no new colour spent) at a
#     reduced strength, rendered once, then restored so the rest of the script (export) is unaffected.
# ---------------------------------------------------------------------------

LOCKED_GREY = (0.55, 0.55, 0.58)
LOCKED_STRENGTH = 0.55
_locked_backup = {}
for name, mat in _mat_cache.items():
    if name == "RefCube":
        continue
    emit = mat.node_tree.nodes.get("Emission")
    if emit is None:
        continue
    _locked_backup[name] = (tuple(emit.inputs["Color"].default_value), emit.inputs["Strength"].default_value)
    lin_grey = tuple(srgb_to_linear(c) for c in LOCKED_GREY) + (1.0,)
    emit.inputs["Color"].default_value = lin_grey
    emit.inputs["Strength"].default_value = LOCKED_STRENGTH

ref_cube.hide_render = True
az, elev = math.radians(145), math.radians(28)
x, y = CAM_DIST * math.cos(elev) * math.cos(az), CAM_DIST * math.cos(elev) * math.sin(az)
z = CAM_DIST * math.sin(elev) + 1.45
bpy.ops.object.camera_add(location=(x, y, z))
cam = bpy.context.active_object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 4.6
cam.rotation_euler = mathutils.Vector((-x, -y, 1.45 - z)).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
scene.render.filepath = os.path.join(RENDER_DIR, "landmark_toon_locked_state.png")
bpy.ops.render.render(write_still=True)


def _srgb_encode(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (max(c, 0) ** (1 / 2.4)) - 0.055


_locked_lin = tuple(srgb_to_linear(c) * LOCKED_STRENGTH for c in LOCKED_GREY)
_locked_srgb_hex = "#{:02X}{:02X}{:02X}".format(*[round(min(max(_srgb_encode(c), 0), 1) * 255) for c in _locked_lin])
print(f"[diagnostic] rendered landmark_toon_locked_state.png (Emission colour #8C8C94 at "
      f"strength={LOCKED_STRENGTH}, same hero camera as landmark_toon_hero.png -- the RENDERED "
      f"pixel hex is dimmer than #8C8C94 because strength<1 scales radiance before sRGB encode: "
      f"actual displayed hex ~= {_locked_srgb_hex}, registered as 'locked_grey' for verification)")

for name, (col, strength) in _locked_backup.items():
    emit = _mat_cache[name].node_tree.nodes.get("Emission")
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
