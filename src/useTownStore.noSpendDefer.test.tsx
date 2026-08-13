/**
 * 사용자 지시 2026-08-13 — "공원도 이월되게 해줘".
 *
 * Before the RX1-N2 spacing rule the map held ~193 buildings and "the town is
 * full" was unreachable in practice; it holds 81 now, so a real player reaches
 * it. A full town used to REJECT the 무지출 claim outright (a park had no queue
 * path, only ledger entries did). It now defers onto that same F14 queue and
 * builds on the next morning's drain.
 *
 * The town here is saturated THROUGH the real placer (`testUtils/saturatedTown`)
 * — a hand-built "every cell occupied" town is a state the placer could never
 * produce under the spacing rule, so it would prove nothing about the path a
 * player actually walks.
 *
 * Same bare createRoot+act hook harness the other `useTownStore.*.test.tsx`
 * files use — no React Testing Library in this project.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
import { canPlace, cellOwners } from "./placement";
import { setTimeTravelDate } from "./platform/clock";
import { setRandomOverride } from "./platform/random";
import { saturatedTown, townWithOneFreeCell } from "./testUtils/saturatedTown";
import { LAYOUT_VERSION } from "./townLayout";
import type { Building } from "./types";
import { useTownStore } from "./useTownStore";

let container: HTMLDivElement;
let root: Root | null = null;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  latest = useTownStore();
  return null;
}

/** Mounts, or remounts as a real reload (any prior root on this container is unmounted first). */
async function boot(): Promise<void> {
  if (root !== null) act(() => root!.unmount());
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root!.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Forces the ~300ms debounced write buffer to flush — same trick the other store suites use. */
function flush(): void {
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
}

const SEEDED_MONTH = "2026-08";
const DAY1 = "2026-08-02";
const DAY2 = "2026-08-03";
const CHUNK_KEY = `ait.v1.buildings.${SEEDED_MONTH}`;

/**
 * Writes `buildings` (all in `SEEDED_MONTH`) plus an index and core straight to
 * storage, pre-boot. `highestTierSeen` is pinned above every threshold on
 * purpose: a seeded 80-building town crosses several of them, and a tier
 * celebration would pay its own seed award and muddy the "the park pays
 * exactly once" assertions below.
 */
function seedTown(buildings: readonly Building[]): void {
  window.localStorage.setItem(
    "ait.v1.index",
    JSON.stringify({ schemaVersion: 1, layoutVersion: LAYOUT_VERSION, entryMonths: [], buildingMonths: [SEEDED_MONTH] }),
  );
  window.localStorage.setItem(
    "ait.v1.core",
    JSON.stringify({
      town: {
        townName: "우리 동네",
        streakDays: 0,
        longestStreakDays: 0,
        lastActOn: null,
        slotsUsedOn: "",
        slotsUsedToday: 0,
        highestTierSeen: BALANCE.tierThresholds.length,
        queue: [],
        noSpendDays: [],
        cumulativeSavingsKrw: 0,
        lastSettledPeriod: "2026-07", // nothing to settle — keeps this suite about the park alone
        moveHintSeen: true,
      },
      budget: { monthlyBudgetKrw: null, updatedAt: 0 },
      onboarded: true,
    }),
  );
  window.localStorage.setItem(CHUNK_KEY, JSON.stringify(buildings));
}

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(DAY1);
  setRandomOverride(() => 0); // pins rollFootprint to 1x1 and every anchor draw to the first legal cell
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root !== null) act(() => root!.unmount());
  root = null;
  container.remove();
  setTimeTravelDate(null);
  setRandomOverride(null);
});

