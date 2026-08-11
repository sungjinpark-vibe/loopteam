/**
 * ADDENDUM-02 §4.2/§4.5/§8.3 — `useTownStore.moveBuilding` wiring, exercised
 * through the real hook (not just `placement.test.ts`'s pure-function unit).
 * Same bare createRoot+act hook-harness pattern `useTownStore.test.tsx` /
 * `useTownStore.reconcile.test.tsx` already use.
 *
 * Covers AC-M4 (a move touches no OTHER `TownState` field), AC-M10 (exactly
 * one storage key written, survives a hard reload), and AC-H1 (the
 * discoverability hint appears once, is dismissed forever by a successful
 * move, and costs zero extra writes of its own).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryDraft } from "./entryActions";
import type { MoveResult } from "./placement";
import { setTimeTravelDate } from "./platform/clock";
import { setRandomOverride } from "./platform/random";
import { useTownStore } from "./useTownStore";

let container: HTMLDivElement;
let root: Root | null = null;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  latest = useTownStore();
  return null;
}

async function mountAndWaitForBoot(): Promise<void> {
  if (root !== null) act(() => root!.unmount());
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root!.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function flush(): void {
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
}

const TODAY = "2026-08-02";
const COFFEE: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  setRandomOverride(() => 0); // rng() = 0 -> pool[0] -> deterministic, sequential positions
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root !== null) act(() => root!.unmount());
  root = null;
  container.remove();
  setTimeTravelDate(null);
  setRandomOverride(null);
  vi.restoreAllMocks();
});

describe("useTownStore.moveBuilding — AC-M4/AC-M10", () => {
  it("changes only the moved building's plotIndex, writes exactly one storage key, and survives a reload", async () => {
    await mountAndWaitForBoot();
    act(() => {
      // rng() = 0 -> rollFootprint always rolls 1x1 -> anchorsFor's FIRST
      // reading-order ground cell each time. Cell 7 (row 0, col 7) is the
      // fixed map's first `ground` cell (ADDENDUM-08 §1.2); the second
      // building lands at cell 8.
      latest!.addEntry(COFFEE); // building at plot 7
      latest!.addEntry({ ...COFFEE, categoryId: "food" }); // building at plot 8
    });
    flush();
    const moving = latest!.buildings.find((b) => b.plotIndex === 7)!;
    const queueLengthBefore = latest!.queueLength;
    const slotsRemainingBefore = latest!.slotsRemaining;
    const streakDaysBefore = latest!.streakDays;

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    let result: MoveResult | undefined;
    act(() => {
      result = latest!.moveBuilding(moving.id, 10); // cell 10 — still row 0, ground, unoccupied
    });

    expect(result?.ok).toBe(true);
    expect(latest!.buildings.find((b) => b.id === moving.id)?.plotIndex).toBe(10);
    expect(latest!.buildings.find((b) => b.plotIndex === 8)).toBeDefined(); // the other building untouched

    // AC-M4 — no OTHER TownState field moved (checked through the store's own
    // public surface, which mirrors each TownState field 1:1).
    expect(latest!.queueLength).toBe(queueLengthBefore);
    expect(latest!.slotsRemaining).toBe(slotsRemainingBefore);
    expect(latest!.streakDays).toBe(streakDaysBefore);

    // AC-M10 — exactly one storage key written, the moved building's OWN
    // month chunk (writes are debounced ~300ms, same as every other write —
    // `flush()` forces the buffer, same trick every other test here uses).
    flush();
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(`ait.v1.buildings.${TODAY.slice(0, 7)}`, expect.any(String));

    await mountAndWaitForBoot();
    expect(latest!.buildings.find((b) => b.id === moving.id)?.plotIndex).toBe(10);
  });

  // Round-2 finding C2 #2: the earlier version only proved persistence
  // AFTER an explicit `flush()` (a clean pagehide) — it never showed the
  // write reaches the raw port with nothing left buffered on the ~300ms
  // debounce, which is exactly the window a real force-quit can land inside.
  // This asserts the raw `setItem` fires SYNCHRONOUSLY inside `moveBuilding`
  // itself, with zero manual flush and zero elapsed time — i.e. there is no
  // debounce window for a kill to land inside in the first place.
  it("writes to the raw port synchronously, with no debounce window a force-quit could land inside", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(COFFEE);
      latest!.addEntry({ ...COFFEE, categoryId: "food" });
    });
    flush(); // settle the two builds above before isolating the move's own write
    const moving = latest!.buildings.find((b) => b.plotIndex === 7)!; // cell 7 is the fixed map's first `ground` cell

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    act(() => {
      latest!.moveBuilding(moving.id, 10);
    });

    // No `flush()` call anywhere above this line — if this passes, the raw
    // port already has the write the instant `moveBuilding` returns.
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(`ait.v1.buildings.${TODAY.slice(0, 7)}`, expect.any(String));
    expect(JSON.parse(window.localStorage.getItem(`ait.v1.buildings.${TODAY.slice(0, 7)}`)!)).toContainEqual(
      expect.objectContaining({ id: moving.id, plotIndex: 10 }),
    );
  });

  it("occupied/out-of-town/unknown-id are all rejected with no write at all", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(COFFEE);
      latest!.addEntry({ ...COFFEE, categoryId: "food" });
    });
    flush();

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    act(() => {
      expect(latest!.moveBuilding("ghost", 5)).toEqual({ ok: false, reason: "not-found" });
      expect(latest!.moveBuilding(latest!.buildings[0].id, latest!.buildings[1].plotIndex)).toEqual({ ok: false, reason: "occupied" });
      expect(latest!.moveBuilding(latest!.buildings[0].id, -1)).toEqual({ ok: false, reason: "out-of-town" });
    });
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

describe("useTownStore — AC-H1: the move-discoverability hint", () => {
  it("appears exactly once at 2 buildings, never reappears after a successful move, and is a zero-extra-write mechanism", async () => {
    await mountAndWaitForBoot();
    expect(latest!.notice).toBeNull();

    const firstSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    act(() => {
      latest!.addEntry(COFFEE); // building #1 — below the >= 2 threshold
    });
    expect(latest!.notice).toBeNull();
    const writesForFirstBuild = firstSpy.mock.calls.length;
    firstSpy.mockRestore();

    const secondSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "food" }); // building #2 — crosses the threshold
    });
    expect(latest!.notice).toEqual({ kind: "moveHint" });
    // Zero EXTRA writes from the hint itself: this save's write count matches
    // the structurally identical prior save (same month, same shape), which
    // never queued a hint at all — the hint rides in the React state update,
    // not storage.
    expect(secondSpy.mock.calls.length).toBe(writesForFirstBuild);
    secondSpy.mockRestore();

    // The toast fires and immediately dismisses the QUEUE item (App.tsx's own
    // effect) — that is not the same as "seen forever" (D-36): a third build
    // must NOT re-queue the hint within the same session.
    act(() => {
      latest!.dismissNotice();
      latest!.addEntry({ ...COFFEE, categoryId: "transport" });
    });
    expect(latest!.notice).toBeNull();

    // A successful move dismisses it FOREVER (in-memory immediately, and
    // persisted the next time core is saved for any other reason). 3
    // buildings occupy cells 7/8/9 (rng pinned to 0 -> the first free ground
    // cell in reading order each time, ADDENDUM-08 §1.2) — cell 10 is
    // guaranteed free and in-bounds.
    const moving = latest!.buildings[0];
    let moveResult: MoveResult | undefined;
    act(() => {
      moveResult = latest!.moveBuilding(moving.id, 10);
    });
    expect(moveResult?.ok).toBe(true);

    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "living" }); // any later core save carries moveHintSeen along
    });
    flush();

    await mountAndWaitForBoot(); // fresh session — hintQueuedRef resets, but the PERSISTED flag must still gate it
    expect(latest!.notice).toBeNull();
    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "shopping" });
    });
    expect(latest!.notice).toBeNull(); // never reappears
  });

  // Round-2 finding C1 #1: the previous version only ever queued the hint
  // from a LIVE addEntry/claimNoSpend, so an existing town that already has
  // >= 2 buildings (i.e. every town today, all of which have `moveHintSeen`
  // unset) was never told the gesture exists until its NEXT build-producing
  // action. §4.5 states the condition as a STATE ("once the town has >= 2
  // buildings and the hint has not been seen..."), not an event.
  it("appears on a plain reload of an ALREADY-eligible town — a boot STATE check, not only a build-action event", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(COFFEE);
      latest!.addEntry({ ...COFFEE, categoryId: "food" }); // crosses the >= 2 threshold
    });
    flush();

    // A full app restart with no further action THIS session — same as a
    // town that has existed since before this feature shipped.
    await mountAndWaitForBoot();
    expect(latest!.notice).toEqual({ kind: "moveHint" });
  });

  // Round-2 finding C1 #2: `moveHintSeen` was previously set ONLY on a
  // successful move, so a player who saw the toast, ignored it, and kept
  // logging expenses got it re-queued every session, forever — not "one-shot"
  // across sessions as §4.5 requires ("dismissed forever ... or by an
  // explicit dismiss").
  it("a dismissed (not moved) hint never reappears, even across a full app restart", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(COFFEE);
      latest!.addEntry({ ...COFFEE, categoryId: "food" });
    });
    expect(latest!.notice).toEqual({ kind: "moveHint" });

    act(() => {
      latest!.dismissNotice(); // explicit dismiss — NOT a move
    });
    expect(latest!.notice).toBeNull();

    // The zero-extra-write trick (§4.5): the in-memory flag rides whatever
    // core save happens next for any other reason — here, an ordinary build.
    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "transport" });
    });
    flush();

    await mountAndWaitForBoot(); // fresh session — the PERSISTED dismiss must still gate the boot check above
    expect(latest!.notice).toBeNull();

    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "living" });
    });
    expect(latest!.notice).toBeNull(); // and a later build-producing action doesn't re-queue it either
  });
});
