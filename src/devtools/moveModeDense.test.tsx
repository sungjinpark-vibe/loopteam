/**
 * ADDENDUM-02 §8.3 AC-R4 — the half of it `reconcileDense.test.tsx` (part a)
 * explicitly left for this task: "entering move mode does not drop frames".
 * jsdom has no compositor, so this cannot literally measure a dropped frame —
 * what it CAN do, and what this repo already treats as its standard for this
 * class of claim (`reconcileDense.test.tsx`'s own doc comment), is mount the
 * REAL `TownGrid` over the REAL `dense` fixture (~5,400 tiles, §11) and
 * measure with `performance.now()` what a `movingId` flip and a cursor-only
 * arrow-key move actually cost in wall time — numbers logged, not just a
 * pass/fail bound (the same discipline `reconcileDense.test.tsx` uses).
 *
 * Round-2 finding C4 #6: this was the unmeasured risk — entering move mode
 * invalidates the whole ~5,400-tile `tiles` memo (every tile is re-created to
 * recompute its `isMoving`/droppable class), even though the fixture's
 * sequential builder packs the town nearly solid so the actual free-lot
 * (`.town-tile--droppable`) count stays small (G2, §3.2, only promises >= 1);
 * no test before this one drove the rebuild itself at scale. Round-2 finding
 * C4 #7 (fixed in `TownGrid.tsx`): a pure cursor move must NOT pay that same
 * cost — the second measurement below is the regression guard for that fix.
 *
 * Round-2 finding C4 #6 (re-opened): the ~1,000ms bound below is a loose
 * smoke guard against a structural regression (an O(n^2) path), NOT itself
 * evidence of "no dropped frames" — that claim was verified separately, live,
 * against a REAL Chromium tab: `dense` (~5,016 rendered tiles) loaded via the
 * dev-only `window.__aitLoadFixture("dense")` hook (`main.tsx`), a real
 * 550ms pointer hold entering move mode, and a real click committing a move
 * over that fixture measured a commit-to-DOM-settle cost of ~62ms (two
 * `requestAnimationFrame` turns after the click) — comfortably inside a
 * 60fps budget, and the same run also confirmed the move survives a real
 * page reload and that the raw `localStorage` write for the move is present
 * synchronously, in the same task as the click (no debounce window). Not
 * repeatable from this file (no browser here) — see the client-dev report
 * for this task for the reproduction script.
 *
 * Lives in `src/devtools/` (not `src/components/TownGrid.test.tsx`) because
 * it needs `FIXTURES`, and eslint's `no-restricted-imports` rule bans any
 * static import of `src/devtools/**` from outside this folder (MVP-SPEC
 * §11) — this file IS that folder, same reasoning as `reconcileDense.test.tsx`.
 */
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { BALANCE } from "../balance.approved";
import { TownGrid, type TownGridProps } from "../components/TownGrid";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { FIXTURES } from "./fixtures";

let mounted: MountedComponent | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const NOOP: Pick<
  TownGridProps,
  | "movingId"
  | "cursorIndex"
  | "onPlotLongPress"
  | "onPlotTap"
  | "onCursorMove"
  | "onCancel"
  | "onInvalidDrop"
> = {
  movingId: null,
  cursorIndex: null,
  onPlotLongPress: () => false,
  onPlotTap: () => {},
  onCursorMove: () => {},
  onCancel: () => {},
  onInvalidDrop: () => {},
};

function renderGrid(
  fixture: ReturnType<(typeof FIXTURES)["dense"]>,
  overrides: Partial<TownGridProps> = {},
) {
  return (
    <TownGrid
      buildings={fixture.buildings}
      justBuiltId={null}
      savingsByCategoryKrw={fixture.town.savingsByCategoryKrw}
      ladder={BALANCE.savingsTowerSegments}
      ladderOverrides={BALANCE.savingsStructureSegments}
      expPerLevel={BALANCE.expPerLevel}
      maxLevel={BALANCE.maxLevel}
      justGrew={null}
      onRiseSettled={() => {}}
      npcCount={0}
      {...NOOP}
      {...overrides}
    />
  );
}