describe("무지출 공원 이월 (full town)", () => {
  it("defers the park onto the queue instead of rejecting the claim", async () => {
    seedTown(saturatedTown());
    await boot();
    const before = latest!.buildingCount;
    expect(latest?.canClaimNoSpend).toBe(true);

    let claimed: { queued: boolean; queueLength: number } | null = null;
    act(() => {
      claimed = latest!.claimNoSpend();
    });

    expect(claimed).toEqual({ queued: true, queueLength: 1 }); // NOT null — the pre-change behaviour was an outright rejection
    expect(latest?.queueLength).toBe(1);
    expect(latest?.buildingCount).toBe(before); // nothing placed today
    // The day is 무지출 as of now, counted once, and the button is spent.
    expect(latest?.noSpendDays).toEqual([DAY1]);
    expect(latest?.streakDays).toBe(1);
    expect(latest?.canClaimNoSpend).toBe(false);
  });

  it("the next morning's drain builds it on a cell that satisfies the placement rule", async () => {
    // `townWithOneFreeCell` is `saturatedTown` minus one building, chosen so
    // exactly ONE legal 1x1 anchor exists and no 2x1/1x2/2x2 anchor does — so
    // "the park landed on a legal cell" is an exact, single-value assertion.
    const { buildings: withGap, gap } = townWithOneFreeCell();
    seedTown(saturatedTown());
    await boot();
    act(() => {
      latest!.claimNoSpend();
    });
    flush();

    // Room opens up overnight (a building is gone), then the app is reopened.
    act(() => root!.unmount());
    root = null;
    window.localStorage.setItem(CHUNK_KEY, JSON.stringify(withGap));
    setTimeTravelDate(DAY2);
    await boot();

    expect(latest?.queueLength).toBe(0); // drained
    const parks = latest!.buildings.filter((b) => b.source.kind === "nospend");
    expect(parks).toHaveLength(1);
    expect(parks[0].source).toEqual({ kind: "nospend", date: DAY1 }); // claim day survives the hop
    expect(parks[0].categoryId).toBe("park");
    expect(parks[0].builtOn).toBe(DAY2);
    expect(parks[0].plotIndex).toBe(gap);
    // ...and the rule itself, not just the cell id: the park obeys `canPlace`
    // exactly as a same-day placement would. A queued park must not get to
    // bypass the spacing rule by having been queued yesterday.
    const others = latest!.buildings.filter((b) => b.id !== parks[0].id);
    expect(canPlace(parks[0].plotIndex, 1, 1, cellOwners(others))).toBe(true);
  });

  it("the seed award and the 무지출 count each fire exactly once across queue -> drain", async () => {
    const { buildings: withGap } = townWithOneFreeCell();
    seedTown(saturatedTown());
    await boot();
    expect(latest?.economy.seeds).toBe(0);

    act(() => {
      latest!.claimNoSpend();
    });
    // Paid on the CLAIM, because the day is 무지출 whether or not a tile went up.
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.nospend);
    expect(latest?.economy.grantedEventKeys).toEqual([`seed:nospend:${DAY1}`]);
    flush();

    act(() => root!.unmount());
    root = null;
    window.localStorage.setItem(CHUNK_KEY, JSON.stringify(withGap));
    setTimeTravelDate(DAY2);
    await boot();

    // The drain places the park but pays nothing more: `seed:nospend:<claim
    // date>` is the same key (so it is a no-op), and the drain's `build` award
    // is entry-sourced only — a same-day claimed park never earned one either.
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.nospend);
    expect(latest?.economy.grantedEventKeys).toEqual([`seed:nospend:${DAY1}`]);
    expect(latest?.noSpendDays).toEqual([DAY1]); // counted once, not once per branch
    expect(latest?.buildings.filter((b) => b.source.kind === "nospend")).toHaveLength(1);
  });

  it("a town with room is unchanged: the park still goes up immediately", async () => {
    seedTown(saturatedTown().slice(0, 20)); // plenty of open cells
    await boot();
    const before = latest!.buildingCount;

    let claimed: { queued: boolean; queueLength: number } | null = null;
    act(() => {
      claimed = latest!.claimNoSpend();
    });

    expect(claimed).toEqual({ queued: false, queueLength: 0 });
    expect(latest?.queueLength).toBe(0); // nothing deferred
    expect(latest?.buildingCount).toBe(before + 1);
    expect(latest?.buildings.filter((b) => b.source.kind === "nospend")).toHaveLength(1);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - (BALANCE.noSpendDayCostsSlot ? 1 : 0));
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.nospend);
  });
});
