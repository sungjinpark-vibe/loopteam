"""
Village Beacon Spire — Life Town landmark (D11 first realization), T012 THIRD ATTEMPT.

FULL REWRITE (2026-08-01, round 10). Rounds 1-9 (git log on this file) chased a PBR/lit look
(Principled BSDF + Sun lights + camera-relative light aiming) and kept reproducing the same class
of bug over and over: shadow-side faces desaturating out of their token family, gold accents
collapsing or blowing out depending on whether a light rig happened to hit them, and — the final,
unresolved finding — every surface reading as smooth/glassy/"frosted glass" (see
`renders/landmark_belfry_closeup.png`, kept on disk as the "what NOT to do" reference) because a
lit Principled BSDF under any 3-point rig produces a soft, continuous, view-dependent gradient no
matter how carefully the rig is tuned. That is a PBR renderer doing its job correctly — the bug was
using PBR lighting at all for a target that explicitly wants FLAT/TOON shading.

Director-directed style brief (2026-08-01): match the mobile city-builder "Fortune City" convention
— squat/chibi proportions, one dominant roof shape per tier, FLAT/2-tone fills only (8-12 colors,
60-85% saturation), 2-3 discrete hard-edged value bands (no smooth gradients), large readable
openings, rounded/beveled edges. Full mapping in docs/design/02-landmark-design-note.md.

THE STRUCTURAL FIX, not a re-tune: every material is UNLIT. Base Color and Emission Color are set
to the identical authored flat hex (converted sRGB->linear); Emission Strength=1.0 makes the
material self-illuminating, so its rendered pixel is the authored hex regardless of any light in
the scene. The scene then has ZERO light sources and world strength=0 — there is nothing left that
CAN clip, gradient, or drift between renders, because nothing is lit. "Shading bands" (the
base/shadow/highlight look toon-shaded assets need) are a fixed, purely GEOMETRIC classification —
face normal buckets into one of 2-3 discrete pre-authored flat materials — never a lighting
computation. This eliminates the entire historical bug class (camera-relative light aiming,
key/fill ratio tuning, emission-floor tuning against a rig) by removing the rig itself.

No booleans either (the other repeat source of bugs: PROVE_THE_CUT assertions, cavity-face
heuristics, ghosting from an exposed setback ledge). Openings (door, windows) are POSITIVE decal
geometry — a dark flat shape sitting proud of the wall — which is how this exact genre actually
draws doors/windows (a painted rect/arch, not a real cavity), and is impossible to render
translucent since there is no cavity to catch stray light.

What it does, in order: palette (design-system tokens re-saturated into the 60-85% flat/toon band,
see `boost()`) -> flat/emission material factory -> squat massing (plaza, tower, eave collar, roof
cap, spire, finial gem) with hard-edged top/lit/shadow face bands + a dark AO skirt at each tier's
base -> door + 2 window decals + 1 base decal (4 openings) -> gold beacon medallion (2-band domed
gem) -> bunting ring (plain torus cord, no sag-math, no posts) + 7 flat category-hue flags,
alternating pennant/swallowtail -> bevel pass -> 5 unlit-Cycles renders (new filenames,
`landmark_toon_*`, so the round-9 renders survive on disk as the reference for what this rewrite
had to stop doing) -> FBX + glTF + .blend export (overwrites the previous round's exports — these
are the current asset, not a dated reference like the renders).

Verification: `verify_flat_colors.py` (same folder) samples the actual rendered PNGs and confirms
the dominant colors match the authored hex table within tolerance — see that file and the design
note for the numbers actually measured this round.
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
# 0. Palette — design-system tokens (00-art-design-system.md SS1/SS4.1), re-saturated into the
#    flat/toon 60-85% band. `boost()` keeps hue, sets saturation/value explicitly -- this is the
#    ONE recolor decision this script makes, and every value below is traceable to a locked token.
# ---------------------------------------------------------------------------

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_01(hex_str):
    hex_str = hex_str.lstrip("#")
    return tuple(int(hex_str[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def boost(hex_str, s, v):
    """Re-saturate a locked token: keep hue, set saturation/value explicitly. Returns (sRGB 0..1
    tuple, '#RRGGBB' string) so both the render-time color and the documented hex stay in sync --
    the doc's hex table is generated FROM this function's output, never typed by hand twice."""
    r, g, b = hex_to_01(hex_str)
    h, _, _ = colorsys.rgb_to_hsv(r, g, b)
    r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
    hexout = "#{:02X}{:02X}{:02X}".format(round(r2 * 255), round(g2 * 255), round(b2 * 255))
    return (r2, g2, b2), hexout


TOK_PRIMARY = "#FF9EC4"     # color.primary -> wall hue
TOK_SECONDARY = "#B6A0EF"   # color.secondary -> roof hue
TOK_COIN = "#FFD066"        # color.currency.coin -> gold accent hue
TOK_SURFACE = "#FFFFFF"     # color.surface.raised -> trim neutral base
TOK_TEXT_PRIMARY = "#5A4A6A"  # color.text.primary -> opening/void hue family

CATEGORY_TOKENS = [
    ("reading", "#B6A0EF"), ("study", "#6FD0E8"), ("work", "#FFD066"),
    ("exercise", "#8AD3B4"), ("hobby", "#6FBFA6"), ("mind", "#FFB37A"), ("game", "#FF8FA3"),
]

PALETTE = {}  # name -> (rgb01, hexstr) — printed at the end for the design note's token table

def register(name, rgb01, hexstr):
    PALETTE[name] = (rgb01, hexstr)
    return rgb01


WALL_BASE = register("wall_base", *boost(TOK_PRIMARY, s=0.75, v=1.00))
WALL_SHADOW = register("wall_shadow", *boost(TOK_PRIMARY, s=0.80, v=0.60))
ROOF_BASE = register("roof_base", *boost(TOK_SECONDARY, s=0.72, v=0.95))
ROOF_SHADOW = register("roof_shadow", *boost(TOK_SECONDARY, s=0.76, v=0.58))
GOLD_BASE = register("gold_base", *boost(TOK_COIN, s=0.72, v=1.00))
GOLD_SHADOW = register("gold_shadow", *boost(TOK_COIN, s=0.78, v=0.65))
# Trim is the brief's explicit exception to the 60-85% saturation rule ("trim in a light neutral") —
# a warm cream, deliberately low-saturation for contrast against the saturated wall/roof.
TRIM = register("trim", *boost("#FFE9CC", s=0.18, v=0.97))
# Openings read as voids, not a painted color -- dark, desaturated, from the text.primary family.
OPENING_DARK = register("opening_dark", *boost(TOK_TEXT_PRIMARY, s=0.35, v=0.16))

BUNTING = {}
for cat, hexv in CATEGORY_TOKENS:
    BUNTING[cat] = register(f"bunting_{cat}", *boost(hexv, s=0.75, v=0.95))

print("[diagnostic] palette (post-boost, traceable to locked tokens):")
for name, (_, hx) in PALETTE.items():
    print(f"  {name}: {hx}")

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
# 2. Flat/emission material factory — the structural fix. Base Color and Emission Color are the
#    SAME linear rgb; Emission Strength=1 makes the surface self-illuminating so its rendered pixel
#    equals the authored hex regardless of scene lighting (there is none — see SS6). Base Color is
#    still set (not left default white) so the exported glTF's baseColorFactor is the correct flat
#    hex too, not just the emissiveFactor — verified in verify_flat_colors.py / the design note.
# ---------------------------------------------------------------------------

_mat_cache = {}

def flat_material(name, rgb01):
    if name in _mat_cache:
        return _mat_cache[name]
    lin = tuple(srgb_to_linear(c) for c in rgb01) + (1.0,)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = lin
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Emission Color"].default_value = lin
    bsdf.inputs["Emission Strength"].default_value = 1.0
    _mat_cache[name] = mat
    return mat


def add_bevel(obj, width=0.045, segments=3):
    """Rounded/beveled edges — the brief's single biggest 'cute' signal. Applied before band
    assignment so the new bevel facets get classified too."""
    try:
        mod = obj.modifiers.new("Round", "BEVEL")
        mod.width = width
        mod.segments = segments
        mod.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError as e:
        print(f"Bevel skipped for {obj.name}: {e}")


def assign_bands(obj, mat_base, mat_shadow, mat_highlight=None):
    """Hard-edged flat value bands by FACE NORMAL only — never a lighting computation. Top-facing
    faces (z>0.5) get the highlight band if one is given; faces leaning toward the fixed 'lit'
    direction (+X/+Y) get the base band; everything else (the -X/-Y side, i.e. the far side from
    the lit corner) gets the shadow band. This reuses the design system's own top/front/side
    convention (00-art-design-system.md SS3.1) as a discrete 2-3 band toon rule instead of a
    continuous Lambertian one."""
    obj.data.materials.clear()
    obj.data.materials.append(mat_base)      # 0
    obj.data.materials.append(mat_shadow)    # 1
    top_idx = None
    if mat_highlight is not None:
        obj.data.materials.append(mat_highlight)  # 2
        top_idx = 2
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        n = f.normal
        if top_idx is not None and n.z > 0.5:
            f.material_index = top_idx
        elif (n.x + n.y) > 0.25:
            f.material_index = 0
        else:
            f.material_index = 1
    bm.to_mesh(obj.data)
    bm.free()


def add_box(name, loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


# ---------------------------------------------------------------------------
# 3. Squat/chibi massing. Every body-segment ratio (height / footprint width) is 0.6-0.9 per the
#    style brief; overall height still reads tall via 2 stacked tiers + collar + roof + spire.
# ---------------------------------------------------------------------------

BASE_HALF, BASE_H = 0.80, 1.00     # ratio 1.00/1.60 = 0.625
TOWER_HALF, TOWER_H = 0.55, 0.85   # ratio 0.85/1.10 = 0.773
COLLAR_HALF, COLLAR_H = 0.62, 0.10
ROOF_PITCH_DEG = 48
AO_H = 0.12  # fake-AO skirt height at the base of each tier

plaza_top = BASE_H
tower_bottom = plaza_top
tower_top = tower_bottom + TOWER_H
collar_bottom = tower_top
collar_top = collar_bottom + COLLAR_H
roof_base_z = collar_top
roof_h = COLLAR_HALF * math.tan(math.radians(ROOF_PITCH_DEG))
roof_apex_z = roof_base_z + roof_h
SPIRE_R, SPIRE_H = 0.05, 0.32
spire_top_z = roof_apex_z + SPIRE_H
FINIAL_R = 0.09

mat_wall_base = flat_material("Wall_Base", WALL_BASE)
mat_wall_shadow = flat_material("Wall_Shadow", WALL_SHADOW)
mat_roof_base = flat_material("Roof_Base", ROOF_BASE)
mat_roof_shadow = flat_material("Roof_Shadow", ROOF_SHADOW)
mat_trim = flat_material("Trim", TRIM)
mat_gold_base = flat_material("Gold_Base", GOLD_BASE)
mat_gold_shadow = flat_material("Gold_Shadow", GOLD_SHADOW)
mat_opening = flat_material("Opening_Dark", OPENING_DARK)

# Plaza base — footprint 1.60x1.60, height 1.00.
plaza = add_box("Landmark_Plaza", (0, 0, BASE_H / 2), (BASE_HALF * 2, BASE_HALF * 2, BASE_H))
add_bevel(plaza)
assign_bands(plaza, mat_wall_base, mat_wall_shadow, mat_roof_base)

ao_plaza = add_box("Landmark_PlazaAO", (0, 0, AO_H / 2), (BASE_HALF * 2 + 0.02, BASE_HALF * 2 + 0.02, AO_H))
ao_plaza.data.materials.append(mat_wall_shadow)

# Tower body — footprint 1.10x1.10, height 0.85, setback from the plaza.
tower_cz = tower_bottom + TOWER_H / 2
tower = add_box("Landmark_Tower", (0, 0, tower_cz), (TOWER_HALF * 2, TOWER_HALF * 2, TOWER_H))
add_bevel(tower)
assign_bands(tower, mat_wall_base, mat_wall_shadow, mat_roof_base)

ao_tower = add_box("Landmark_TowerAO", (0, 0, tower_bottom + AO_H / 2),
                    (TOWER_HALF * 2 + 0.02, TOWER_HALF * 2 + 0.02, AO_H))
ao_tower.data.materials.append(mat_wall_shadow)

# Eave collar — a light-neutral fascia band between the tower and the roof (small accent).
collar_cz = collar_bottom + COLLAR_H / 2
collar = add_box("Landmark_Collar", (0, 0, collar_cz), (COLLAR_HALF * 2, COLLAR_HALF * 2, COLLAR_H))
add_bevel(collar, width=0.03, segments=2)
collar.data.materials.append(mat_trim)

# Roof cap — one steep pyramid, oversailing the collar (the single dominant silhouette shape).
roof_cz = roof_base_z + roof_h / 2
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=COLLAR_HALF * math.sqrt(2), radius2=0,
                                 depth=roof_h, location=(0, 0, roof_cz), rotation=(0, 0, math.radians(45)))
roof = bpy.context.active_object
roof.name = "Landmark_Roof"
add_bevel(roof, width=0.03, segments=2)
assign_bands(roof, mat_roof_base, mat_roof_shadow, mat_roof_base)

# Spire + gold finial gem — the "+1 accent" (00-art-design-system.md SS3.3's "one more block").
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=SPIRE_R, depth=SPIRE_H,
                                     location=(0, 0, roof_apex_z + SPIRE_H / 2))
spire = bpy.context.active_object
spire.name = "Landmark_Spire"
spire.data.materials.append(mat_trim)

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=FINIAL_R,
                                       location=(0, 0, spire_top_z + FINIAL_R))
finial = bpy.context.active_object
finial.name = "Landmark_FinialGem"
assign_bands(finial, mat_gold_base, mat_gold_shadow)

# ---------------------------------------------------------------------------
# 4. Openings — 4 total (brief: 2-4 max), all POSITIVE decal geometry proud of the wall, never a
#    boolean cavity. Door = box (jambs) + cylinder (rounded crown), same shape language as an
#    arch without ever cutting the solid. Windows = plain round decals.
# ---------------------------------------------------------------------------

DECAL_PROUD = 0.03   # how far the dark opening decal sits proud of the wall
FRAME_PROUD = 0.015  # the lighter trim frame sits less proud (behind the dark decal)
FRAME_MARGIN = 0.035


def add_arch_decal(name, wall_y, width, rect_h, bottom_z, mat, proud, margin=0.0):
    """Box + cylinder, both centered on the wall's own normal axis (+Y here) — from the front this
    reads as jambs + a rounded crown, i.e. an arch, with zero boolean risk (see module docstring)."""
    w, h = width + margin * 2, rect_h + margin
    y = wall_y + proud
    box = add_box(f"{name}_Jambs", (0, y, bottom_z + h / 2), (w, 0.03, h))
    r = w / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r, depth=0.03, location=(0, y, bottom_z + h))
    crown = bpy.context.active_object
    crown.name = f"{name}_Crown"
    crown.rotation_euler = (math.pi / 2, 0, 0)  # local Z -> world Y, so the flat faces point at +Y
    for obj in (box, crown):
        obj.data.materials.append(mat)
    return [box, crown]


def add_round_decal(name, axis_point, axis, radius, mat, proud):
    loc = list(axis_point)
    idx = {"x": 0, "y": 1}[axis[1]]
    loc[idx] += proud if axis[0] == "+" else -proud
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=0.03, location=tuple(loc))
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = (math.pi / 2, 0, 0) if axis[1] == "y" else (0, math.pi / 2, 0)
    obj.data.materials.append(mat)
    return obj


DOOR_W, DOOR_RECT_H = 0.55, 0.32
DOOR_BOTTOM_Z = tower_bottom + 0.05
add_arch_decal("Door_Frame", TOWER_HALF, DOOR_W, DOOR_RECT_H, DOOR_BOTTOM_Z, mat_trim,
                FRAME_PROUD, margin=FRAME_MARGIN)
add_arch_decal("Door_Void", TOWER_HALF, DOOR_W, DOOR_RECT_H, DOOR_BOTTOM_Z, mat_opening, DECAL_PROUD)
door_apex_z = DOOR_BOTTOM_Z + DOOR_RECT_H + DOOR_W / 2

WIN_R = 0.13
win_z = tower_cz
add_round_decal("Window_Right", (TOWER_HALF, 0, win_z), "+x", WIN_R, mat_opening, DECAL_PROUD)
add_round_decal("Window_Left", (-TOWER_HALF, 0, win_z), "-x", WIN_R, mat_opening, DECAL_PROUD)
add_round_decal("Window_PlazaFront", (0, BASE_HALF, plaza_top * 0.55), "+y", 0.10, mat_opening, DECAL_PROUD)

# ---------------------------------------------------------------------------
# 5. Gold beacon medallion — a small domed gem mounted above the door, half-embedded so it protrudes
#    from the wall. Flat/emission gold, 2-band (dome top vs underside) so it reads as 3D without any
#    lighting dependency. This is the "visible achievement" beacon (VISION.md purpose).
# ---------------------------------------------------------------------------

MEDALLION_R = 0.11
medallion_z = door_apex_z + 0.16
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=MEDALLION_R,
                                       location=(0, TOWER_HALF + MEDALLION_R * 0.55, medallion_z))
medallion = bpy.context.active_object
medallion.name = "Landmark_BeaconMedallion"
assign_bands(medallion, mat_gold_base, mat_gold_shadow)

# ---------------------------------------------------------------------------
# 6. Bunting — plain torus cord (no sag math, no posts: both were repeat bug sources in earlier
#    rounds) at a radius that clears the plaza's own CORNER reach with real margin, so no flag or
#    cord segment can ever be buried in the wall at any angle, and a near-top-down camera can see
#    every flag with nothing tall enough between it and the ring to occlude any of them.
# ---------------------------------------------------------------------------

BASE_CORNER_REACH = BASE_HALF * math.sqrt(2)  # 1.1314
# RING_R is deliberately large, not just "clears the corner": a flag is a vertical plane whose
# normal is radial, so at any single camera position, occlusion-by-height (the tall roof/spire
# blocking the far side of the ring) and flag foreshortening (its width vanishes exactly at az ==
# flag's own azimuth, its whole visible cross-section vanishes at elevation -> 90) trade off
# against each other -- this was tested empirically this round (see the design note SS "bunting
# camera"): a tight ring (1.3) forced a choice between occlusion (low elevation) or literal
# zero-pixel invisibility (top-down, a page-thin radial plane viewed exactly edge-on has zero
# projected area). Widening the ring pushes the occlusion-free elevation down to a range
# (~65-70 deg) where flags still have real projected height, escaping the trap geometrically
# instead of by camera tuning. Verified below: RING_R clears every tier's own (radius, height)
# pair at ELEV_BUNTING with real margin, not just the base corner.
RING_R = 2.00
RING_Z = plaza_top * 0.70                     # 0.70 — well below plaza top, well above ground
# FLAG_W is sized up from a "natural" ~0.35 specifically so that even the worst-case flag in the
# dedicated all-flags shot (width factor 0.223 at its azimuth, see ELEV_BUNTING/az notes below)
# still reads as a real, countable colour patch (~40px at that camera's framing) instead of a
# near-invisible sliver -- verified by re-measuring actual rendered pixel counts per category in
# verify_flat_colors.py, not assumed from the ratio alone.
FLAG_W, FLAG_H = 0.60, 0.42
if RING_R <= BASE_CORNER_REACH:
    raise RuntimeError(f"RING_R={RING_R} does not clear the plaza corner reach "
                        f"({BASE_CORNER_REACH:.4f}) -- flags would be buried in the base block.")

# ELEV_BUNTING is the elevation the dedicated all-flags camera (SS7) uses. PROVE, not assert, that
# no tier's silhouette can occlude a far-side flag at that elevation: for each tier (its own corner
# reach r and top height h), the orthographic ray reaching a far flag (radius RING_R, height
# RING_Z) enters that tier's horizontal footprint at world height RING_Z + (RING_R - r) *
# tan(ELEV_BUNTING) -- if that height already clears h, the ray passes over the tier for its whole
# footprint width (heights only increase further along the ray). This is the actual geometric
# occlusion test from the design note's SS "bunting camera", not eyeballed from a render.
ELEV_BUNTING = 64.0
_tan_e = math.tan(math.radians(ELEV_BUNTING))
for _tier_name, _r, _h in (
    ("plaza", BASE_CORNER_REACH, plaza_top),
    ("tower", TOWER_HALF * math.sqrt(2), tower_top),
    ("collar/roof", COLLAR_HALF * math.sqrt(2), roof_apex_z),
    ("spire", SPIRE_R, spire_top_z),
):
    _entry_h = RING_Z + (RING_R - _r) * _tan_e
    _margin = _entry_h - _h
    print(f"[diagnostic] bunting occlusion check ({_tier_name}): entry_h={_entry_h:.4f} vs "
          f"tier_h={_h:.4f}, margin={_margin:.4f}")
    if _margin <= 0:
        raise RuntimeError(
            f"Bunting camera at ELEV_BUNTING={ELEV_BUNTING} deg does NOT clear the '{_tier_name}' "
            f"tier (margin {_margin:.4f}) -- a far-side flag would be depth-occluded. Raise "
            f"ELEV_BUNTING or RING_R before trusting the bunting_all_flags render."
        )

mat_cord = flat_material("Cord", TRIM)
bpy.ops.mesh.primitive_torus_add(major_radius=RING_R, minor_radius=0.015, location=(0, 0, RING_Z))
cord = bpy.context.active_object
cord.name = "Bunting_Cord"
cord.data.materials.append(mat_cord)

n_flags = len(CATEGORY_TOKENS)


FLAG_THICK = 0.05  # see build_flag docstring — the structural fix for the edge-on problem below


def build_flag(i, name, mat, attach):
    """Even index = pennant (plain triangle), odd = swallowtail (notched) — a shape channel on top
    of hue, for colour-vision-deficiency safety (kept from earlier rounds' accessibility fix).

    Given a THICKNESS (extruded along the flag's own radial normal), not a zero-thickness plane.
    This is the structural fix for a real failure found this round (see the design note's "bunting
    camera" section): a flat vertical flag's screen-visible width is |cos(flag_az - camera_az)|,
    which hits exactly 0 for 2 of 7 flags at some azimuths -- verified empirically (a first render
    put one flag at literally 0 rendered pixels) and camera-tuning alone can only ever raise the
    WORST flag's width factor to ~0.22 (7 doesn't divide 90 deg evenly). A small constant thickness
    means the camera always sees at least that thickness's cross-section, independent of azimuth --
    the same "remove the dependency instead of tuning around it" fix as the emission-material
    change in SS2, applied to geometry instead of shading."""
    down = mathutils.Vector((0, 0, -1))
    tangent = mathutils.Vector((-attach.y, attach.x, 0)).normalized()
    normal = mathutils.Vector((attach.x, attach.y, 0)).normalized()
    half_n = normal * (FLAG_THICK / 2)
    tl, tr = attach - tangent * (FLAG_W / 2), attach + tangent * (FLAG_W / 2)
    bm = bmesh.new()
    if i % 2 == 0:
        bottom = attach + down * FLAG_H
        pts = [tl, tr, bottom]
    else:
        br, bl = tr + down * FLAG_H, tl + down * FLAG_H
        notch = attach + down * (FLAG_H * 0.5)
        pts = [tl, tr, br, notch, bl]
    front = [bm.verts.new(p + half_n) for p in pts]
    back = [bm.verts.new(p - half_n) for p in pts]
    bm.faces.new(front)
    bm.faces.new(reversed(back))
    n = len(pts)
    for k in range(n):
        k2 = (k + 1) % n
        bm.faces.new((front[k], front[k2], back[k2], back[k]))
    data = bpy.data.meshes.new(f"{name}_mesh")
    bm.to_mesh(data)
    bm.free()
    flag = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(flag)
    flag.data.materials.append(mat)
    return flag


flag_objs = []
flag_attach_points = []  # (category, world Vector) -- used by the camera-frame check below (SS7)
for i, (cat, _) in enumerate(CATEGORY_TOKENS):
    angle = (i / n_flags) * math.tau
    attach = mathutils.Vector((RING_R * math.cos(angle), RING_R * math.sin(angle), RING_Z))
    mat = flat_material(f"Bunting_{cat}", BUNTING[cat])
    flag_objs.append(build_flag(i, f"Bunting_{cat}", mat, attach))
    flag_attach_points.append((cat, attach))

flag_bottom_z = RING_Z - FLAG_H
print(f"[diagnostic] bunting ring_r={RING_R:.4f} clears base corner {BASE_CORNER_REACH:.4f} by "
      f"{RING_R - BASE_CORNER_REACH:.4f}; flag bottom z={flag_bottom_z:.4f} (ground=0)")

# ---------------------------------------------------------------------------
# 7. Camera + render — NO light sources, world strength 0. Nothing in the scene can illuminate a
#    surface; every visible pixel comes directly from that surface's own Emission, so it is
#    impossible for a render to clip/gradient/drift the way rounds 1-9 kept finding. Standard view
#    transform (no filmic tone curve) keeps the 8-bit output numerically equal to the authored hex.
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
    bg.inputs[1].default_value = 0.0  # zero strength: nothing here can light the model
scene.world = world

scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = False
scene.cycles.device = "CPU"

CAM_DIST = 8.0
# name, az_deg, elev_deg, ortho_scale, aim_z
views = [
    ("hero", 35, 26, 4.6, 1.45),
    ("front_openings", 90, 14, 4.0, 1.15),
    ("side_bands", 0, 24, 4.2, 1.3),
    ("beacon_detail", 90, 20, 1.5, medallion_z - 0.05),
    # ELEV_BUNTING (64 deg, defined + proven clear in SS6 above, ~4 deg of margin over the computed
    # 59.9 deg minimum) is the elevation where the occlusion math clears every tier with real
    # margin -- NOT top-down (a flag's plane is radial, so it has genuinely zero projected area at
    # 90 deg, not just "thin": a first attempt at elev=89.9 rendered ~0 flag pixels, confirmed by
    # verify_flat_colors.py, not eyeballed).
    # Azimuth=0 -- a flag's visible SCREEN WIDTH is |cos(flag_az - camera_az)| (full width when the
    # camera looks straight at the flag's own radial direction, ZERO width when 90 deg off --
    # confirmed the hard way this round: a first attempt at az=90 put the 'reading' flag (az=0)
    # EXACTLY 90 deg off-axis and it rendered 0 px, caught by the per-flag frame-check diagnostic
    # below, not by eye). With 7 flags evenly spaced (51.43 deg apart, doesn't divide 90 evenly), no
    # single azimuth gives every flag full width; az=0 (aligned with the 'reading' flag) is the
    # numerically-solved value (brute-force search over 0.1 deg steps, see the design note) that
    # MAXIMIZES the worst-case width factor across all 7 -- 0.223 (flags 'work'/'mind', ~77 deg off-
    # axis), vs. az=90's worst case of exactly 0.0.
    ("bunting_all_flags", 0, ELEV_BUNTING, 4.6, RING_Z),
]

for name, az_deg, elev_deg, ortho_scale, aim_z in views:
    az, elev = math.radians(az_deg), math.radians(elev_deg)
    x = CAM_DIST * math.cos(elev) * math.cos(az)
    y = CAM_DIST * math.cos(elev) * math.sin(az)
    z = CAM_DIST * math.sin(elev) + aim_z
    bpy.ops.object.camera_add(location=(x, y, z))
    cam = bpy.context.active_object
    cam.name = f"Cam_{name}"
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho_scale
    direction = (-x, -y, aim_z - z)
    cam.rotation_euler = mathutils.Vector(direction).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    if name == "bunting_all_flags":
        # PROVE every flag's attach point is actually inside the visible ortho frame -- an earlier
        # run in this round found one flag (reading) render with ZERO pixels and it took direct
        # pixel-search debugging (not visible from the render alone) to tell "clipped by the frame
        # edge" apart from "occluded" apart from "color drifted below tolerance". Camera-space X/Y
        # (via matrix_world, since Blender has no public world_to_camera_view for ortho pre-depsgraph
        # update here) must both stay within +/-ortho_scale/2 with margin for the flag's own half-width.
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        half = ortho_scale / 2
        for cat, attach in flag_attach_points:
            local = inv @ attach
            margin_x, margin_y = half - abs(local.x), half - abs(local.y)
            status = "OK" if min(margin_x, margin_y) > FLAG_W else "AT RISK OF CLIPPING"
            print(f"[diagnostic] bunting_all_flags frame check: {cat} local=({local.x:.3f},"
                  f"{local.y:.3f}) margin=({margin_x:.3f},{margin_y:.3f}) -> {status}")

    scene.render.filepath = os.path.join(RENDER_DIR, f"landmark_toon_{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[diagnostic] rendered landmark_toon_{name}.png")

# ---------------------------------------------------------------------------
# 8. Export — FBX + glTF + .blend (overwrite; these are the current asset). Every material's Base
#    Color IS the authored flat hex (SS2), so baseColorFactor round-trips correctly with no bake
#    step needed (no textures at all in this version — flat color reads as the material, per brief).
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="DESELECT")
mesh_objs = []
for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.select_set(True)
        mesh_objs.append(obj)

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
      f"{total_tris} triangles, {len(bpy.data.materials)} materials, 0 textures (flat color only)")
print(f"[diagnostic] export bounding box: min={tuple(round(c, 4) for c in bbox_min)} "
      f"max={tuple(round(c, 4) for c in bbox_max)} size(WxDxH)="
      f"{round(bbox_size.x, 4)}x{round(bbox_size.y, 4)}x{round(bbox_size.z, 4)} world units")

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
