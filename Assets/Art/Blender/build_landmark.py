"""
Village Beacon Spire — Life Town landmark (D11 first realization).
Design source: lifetown/docs/design/02-landmark-design-note.md (read that first — this script
is the literal execution of the form/token decisions made there, nothing here is a new design
call).

STATUS (round 5, 2026-08-01): re-verified again — this ui-ux session has neither Bash/PowerShell
nor any `mcp__blender__*` tool bound in its function schema (checked by reading the actual tool
list handed to this session, not by calling a tool that isn't there). This script is therefore
still unexecuted BY THIS SESSION. It is written to survive a real `--background` run; see the
design note's Status section for the exact command and for why the PNG/FBX/GLB files that already
exist under this folder are STALE (produced from an earlier, now-fixed script version) and must
not be graded as evidence of this round's fixes until the command below is re-run.

Round-4 team-lead findings -> what changed this round, concretely (highest-value fix first):

  1. [A1/A4/A5 -22] Belfry arch + beacon core were invisible in every render. Root cause found by
     hand-computing the geometry (I cannot render to verify visually, so I verified by arithmetic
     instead): the belfry cube (`scale=(0.55,0.55,0.7)` on a `size=1` primitive) has HALF-extent
     0.275 in X/Y (0.5 * 0.55), not 0.55. The old arch cutters were centred at `offset=0.6` along
     each face axis with `depth=0.4` (i.e. spanning 0.4..0.8 on that axis) — entirely outside the
     0..0.275 solid. The boolean DIFFERENCE modifier had literally nothing to cut; Blender applies
     a no-op modifier without error, which is exactly how this shipped invisible and silent.
     Fixed by replacing the 4 offset box+cylinder cutter pairs with 2 cylinders through the
     belfry's own centre (`arch_center_z`), one aligned to each horizontal axis, `depth=1.4` (way
     past the 0.55 full width on either side — no more offset-vs-radius arithmetic to get wrong).
     This also simplifies "4 arch openings" into 2 through-tunnels that cross at the centre (4
     open ends, one shared cavity) — cleaner geometry, easier to reason about without a render.
     A hard runtime assertion now compares the belfry's face count before and after
     `modifier_apply`: if the cut produced no new geometry the script raises `RuntimeError` instead
     of silently proceeding to render/export a solid block, so this exact failure mode cannot ship
     silently again (see PROVE_THE_CUT below).
  2. [A1 -4] Camera azimuths were 45/135/-45 — three corner views of an axis-aligned cube, none of
     which can ever frame a face-normal-aligned arch. Changed to 90/0/180 (each camera looks
     straight at one belfry face) and added a 4th, tighter-framed `belfry_closeup` view centred on
     `belfry_z` at `ortho_scale=1.6` instead of 4.5. Filenames kept (`_three_quarter`/`_profile`
     suffixes are legacy, from before this fix) so a re-run overwrites the same 3 stale files in
     place rather than leaving old and new renders side by side; the 4th file is new.
  3. Design note §0/§7 rewritten this round to reference these exact filenames/paths and to stop
     describing unexecuted geometry as delivered — see the note itself.
  4. [A2 -7] The fill light was `COLOR_SECONDARY` (lavender) at `energy=1.0`, strong enough to
     hue-shift every side face's rendered colour away from its authored hex. Changed to white at
     `energy=0.6`. A tinted rim light, if wanted later, belongs at <=0.15 energy on its own axis —
     not a broad fill at full lavender saturation.
  5. [A3 -9, the single biggest deduction] The exported glTF had no `baseColorFactor` on 5 of 13
     materials because Base Color was driven by a live procedural node graph (Noise -> ColorRamp),
     which Blender's glTF/FBX exporters cannot bake automatically — they fall back to white. Fixed
     by generating a real baked PNG texture per textured material in pure Python (`write_png`,
     stdlib `zlib`+`struct`, no Blender bake pass, so nothing depends on Cycles/UV-bake reliability
     under `--background`) and wiring that image into an `Image Texture -> Base Color` node chain.
     What you see in the Blender render now IS the same image data that exports — no last-minute
     rewire, no separate "export path" that could silently diverge from the render path. The noise
     graph is kept, but now only drives Bump/Roughness (cosmetic, not export-critical).
  6. [A3 -3] No Unity import spec existed. Pinned in the design note §7 this round: scale factor,
     pivot, axis convention, material embed mode. FBX export now also passes
     `axis_forward="-Z", axis_up="Y", embed_textures=True, path_mode="COPY"` explicitly instead of
     relying on exporter defaults.
  7. [A4 -3] Bunting flags floated as detached triangles with no connector. Added a torus "garland
     ring" at the exact flag-anchor height/radius (`FLAG_Z`, `ring_r` — same constants the flags
     already used, so they coincide exactly, no new alignment math) plus 7 support poles from the
     step top up to the ring. The flags themselves are unchanged (their anchor point was already
     correct; only the missing connector geometry is new).
  8. [A5 -3] One texture recipe (grime-like noise) was reused identically on every material. Added
     a second authored motif: `make_paving_png` (a seam/joint-line grid) for the plaza/steps, vs.
     `make_blotch_png` (soft mottling) for walls/tower/accents — two distinct, deliberately
     different surface languages instead of one recipe with only scale tweaked.
  9. Belfry cavity-face heuristic replaced: the old "small face area" heuristic is gone (the new
     circular-bore cut doesn't produce the same face topology as the old box+cylinder composite,
     and area was always a fragile proxy anyway). Replaced with a radius-from-vertical-axis test
     restricted to non-horizontal faces (`abs(normal.z) < 0.5`), which directly targets "this face
     belongs to the tunnel wall" instead of guessing from area. Still an approximation at the
     tunnel-mouth edge (documented honestly in-code, same as before) — not claimed as exact.

Everything from round 3 (crash fix, node tree built by type not name lookup) and round 4 (ridge
cap geometry, gem/spire token fix, render-engine selection, arch box-cutter Z-scale bug) remains
in place; this header only lists what changed THIS round. Full line-level history: git log on this
file.

What it does, in order: clear scene -> materials (baked-PNG textures + procedural bump/roughness)
-> modular blocks (plaza/steps, tower shaft, belfry with a verified boolean arch cut + cavity
backdrop + beacon core, roof + ridge cap, finial spire + gem) -> bunting garland (ring + poles +
7 flags) -> best-effort UV unwrap -> 3-point lighting -> 4 angle renders to PNG -> FBX + glTF +
.blend export.
"""

