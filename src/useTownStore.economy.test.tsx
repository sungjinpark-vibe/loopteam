/**
 * Wiring-level tests for ADDENDUM-05 (F-ECON / F-BGM) — the seed earn loop
 * (`grantSeeds`, wired into `addEntry`/`claimNoSpend`), the shop actions
 * (`purchaseSku`/`applyTownSku`/`applyBuildingSku`), `npcCount`, and
 * `bgmMuted`. Same bare `react-dom/client` + `act` harness `useTownStore.test.tsx`
 * already uses — no React Testing Library in this project.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
import { NPC_MAX_VISIBLE } from "./economy/types";
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

describe("seed earn loop", () => {
  it("a build grants BALANCE.seedAwards.build seeds exactly once", async () => {
    await mountAndWaitForBoot();
    expect(latest?.economy.seeds).toBe(0);

    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(coffee);
    });
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.build);
    expect(latest?.economy.grantedEventKeys).toEqual([`seed:build:${latest!.buildings[0].id}`]);
  });

  it("a no-spend claim grants BALANCE.seedAwards.nospend seeds", async () => {
    await mountAndWaitForBoot();
    expect(latest?.canClaimNoSpend).toBe(true);

    act(() => {
      latest!.claimNoSpend();
    });
    expect(latest?.economy.seeds).toBe(BALANCE.seedAwards.nospend);
    expect(latest?.economy.grantedEventKeys).toEqual([`seed:nospend:${TODAY}`]);
  });

  it("grantSeeds is idempotent — calling the same event twice pays once", async () => {
    await mountAndWaitForBoot();
    act(() => {
      const paid = latest!.grantSeeds({ kind: "tier", tier: 1 });
      expect(paid).toBe(true);
    });
    const afterFirst = latest?.economy.seeds;
    act(() => {
      const paidAgain = latest!.grantSeeds({ kind: "tier", tier: 1 });
      expect(paidAgain).toBe(false);
    });
    expect(latest?.economy.seeds).toBe(afterFirst);
  });

  it("seeds survive a reload", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.claimNoSpend();
    });
    const seedsBefore = latest!.economy.seeds;

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.economy.seeds).toBe(seedsBefore);
  });
});

describe("shop actions", () => {
  async function withSeeds(n: number): Promise<void> {
    await mountAndWaitForBoot();
    act(() => {
      latest!.grantSeeds({ kind: "tier", tier: n }); // BALANCE.seedAwards.tier per call, tier value only keys the eventKey
    });
  }

  it("purchaseSku succeeds, deducts seeds, and never goes negative", async () => {
    await withSeeds(1);
    const before = latest!.economy.seeds;
    expect(before).toBeGreaterThanOrEqual(BALANCE.seedAwards.tier);

    let result;
    act(() => {
      result = latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    expect(result).toBe("ok");
    expect(latest?.economy.seeds).toBe(before - BALANCE.seedAwards.tier);
    expect(latest?.economy.ownedSkus).toEqual(["deco.town.sakura.v1"]);
  });

  it("purchaseSku reports insufficient without touching state", async () => {
    await mountAndWaitForBoot();
    let result;
    act(() => {
      result = latest!.purchaseSku("deco.town.sakura.v1", 999_999);
    });
    expect(result).toBe("insufficient");
    expect(latest?.economy.seeds).toBe(0);
    expect(latest?.economy.ownedSkus).toEqual([]);
  });

  it("purchaseSku reports alreadyOwned on a second purchase of the same sku", async () => {
    await withSeeds(1);
    act(() => {
      latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    let result;
    act(() => {
      result = latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    expect(result).toBe("alreadyOwned");
  });

  it("applyTownSku is a no-op for an unowned sku, applies once owned, clears with null", async () => {
    await withSeeds(1);
    act(() => {
      latest!.applyTownSku("deco.town.sakura.v1"); // not owned yet — no-op
    });
    expect(latest?.economy.appliedTownSku).toBeNull();

    act(() => {
      latest!.purchaseSku("deco.town.sakura.v1", BALANCE.seedAwards.tier);
    });
    act(() => {
      latest!.applyTownSku("deco.town.sakura.v1");
    });
    expect(latest?.economy.appliedTownSku).toBe("deco.town.sakura.v1");

    act(() => {
      latest!.applyTownSku(null);
    });
    expect(latest?.economy.appliedTownSku).toBeNull();
  });

  it("applyBuildingSku sets/clears per building id, guarded by ownership", async () => {
    await withSeeds(1);
    act(() => {
      latest!.purchaseSku("deco.building.flowerbed.v1", BALANCE.seedAwards.tier);
    });
    act(() => {
      latest!.applyBuildingSku("b1", "deco.building.flowerbed.v1");
    });
    expect(latest?.economy.appliedByBuildingId).toEqual({ b1: "deco.building.flowerbed.v1" });

    act(() => {
      latest!.applyBuildingSku("b1", null);
    });
    expect(latest?.economy.appliedByBuildingId).toEqual({});

    act(() => {
      latest!.applyBuildingSku("b2", "deco.building.unowned.v1"); // never purchased — no-op
    });
    expect(latest?.economy.appliedByBuildingId).toEqual({});
  });
});

describe("npcCount", () => {
  it("is 1 (base) with no buildings, and grows by 1 per building", async () => {
    await mountAndWaitForBoot();
    expect(latest?.npcCount).toBe(1);

    const coffee: EntryDraft = { type: "expense", amountKrw: 4_500, categoryId: "cafe", occurredOn: TODAY };
    act(() => {
      latest!.addEntry(coffee);
    });
    expect(latest?.npcCount).toBe(2);
  });

  it("NPC_MAX_VISIBLE is exported at 12, the render-perf ceiling npcCount is capped at", () => {
    expect(NPC_MAX_VISIBLE).toBe(12);
  });
});

describe("bgmMuted", () => {
  it("defaults to false (F-BGM: default ON) and toggling survives a reload", async () => {
    await mountAndWaitForBoot();
    expect(latest?.bgmMuted).toBe(false);

    act(() => {
      latest!.setBgmMuted(true);
    });
    expect(latest?.bgmMuted).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      root.unmount();
    });
    await mountAndWaitForBoot();
    expect(latest?.bgmMuted).toBe(true);
  });
});
