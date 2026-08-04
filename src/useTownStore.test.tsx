/**
 * Wiring-level test for `useTownStore.addEntry` — round-5 fix, C2 finding:
 * every prior QA observation ended at building 1 / plot 0, where a broken
 * `plotFromIndex` is indistinguishable from a correct one (both give row 0,
 * col 0) and the append-to-an-existing-month-chunk write
 * (`loadEntriesForMonth` -> `[...existing, entry]` -> `saveEntriesForMonth`,
 * the path `useTownStore.ts`'s own NOTE comment flags as an untested
 * assumption) had zero evidence. This drives the real hook (not just the
 * pure `applyNewEntry`/`storage.ts` units, both already covered elsewhere)
 * through two saves in one session, then a full reload.
 *
 * No React Testing Library in this project (T002's dependency set) — a
 * minimal `react-dom/client` + `act` harness is enough to mount the hook and
 * read its return value after each state update, matching the pattern this
 * task's `useBackGuard.test.tsx` also uses.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EntryDraft } from "./entryActions";
import { setTimeTravelDate } from "./platform/clock";
import { setRandomOverride } from "./platform/random";
import { plotFromIndex } from "./selectors";
import { useTownStore } from "./useTownStore";

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  latest = useTownStore();
  return null;
}

/** Mounts (or remounts, simulating a reload) and waits for `loadBoot()`'s async chain to settle. */
async function mountAndWaitForBoot(): Promise<void> {
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const TODAY = "2026-08-02";

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  // ADDENDUM-02 §3.3/§7.1 B25: rng() = 0 -> pool[0] -> lowest free index ->
  // exactly today's pre-change sequential placement, so this file's
  // positional assertions stay green unchanged.
  setRandomOverride(() => 0);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setTimeTravelDate(null);
  setRandomOverride(null);
});

describe("useTownStore.addEntry — two saves in one session, then reload", () => {
  it("places both buildings via the real serpentine/storage wiring and survives a reload", async () => {
    await mountAndWaitForBoot();
    expect(latest?.loading).toBe(false);
    expect(latest?.buildingCount).toBe(0);
    expect(latest?.slotsRemaining).toBe(5);

    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(coffee);
    });
    expect(latest?.buildingCount).toBe(1);
    expect(latest?.slotsRemaining).toBe(4);
    expect(latest?.buildings[0]?.plotIndex).toBe(0);

    // The second save in the same session — the path never exercised before:
    // it must append to the SAME month's entries chunk (loadEntriesForMonth
    // -> [...existing, entry] -> saveEntriesForMonth), not overwrite it, and
    // plotFromIndex(1) must actually differ from plotFromIndex(0) (both would
    // otherwise alias to row 0/col 0 and this bug would be invisible).
    const secondCoffee: EntryDraft = { type: "expense", amountKrw: 3_200, categoryId: "food", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(secondCoffee);
    });
    expect(latest?.buildingCount).toBe(2);
    expect(latest?.slotsRemaining).toBe(3);
    expect(latest?.nextPlotIndex).toBe(2);
    const secondBuilding = latest!.buildings.find((b) => b.plotIndex === 1);
    expect(secondBuilding).toBeDefined();
    expect(plotFromIndex(secondBuilding!.plotIndex)).toEqual({ row: 0, col: 1 });
    expect(plotFromIndex(0)).not.toEqual(plotFromIndex(1)); // guards against the row0/col0 alias above

    // Hard reload: a brand-new hook instance (fresh storage client) must read
    // back BOTH entries/buildings — not just the first one saved. Writes are
    // debounced ~300ms (storage.ts); a real page reload flushes them first
    // via the `pagehide` listener useTownStore registers for exactly this —
    // fire that event to get the same guarantee here instead of waiting out
    // (or mocking) the debounce timer.
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(2);
    expect(latest?.slotsRemaining).toBe(3);
    expect(latest?.buildings.map((b) => b.plotIndex).sort()).toEqual([0, 1]);
    expect(latest?.buildings.map((b) => b.categoryId).sort()).toEqual(["cafe", "food"]);
  });
});
