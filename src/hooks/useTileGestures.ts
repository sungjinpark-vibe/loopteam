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
import { plotFromIndex } from "../selectors";
import { indexFromPlot } from "../townLayout";

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

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressPointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let suppressNextClick = false;

    function clearPress() {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      pressPointerId = null;
    }

    function onPointerDown(e: PointerEvent) {
      const plotIndex = closestPlotIndex(e.target);
      if (plotIndex === null) return;
      clearPress();
      pressPointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
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
        suppressNextClick = latest.current.callbacks.onLongPress(plotIndex);
      }, LONG_PRESS_MS);
    }

    function onPointerMove(e: PointerEvent) {
      if (pressTimer === null || e.pointerId !== pressPointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE_PX) clearPress();
    }

    function onPointerEnd(e: PointerEvent) {
      if (e.pointerId === pressPointerId) clearPress();
    }

    function onScrollOrBlur() {
      clearPress();
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

    function stepCursor(nextRow: number, col: number): number | null {
      if (nextRow < 0) return null;
      const nextIndex = indexFromPlot({ row: nextRow, col });
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
        const { row, col } = plotFromIndex(cursor);
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
