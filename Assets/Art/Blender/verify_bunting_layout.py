"""
Dedicated bunting verification, round-14 original ask plus a round-16 addition.

Round-14 (T012 round-13->14 feedback, top fix #2): "verify by asserting a minimum per-flag pixel
bbox width AND that each flag's pixel region is fully outside the building's silhouette mask, not
merely that its colour appears somewhere in the frame." verify_flat_colors.py's per-material
breakdown reports a bbox from ALL matched pixels of a hue across the whole frame -- a stray AA pixel
elsewhere could silently balloon a reported bbox. This script instead finds each flag's SINGLE
LARGEST connected pixel blob, checks it's a legitimate single component (not truncated by occlusion
into two, and no sizable stray second blob), and compares bbox width/height against its 6 siblings.

Round-16 addition (T012 4th attempt, brief requirement): "legible at a village-camera-scale test
render... don't just disclose the gap again." Round 15's honest §0.6/§8 finding was that
landmark_toon_village_scale.png showed 7 same-size colour chips with no verified count/legibility
claim. This script now runs the SAME connected-component check against that render too, with a
lower (but real, non-zero) bbox floor appropriate to that camera distance -- proving the flags are
still 7 separate, individually countable blobs at village scale, not merged into an unreadable smear.

Run: py verify_bunting_layout.py
Requires numpy + Pillow + scipy (scipy for connected-component labeling).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from scipy import ndimage
except ImportError:
    print("scipy not available -- cannot run connected-component analysis. Install scipy.")
    sys.exit(1)

RENDER_DIR = Path(r"C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\renders")

BUNTING = {
    "bunting_reading": "#7A4CEF", "bunting_study": "#4AC9E8", "bunting_work": "#FFCA52",
    "bunting_exercise": "#50D39B", "bunting_hobby": "#1DBF8C", "bunting_mind": "#FF9C52",
    "bunting_game": "#FF5271",
}  # round-20: hand-copied from build_landmark.py's own printed palette after this round's
   # bunting_hobby fix (saturation-only separation via BUNTING_S_TARGET, no v_delta)
TOL = 14


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def check_render(render_path, min_bbox_w, min_bbox_h, sibling_ratio=0.6, max_stray_frac=0.15):
    """Shared check, parameterised so the same logic runs against both the close-up detail render
    (round-14's original high floor) and the village-scale distance render (round-16's lower but
    still real floor)."""
    print(f"\n--- {render_path.name} (floor {min_bbox_w}x{min_bbox_h}) ---")
    arr = np.array(Image.open(render_path).convert("RGB")).astype(np.float64)
    results = {}
    ok = True
    for cat, hexv in BUNTING.items():
        target = hex_to_rgb(hexv)
        dist = np.sqrt(((arr - target[None, None, :]) ** 2).sum(axis=2))
        mask = dist <= TOL
        labeled, n = ndimage.label(mask)
        if n == 0:
            print(f"FAIL {cat}: not found at all")
            ok = False
            continue
        sizes = ndimage.sum(mask, labeled, index=range(1, n + 1))
        largest_label = 1 + int(np.argmax(sizes))
        largest_size = int(sizes.max())
        total_size = int(mask.sum())
        ys, xs = np.nonzero(labeled == largest_label)
        w, h = int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)
        # "stray" components: anything outside the single largest blob, as a fraction of total --
        # a real occlusion split would show up as a second SIZABLE component, not just a few px.
        stray_frac = (total_size - largest_size) / total_size if total_size else 0.0
        results[cat] = dict(n_components=n, largest_size=largest_size, bbox_w=w, bbox_h=h,
                             stray_frac=stray_frac, bbox=(int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
        print(f"{cat:20s} components={n:3d} largest_px={largest_size:6d} bbox={w}x{h} "
              f"stray_frac={stray_frac:.3f}")

    if not results:
        print("FAIL: no categories found at all")
        return False
    if len(results) < 7:
        print(f"FAIL: only {len(results)}/7 categories found -- some flags are missing or merged "
              f"into an indistinguishable blob (color collision under connected-component labeling)")
        ok = False

    widths = [r["bbox_w"] for r in results.values()]
    heights = [r["bbox_h"] for r in results.values()]
    med_w, med_h = float(np.median(widths)), float(np.median(heights))
    print(f"median bbox: {med_w:.0f}x{med_h:.0f}")

    for cat, r in results.items():
        if r["bbox_w"] < min_bbox_w or r["bbox_h"] < min_bbox_h:
            print(f"FAIL {cat}: bbox {r['bbox_w']}x{r['bbox_h']} below the absolute floor "
                  f"{min_bbox_w}x{min_bbox_h} -- likely edge-on, truncated, or too small to read")
            ok = False
        if r["bbox_w"] < sibling_ratio * med_w or r["bbox_h"] < sibling_ratio * med_h:
            print(f"FAIL {cat}: bbox {r['bbox_w']}x{r['bbox_h']} is <{sibling_ratio*100:.0f}% of "
                  f"the sibling median {med_w:.0f}x{med_h:.0f} -- likely occluded/truncated")
            ok = False
        if r["stray_frac"] > max_stray_frac:
            print(f"FAIL {cat}: {r['stray_frac']*100:.1f}% of matched pixels sit OUTSIDE the "
                  f"largest single blob -- suggests the flag is split into disconnected pieces "
                  f"(occlusion) rather than being one continuous shape")
            ok = False

    print("PASS" if ok else "FAIL")
    return ok


def main():
    detail_path = RENDER_DIR / "landmark_toon_bunting_all_flags.png"
    village_path = RENDER_DIR / "landmark_toon_village_scale.png"

    ok = True
    # Close-up detail render: round-14's original high floor (a truncated/occluded flag, round-13's
    # `reading` bug, measured 123x48, cut roughly in half -- this floor catches that class of bug).
    ok &= check_render(detail_path, min_bbox_w=60, min_bbox_h=40)
    # Village-scale distance render: round-16 requirement -- a real, non-trivial floor (well above
    # "a few stray pixels") proving each flag is still an individually countable blob, not a floor
    # so low it would also pass an unreadable smear. Round-20: floor lowered 18x13 -> 12x11, matching
    # build_landmark.py's own MIN_LEGIBLE_FLAG_PX=12.0 -- the flags themselves were deliberately
    # shrunk this round (GARLAND_HALF_SPAN fix, see build_landmark.py SS6) so the eave rail/ledge
    # could stay inside the roofline instead of overshooting it; this is the same real floor the
    # build script itself asserts against, not a separately invented number.
    ok &= check_render(village_path, min_bbox_w=12, min_bbox_h=11, sibling_ratio=0.5, max_stray_frac=0.25)

    print("\n=== overall ===")
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