import bpy
import bmesh
import math
import os
import random
import struct
import zlib
import mathutils

# ---------------------------------------------------------------------------
# 0. Paths + palette (hexes copied verbatim from docs/design/00-art-design-system.md SS1/SS4.1 —
#    see 02-landmark-design-note.md SS3 for the token-to-part mapping)
# ---------------------------------------------------------------------------

BASE_DIR = r"C:\Users\user\loop_engine\lifetown\Assets\Art\Blender"
RENDER_DIR = os.path.join(BASE_DIR, "renders")
TEXTURE_DIR = os.path.join(BASE_DIR, "textures")
os.makedirs(RENDER_DIR, exist_ok=True)
os.makedirs(TEXTURE_DIR, exist_ok=True)

COLOR_PRIMARY = "#FF9EC4"
COLOR_SECONDARY = "#B6A0EF"
COLOR_COIN = "#FFD066"
COLOR_SURFACE_RAISED = "#FFFFFF"
COLOR_TEXT_PRIMARY = "#5A4A6A"  # reused as the cavity/backdrop tone and the bunting cord — not a
                                # new token, an existing locked one reused for two new uses

CATEGORY_HEXES = [
    "#B6A0EF",  # reading
    "#6FD0E8",  # study
    "#FFD066",  # work
    "#8AD3B4",  # exercise
    "#6FBFA6",  # hobby
    "#FFB37A",  # mind
    "#FF8FA3",  # game
]


