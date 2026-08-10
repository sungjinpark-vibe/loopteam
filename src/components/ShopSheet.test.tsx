/**
 * ShopSheet (S8) + ShopFab component tests. Mirrors `SettingsSheet.test.tsx`'s
 * mount harness (bare `mountComponent` + `ThemeProvider`, `BottomSheet`
 * portals into `document.body`, jsdom `ResizeObserver`/`matchMedia`
 * workarounds already established there).
 *
 * `purchaseSku` is a plain mock here, not the real `useTownStore` — the
 * store's own invariants (deduction is atomic, never goes negative, a
 * non-repeatable sku can't be bought twice, `NPC_SLOT_SKU` refuses at the
 * cap) are the foundation's to test (`useTownStore.economy.test.tsx`). This
 * file only asserts ShopSheet reacts correctly to each of `purchaseSku`'s
 * four possible results — including never even ATTEMPTING a call once a
 * button is disabled, which is how the UI keeps a purchase from going
 * negative in the first place.
 */
import { act } from "react";
import { ThemeProvider } from "@toss/tds-mobile";
import { afterEach, describe, expect, it } from "vitest";
import { moodContentFor } from "../content.placeholder";
import { defaultEconomyState, seeds as seedCount, type EconomyState } from "../economy/types";
import { formatSeeds } from "../economy/format";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import type { Building } from "../types";
import type { PurchaseSkuResult } from "../useTownStore";
import { ShopFab, ShopSheet, type ShopSheetProps } from "./ShopSheet";

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver ??=
  NoopResizeObserver as unknown as typeof ResizeObserver;

const nativeQuerySelectorAll = Document.prototype.querySelectorAll;
Document.prototype.querySelectorAll = function (this: Document, selector: string) {
  try {
    return nativeQuerySelectorAll.call(this, selector);
  } catch {
    return nativeQuerySelectorAll.call(this, "[data-shop-sheet-test-no-match]");
  }
} as typeof Document.prototype.querySelectorAll;

let mounted: MountedComponent | null = null;
afterEach(() => {
  try {
    mounted?.unmount();
  } finally {
    mounted = null;
  }
});

function makeBuilding(id: string, categoryId: Building["categoryId"]): Building {
  return {
    id,
    source: { kind: "entry", entryId: `${id}-entry` },
    categoryId,
    variantIndex: 0,
    plotIndex: 0,
    builtOn: "2026-08-01",
    createdAt: 0,
  };
}

function makeProps(overrides: Partial<ShopSheetProps> = {}, purchaseResult: PurchaseSkuResult = "ok") {
  const purchaseCalls: Array<{ sku: string; price: number }> = [];
  const townCalls: Array<string | null> = [];
  const buildingCalls: Array<{ buildingId: string; sku: string | null }> = [];
  const props: ShopSheetProps = {
    open: true,
    onClose: () => {},
    economy: defaultEconomyState(),
    buildings: [makeBuilding("b1", "food")],
    npcCount: 1,
    purchaseSku: (sku, price) => {
      purchaseCalls.push({ sku, price });
      return purchaseResult;
    },
    applyTownSku: (sku) => townCalls.push(sku),
    applyBuildingSku: (buildingId, sku) => buildingCalls.push({ buildingId, sku }),
    formatSeeds,
    ...overrides,
  };
  return { props, purchaseCalls, townCalls, buildingCalls };
}

function render(props: ShopSheetProps): void {
  const element = (
    <ThemeProvider>
      <ShopSheet {...props} />
    </ThemeProvider>
  );
  if (mounted === null) mounted = mountComponent(element);
  else act(() => mounted!.root.render(element));
}

function findButton(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
}

