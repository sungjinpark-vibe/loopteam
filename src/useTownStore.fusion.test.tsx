/**
 * ADDENDUM-11 — wiring tests for building fusion through the REAL hook:
 * persistence across per-month chunks (§3.1), the dangling-reference remap
 * (§5.4), the seed award (§5.3), tier/NPC behaviour under `townScale` (§5.1/
 * §5.5), and the freed-cell side effects (§3).
 *
 * The headline is §7.12: for a CROSS-MONTH fusion, every interruption point in
 * the write sequence must settle into exactly one of two states on the next
 * boot — never a lost building, never a duplicated one. Those cases execute a
 * PREFIX of `fusionChunkWrites` (the very descriptors the store runs, one
 * `loadBuildingsForMonth`/`saveBuildingsForMonth` round trip each) and then
 * boot for real, rather than asserting a happy path.
 *
 * Same bare createRoot+act hook harness every other `useTownStore.*.test.tsx`
 * uses — no React Testing Library in this project.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
import { fusionChunkWrites, type FusionChunkWrite } from "./fusionActions";
import { placeMany } from "./placement";
import { setTimeTravelDate } from "./platform/clock";
import { setRandomOverride } from "./platform/random";
import { tier, townScale } from "./selectors";
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

/** Mounts, or remounts on the same container — a second call is a real reload. */
async function mountAndWaitForBoot(): Promise<void> {
  if (root !== null) act(() => root!.unmount());
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root!.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Forces the ~300ms debounced write buffer out to localStorage. */
function flush(): void {
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
}

const TODAY = "2026-08-02";
const MAXED_EXP = (BALANCE.maxLevel - 1) * BALANCE.expPerLevel; // Lv.5 — derived, never a literal

/**
 * Every buildable (ground) cell, reading order — seeded buildings must stand on
 * real ones or the boot reconciler legitimately re-seats them and the test
 * would be measuring placement, not fusion.
 */
const GROUND_CELLS: readonly number[] = Array.from({ length: CELL_COUNT }, (_, i) => i).filter((i) => {
  const { row, col } = cellFromIndex(i);
  return isBuildable(row, col);
});
/** `n`-th ground cell — a stable, legal anchor for a 1x1. */
const cell = (n: number): number => GROUND_CELLS[n];

function building(id: string, plotIndex: number, builtOn: string, extra: Partial<Building> = {}): Building {
  return {
    id,
    source: { kind: "entry", entryId: `e-${id}` },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex,
    builtOn,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    exp: MAXED_EXP,
    ...extra,
  };
}

function entry(id: string, buildingId: string | null, occurredOn: string): LedgerEntry {
  return {
    id,
    type: "expense",
    amountKrw: 200_000,
    categoryId: "cafe",
    occurredOn,
    createdAt: 1,
    updatedAt: 1,
    buildingId,
    queued: false,
  };
}

function freshTown() {
  return {
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
    // Every settlement already done, so boot mints no F16 monument and the
    // fusion under test is the only thing changing this town.
    lastSettledPeriod: "2026-07",
    moveHintSeen: true,
  };
}

/** Writes the whole pre-boot state: index, core, per-month building and entry chunks. */
function seedTown(buildings: readonly Building[], entries: readonly LedgerEntry[] = []): void {
  const buildingMonths = [...new Set(buildings.map((b) => b.builtOn.slice(0, 7)))].sort();
  const entryMonths = [...new Set(entries.map((e) => e.occurredOn.slice(0, 7)))].sort();
  window.localStorage.setItem(
    "ait.v1.index",
    JSON.stringify({ schemaVersion: 1, layoutVersion: LAYOUT_VERSION, entryMonths, buildingMonths }),
  );
  window.localStorage.setItem(
    "ait.v1.core",
    JSON.stringify({ town: freshTown(), budget: { monthlyBudgetKrw: null, updatedAt: 0 }, onboarded: true }),
  );
  for (const ym of buildingMonths) {
    window.localStorage.setItem(`ait.v1.buildings.${ym}`, JSON.stringify(buildings.filter((b) => b.builtOn.slice(0, 7) === ym)));
  }
  for (const ym of entryMonths) {
    window.localStorage.setItem(`ait.v1.entries.${ym}`, JSON.stringify(entries.filter((e) => e.occurredOn.slice(0, 7) === ym)));
  }
}

function storedBuildings(ym: string): Building[] {
  return JSON.parse(window.localStorage.getItem(`ait.v1.buildings.${ym}`) ?? "[]") as Building[];
}

function allStoredBuildings(): Building[] {
  return Object.keys(window.localStorage)
    .filter((k) => k.startsWith("ait.v1.buildings."))
    .flatMap((k) => JSON.parse(window.localStorage.getItem(k) ?? "[]") as Building[]);
}

function allStoredEntries(): LedgerEntry[] {
  return Object.keys(window.localStorage)
    .filter((k) => k.startsWith("ait.v1.entries."))
    .flatMap((k) => JSON.parse(window.localStorage.getItem(k) ?? "[]") as LedgerEntry[]);
}

/** One chunk write, exactly as `mutateBuildingsForMonth` performs it: load, mutate, save. */
function runChunkWrite(write: FusionChunkWrite): void {
  const key = `ait.v1.buildings.${write.ym}`;
  const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as Building[];
  window.localStorage.setItem(key, JSON.stringify(write.mutate(existing)));
}

/** The §5.4 ledger remap, which the store performs before any buildings chunk write. */
function runLedgerRemap(fromId: string, toId: string): void {
  for (const key of Object.keys(window.localStorage).filter((k) => k.startsWith("ait.v1.entries."))) {
    const entries = JSON.parse(window.localStorage.getItem(key) ?? "[]") as LedgerEntry[];
    window.localStorage.setItem(key, JSON.stringify(entries.map((e) => (e.buildingId === fromId ? { ...e, buildingId: toId } : e))));
  }
}

/**
 * Replays the store's write sequence for one fusion and stops after
 * `stoppedAfter` steps — the app dies there. Step 0 is the ledger remap, steps
 * 1..3 are `fusionChunkWrites`'s own descriptors, in its own order; nothing
 * about the ordering is re-decided here.
 */
function interruptFusionAfter(writes: readonly FusionChunkWrite[], consumedId: string, survivorId: string, stoppedAfter: number): void {
  const steps: Array<() => void> = [
    () => runLedgerRemap(consumedId, survivorId),
    ...writes.map((w) => () => runChunkWrite(w)),
  ];
  for (const step of steps.slice(0, stoppedAfter)) step();
}

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  setRandomOverride(() => 0);
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

// ── §3 — the fusion itself, through the store ──
describe("fuseBuildings — §3", () => {
  it("the survivor keeps its cell and identity, the other building is gone, and both survive a reload", async () => {
    seedTown([building("b1", cell(0), "2026-08"), building("b2", cell(1), "2026-08")]);
    await mountAndWaitForBoot();

    act(() => {
      latest!.fuseBuildings("b1", "b2");
    });
    expect(latest!.buildings.map((b) => b.id)).toEqual(["b1"]);
    const survivor = latest!.buildings[0];
    expect(survivor.plotIndex).toBe(cell(0));
    expect(survivor.fuse).toBe(1);
    expect(survivor.exp).toBe(MAXED_EXP); // exp untouched — the level came from `fuse`
    expect(latest!.levelOfBuilding(survivor)).toBe(BALANCE.maxLevel + 1); // Lv.6

    // §7.14 — a reload restores the fused building at the same cell, same tier.
    flush();
    await mountAndWaitForBoot();
    expect(latest!.buildings.map((b) => b.id)).toEqual(["b1"]);
    expect(latest!.buildings[0]).toMatchObject({ plotIndex: cell(0), fuse: 1 });
    expect(latest!.levelOfBuilding(latest!.buildings[0])).toBe(BALANCE.maxLevel + 1);
  });

  it("refuses an illegal pair without touching the town (the check lives at the mutation, not only at the CTA)", async () => {
    seedTown([building("b1", cell(0), "2026-08"), building("b2", cell(1), "2026-08", { categoryId: "food" })]);
    await mountAndWaitForBoot();

    let result: unknown;
    act(() => {
      result = latest!.fuseBuildings("b1", "b2");
    });
    expect(result).toBeNull();
    expect(latest!.buildings).toHaveLength(2);
    expect(latest!.buildings.every((b) => b.fuse === undefined)).toBe(true);
  });

  it("offers no partner for a monument or a 무지출 park tile, and never offers one AS a partner (§5.2 / F16)", async () => {
    const monument = building("m1", cell(4), "2026-08", { source: { kind: "monument", period: "2026-07" }, categoryId: null, w: 2, h: 2 });
    const park = building("p1", cell(5), "2026-08", { source: { kind: "nospend", date: "2026-08-01" }, categoryId: "park" });
    seedTown([building("b1", cell(0), "2026-08"), building("b2", cell(1), "2026-08"), monument, park]);
    await mountAndWaitForBoot();

    expect(latest!.fuseCandidates("m1")).toEqual([]);
    expect(latest!.fuseCandidates("p1")).toEqual([]);
    expect(latest!.fuseCandidates("b1").map((b) => b.id)).toEqual(["b2"]);

    // §7.11 — the monument and the park tile come through a fusion untouched:
    // same cell, same 2x2 footprint, same summary.
    const monumentBefore = latest!.buildings.find((b) => b.id === "m1")!;
    const parkBefore = latest!.buildings.find((b) => b.id === "p1")!;
    act(() => {
      latest!.fuseBuildings("b1", "b2");
    });
    expect(latest!.buildings.find((b) => b.id === "m1")).toEqual(monumentBefore);
    expect(latest!.buildings.find((b) => b.id === "p1")).toEqual(parkBefore);
    expect(monumentBefore).toMatchObject({ w: 2, h: 2, categoryId: null });
  });

  it("frees the consumed building's cells, seating a building the full town had parked at -1 (§3)", async () => {
    // A genuinely FULL town: one building on every ground cell, plus b3 with
    // nowhere to stand (placement.ts's "never dropped, parked at -1"). Only a
    // fusion can free a cell here — no lot is ever created.
    const full = GROUND_CELLS.map((c, i) => building(`f${i}`, c, "2026-08"));
    seedTown([...full, building("b3", -1, "2026-08", { exp: 0, createdAt: 9_999 })]);
    await mountAndWaitForBoot();
    expect(latest!.buildings.find((b) => b.id === "b3")?.plotIndex).toBe(-1);

    act(() => {
      latest!.fuseBuildings("f0", "f1");
    });
    flush();
    await mountAndWaitForBoot();
    const parked = latest!.buildings.find((b) => b.id === "b3")!;
    expect(parked.plotIndex).toBeGreaterThanOrEqual(0); // seated on the next reconcile, never dropped
    expect(parked.plotIndex).toBe(cell(1)); // the exact cell the fusion vacated
  });

  // Gate-3-rerun fix (panel's UNANIMOUS top finding, all five expert
  // lenses, reproduced twice each): the freed cell used to sit empty until
  // the NEXT boot, because the F14 materials queue only drained at app-open
  // — a full-town fusion showed the count drop live but the queued building
  // stayed queued and the "자리가 나면" wait state was unchanged until a
  // reload. Built through the REAL `placeMany` (RX1-N2 spacing and all) with
  // a constant rng, not the raw "every ground cell occupied" shape the
  // pre-existing test above uses — that shape violates RX1-N2 everywhere and
  // would make even the live drain unable to find the cell fusion frees
  // (RX1-N2 spacing rejects a 1x1 seated with no gap on every side, exactly
  // what "every ground cell occupied" produces). A genuinely full town, built
  // the same way the app itself packs one, always leaves fusion's freed cell
  // legally placeable — that is the whole point of RX1-N2 being symmetric.
  it("drains the F14 queue LIVE the moment a fusion frees a cell — no reload needed", async () => {
    const rng0 = () => 0; // matches `setRandomOverride(() => 0)` above — same footprint (1x1) and anchor-pick rule the live drain will use
    const packed = placeMany([], CELL_COUNT, rng0); // packs to the real, spacing-legal capacity — `placeMany` stops on its own once no anchor (even 1x1) fits
    expect(packed.length).toBeGreaterThan(2); // sanity: the map actually holds more than the 2 buildings this test fuses
    const full = packed.map((p, i) => building(`f${i}`, p.anchor, "2026-08"));
    seedTown(full, [entry("eq1", null, "2026-08-01")]);
    const core = JSON.parse(window.localStorage.getItem("ait.v1.core")!);
    core.town.queue = [
      { entryId: "eq1", entryYm: "2026-08", categoryId: "cafe", variantIndex: 0, queuedOn: "2026-08-01", amountKrw: 5_000 },
    ];
    window.localStorage.setItem("ait.v1.core", JSON.stringify(core));
    await mountAndWaitForBoot();
    expect(latest!.buildingCount).toBe(full.length); // town is genuinely, legally full — boot's own drain found nowhere to put the material either
    expect(latest!.queueLength).toBe(1);
    const seedsBefore = latest!.economy.seeds;

    act(() => {
      latest!.fuseBuildings("f0", "f1");
    });

    // Fuse (-1 building) and drain (+1 building) net back to the starting
    // count, but the count alone can't tell "filled live" from "still
    // queued" — the queue length and the drained building's real seat can.
    expect(latest!.queueLength).toBe(0); // NOT still 1, waiting for next boot
    expect(latest!.buildingCount).toBe(full.length);
    const drained = latest!.buildings.find((b) => b.source.kind === "entry" && b.source.entryId === "eq1");
    expect(drained).toBeDefined();
    expect(drained!.plotIndex).toBeGreaterThanOrEqual(0); // a real seat, not parked at -1 or still in the queue
    expect(latest!.notice).toEqual({ kind: "drained", count: 1 }); // the "return promise kept" toast fires now, not on a future reload
    expect(latest!.economy.seeds).toBeGreaterThan(seedsBefore); // the drain pays its own build award, same as boot's drain

    // And it's actually persisted, not just an in-memory patch this render happened to show.
    flush();
    await mountAndWaitForBoot();
    expect(latest!.queueLength).toBe(0);
    expect(latest!.buildingCount).toBe(full.length);
    expect(latest!.buildings.some((b) => b.source.kind === "entry" && b.source.entryId === "eq1")).toBe(true);
  });
});

// ── §5.1 / §5.5 — what the header, the tier and the crowd read ──
describe("townScale wiring — §5.1/§5.5", () => {
  it("an existing save with nothing fused sees ZERO change: buildingCount === townScale === buildings.length (§7.8)", async () => {
    seedTown([building("b1", cell(0), "2026-08"), building("b2", cell(1), "2026-08"), building("b3", cell(2), "2026-07")]);
    await mountAndWaitForBoot();

    expect(latest!.buildingCount).toBe(3);
    expect(latest!.townScale).toBe(3);
    expect(latest!.buildingCount).toBe(latest!.buildings.length);
    expect(latest!.npcCount).toBe(1 + 3);
  });

  // Gate-3-rerun fix (panel's near-unanimous top finding): the header's
  // "건물 N채" is a literal count and MUST fall by one when a fusion consumes
  // a building — that is the confirmed defect the panel reproduced twice
  // (header stuck at the pre-fusion figure, surviving a reload). Tier and the
  // NPC crowd read `townScale` instead, which is deliberately tier-neutral.
  it("the header count falls by one on fusion; tier and the NPC crowd do not (§7.7/§7.9)", async () => {
    seedTown([building("b1", cell(0), "2026-08"), building("b2", cell(1), "2026-08")]);
    await mountAndWaitForBoot();
    const countBefore = latest!.buildingCount;
    const tierBefore = tier(latest!.townScale, BALANCE.tierThresholds);
    const npcBefore = latest!.npcCount;

    act(() => {
      latest!.fuseBuildings("b1", "b2");
    });

    expect(latest!.buildings).toHaveLength(1); // one fewer OBJECT...
    expect(latest!.buildingCount).toBe(countBefore - 1); // ...and the header agrees
    expect(latest!.buildingCount).toBe(latest!.buildings.length);
    expect(tier(latest!.townScale, BALANCE.tierThresholds)).toBe(tierBefore); // tier is unaffected
    expect(latest!.npcCount).toBe(npcBefore);
    // townScale is tier-neutral (Σ 2**fuse); buildingCount is the literal count. The two now diverge on purpose.
    expect(latest!.townScale).toBe(townScale(latest!.buildings));
    expect(latest!.buildingCount).not.toBe(latest!.townScale);
  });
});

// ── §5.3 — the seed award ──
describe("fusion seed award — §5.3", () => {
  it("pays once per RUNG: a repeat of the same tier is idempotent, the next tier pays again", async () => {
    seedTown([
      building("b1", cell(0), "2026-08"),
      building("b2", cell(1), "2026-08"),
      building("b3", cell(2), "2026-08"),
      building("b4", cell(3), "2026-08"),
    ]);
    await mountAndWaitForBoot();

    act(() => {
      latest!.fuseBuildings("b1", "b2");
    });
    expect(latest!.economy.seeds).toBe(BALANCE.seedAwards.fuse);
    expect(latest!.economy.grantedEventKeys).toContain("seed:fuse:b1:1");

    act(() => {
      latest!.fuseBuildings("b3", "b4");
    });
    const afterTwo = latest!.economy.seeds;

    // b1 (Lv.6) + b3 (Lv.6) -> b1 becomes Lv.7. The key carries the tier, so
    // this is NOT read as the already-paid Lv.6 event.
    act(() => {
      latest!.fuseBuildings("b1", "b3");
    });
    expect(latest!.economy.grantedEventKeys).toContain("seed:fuse:b1:2");
    expect(latest!.economy.seeds).toBe(afterTwo + BALANCE.seedAwards.fuse);
    expect(latest!.levelOfBuilding(latest!.buildings[0])).toBe(BALANCE.maxLevel + 2); // Lv.7
  });
});

// ── §5.4 — dangling references ──
describe("dangling references — §5.4/§7.10/§7.11", () => {
  it("remaps every 기록 entry to the survivor across months; none is deleted, none becomes null", async () => {
    seedTown(
      [building("b1", cell(0), "2026-08"), building("b2", cell(1), "2026-07")],
      [
        entry("e1", "b1", "2026-08-01"),
        entry("e2", "b2", "2026-07-05"), // b2's founding entry, in ANOTHER month chunk
        entry("e3", "b2", "2026-08-01"), // a later grow entry on b2, in this month
        entry("e4", null, "2026-08-01"), // queued/저축 — must stay null
      ],
    );
    await mountAndWaitForBoot();
    const entryCountBefore = allStoredEntries().length;

    act(() => {
      latest!.fuseBuildings("b1", "b2");
    });
    flush();

    const after = allStoredEntries();
    expect(after).toHaveLength(entryCountBefore); // no entry is ever lost to a fusion
    expect(after.find((e) => e.id === "e2")!.buildingId).toBe("b1");
    expect(after.find((e) => e.id === "e3")!.buildingId).toBe("b1");
    expect(after.find((e) => e.id === "e4")!.buildingId).toBeNull(); // an already-null ref is not touched
    expect(after.some((e) => e.buildingId === "b2")).toBe(false); // nothing dangles
  });

  it("transfers a cosmetic SKU to the survivor and never revokes the purchase", async () => {
    seedTown([building("b1", cell(0), "2026-08"), building("b2", cell(1), "2026-08")]);
    window.localStorage.setItem(
      "ait.v1.economy",
      JSON.stringify({
        seeds: 0,
        ownedSkus: ["deco.test"],
        appliedTownSku: null,
        appliedByBuildingId: { b2: "deco.test" },
        purchasedNpcSlots: 0,
        grantedEventKeys: [],
      }),
    );
    await mountAndWaitForBoot();

    act(() => {
      latest!.fuseBuildings("b1", "b2");
    });
    expect(latest!.economy.appliedByBuildingId).toEqual({ b1: "deco.test" });
    expect(latest!.economy.ownedSkus).toEqual(["deco.test"]);
  });
});

// ── §3.1 — the atomicity rule, the one that eats data if it is wrong ──
describe("two-chunk atomicity — §3.1/§7.12/§7.13", () => {
  const survivorSeed = building("b1", cell(0), "2026-07"); // built in July...
  const consumedSeed = building("b2", cell(1), "2026-08"); // ...and August: TWO chunks

  it("a SAME-month fusion is one chunk write and never writes fusePending (§7.13)", async () => {
    seedTown([building("b1", cell(0), "2026-08"), building("b2", cell(1), "2026-08")]);
    await mountAndWaitForBoot();

    act(() => {
      latest!.fuseBuildings("b1", "b2");
    });
    flush();

    const chunk = storedBuildings("2026-08");
    expect(chunk.map((b) => b.id)).toEqual(["b1"]);
    expect(chunk[0].fuse).toBe(1);
    expect(chunk[0].fusePending).toBeUndefined();
  });

  // Interruption after EACH step in turn: 0 = nothing happened, 1 = the 기록
  // remap only, 2..4 = after each of the three chunk writes.
  for (const stoppedAfter of [0, 1, 2, 3, 4]) {
    it(`settles into exactly one legal state when interrupted after step ${stoppedAfter} — never a lost or duplicated building`, async () => {
      seedTown([survivorSeed, consumedSeed], [entry("e1", "b1", "2026-07-05"), entry("e2", "b2", "2026-08-01")]);
      const writes = fusionChunkWrites({ ...survivorSeed, fuse: 1 }, consumedSeed);
      expect(writes).toHaveLength(3); // this really is the cross-month path
      interruptFusionAfter(writes, "b2", "b1", stoppedAfter);

      await mountAndWaitForBoot();
      flush();

      const live = latest!.buildings;
      const survivor = live.find((b) => b.id === "b1");
      const consumed = live.find((b) => b.id === "b2");
      expect(survivor).toBeDefined(); // the survivor is never lost, in any outcome

      if (stoppedAfter <= 1) {
        // (a) the fusion did not happen — both buildings present, at Lv.5.
        // (The 기록 remap alone grants no level and destroys nothing, which is
        // exactly why it is ordered first.)
        expect(consumed).toBeDefined();
        expect(survivor!.fuse).toBeUndefined();
      } else {
        // (b) the fusion completed — survivor at Lv.6, consumed gone.
        expect(consumed).toBeUndefined();
        expect(survivor!.fuse).toBe(1);
      }

      // The two specifically forbidden third states, each its own assertion:
      const lostBuilding = consumed === undefined && survivor!.fuse === undefined;
      const duplicatedBuilding = consumed !== undefined && survivor!.fuse !== undefined;
      expect(lostBuilding).toBe(false); // a player's building silently vanished
      expect(duplicatedBuilding).toBe(false); // a free level

      // `fusePending` is cleared in BOTH outcomes, in memory and in storage.
      expect(live.every((b) => b.fusePending === undefined)).toBe(true);
      expect(allStoredBuildings().every((b) => b.fusePending === undefined)).toBe(true);
      // No 기록 entry dangles at a building that no longer exists.
      const liveIds = new Set(live.map((b) => b.id));
      expect(allStoredEntries().every((e) => e.buildingId === null || liveIds.has(e.buildingId))).toBe(true);
      expect(allStoredEntries()).toHaveLength(2); // and none was deleted

      // Repeat the reload: the repair is idempotent, and settles nothing further.
      const settled = live.map((b) => ({ id: b.id, fuse: b.fuse, plotIndex: b.plotIndex }));
      await mountAndWaitForBoot();
      expect(latest!.buildings.map((b) => ({ id: b.id, fuse: b.fuse, plotIndex: b.plotIndex }))).toEqual(settled);
    });
  }
});
