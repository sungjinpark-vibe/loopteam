/**
 * `useMoveMode` — ADDENDUM-02 §4.3's move-mode state machine, tested
 * independent of the gesture recognizer and independent of rendering (same
 * bare createRoot+act hook-harness pattern `useBackGuard.test.tsx` already
 * uses). Round-2 lead findings this file exists to close:
 *
 *   - C1 #4: the Android/gesture back wiring (`useBackGuard(movingId !== null,
 *     false, cancel)`) had no test asserting THIS caller's wiring works — only
 *     `useBackGuard.ts` itself had a test. A `popstate` dispatch here proves
 *     the composition, not just the primitive.
 *   - C1 #3: a tap outside `.town-grid` entirely (the header, the FAB, ...)
 *     did not cancel move mode. `pointerdown` dispatched on a node outside a
 *     `.town-grid` element now does; a `pointerdown` INSIDE `.town-grid` does
 *     NOT (the grid's own delegated listener owns that — see
 *     `TownGrid.test.tsx`'s AC-M8/M9/K2 suite).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MoveResult } from "../placement";
import type { Building } from "../types";
import { useMoveMode, type UseMoveModeResult } from "./useMoveMode";

let container: HTMLDivElement;
let root: Root;
let latest: UseMoveModeResult | null = null;

function Harness({ buildings, moveBuilding }: { buildings: Building[]; moveBuilding: (id: string, to: number) => MoveResult }) {
  latest = useMoveMode(buildings, moveBuilding);
  return null;
}

const building: Building = {
  id: "b1",
  source: { kind: "entry", entryId: "e1" },
  categoryId: "cafe",
  variantIndex: 0,
  plotIndex: 0,
  builtOn: "2026-08-02",
  createdAt: 1,
};

function render(buildings: Building[], moveBuilding: (id: string, to: number) => MoveResult) {
  act(() => {
    root.render(<Harness buildings={buildings} moveBuilding={moveBuilding} />);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useMoveMode — basic state machine", () => {
  it("long-press enters move mode; a tap on a free lot commits via moveBuilding", () => {
    const calls: Array<[string, number]> = [];
    const moveBuilding = (id: string, to: number): MoveResult => {
      calls.push([id, to]);
      return { ok: true, buildings: [{ ...building, plotIndex: to }], from: building.plotIndex, to };
    };
    render([building], moveBuilding);

    act(() => latest!.onPlotLongPress(0));
    expect(latest!.movingId).toBe("b1");

    act(() => latest!.onPlotTap(5));
    expect(calls).toEqual([["b1", 5]]);
    expect(latest!.movingId).toBeNull(); // mode exits on a successful commit
    expect(latest!.justMoved).toEqual({ id: "b1", from: 0, to: 5 });
  });
});

// Round-2 finding C2 #3: 되돌리기 (undo) previously discarded `moveBuilding`'s
// own `MoveResult` and dismissed the bar unconditionally — if the vacated
// `from` lot had meanwhile been taken (a new build landing there during the
// 5s undo window), the user's explicit undo tap silently did nothing.
describe("useMoveMode — undo() honors moveBuilding's MoveResult (round-2 finding C2 #3)", () => {
  it("a successful undo dismisses the post-move bar", () => {
    const calls: Array<[string, number]> = [];
    const moveBuilding = (id: string, to: number) => {
      calls.push([id, to]);
      return { ok: true as const, buildings: [{ ...building, plotIndex: to }], from: building.plotIndex, to };
    };
    render([building], moveBuilding);

    act(() => latest!.onPlotLongPress(0));
    act(() => latest!.onPlotTap(5));
    expect(latest!.justMoved).toEqual({ id: "b1", from: 0, to: 5 });

    act(() => latest!.undo());
    expect(calls).toEqual([
      ["b1", 5],
      ["b1", 0], // undo moves it back to `from`
    ]);
    expect(latest!.justMoved).toBeNull(); // dismissed
    expect(latest!.undoFailedMessage).toBeNull();
  });

  it("a REJECTED undo (the vacated 'from' lot was taken meanwhile) keeps the bar up and surfaces a message, instead of silently doing nothing", () => {
    let rejectNextUndo = false;
    const moveBuilding = (_id: string, to: number) => {
      if (rejectNextUndo) return { ok: false as const, reason: "occupied" as const };
      return { ok: true as const, buildings: [{ ...building, plotIndex: to }], from: building.plotIndex, to };
    };
    render([building], moveBuilding);

    act(() => latest!.onPlotLongPress(0));
    act(() => latest!.onPlotTap(5));
    expect(latest!.justMoved).toEqual({ id: "b1", from: 0, to: 5 });

    rejectNextUndo = true; // simulate a new build having landed on plot 0 in the meantime
    act(() => latest!.undo());
    expect(latest!.justMoved).toEqual({ id: "b1", from: 0, to: 5 }); // NOT dismissed
    expect(latest!.undoFailedMessage).not.toBeNull();

    // A retry (e.g. after the new build moved again) succeeds normally.
    rejectNextUndo = false;
    act(() => latest!.undo());
    expect(latest!.justMoved).toBeNull();
  });
});

// Gate-3-rerun fix (round-3, all five expert lenses): a hold-drag-release
// that landed on no tile at all — `useTileGestures`'s `onInvalidDrop` —
// previously reached nothing, so move mode stayed open with zero feedback,
// indistinguishable from a hang.
describe("useMoveMode — onInvalidDrop (round-3 finding, drag-release with no tile under it)", () => {
  it("surfaces a reject message and keeps move mode open, while mid-move", () => {
    render([building], () => ({ ok: false, reason: "not-found" }));

    act(() => latest!.onPlotLongPress(0));
    expect(latest!.movingId).toBe("b1");

    act(() => latest!.onInvalidDrop());
    expect(latest!.movingId).toBe("b1"); // still open, not silently stuck with no signal
    expect(latest!.rejectMessage).not.toBeNull();
  });

  it("is a no-op outside move mode", () => {
    render([building], () => ({ ok: false, reason: "not-found" }));
    act(() => latest!.onInvalidDrop());
    expect(latest!.rejectMessage).toBeNull();
    expect(latest!.movingId).toBeNull();
  });
});

// Deliverable 2 of the move-mode defect fix: the reject banner (`TownScreen`
// renders `move.rejectMessage`, composed nowhere else) must say WHY, not just
// that it failed. `moveBuilding`'s discriminated `reason` drives the copy.
describe("useMoveMode — rejection reason drives the banner copy (one short line per MoveRejection)", () => {
  it.each([
    ["occupied", "이미 건물이 있는 자리예요"],
    ["no-fit", "위아래 줄을 비워야 해요"], // RX1-N2 spacing rule
    ["out-of-town", "그 자리엔 지을 수 없어요"],
    // `same-plot`/`not-found` are unreachable from the real UI (see the tests
    // below) but still need a message if `moveBuilding` ever returns one
    // directly — both fall back to the generic line.
    ["same-plot", "그 자리로는 옮길 수 없어요"],
    ["not-found", "그 자리로는 옮길 수 없어요"],
  ] as const)("reason %s -> %s", (reason, expectedMessage) => {
    render([building], () => ({ ok: false, reason }));
    act(() => latest!.onPlotLongPress(0));
    act(() => latest!.onPlotTap(5)); // 5 !== moving.plotIndex (0): reaches moveBuilding, not the same-plot cancel guard
    expect(latest!.rejectMessage).toBe(expectedMessage);
    expect(latest!.movingId).toBe("b1"); // rejection keeps move mode open
  });

  it("same-plot is actually intercepted before moveBuilding is ever called — tapping the moving building cancels, it never shows a reject message", () => {
    const calls: number[] = [];
    render([building], (_id, to) => {
      calls.push(to);
      return { ok: false, reason: "same-plot" };
    });
    act(() => latest!.onPlotLongPress(0));
    act(() => latest!.onPlotTap(0)); // taps the moving building's own current plot
    expect(calls).toEqual([]); // moveBuilding never reached
    expect(latest!.movingId).toBeNull(); // cancelled, not rejected
    expect(latest!.rejectMessage).toBeNull();
  });
});

describe("useMoveMode — AC C1 #4: Android/gesture back cancels move mode (useBackGuard wiring)", () => {
  it("a popstate while movingId is set exits move mode", () => {
    render([building], () => ({ ok: false, reason: "not-found" }));

    act(() => latest!.onPlotLongPress(0));
    expect(latest!.movingId).toBe("b1");

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(latest!.movingId).toBeNull();
  });

  it("does nothing when not in move mode", () => {
    render([building], () => ({ ok: false, reason: "not-found" }));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(latest!.movingId).toBeNull();
  });
});

describe("useMoveMode — AC C1 #3: a tap outside .town-grid cancels move mode", () => {
  it("a pointerdown on a node with no .town-grid ancestor cancels", () => {
    render([building], () => ({ ok: false, reason: "not-found" }));
    act(() => latest!.onPlotLongPress(0));
    expect(latest!.movingId).toBe("b1");

    const header = document.createElement("div");
    header.className = "town-header";
    document.body.appendChild(header);
    act(() => {
      header.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    });
    expect(latest!.movingId).toBeNull();
    header.remove();
  });

  it("a pointerdown INSIDE .town-grid does NOT cancel — the grid owns its own taps", () => {
    render([building], () => ({ ok: false, reason: "not-found" }));
    act(() => latest!.onPlotLongPress(0));
    expect(latest!.movingId).toBe("b1");

    const grid = document.createElement("div");
    grid.className = "town-grid";
    const tile = document.createElement("div");
    grid.appendChild(tile);
    document.body.appendChild(grid);
    act(() => {
      tile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    });
    expect(latest!.movingId).toBe("b1"); // still in move mode
    grid.remove();
  });
});
