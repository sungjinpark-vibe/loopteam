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
import { anchorsFor, cellOwners } from "./placement";
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
    // Gate-3 follow-up (A2): building #1 now queues its own first-founding
    // celebration, so the head of the FIFO here is that, not the move hint —
    // which is exactly the point (`maybeQueueMoveHint` deliberately refuses to
    // stack behind another notice). Popped before the hint assertions below;
    // the hint's own behaviour is unchanged and still fully asserted.
    expect(latest!.notice).toEqual({ kind: "firstBuilding" });
    const writesForFirstBuild = firstSpy.mock.calls.length;
    firstSpy.mockRestore();
    act(() => latest!.dismissNotice());
    expect(latest!.notice).toBeNull();

    const secondSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "food" }); // building #2 — crosses the threshold
    });
    // Gate-3-rerun fix (near-unanimous finding): a founding save ALSO fires
    // `TownScreen`'s own "OO 건물이 생겼어요" toast outside this hook's view, so
    // queuing the hint in the SAME commit produced two overlapping toasts in
    // the real app. The hint is deferred instead — no notice yet — to the
    // next opportunity with nothing else competing for the toast slot.
    expect(latest!.notice).toBeNull();
    // Zero EXTRA writes from the (deferred) hint attempt: this save's write
    // count matches the structurally identical prior save.
    expect(secondSpy.mock.calls.length).toBe(writesForFirstBuild);
    secondSpy.mockRestore();

    // A third build — still no competing toast in this hook's model, so still deferred.
    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "transport" });
    });
    expect(latest!.notice).toBeNull();

    // The next boot has nothing else to show, so the deferred hint surfaces here.
    await mountAndWaitForBoot();
    expect(latest!.notice).toEqual({ kind: "moveHint" });
    act(() => latest!.dismissNotice());
    expect(latest!.notice).toBeNull();

    // A successful move dismisses it FOREVER (in-memory immediately, and
    // persisted the next time core is saved for any other reason). The
    // destination is COMPUTED, not hardcoded: under the RX1-N2 spacing rule the
    // three buildings no longer land on consecutive cells (a run of 2 forces a
    // gap), so which cells are legal depends on where they actually landed.
    // This test is about the hint, not about any particular plot index.
    const moving = latest!.buildings[0];
    const others = latest!.buildings.filter((b) => b.id !== moving.id);
    const target = anchorsFor(1, 1, cellOwners(others)).find((a) => a !== moving.plotIndex);
    expect(target).toBeDefined();
    let moveResult: MoveResult | undefined;
    act(() => {
      moveResult = latest!.moveBuilding(moving.id, target!);
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
    // Gate-3 follow-up (A2): building #1's first-founding celebration takes
    // the FIFO head, and `maybeQueueMoveHint` will not stack behind it — so
    // the two builds are separated by a dismiss here instead of sharing one
    // `act`. The hint assertions themselves are untouched.
    act(() => {
      latest!.addEntry(COFFEE);
    });
    expect(latest!.notice).toEqual({ kind: "firstBuilding" });
    act(() => latest!.dismissNotice());
    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "food" });
    });
    // Deferred — this founding save fires its own competing toast in the real
    // app (see the previous test's note), so the hint doesn't queue here.
    expect(latest!.notice).toBeNull();
    await mountAndWaitForBoot(); // nothing else to show at boot — the hint surfaces here
    expect(latest!.notice).toEqual({ kind: "moveHint" });

    // Gate-3-rerun fix: an explicit dismiss now persists `moveHintSeen`
    // directly (was: only flipped in memory, riding "whatever save happens
    // next" — which showed the hint again on every reload that had no other
    // save in between, the panel's near-unanimous finding). No extra action
    // needed before the reload below for the dismiss to stick.
    act(() => {
      latest!.dismissNotice(); // explicit dismiss — NOT a move
    });
    expect(latest!.notice).toBeNull();
    flush();

    await mountAndWaitForBoot(); // fresh session — the PERSISTED dismiss must still gate the boot check above
    expect(latest!.notice).toBeNull();

    act(() => {
      latest!.addEntry({ ...COFFEE, categoryId: "living" });
    });
    expect(latest!.notice).toBeNull(); // and a later build-producing action doesn't re-queue it either
  });
});
