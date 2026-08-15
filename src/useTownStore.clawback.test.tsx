/**
 * ADDENDUM-12 §10 — store-level end-to-end tests for the clawback wiring.
 * The pure layer (`economy/awards.test.ts`, `historyActions.test.ts`) was
 * always correct; the original defect was that nothing in the store ever
 * CALLED it. These tests drive everything through the public store API
 * (`addEntry`/`updateEntry`/`deleteEntry`/`purchaseSku`/`fuseBuildings`),
 * never the pure functions directly, so they'd have caught that class of bug.
 *
 * Harness: bare `react-dom/client` + `act`, same shape as
 * `useTownStore.history.test.tsx` (polling `loading` — a fixed tick is not
 * enough, see that file's own note) merged with `useTownStore.fusion.test.tsx`'s
 * remount-on-the-same-container `mountAndWaitForBoot` and its `seedTown`
 * (pre-seeded localStorage) approach for the fusion tests. No React Testing
 * Library, no fixtures framework — this project doesn't use either.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
import type { EntryDraft } from "./entryActions";
import { setTimeTravelDate } from "./platform/clock";
import { setRandomOverride } from "./platform/random";
import { CELL_COUNT, cellFromIndex, isBuildable, LAYOUT_VERSION } from "./townLayout";
import type { Building, LedgerEntry } from "./types";
import { useTownStore } from "./useTownStore";

let container: HTMLDivElement;
let root: Root | null = null;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  latest = useTownStore();
  return null;
}

// A plain function, not inlined, so TS doesn't narrow `latest` to `never`
// against `Harness`'s reassignment (same note as `useTownStore.history.test.tsx`).
function stillLoading(): boolean {
  return latest === null || latest.loading;
}

/** Mounts, or remounts on the same container — a second call is a real reload (`useTownStore.fusion.test.tsx`'s shape). Polls `loading` instead of a fixed tick (`useTownStore.history.test.tsx`'s C5 finding). */
async function mountAndWaitForBoot(): Promise<void> {
  if (root !== null) act(() => root!.unmount());
  root = createRoot(container);
  latest = null;
  act(() => {
    root!.render(<Harness />);
  });
  for (let i = 0; i < 200 && stillLoading(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

/** Forces the debounced write buffer out to localStorage without unmounting. */
function flush(): void {
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
}

/** Reads `town` straight out of persisted storage — for fields not exposed on the hook's own return shape (`highestTierSeen`, `slotsUsedToday`). Call after `flush()`. */
function coreTown(): { highestTierSeen: number; slotsUsedToday: number } {
  return JSON.parse(window.localStorage.getItem("ait.v1.core")!).town;
}

/** `addEntry`, then hands back the id of the one new entry — the store never hands the id back directly. */
function addAndGetId(draft: EntryDraft, ym: string): string {
  const before = new Set((latest!.getMonthEntries(ym) ?? []).map((e) => e.id));
  act(() => {
    latest!.addEntry(draft);
  });
  return latest!.getMonthEntries(ym).find((e) => !before.has(e.id))!.id;
}

function deleteById(id: string, ym: string): void {
  act(() => {
    latest!.deleteEntry(id, ym);
  });
}

const TODAY = "2026-08-15";
const YM = TODAY.slice(0, 7);

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  setRandomOverride(() => 0); // deterministic plot pick — lowest free index
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

// ── §10.3 — exploit A: seed farming via repeated found-then-delete ──
describe("§10.3 exploit A — seed farming", () => {
  it("20x add/delete of a top-seed-rung entry nets EXACTLY zero seed change, zero seedDebt, and the building count returns to its start", async () => {
    await mountAndWaitForBoot();
    const highRung: EntryDraft = { type: "expense", amountKrw: 150_000, categoryId: "cafe", occurredOn: TODAY };

    // Warm-up OUTSIDE the measured window: the day's first act pays a
    // one-time streak seed (§6 — never clawed back), so settling it before
    // taking the baseline is what makes "exactly zero" a fair assertion
    // rather than one polluted by an award this delete is never supposed to
    // touch.
    const warmupId = addAndGetId(highRung, YM);
    deleteById(warmupId, YM);

    const seedsBefore = latest!.economy.seeds;
    const buildingCountBefore = latest!.buildingCount;
    expect(latest!.economy.seedDebt ?? 0).toBe(0);

    // dailyBuildSlots (10) runs out partway through this loop (1 already
    // spent by the warm-up, never refunded — D-10), so later iterations
    // queue (F14) instead of founding. Both branches must still net to zero
    // on delete — deliberately exercising both is a stronger test of the
    // exploit than pinning it to the founding path alone.
    for (let i = 0; i < 20; i++) {
      const id = addAndGetId(highRung, YM);
      deleteById(id, YM);
    }

    expect(latest!.economy.seeds).toBe(seedsBefore); // net gain must be EXACTLY 0, not "small"
    expect(latest!.economy.seedDebt ?? 0).toBe(0);
    expect(latest!.buildingCount).toBe(buildingCountBefore);
    expect(latest!.getMonthEntries(YM)).toHaveLength(0);
  });
});

// ── §10.4 — exploit B: edit-down must settle the seed rung, not just EXP ──
describe("§10.4 exploit B — edit-down", () => {
  it("150,000원 saved then edited down to 100원 lands on the SAME seed balance and building exp as saving 100원 from the start", async () => {
    // Town A: save high, then edit down.
    await mountAndWaitForBoot();
    const entryAId = addAndGetId({ type: "expense", amountKrw: 150_000, categoryId: "cafe", occurredOn: TODAY }, YM);
    act(() => {
      latest!.updateEntry(entryAId, YM, { amountKrw: 100 });
    });
    const seedsA = latest!.economy.seeds;
    const buildingA = latest!.buildings.find((b) => b.source.kind === "entry" && b.source.entryId === entryAId)!;
    const expA = buildingA.exp ?? 0;

    // Town B: fresh store. `mountAndWaitForBoot` unmounts the CURRENT root as
    // its first step, and unmount's effect cleanup flushes any still-pending
    // debounced write (`useTownStore.ts`'s pagehide/cleanup comment) straight
    // to the raw port — so clearing storage has to happen AFTER that flush,
    // never before it, or Town A's own pending write lands back in storage
    // right after the clear and Town B boots on top of Town A's state (a real
    // race this test tripped over: Town B started an ADDITIONAL 2nd building
    // with Town A's `grantedEventKeys` still attached).
    flush();
    act(() => root!.unmount());
    root = null;
    window.localStorage.clear();
    await mountAndWaitForBoot();
    const entryBId = addAndGetId({ type: "expense", amountKrw: 100, categoryId: "cafe", occurredOn: TODAY }, YM);
    const seedsB = latest!.economy.seeds;
    const buildingB = latest!.buildings.find((b) => b.source.kind === "entry" && b.source.entryId === entryBId)!;
    const expB = buildingB.exp ?? 0;

    // This is the assertion that proves `settleAward` is actually wired into `updateEntry`.
    expect(seedsA).toBe(seedsB);
    expect(expA).toBe(expB);
  });
});

// ── §10.5 — exploit C: spend-then-delete laundering ──
describe("§10.5 exploit C — spend-then-delete laundering", () => {
  it("spending the balance down then deleting every earning entry lands on seeds=0 and seedDebt=shortfall, keeps the purchased SKU, and pays a later award into the debt first", async () => {
    await mountAndWaitForBoot();
    // 15,000원 — `expGainFor` is a strict `amountKrw < maxExclusive` scan
    // (`selectors.ts`), so 15,000 lands on the [20_000, exp 3] row (rung 1)
    // while 20,000 itself would roll up to the NEXT row (not-less-than its
    // own boundary) — deliberately mid-band, not on the boundary.
    const midRung: EntryDraft = { type: "expense", amountKrw: 15_000, categoryId: "cafe", occurredOn: TODAY };
    // BALANCE.seedAwards entry[1]=4 + build[1]=3 per founding entry at this rung.
    const perEntry = BALANCE.seedAwards.entry[1] + BALANCE.seedAwards.build[1];

    const ids = [addAndGetId(midRung, YM), addAndGetId(midRung, YM), addAndGetId(midRung, YM)];
    const earned = latest!.economy.seeds;
    expect(earned).toBeGreaterThanOrEqual(3 * perEntry); // >= the 3 founding awards (a same-day streak top-up may add more, never less)

    let purchaseResult = "";
    act(() => {
      purchaseResult = latest!.purchaseSku("deco.test", 15);
    });
    expect(purchaseResult).toBe("ok");
    expect(latest!.economy.ownedSkus).toContain("deco.test");
    const afterPurchase = latest!.economy.seeds;
    expect(afterPurchase).toBe(earned - 15);

    for (const id of ids) deleteById(id, YM);

    const totalClawback = 3 * perEntry; // exactly the 3 entry+build awards — the streak top-up (if any) is untouched (§6)
    const expectedShortfall = Math.max(0, totalClawback - afterPurchase);
    expect(latest!.economy.seeds).toBe(0);
    expect(latest!.economy.seedDebt ?? 0).toBe(expectedShortfall);
    expect(latest!.economy.ownedSkus).toContain("deco.test"); // purchases are never revoked (§6)

    // A further earn pays the debt FIRST — seeds stay 0 until the debt clears.
    const debtBefore = latest!.economy.seedDebt ?? 0;
    addAndGetId(midRung, YM); // +perEntry credit
    const debtAfter = latest!.economy.seedDebt ?? 0;
    expect(debtAfter).toBe(Math.max(0, debtBefore - perEntry));
    if (debtBefore >= perEntry) expect(latest!.economy.seeds).toBe(0); // fully absorbed by the debt
  });
});

// ── §10.7/§10.8 — fusion entanglement ──
const MAXED_EXP = (BALANCE.maxLevel - 1) * BALANCE.expPerLevel; // Lv.5

const GROUND_CELLS: readonly number[] = Array.from({ length: CELL_COUNT }, (_, i) => i).filter((i) => {
  const { row, col } = cellFromIndex(i);
  return isBuildable(row, col);
});
const cell = (n: number): number => GROUND_CELLS[n];

function fusionBuilding(id: string, plotIndex: number, builtOn: string): Building {
  return {
    id,
    source: { kind: "entry", entryId: `e-${id}` },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex,
    builtOn,
    createdAt: 1,
    exp: MAXED_EXP,
  };
}

function fusionEntry(id: string, buildingId: string | null, occurredOn: string): LedgerEntry {
  return { id, type: "expense", amountKrw: 200_000, categoryId: "cafe", occurredOn, createdAt: 1, updatedAt: 1, buildingId, queued: false };
}

/** Writes the pre-boot state: index, core, and one building/entry chunk each (both months are the same here). */
function seedFusionTown(buildings: readonly Building[], entries: readonly LedgerEntry[]): void {
  const ym = buildings[0].builtOn.slice(0, 7);
  window.localStorage.setItem(
    "ait.v1.index",
    JSON.stringify({ schemaVersion: 1, layoutVersion: LAYOUT_VERSION, entryMonths: [ym], buildingMonths: [ym] }),
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
        highestTierSeen: 0,
        queue: [],
        noSpendDays: [],
        cumulativeSavingsKrw: 0,
        lastSettledPeriod: "2026-07", // everything already settled — boot mints no F16 monument
        moveHintSeen: true,
      },
      budget: { monthlyBudgetKrw: null, updatedAt: 0 },
      onboarded: true,
    }),
  );
  window.localStorage.setItem(`ait.v1.buildings.${ym}`, JSON.stringify(buildings));
  window.localStorage.setItem(`ait.v1.entries.${ym}`, JSON.stringify(entries));
}

