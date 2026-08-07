/**
 * F8/F9 기록 — wiring tests for `useTownStore.deleteEntry`/`updateEntry`.
 * Same bare `react-dom/client` + `act` harness as `useTownStore.test.tsx`
 * (no React Testing Library in this project) — drives the real hook through
 * storage, not just a pure function in isolation.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
import type { EntryDraft } from "./entryActions";
import { setTimeTravelDate } from "./platform/clock";
import { setRandomOverride } from "./platform/random";
import { useTownStore } from "./useTownStore";

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  latest = useTownStore();
  return null;
}

// A plain function, not inlined, so TS doesn't narrow `latest` to `never`
// against `Harness`'s reassignment (same note as `historyDense.test.tsx`'s
// own `stillLoading`).
function stillLoading(): boolean {
  return latest === null || latest.loading;
}

// A single fixed `setTimeout(0)` tick is NOT enough to guarantee boot has
// settled: `useTownStore`'s boot effect awaits `drainQueueAndPersist`, which
// yields via its own `setTimeout(0)` (`yieldToMainThread`, storage.ts) once
// per >8ms time-budget slice — under file-parallelism contention that extra
// macrotask can land AFTER this function's single wait tick already
// resolved, so the test would proceed against a still-null `state`
// (`ensureMonthLoaded` no-ops when `state === null`). Poll `loading` instead
// of trusting a fixed number of ticks (T017 finding C5 — flaked at
// `useTownStore.history.test.tsx:249-250`).
async function mountAndWaitForBoot(): Promise<void> {
  root = createRoot(container);
  latest = null;
  act(() => {
    root.render(<Harness />);
  });
  for (let i = 0; i < 200 && stillLoading(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const TODAY = "2026-08-15";

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  setRandomOverride(() => 0); // deterministic plot pick — lowest free index
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setTimeTravelDate(null);
  setRandomOverride(null);
});

describe("deleteEntry — F9", () => {
  it("removes the entry AND its building; the plot becomes empty, the OTHER building doesn't shift, and the slot counter is unchanged (not refunded)", async () => {
    await mountAndWaitForBoot();
    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    const lunch: EntryDraft = { type: "expense", amountKrw: 8_000, categoryId: "food", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(coffee);
      latest!.addEntry(lunch);
    });
    expect(latest?.buildingCount).toBe(2);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 2);
    const ym = TODAY.slice(0, 7);
    latest!.ensureMonthLoaded(ym); // no-op for the current month, exercised for parity with a history-tab call
    const entries = latest!.getMonthEntries(ym);
    expect(entries).toHaveLength(2);
    const cafeEntry = entries.find((e) => e.categoryId === "cafe")!;
    const survivorPlot = entries.find((e) => e.categoryId === "food")!;
    const survivorBuildingBefore = latest!.buildings.find((b) => b.source.kind === "entry" && b.source.entryId === survivorPlot.id)!;

    act(() => {
      latest!.deleteEntry(cafeEntry.id, ym);
    });

    expect(latest?.buildingCount).toBe(1); // -1
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 2); // unchanged — not refunded
    expect(latest!.buildings.some((b) => b.source.kind === "entry" && b.source.entryId === cafeEntry.id)).toBe(false);
    const survivorBuildingAfter = latest!.buildings.find((b) => b.id === survivorBuildingBefore.id)!;
    expect(survivorBuildingAfter.plotIndex).toBe(survivorBuildingBefore.plotIndex); // no shift
    expect(latest!.getMonthEntries(ym).map((e) => e.id)).toEqual([survivorPlot.id]);

    // Reload — the deletion (entry + building) and slot count persisted.
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(1);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 2);
    latest!.ensureMonthLoaded(ym);
    expect(latest!.getMonthEntries(ym)).toHaveLength(1);
  });

  it("deleting a 저축 entry (no building) backs it out of the tower total", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "saving", amountKrw: 100_000, categoryId: "goal", occurredOn: TODAY });
    });
    const ym = TODAY.slice(0, 7);
    const savingEntry = latest!.getMonthEntries(ym)[0];
    act(() => {
      latest!.deleteEntry(savingEntry.id, ym);
    });
    expect(latest!.getMonthEntries(ym)).toHaveLength(0);
  });

  // Round-4 escalation repro (highest-value fix, C2): dailyBuildSlots+1 entries
  // in one day -> dailyBuildSlots build, 1 queues. Deleting the QUEUED one must
  // drop its material from town.queue, or the next day's drain builds a
  // building for an entry that no longer exists.
  it("deleting a QUEUED entry drops its material from the queue — the next day's drain never builds a ghost", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      for (let i = 0; i < BALANCE.dailyBuildSlots + 1; i++) {
        latest!.addEntry({ type: "expense", amountKrw: 1_000 + i, categoryId: "food", occurredOn: TODAY });
      }
    });
    expect(latest?.buildingCount).toBe(BALANCE.dailyBuildSlots);
    expect(latest?.queueLength).toBe(1);
    const entries = latest!.getMonthEntries(ym);
    const queuedEntry = entries.find((e) => e.queued)!;
    expect(queuedEntry).toBeDefined();

    act(() => {
      latest!.deleteEntry(queuedEntry.id, ym);
    });
    expect(latest?.queueLength).toBe(0); // dropped, not left dangling
    expect(latest!.getMonthEntries(ym)).toHaveLength(BALANCE.dailyBuildSlots);

    // Reload on the NEXT day — the drain must see an empty queue and build nothing.
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    setTimeTravelDate("2026-08-16");
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(BALANCE.dailyBuildSlots); // NOT +1 — no ghost building for the deleted entry
    expect(latest?.queueLength).toBe(0);
    // Every remaining building resolves back to a live entry (the F14 invariant this fix restores).
    latest!.ensureMonthLoaded(ym);
    const liveIds = new Set(latest!.getMonthEntries(ym).map((e) => e.id));
    for (const b of latest!.buildings) {
      if (b.source.kind === "entry") expect(liveIds.has(b.source.entryId)).toBe(true);
    }
  });

  it("editing a QUEUED entry's category patches the pending material, not a building", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      for (let i = 0; i < BALANCE.dailyBuildSlots + 1; i++) {
        latest!.addEntry({ type: "expense", amountKrw: 1_000 + i, categoryId: "food", occurredOn: TODAY });
      }
    });
    const queuedEntry = latest!.getMonthEntries(ym).find((e) => e.queued)!;

    act(() => {
      latest!.updateEntry(queuedEntry.id, ym, { categoryId: "cafe" });
    });

    // Reload the NEXT day and confirm the drained building actually got the new category.
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    setTimeTravelDate("2026-08-16");
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(BALANCE.dailyBuildSlots + 1);
    const drainedBuilding = latest!.buildings.find(
      (b) => b.source.kind === "entry" && b.source.entryId === queuedEntry.id,
    );
    expect(drainedBuilding?.categoryId).toBe("cafe");
  });
});

describe("updateEntry — F9", () => {
  it("amount/memo/date-within-month edits do not move the building", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
    });
    const ym = TODAY.slice(0, 7);
    const entry = latest!.getMonthEntries(ym)[0];
    const buildingBefore = latest!.buildings.find((b) => b.source.kind === "entry" && b.source.entryId === entry.id)!;

    act(() => {
      latest!.updateEntry(entry.id, ym, { amountKrw: 9_900, memo: "americano" });
    });

    const buildingAfter = latest!.buildings.find((b) => b.id === buildingBefore.id)!;
    expect(buildingAfter.plotIndex).toBe(buildingBefore.plotIndex);
    expect(buildingAfter.builtOn).toBe(buildingBefore.builtOn);
    const updated = latest!.getMonthEntries(ym)[0];
    expect(updated.amountKrw).toBe(9_900);
    expect(updated.memo).toBe("americano");
  });

  it("a category edit re-skins the bound building in place, keeping the same plot", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
    });
    const ym = TODAY.slice(0, 7);
    const entry = latest!.getMonthEntries(ym)[0];
    const buildingBefore = latest!.buildings.find((b) => b.source.kind === "entry" && b.source.entryId === entry.id)!;
    expect(buildingBefore.categoryId).toBe("cafe");

    act(() => {
      latest!.updateEntry(entry.id, ym, { categoryId: "food" });
    });

    const buildingAfter = latest!.buildings.find((b) => b.id === buildingBefore.id)!;
    expect(buildingAfter.categoryId).toBe("food");
    expect(buildingAfter.plotIndex).toBe(buildingBefore.plotIndex);
    expect(buildingAfter.builtOn).toBe(buildingBefore.builtOn);
  });

  it("re-dating across a month boundary moves the entry between chunks and updates both months' totals; a reload confirms it", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
    });
    const thisYm = TODAY.slice(0, 7); // '2026-08'
    const lastYm = "2026-07";
    const entry = latest!.getMonthEntries(thisYm)[0];
    const buildingBefore = latest!.buildings.find((b) => b.source.kind === "entry" && b.source.entryId === entry.id)!;

    act(() => {
      latest!.updateEntry(entry.id, thisYm, { occurredOn: "2026-07-20" });
    });

    expect(latest!.getMonthEntries(thisYm)).toHaveLength(0);
    latest!.ensureMonthLoaded(lastYm);
    const movedMonth = latest!.getMonthEntries(lastYm);
    expect(movedMonth).toHaveLength(1);
    expect(movedMonth[0].occurredOn).toBe("2026-07-20");

    // The building stays in its builtOn chunk (it rose "today", F2/F4) —
    // re-dating the entry must never move it.
    const buildingAfter = latest!.buildings.find((b) => b.id === buildingBefore.id)!;
    expect(buildingAfter.builtOn).toBe(buildingBefore.builtOn);
    expect(buildingAfter.plotIndex).toBe(buildingBefore.plotIndex);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest!.getMonthEntries(thisYm)).toHaveLength(0);
    latest!.ensureMonthLoaded(lastYm);
    expect(latest!.getMonthEntries(lastYm)).toHaveLength(1);
    expect(latest!.buildingCount).toBe(1); // the building itself is untouched by the re-date
  });

  it("moving an entry INTO an already-visited month appends rather than overwriting its cached chunk", async () => {
    await mountAndWaitForBoot();
    const lastYm = "2026-07";
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 1_000, categoryId: "food", occurredOn: "2026-07-05" });
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
    });
    latest!.ensureMonthLoaded(lastYm);
    expect(latest!.getMonthEntries(lastYm)).toHaveLength(1); // visited BEFORE the move below

    const thisYm = TODAY.slice(0, 7);
    const toMove = latest!.getMonthEntries(thisYm)[0];
    act(() => {
      latest!.updateEntry(toMove.id, thisYm, { occurredOn: "2026-07-20" });
    });

    expect(latest!.getMonthEntries(lastYm)).toHaveLength(2); // appended, not overwritten
  });

  // Round-4 finding C1: `type` is now editable (was display-only).
  it("editing type from 저축 to 지출 builds a fresh building today and starts consuming a slot", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "saving", amountKrw: 10_000, categoryId: "goal", occurredOn: TODAY });
    });
    const ym = TODAY.slice(0, 7);
    const entry = latest!.getMonthEntries(ym)[0];
    expect(latest?.buildingCount).toBe(0);
    expect(latest?.savingsByCategoryKrw?.goal).toBe(10_000);

    act(() => {
      latest!.updateEntry(entry.id, ym, { type: "expense", categoryId: "food" });
    });

    expect(latest?.buildingCount).toBe(1);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 1);
    expect(latest?.savingsByCategoryKrw?.goal ?? 0).toBe(0);
    const updated = latest!.getMonthEntries(ym)[0];
    expect(updated.type).toBe("expense");
    expect(updated.buildingId).not.toBeNull();
  });

  it("editing type from 지출 to 저축 removes the building (not refunded) and starts contributing to the tower", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
    });
    const ym = TODAY.slice(0, 7);
    const entry = latest!.getMonthEntries(ym)[0];
    expect(latest?.buildingCount).toBe(1);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 1);

    act(() => {
      latest!.updateEntry(entry.id, ym, { type: "saving", categoryId: "goal" });
    });

    expect(latest?.buildingCount).toBe(0);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 1); // still not refunded
    expect(latest?.savingsByCategoryKrw?.goal).toBe(4_500);
  });

  it("editing type between 지출 and 수입 re-skins the existing building in place", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
    });
    const ym = TODAY.slice(0, 7);
    const entry = latest!.getMonthEntries(ym)[0];
    const buildingBefore = latest!.buildings.find((b) => b.source.kind === "entry" && b.source.entryId === entry.id)!;

    act(() => {
      latest!.updateEntry(entry.id, ym, { type: "income", categoryId: "salary" });
    });

    expect(latest?.buildingCount).toBe(1); // same building, not a new one
    const buildingAfter = latest!.buildings.find((b) => b.id === buildingBefore.id)!;
    expect(buildingAfter.categoryId).toBe("salary");
    expect(buildingAfter.plotIndex).toBe(buildingBefore.plotIndex);
    const updated = latest!.getMonthEntries(ym)[0];
    expect(updated.type).toBe("income");
  });
});