def hex_to_rgb(hex_str, white_mix=0.0):
    """sRGB hex -> linear RGB tuple, optionally mixed toward white (0..1) to match the
    'category 500 + N% white' shading formula (00-art-design-system.md SS3.1). Used for the
    Principled BSDF's flat Base Color fallback and for light colors."""
    hex_str = hex_str.lstrip("#")
    r, g, b = (int(hex_str[i:i + 2], 16) / 255.0 for i in (0, 2, 4))

    def to_linear(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = to_linear(r), to_linear(g), to_linear(b)
    r = r + (1.0 - r) * white_mix
    g = g + (1.0 - g) * white_mix
    b = b + (1.0 - b) * white_mix
    return (r, g, b, 1.0)


def hex_to_srgb255(hex_str, white_mix=0.0):
    """sRGB hex -> plain 0..255 ints, NO gamma linearization — this is what an 8-bit PNG should
    store (the image's colorspace is set to 'sRGB' so Blender linearizes on sample, same pipeline
    as any authored texture)."""
    hex_str = hex_str.lstrip("#")
    rgb = tuple(int(hex_str[i:i + 2], 16) for i in (0, 2, 4))
    if white_mix > 0:
        rgb = tuple(int(c + (255 - c) * white_mix) for c in rgb)
    return rgb


# ---------------------------------------------------------------------------
# 0b. Minimal stdlib PNG writer + two authored surface motifs (round-5 fix for A3 finding #6: a
#     baked image, not a live shader graph, is what actually round-trips into FBX/glTF Base Color)
# ---------------------------------------------------------------------------

def write_png(path, width, height, pixel_fn):
    """Write an 8-bit RGB PNG using only stdlib (struct + zlib). pixel_fn(x, y) -> (r, g, b)."""
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (none) per scanline
        for x in range(width):
            raw += bytes(pixel_fn(x, y))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit, color type 2 = RGB
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


def _blotch_grid(seed, cells=6):
    rnd = random.Random(seed)
    return [[rnd.uniform(-1.0, 1.0) for _ in range(cells + 1)] for _ in range(cells + 1)]


def _bilinear(grid, u, v, cells):
    fx, fy = u * cells, v * cells
    x0, y0 = int(fx), int(fy)
    x1, y1 = min(x0 + 1, cells), min(y0 + 1, cells)
    tx, ty = fx - x0, fy - y0
    top = grid[y0][x0] * (1 - tx) + grid[y0][x1] * tx
    bot = grid[y1][x0] * (1 - tx) + grid[y1][x1] * tx
    return top * (1 - ty) + bot * ty


def make_blotch_png(path, base255, size=64, variation=0.08, seed=0):
    """Soft, low-frequency mottling — the wall/tower/accent motif."""
    grid = _blotch_grid(seed)
    def pixel(x, y):
        n = _bilinear(grid, x / (size - 1), y / (size - 1), 6)  # -1..1
        factor = 1.0 + n * variation
        return tuple(max(0, min(255, int(c * factor))) for c in base255)
    write_png(path, size, size, pixel)


def make_paving_png(path, base255, size=64, variation=0.12, seam_every=16, seam_w=2):
    """Darker grid seams — reads as paving-stone joints, an intentionally distinct motif from the
    wall blotch (round-5 fix for A5 finding #12: one recipe everywhere read as generic grime)."""
    def pixel(x, y):
        on_seam = (x % seam_every) < seam_w or (y % seam_every) < seam_w
        factor = (1.0 - variation) if on_seam else 1.0
        return tuple(max(0, min(255, int(c * factor))) for c in base255)
    write_png(path, size, size, pixel)


def make_material(name, hex_str, white_mix=0.0, roughness=0.6, metallic=0.0,
                   textured=False, motif="blotch", variation=0.07, seed=0):
    """Build the node tree explicitly by node type (no locale/version-fragile name lookup — the
    round-3 crash). When textured=True, Base Color is driven by a REAL baked PNG (round-5 fix —
    the round-4 live-noise-graph version never exported past white). Bump/Roughness still come
    from a live procedural noise for extra render detail; that part is cosmetic and not export-
    critical, so it can stay procedural without risking the export-correctness bar."""
    mat = bpy.data.materials.new(name)
    if not mat.use_nodes:
        mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (300, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    base_rgb = hex_to_rgb(hex_str, white_mix)
    bsdf.inputs["Base Color"].default_value = base_rgb
    bsdf.inputs["Roughness"].default_value = roughness
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic

    if textured:
        base255 = hex_to_srgb255(hex_str, white_mix)
        png_path = os.path.join(TEXTURE_DIR, f"{name}.png")
        if motif == "paving":
            make_paving_png(png_path, base255, variation=variation, seed=seed)
        else:
            make_blotch_png(png_path, base255, variation=variation, seed=seed)

        img = bpy.data.images.load(png_path)
        img.colorspace_settings.name = "sRGB"
        img.pack()  # embed so FBX/glTF export doesn't depend on the file staying on disk

        uvmap = nt.nodes.new("ShaderNodeUVMap")
        uvmap.location = (-700, -200)
        tex_img = nt.nodes.new("ShaderNodeTexImage")
        tex_img.location = (-400, -200)
        tex_img.image = img
        nt.links.new(uvmap.outputs["UV"], tex_img.inputs["Vector"])
        nt.links.new(tex_img.outputs["Color"], bsdf.inputs["Base Color"])

        tex_coord = nt.nodes.new("ShaderNodeTexCoord")
        tex_coord.location = (-700, -450)
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.location = (-400, -450)
        noise.inputs["Scale"].default_value = 16.0
        noise.inputs["Detail"].default_value = 4.0
        nt.links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])

        rough_ramp = nt.nodes.new("ShaderNodeValToRGB")
        rough_ramp.location = (-150, 50)
        rlo, rhi = max(0.0, roughness * 0.7), min(1.0, roughness * 1.3)
        rough_ramp.color_ramp.elements[0].color = (rlo, rlo, rlo, 1.0)
        rough_ramp.color_ramp.elements[1].color = (rhi, rhi, rhi, 1.0)
        nt.links.new(noise.outputs["Fac"], rough_ramp.inputs["Fac"])
        nt.links.new(rough_ramp.outputs["Color"], bsdf.inputs["Roughness"])

        bump = nt.nodes.new("ShaderNodeBump")
        bump.location = (-150, -200)
        bump.inputs["Strength"].default_value = 0.15
        nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def smart_unwrap(obj):
    """Best-effort UV unwrap so the Image Texture node samples something reasonable. Wrapped in
    try/except because uv.smart_project/mode_set are viewport-context operators of uncertain
    reliability under --background; every mesh primitive already ships a default UV layer, so a
    failed unwrap here degrades to "less pretty mapping", not a missing texture."""
    try:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66))
        bpy.ops.object.mode_set(mode="OBJECT")
    except RuntimeError as e:
        print(f"UV unwrap skipped for {obj.name}: {e}")


