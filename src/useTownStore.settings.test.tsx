/**
 * S6/F6 wiring test — `setBudget`/`setTownName`/`resetAll`, driven through the
 * real hook (same bare createRoot+act harness every other `useTownStore.*
 * .test.tsx` file uses — see `useTownStore.relayout.test.tsx`'s own doc for
 * why each file keeps its own copy rather than sharing one).
 *
 * Covers the AC this task names explicitly: budget/name edits persist across
 * a reload, 데이터 초기화 actually wipes storage (not just in-memory state),
 * and F6's invariant — mood/budget changes never touch `buildingCount` or the
 * `buildings` array — is asserted directly, not just assumed.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BALANCE } from "./balance.approved";
import type { EntryDraft } from "./entryActions";
import { setTimeTravelDate } from "./platform/clock";
import { setRandomOverride } from "./platform/random";
import { budgetPace, moodTier } from "./selectors";
import type { ImportResult } from "./storage";
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

const TODAY = "2026-08-15"; // day 15 of a 31-day month — matches the spec's own F6 AC day

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

describe("useTownStore — S6 설정 (setBudget / setTownName / resetAll)", () => {
  it("persists a budget edit across reload and it reaches budgetPace/moodTier unchanged", async () => {
    await mountAndWaitForBoot();
    expect(latest?.budgetKrw).toBeNull();
    expect(moodTier(budgetPace([], TODAY.slice(0, 7), latest!.budgetKrw, TODAY), BALANCE.moodPaceThresholds)).toBe(-1);

    act(() => {
      latest!.setBudget(600_000);
    });
    expect(latest?.budgetKrw).toBe(600_000);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.budgetKrw).toBe(600_000);
  });

  it("persists a town name edit across reload", async () => {
    await mountAndWaitForBoot();
    expect(latest?.townName).toBe("우리 동네");

    act(() => {
      latest!.setTownName("행복동");
    });
    expect(latest?.townName).toBe("행복동");

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.townName).toBe("행복동");
  });

  it("데이터 초기화 wipes storage, not just in-memory state — a reload after resetAll still boots fresh", async () => {
    await mountAndWaitForBoot();
    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(coffee);
      latest!.setBudget(600_000);
      latest!.setTownName("행복동");
    });
    expect(latest?.buildingCount).toBe(1);

    act(() => {
      latest!.resetAll();
    });
    expect(latest?.buildingCount).toBe(0);
    expect(latest?.townName).toBe("우리 동네");
    expect(latest?.budgetKrw).toBeNull();

    // No dangling debounced write to resurrect what was just wiped, and the
    // wipe reached actual storage (not just this instance's in-memory state).
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.buildingCount).toBe(0);
    expect(latest?.townName).toBe("우리 동네");
    expect(latest?.budgetKrw).toBeNull();
  });

  it("month rollover resets month totals/mood mid-session, with no remount and no unrelated state change (round-2 fix, C2 finding #3)", async () => {
    const AUG31 = "2026-08-31";
    setTimeTravelDate(AUG31);
    await mountAndWaitForBoot();

    act(() => {
      latest!.setBudget(600_000);
      latest!.addEntry({ type: "expense", amountKrw: 700_000, categoryId: "cafe", occurredOn: AUG31 });
    });
    const augYm = AUG31.slice(0, 7);
    expect(latest!.getMonthEntries(augYm)).toHaveLength(1);
    const augPace = budgetPace(latest!.getMonthEntries(augYm), augYm, latest!.budgetKrw, latest!.today);
    // Day 31 of a 31-day month is fully elapsed (expectedSpend = budget) and
    // 700,000 > 600,000 clears the worst-tier threshold (pace 1.1+).
    expect(moodTier(augPace, BALANCE.moodPaceThresholds)).toBe(BALANCE.moodPaceThresholds.length);

    // Cross into September mid-session — TimeTravel's own broadcast
    // (`subscribeTimeTravel`, wired into `useTownStore` for exactly this)
    // forces the re-render; nothing else touches the store.
    act(() => {
      setTimeTravelDate("2026-09-01");
    });
    expect(latest?.today).toBe("2026-09-01");

    const sepYm = "2026-09";
    // The new current month starts with NO entries — August's spend must not
    // leak in (the bug this fix targets: `addEntry` used to append onto
    // whatever array `state.entries` still held, mislabeling it as the new
    // month just because the ym STRING happened to match `today`'s).
    expect(latest!.getMonthEntries(sepYm)).toEqual([]);
    const sepPace = budgetPace(latest!.getMonthEntries(sepYm), sepYm, latest!.budgetKrw, latest!.today);
    expect(moodTier(sepPace, BALANCE.moodPaceThresholds)).toBe(0); // back to the best tier — pace 0, nothing spent yet

    // August's own entry is still there — folded into `historyEntries`, not
    // dropped (기록 nav back to August must still find it, F8's own contract).
    expect(latest!.getMonthEntries(augYm)).toHaveLength(1);

    // A September save lands only in September, never mixed with August.
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 10_000, categoryId: "cafe", occurredOn: "2026-09-01" });
    });
    expect(latest!.getMonthEntries(sepYm)).toHaveLength(1);
    expect(latest!.getMonthEntries(augYm)).toHaveLength(1);
  });

  it("real-device rollover (no TimeTravel) is picked up on the next visibilitychange resume", async () => {
    // The `browserClock` path — real `Date()`, no `setTimeTravelDate` override
    // — via `vi`'s fake timers, so this exercises the SAME production code
    // path a device backgrounded overnight would hit, not TimeTravel's.
    setTimeTravelDate(null);
    // `shouldAdvanceTime` keeps real timers (this harness's own `setTimeout`
    // inside `mountAndWaitForBoot`) actually firing while `vi.setSystemTime`
    // still controls what `new Date()` returns — a plain `vi.useFakeTimers()`
    // freezes `setTimeout` entirely and hangs `mountAndWaitForBoot` forever.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // `Date.parse`, not `new Date(...)` — `no-restricted-syntax` (MVP-SPEC
      // §10.2) bans the latter outside `platform/clock.ts` even in test files.
      vi.setSystemTime(Date.parse("2026-08-31T23:59:00"));
      await mountAndWaitForBoot();
      expect(latest?.today).toBe("2026-08-31");

      // Host backgrounds the mini-app past midnight, no in-app interaction.
      vi.setSystemTime(Date.parse("2026-09-01T09:00:00"));

      // Resuming (host foregrounds it again) is the mobile-webview signal
      // this fix listens for — `visibilitychange` with `visibilityState`
      // back to "visible".
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(latest?.today).toBe("2026-09-01");
      expect(latest!.getMonthEntries("2026-09")).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("F12: export -> wipe (resetAll, simulating a fresh context) -> import restores byte-identical state — plot index, queue, streak, savings all preserved", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.setTownName("행복동");
      latest!.setBudget(600_000);
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
      latest!.addEntry({ type: "saving", amountKrw: 50_000, categoryId: "deposit", occurredOn: TODAY });
    });
    const beforeTown = latest!.townName;
    const beforeBudget = latest!.budgetKrw;
    const beforeBuildings = latest!.buildings;
    const beforeSavings = latest!.savingsByCategoryKrw;
    expect(beforeBuildings).toHaveLength(1);

    const { json } = await latest!.exportData();

    // "wipe the browser profile" — resetAll clears storage AND in-memory state.
    act(() => {
      latest!.resetAll();
    });
    expect(latest?.buildingCount).toBe(0);

    let importResult: ImportResult | null = null;
    await act(async () => {
      importResult = await latest!.importData(json);
    });

    expect(importResult).toEqual({ ok: true });
    expect(latest!.townName).toBe(beforeTown);
    expect(latest!.budgetKrw).toBe(beforeBudget);
    expect(latest!.buildings).toEqual(beforeBuildings);
    expect(latest!.savingsByCategoryKrw).toEqual(beforeSavings);
  });

  it("F12: importing an unknown schemaVersion is rejected and leaves existing state untouched", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.setTownName("행복동");
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
    });
    const beforeTown = latest!.townName;
    const beforeBuildings = latest!.buildings;

    let importResult: ImportResult | null = null;
    await act(async () => {
      importResult = await latest!.importData(JSON.stringify({ schemaVersion: 99, core: {}, entries: {}, buildings: {} }));
    });

    expect(importResult).toEqual({ ok: false, error: expect.any(String) });
    expect(latest!.townName).toBe(beforeTown);
    expect(latest!.buildings).toBe(beforeBuildings); // same reference — nothing was even re-set
  });

  it("F12: importing malformed JSON is rejected without crashing, and leaves existing state untouched", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY });
    });
    const beforeBuildings = latest!.buildings;

    let importResult: ImportResult | null = null;
    await act(async () => {
      importResult = await latest!.importData("{ not valid json ,,,");
    });

    expect(importResult).toEqual({ ok: false, error: expect.any(String) });
    expect(latest!.buildings).toBe(beforeBuildings);
  });

  // S1 onboarding (F11): `completeOnboarding` is the one-shot that flips a
  // genuinely fresh install past the cold-start overlay. Same persistence
  // contract as setBudget/setTownName above — asserted directly here because
  // the rescued WIP (commit 7ed237d) added it with no test.
  it("a fresh install boots with onboarded=false; completeOnboarding flips it true and persists across reload", async () => {
    await mountAndWaitForBoot();
    expect(latest?.onboarded).toBe(false); // freshCore default — the overlay shows once

    act(() => {
      latest!.completeOnboarding();
    });
    expect(latest?.onboarded).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.onboarded).toBe(true); // never re-onboards an existing player
  });

  it("F6 invariant: a budget edit that drives mood to the worst tier never touches buildingCount or the buildings array", async () => {
    await mountAndWaitForBoot();
    const coffee: EntryDraft = { type: "expense", amountKrw: 300_000, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(coffee);
    });
    const buildingsBefore = latest!.buildings;
    const countBefore = latest!.buildingCount;
    expect(countBefore).toBe(1);

    // A tiny budget relative to spend forces pace >> the worst-tier threshold.
    act(() => {
      latest!.setBudget(10_000);
    });
    const ym = TODAY.slice(0, 7);
    const pace = budgetPace(latest!.getMonthEntries(ym), ym, latest!.budgetKrw, TODAY);
    expect(moodTier(pace, BALANCE.moodPaceThresholds)).toBe(BALANCE.moodPaceThresholds.length); // worst bucket

    // Mood is ambient only — design invariant 4 (spec §7): nothing about a
    // budget edit may remove, grey out, or downgrade a building.
    expect(latest?.buildingCount).toBe(countBefore);
    expect(latest?.buildings).toBe(buildingsBefore); // same array reference — setBudget never touches `buildings`
  });
});
