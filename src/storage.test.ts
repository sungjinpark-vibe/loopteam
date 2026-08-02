import { describe, expect, it, vi } from "vitest";
import { createChunkedStorage } from "./storage";
import type { StoragePort } from "./platform/storage";
import type { Building, BudgetSetting, LedgerEntry, TownState } from "./types";

function makeFakePort(): StoragePort & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

const town: TownState = {
  townName: "우리 동네",
  nextPlotIndex: 1,
  streakDays: 1,
  longestStreakDays: 1,
  lastActOn: "2026-08-02",
  slotsUsedOn: "2026-08-02",
  slotsUsedToday: 1,
  highestTierSeen: 0,
  queue: [],
  noSpendDays: [],
  cumulativeSavingsKrw: 0,
  lastSettledPeriod: "2026-08",
};
const budget: BudgetSetting = { monthlyBudgetKrw: 600_000, updatedAt: 1 };
const entry: LedgerEntry = {
  id: "e1",
  type: "expense",
  amountKrw: 4_500,
  categoryId: "cafe",
  occurredOn: "2026-08-02",
  createdAt: 1,
  updatedAt: 1,
  buildingId: "b1",
  queued: false,
};
const building: Building = {
  id: "b1",
  source: { kind: "entry", entryId: "e1" },
  categoryId: "cafe",
  variantIndex: 0,
  plotIndex: 0,
  builtOn: "2026-08-02",
  createdAt: 1,
};

describe("chunked storage round-trip", () => {
  it("survives a full reload: core, entries, buildings all identical", () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    client.saveEntriesForMonth("2026-08", [entry], core);
    client.saveBuildingsForMonth("2026-08", [building]);

    const boot = client.loadBoot();
    expect(boot.core).toEqual(core);
    expect(boot.buildings).toEqual([building]);
    expect(boot.corrupted).toEqual([]);

    const { entries, corrupt } = client.loadEntriesForMonth("2026-08");
    expect(corrupt).toBe(false);
    expect(entries).toEqual([entry]);
  });

  it("saving one entry writes exactly two keys when the month is already known", () => {
    const port = makeFakePort();
    const setSpy = vi.spyOn(port, "set");
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };

    // First save in a new month: entries chunk + core + index (month registration).
    client.saveEntriesForMonth("2026-08", [entry], core);
    expect(setSpy).toHaveBeenCalledTimes(3);

    // Second save, same month: exactly two writes (entries chunk + core) — index unchanged.
    setSpy.mockClear();
    client.saveEntriesForMonth("2026-08", [entry, { ...entry, id: "e2" }], core);
    expect(setSpy).toHaveBeenCalledTimes(2);
  });

  it("quarantines a corrupt chunk instead of white-screening, and boots to a clean state on a corrupt index", () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    client.saveEntriesForMonth("2026-08", [entry], core);
    client.saveBuildingsForMonth("2026-08", [building]);

    port.set("ait.v1.buildings.2026-08", "{not valid json");
    const boot = client.loadBoot();
    expect(boot.buildings).toEqual([]); // quarantined, not thrown
    expect(boot.corrupted.some((c) => c.key === "ait.v1.buildings.2026-08")).toBe(true);
    expect(boot.core).toEqual(core); // core itself is untouched

    port.set("ait.v1.index", "not json at all");
    const bootAfterIndexCorruption = client.loadBoot();
    expect(bootAfterIndexCorruption.index).toEqual({ schemaVersion: 1, entryMonths: [], buildingMonths: [] });
    expect(bootAfterIndexCorruption.corrupted.some((c) => c.key === "ait.v1.index")).toBe(true);
  });

  it("clearAll removes every known chunk plus core and index", () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    client.saveEntriesForMonth("2026-08", [entry], core);
    client.saveBuildingsForMonth("2026-08", [building]);
    client.clearAll();
    expect(Object.keys(port.dump())).toEqual([]);
  });
});