def add_bevel(obj, width=0.015, segments=2):
    """Soft, non-black edge highlight — the 3D-native reading of the design system's 'no pure
    black outline, 1px/15%-opacity stroke' rule (00-art-design-system.md SS3.1)."""
    try:
        mod = obj.modifiers.new("EdgeSoften", "BEVEL")
        mod.width = width
        mod.segments = segments
        mod.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError as e:
        print(f"Bevel skipped for {obj.name}: {e}")


# ---------------------------------------------------------------------------
# 1. Clear scene
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for block_type in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights,
                    bpy.data.images):
    for block in list(block_type):
        if block.users == 0:
            block_type.remove(block)

# ---------------------------------------------------------------------------
# 2. Materials (top/front/side shading formula + accents; 2 authored texture motifs)
# ---------------------------------------------------------------------------

mat_top = make_material("Landmark_Top", COLOR_PRIMARY, white_mix=0.60, roughness=0.5,
                         textured=True, motif="blotch", variation=0.06, seed=1)
mat_front = make_material("Landmark_Front", COLOR_PRIMARY, white_mix=0.25, roughness=0.55,
                           textured=True, motif="blotch", variation=0.07, seed=2)
mat_side = make_material("Landmark_Side", COLOR_PRIMARY, white_mix=0.0, roughness=0.6,
                          textured=True, motif="blotch", variation=0.07, seed=3)
