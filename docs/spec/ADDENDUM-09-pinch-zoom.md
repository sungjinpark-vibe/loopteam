# ADDENDUM-09 — Pinch zoom & pan

Phase 3 of the 2026-08-11 art/UX work (Phase 1 building art -> Phase 2 street props -> Phase 3
pinch zoom, sequential). Written after code recon; every claim below was verified against the
source, not taken from a report.

**Invariant:** the map design baseline (commit `afc7cd6` — 20x20 grid, park/lake terrain,
multi-tile buildings) is frozen. Zoom changes the viewport, never the layout.

---

## 1. Verified current state

| Fact | Evidence |
|---|---|
| Drag/long-press is a single delegated Pointer Events listener on `.town-grid` | `src/hooks/useTileGestures.ts:87,182` |
| **No pointer-count check anywhere in the gesture hook** | `useTileGestures.ts:87-121` |
| Zoom-to-fit already uses `transform: scale()` + `transformOrigin: "top left"` — NOT relayout | `src/components/TownGrid.tsx:449-450` |
| Fit scale is computed, both axes, clamped to max 1 | `TownGrid.tsx:270-272` |
| App **starts** zoomed out (`zoomedOut` default `true`) | `TownGrid.tsx:256` |
| `.town-viewport` pans today via native `overflow-x/y: auto` | `src/App.css:267,276` |
| All layers (terrain, ground tiles, savings plots, NPC layer) are direct children of `.town-grid` | `TownGrid.test.tsx:208` asserts the exact child count |
| No gesture library in `package.json` | verified — none needed |

### 1.1 Pre-existing bug found during recon (fix as part of this work)

`onPointerDown` calls `clearPress()` unconditionally (`useTileGestures.ts:90`) and then
reassigns `pressPointerId = e.pointerId` (`:91`). A second finger landing during a one-finger
long-press therefore **cancels the first finger's timer and steals ownership**. This is a live
bug today, independent of pinch — any accidental second touch silently kills a building move.
Pinch does not cause it; pinch makes it reachable constantly.

### 1.2 Correction to the historical record

The earlier rejection in the project history was **not** a gesture-conflict rejection. It was a
"no demonstrated need" rejection, made when the map was small enough to fit on screen. The 20x20
map invalidates that premise. Recorded here so the rejection is not cited later as precedent
against this feature.

---

## 2. Director decisions (locked, 2026-08-11 — not open to re-litigation)

- **D1 — Pan is enabled only above fit scale.** At fit scale the whole map is on screen, so
  panning there is motion without purpose.
- **D2 — The 전체 보기 toggle is KEPT**, not replaced by pinch. One-tap instant return to the
  whole map has accessibility and convenience value a two-finger gesture does not cover.
  (The pre-approved fallback to re-implement it as a transform preset button is **not needed** —
  recon confirms it is already transform-based.)
- **D3 — One-finger drag and two-finger pinch must not collide**, verified against real device
  scenarios rather than assumed.
- **D4 — Transform-based only.** No relayout on zoom. Layer coordinate systems stay consistent.
  Do not invalidate the `TownTerrain` memo.

### 2.1 Refinement D1 needs (flagged for the director)

D1 says "above 1x". The actual baseline is **fit scale, which is `Math.min(1, ...)` and is
therefore normally BELOW 1** on a 20x20 map (`TownGrid.tsx:271`). Gating pan on `scale > 1`
would leave pan dead through most of the useful zoom range. The gate is therefore implemented as
**`scale > fitScale`**, which is what D1 means in intent: "pan once the map no longer fits".

---

## 3. Design

### 3.1 Gesture arbitration (answers D3)

Track live pointers in a `Map<number, {x, y}>` populated at the very top of `onPointerDown`,
before the existing `clearPress()`/timer logic at `useTileGestures.ts:90`.

- **1 pointer** — existing behaviour, untouched. Long-press, tap, move-tolerance all unchanged.
- **2nd pointer arrives** — `clearPress()` and set `pinchActive = true`. The one-finger press is
  abandoned *deliberately* (correct here, unlike the §1.1 bug where it was abandoned *silently
  and then hijacked*). No new press may start while `pinchActive`.
- **Back to <2 pointers** — clear `pinchActive`; do **not** resurrect the abandoned press. A
  gesture that became a pinch never retroactively becomes a long-press.

This also fixes §1.1: with the pointer map in place, a second pointer can no longer take
ownership of the first pointer's press slot.

### 3.2 Zoom transform

Reuse the existing transform string at `TownGrid.tsx:449` — **do not add a wrapper element.** A
new wrapper would remount `.town-grid` and blow the `TownTerrain` memo (D4).

Extend the single existing transform to `scale(k) translate(tx, ty)`, same element, same
`transformOrigin: "top left"`. Because every layer is already a child of `.town-grid` (§1), all
layers follow the transform automatically — no per-layer coordinate work.

- Pinch scale anchors on the midpoint between the two pointers.
- Clamp: `fitScale` .. `2.5`. Below fit is pointless (D1); the upper bound keeps tile art legible.
- **`zoomedOut` and pinch scale must not fight.** A pinch sets `zoomedOut = false` and takes
  ownership of scale; the 전체 보기 toggle sets `zoomedOut = true` and resets scale to fit and
  translate to zero.

### 3.3 Pan (D1)

- At `scale <= fitScale`: pan disabled, native `.town-viewport` scrolling behaves as today.
- At `scale > fitScale`: the two-finger gesture owns pan via `translate`.
- **Double-handling risk:** `.town-viewport` native overflow scrolling and transform-based pan
  can both consume the same movement, producing doubled travel. Pick exactly one owner per zoom
  state and assert it in a test.
- Clamp translate so the map cannot be dragged fully off-screen.

### 3.4 Explicitly out of scope

- Double-tap zoom, momentum/inertial pan, rotation, zoom animation easing.
- Persisting zoom across sessions — the app deliberately opens on the whole town
  (`TownGrid.tsx:254-256`); restoring a zoomed-in state would fight that.

---

## 4. Acceptance

1. Two-finger pinch zooms in/out about the pointer midpoint; clamped to `fitScale..2.5`.
2. One-finger long-press building move **still works unchanged** at every zoom level, including
   after a pinch has ended.
3. A second finger during a long-press cancels it cleanly — no hijack, no phantom move (§1.1).
4. 전체 보기 toggle returns to full map in one tap and resets translate.
5. Pan is inert at fit scale, active above it, with no doubled travel against native scroll.
6. NPC layer, terrain, and buildings stay aligned at all zoom levels (no desync).
7. `TownTerrain` does not re-render on zoom — memo intact, `.town-grid` never remounts.
8. Browser touch-emulation evidence: pinch, pan, and building-move coexisting, with screenshots.

## 5. Notes for the implementer

- No new dependency. Pointer Events by hand, following the existing non-rebinding listener
  pattern in `useTileGestures.ts`.
- `TownGrid.test.tsx:208` asserts the exact direct-child count of `.town-grid`. Adding a child
  or a wrapper breaks it — another reason §3.2 forbids a wrapper.
- Keep the `latest.current` ref-callback pattern; do not rebind listeners per render.
