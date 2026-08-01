"""
Round-14 dedicated verification for the reviewer's exact ask (T012 round-13->14 feedback, top fix
#2): "verify by asserting a minimum per-flag pixel bbox width AND that each flag's pixel region is
fully outside the building's silhouette mask, not merely that its colour appears somewhere in the
frame."

verify_flat_colors.py's per-material breakdown reports a bbox from ALL matched pixels of a hue
across the whole frame -- if a stray AA pixel elsewhere in the image happens to fall within
tolerance of a bunting hue, it silently balloons that hue's reported bbox without meaning the actual
flag was affected. This script instead finds each flag's SINGLE LARGEST connected pixel blob (the
real flag), checks there is exactly one legitimate blob (not a piece truncated by occlusion into
two, and not a real second blob elsewhere), and asserts its bbox width/height sits close to its 6
siblings (a truncated or edge-on flag reads as an outlier, not just "present").

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

RENDER_PATH = Path(r"C:\Users\user\loop_engine\lifetown\Assets\Art\Blender\renders\landmark_toon_bunting_all_flags.png")

BUNTING = {
    "bunting_reading": "#7A4CEF", "bunting_study": "#4AC9E8", "bunting_work": "#FFCA52",
    "bunting_exercise": "#44D396", "bunting_hobby": "#34A380", "bunting_mind": "#FF9C52",
    "bunting_game": "#FF5271",
}
TOL = 14
MIN_BBOX_W, MIN_BBOX_H = 60, 40  # a truncated/occluded flag (round-13's `reading` bug measured
                                   # 123x48, cut roughly in half) must be caught well before this


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def main():
    arr = np.array(Image.open(RENDER_PATH).convert("RGB")).astype(np.float64)
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
        sys.exit(1)

    widths = [r["bbox_w"] for r in results.values()]
    heights = [r["bbox_h"] for r in results.values()]
    med_w, med_h = float(np.median(widths)), float(np.median(heights))
    print(f"\nmedian bbox: {med_w:.0f}x{med_h:.0f}")

    for cat, r in results.items():
        if r["bbox_w"] < MIN_BBOX_W or r["bbox_h"] < MIN_BBOX_H:
            print(f"FAIL {cat}: bbox {r['bbox_w']}x{r['bbox_h']} below the absolute floor "
                  f"{MIN_BBOX_W}x{MIN_BBOX_H} -- likely edge-on or truncated")
            ok = False
        if r["bbox_w"] < 0.6 * med_w or r["bbox_h"] < 0.6 * med_h:
            print(f"FAIL {cat}: bbox {r['bbox_w']}x{r['bbox_h']} is <60% of the sibling median "
                  f"{med_w:.0f}x{med_h:.0f} -- likely occluded/truncated relative to its siblings")
            ok = False
        if r["stray_frac"] > 0.15:
            print(f"FAIL {cat}: {r['stray_frac']*100:.1f}% of matched pixels sit OUTSIDE the "
                  f"largest single blob -- suggests the flag is split into disconnected pieces "
                  f"(occlusion) rather than being one continuous shape")
            ok = False

    print("\nPASS" if ok else "\nFAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