mat_secondary = make_material("Landmark_Secondary", COLOR_SECONDARY, white_mix=0.0,
                               roughness=0.35, metallic=0.15, textured=True, motif="blotch",
                               variation=0.05, seed=4)
mat_coin = make_material("Landmark_Coin", COLOR_COIN, white_mix=0.0, roughness=0.15, metallic=0.6)
mat_plaza = make_material("Landmark_Plaza", COLOR_SURFACE_RAISED, white_mix=0.0, roughness=0.75,
                           textured=True, motif="paving", variation=0.12, seed=5)
mat_cavity = make_material("Landmark_Cavity", COLOR_TEXT_PRIMARY, white_mix=0.0, roughness=0.7)
mat_cord = make_material("Bunting_Cord", COLOR_TEXT_PRIMARY, roughness=0.85)
mat_flags = [
    make_material(f"Bunting_{i}", hexv, white_mix=0.0, roughness=0.65)
    for i, hexv in enumerate(CATEGORY_HEXES)
]


def assign_shading_formula(obj, cavity_mat=None, interior_radius=0.24):
    """Assign top/front/side materials to a cuboid mesh by face normal, per the locked shading
    formula (front = +Y facing, side = everything else horizontal, top = +Z facing). If
    cavity_mat is given, non-horizontal faces (abs(normal.z) < 0.5) whose centre sits within
    interior_radius of the vertical axis are treated as tunnel-wall reveal faces instead — this
    directly targets "belongs to the boolean-cut cavity", replacing the round-4 face-area
    heuristic. Still an approximation at the tunnel-mouth edge; spot-check against the render."""
    obj.data.materials.clear()
    obj.data.materials.append(mat_top)    # index 0
    obj.data.materials.append(mat_front)  # index 1
    obj.data.materials.append(mat_side)   # index 2
    cavity_idx = None
    if cavity_mat is not None:
        obj.data.materials.append(cavity_mat)
        cavity_idx = 3

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        n = f.normal
        if cavity_idx is not None and abs(n.z) < 0.5:
            c = f.calc_center_median()
            r_xy = (c.x ** 2 + c.y ** 2) ** 0.5
            if r_xy < interior_radius:
                f.material_index = cavity_idx
                continue
        if n.z > 0.5:
            f.material_index = 0
        elif n.y > 0.5:
            f.material_index = 1
        else:
            f.material_index = 2
    bm.to_mesh(obj.data)
    bm.free()


def add_cube(name, loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


# ---------------------------------------------------------------------------
# 3. Modular blocks — one more block than Tier2 S4 (SS3.3 of the design system)
# ---------------------------------------------------------------------------

# Block 0: step ring (wider, short) -> reads 3x3 at the base
steps = add_cube("Landmark_Steps", (0, 0, 0.075), (1.45, 1.45, 0.15))
steps.data.materials.append(mat_plaza)

# Block 1: plaza base, 2x2 footprint
base = add_cube("Landmark_PlazaBase", (0, 0, 0.15 + 0.25), (1.0, 1.0, 0.5))
assign_shading_formula(base)

# Block 2: tower shaft, setback ~20% per Tier1 S2 setback convention (SS3.2)
shaft = add_cube("Landmark_TowerShaft", (0, 0, 0.4 + 0.6), (0.8, 0.8, 1.2))
assign_shading_formula(shaft)

# Block 3: belfry block, offset the way Tier2 S3's 2nd upper block is offset (SS3.3) - kept
# centered here (a landmark is symmetric on purpose) but narrower again, per convention.
# Half-extents after scale: X=Y=0.5*0.55=0.275, Z=0.5*0.7=0.35.
belfry_z = 0.4 + 1.2 + 0.35
belfry = add_cube("Landmark_Belfry", (0, 0, belfry_z), (0.55, 0.55, 0.7))

# --- Boolean-cut arch openings -------------------------------------------------------------
# Round-5 fix (top-priority finding): the round-4 cutters were centred at offset=0.6 against a
# belfry half-width of 0.275 -- they never reached the solid at all (verified by hand-computing
# the geometry above, not assumed). Replaced with 2 through-tunnels, one per horizontal axis,
# both centred on the belfry (no offset arithmetic that can drift out of range again) and both
# using a depth (1.4) far larger than the 0.55 full belfry width, so an intersection is
# geometrically guaranteed regardless of small parameter tweaks later.
arch_r = 0.18
arch_center_z = belfry_z - 0.05
tunnel_depth = 1.4

bm_pre = bmesh.new()
bm_pre.from_mesh(belfry.data)
pre_faces = len(bm_pre.faces)
bm_pre.free()
print(f"[diagnostic] belfry faces before arch cut: {pre_faces}")

cutters = []
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=arch_r, depth=tunnel_depth,
                                     location=(0, 0, arch_center_z))
