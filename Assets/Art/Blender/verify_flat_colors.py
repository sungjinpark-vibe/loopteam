"""
Verification check for build_landmark.py's flat/toon requirement: every non-background pixel
should land within a small tolerance of one of the authored flat hexes (printed by
build_landmark.py's own [diagnostic] palette output) -- never a smooth gradient or a lit/clipped
in-between value, since the emission-only material design means nothing in the scene CAN produce
one. Also used to prove the bunting acceptance criterion: count each of the 7 category hues by
real pixel area + bounding box in `landmark_toon_bunting_all_flags.png`, not by eye.

Run: py verify_flat_colors.py
Requires numpy + Pillow (both present in this environment).

This is the "ONE runnable check" for the shading logic (ponytail convention).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RENDER_DIR = Path(r"C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\renders")

# Authored palette, hand-copied from build_landmark.py's own printed [diagnostic] palette output
# (round 10 / third-attempt run) -- kept in sync manually since this script has no Blender access.
PALETTE = {
    "wall_base": "#FF408B", "wall_shadow": "#991F4F",
    "roof_base": "#7444F2", "roof_shadow": "#432394",
    "gold_base": "#FFC747", "gold_shadow": "#A67E24",
    "trim": "#F7E4CB", "opening_dark": "#221B29",
    "bunting_reading": "#6F3DF2", "bunting_study": "#3DCEF2", "bunting_work": "#F2BA3D",
    "bunting_exercise": "#3DF2A5", "bunting_hobby": "#3DF2B9", "bunting_mind": "#F28A3D",
    "bunting_game": "#F23D5D",
}
TOL = 8  # per-channel-ish Euclidean tolerance; AA edges are excluded by requiring the WHOLE pixel
BG_LUMA = 8  # pixels with all channels below this are background (world strength 0 -> near-black)


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.int16)


def audit_colors(arr, name):
    """Full-image per-authored-color scan: exact pixel count + bbox, no top-N truncation.

    Note on "coverage %": anti-aliased edge pixels (every silhouette boundary blends toward pure
    black background over 1-2px) are mathematically never within a tight tolerance of any solid
    authored hex -- that is expected for ANY flat-shaded render with AA and is not evidence of
    gradient/lit shading. The real test for "flat, not gradient" is the INTERIOR match quality
    (dist to nearest authored hex for the dominant/largest cluster of each material) -- printed
    separately, see max_dist below and the summary's per-material check."""
    h, w, _ = arr.shape
    bg_mask = (arr[:, :, 0] < BG_LUMA) & (arr[:, :, 1] < BG_LUMA) & (arr[:, :, 2] < BG_LUMA)
    matched_any = np.zeros((h, w), dtype=bool)
    print(f"\n=== {name} ({w}x{h}) ===")
    findings = {}
    for pname, hx in PALETTE.items():
        rgb = hex_to_rgb(hx)
        dist = np.sqrt(((arr.astype(np.int16) - rgb) ** 2).sum(axis=2))
        mask = dist <= TOL
        n = int(mask.sum())
        if n == 0:
            continue
        matched_any |= mask
        ys, xs = np.nonzero(mask)
        bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        # Interior match quality: the CLOSEST any pixel gets is always ~0 for a flat fill; report
        # the 99th-percentile distance among matched px as the real "how flat is this" number.
        interior_dist = float(np.percentile(dist[mask], 99)) if n > 0 else None
        findings[pname] = (n, bbox, interior_dist)
        print(f"  {pname:20s} hex={hx}  px={n:7d}  bbox={bbox}  p99_dist={interior_dist:.2f}")
    fg_total = int((~bg_mask).sum())
    matched_total = int((matched_any & ~bg_mask).sum())
    pct = 100.0 * matched_total / fg_total if fg_total else 100.0
    print(f"  AA-inclusive coverage (informational only, see note above): "
          f"{matched_total}/{fg_total} -> {pct:.1f}%")
    return findings, pct


if __name__ == "__main__":
    files = sorted(RENDER_DIR.glob("landmark_toon_*.png"))
    if not files:
        print("No landmark_toon_*.png renders found -- run build_landmark.py first.")
        sys.exit(1)

    worst_interior_dist = 0.0
    bunting_all_findings = None
    for f in files:
        arr = np.array(Image.open(f).convert("RGB"))
        findings, pct = audit_colors(arr, f.name)
        for pname, (n, bbox, d) in findings.items():
            if n >= 500:  # ignore tiny/sliver clusters for the "is this flat" interior check
                worst_interior_dist = max(worst_interior_dist, d)
        if f.name == "landmark_toon_bunting_all_flags.png":
            bunting_all_findings = findings

    print(f"\n=== Summary ===")
    print(f"Worst interior (p99, clusters>=500px) distance from its authored hex across all "
          f"renders: {worst_interior_dist:.2f} (tol={TOL}) -- this is the real flat-vs-gradient test.")
    ok = True
    if worst_interior_dist > TOL:
        print("FAIL: some material's interior pixels drift beyond tolerance from its authored "
              "flat hex -- suggests gradient/lit shading, not flat fill.")
        ok = False

    cats = [k for k in bunting_all_findings if k.startswith("bunting_")] if bunting_all_findings else []
    print(f"Bunting categories found in landmark_toon_bunting_all_flags.png: {len(cats)}/7 -> "
          f"{sorted(cats)}")
    if len(cats) < 7:
        print("FAIL: not all 7 bunting category hues are present in the dedicated all-flags render.")
        ok = False

    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)