describe("TownGrid over the dense fixture (193 fixed ground tiles) — AC-R4's move-mode half", () => {
  // ADDENDUM-08: the map is now a FIXED 20x20 grid (193 ground tiles,
  // townLayout.ts's own census) — it no longer grows with the fixture's
  // building count, so mounting `dense` (still ~5,400 build attempts across
  // 36 months, §11) is no longer the ~5,400-tile render round-2 C4 #6 was
  // worried about. The ground layer itself is always exactly 193 elements;
  // what this file still usefully proves is that entering move mode and
  // moving the cursor stay cheap even when `buildings` itself is a large
  // array (many of `dense`'s build attempts collide onto the same handful of
  // cells once the map is full — devtools/fixtures.ts's own documented
  // ceiling — which this test doesn't depend on being collision-free).
  it("mounts, enters move mode, and moves the keyboard cursor, each within a generous smoke budget — numbers logged", () => {
    const fixture = FIXTURES.dense();

    const mountStart = performance.now();
    mounted = mountComponent(renderGrid(fixture));
    const mountElapsedMs = performance.now() - mountStart;
    console.info(
      `[AC-R4] dense TownGrid initial mount elapsedMs=${mountElapsedMs.toFixed(1)}`,
    );

    const tileCountBefore =
      mounted.container.querySelectorAll(".town-tile").length;
    // The fixed map's own ground-cell census (ADDENDUM-08 §1.2) — one
    // `.town-tile` per ground cell, always, independent of building count.
    expect(tileCountBefore).toBe(193);

    // Entering move mode still rebuilds the ground-tile memo (every tile
    // recomputes its `isMoving`/`isDroppable` classes) — now bounded at 193
    // elements instead of growing with the town, but still worth a smoke
    // guard against a structural regression.
    //
    // The LAST building in the fixture, not the first: `dense`'s build
    // attempts (~5,400) vastly exceed the fixed map's 193 cells, so many
    // early buildings' anchors get reused by a later colliding build
    // (devtools/fixtures.ts's own documented overflow ceiling) and TownGrid's
    // anchor map keeps whichever building came LAST for a shared cell — only
    // the final building in array order is guaranteed to still own its anchor.
    const firstBuildingId = fixture.buildings[fixture.buildings.length - 1].id;
    const moveModeStart = performance.now();
    act(() => {
      mounted!.root.render(renderGrid(fixture, { movingId: firstBuildingId }));
    });
    const moveModeElapsedMs = performance.now() - moveModeStart;
    console.info(
      `[AC-R4] dense TownGrid entering move mode elapsedMs=${moveModeElapsedMs.toFixed(1)}`,
    );

    expect(
      mounted.container.querySelectorAll(".town-tile--moving").length,
    ).toBe(1);
    const droppableCount = mounted.container.querySelectorAll(
      ".town-tile--droppable",
    ).length;
    console.info(
      `[AC-R4] dense TownGrid free (droppable) lot count=${droppableCount}`,
    );
    // No lower-bound assertion here (unlike the old growing-pool guarantee):
    // `dense`'s build attempts vastly exceed the fixed map's 193 cells, so
    // whether any lot is still free for THIS building's footprint depends on
    // where its collisions landed — logged above for visibility, not asserted.

    // AC-R4's own literal boot budget (§10.4) re-used here as the smoke bound
    // for this render — generous headroom on any real machine; the point is
    // catching a structural regression (e.g. an O(n^2) path), not a coin flip.
    expect(moveModeElapsedMs).toBeLessThan(1_000);

    // A pure cursor move (arrow key) must stay cheap even here — this is the
    // regression guard for the C4 #7 fix (`TownGrid.tsx`'s imperative cursor
    // highlight, NOT the ground-tiles memo dependency).
    // Cell 7 (row 0, col 7) is the fixed map's first `ground` cell in reading
    // order (ADDENDUM-08 §1.2) — cells 0-6 are void/park and render no
    // `.town-tile` node at all to attach the cursor highlight to.
    const cursorMoveStart = performance.now();
    act(() => {
      mounted!.root.render(
        renderGrid(fixture, { movingId: firstBuildingId, cursorIndex: 7 }),
      );
    });
    const cursorMoveElapsedMs = performance.now() - cursorMoveStart;
    console.info(
      `[AC-R4] dense TownGrid cursor-only arrow-key move elapsedMs=${cursorMoveElapsedMs.toFixed(1)}`,
    );

    expect(
      mounted.container.querySelectorAll(".town-tile--cursor").length,
    ).toBe(1);
    // Tight guard, not the 1s formality above: a cursor move only touches at
    // most two DOM nodes imperatively, so it should be an order of magnitude
    // cheaper than the movingId flip that just rebuilt ~5,400 tiles.
    expect(cursorMoveElapsedMs).toBeLessThan(200);
  }, 15_000);
});