describe("ShopSheet", () => {
  it("shows the balance in the header — one of the two allowed surfaces", () => {
    const { props } = makeProps({ economy: { ...defaultEconomyState(), seeds: seedCount(420) } });
    render(props);
    expect(document.body.textContent).toContain("420개");
  });

  it("renders all three sections", () => {
    const { props } = makeProps();
    render(props);
    expect(document.body.textContent).toContain("건물 꾸미기");
    expect(document.body.textContent).toContain("마을 꾸미기");
    expect(document.body.textContent).toContain("NPC");
  });

  it("an affordable item's buy button fires purchaseSku with the exact sku id and price", () => {
    const { props, purchaseCalls } = makeProps({ economy: { ...defaultEconomyState(), seeds: seedCount(1200) } });
    render(props);
    const buy = findButton("150개"); // deco.building.flowerbed.v1
    expect(buy).toBeDefined();
    act(() => buy!.click());
    expect(purchaseCalls).toEqual([{ sku: "deco.building.flowerbed.v1", price: 150 }]);
  });

  it("an unaffordable item's buy button is disabled and never calls purchaseSku (can't be pushed negative)", () => {
    const { props, purchaseCalls } = makeProps({ economy: defaultEconomyState() }); // 0 seeds
    render(props);
    const buy = findButton("150개")!;
    expect(buy.disabled).toBe(true);
    act(() => buy.click());
    expect(purchaseCalls).toEqual([]);
  });

  it("once owned (props reflect the purchase), the row shows 보유중 instead of a buy control", () => {
    const { props } = makeProps({ economy: { ...defaultEconomyState(), ownedSkus: ["deco.building.flowerbed.v1"] } });
    render(props);
    expect(document.body.textContent).toContain("보유중");
    expect(findButton("150개")).toBeUndefined();
  });

  it("a stale-props repeat purchase attempt is refused and surfaced, not silently double-charged", () => {
    // Simulates the store returning "alreadyOwned" for a race where props
    // haven't caught up yet — proves the UI surfaces the refusal rather than
    // assuming success.
    const { props, purchaseCalls } = makeProps({ economy: { ...defaultEconomyState(), seeds: seedCount(1200) } }, "alreadyOwned");
    render(props);
    act(() => findButton("150개")!.click());
    expect(purchaseCalls).toHaveLength(1);
    expect(document.body.textContent).toContain("이미 보유하고 있어요");
  });

  it("NPC slot at the cap shows the cap message pre-emptively, no buy control offered", () => {
    const { props } = makeProps({ npcCount: 12 });
    render(props);
    expect(document.body.textContent).toContain("NPC를 더 놓을 수 없어요");
    expect(findButton("350개")).toBeUndefined();
  });

  it("'maxed' from a stale-props tap shows the cap message, never the insufficient-funds message", () => {
    const { props, purchaseCalls } = makeProps({ economy: { ...defaultEconomyState(), seeds: seedCount(1200) }, npcCount: 11 }, "maxed");
    render(props);
    const buy = findButton("350개")!; // npc.slot.v1, not yet visibly at cap per stale npcCount=11
    act(() => buy.click());
    expect(purchaseCalls).toEqual([{ sku: "npc.slot.v1", price: 350 }]);
    expect(document.body.textContent).toContain("NPC를 더 놓을 수 없어요");
    expect(document.body.textContent).not.toContain("씨앗이 부족해요");
  });

  it("applying an owned town skin calls applyTownSku with the sku id, and unapplying with null", () => {
    const economy: EconomyState = { ...defaultEconomyState(), ownedSkus: ["deco.town.cherryBlossom.v1"] };
    const { props, townCalls } = makeProps({ economy });
    render(props);
    act(() => findButton("마을에 적용")!.click());
    expect(townCalls).toEqual(["deco.town.cherryBlossom.v1"]);

    const { props: props2, townCalls: townCalls2 } = makeProps({
      economy: { ...economy, appliedTownSku: "deco.town.cherryBlossom.v1" },
    });
    render(props2);
    act(() => findButton("해제하기")!.click());
    expect(townCalls2).toEqual([null]);
  });

  it("picking a building for an owned building deco calls applyBuildingSku with the sku id", () => {
    const economy: EconomyState = { ...defaultEconomyState(), ownedSkus: ["deco.building.flowerbed.v1"] };
    const { props, buildingCalls } = makeProps({ economy, buildings: [makeBuilding("b1", "food")] });
    render(props);
    act(() => findButton("적용할 건물 선택")!.click());
    act(() => findButton("식비")!.click());
    expect(buildingCalls).toEqual([{ buildingId: "b1", sku: "deco.building.flowerbed.v1" }]);
  });

  it("picking a building that already carries this sku clears it (applyBuildingSku(id, null))", () => {
    // Fresh mount with props already reflecting the store's applied state —
    // toggling off is a separate scenario from toggling on above, each
    // exercised against its own component instance rather than reusing one
    // (the picker's own open/closed state is local and would otherwise leak
    // between the two steps).
    const economy: EconomyState = {
      ...defaultEconomyState(),
      ownedSkus: ["deco.building.flowerbed.v1"],
      appliedByBuildingId: { b1: "deco.building.flowerbed.v1" },
    };
    const { props, buildingCalls } = makeProps({ economy, buildings: [makeBuilding("b1", "food")] });
    render(props);
    act(() => findButton("적용할 건물 선택")!.click());
    act(() => findButton("식비")!.click());
    expect(buildingCalls).toEqual([{ buildingId: "b1", sku: null }]);
  });

  it("excludes the monument and park from the building picker (F16/F15 must never change)", () => {
    const economy: EconomyState = { ...defaultEconomyState(), ownedSkus: ["deco.building.flowerbed.v1"] };
    const monument: Building = { ...makeBuilding("mon", null), source: { kind: "monument", period: "2026-07" } };
    const park = makeBuilding("park1", "park");
    const { props } = makeProps({ economy, buildings: [monument, park, makeBuilding("b1", "food")] });
    render(props);
    act(() => findButton("적용할 건물 선택")!.click());
    expect(document.body.textContent).toContain("식비");
    // only the one eligible building's picker row should be present
    expect(document.body.querySelectorAll(".shop-building-picker-item")).toHaveLength(1);
  });

  it("rendering the shop with every sku owned leaves moodContentFor's skyClass a pure function of tier (R-12: money never touches the sky)", () => {
    const before = [0, 1, 2, -1].map((t) => moodContentFor(t).skyClass);
    const economy: EconomyState = {
      ...defaultEconomyState(),
      seeds: seedCount(0),
      ownedSkus: [
        "deco.building.flowerbed.v1",
        "deco.building.mailbox.v1",
        "deco.building.signboard.v1",
        "deco.building.balloon.v1",
        "deco.building.streetlamp.v1",
        "deco.building.cat.v1",
        "deco.town.cherryBlossom.v1",
        "deco.town.snowyVillage.v1",
        "deco.town.nightMarket.v1",
        "npc.species.hamster.v1",
        "npc.species.fox.v1",
        "npc.species.panda.v1",
        "npc.species.penguin.v1",
        "npc.species.raccoon.v1",
      ],
      appliedTownSku: "deco.town.cherryBlossom.v1",
      purchasedNpcSlots: 5,
    };
    const { props } = makeProps({ economy, npcCount: 12 });
    render(props);
    const after = [0, 1, 2, -1].map((t) => moodContentFor(t).skyClass);
    expect(after).toEqual(before);
  });
});

