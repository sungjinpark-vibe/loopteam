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

const NOOP: Pick<TownGridProps, "movingId" | "cursorIndex" | "onPlotLongPress" | "onPlotTap" | "onCursorMove" | "onCancel"> = {
  movingId: null,
  cursorIndex: null,
  onPlotLongPress: () => false,
  onPlotTap: () => {},
  onCursorMove: () => {},
  onCancel: () => {},
};

function renderGrid(fixture: ReturnType<(typeof FIXTURES)["dense"]>, overrides: Partial<TownGridProps> = {}) {
  return (
    <TownGrid
      nextPlotIndex={fixture.town.nextPlotIndex}
      buildings={fixture.buildings}
      justBuiltId={null}
      savingsByCategoryKrw={fixture.town.savingsByCategoryKrw}
      ladder={BALANCE.savingsTowerSegments}
      ladderOverrides={BALANCE.savingsStructureSegments}
      justGrew={null}
      onRiseSettled={() => {}}
      {...NOOP}
      {...overrides}
    />
  );
}

describe("TownGrid over the dense fixture (~5,400 tiles) — AC-R4's move-mode half", () => {
  it("mounts, enters move mode, and moves the keyboard cursor, each within a generous smoke budget — numbers logged", () => {
    const fixture = FIXTURES.dense();

    const mountStart = performance.now();
    mounted = mountComponent(renderGrid(fixture));
    const mountElapsedMs = performance.now() - mountStart;
    console.info(`[AC-R4] dense TownGrid initial mount elapsedMs=${mountElapsedMs.toFixed(1)}`);

    const tileCountBefore = mounted.container.querySelectorAll(".town-tile").length;
    expect(tileCountBefore).toBeGreaterThan(5_000);

    // Entering move mode: the movingId flip is exactly the unmeasured risk
    // C4 #6 named — it invalidates the whole ~5,400-element `tiles` memo
    // (every tile is re-created to recompute its `isMoving`/`isDroppable`
    // classes), even though the dense fixture's sequential fixture-builder
    // (`devtools/fixtures.ts`) packs the town nearly solid, so the actual
    // NUMBER of droppable (free) lots stays small — G2 (§3.2) only promises
    // ">= 1", never "most of them".
    const firstBuildingId = fixture.buildings[0].id;
    const moveModeStart = performance.now();
    act(() => {
      mounted!.root.render(renderGrid(fixture, { movingId: firstBuildingId }));
    });
    const moveModeElapsedMs = performance.now() - moveModeStart;
    console.info(`[AC-R4] dense TownGrid entering move mode elapsedMs=${moveModeElapsedMs.toFixed(1)}`);

    expect(mounted.container.querySelectorAll(".town-tile--moving").length).toBe(1);
    const droppableCount = mounted.container.querySelectorAll(".town-tile--droppable").length;
    console.info(`[AC-R4] dense TownGrid free (droppable) lot count=${droppableCount}`);
    expect(droppableCount).toBeGreaterThanOrEqual(1); // G2 — always at least one, even on a nearly-full town
    // AC-R4's own literal boot budget (§10.4) re-used here as the smoke bound
    // for this render — generous headroom on any real machine; the point is
    // catching a structural regression (e.g. an O(n^2) path), not a coin flip.
    expect(moveModeElapsedMs).toBeLessThan(1_000);

    // A pure cursor move (arrow key) must stay cheap even here — this is the
    // regression guard for the C4 #7 fix (`TownGrid.tsx`'s imperative cursor
    // highlight, NOT a `tiles` memo dependency).
    const cursorMoveStart = performance.now();
    act(() => {
      mounted!.root.render(renderGrid(fixture, { movingId: firstBuildingId, cursorIndex: 0 }));
    });
    const cursorMoveElapsedMs = performance.now() - cursorMoveStart;
    console.info(`[AC-R4] dense TownGrid cursor-only arrow-key move elapsedMs=${cursorMoveElapsedMs.toFixed(1)}`);

    expect(mounted.container.querySelectorAll(".town-tile--cursor").length).toBe(1);
    // Tight guard, not the 1s formality above: a cursor move only touches at
    // most two DOM nodes imperatively, so it should be an order of magnitude
    // cheaper than the movingId flip that just rebuilt ~5,400 tiles.
    expect(cursorMoveElapsedMs).toBeLessThan(200);
  });
});
