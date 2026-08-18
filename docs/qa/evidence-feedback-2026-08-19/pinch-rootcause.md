# Pinch-to-zoom root cause (corrected 2026-08-19)

This replaces an earlier, incorrect root-cause note in this same directory
(kept in this file's history only — that note's diagnosis was wrong and did
not survive review; see "What was wrong with the first fix" below).

## Root cause

`.town-grid` carried `touch-action: pan-x pan-y` (App.css) so a 1-finger
drag could still scroll `.town-viewport` (`overflow: auto`) natively
(ADDENDUM-02 §4.3, B23).

`touch-action` is resolved for an entire touch **sequence** at that
sequence's very first `touchstart`, not re-evaluated per finger. A real hand
never lands both fingers in the same instant — finger 1 always touches down
and drifts a little before finger 2 arrives. With `pan-x pan-y` in effect at
that first touchstart, the browser is free to claim the whole sequence as a
native scroll of `.town-viewport` the moment finger 1 moves — before finger
2 ever lands. It then fires `pointercancel` and stops delivering pointer
events for that sequence entirely. Finger 2's `pointerdown` never reaches
JS at all.

## Measured (CDP `Input.dispatchTouchEvent`, live app on :5173)

Harness: `pinch-real.mjs` (peer-authored, reused as-is) — finger 1 lands
alone and drags 24px, finger 2 arrives ~100ms later, then the spread drifts
down-right, modeling a real hand rather than two perfectly synchronized,
perfectly still fingers.

| `.town-grid` touch-action | pointerdown | pointercancel | zoomRatio |
|---|---|---|---|
| `pan-x pan-y` (pre-fix)   | 1 | 1 | 1.00 (dead) |
| `none` (forced)           | 2 | 0 | 5.96 (works) |
| `none` (this fix, in place) | 2 | 0 | 5.96 (works) |

## What was wrong with the first fix

The first attempt kept `touch-action: pan-x pan-y` in App.css and instead
mutated `grid.style.touchAction = "none"` from inside `useTileGestures.ts`'s
2-finger `pointerdown` branch, reverting it on pinch end. That branch never
runs on real hardware: per the mechanism above, the browser has already
claimed the sequence and cancelled it before finger 2's `pointerdown` is
ever delivered — so the mutation never executes. Verified against the app
default (which had that fix in place): pointerdown=1, pointercancel=1,
zoomRatio=1.00 — identical to the completely unfixed case. A synthetic,
symmetric, perfectly-synchronous CDP repro (two fingers landing at the same
instant, moving in lockstep) does not trigger the browser's claim and made
the no-op fix look like it worked; the realistic, staggered-timing harness
above does not have that blind spot.

## Fix

1. `src/App.css` — `.town-grid` now carries `touch-action: none`
   **permanently** (not conditionally mid-gesture). This is the only value
   that prevents the browser from ever claiming a touch sequence started on
   the grid, regardless of finger timing.
2. `touch-action: none` also revokes the native 1-finger scroll
   `.town-viewport` used to provide. `src/hooks/useTileGestures.ts` now
   drives that SAME element's `scrollLeft`/`scrollTop` from single-finger
   `pointermove` deltas instead (`panPointerId` tracking, added to
   `onPointerDown`/`onPointerMove`/`onPointerEnd`/`onScrollOrBlur`). Pan
   tracking starts on ANY single pointerdown inside `.town-grid`, not just
   one that hits a tile — `.town-cell` (road/park/lake terrain) is
   `pointer-events: none`, so a touch starting there resolves to no
   `[data-plot-index]` and previously relied entirely on native scroll to
   pan.
3. A real pan (movement past `LONG_PRESS_TOLERANCE_PX`, the same constant
   the long-press disambiguation already used) now also sets
   `suppressNextClick`, so the drag's release doesn't ALSO land as a tap.
   Under the old `pan-x pan-y` design this was handled for free — a browser
   that claims a touch sequence as a native scroll does not synthesize a
   trailing `click` for it. `touch-action: none` removes that free
   disambiguation, so it is now explicit.
4. The 3 dead `grid.style.touchAction` mutations from the first fix are
   removed (`onPointerDown`'s 2-finger branch, `onPointerEnd`,
   `onScrollOrBlur`).
5. No inertia/momentum on release — native scroll's own fling is gone with
   it. Marked with a `ponytail:` comment in `useTileGestures.ts` naming the
   ceiling (a flick just stops where the finger lifts) and the upgrade path
   (a decay-velocity rAF loop on pointerup) if this turns out to matter to
   players.

## Proof

- `node pinch-real.mjs` (app default, this fix in place): pointerdown=2,
  pointercancel=0 (absent from the event-count map, i.e. zero), zoomRatio
  5.96.
- `node pinch-real-1finger.mjs` (same CDP harness/context, companion
  script): a 10-step single-finger drag moved `.town-viewport.scrollTop`
  from 0 to 60 (`dScrollTop: 60`).
- `TownGrid.test.tsx`: three regression tests — (a) `.town-grid`'s CSS text
  is pinned to `touch-action: none` (reads the real stylesheet; jsdom is
  `css: false` so nothing here can assert live computed style), (b) a
  single-finger drag moves `.town-viewport.scrollLeft`/`.scrollTop` by the
  exact expected delta, (c) a drag past the long-press tolerance suppresses
  the tail click.