describe("ShopFab", () => {
  it("calls onClick when tapped", () => {
    let clicks = 0;
    mounted = mountComponent(
      <ThemeProvider>
        <ShopFab onClick={() => clicks++} economy={defaultEconomyState()} npcCount={1} />
      </ThemeProvider>,
    );
    act(() => document.body.querySelector<HTMLButtonElement>(".shop-fab")!.click());
    expect(clicks).toBe(1);
  });

  it("shows a non-numeric dot only when something unowned is affordable — never a count badge", () => {
    mounted = mountComponent(
      <ThemeProvider>
        <ShopFab onClick={() => {}} economy={{ ...defaultEconomyState(), seeds: seedCount(0) }} npcCount={1} />
      </ThemeProvider>,
    );
    expect(document.body.querySelector(".shop-fab-dot")).toBeNull();

    act(() => {
      mounted!.root.render(
        <ThemeProvider>
          <ShopFab onClick={() => {}} economy={{ ...defaultEconomyState(), seeds: seedCount(1200) }} npcCount={1} />
        </ThemeProvider>,
      );
    });
    const dot = document.body.querySelector(".shop-fab-dot");
    expect(dot).not.toBeNull();
    expect(dot!.textContent).toBe(""); // non-numeric — no count is ever rendered into it
  });
});
