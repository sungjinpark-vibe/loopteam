/**
 * Delegated tile gesture recognizer — ADDENDUM-02 §4.3. Attached ONCE to
 * `.town-grid` (via `gridRef`), never per-tile: the town can have thousands
 * of tiles, so this is one listener set instead of ~5,400 (rule of §4.3's
 * "why delegation").
 *
 * Purely a gesture layer: it resolves a DOM event to a `data-plot-index` and
 * reports WHAT happened (long-press / tap / cursor move / activate /
 * escape), never WHAT IT MEANS (enter move mode, commit, cancel — that's
 * `useMoveMode`'s job, composed one level up). Keeping this split is what
 * lets `TownGrid`'s own `tiles` memo stay keyed on primitives only
 * (`movingId`, `cursorIndex`) instead of taking a per-tile callback prop.
 */
import { useEffect, useRef, type RefObject } from "react";
import { GRID_SIZE, cellFromIndex, indexFromCell } from "../townLayout";

export const LONG_PRESS_MS = 500; // platform interaction default (assumption; director may retune — not a balance dial)
export const LONG_PRESS_TOLERANCE_PX = 8; // same

export interface TileGestureCallbacks {
  /**
   * Fires once, ~LONG_PRESS_MS into a stationary pointerdown on a tile.
   * Returns whether it actually DID something (grabbed a building to move) —
   * a long-press on an empty lot is a documented no-op (`useMoveMode`) and
   * must return `false`, or the tail `click` on that same lot (the exact tap
   * a droppable-lot commit needs, AC-M9's own counterpart) would be silently
   * swallowed by `suppressNextClick` for a gesture that changed nothing.
   */
  onLongPress: (plotIndex: number) => boolean;
  /** A tap (click) that was NOT the tail end of a fired long-press (B22). */
  onTap: (plotIndex: number) => void;
  /** Arrow-key cursor move — already computed + clamped to `[0, tileCount)`. */
  onCursorMove: (nextIndex: number) => void;
  /** Enter/Space fired while the roving cursor sits on `plotIndex`. */
  onActivate: (plotIndex: number) => void;
  onEscape: () => void;
  /**
   * Gate-3-rerun fix (panel finding, all five expert lenses): fires exactly
   * ONCE, synchronously at the instant the 2nd finger lands, with BOTH
   * pointers' TRUE down positions (the `pointers` map already holds both by
   * this point — see `onPointerDown` below). This is the only moment in the
   * gesture both fingers' positions are known from the SAME event with no
   * ambiguity.
   *
   * Before this existed, `TownGrid` used the first `onPinchMove` sample as
   * its baseline instead — but real touch input reports each finger's
   * movement in its OWN separate `pointermove` event, never both at once, so
   * that "first sample" could easily carry finger A's already-moved position
   * paired with finger B's stale down position (a half-sample). Baselining
   * off THAT distance corrupts the whole gesture's scale reference, not just
   * one sample — reproduced live as a scale snap on the very first move of a
   * fresh two-finger gesture that then held constant (wrong) for every
   * further sample, because every later "full" sample was being compared
   * against that one bad half-sample baseline. Seeding the baseline here
   * instead removes the ambiguity: both positions come from the SAME
   * pointerdown event, synchronously, never a race.
   */
  onPinchStart?: (midX: number, midY: number, distance: number) => void;
  /**
   * ADDENDUM-09 §3.1 — fires on every `pointermove` while exactly 2+ pointers
   * are down (a pinch/pan gesture in progress). Reports the two tracked
   * pointers' midpoint and separation in client-space pixels; the caller
   * (TownGrid) derives scale/translate deltas from consecutive calls — this
   * hook only resolves WHAT happened (a pinch sample), never what it means.
   * Never fires with 0 or 1 pointer down. Optional: callers that don't zoom
   * (e.g. tests exercising only long-press/tap) can omit it.
   */
  onPinchMove?: (midX: number, midY: number, distance: number) => void;
  /** Fires once when the gesture drops back below 2 pointers (pinch ended). */
  onPinchEnd?: () => void;
  /**
   * Gate-3-rerun fix (panel's "invalid drop" finding, all five expert
   * lenses): fires when a hold-drag-release (`longPressFired`, real
   * movement) ends on NO tile at all — released outside `.town-grid`
   * entirely (over the header, the FAB, the move-bar's own dead space, or
   * scrolled past an edge). `onTap` is never called in that case (there is
   * no `plotIndex` to give it), so without this the drop was previously a
   * true no-op: move mode stayed open with zero feedback, indistinguishable
   * from a hang. An occupied-but-IN-GRID tile already resolves to a real
   * `plotIndex` and reaches `onTap`/`useMoveMode`'s existing reject message
   * — this only covers the "landed nowhere" case that mechanism can't see.
   * Optional: callers that don't use move mode (none currently) can omit it.
   */
  onInvalidDrop?: () => void;
}

