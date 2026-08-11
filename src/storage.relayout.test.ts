/**
 * ADDENDUM-01 §3.6/§5.4 — the LAYOUT_VERSION relayout notice. Kept in a NEW
 * file (not appended to storage.test.ts) so the addendum's central
 * compatibility claim — every existing T002-T005 test passes unmodified —
 * stays literally true: nothing in storage.test.ts changes.
 */
import { describe, expect, it } from "vitest";
import { createChunkedStorage, defaultTownState } from "./storage";
import { LAYOUT_VERSION } from "./townLayout";
import type { StoragePort } from "./platform/storage";
import type { Building, BudgetSetting, TownState } from "./types";

function makeFakePort(): StoragePort {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

const town: TownState = { ...defaultTownState() };
const budget: BudgetSetting = { monthlyBudgetKrw: null, updatedAt: 0 };
const building: Building = {
  id: "b1",
  source: { kind: "entry", entryId: "e1" },
  categoryId: "cafe",
  variantIndex: 0,
  plotIndex: 0,
  builtOn: "2026-08-02",
  createdAt: 1,
};

describe("LAYOUT_VERSION relayout (ADDENDUM-01 §3.6)", () => {
  it("fires the relayout notice for a pre-existing town (index with no layoutVersion, buildings present), then stops firing", async () => {
    const port = makeFakePort();
    // Seed storage exactly as a pre-addendum boot would have left it: a real
    // index with no `layoutVersion` key at all (an old index predates the
    // field), a core, and a buildings chunk.
    port.set("ait.v1.index", JSON.stringify({ schemaVersion: 1, entryMonths: [], buildingMonths: ["2026-08"] }));
    port.set("ait.v1.core", JSON.stringify({ town, budget, onboarded: true }));
    port.set("ait.v1.buildings.2026-08", JSON.stringify([building]));

    const client = createChunkedStorage(port);
    const firstBoot = await client.loadBoot();
    expect(firstBoot.relayout).toBe(true);
    // ADDENDUM-08 §4 — a version<4 boot must force a full re-seat: old
    // plotIndex values are meaningless in the new 20x20 coordinate space.
    expect(firstBoot.forceReseat).toBe(true);
    expect(firstBoot.buildings).toEqual([building]);
    expect(firstBoot.index.layoutVersion).toBe(LAYOUT_VERSION);
    client.flush(); // land the rewrite on the raw port — writes are debounced (storage.ts)

    // The rewrite actually persisted — a second boot (a new client over the
    // same port) must not fire again ("exactly once", §3.6).
    const secondClient = createChunkedStorage(port);
    const secondBoot = await secondClient.loadBoot();
    expect(secondBoot.relayout).toBe(false);
  });

  it("does not fire for a pre-existing but empty town (index present, 0 buildings) — nothing to relayout", async () => {
    const port = makeFakePort();
    port.set("ait.v1.index", JSON.stringify({ schemaVersion: 1, entryMonths: [], buildingMonths: [] }));
    port.set("ait.v1.core", JSON.stringify({ town: defaultTownState(), budget, onboarded: true }));

    const client = createChunkedStorage(port);
    const boot = await client.loadBoot();
    expect(boot.relayout).toBe(false);
    expect(boot.forceReseat).toBe(false);
    expect(boot.buildings).toEqual([]);
  });

  it("does not fire for a genuinely fresh install (no index key at all)", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const boot = await client.loadBoot();
    expect(boot.relayout).toBe(false);
    expect(boot.forceReseat).toBe(false);
    expect(boot.index.layoutVersion).toBe(LAYOUT_VERSION); // stamped immediately, nothing to notify about later
  });

  it("a town already on the current LAYOUT_VERSION never fires, even with buildings", async () => {
    const port = makeFakePort();
    port.set(
      "ait.v1.index",
      JSON.stringify({ schemaVersion: 1, layoutVersion: LAYOUT_VERSION, entryMonths: [], buildingMonths: ["2026-08"] }),
    );
    port.set("ait.v1.core", JSON.stringify({ town, budget, onboarded: true }));
    port.set("ait.v1.buildings.2026-08", JSON.stringify([building]));

    const client = createChunkedStorage(port);
    const boot = await client.loadBoot();
    expect(boot.relayout).toBe(false);
    expect(boot.forceReseat).toBe(false);
  });
});
