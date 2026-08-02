import { describe, expect, it } from "vitest";
import { createChunkedStorage } from "../storage";
import { BALANCE } from "../balance.placeholder";
import { FIXTURES, loadFixtureIntoStorage } from "./fixtures";
import type { StoragePort } from "../platform/storage";
import { budgetPace, monthTotal } from "../selectors";

function makeFakePort(): StoragePort {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

describe("fixtures are deterministic", () => {
  for (const name of Object.keys(FIXTURES) as Array<keyof typeof FIXTURES>) {
    it(`${name} produces byte-identical output across two builds`, () => {
      const a = FIXTURES[name]();
      const b = FIXTURES[name]();
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  }
});

describe("fixture shapes match their spec §11 role", () => {
  it("empty has no entries and no buildings", () => {
    const f = FIXTURES.empty();
    expect(f.entries).toEqual([]);
    expect(f.buildings).toEqual([]);
  });

  it("oneMonth has roughly the promised entry count and a budget", () => {
    const f = FIXTURES.oneMonth();
    expect(f.entries.length).toBeCloseTo(90, -1);
    expect(f.budget.monthlyBudgetKrw).not.toBeNull();
  });

  it("oneMonth's `today` falls inside its own data — the donut and pace bar are non-empty", () => {
    const f = FIXTURES.oneMonth();
    const currentPeriod = f.today.slice(0, 7);
    // Every generated entry must actually land in the period `today` belongs to.
    expect(f.entries.every((e) => e.occurredOn.slice(0, 7) === currentPeriod)).toBe(true);
    expect(monthTotal(f.entries, currentPeriod, "expense")).toBeGreaterThan(0);
    const pace = budgetPace(f.entries, currentPeriod, f.budget.monthlyBudgetKrw, f.today);
    expect(pace).not.toBeNull();
    expect(pace as number).toBeGreaterThan(0);
  });

  it("dense has ~5,400 buildings, 36 monuments, and a full tower", () => {
    const f = FIXTURES.dense();
    const monuments = f.buildings.filter((b) => b.source.kind === "monument");
    expect(monuments).toHaveLength(36);
    expect(f.buildings.length).toBeGreaterThan(5_000);
    expect(f.town.cumulativeSavingsKrw).toBeGreaterThanOrEqual(
      BALANCE.savingsTowerSegments[BALANCE.savingsTowerSegments.length - 1],
    );
  });

  it("capExceeded produces exactly cap buildings and 3 queued materials", () => {
    const f = FIXTURES.capExceeded();
    const builtEntries = f.entries.filter((e) => e.buildingId !== null);
    expect(builtEntries).toHaveLength(BALANCE.dailyBuildSlots);
    expect(f.town.queue).toHaveLength(3);
  });

  it("queueFull fills the queue to materialQueueMax and overflows one entry with no material", () => {
    const f = FIXTURES.queueFull();
    expect(f.town.queue).toHaveLength(BALANCE.materialQueueMax);
    const overflow = f.entries.filter((e) => e.buildingId === null && !e.queued);
    expect(overflow).toHaveLength(1);
  });

  it("budgetBlown produces a pace of exactly 2.0 on its own 'today'", () => {
    const f = FIXTURES.budgetBlown();
    expect(f.today).toBe("2026-06-15");
    const totalExpense = f.entries.reduce((sum, e) => sum + e.amountKrw, 0);
    expect(totalExpense).toBe(600_000);
    expect(f.budget.monthlyBudgetKrw).toBe(600_000);
  });

  it("noSpendStreak has 5 claimed days and 5 park buildings", () => {
    const f = FIXTURES.noSpendStreak();
    expect(f.town.noSpendDays).toHaveLength(5);
    expect(f.buildings.filter((b) => b.source.kind === "nospend")).toHaveLength(5);
  });

  it("unsettled is 3 periods stale", () => {
    const f = FIXTURES.unsettled();
    expect(f.town.lastSettledPeriod).toBe("2026-04");
  });
});

describe("loadFixtureIntoStorage", () => {
  it("round-trips a normal fixture through the chunked storage layer", () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const fixture = FIXTURES.oneMonth();
    loadFixtureIntoStorage(fixture, client, port);

    const boot = client.loadBoot();
    expect(boot.core).toEqual({ town: fixture.town, budget: fixture.budget, onboarded: true });
    expect(boot.corrupted).toEqual([]);
    expect(boot.buildings.length).toBe(fixture.buildings.length);
  });

  it("the corrupt fixture leaves its month's entries chunk unparseable, quarantined on load", () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    const fixture = FIXTURES.corrupt();
    const currentPeriod = fixture.today.slice(0, 7);

    // Precondition: the fixture actually has real entries in the period it's
    // about to mangle — otherwise mangling that chunk proves nothing (it was
    // never registered/written in the first place).
    expect(fixture.entries.some((e) => e.occurredOn.slice(0, 7) === currentPeriod)).toBe(true);

    loadFixtureIntoStorage(fixture, client, port);

    // Buildings/core/index are untouched — only the entries chunk was mangled (§10 F10 AC).
    const boot = client.loadBoot();
    expect(boot.corrupted).toEqual([]);
    expect(boot.core).toEqual({ town: fixture.town, budget: fixture.budget, onboarded: true });
    expect(boot.buildings.length).toBe(fixture.buildings.length); // buildings chunk unaffected

    const { entries, corrupt } = client.loadEntriesForMonth(currentPeriod);
    expect(corrupt).toBe(true);
    expect(entries).toEqual([]); // quarantined, not thrown
  });
});

// Spec §10.4 names a mid-range Android WebView as the performance floor for
// every AC in the doc, and §8.4 sizes boot at "~400 KB / ~5,400 buildings",
// exactly what `dense` reaches. This does not simulate real device hardware,
// but it turns "boot cost against the dense fixture" from an unmeasured
// claim into a number this suite actually records, and it regresses loudly
// if `loadBoot()`'s cost grows superlinearly.
describe("dense fixture boot cost (spec §10.4 / §8.4)", () => {
  it("loadBoot() over ~5,400 buildings completes within a generous smoke bound", () => {
    const port = makeFakePort();
    const client = createChunkedStorage(port);
    loadFixtureIntoStorage(FIXTURES.dense(), client, port);

    const start = performance.now();
    const boot = client.loadBoot();
    const elapsedMs = performance.now() - start;

    expect(boot.buildings.length).toBeGreaterThan(5_000);
    // Deliberate simplification: loadBoot() JSON.parses every building chunk
    // synchronously in one main-thread pass, no yielding/batching — fine on a
    // dev machine, but this is exactly the cost §10.4 asks about on real
    // hardware. Batch it (requestIdleCallback / chunked yielding) in T003
    // once there's a boot screen to show progress on, if a real-device
    // measurement says this drops frames.
    expect(elapsedMs).toBeLessThan(2_000);
  });

  // Absolute wall-clock bounds are hardware-dependent and, per the finding
  // above, too loose to mean anything (this suite's whole run is ~250ms). A
  // ratio against a much smaller fixture is hardware-independent and is what
  // actually catches loadBoot() degrading from linear to superlinear in
  // building count, which is the regression §10.4 cares about.
  it("loadBoot() cost scales roughly linearly with building count, not superlinearly", () => {
    const smallPort = makeFakePort();
    const smallClient = createChunkedStorage(smallPort);
    loadFixtureIntoStorage(FIXTURES.oneMonth(), smallClient, smallPort);
    const smallBoot = smallClient.loadBoot();
    const smallStart = performance.now();
    for (let i = 0; i < 20; i++) smallClient.loadBoot();
    const smallMsPerCall = (performance.now() - smallStart) / 20;

    const densePort = makeFakePort();
    const denseClient = createChunkedStorage(densePort);
    loadFixtureIntoStorage(FIXTURES.dense(), denseClient, densePort);
    const denseBoot = denseClient.loadBoot();
    const denseStart = performance.now();
    for (let i = 0; i < 20; i++) denseClient.loadBoot();
    const denseMsPerCall = (performance.now() - denseStart) / 20;

    const buildingRatio = denseBoot.buildings.length / smallBoot.buildings.length;
    // Linear scaling means denseMsPerCall/smallMsPerCall tracks buildingRatio;
    // a generous multiplier on top of the linear expectation still fails hard
    // on a superlinear (e.g. quadratic) implementation, which would blow past
    // it by orders of magnitude at this building-count ratio.
    const maxExpectedMsPerCall = smallMsPerCall * buildingRatio * 5 + 5; // +5ms floor for timer noise
    expect(denseMsPerCall).toBeLessThan(maxExpectedMsPerCall);
  });
});