describe("§10.7/§10.8 — fusion entanglement blocks delete/amount-edit, allows memo/category, moves nothing", () => {
  it("both the survivor's own founding entry AND a transplanted (remapped) entry are refused for delete/amount, allowed for memo/category, and the survivor's exp/fuse never move", async () => {
    seedFusionTown(
      [fusionBuilding("b1", cell(0), "2026-08-01"), fusionBuilding("b2", cell(1), "2026-08-01")],
      [fusionEntry("e-b1", "b1", TODAY), fusionEntry("e-b2", "b2", TODAY)],
    );
    await mountAndWaitForBoot();

    let fuseResult: unknown;
    act(() => {
      fuseResult = latest!.fuseBuildings("b1", "b2");
    });
    expect(fuseResult).not.toBeNull();

    const ownEntry = latest!.getMonthEntries(YM).find((e) => e.id === "e-b1")!;
    const transplantedEntry = latest!.getMonthEntries(YM).find((e) => e.id === "e-b2")!;
    expect(transplantedEntry.buildingId).toBe("b1"); // remapped onto the survivor (ADDENDUM-11 §5.4)

    for (const e of [ownEntry, transplantedEntry]) {
      expect(latest!.entryMutability(e, YM)).toEqual({ canEdit: true, canEditAmount: false, canDelete: false, reason: "fused" });
    }

    const survivorBefore = latest!.buildings.find((b) => b.id === "b1")!;
    expect(survivorBefore.fuse).toBe(1);

    // Refused: delete on both shapes of entanglement.
    deleteById(ownEntry.id, YM);
    deleteById(transplantedEntry.id, YM);
    expect(latest!.getMonthEntries(YM).map((e) => e.id).sort()).toEqual(["e-b1", "e-b2"]);

    // Refused: amount edit on both.
    act(() => {
      latest!.updateEntry(ownEntry.id, YM, { amountKrw: 1 });
    });
    act(() => {
      latest!.updateEntry(transplantedEntry.id, YM, { amountKrw: 1 });
    });
    let refreshed = latest!.getMonthEntries(YM);
    expect(refreshed.find((e) => e.id === "e-b1")!.amountKrw).toBe(200_000);
    expect(refreshed.find((e) => e.id === "e-b2")!.amountKrw).toBe(200_000);

    // Allowed: memo/category edits (don't touch economy/EXP).
    act(() => {
      latest!.updateEntry(ownEntry.id, YM, { memo: "fixed typo" });
    });
    act(() => {
      latest!.updateEntry(transplantedEntry.id, YM, { categoryId: "food" });
    });
    refreshed = latest!.getMonthEntries(YM);
    expect(refreshed.find((e) => e.id === "e-b1")!.memo).toBe("fixed typo");
    expect(refreshed.find((e) => e.id === "e-b2")!.categoryId).toBe("food");

    // Nothing moved on the survivor through any of the refused attempts or the allowed edits.
    const survivorAfter = latest!.buildings.find((b) => b.id === "b1")!;
    expect(survivorAfter.exp).toBe(survivorBefore.exp);
    expect(survivorAfter.fuse).toBe(survivorBefore.fuse);
  });
});

