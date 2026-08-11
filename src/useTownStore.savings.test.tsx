/**
 * ADDENDUM-01 §2.6a — level-up detection/toast wiring through the real hook.
 * Same bare createRoot+act harness `useTownStore.relayout.test.tsx` uses (a
 * NEW file, so that file's own assertions stay untouched).
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

async function mountAndWaitForBoot(): Promise<void> {
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const TODAY = "2026-08-02";
const [FIRST_THRESHOLD, SECOND_THRESHOLD] = BALANCE.savingsTowerSegments;

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
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

describe("useTownStore — ADDENDUM-01 §2.6a savings level-up", () => {
  it("fires a savings notice + justGrew exactly once per threshold crossed, and never touches slots/buildings (F13)", async () => {
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(0);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots);

    const deposit: EntryDraft = { type: "saving", amountKrw: FIRST_THRESHOLD, categoryId: "deposit", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(deposit);
    });
    // F13's invariant, observed live through the store, not just the pure fn.
    expect(latest?.buildingCount).toBe(0);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots);
    expect(latest?.savingsByCategoryKrw).toEqual({ deposit: FIRST_THRESHOLD });

    expect(latest?.notice).toEqual({ kind: "savings", id: "deposit" });
    expect(latest?.justGrew?.id).toBe("deposit");
    const firstSeq = latest!.justGrew!.seq;

    act(() => {
      latest!.dismissNotice();
    });
    expect(latest?.notice).toBeNull();

    // A second save into the SAME structure that does NOT cross a further
    // threshold must not re-fire — no notice queued.
    act(() => {
      latest!.addEntry({ type: "saving", amountKrw: 1, categoryId: "deposit", occurredOn: TODAY });
    });
    expect(latest?.notice).toBeNull();

    // Crossing the SECOND threshold on the SAME structure must fire again,
    // with a DIFFERENT seq — the regression test for §2.6a's "same value,
    // React sees no change" defect (justGrew must carry a seq, not a bare id).
    act(() => {
      latest!.addEntry({
        type: "saving",
        amountKrw: SECOND_THRESHOLD - FIRST_THRESHOLD - 1,
        categoryId: "deposit",
        occurredOn: TODAY,
      });
    });
    expect(latest?.notice).toEqual({ kind: "savings", id: "deposit" });
    expect(latest?.justGrew?.id).toBe("deposit");
    expect(latest?.justGrew?.seq).not.toBe(firstSeq);
  });

  it("AC-F13-3: a 저축 save still grows a structure with zero slots AND a full queue, and fires no overflow toast state", async () => {
    await mountAndWaitForBoot();
    // Burn every slot with expense saves.
    for (let i = 0; i < BALANCE.dailyBuildSlots; i++) {
      act(() => {
        latest!.addEntry({ type: "expense", amountKrw: 1_000, categoryId: "cafe", occurredOn: TODAY });
      });
    }
    expect(latest?.slotsRemaining).toBe(0);
    // Fill the queue to materialQueueMax.
    for (let i = 0; i < BALANCE.materialQueueMax; i++) {
      act(() => {
        latest!.addEntry({ type: "expense", amountKrw: 1_000, categoryId: "food", occurredOn: TODAY });
      });
    }
    expect(latest?.queueLength).toBe(BALANCE.materialQueueMax);

    act(() => {
      const result = latest!.addEntry({ type: "saving", amountKrw: FIRST_THRESHOLD, categoryId: "stock", occurredOn: TODAY });
      expect(result.queueOverflow).toBe(false);
      expect(result.queued).toBe(false);
    });
    expect(latest?.queueLength).toBe(BALANCE.materialQueueMax); // untouched by the saving save
    expect(latest?.savingsByCategoryKrw).toEqual({ stock: FIRST_THRESHOLD });
    expect(latest?.justGrew?.id).toBe("stock");
  });

  // Round-4 finding C2 #4/#5 — a real save crossing 2+ ladder rungs at once
  // (999,999 KRW into a fresh `deposit`, crossing BALANCE's first three
  // thresholds) showed the level-up toast TWICE live. The toast itself is
  // App.tsx's job (outside this hook), but the store's OWN enqueue is what
  // that fix depends on staying single — this asserts exactly ONE "savings"
  // notice reaches the queue for such a save, not one per rung crossed.
  it("round-4 C2 #4/#5: a single save crossing 3 ladder rungs at once enqueues exactly ONE savings notice", async () => {
    await mountAndWaitForBoot();
    const bigAmount = BALANCE.savingsTowerSegments[3] - 1; // 999,999 (the exact live-observed amount) — crosses rungs 0, 1, and 2 in one save
    act(() => {
      latest!.addEntry({ type: "saving", amountKrw: bigAmount, categoryId: "deposit", occurredOn: TODAY });
    });
    expect(latest?.notice).toEqual({ kind: "savings", id: "deposit" });
    act(() => {
      latest!.dismissNotice();
    });
    // If the store had queued the notice twice, this would still be the
    // SAME "savings"/"deposit" notice, not null.
    expect(latest?.notice).toBeNull();
  });

  // Round-4 finding C1 #2 — `justGrew` must return to `null` once the rise
  // animation settles, or the structure is stuck out of its idle loop forever.
  it("round-4 C1 #2: clearJustGrew resets justGrew back to null", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "saving", amountKrw: FIRST_THRESHOLD, categoryId: "goal", occurredOn: TODAY });
    });
    expect(latest?.justGrew?.id).toBe("goal");
    act(() => {
      latest!.clearJustGrew();
    });
    expect(latest?.justGrew).toBeNull();
  });
});
