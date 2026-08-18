# Feedback fixes 2026-08-19 — pinch zoom + 명당 ring

## Task 1 — pinch-to-zoom

**SUPERSEDED — see `pinch-rootcause.md` in this same directory for the
correct, peer-verified root cause and fix.** The diagnosis originally
written here (a `grid.style.touchAction` mutation inside the 2-finger
`pointerdown` branch) was proven to be a no-op on real hardware: it depends
on that branch running at all, but a real hand's staggered finger timing
means the browser claims the whole touch sequence and fires `pointercancel`
before finger 2's `pointerdown` is ever delivered to JS — so the mutation
never executes. `pinch-rootcause.md` has the corrected mechanism, the
measured before/after numbers, and the actual fix (`.town-grid` permanently
`touch-action: none` in App.css, JS-driven 1-finger pan added to
`useTileGestures.ts` to replace the native scroll that revokes).

## Task 2 — 명당 (prime lot) ring

**Root cause (part a).** `isPrimeCell`/`isPrimePlotIndex` (townLayout.ts,
untouched — economy-facing) already restrict a prime lot to `ground`
terrain only, so the ring never lands on true park terrain. The actual
overlap: an UNBUILT prime ground cell renders `EmptyLot` with its own
`decorVariant(row, col, 3)`-keyed tree (`variant 1`) / sprout (`variant 2`)
icon (`EmptyLot.tsx`) — a decoration wholly independent of whether that same
cell happens to be prime. `TownGrid.tsx` painted the ring on ANY prime
ground cell regardless, so a prime+decorated cell got both.

**Fix.** `TownGrid.tsx`: both places that decide "is this cell's ring on" —
`TERRAIN_CELLS`'s static `prime` field (feeds `.town-cell--prime`, the
always-present terrain layer) and the ground-tile loop's `isPrime` (feeds
`.town-tile--prime` on the empty-lot div) — now also require
`decorVariant(row, col, 3) === 0`, the SAME value `EmptyLot`'s `variant`
prop already gets for that cell. A built prime cell (a real building
standing there) is untouched — buildings never carry `EmptyLot` decor, so
there is no conflict to suppress. `isPrimeCell` itself is untouched: a
decorated lot is still genuinely prime to build on, only its ring is hidden.

**Root cause / design (part b).** Tapping the ring shows a toast with the
actual mechanic from `balance.approved.ts` (`seedAwards.primeLot: 3`,
`primeLotMax: 30`) — `+3 seeds per building on a 명당 at each settlement,
capped at 30` (see `economy/awards.ts`'s `primeLotCount` scoring and
`MonumentDetailSheet.tsx`'s existing "명당 보너스는 별도예요" copy, whose
terminology this reuses). Implemented as a small transparent
`<button class="town-prime-tap">` overlaid on the ring's own position
(same `inset: 4px; border-radius: 999px` as the ring `::before`), rendered
ONLY on a non-droppable, un-decorated prime empty lot (never inside move
mode's own droppable tile — that tile's whole box is already the drop
target, and nesting another interactive control there would both break the
drop tap and violate the no-nested-interactive-controls a11y rule). Its
click handler is wired to `onClickCapture`, not `onClick`: `useTileGestures`
attaches its own delegated `click` listener directly on `.town-grid` via
plain `addEventListener` (bypassing React's synthetic system by design), so
by the time a normal React `onClick` (bubble-phase, root-delegated) would
run, that native listener has ALREADY fired and already resolved the tap as
a tile tap. `onClickCapture` runs during the real capture pass, before the
event ever reaches `.town-grid`, so `stopPropagation()` there is early
enough to keep the two taps from double-firing (confirmed by a regression
test — `onPlotTap` asserted never called from a ring tap).

Toast primitive: `@toss/tds-mobile`'s `useToast`, already used the same way
by `App.tsx`/`TownScreen.tsx` for every other "explain what just happened"
message — no new UI primitive added.

**Regression tests.** `TownGrid.test.tsx`, describe "명당 (prime lot) on the
dynamic layer": ring suppressed on a real prime+decorated cell (both
layers), ring kept on a real prime+undecorated cell (both layers), ring tap
opens the toast without double-firing `onPlotTap`, and the tap button never
renders on a droppable (move-mode) prime tile.

## Test-harness collateral (NOT fixed — outside this task's file scope)

`useToast` requires `@toss/tds-mobile`'s `TDSMobileProvider` in the render
tree. `TownGrid.test.tsx`'s own `mountGrid()` and two ad-hoc
`mountComponent`/`root.render` call sites were updated to wrap with it (same
pattern `TownScreen.test.tsx` already used). One OTHER, unowned test file —
`src/devtools/moveModeDense.test.tsx` — also mounts `TownGrid` directly
without any provider, for a perf-smoke test unrelated to either task. It now
fails with `"useOverlay는 OverlayProvider 안에서만 사용 가능합니다."` and
needs the identical one-line `TDSMobileProvider` wrap. Not fixed here per
this task's explicit file-ownership boundary — flagged for the PM instead.

## Screenshots

- `1-prime-ring-off-tree.png` — `?scenario=empty`, zoomed in: a plain prime
  lot keeps its ring; the sprout- and tree-decorated lots next to it (also
  genuinely prime cells on the fixed map) show no ring.
- `2-prime-tooltip-open.png` — tapping the plain prime lot's ring opens the
  toast with the accurate seed-bonus copy; the decorated prime lot beside it
  stays ring-free in the same shot.
- `3-pinch-before.png` / `4-pinch-after.png` — `?scenario=mixedFootprints`,
  a real two-finger CDP touch pinch (asymmetric drift, not a synthetic
  symmetric zoom) taking the view from the default fit-to-screen scale to
  `scale(2.5)` (the configured `MAX_PINCH_SCALE` ceiling).
