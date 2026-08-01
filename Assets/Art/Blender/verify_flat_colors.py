"""
Verification check for build_landmark.py's flat/toon requirement (round 14 rewrite).

ROUND 13'S BUG (fixed this round, the round-14 TOP FIX): every surface's shadow band used ONE
shared, hue-UNRELATED ink (#533B6B). From camera angles showing only shadow-facing sides, the wall's
own hue dropped to 0 rendered pixels. THIS ROUND'S FIX: wall/roof/gold each get a same-hue derived
shadow (`derive_shadow()` in build_landmark.py) -- `wall_shadow`, `roof_shadow`, `gold_shadow` are
now real, separately-registered palette entries this script checks for. The one shared dark ink is
renamed `void_ink` and its role is scoped explicitly to door/window cavities + the fake-AO skirt --
never a lit surface's own shadow band again.

ERODE_SIZE stays fixed at 9px (round 13's fix, not a finding this round -- not re-swept against
these renders).

Also carries the CVD (colour-vision-deficiency) simulation over the 7 bunting hexes -- a documented
linear-RGB approximation (Machado/Vienot-style simplified matrices), not a medical-grade model, but
a real, printed, referenceable number.

Run: py verify_flat_colors.py
Requires numpy + Pillow (both present in this environment).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RENDER_DIR = Path(r"C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\renders")

# Authored palette, hand-copied from build_landmark.py's own printed [diagnostic] palette output
# (round 14: 8 structural, incl. 3 same-hue base+shadow pairs, + 7 bunting = 15 distinct pixel
# values -- see design note SS2 for why this is an honest count against the brief's "base hues" cap.
# Every structural hex traces to a real 00-art-design-system.md token; see build_landmark.py SS0 for
# the token->hex mapping.
PALETTE = {
    "wall_base": "#FF408B", "wall_shadow": "#8F1847",
    "roof_base": "#431AAD", "roof_shadow": "#200761",
    "gold_base": "#E0A622", "gold_shadow": "#876009",
    "trim": "#FAECC8", "void_ink": "#533B6B",
    "bunting_reading": "#7A4CEF", "bunting_study": "#4AC9E8", "bunting_work": "#FFCA52",
    "bunting_exercise": "#44D396", "bunting_hobby": "#34A380", "bunting_mind": "#FF9C52",
    "bunting_game": "#FF5271",
}
# Utility prop, NOT part of the landmark's 12-colour palette / the brief's 8-12 cap -- a plain grey
# 1x1x1 cube standing for one grid cell, present only in landmark_toon_village_scale.png for scale
# reference (build_landmark.py SS "village_scale" view). Registered here so the audit doesn't flag
# its (correctly flat, intentionally out-of-palette) grey as "drift".
PALETTE["ref_cube"] = "#8C8C94"
# Locked/pre-achievement state (round-14 fix item 8) -- landmark_toon_locked_state.png swaps every
# material's Emission colour to #8C8C94 but at Strength=0.55, which the renderer displays as a
# dimmer hex (linear radiance scaled by 0.55 before the sRGB encode) -- computed and printed
# directly by build_landmark.py's own SS7b, not hand-guessed here.
PALETTE["locked_grey"] = "#6A6A70"
TOL = 12          # per-pixel Euclidean distance to its NEAREST authored hex, for the match mask
BG_LUMA = 8        # pixels with all channels below this are background (world strength 0)
ERODE_SIZE = 9     # fixed, NOT swept against the renders -- see docstring. Removes a genuine few-px
                    # AA transition band; anything surviving is reported as real drift.
INTERIOR_FAIL_PX = 300  # real interior off-palette pixels allowed per render before FAIL -- the
                         # original beacon-halo bug this check exists to catch measured in the
                         # FIVE-DIGIT range (15,755px) even at a much smaller kernel, so this margin
                         # still catches a real regression by more than an order of magnitude.


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.int16)


PALETTE_RGB = np.stack([hex_to_rgb(h) for h in PALETTE.values()])  # (N, 3)
PALETTE_NAMES = list(PALETTE.keys())


def nearest_palette_dist(arr):
    """For every pixel, distance to its NEAREST authored hex (not a fixed assignment).

    BUG FOUND AND FIXED while wiring this up: the earlier version cast to int16 before squaring
    per-channel diffs -- a 255-magnitude diff squared is up to 65025, and summing 3 such channels
    (up to ~195075) overflows int16 (max 32767), wrapping negative and making sqrt() emit NaN,
    which silently corrupted argmin()'s nearest-palette assignment (bunting hues were dropping out
    of the per-material breakdown entirely). Fixed by computing in float64."""
    h, w, _ = arr.shape
    flat = arr.astype(np.float64).reshape(-1, 1, 3)
    d = np.sqrt(((flat - PALETTE_RGB[None, :, :].astype(np.float64)) ** 2).sum(axis=2))  # (h*w, N)
    nearest_idx = d.argmin(axis=1)
    nearest_dist = d.min(axis=1)
    return nearest_dist.reshape(h, w), nearest_idx.reshape(h, w)


def erode_mask(mask):
    img = Image.fromarray((mask * 255).astype(np.uint8))
    eroded = img.filter(ImageFilter.MinFilter(ERODE_SIZE))
    return np.array(eroded) > 127


def audit_render(path):
    arr = np.array(Image.open(path).convert("RGB"))
    h, w, _ = arr.shape
    bg_mask = (arr[:, :, 0] < BG_LUMA) & (arr[:, :, 1] < BG_LUMA) & (arr[:, :, 2] < BG_LUMA)
    nearest_dist, nearest_idx = nearest_palette_dist(arr)

    offpalette = (nearest_dist > TOL) & (~bg_mask)
    offpalette_interior = erode_mask(offpalette) & (~bg_mask)
    interior_count = int(offpalette_interior.sum())
    worst_interior = float(nearest_dist[offpalette_interior].max()) if interior_count else 0.0

    print(f"\n=== {path.name} ({w}x{h}) ===")
    print(f"  off-palette pixels (raw, incl. AA): {int(offpalette.sum())}")
    print(f"  off-palette pixels AFTER {ERODE_SIZE}x{ERODE_SIZE} erosion (real interior drift): "
          f"{interior_count}  (worst dist {worst_interior:.1f}, fail if >{INTERIOR_FAIL_PX}px)")

    findings = {}
    matched = (nearest_dist <= TOL) & (~bg_mask)
    for i, pname in enumerate(PALETTE_NAMES):
        pmask = matched & (nearest_idx == i)
        n = int(pmask.sum())
        if n == 0:
            continue
        ys, xs = np.nonzero(pmask)
        findings[pname] = (n, (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
        print(f"    {pname:20s} px={n:7d}  bbox={findings[pname][1]}")

    return interior_count, findings


# --- CVD simulation: documented simplified linear-RGB approximation (Machado/Vienot family) ---
PROTANOPIA = np.array([
    [0.567, 0.433, 0.000],
    [0.558, 0.442, 0.000],
    [0.000, 0.242, 0.758],
])
DEUTERANOPIA = np.array([
    [0.625, 0.375, 0.000],
    [0.700, 0.300, 0.000],
    [0.000, 0.300, 0.700],
])


def simulate_cvd(rgb255, matrix):
    lin = np.array([((c / 255.0 / 12.92) if c / 255.0 <= 0.04045
                      else ((c / 255.0 + 0.055) / 1.055) ** 2.4) for c in rgb255])
    sim_lin = matrix @ lin
    sim_srgb = np.array([(c * 12.92 if c <= 0.0031308 else 1.055 * (max(c, 0) ** (1 / 2.4)) - 0.055)
                          for c in sim_lin])
    return np.clip(sim_srgb, 0, 1) * 255


def cvd_report():
    cats = [k for k in PALETTE if k.startswith("bunting_")]
    print("\n=== CVD simulation (bunting hues, simplified linear-RGB approximation) ===")
    for label, matrix in (("protanopia", PROTANOPIA), ("deuteranopia", DEUTERANOPIA)):
        sim = {c: simulate_cvd(hex_to_rgb(PALETTE[c]), matrix) for c in cats}
        pairs = []
        for i in range(len(cats)):
            for j in range(i + 1, len(cats)):
                d = float(np.linalg.norm(sim[cats[i]] - sim[cats[j]]))
                pairs.append((d, cats[i], cats[j]))
        pairs.sort()
        worst = pairs[0]
        print(f"  {label}: closest pair = {worst[1]} vs {worst[2]}  dist={worst[0]:.1f}")
    print("  (shape channel -- SHAPE_BY_CAT in build_landmark.py -- is the non-colour fallback "
          "for whichever pair sits closest; see the design note for the assigned shapes.)")


if __name__ == "__main__":
    files = sorted(RENDER_DIR.glob("landmark_toon_*.png"))
    if not files:
        print("No landmark_toon_*.png renders found -- run build_landmark.py first.")
        sys.exit(1)

    ok = True
    worst_interior_total = 0
    bunting_all_findings = None
    for f in files:
        interior_count, findings = audit_render(f)
        worst_interior_total = max(worst_interior_total, interior_count)
        if interior_count > INTERIOR_FAIL_PX:
            ok = False
        if f.name == "landmark_toon_bunting_all_flags.png":
            bunting_all_findings = findings

    cvd_report()

    print(f"\n=== Summary ===")
    print(f"Worst per-render interior off-palette pixel count (post-erosion): "
          f"{worst_interior_total} (fail if >{INTERIOR_FAIL_PX})")
    if worst_interior_total > INTERIOR_FAIL_PX:
        print("FAIL: some render has real interior pixels off the authored flat palette after "
              "removing anti-aliasing -- suggests gradient/lit/clipped shading, not flat fill.")
        ok = False

    cats = [k for k in bunting_all_findings if k.startswith("bunting_")] if bunting_all_findings else []
    print(f"Bunting categories found in landmark_toon_bunting_all_flags.png: {len(cats)}/7 -> "
          f"{sorted(cats)}")
    if len(cats) < 7:
        print("FAIL: not all 7 bunting category hues are present in the dedicated all-flags render.")
        ok = False

    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)