cyl_y = bpy.context.active_object
cyl_y.name = "ArchTunnel_Y"
cyl_y.rotation_euler = (math.pi / 2, 0, 0)  # cylinder's local Z axis -> world Y axis
cutters.append(cyl_y)

bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=arch_r, depth=tunnel_depth,
                                     location=(0, 0, arch_center_z))
cyl_x = bpy.context.active_object
cyl_x.name = "ArchTunnel_X"
cyl_x.rotation_euler = (0, math.pi / 2, 0)  # cylinder's local Z axis -> world X axis
cutters.append(cyl_x)

for cutter in cutters:
    mod = belfry.modifiers.new(name=f"bool_{cutter.name}", type="BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    cutter.hide_render = True
    cutter.hide_set(True)

bpy.context.view_layer.objects.active = belfry
for mod in list(belfry.modifiers):
    bpy.ops.object.modifier_apply(modifier=mod.name)
for cutter in cutters:
    bpy.data.objects.remove(cutter, do_unlink=True)

# PROVE_THE_CUT: a boolean DIFFERENCE that actually intersects the solid always changes the face
# count. If it didn't, fail loudly here instead of silently rendering/exporting an uncut block
# (this exact silent failure is what round 4 shipped).
bm_post = bmesh.new()
bm_post.from_mesh(belfry.data)
post_faces = len(bm_post.faces)
bm_post.free()
print(f"[diagnostic] belfry faces after arch cut: {post_faces}")
if post_faces <= pre_faces:
    raise RuntimeError(
        f"Belfry arch boolean cut produced no new geometry (faces {pre_faces} -> {post_faces}). "
        "The cutter did not intersect the belfry solid -- fix arch_r/arch_center_z/tunnel_depth "
        "before trusting any render from this run."
    )

# re-assign after boolean rebuilds the mesh; cavity_mat lights the tunnel-wall reveal faces with
# the text.primary token so the beacon core reads against a dark backdrop (SS4 legibility calc:
# ~1.3:1 without this vs. ~5.5:1 with it — see design note).
assign_shading_formula(belfry, cavity_mat=mat_cavity, interior_radius=arch_r + 0.06)

# Beacon core hanging inside the crossing point of both tunnels — 8-sided (faceted) rather than
# 16-sided (smooth): a crystal/beacon read, not a literal round bronze church bell (SS1
# originality note). Sized/placed to sit inside the tunnel's vertical opening with margin on both
# sides (tunnel spans arch_center_z +/- arch_r = -0.23..+0.13 relative to belfry_z; beacon spans
# -0.15..+0.05 relative to belfry_z — comfortably inside).
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.11, radius2=0.03, depth=0.20,
                                 location=(0, 0, arch_center_z))
bell = bpy.context.active_object
bell.name = "Landmark_BeaconCore"
bell.data.materials.append(mat_coin)