// ── §10.11 — not clawed back ──
describe("§10.11 — delete does not touch streak/slots/highestTierSeen", () => {
  it("streakDays/lastActOn/longestStreakDays, slotsUsedToday, and highestTierSeen are unchanged after a delete", async () => {
    await mountAndWaitForBoot();
    const id = addAndGetId({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY }, YM);
    flush();
    const townBefore = coreTown();
    const slotsBefore = latest!.slotsRemaining;
    const streakBefore = latest!.streakDays;
    const lastActBefore = latest!.lastActOn;
    const longestBefore = latest!.longestStreakDays;

    deleteById(id, YM);
    flush();
    const townAfter = coreTown();

    expect(latest!.slotsRemaining).toBe(slotsBefore); // not refunded (D-10)
    expect(latest!.streakDays).toBe(streakBefore);
    expect(latest!.lastActOn).toBe(lastActBefore);
    expect(latest!.longestStreakDays).toBe(longestBefore);
    expect(townAfter.slotsUsedToday).toBe(townBefore.slotsUsedToday);
    expect(townAfter.highestTierSeen).toBe(townBefore.highestTierSeen);
  });
});

// ── §10.12 — reload atomicity ──
describe("§10.12 — reload atomicity", () => {
  it("a reboot right after a delete matches the in-memory post-delete state exactly (seeds, seedDebt, buildings, entries)", async () => {
    await mountAndWaitForBoot();
    const toDeleteId = addAndGetId({ type: "expense", amountKrw: 150_000, categoryId: "cafe", occurredOn: TODAY }, YM);
    const survivorId = addAndGetId({ type: "expense", amountKrw: 8_000, categoryId: "food", occurredOn: TODAY }, YM);
    deleteById(toDeleteId, YM);

    const seedsAfterDelete = latest!.economy.seeds;
    const seedDebtAfterDelete = latest!.economy.seedDebt ?? 0;
    const buildingsAfterDelete = latest!.buildings.map((b) => ({ id: b.id, exp: b.exp ?? 0 })).sort((a, b) => a.id.localeCompare(b.id));
    const entriesAfterDelete = latest!.getMonthEntries(YM).map((e) => e.id).sort();
    expect(entriesAfterDelete).toEqual([survivorId]); // sanity — the survivor really is still there

    flush();
    await mountAndWaitForBoot();

    expect(latest!.economy.seeds).toBe(seedsAfterDelete);
    expect(latest!.economy.seedDebt ?? 0).toBe(seedDebtAfterDelete);
    expect(latest!.buildings.map((b) => ({ id: b.id, exp: b.exp ?? 0 })).sort((a, b) => a.id.localeCompare(b.id))).toEqual(buildingsAfterDelete);
    expect(latest!.getMonthEntries(YM).map((e) => e.id).sort()).toEqual(entriesAfterDelete);
  });
});

// ── §10.13 — pendingGrowChoice cleared on delete ──
describe("§10.13 — deleting an entry with a pendingGrowChoice clears the choice", () => {
  it("deleting the entry a deferred 새로짓기/키우기 choice names also clears town.pendingGrowChoice", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY }, undefined, true);
    });
    expect(latest!.pendingGrowChoice).not.toBeNull();
    const entry = latest!.getMonthEntries(YM)[0];
    expect(latest!.pendingGrowChoice!.entryId).toBe(entry.id);

    deleteById(entry.id, YM);

    expect(latest!.pendingGrowChoice).toBeNull();
    expect(latest!.getMonthEntries(YM)).toHaveLength(0);
  });
});
