/**
 * ADDENDUM-12 — wiring tests for F9's seed clawback (§3), current-month-only
 * scope (§4, the cross-month half is covered in `useTownStore.history.test.tsx`),
 * fusion entanglement (§5), write order (§8), and the store contract (§9),
 * through the REAL `useTownStore` hook. Same bare `react-dom/client` + `act`
 * harness as `useTownStore.history.test.tsx` (no React Testing Library here).
 *
 * Covers §10 conditions 10.1-10.8 and 10.11-10.13. 10.9/10.10 (past-month and
 * out-of-month refusal) live in `useTownStore.history.test.tsx` alongside the
 * pre-existing F9 tests they directly supersede. 10.14 (no regression) is the
 * whole suite passing; 10.15 (frozen lines) isn't a test — nothing here
 * touches `balance.approved.ts`, the EXP curve, or map/building art.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
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

function stillLoading(): boolean {
  return latest === null || latest.loading;
}

// Same boot-poll as `useTownStore.history.test.tsx` — a fixed tick count
// isn't reliably enough past the boot effect's own `yieldToMainThread` hop.
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
const DAY_ONE_STREAK_SEEDS = 2; // min(2 * streakDays, 20) at streakDays=1 — never revoked (§6)

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

// §10.1/§10.2 — one representative amount per `expAmountTiers` rung (0..4):
// below 5,000 / 5,000-20,000 / 20,000-50,000 / 50,000-150,000 / 150,000+.
const RUNG_AMOUNTS: readonly [rung: number, amountKrw: number][] = [
  [0, 4_500],
  [1, 15_000],
  [2, 40_000],
  [3, 100_000],
  [4, 500_000],
];

describe("deleteEntry — ADDENDUM-12 §3.1/§10.1/§10.2 seed clawback", () => {
  it.each(RUNG_AMOUNTS)("rung %i (%i원): revokes exactly the entry+build seeds it granted, and removes the building", async (_rung, amountKrw) => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw, categoryId: "cafe", occurredOn: TODAY });
    });
    expect(latest!.buildingCount).toBe(1);
    expect(latest!.economy.seeds).toBeGreaterThan(DAY_ONE_STREAK_SEEDS);
    const entry = latest!.getMonthEntries(ym)[0];

    act(() => {
      latest!.deleteEntry(entry.id, ym);
    });

    expect(latest!.buildingCount).toBe(0); // §10.2 — the founded building is gone too
    // Only the streak award (never revoked, §6) survives — entry+build are fully clawed back.
    expect(latest!.economy.seeds).toBe(DAY_ONE_STREAK_SEEDS);
    expect(latest!.economy.grantedEventKeys.some((k) => k.startsWith("seed:entry:") || k.startsWith("seed:build:"))).toBe(false);
  });
});

describe("deleteEntry — ADDENDUM-12 §2.1/§10.3 exploit A (farm by deleting)", () => {
  it("record -> collect -> delete looped 20x nets EXACTLY 0 seed change", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    const draft = { type: "expense" as const, amountKrw: 150_000, categoryId: "food" as const, occurredOn: TODAY };

    // Burn the day's one-time streak grant first (§6 — correctly NOT
    // revoked, so it would otherwise skew this loop's own net-zero measurement).
    act(() => {
      latest!.addEntry(draft);
    });
    act(() => {
      latest!.deleteEntry(latest!.getMonthEntries(ym)[0].id, ym);
    });
    const baseline = latest!.economy.seeds;

    for (let i = 0; i < 20; i++) {
      act(() => {
        latest!.addEntry(draft);
      });
      act(() => {
        latest!.deleteEntry(latest!.getMonthEntries(ym)[0].id, ym);
      });
    }

    expect(latest!.economy.seeds).toBe(baseline); // exactly 0 net change over the 20 loops
    expect(latest!.economy.seedDebt ?? 0).toBe(0); // the balance always covered its own immediate clawback
    expect(latest!.getMonthEntries(ym)).toHaveLength(0);
    expect(latest!.buildingCount).toBe(0);
  });
});

describe("updateEntry — ADDENDUM-12 §3.2/§10.4 exploit B (farm by editing down)", () => {
  it("150,000 edited down to 100 lands on exactly what recording 100 from scratch pays", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 150_000, categoryId: "food", occurredOn: TODAY });
    });
    const entry = latest!.getMonthEntries(ym)[0];
    act(() => {
      latest!.updateEntry(entry.id, ym, { amountKrw: 100 });
    });
    const editedSeeds = latest!.economy.seeds;

    // Fresh town, same day, log 100 from scratch.
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    window.localStorage.clear();
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 100, categoryId: "food", occurredOn: TODAY });
    });

    expect(editedSeeds).toBe(latest!.economy.seeds);
  });
});

describe("updateEntry — ADDENDUM-12 §10.6 upward settle bypasses idempotency", () => {
  it("an amount INCREASE pays the additional seeds even though the key is already granted", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 100, categoryId: "food", occurredOn: TODAY }); // rung 0
    });
    const entry = latest!.getMonthEntries(ym)[0];
    const seedsBefore = latest!.economy.seeds;
    const rung0 = BALANCE.seedAwards.entry[0] + BALANCE.seedAwards.build[0];
    const rung4 = BALANCE.seedAwards.entry[4] + BALANCE.seedAwards.build[4];
    expect(seedsBefore).toBe(rung0 + DAY_ONE_STREAK_SEEDS);

    act(() => {
      latest!.updateEntry(entry.id, ym, { amountKrw: 500_000 }); // rung 4
    });

    expect(latest!.economy.seeds).toBe(seedsBefore + (rung4 - rung0));
  });
});

describe("delete/updateEntry — ADDENDUM-12 §3.3/§10.5 exploit C (spend then delete)", () => {
  it("spending on a SKU then deleting the entry leaves seedDebt for the shortfall, keeps ownedSkus, and the next award pays the debt down first", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 150_000, categoryId: "food", occurredOn: TODAY }); // rung 4: entry 10 + build 8 + day-1 streak 2 = 20
    });
    const entry = latest!.getMonthEntries(ym)[0];
    // Top up with non-entry-sourced seeds (tier crossings + a no-spend grant)
    // so there's enough to afford the shop — isolates the clawback math from
    // how the balance got there, same as `useTownStore.economy.test.tsx`'s
    // own `withSeeds` helper.
    act(() => {
      for (let i = 0; i < 5; i++) latest!.grantSeeds({ kind: "tier", tier: 900 + i });
      latest!.grantSeeds({ kind: "nospend", date: "2099-01-01" });
    });
    expect(latest!.economy.seeds).toBeGreaterThanOrEqual(150);

    let purchaseResult: string | undefined;
    act(() => {
      purchaseResult = latest!.purchaseSku("deco.building.flowerbed.v1", 150);
    });
    expect(purchaseResult).toBe("ok");
    const seedsAfterPurchase = latest!.economy.seeds;
    const expectedRevoke = BALANCE.seedAwards.entry[4] + BALANCE.seedAwards.build[4]; // 150,000원 = top rung, founded a building
    expect(seedsAfterPurchase).toBeLessThan(expectedRevoke); // deliberately not enough to cover the clawback

    act(() => {
      latest!.deleteEntry(entry.id, ym);
    });

    expect(latest!.economy.seeds).toBe(0); // floored, never negative
    expect(latest!.economy.seedDebt).toBe(expectedRevoke - seedsAfterPurchase);
    expect(latest!.economy.ownedSkus).toEqual(["deco.building.flowerbed.v1"]); // never revoked (§6)

    const debtBefore = latest!.economy.seedDebt!;
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 150_000, categoryId: "food", occurredOn: TODAY });
    });
    // The next award pays the debt down first (§3.3) — nothing lands in `seeds` while debt remains outstanding.
    const nextGrant = BALANCE.seedAwards.entry[4] + BALANCE.seedAwards.build[4]; // no new streak — same day
    expect(latest!.economy.seedDebt).toBe(Math.max(0, debtBefore - nextGrant));
    expect(latest!.economy.seeds).toBe(Math.max(0, nextGrant - debtBefore));
  });
});

describe("fusion entanglement — ADDENDUM-12 §5/§10.7/§10.8", () => {
  async function foundTwoMaxedSameCategoryBuildings(): Promise<{ survivorId: string; consumedId: string; foundingEntries: [string, string] }> {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 150_000, categoryId: "cafe", occurredOn: TODAY }); // exp 12 = maxed (Lv.5) at founding
    });
    const survivorId = latest!.buildings[0].id;
    const firstEntryId = latest!.getMonthEntries(TODAY.slice(0, 7))[0].id;
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 150_000, categoryId: "cafe", occurredOn: TODAY });
    });
    const consumedId = latest!.buildings.find((b) => b.id !== survivorId)!.id;
    const secondEntryId = latest!.getMonthEntries(TODAY.slice(0, 7))[1].id;
    return { survivorId, consumedId, foundingEntries: [firstEntryId, secondEntryId] };
  }

  it("§10.7 — blocks delete/amount-edit on the fused survivor's OWN founding entry; memo/category edits still work", async () => {
    const { survivorId, consumedId, foundingEntries } = await foundTwoMaxedSameCategoryBuildings();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.fuseBuildings(survivorId, consumedId);
    });
    expect(latest!.buildings.map((b) => b.id)).toEqual([survivorId]);

    const survivorFoundingEntry = latest!.getMonthEntries(ym).find((e) => e.id === foundingEntries[0])!;
    expect(latest!.entryMutability(survivorFoundingEntry, ym)).toEqual({ canEdit: true, canEditAmount: false, canDelete: false, reason: "fused" });

    act(() => {
      latest!.deleteEntry(survivorFoundingEntry.id, ym);
      latest!.updateEntry(survivorFoundingEntry.id, ym, { amountKrw: 1 });
    });
    expect(latest!.buildingCount).toBe(1); // still fused, nothing destroyed
    expect(latest!.getMonthEntries(ym).find((e) => e.id === survivorFoundingEntry.id)?.amountKrw).toBe(150_000);

    act(() => {
      latest!.updateEntry(survivorFoundingEntry.id, ym, { memo: "typo fix ok" });
    });
    expect(latest!.getMonthEntries(ym).find((e) => e.id === survivorFoundingEntry.id)?.memo).toBe("typo fix ok");
  });

  it("§10.8 — blocks delete/amount-edit on an entry REMAPPED onto the fused survivor; the survivor's EXP never moves", async () => {
    const { survivorId, consumedId, foundingEntries } = await foundTwoMaxedSameCategoryBuildings();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.fuseBuildings(survivorId, consumedId);
    });

    const remappedEntry = latest!.getMonthEntries(ym).find((e) => e.id === foundingEntries[1])!;
    expect(remappedEntry.buildingId).toBe(survivorId); // ADDENDUM-11 §5.4 remap
    expect(latest!.entryMutability(remappedEntry, ym).canDelete).toBe(false);
    expect(latest!.entryMutability(remappedEntry, ym).canEditAmount).toBe(false);
    expect(latest!.entryMutability(remappedEntry, ym).reason).toBe("fused");

    const survivorExpBefore = latest!.buildings.find((b) => b.id === survivorId)!.exp;
    act(() => {
      latest!.deleteEntry(remappedEntry.id, ym);
      latest!.updateEntry(remappedEntry.id, ym, { amountKrw: 1 });
    });
    expect(latest!.buildings.find((b) => b.id === survivorId)!.exp).toBe(survivorExpBefore);
    expect(latest!.getMonthEntries(ym).some((e) => e.id === remappedEntry.id)).toBe(true); // never deleted
  });
});

describe("deleteEntry — ADDENDUM-12 §6/§10.11 (streak/slots untouched)", () => {
  it("deleting an entry never refunds slotsUsedToday or reduces streakDays", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 150_000, categoryId: "cafe", occurredOn: TODAY });
    });
    const streakBefore = latest!.streakDays;
    const slotsBefore = latest!.slotsRemaining;
    const entry = latest!.getMonthEntries(ym)[0];

    act(() => {
      latest!.deleteEntry(entry.id, ym);
    });

    expect(latest!.streakDays).toBe(streakBefore);
    expect(latest!.slotsRemaining).toBe(slotsBefore); // D-10 — not refunded
  });
});

describe("deleteEntry — ADDENDUM-12 §3.1/§10.13 (pendingGrowChoice)", () => {
  it("clears a pendingGrowChoice that names the deleted entry", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY }, undefined, true); // deferGrowChoice
    });
    const entry = latest!.getMonthEntries(ym)[0];
    expect(latest!.pendingGrowChoice?.entryId).toBe(entry.id);

    act(() => {
      latest!.deleteEntry(entry.id, ym);
    });

    expect(latest!.pendingGrowChoice).toBeNull();
  });
});

describe("deleteEntry — ADDENDUM-12 §8/§10.12 (write order / reload atomicity)", () => {
  it("seeds, seedDebt, buildings, and entries after a delete match exactly after a reboot", async () => {
    await mountAndWaitForBoot();
    const ym = TODAY.slice(0, 7);
    act(() => {
      latest!.addEntry({ type: "expense", amountKrw: 150_000, categoryId: "cafe", occurredOn: TODAY });
      latest!.addEntry({ type: "expense", amountKrw: 40_000, categoryId: "food", occurredOn: TODAY });
    });
    const [e1] = latest!.getMonthEntries(ym);

    act(() => {
      latest!.deleteEntry(e1.id, ym);
    });
    const seedsBefore = latest!.economy.seeds;
    const seedDebtBefore = latest!.economy.seedDebt ?? 0;
    const buildingCountBefore = latest!.buildingCount;
    const entryCountBefore = latest!.getMonthEntries(ym).length;

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();

    expect(latest!.economy.seeds).toBe(seedsBefore);
    expect(latest!.economy.seedDebt ?? 0).toBe(seedDebtBefore);
    expect(latest!.buildingCount).toBe(buildingCountBefore);
    latest!.ensureMonthLoaded(ym);
    expect(latest!.getMonthEntries(ym)).toHaveLength(entryCountBefore);
  });
});