# Roof cap: pyramid, 4-gon cone rotated 45deg to sit square on the belfry
roof_z = belfry_z + 0.35 + 0.35
bpy.ops.mesh.primitive_cone_add(
    vertices=4, radius1=0.55, depth=0.7, location=(0, 0, roof_z), rotation=(0, 0, math.radians(45))
)
roof = bpy.context.active_object
roof.name = "Landmark_RoofCap"
roof.data.materials.append(mat_top)

# Ridge cap trim: a small torus collar at the roof apex, closing the token table's "roof ridge cap
# -> color.currency.coin" row for real (previously the gold read was carried by the beacon alone).
bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.025, location=(0, 0, roof_z + 0.34))
ridge_cap = bpy.context.active_object
ridge_cap.name = "Landmark_RoofRidgeCap"
ridge_cap.data.materials.append(mat_coin)

# +1 block over Tier2 S4: finial spire + gem (the landmark's one extra block, SS3.3)
spire_z = roof_z + 0.35 + 0.2
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.04, depth=0.4, location=(0, 0, spire_z))
spire = bpy.context.active_object
spire.name = "Landmark_Spire"
spire.data.materials.append(mat_secondary)

# Faceted low-poly gem (ico_sphere, subdivisions=1) instead of a smooth uv_sphere — the other
# concrete originality departure (SS1). Matches the note's token table: color.secondary.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.13, location=(0, 0, spire_z + 0.25))
orb = bpy.context.active_object
orb.name = "Landmark_FinialGem"
orb.data.materials.append(mat_secondary)

# ---------------------------------------------------------------------------
# 4. Bunting garland — 7 flags on a string, ringing the plaza edge (SS4.1)
# ---------------------------------------------------------------------------

n_flags = len(CATEGORY_HEXES)
ring_r = 0.95          # just past the step edge (steps half-width 0.725) — SS4 legibility calc
FLAG_W, FLAG_H = 0.30, 0.26
FLAG_Z = 0.30
STEPS_TOP_Z = 0.15      # steps: center 0.075 + half-height 0.075

# Round-5 fix (A4 finding #10): flags previously had no string/pole connecting them to anything.
# Ring + poles are placed at the SAME FLAG_Z / ring_r constants the flags below already use, so
# they coincide exactly with no separate alignment step.
bpy.ops.mesh.primitive_torus_add(major_radius=ring_r, minor_radius=0.012, location=(0, 0, FLAG_Z))
garland = bpy.context.active_object
garland.name = "Bunting_Garland"
garland.data.materials.append(mat_cord)

for i in range(n_flags):
    angle = (i / n_flags) * math.tau
    x, y = ring_r * math.cos(angle), ring_r * math.sin(angle)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.012, depth=FLAG_Z - STEPS_TOP_Z,
                                         location=(x, y, (FLAG_Z + STEPS_TOP_Z) / 2))
    pole = bpy.context.active_object
    pole.name = f"Bunting_Pole_{i}"
    pole.data.materials.append(mat_cord)

flag_group = []
for i, mat in enumerate(mat_flags):
    angle = (i / n_flags) * math.tau
    x, y = ring_r * math.cos(angle), ring_r * math.sin(angle)
    bpy.ops.mesh.primitive_plane_add(size=0.001, location=(x, y, FLAG_Z))
    flag = bpy.context.active_object
    flag.name = f"Bunting_{i}"
    bm = bmesh.new()
    verts = [
        bm.verts.new((0, 0, 0)),
        bm.verts.new((FLAG_W, 0, 0)),
        bm.verts.new((FLAG_W / 2, 0, -FLAG_H)),
    ]
    bm.faces.new(verts)
    bm.to_mesh(flag.data)
    bm.free()
    flag.data.materials.append(mat)
    flag.rotation_euler = (math.pi / 2, 0, angle + math.pi / 2)
    flag_group.append(flag)

# ---------------------------------------------------------------------------
# 4b. Polish — bevel (soft, non-black edges) + best-effort UV unwrap on the main blocks.
#     Belfry is excluded from bevel: new bevel faces near the tunnel mouth risk being caught by
#     the cavity radius-heuristic above, which would paint stray dark patches on its exterior.
# ---------------------------------------------------------------------------