function closestPlotIndex(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const tile = target.closest<HTMLElement>("[data-plot-index]");
  if (!tile) return null;
  const raw = tile.dataset.plotIndex;
  if (raw === undefined) return null;
  const index = Number(raw);
  return Number.isInteger(index) ? index : null;
}

/**
 * Attaches the delegated pointer + keyboard listeners to `gridRef.current`.
 * `tileCount` and `cursorIndex` drive arrow-key clamping/stepping only —
 * everything else is read fresh off the DOM per event, so this hook never
 * needs to re-bind when buildings change.
 */
export function useTileGestures(
  gridRef: RefObject<HTMLDivElement | null>,
  tileCount: number,
  cursorIndex: number | null,
  callbacks: TileGestureCallbacks,
): void {
  // Read through a ref so the effect below binds its listeners exactly once
  // per `gridRef`/`tileCount` change, not on every render (same discipline
  // `useBackGuard.ts` already uses for `touched`/`onBack`).
  const latest = useRef({ tileCount, cursorIndex, callbacks });
  useEffect(() => {
    latest.current = { tileCount, cursorIndex, callbacks };
  });

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    // `.town-grid` is now permanently `touch-action: none` (App.css — see its
    // own comment for the measured, real-device reason: `pan-x pan-y` let the
    // browser claim a 2nd finger's whole touch sequence as a native scroll
    // before either finger's events ever reached this hook, killing pinch).
    // That also kills the native 1-finger scroll `.town-viewport` (its
    // `overflow: auto` ancestor) used to provide, so this hook now drives
    // that SAME element's `scrollLeft`/`scrollTop` from 1-finger pointermove
    // deltas instead — see `panPointerId` below. Looked up once here (static
    // for this effect's lifetime, same discipline as `grid` itself).
    const viewport = grid.closest<HTMLElement>(".town-viewport");

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressPointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let suppressNextClick = false;
    // JS-driven 1-finger pan (replaces the native scroll `touch-action:
    // pan-x pan-y` used to provide). Tracks the sole active pointer
    // regardless of whether it hit a tile — `.town-cell` (road/park/lake
    // terrain) is `pointer-events: none`, so a touch starting there resolves
    // to no `[data-plot-index]` at all and must still be able to pan.
    let panPointerId: number | null = null;
    let panStartX = 0;
    let panStartY = 0;
    let panLastX = 0;
    let panLastY = 0;
    let panMoved = false; // past LONG_PRESS_TOLERANCE_PX — a pan, not a tap (B22's tolerance, reused)
    // Gate-3-rerun fix (every expert's near-top finding): a long-press grabs
    // a building, but a continuous hold-drag-release to a new spot used to do
    // NOTHING — only a separate discrete tap AFTER releasing committed a
    // move, contradicting the highlighted-droppable-tiles affordance move
    // mode itself shows. `longPressFired` marks the pointer that just grabbed
    // something; `onPointerEnd` below checks it to resolve a real drag-release
    // as a drop, while a release with no meaningful movement (the ORIGINAL,
    // still-supported "grab, lift, look, tap later" flow) is left alone.
    let longPressFired = false;

    // ADDENDUM-09 §3.1 — live pointer tracking for gesture arbitration
    // (1-finger long-press/tap vs 2-finger pinch/pan). `pinchActive` is the
    // ownership flag: once true, no new press may start, and it is never
    // cleared back to a resurrected press — a gesture that became a pinch
    // never retroactively becomes a long-press.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchActive = false;

    function clearPress() {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      pressPointerId = null;
      longPressFired = false;
    }

    function onPointerDown(e: PointerEvent) {
      // Populated BEFORE the existing press logic (§3.1) — a 2nd pointer
      // must be seen and act on the press timer before anything else runs.
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2) {
        // A second finger landed: this is now a pinch, not a one-finger
        // press. Abandon any in-flight press DELIBERATELY here (unlike the
        // pre-fix bug this replaces, where the abandonment was silent and
        // the second pointer then hijacked `pressPointerId`) — clearPress()
        // sets `pressPointerId = null`, so this pointer never takes it over.
        clearPress();
        panPointerId = null; // a pinch owns the gesture now — 1-finger JS pan stands down too
        // Only the FIRST two tracked pointers own the gesture (matches
        // `onPointerMove`'s own "only the first two" rule) — a 3rd finger
        // landing while already pinching must not re-seed the baseline.
        if (!pinchActive) {
          const [a, b] = pointers.values();
          latest.current.callbacks.onPinchStart?.((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y));
        }
        pinchActive = true;
        return;
      }
      if (pinchActive) return; // still mid-pinch settling toward 1 pointer — no new press

      // The sole active pointer — start JS pan-tracking unconditionally,
      // BEFORE the tile-hit check below (panning must work off-tile too).
      panPointerId = e.pointerId;
      panStartX = panLastX = e.clientX;
      panStartY = panLastY = e.clientY;
      panMoved = false;

      const plotIndex = closestPlotIndex(e.target);
      if (plotIndex === null) return;
      clearPress();
      pressPointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      // Gate-3-rerun fix — a touch pointer implicitly captures to ITS
      // pointerdown target (Pointer Events spec), so without releasing that
      // capture, `e.target` on every later event for this pointer (including
      // its eventual pointerup) stays pinned to THIS tile no matter where the
      // finger actually ends up — the drag-release check in `onPointerEnd`
      // below needs the real element under the finger at release time.
      // Mouse pointers never implicitly capture, so this is a no-op for them;
      // guarded because some environments (jsdom) don't implement the method.
      if (e.target instanceof Element && typeof e.target.releasePointerCapture === "function") {
        try {
          e.target.releasePointerCapture(e.pointerId);
        } catch {
          // Not implemented in this environment — harmless, hit-testing via
          // `e.target` simply won't reflect real movement there (tests
          // dispatch pointerup directly on the intended drop element anyway).
        }
      }
      // Deliberately NOT preventDefault() — that would kill the town's
      // vertical scroll through a building (§4.3).
      pressTimer = setTimeout(() => {
        pressTimer = null;
        // Only suppress the tail `click` when the long-press actually DID
        // something (B22, AC-M9). A long-press held on an EMPTY/droppable
        // lot is exactly the commit gesture in move mode (a >=500ms press is
        // still a press) — `onLongPress` there is a no-op and returns
        // `false`, so the click must fall through to `onTap` instead of
        // being eaten (round-2 finding C2 #1: was unconditional here).
        const grabbed = latest.current.callbacks.onLongPress(plotIndex);
        suppressNextClick = grabbed;
        longPressFired = grabbed; // arms the drag-release check in onPointerEnd
      }, LONG_PRESS_MS);
    }

    function onPointerMove(e: PointerEvent) {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinchActive && pointers.size >= 2) {
        // Only the first two tracked pointers drive the pinch — a stray 3rd
        // touch is ignored rather than fought over (out of scope, §3.4).
        const [a, b] = pointers.values();
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        // Own the gesture: without this, native `.town-viewport` overflow
        // scroll can ALSO respond to the same touch movement, doubling
        // travel against the transform-driven pan (§3.3's double-handling
        // risk). Non-passive listener (only `scroll` below is passive), so
        // preventDefault() here is effective.
        e.preventDefault();
        latest.current.callbacks.onPinchMove?.(midX, midY, distance);
        return; // a pinch never also runs single-finger press/move logic
      }

      // 1-finger pan — drives the SAME `.town-viewport` element native
      // overflow scrolling used to own (bounds clamping, `scrollIntoView`,
      // wheel/keyboard scroll and the fit-to-screen measurement all still
      // read/write that one element, untouched by this).
      if (e.pointerId === panPointerId && viewport) {
        const dx = e.clientX - panLastX;
        const dy = e.clientY - panLastY;
        panLastX = e.clientX;
        panLastY = e.clientY;
        viewport.scrollLeft -= dx;
        viewport.scrollTop -= dy;
        if (!panMoved && Math.hypot(e.clientX - panStartX, e.clientY - panStartY) > LONG_PRESS_TOLERANCE_PX) {
          panMoved = true;
          // A real drag, not a tap (peer review 2026-08-19: touch-action:none
          // means the browser no longer suppresses the tail `click` for us
          // the way a claimed native scroll gesture used to) — same
          // tolerance `clearPress()` below already uses to tell "held still"
          // from "moved", reused rather than inventing a second threshold.
          suppressNextClick = true;
        }
      }
      // ponytail: no momentum/inertia on release (native scroll's own
      // fling) — a flick just stops where the finger lifts. Add a simple
      // decay-velocity rAF loop on pointerup if players actually notice.

      if (pressTimer === null || e.pointerId !== pressPointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE_PX) clearPress();
    }

    function onPointerEnd(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (e.pointerId === panPointerId) panPointerId = null;
      if (pinchActive && pointers.size < 2) {
        // Back to <2 pointers — clear ownership, do NOT resurrect the press
        // that was abandoned when the pinch started (§3.1).
        pinchActive = false;
        latest.current.callbacks.onPinchEnd?.();
      }
      if (e.pointerId === pressPointerId) {
        // Gate-3-rerun fix — a continuous hold-drag-release: only treat this
        // as a drop when the pointer actually MOVED a meaningful distance
        // after grabbing (same `LONG_PRESS_TOLERANCE_PX` used elsewhere to
        // tell "held still" from "moved"). A release with no real movement
        // is left alone — the original "grab, lift, look, tap later" flow
        // still works exactly as before, unchanged.
        if (longPressFired && Math.hypot(e.clientX - startX, e.clientY - startY) > LONG_PRESS_TOLERANCE_PX) {
          // `e.target` here reflects the real element under the finger at
          // release, now that `onPointerDown` released implicit pointer
          // capture for this pointer.
          const dropIndex = closestPlotIndex(e.target);
          if (dropIndex !== null) latest.current.callbacks.onTap(dropIndex);
          else latest.current.callbacks.onInvalidDrop?.();
        }
        clearPress();
      }
    }

    function onScrollOrBlur() {
      clearPress();
      panPointerId = null;
      // Escape valve for a hung multi-touch gesture too (e.g. the app loses
      // focus mid-pinch and pointerup never fires for one of the fingers).
      if (pinchActive) {
        pinchActive = false;
        latest.current.callbacks.onPinchEnd?.();
      }
      pointers.clear();
    }

    function onContextMenu(e: MouseEvent) {
      // Android WebView pops the system menu at ~500ms and eats the gesture
      // otherwise (§4.3).
      e.preventDefault();
    }

    function onClick(e: MouseEvent) {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      const plotIndex = closestPlotIndex(e.target);
      if (plotIndex === null) return;
      latest.current.callbacks.onTap(plotIndex);
    }

    // ADDENDUM-08 §2 — the serpentine is gone; a fixed 20-wide row-major grid,
    // so stepping a row is just `indexFromCell`'s trivial inverse of `cellFromIndex`.
    function stepCursor(nextRow: number, col: number): number | null {
      if (nextRow < 0 || nextRow >= GRID_SIZE) return null;
      const nextIndex = indexFromCell({ row: nextRow, col });
      return nextIndex >= 0 && nextIndex < latest.current.tileCount ? nextIndex : null;
    }

    function onKeyDown(e: KeyboardEvent) {
      const { tileCount: count, cursorIndex: cursor, callbacks: cb } = latest.current;
      if (count === 0) return;

      if (e.key === "Escape") {
        cb.onEscape();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (cursor !== null) {
          e.preventDefault(); // Space must not also scroll the page
          cb.onActivate(cursor);
        }
        return;
      }

      const isArrow = e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown";
      if (!isArrow) return;
      e.preventDefault();

      if (cursor === null) {
        cb.onCursorMove(0); // "starts null; set on the first arrow key" (§4.3)
        return;
      }

      let next: number | null = null;
      if (e.key === "ArrowLeft") next = cursor > 0 ? cursor - 1 : null;
      else if (e.key === "ArrowRight") next = cursor + 1 < count ? cursor + 1 : null;
      else {
        const { row, col } = cellFromIndex(cursor);
        next = e.key === "ArrowUp" ? stepCursor(row - 1, col) : stepCursor(row + 1, col);
      }
      if (next !== null) cb.onCursorMove(next);
    }

    grid.addEventListener("pointerdown", onPointerDown);
    grid.addEventListener("pointermove", onPointerMove);
    grid.addEventListener("pointerup", onPointerEnd);
    grid.addEventListener("pointercancel", onPointerEnd);
    grid.addEventListener("scroll", onScrollOrBlur, { passive: true });
    grid.addEventListener("blur", onScrollOrBlur, true);
    grid.addEventListener("contextmenu", onContextMenu);
    grid.addEventListener("click", onClick);
    grid.addEventListener("keydown", onKeyDown);
    return () => {
      clearPress();
      grid.removeEventListener("pointerdown", onPointerDown);
      grid.removeEventListener("pointermove", onPointerMove);
      grid.removeEventListener("pointerup", onPointerEnd);
      grid.removeEventListener("pointercancel", onPointerEnd);
      grid.removeEventListener("scroll", onScrollOrBlur);
      grid.removeEventListener("blur", onScrollOrBlur, true);
      grid.removeEventListener("contextmenu", onContextMenu);
      grid.removeEventListener("click", onClick);
      grid.removeEventListener("keydown", onKeyDown);
    };
    // Binds once, on mount: `gridRef` is attached in the SAME render that
    // calls this hook, so `gridRef.current` already points at the live node
    // by the time this effect runs, and a ref object's own identity never
    // changes (React refs are exempt from re-triggering effects). Everything
    // ELSE is read through `latest` per event (see the ref-sync effect
    // above), which is what lets this bind only once.
  }, [gridRef]);
}
