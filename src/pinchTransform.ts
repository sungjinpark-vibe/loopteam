/**
 * Two-finger pinch/pan gesture math for `TownGrid.tsx` (ADDENDUM-09 §3.2/§3.3)
 * — pulled into its own module (not a component file) so it can be unit
 * tested directly (`pinchTransform.test.ts`) without pulling in React or
 * jsdom's layout-less DOM, and so exporting it doesn't trip the
 * `react-refresh/only-export-components` lint rule.
 */
export interface PinchBaseline {
  scale: number;
  distance: number;
  midX: number;
  midY: number;
}
export interface PinchLayout {
  left: number;
  top: number;
}
export interface PinchSample {
  midX: number;
  midY: number;
  distance: number;
}

/**
 * Gate-3 round-5 (QA 리드's TOP FIX — the panel's cross-cutting finding: a
 * constant-separation two-finger pan still rescaled the grid ~33%). Every
 * prior fix to this gesture (see `TownGrid.tsx`'s `pinchLayoutRef`/
 * `pinchBaselineRef` doc comments) fixed CHAINING through the last COMMITTED
 * render state (`prevPinch.scale`/`.tx`/`.ty`, or the previous raw sample's
 * midpoint) — but real touch input never reports two fingers moving in one
 * event (each finger fires its OWN separate `pointermove`), so every OTHER
 * sample is necessarily a "half-sample": one finger already moved, the other
 * hasn't caught up yet. Chaining ANYTHING through that half-sample's derived
 * state — even just using its `scale`/`tx0` as the next frame's anchor
 * origin — lets that one bad frame's error persist into every frame after it.
 *
 * The fix is to stop chaining entirely: this function is PURE and derives
 * scale/translate ONLY from three fixed-at-gesture-start values (`baseline`,
 * `layout`) plus THIS ONE sample — never from the previous frame's output,
 * committed or not. A half-sample still produces one momentarily-approximate
 * frame (unavoidable — the geometry data itself is momentarily incomplete),
 * but the very next (correcting) sample recomputes fresh from the same fixed
 * baseline and is exactly right again — nothing compounds across the
 * gesture's dozens of samples the way a chained value would.
 */
export function resolvePinchTransform(
  baseline: PinchBaseline,
  layout: PinchLayout,
  sample: PinchSample,
  fitScale: number,
  maxScale: number,
  // A8 — the raw `distance` of the single sample immediately before this
  // one (from `pinchSampleRef`, a plain ref written synchronously in event
  // order — NOT React state, so this is never stale across a same-tick
  // batch). Used ONLY to tell "the gesture had genuinely zoomed in and just
  // dipped to the floor for one half-sample" from "the gesture starts at
  // the floor" below; defaults to `baseline.distance` (= "no prior sample
  // yet, so 'previous' is the baseline itself"), matching the very first
  // call of a gesture. This is a single fixed number, not a chain: it
  // cannot compound the way reading the last COMMITTED scale did.
  previousDistance: number = baseline.distance,
): { scale: number; tx: number; ty: number } {
  const rawScale = baseline.scale * (sample.distance / baseline.distance);
  const nextScale = Math.min(maxScale, Math.max(fitScale, rawScale));
  const previousScale = Math.min(maxScale, Math.max(fitScale, baseline.scale * (previousDistance / baseline.distance)));
  // A8 (see `TownGrid.tsx`'s `handlePinchMove` for the call site's own
  // history) — pinned to the floor with zero translate only when the PRIOR
  // sample was also at/below the floor; a transient dip mid-drag (prior
  // sample above the floor) falls through and keeps its translate instead of
  // snapping to {0,0}.
  if (nextScale <= fitScale && previousScale <= fitScale) {
    return { scale: fitScale, tx: 0, ty: 0 };
  }
  // transform-origin is top-left, `scale(k) translate(tx, ty)`: a client
  // point's local (pre-transform) coordinate is `(client - layout) / k`.
  // Anchored to the gesture's BASELINE midpoint (fixed, never the previous
  // sample's) — the world point under the fingers when the gesture started
  // stays under the fingers now, recomputed fresh every call.
  const anchorLocalX = (baseline.midX - layout.left) / baseline.scale;
  const anchorLocalY = (baseline.midY - layout.top) / baseline.scale;
  const tx = (sample.midX - layout.left) / nextScale - anchorLocalX;
  const ty = (sample.midY - layout.top) / nextScale - anchorLocalY;
  return { scale: nextScale, tx, ty };
}
