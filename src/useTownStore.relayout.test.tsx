/**
 * ADDENDUM-01 §3.6/§5.4 — "a town saved before this change still loads
 * correctly and shows the one-time relayout notice", exercised through the
 * real hook (not just storage.ts's unit, `storage.relayout.test.ts`). Same
 * bare createRoot+act hook-harness pattern `useTownStore.test.tsx` uses — a
 * NEW file, so that file's existing assertions stay untouched.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTimeTravelDate } from "./platform/clock";
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

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setTimeTravelDate(null);
});

describe("useTownStore — ADDENDUM-01 §3.6 relayout notice", () => {
  it("fires the one-time relayout notice for a town saved before this change, then never again", async () => {
    // Seed localStorage exactly as a pre-addendum boot would have left it: a
    // real index with no `layoutVersion` key, a real core, and one building.
    const town = {
      townName: "우리 동네",
      nextPlotIndex: 1,
      streakDays: 0,
      longestStreakDays: 0,
      lastActOn: null,
      slotsUsedOn: "",
      slotsUsedToday: 0,
      highestTierSeen: 0,
      queue: [],
      noSpendDays: [],
      cumulativeSavingsKrw: 0,
      lastSettledPeriod: null,
    };
    const core = { town, budget: { monthlyBudgetKrw: null, updatedAt: 0 }, onboarded: true };
    const building = {
      id: "b1",
      source: { kind: "entry", entryId: "e1" },
      categoryId: "cafe",
      variantIndex: 0,
      plotIndex: 0,
      builtOn: TODAY,
      createdAt: 1,
    };
    window.localStorage.setItem("ait.v1.index", JSON.stringify({ schemaVersion: 1, entryMonths: [], buildingMonths: ["2026-08"] }));
    window.localStorage.setItem("ait.v1.core", JSON.stringify(core));
    window.localStorage.setItem("ait.v1.buildings.2026-08", JSON.stringify([building]));

    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(1);
    expect(latest?.notice).toEqual({ kind: "relayout" });

    act(() => {
      latest!.dismissNotice();
    });
    expect(latest?.notice).toBeNull();

    // Reload — the index was rewritten with the current LAYOUT_VERSION on
    // the first boot, so a second boot must not show it again.
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(1);
    expect(latest?.notice).toBeNull();
  });

  it("does not fire for a genuinely fresh install", async () => {
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(0);
    expect(latest?.notice).toBeNull();
  });
});
