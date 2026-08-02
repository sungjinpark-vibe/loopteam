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
    keys: () => [...map.keys()],
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
  it("survives a full reload: core, entries, buildings all identical", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    client.saveEntriesForMonth("2026-08", [entry], core);
    client.saveBuildingsForMonth("2026-08", [building]);

    const boot = await client.loadBoot();
    expect(boot.core).toEqual(core);
    expect(boot.buildings).toEqual([building]);
    expect(boot.corrupted).toEqual([]);

    const { entries, corrupt } = client.loadEntriesForMonth("2026-08");
    expect(corrupt).toBe(false);
    expect(entries).toEqual([entry]);
  });

  it("debounces writes: reads see a pending write immediately, but the raw port doesn't until flush()", () => {
    const port = makeFakePort();
    const setSpy = vi.spyOn(port, "set");
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };

    client.saveEntriesForMonth("2026-08", [entry], core);
    client.saveBuildingsForMonth("2026-08", [building]);
    // Nothing hits the raw port yet — debounced (~300ms, §10 F10).
    expect(setSpy).not.toHaveBeenCalled();

    // A second save to the same keys before the debounce window elapses.
    client.saveEntriesForMonth("2026-08", [entry, { ...entry, id: "e2" }], core);
    client.flush();

    // Coalesced into exactly one raw write per distinct key touched, even
    // though saveEntriesForMonth ran twice.
    const keysWritten = setSpy.mock.calls.map(([key]) => key).sort();
    expect(keysWritten).toEqual(["ait.v1.buildings.2026-08", "ait.v1.core", "ait.v1.entries.2026-08", "ait.v1.index"].sort());
    expect(JSON.parse(port.get("ait.v1.entries.2026-08") as string)).toHaveLength(2);
  });

  it("quarantines a corrupt building chunk, and rebuilds (not blanks) a corrupt index from surviving keys", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    client.saveEntriesForMonth("2026-08", [entry], core);
    client.saveBuildingsForMonth("2026-08", [building]);
    client.flush(); // land the real data on the raw port before corrupting it directly below

    port.set("ait.v1.buildings.2026-08", "{not valid json");
    const boot = await client.loadBoot();
    expect(boot.buildings).toEqual([]); // quarantined, not thrown
    expect(boot.corrupted.some((c) => c.key === "ait.v1.buildings.2026-08")).toBe(true);
    expect(boot.core).toEqual(core); // core itself is untouched

    port.set("ait.v1.index", "not json at all");
    const bootAfterIndexCorruption = await client.loadBoot();
    // Rebuilt from surviving raw keys, NOT reset to empty (that would orphan
    // the 2026-08 chunks that are still sitting in storage — see the
    // dedicated "corrupt index does not orphan" test below).
    expect(bootAfterIndexCorruption.index).toEqual({
      schemaVersion: 1,
      entryMonths: ["2026-08"],
      buildingMonths: ["2026-08"],
    });
    expect(bootAfterIndexCorruption.corrupted.some((c) => c.key === "ait.v1.index")).toBe(true);
    // The buildings chunk was ALSO corrupted earlier in this test — index
    // recovery does not un-quarantine a chunk that is itself unparseable.
    expect(bootAfterIndexCorruption.buildings).toEqual([]);
    expect(bootAfterIndexCorruption.corrupted.some((c) => c.key === "ait.v1.buildings.2026-08")).toBe(true);
  });

  it("a corrupt index does not orphan chunks that survived it (F10) — recovers on the next save", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };

    // A previously-saved month, from before the corruption.
    const julyEntry: LedgerEntry = { ...entry, id: "e-july", occurredOn: "2026-07-15" };
    const julyBuilding: Building = { ...building, id: "b-july", builtOn: "2026-07-15" };
    client.saveEntriesForMonth("2026-07", [julyEntry], core);
    client.saveBuildingsForMonth("2026-07", [julyBuilding]);
    client.flush();

    port.set("ait.v1.index", "{corrupt,,,");

    // The very next save is exactly the sequence that used to persist an
    // empty index and permanently orphan the July chunks above.
    client.saveEntriesForMonth("2026-08", [entry], core);
    client.saveBuildingsForMonth("2026-08", [building]);

    const boot = await client.loadBoot();
    expect(boot.index.entryMonths).toEqual(["2026-07", "2026-08"]);
    expect(boot.index.buildingMonths).toEqual(["2026-07", "2026-08"]);
    // July's building is still reachable via loadBoot (eager, all months).
    expect(boot.buildings.map((b) => b.id).sort()).toEqual(["b-july", "b1"]);

    // July's entries are still reachable via lazy per-month load, not silently dropped.
    const july = client.loadEntriesForMonth("2026-07");
    expect(july.corrupt).toBe(false);
    expect(july.entries).toEqual([julyEntry]);

    // clearAll still reaches every chunk, including July's — nothing left behind.
    client.clearAll();
    client.flush();
    expect(Object.keys(port.dump())).toEqual([]);
  });

  it("a surviving core is NEVER overwritten by a guess, even when the index was corrupt", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const savingEntry: LedgerEntry = { ...entry, id: "s1", type: "saving", amountKrw: 12_345, occurredOn: "2026-07-01" };
    // A surviving core is authoritative even when its denormalized fields
    // don't match what a naive rescan of entries would compute — e.g. an
    // entry was later deleted, or settlement ran with entries not present
    // in this test. Overwriting it with a rescan is exactly the bug this
    // test guards against.
    const survivingCore = { town: { ...town, cumulativeSavingsKrw: 999_999, lastSettledPeriod: "2020-01" }, budget, onboarded: true };
    client.saveEntriesForMonth("2026-07", [savingEntry], survivingCore);
    client.flush();

    port.set("ait.v1.index", "{corrupt");
    const boot = await client.loadBoot();

    expect(boot.core).toEqual(survivingCore);
    expect(boot.corrupted.some((c) => c.key === "ait.v1.index")).toBe(true);
  });

  it("recovers cumulativeSavingsKrw/lastSettledPeriod from surviving entries when the core chunk itself is lost", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    const julyBuilding: Building = { ...building, id: "b-july", plotIndex: 7, builtOn: "2026-07-15" };
    const savingEntry: LedgerEntry = { ...entry, id: "s1", type: "saving", amountKrw: 12_345, occurredOn: "2026-07-01" };
    client.saveEntriesForMonth("2026-07", [savingEntry], core);
    client.saveBuildingsForMonth("2026-07", [julyBuilding]);
    client.flush();

    port.set("ait.v1.core", "{not valid json");
    const boot = await client.loadBoot();

    expect(boot.corrupted.some((c) => c.key === "ait.v1.core")).toBe(true);
    expect(boot.core?.town.cumulativeSavingsKrw).toBe(12_345);
    // Rebuilt to one month BEFORE the earliest surviving entry (2026-06), never
    // the latest — advancing past 2026-07 would permanently suppress its 기념비 (F16).
    expect(boot.core?.town.lastSettledPeriod).toBe("2026-06");
    // nextPlotIndex is recovered past every surviving building's plotIndex so a
    // freshly-built building can never collide with one that already exists.
    expect(boot.core?.town.nextPlotIndex).toBe(8);
    expect(boot.core?.onboarded).toBe(true); // ledger data survives — no re-onboarding
  });

  it("recovers noSpendDays (from surviving buildings) and queue (from surviving entries) when core is lost", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    const noSpendBuilding: Building = {
      id: "b-nospend",
      source: { kind: "nospend", date: "2026-07-10" },
      categoryId: null,
      variantIndex: 0,
      plotIndex: 9,
      builtOn: "2026-07-10",
      createdAt: 1,
    };
    const queuedEntry: LedgerEntry = { ...entry, id: "e-queued", buildingId: null, queued: true, occurredOn: "2026-07-11" };
    client.saveEntriesForMonth("2026-07", [entry, queuedEntry], core);
    client.saveBuildingsForMonth("2026-07", [building, noSpendBuilding]);
    client.flush();

    port.set("ait.v1.core", "{not valid json");
    const boot = await client.loadBoot();

    // F15's guard is `town.noSpendDays.includes(today)` — dropping this on
    // recovery would let an already-claimed day become re-claimable.
    expect(boot.core?.town.noSpendDays).toEqual(["2026-07-10"]);
    // F14's queued material — entryId/categoryId/queuedOn are recoverable
    // from the entry; variantIndex is not (it lived only on the lost
    // QueuedMaterial) and is re-rolled to a fixed default.
    expect(boot.core?.town.queue).toEqual([
      { entryId: "e-queued", categoryId: "cafe", variantIndex: 0, queuedOn: "2026-07-11" },
    ]);
  });

  it("flags cumulativeSavingsKrw as possibly understated when core AND an entries chunk are both lost", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    const savingJuly: LedgerEntry = { ...entry, id: "s1", type: "saving", amountKrw: 12_345, occurredOn: "2026-07-01" };
    const savingAug: LedgerEntry = { ...entry, id: "s2", type: "saving", amountKrw: 5_000, occurredOn: "2026-08-01" };
    client.saveEntriesForMonth("2026-07", [savingJuly], core);
    client.saveEntriesForMonth("2026-08", [savingAug], core);
    client.flush();

    port.set("ait.v1.core", "{not valid json");
    port.set("ait.v1.entries.2026-07", "{also not valid json");
    const boot = await client.loadBoot();

    // Only the August saving is countable — the July chunk was unreadable —
    // so the recovered total is a floor, never fabricated above what survived.
    expect(boot.core?.town.cumulativeSavingsKrw).toBe(5_000);
    expect(boot.corrupted.some((c) => c.key === "ait.v1.entries.2026-07")).toBe(true);
    expect(
      boot.corrupted.some((c) => c.key === "ait.v1.core" && c.reason.includes("understated")),
    ).toBe(true);
  });

  it("schemaVersion mismatch on the index does not orphan chunks (treated the same as a corrupt index)", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    client.saveEntriesForMonth("2026-07", [entry], core);
    client.saveBuildingsForMonth("2026-07", [building]);
    client.flush();

    port.set("ait.v1.index", JSON.stringify({ schemaVersion: 99, entryMonths: [], buildingMonths: [] }));
    const boot = await client.loadBoot();

    expect(boot.corrupted.some((c) => c.key === "ait.v1.index")).toBe(true);
    expect(boot.index.entryMonths).toEqual(["2026-07"]);
    expect(boot.index.buildingMonths).toEqual(["2026-07"]);
    expect(boot.core).toEqual(core); // core itself untouched

    // The next save does not persist an empty/wrong index over the rebuilt one.
    client.saveEntriesForMonth("2026-08", [{ ...entry, id: "e2" }], core);
    const bootAfter = await client.loadBoot();
    expect(bootAfter.index.entryMonths).toEqual(["2026-07", "2026-08"]);
  });

  it("every method survives being destructured off the client (the normal React-hook consumption pattern)", async () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    const { saveEntriesForMonth, saveBuildingsForMonth, loadBoot } = client;

    saveEntriesForMonth("2026-08", [entry], core);
    saveBuildingsForMonth("2026-08", [building]);
    const boot = await loadBoot();

    expect(boot.core).toEqual(core);
    expect(boot.buildings).toEqual([building]);
  });

  it("clearAll removes every known chunk plus core and index", () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    client.saveEntriesForMonth("2026-08", [entry], core);
    client.saveBuildingsForMonth("2026-08", [building]);
    client.flush();
    client.clearAll();
    expect(Object.keys(port.dump())).toEqual([]);
  });

  it("clearAll cancels a still-pending debounced write so a stray flush never resurrects wiped data", () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const core = { town, budget, onboarded: true };
    client.saveEntriesForMonth("2026-08", [entry], core); // still pending, never flushed
    client.clearAll();
    client.flush(); // must be a no-op — nothing should land on the raw port
    expect(Object.keys(port.dump())).toEqual([]);
  });
});