for obj in (steps, base, shaft, roof):
    add_bevel(obj)

for obj in (steps, base, shaft, belfry, roof, spire, orb):
    smart_unwrap(obj)

# ---------------------------------------------------------------------------
# 5. Lighting — 3-point rig approximating the daytime Light2D keyframe (09:00, #FFFFFF, 1.0)
# ---------------------------------------------------------------------------

bpy.ops.object.light_add(type="SUN", location=(4, -4, 6))
key = bpy.context.active_object
key.data.energy = 3.0
key.data.color = (1.0, 1.0, 1.0)
key.rotation_euler = (math.radians(55), 0, math.radians(35))

# Round-5 fix (A2 finding #4): the fill light was COLOR_SECONDARY (lavender) at energy=1.0, strong
# enough to hue-shift every side face away from its authored hex. White fill removes the whole
# hue-shift class. A tinted rim accent, if wanted later, belongs at <=0.15 energy on its own axis.
bpy.ops.object.light_add(type="SUN", location=(-4, 3, 3))
fill = bpy.context.active_object
fill.data.energy = 0.6
fill.data.color = (1.0, 1.0, 1.0)
fill.rotation_euler = (math.radians(60), 0, math.radians(-120))

# ---------------------------------------------------------------------------
# 6. Cameras — orthographic, matching the design system's isometric convention
#    (00-art-design-system.md SS2: custom sort axis (0,1,-0.26); approximated here as a classic
#    ~35.264deg isometric elevation, rotated around Z for distinct angles)
# ---------------------------------------------------------------------------

CAM_DIST = 6.0
CAM_ELEV = math.radians(35.264)
TOWER_MID_Z = 1.6

# Round-5 fix (A1 finding #2): 45/135/-45 were all corner views of an axis-aligned cube and could
# never frame a face-normal-aligned arch. Now 90/0/180 face the belfry's arch openings head-on,
# plus a 4th, tighter close-up centred on the belfry band. Filenames kept for the first 3 (legacy
# from earlier rounds) so a re-run overwrites them in place instead of leaving stale duplicates.
views = [
    ("front_three_quarter", math.radians(90), 4.5, TOWER_MID_Z),
    ("side_profile", math.radians(0), 4.5, TOWER_MID_Z),
    ("back_three_quarter", math.radians(180), 4.5, TOWER_MID_Z),
    ("belfry_closeup", math.radians(90), 1.6, belfry_z),
]

scene = bpy.context.scene
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.image_settings.file_format = "PNG"

for engine_id in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try:
        scene.render.engine = engine_id
        break
    except TypeError:
        continue

for name, az, ortho_scale, aim_z in views:
    x = CAM_DIST * math.cos(CAM_ELEV) * math.cos(az)
    y = CAM_DIST * math.cos(CAM_ELEV) * math.sin(az)
    z = CAM_DIST * math.sin(CAM_ELEV) + aim_z
    bpy.ops.object.camera_add(location=(x, y, z))
    cam = bpy.context.active_object
    cam.name = f"Cam_{name}"
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho_scale
    direction = (0 - x, 0 - y, aim_z - z)
    quat = mathutils.Vector(direction).to_track_quat("-Z", "Y")
    cam.rotation_euler = quat.to_euler()

    scene.camera = cam
    scene.render.filepath = os.path.join(RENDER_DIR, f"landmark_{name}.png")
    bpy.ops.render.render(write_still=True)

print(f"Renders written to {RENDER_DIR}")

# ---------------------------------------------------------------------------
# 7. Export — FBX + glTF (.glb) into Assets/Art/Blender/, covered by lifetown/.gitattributes LFS
#    rules for *.blend/*.fbx/*.glb (verified present: .gitattributes lines 2-4).
#    Unity import spec pinned in the design note SS7 — scale factor 1, pivot at world origin
#    (model floor sits exactly at z=0), axis convention matches these explicit exporter args.
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.select_set(True)

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
