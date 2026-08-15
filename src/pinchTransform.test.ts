/**
 * Gate-3 round-5 (QA 리드's TOP FIX): the pinch/pan scale-drift bug had NO
 * automated coverage at all — every prior fix round was verified only by a
 * human driving real/emulated touch in a browser (jsdom has no layout
 * engine, so `TownGrid.test.tsx` never exercised this math). `resolvePinchTransform`
 * is pure — no DOM, no React — specifically so this math can be locked down
 * without either of those.
 */
import { describe, expect, it } from "vitest";
import { resolvePinchTransform, type PinchBaseline, type PinchLayout } from "./pinchTransform";

const FIT_SCALE = 0.4;
const MAX_SCALE = 2.5;
const layout: PinchLayout = { left: 0, top: 0 };

describe("resolvePinchTransform", () => {
  it("a pure translate (constant separation) never changes scale, even across many samples", () => {
    const baseline: PinchBaseline = { scale: 1, distance: 150, midX: 200, midY: 300 };
    let midX = 200;
    let midY = 300;
    for (let step = 0; step < 10; step++) {
      midX += 8;
      midY += 3;
      const result = resolvePinchTransform(baseline, layout, { midX, midY, distance: 150 }, FIT_SCALE, MAX_SCALE);
      expect(result.scale).toBe(1); // separation never changed — scale must not drift
    }
  });

  // The bug this regression-tests: real touch reports each finger's move in
  // its OWN pointermove event, so a "half-sample" (one finger moved, the
  // other hasn't caught up) is unavoidable mid-gesture. A CHAINED
  // implementation lets that half-sample's error persist into every later
  // frame; this pure, baseline-anchored one must not.
  it("a half-sample's error does not persist into the next (correcting) sample", () => {
    const baseline: PinchBaseline = { scale: 1, distance: 150, midX: 200, midY: 300 };
    // Half-sample: only one finger has moved, so the apparent separation
    // (and midpoint) is momentarily wrong — simulated as a distorted sample.
    resolvePinchTransform(baseline, layout, { midX: 230, midY: 300, distance: 110 }, FIT_SCALE, MAX_SCALE);
    // Correcting full sample: true separation is restored to the baseline's.
    const corrected = resolvePinchTransform(baseline, layout, { midX: 208, midY: 303, distance: 150 }, FIT_SCALE, MAX_SCALE);
    expect(corrected.scale).toBe(1); // unaffected by the previous call — no chaining
  });

  it("scale tracks the ratio of the current distance to the baseline distance", () => {
    const baseline: PinchBaseline = { scale: 1, distance: 100, midX: 0, midY: 0 };
    const result = resolvePinchTransform(baseline, layout, { midX: 0, midY: 0, distance: 200 }, FIT_SCALE, MAX_SCALE);
    expect(result.scale).toBe(2);
  });

  it("clamps to the fit-scale floor and the max-scale ceiling", () => {
    const baseline: PinchBaseline = { scale: 1, distance: 100, midX: 0, midY: 0 };
    expect(resolvePinchTransform(baseline, layout, { midX: 0, midY: 0, distance: 1 }, FIT_SCALE, MAX_SCALE).scale).toBe(FIT_SCALE);
    expect(resolvePinchTransform(baseline, layout, { midX: 0, midY: 0, distance: 10_000 }, FIT_SCALE, MAX_SCALE).scale).toBe(MAX_SCALE);
  });

  it("pinned to {fitScale, 0, 0} when the PRIOR sample was also at/below the floor", () => {
    const baseline: PinchBaseline = { scale: FIT_SCALE, distance: 100, midX: 50, midY: 50 };
    // previousDistance defaults to baseline.distance — "no prior sample yet".
    const result = resolvePinchTransform(baseline, layout, { midX: 80, midY: 80, distance: 90 }, FIT_SCALE, MAX_SCALE);
    expect(result).toEqual({ scale: FIT_SCALE, tx: 0, ty: 0 });
  });

  it("a transient dip to the floor mid-drag (the prior sample was above it) keeps its translate instead of snapping to 0", () => {
    const baseline: PinchBaseline = { scale: 1, distance: 100, midX: 50, midY: 50 };
    // Prior sample (distance 120) was above the floor — this dip (distance 10) is transient.
    const result = resolvePinchTransform(baseline, layout, { midX: 80, midY: 80, distance: 10 }, FIT_SCALE, MAX_SCALE, 120);
    expect(result.scale).toBe(FIT_SCALE);
    expect(result.tx).not.toBe(0);
  });

  it("pinned to {fitScale, 0, 0} even mid-gesture when the PRIOR sample had also already settled at the floor", () => {
    const baseline: PinchBaseline = { scale: 1, distance: 100, midX: 50, midY: 50 };
    // Prior sample (distance 35 -> raw scale 0.35, clamped to the 0.4 floor)
    // was already at the floor too — this is not a transient dip.
    const result = resolvePinchTransform(baseline, layout, { midX: 80, midY: 80, distance: 30 }, FIT_SCALE, MAX_SCALE, 35);
    expect(result).toEqual({ scale: FIT_SCALE, tx: 0, ty: 0 });
  });

  it("the world point under the baseline midpoint stays under the current midpoint (anchor-preserving)", () => {
    const baseline: PinchBaseline = { scale: 1, distance: 100, midX: 100, midY: 100 };
    // Zoom in 2x, midpoint unmoved: the point that was at local (100,100)
    // must still land at client (100,100) after the transform.
    const result = resolvePinchTransform(baseline, layout, { midX: 100, midY: 100, distance: 200 }, FIT_SCALE, MAX_SCALE);
    const clientX = (100 + result.tx) * result.scale + layout.left;
    const clientY = (100 + result.ty) * result.scale + layout.top;
    expect(clientX).toBeCloseTo(100);
    expect(clientY).toBeCloseTo(100);
  });
});
