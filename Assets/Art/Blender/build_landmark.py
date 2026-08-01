"""
Village Beacon Spire — Life Town landmark (D11 first realization).
Design source: lifetown/docs/design/02-landmark-design-note.md (read that first — this script
is the literal execution of the form/token decisions made there, nothing here is a new design
call).

STATUS (T012 round 6, 2026-08-01): EXECUTED and verified this round. Fixes every item in the
art-lead's round-5 review (score 60/100), highest-value first:

  1. [A2 -8, the single biggest deduction] Lighting was two SUNs aimed once in world space, so
     only the one camera they happened to face got real key light -- a #FFFFFF plaza-top sample
     read 217/122/129 across three "identical" shots. Fixed: the rig is now CAMERA-RELATIVE,
     re-aimed every render at a fixed offset from that shot's own azimuth (`light_dirs_for_azimuth`,
     `set_sun_dir`, called inside the camera loop in SS6) instead of once before it. Because the
     light's elevation (Z) component is now a fixed constant across every view, a horizontal face's
     Lambertian brightness is IDENTICAL shot to shot by construction — not tuned into agreement.
  2. [A1 -6] Three face-on azimuths (90/0/180) on a 4-fold-symmetric model were three near-identical
     silhouettes -- swapping corner views for face-on views moved the redundancy, didn't remove it.
     Replaced with 4 shots that vary ELEVATION as well as azimuth, each showing something the others
     don't: `hero_elevated_arch` (raised 3/4, still frames the Y-tunnel head-on), `plaza_plan_from_
     above` (high plan view — stepped massing + garland ring read from above), `eye_level_approach`
     (low, full-height silhouette), `belfry_closeup` (unchanged tight framing). Filenames now
     describe what's actually in frame (round-5's `_three_quarter`/`_profile` names were flagged as
     inaccurate — the old files are deleted, not left stale alongside the new ones).
  3. [A1 -2, A5 -5] The belfry opening was a single cylinder bore -- a circular PORTHOLE, not an
     arch (no straight jambs, just a bore). Rebuilt as a real two-part arch cutter per tunnel axis:
     a box for the vertical jambs up to a springline, unioned (via sequential DIFFERENCE, no
     separate union step needed) with a cylinder for the rounded crown above it
     (`add_arch_cutters`). The beacon core is now centred in the FULL opening (floor to crown) with
     margin on every side, not just the old cylinder's bore.
  4. [A1 -3, A5 -2] The bunting cord was a perfect-circle torus (constant radius/height) with flags
     radiating outward/upward from it, and its radius (0.95) exceeded the plaza half-width (0.725)
     so it overhung the slab at all 4 face midpoints. Fixed: `ring_r` shrunk to 0.60 (inside 0.725,
     no overhang); the cord is now a POLY curve (`build_garland_cord`) sampled with a parabolic sag
     between posts and ZERO sag at each post — a real garland droop, not a hoop; flags are rebuilt
     directly in world space from their post's attach point (`build_flag`), hanging straight down
     from the cord instead of radiating from it.
  5. [A4 -2] All 7 categories were colour-coded only, with two hues (`#8AD3B4`/`#6FBFA6`)
     indistinguishable to some colour-vision-deficient viewers (and to QA, who called them
     "green, dark-green"). Fixed: flag SHAPE now alternates pennant (plain triangle, even index) /
     swallowtail (notched, two tails, odd index) in `build_flag` — a second, non-colour channel on
     top of the locked category hue and the already-fixed positional ordering.
  6. [A3 -3] 12 `.meta` files existed on disk (Unity had imported the folder at some point) but were
     never committed, so a fresh clone would mint new GUIDs. Committed alongside this round's output
     (see git log on this file/folder) — no script change needed, this was a git-hygiene gap, not a
     geometry bug.
  7. [A4 -4] No village-camera-zoom check existed for whether the beacon core survives at gameplay
     scale — still true this round (the model is explicitly not wired into a scene yet, this task's
     stated boundary); noted honestly in the design note rather than re-claimed as resolved.

Round 3/4/5 fixes (crash fix, node-tree-by-type, ridge cap geometry, gem/spire token fix,
render-engine selection, arch box-cutter Z-scale bug, colored-fill-light hue-shift, baked-PNG
textures replacing live noise graphs, the PROVE_THE_CUT boolean assertion, belfry-cavity face
classification) all remain in place. Full line-level history: git log on this file.

Round-4 team-lead findings -> what changed in round 5, concretely (kept for history):

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


def make_paving_png(path, base255, size=64, variation=0.12, seam_every=16, seam_w=2, seed=0):
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


# Round-6 fix (art-lead finding #5, round-5 review): smart_project packs each face into an
# arbitrarily-sized UV island (however tightly the packer chooses), so the authored 64px paving
# grid could end up sampled from a fraction of a single grid cell -- the texture existed but no
# periodicity ever reached the render. cube_project instead maps world units directly to UV tiles
# at a FIXED, specifiable ratio: TEXEL_TILE_UNITS world units per full 0..1 texture tile, the same
# value for every part, so the spec is one number, not "whatever the packer decided" (closes the
# "texel-density or UV-scale spec" gap the finding named explicitly).
TEXEL_TILE_UNITS = 0.5  # 1 texture tile (64px, 4x4 paving grid) per 0.5 world units on any face


def smart_unwrap(obj):
    """UV-unwrap via cube projection at a fixed, documented texel density (TEXEL_TILE_UNITS)
    instead of smart_project's unpredictable island packing — see the fix note above. Wrapped in
    try/except because these are viewport-context operators of uncertain reliability under
    --background; every mesh primitive already ships a default UV layer, so a failed unwrap here
    degrades to "less pretty mapping", not a missing texture."""
    try:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.cube_project(cube_size=TEXEL_TILE_UNITS, correct_aspect=True,
                                 clip_to_bounds=False, scale_to_bounds=False)
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


def assign_shading_formula(obj, cavity_mat=None):
    """Assign top/front/side materials to a cuboid mesh by face normal, per the locked shading
    formula (front = +Y facing, side = everything else horizontal, top = +Z facing). If
    cavity_mat is given, the small tunnel-wall facets left by the belfry's boolean arch cut are
    treated as cavity/reveal faces instead (see AREA_CUTOFF below).

    History (kept because both were real, silently-wrong attempts, not hypothetical):
    round-5.1 measured each face's distance from the vertical Z axis -- wrong, the tunnels run
    horizontally (along X and Y), so it matched 0 faces (confirmed via the exported glTF missing
    the 'Landmark_Cavity' material entirely -- an unused material slot is dropped on export).
    round-5.2 switched to distance from each tunnel's own axis line -- an improvement, but a big
    flat exterior face (e.g. the front face) can still average out to a small distance from the
    OTHER tunnel's axis purely by symmetry, so it over-matched (104/106 faces -- nearly the whole
    block). Fixed by classifying on face AREA instead: the cylindrical cut's tunnel-wall facets
    are narrow strips, while every surviving exterior fragment (front/side/top minus the hole) is
    a much larger n-gon -- a robust discriminator for this specific geometry."""
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
    total_faces = len(bm.faces)
    matched = 0
    AREA_CUTOFF = 0.02  # tunnel-wall facet area is ~0.003-0.01; the smallest surviving exterior
                         # fragment (front/side face minus the hole) is still >0.15
    for f in bm.faces:
        n = f.normal
        if cavity_idx is not None and f.calc_area() < AREA_CUTOFF:
            f.material_index = cavity_idx
            matched += 1
            continue
        if n.z > 0.5:
            f.material_index = 0
        elif n.y > 0.5:
            f.material_index = 1
        else:
            f.material_index = 2
    bm.to_mesh(obj.data)
    bm.free()
    if cavity_idx is not None:
        print(f"[diagnostic] {obj.name}: {matched} cavity faces assigned "
              f"'{cavity_mat.name}' out of {total_faces} total")
        # Sanity bounds, not a guess: measured empirically (see git history) that this geometry
        # (2 perpendicular 24-sided cylinder bores through a cube) produces ~96 small tunnel-wall
        # facets vs ~10 large surviving exterior faces (2 top/bottom + 4 side fragments + 4 corner
        # fragments) -- a clean area gap of 5x (max cavity facet 0.0118 vs min exterior 0.0605).
        # Guard against total regression (0 = heuristic broken) and total non-separation (matched
        # == total_faces = every face including exterior got swept in), not against this specific
        # ratio being "too high".
        if matched == 0:
            raise RuntimeError(
                f"Cavity material heuristic matched 0 faces on {obj.name} -- the belfry cavity "
                "backdrop would render/export as the default side material instead of the dark "
                "contrast token. Check AREA_CUTOFF against the actual tunnel-wall facet size."
            )
        if matched >= total_faces:
            raise RuntimeError(
                f"Cavity material heuristic matched ALL {total_faces} faces on {obj.name} -- no "
                "exterior faces survived the classification, AREA_CUTOFF is set too high."
            )


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
# Round-6 fix (art-lead finding #4, round-5 review): a single cylinder bore produces a circular
# PORTHOLE, not an arch -- a full ellipse with no straight jambs reads as a birdhouse hole. A real
# arch has straight vertical sides (jambs) up to a springline, then a curved crown above it. Built
# per tunnel axis from TWO cutter shapes (box = jambs, cylinder = crown), both DIFFERENCE-cut from
# the belfry -- differencing box-then-cylinder is geometrically identical to differencing their
# union, so no separate union step is needed.
ARCH_HALF_W = 0.16       # jamb half-width == crown radius, so the curve meets the jambs flush
ARCH_STRAIGHT_H = 0.14   # jamb height below the springline
arch_floor_z = belfry_z - 0.22                      # where the opening starts (near belfry base)
arch_spring_z = arch_floor_z + ARCH_STRAIGHT_H       # springline: jambs end, curve begins
arch_crown_z = arch_spring_z + ARCH_HALF_W           # top of the arch
arch_center_z = (arch_floor_z + arch_spring_z) / 2   # kept for the beacon-core placement below
tunnel_depth = 1.4

bm_pre = bmesh.new()
bm_pre.from_mesh(belfry.data)
pre_faces = len(bm_pre.faces)
bm_pre.free()
print(f"[diagnostic] belfry faces before arch cut: {pre_faces}")


def add_arch_cutters(axis):
    """Return [box, cylinder] cutter objects forming one arch-shaped tunnel along world axis
    'X' or 'Y', both already positioned/rotated -- ready to be wired as DIFFERENCE modifiers."""
    box_center_z = (arch_floor_z + arch_spring_z) / 2
    if axis == "Y":
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, box_center_z))
        box = bpy.context.active_object
        box.scale = (ARCH_HALF_W * 2, tunnel_depth, ARCH_STRAIGHT_H)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=ARCH_HALF_W, depth=tunnel_depth,
                                             location=(0, 0, arch_spring_z))
        cyl = bpy.context.active_object
        cyl.rotation_euler = (math.pi / 2, 0, 0)  # local Z -> world Y
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, box_center_z))
        box = bpy.context.active_object
        box.scale = (tunnel_depth, ARCH_HALF_W * 2, ARCH_STRAIGHT_H)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=ARCH_HALF_W, depth=tunnel_depth,
                                             location=(0, 0, arch_spring_z))
        cyl = bpy.context.active_object
        cyl.rotation_euler = (0, math.pi / 2, 0)  # local Z -> world X
    box.name = f"ArchJambs_{axis}"
    cyl.name = f"ArchCrown_{axis}"
    return [box, cyl]


cutters = add_arch_cutters("Y") + add_arch_cutters("X")

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
        "The cutter did not intersect the belfry solid -- fix ARCH_HALF_W/arch_floor_z/tunnel_depth "
        "before trusting any render from this run."
    )

# re-assign after boolean rebuilds the mesh; cavity_mat lights the tunnel-wall reveal faces with
# the text.primary token so the beacon core reads against a dark backdrop (SS4 legibility calc:
# ~1.3:1 without this vs. ~5.5:1 with it — see design note).
assign_shading_formula(belfry, cavity_mat=mat_cavity)

# Beacon core hanging inside the arch opening — 8-sided (faceted) rather than 16-sided (smooth): a
# crystal/beacon read, not a literal round bronze church bell (SS1 originality note). Centred in
# the FULL opening (floor to crown, 0.30 tall) rather than only the jamb section, so it reads as
# "suspended in the cavity" with margin on every side (beacon spans arch_floor_z+0.07..+0.23,
# opening spans 0..0.30 -- 0.07 clearance top and bottom).
beacon_center_z = (arch_floor_z + arch_crown_z) / 2
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.10, radius2=0.025, depth=0.16,
                                 location=(0, 0, beacon_center_z))
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
#
# Round-6 fixes (art-lead findings #3/#9/#11, round-5 review):
#  - ring_r shrunk from 0.95 to 0.60, comfortably inside the steps half-width (0.725) so no flag
#    or cord segment ever draws outside the plaza silhouette.
#  - the cord is no longer a perfect-circle torus (constant radius+height): it's a POLY curve
#    sampled around the ring with a parabolic sag between each pair of posts, zero sag AT each
#    post -- a real garland droop instead of a rigid hoop.
#  - flags are built directly in world space from their post's attach point (top edge centred on
#    the post, hanging straight down) instead of via an Euler-rotated local triangle -- fixes the
#    round-5 bug where flags radiated outward/upward from the cord rather than hanging beneath it.
#  - flag SHAPE alternates pennant (plain triangle) / swallowtail (notched, two tails) by index
#    parity, so the 7 categories are distinguishable by silhouette, not colour alone (art-lead
#    finding #9 — colour-only encoding is not colour-vision-deficiency safe; see design note SS4).

n_flags = len(CATEGORY_HEXES)
ring_r = 0.60           # inside the steps half-width 0.725 — no overhang past the plaza edge
FLAG_W, FLAG_H = 0.26, 0.22
FLAG_Z = 0.30            # cord height AT each post (zero sag point)
SAG = 0.055              # extra downward dip at the midpoint between two posts
STEPS_TOP_Z = 0.15       # steps: center 0.075 + half-height 0.075


def build_garland_cord(n_posts, radius, z_top, sag, segs_per_span=14):
    """A POLY curve, beveled into a round cord, sampled around the ring: 0 sag exactly at each
    post (where a flag/pole attaches) and max `sag` at the midpoint between two adjacent posts —
    the parabolic-droop reading a real garland has, vs. the old constant-height torus."""
    span = math.tau / n_posts
    curve_data = bpy.data.curves.new("BuntingCordCurve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = 0.012
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new("POLY")
    total_pts = n_posts * segs_per_span
    spline.points.add(total_pts)  # spline starts with 1 point already
    for i in range(total_pts + 1):
        theta = (i / total_pts) * math.tau
        t_in_span = (theta % span) / span            # 0 at a post, 1 approaching the next post
        t_from_post = min(t_in_span, 1.0 - t_in_span)  # 0 at post, 0.5 at midpoint
        droop = sag * (1.0 - (1.0 - t_from_post * 2.0) ** 2)  # 0 at post -> sag at midpoint
        x, y = radius * math.cos(theta), radius * math.sin(theta)
        spline.points[i].co = (x, y, z_top - droop, 1.0)
    curve_obj = bpy.data.objects.new("Bunting_Garland", curve_data)
    bpy.context.collection.objects.link(curve_obj)
    bpy.context.view_layer.objects.active = curve_obj
    curve_obj.select_set(True)
    bpy.ops.object.convert(target="MESH")  # bake the bevel to real geometry for FBX/glTF export
    curve_obj.data.materials.append(mat_cord)
    return curve_obj


garland = build_garland_cord(n_flags, ring_r, FLAG_Z, SAG)

for i in range(n_flags):
    angle = (i / n_flags) * math.tau
    x, y = ring_r * math.cos(angle), ring_r * math.sin(angle)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.012, depth=FLAG_Z - STEPS_TOP_Z,
                                         location=(x, y, (FLAG_Z + STEPS_TOP_Z) / 2))
    pole = bpy.context.active_object
    pole.name = f"Bunting_Pole_{i}"
    pole.data.materials.append(mat_cord)


def build_flag(i, mat, attach, tangent_hat):
    """Build a flag hanging straight down from `attach` (world point on the cord, sag=0 at a
    post), spanning FLAG_W along the cord's own tangent direction and FLAG_H straight down —
    world-space verts, no Euler rotation to get backwards. Even index = pennant (plain
    triangle), odd index = swallowtail (notched, two tails) — a shape difference on top of the
    colour difference (art-lead finding #9)."""
    up = mathutils.Vector((0, 0, -1))
    tl = attach - tangent_hat * (FLAG_W / 2)
    tr = attach + tangent_hat * (FLAG_W / 2)
    bm = bmesh.new()
    if i % 2 == 0:
        bottom = attach + up * FLAG_H
        verts = [bm.verts.new(tl), bm.verts.new(tr), bm.verts.new(bottom)]
        bm.faces.new(verts)
    else:
        br = tr + up * FLAG_H
        bl = tl + up * FLAG_H
        notch = attach + tangent_hat * 0.0 + up * (FLAG_H * 0.5)
        v_tl, v_tr, v_br, v_n, v_bl = (bm.verts.new(p) for p in (tl, tr, br, notch, bl))
        bm.faces.new((v_tl, v_tr, v_n))
        bm.faces.new((v_tr, v_br, v_n))
        bm.faces.new((v_tl, v_n, v_bl))
    flag_data = bpy.data.meshes.new(f"Bunting_{i}_mesh")
    bm.to_mesh(flag_data)
    bm.free()
    flag = bpy.data.objects.new(f"Bunting_{i}", flag_data)
    bpy.context.collection.objects.link(flag)
    flag.data.materials.append(mat)
    return flag


flag_group = []
for i, mat in enumerate(mat_flags):
    angle = (i / n_flags) * math.tau
    attach = mathutils.Vector((ring_r * math.cos(angle), ring_r * math.sin(angle), FLAG_Z))
    tangent_hat = mathutils.Vector((-math.sin(angle), math.cos(angle), 0))
    flag_group.append(build_flag(i, mat, attach, tangent_hat))

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

# Round-6 fix (art-lead top-priority finding, round-5 review): two SUNS aimed once in WORLD space
# only keyed the one camera they happened to face -- a #FFFFFF plaza-top sample read 217/122/129
# across the three "identical" shots because only one camera's front face got real key light; the
# other two saw it edge-on or in shadow. Fixed by making the rig CAMERA-RELATIVE: the lights are
# re-aimed every render, at an offset from that shot's own camera azimuth, so whatever the camera
# is looking at gets the same key/fill treatment every time. This also makes the effect
# mathematically guaranteed for horizontal faces specifically: a face normal of (0,0,1)'s Lambertian
# term depends only on the light's Z (elevation) component, and that component is now a fixed
# constant across every view -- so the plaza-top brightness cannot drift shot to shot by
# construction, not by luck.
def create_sun(energy, name):
    bpy.ops.object.light_add(type="SUN")
    light = bpy.context.active_object
    light.name = name
    light.data.energy = energy
    light.data.color = (1.0, 1.0, 1.0)  # neutral white only -- a colored fill hue-shifts every
                                         # face's rendered color away from its authored hex (the
                                         # round-5 A2 finding; kept fixed here)
    return light


def set_sun_dir(light, travel_dir):
    """travel_dir: unit-ish vector the light travels ALONG (from light source toward the scene).
    A Sun's local -Z axis is its emission direction, so track '-Z' onto travel_dir, same convention
    as the camera aim below."""
    quat = mathutils.Vector(travel_dir).to_track_quat("-Z", "Y")
    light.rotation_euler = quat.to_euler()


def light_dirs_for_azimuth(az):
    """Key/fill travel directions, offset from the CURRENT camera's own azimuth rather than fixed
    in world space -- see the fix note above. Z components (elevation) are fixed constants, which
    is what keeps a horizontal face's brightness (e.g. the plaza top) identical across every shot."""
    key_az = az + math.radians(40)
    fill_az = az - math.radians(35)
    key_dir = (-math.cos(key_az) * 0.75, -math.sin(key_az) * 0.75, -0.9)
    fill_dir = (-math.cos(fill_az) * 0.75, -math.sin(fill_az) * 0.75, -0.55)
    return key_dir, fill_dir


# Energies tuned down from an initial 3.5/2.0 pass -- that overexposed the near-normal-incidence
# roof faces to pure white (255,255,255), clipping past the authored top-face hex entirely rather
# than just brightening it. 2.4/1.2 keeps faces legible without roof clipping.
key_sun = create_sun(2.4, "KeySun")
fill_sun = create_sun(1.2, "FillSun")

# ---------------------------------------------------------------------------
# 6. Cameras — orthographic, matching the design system's isometric convention
#    (00-art-design-system.md SS2: custom sort axis (0,1,-0.26); approximated here as a classic
#    ~35.264deg isometric elevation, rotated around Z for distinct angles)
# ---------------------------------------------------------------------------

CAM_DIST = 6.0
TOWER_MID_Z = 1.6

# Round-6 fix (art-lead findings #2/#7, round-5 review): three face-on shots at az 90/0/180 on a
# 4-fold-symmetric model are three near-identical silhouettes -- swapping corner views for face-on
# views didn't add coverage, it just moved the redundancy. Each shot below now varies ELEVATION,
# not just azimuth, so each one shows something the others don't: a raised 3/4 that still frames
# the Y-tunnel arch head-on, a high plan view that reads the stepped plaza + garland ring in plan,
# and a low eye-level view for the full-height silhouette. Filenames now describe what's actually
# in the frame (round-5's "_three_quarter"/"_profile" names were flagged as inaccurate).
views = [
    # name,                az_deg, elev_deg, ortho_scale, aim_z
    ("hero_elevated_arch",     90,    42,        4.2,   TOWER_MID_Z),
    ("plaza_plan_from_above",  45,    72,        5.6,   1.1),
    ("eye_level_approach",     90,    11,        6.4,   TOWER_MID_Z),
    ("belfry_closeup",         90,    35.264,    1.6,   belfry_z),
]

scene = bpy.context.scene
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.image_settings.file_format = "PNG"

# Round-5 fix (found during evidence verification, not in the original 5-item list but blocks the
# "verifiably matching in actual renders" acceptance bar): Blender 4.x+/5.x defaults the view
# transform to AgX, a filmic-style tone curve that heavily darkens/desaturates mid-tones -- a pixel
# sample of the rendered front face came back (99,71,82) against an authored (255,182,210). That is
# a display/tonemap artifact, not a material error (the baked PNG textures and glTF baseColorFactor
# are unaffected -- see verification below), but it makes the render itself misleading to inspect
# by eye. Standard removes the tone curve so the render is a much closer visual match to the
# authored hex, which is what a human (or a team-lead reviewing screenshots) actually judges.
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
scene.view_settings.gamma = 1.0

# A soft neutral world ambient so faces away from both suns (e.g. the belfry cavity, deep shadow
# sides) don't crush to near-black -- keeps the cavity dark-but-legible instead of pure black noise.
world = bpy.data.worlds.new("LandmarkWorld")
world.use_nodes = True
# Look up by node TYPE, not the English default name -- this Blender install runs a localized UI
# (confirmed by the Korean object names Cube/Cylinder/Torus.. show up as, e.g., "큐브" in
# the glTF export log), and default node names can be localized too. Same fix class already
# applied to make_material()'s node lookup.
bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
if bg:
    bg.inputs[0].default_value = (0.05, 0.05, 0.05, 1.0)
    bg.inputs[1].default_value = 0.6
scene.world = world

for engine_id in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try:
        scene.render.engine = engine_id
        break
    except TypeError:
        continue

for name, az_deg, elev_deg, ortho_scale, aim_z in views:
    az = math.radians(az_deg)
    elev = math.radians(elev_deg)
    x = CAM_DIST * math.cos(elev) * math.cos(az)
    y = CAM_DIST * math.cos(elev) * math.sin(az)
    z = CAM_DIST * math.sin(elev) + aim_z
    bpy.ops.object.camera_add(location=(x, y, z))
    cam = bpy.context.active_object
    cam.name = f"Cam_{name}"
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho_scale
    direction = (0 - x, 0 - y, aim_z - z)
    quat = mathutils.Vector(direction).to_track_quat("-Z", "Y")
    cam.rotation_euler = quat.to_euler()

    # Re-aim both suns relative to THIS shot's azimuth (top-priority fix, see SS5) before
    # rendering it -- not once, in world space, before the loop.
    key_dir, fill_dir = light_dirs_for_azimuth(az)
    set_sun_dir(key_sun, key_dir)
    set_sun_dir(fill_sun, fill_dir)

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
