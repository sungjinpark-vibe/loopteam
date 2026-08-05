/**
 * ADDENDUM-02 §8.3 AC-R4 (dense-scale, `[qa]`) — the part of it this task can
 * actually automate: "boot with reconcile still paints in < 1 s" against the
 * real `dense` devtools fixture (~5,400 buildings, §11). The other half of
 * AC-R4 ("entering move mode does not drop frames") is part (b)'s (long-press
 * move is out of scope here) and stays a real-device `[qa]` claim.
 *
 * Lives in `src/devtools/` (not `src/placement.test.ts`) because it needs
 * `FIXTURES`/`loadFixtureIntoStorage`, and eslint's `no-restricted-imports`
 * rule bans any static import of `src/devtools/**` from outside this folder
 * (MVP-SPEC §11) — this file IS that folder.
 *
 * round-2 finding (C1/C4): the previous "performance sanity" test measured a
 * hand-built array shaped like the dense fixture, never the fixture itself,
 * never repaired anything (best case only), and never went through the real
 * boot path. This file fixes all three: it loads the actual `dense` fixture
 * through the actual chunked-storage round trip, measures `reconcilePlacement`
 * on data read back the same way `useTownStore` reads it, AND drives the real
 * `useTownStore` boot (React mount, not a bare function call) — once clean,
 * once with a deliberately introduced duplicate so the repair branch is the
 * one under test, not skipped by a lucky clean fixture.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analytics } from "../platform/analytics";
import { setTimeTravelDate } from "../platform/clock";
import { reconcilePlacement } from "../placement";
import { createChunkedStorage } from "../storage";
import type { Building } from "../types";
import { useTownStore } from "../useTownStore";
import { FIXTURES, loadFixtureIntoStorage } from "./fixtures";

/** Same fixture, with one deliberate plotIndex collision — introduces exactly one repair. */
function withOneDuplicate(buildings: readonly Building[]): Building[] {
  const copy = buildings.map((b) => ({ ...b }));
  // index 10 was created well before index 3000 (fixture generation order is
  // creation order) — the earlier one keeps its lot, the later one is the
  // one `reconcilePlacement` must re-seat.
  copy[3000] = { ...copy[3000], plotIndex: copy[10].plotIndex };
  return copy;
}

/** An in-memory `StoragePort` — same shape `createChunkedStorage` needs, factored out of the two pure-function tests below (round-3 finding C3: was duplicated verbatim). */
function fakeInMemoryPort() {
  const map = new Map<string, string>();
  return { get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => void map.set(k, v), remove: (k: string) => void map.delete(k), keys: () => [...map.keys()] };
}

describe("AC-R4 — reconcilePlacement on the REAL dense fixture, read back through the real storage round trip", () => {
  it("finds nothing to repair on the untouched fixture, in a tight guard bound", async () => {
    const fixture = FIXTURES.dense();
    const fakePort = fakeInMemoryPort();
    const loaderClient = createChunkedStorage(fakePort);
    loadFixtureIntoStorage(fixture, loaderClient, fakePort);

    const boot = await loaderClient.loadBoot();
    expect(boot.buildings.length).toBe(fixture.buildings.length);

    const start = performance.now();
    const result = reconcilePlacement(boot.core!.town.nextPlotIndex, boot.buildings);
    const elapsedMs = performance.now() - start;

    expect(result.repaired).toBe(0);
    expect(result.buildings).toBe(boot.buildings); // reference-identical — nothing to write
    // reconcile itself is a sort + two O(n) passes over ~5,400 items — this is
    // a tight guard (not the 1000ms formality round-2 flagged), meant to
    // catch a regression from microseconds to something structurally worse.
    expect(elapsedMs).toBeLessThan(100);
  });

  it("repairs exactly the one introduced duplicate, still in a tight guard bound", async () => {
    const fixture = FIXTURES.dense();
    const fakePort = fakeInMemoryPort();
    const loaderClient = createChunkedStorage(fakePort);
    loadFixtureIntoStorage({ ...fixture, buildings: withOneDuplicate(fixture.buildings) }, loaderClient, fakePort);

    const boot = await loaderClient.loadBoot();
    const start = performance.now();
    const result = reconcilePlacement(boot.core!.town.nextPlotIndex, boot.buildings);
    const elapsedMs = performance.now() - start;

    expect(result.repaired).toBe(1);
    const plotIndices = result.buildings.map((b) => b.plotIndex);
    expect(new Set(plotIndices).size).toBe(plotIndices.length); // no more collision
    expect(elapsedMs).toBeLessThan(100);
  });
});

// ── Integration level: the real useTownStore boot (React mount), not a bare function call ──

let container: HTMLDivElement;
let root: Root | null = null;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  latest = useTownStore();
  return null;
}

// A plain function, not inlined at the call site: TS narrows `latest`
// against its LAST STATIC assignment in the enclosing function, and
// `mountAndWaitForBoot` below assigns `latest = null` right before the poll
// loop — inlined, the compiler doesn't know `Harness` (a different function)
// reassigns it between polls and narrows the "not null" branch to `never`.
// A separate function has no such local assignment to narrow against.
function stillLoading(): boolean {
  return latest === null || latest.loading;
}

async function mountAndWaitForBoot(): Promise<void> {
  if (root !== null) act(() => root!.unmount());
  root = createRoot(container);
  latest = null;
  act(() => {
    root!.render(<Harness />);
  });
  // A single tick is enough for every OTHER test file's small fixtures (boot
  // settles inside one macrotask), but this file's dense fixture (~5,400
  // buildings / 36 month chunks) can make `storage.ts`'s own TIME_BUDGET_MS=8ms
  // batched reader yield via a REAL `setTimeout(0)` more than once under
  // load — a fixed one-tick wait then observes the harness before
  // `useTownStore`'s boot effect has called `setState`, and every assertion
  // below reads the pre-boot zero state (flaky exit=1 under `npm test`,
  // reliably green when this file runs alone). `useTownStore()`'s return
  // value is NEVER `null` (it always has a `loading` flag, `null` only
  // internally) — the loop must poll THAT, not object identity, or it exits
  // on the very first (still-loading) render. Polling with ONE `act()` per
  // tick (rather than a loop of bare timers inside a single `act()`) lets
  // each pending `setState` actually flush and update `latest` before the
  // next check — nesting the loop inside one `act()` call left React's own
  // state-flush timing decoupled from the loop's exit check.
  for (let i = 0; i < 200 && stillLoading(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root !== null) act(() => root!.unmount());
  root = null;
  container.remove();
  setTimeTravelDate(null);
  vi.restoreAllMocks();
});

describe("AC-R4 — the real useTownStore boot over the dense fixture, on the real browser storage port", () => {
  it("boots a clean dense town within a smoke budget and never fires placement_repaired", async () => {
    const fixture = FIXTURES.dense();
    setTimeTravelDate(fixture.today);
    const loaderClient = createChunkedStorage(); // real browser localStorage port — same one useTownStore itself uses
    loadFixtureIntoStorage(fixture, loaderClient);
    loaderClient.flush(); // land the debounced writes before useTownStore's own client reads them back

    const trackSpy = vi.spyOn(analytics, "track");
    const start = performance.now();
    await mountAndWaitForBoot();
    const elapsedMs = performance.now() - start;
    // Round-3 finding C4: the previous version of this test asserted a bound
    // but never surfaced the actual number anywhere in the evidence. Logged
    // here so a reader (or QA re-running this) sees the real measured value,
    // not just a pass/fail against a bound.
    console.info(`[AC-R4] clean dense boot elapsedMs=${elapsedMs.toFixed(1)}`);

    expect(latest?.buildingCount).toBe(fixture.buildings.length);
    expect(trackSpy).not.toHaveBeenCalledWith("placement_repaired", expect.anything());
    // Round-2 asserted a 3,000ms bound against §10.4's <1s AC — three times
    // the actual written number, so the AC as written was never really
    // checked (round-3 finding C4). Asserting the AC's own literal number
    // (1,000ms) instead — measured on this machine (logged above) the real
    // value is in the tens of ms, so 1,000ms is not a coin-flip bound, it is
    // the spec's number, with real headroom to spare before it would ever
    // flake on CI.
    expect(elapsedMs).toBeLessThan(1_000);
  });

  it("boots a dense town with one duplicate plotIndex, self-heals within the same smoke budget, and fires placement_repaired exactly once", async () => {
    const fixture = FIXTURES.dense();
    setTimeTravelDate(fixture.today);
    const loaderClient = createChunkedStorage();
    loadFixtureIntoStorage(
      // ADDENDUM-02 §4.5 — this test is about the reconciler's OWN "silent
      // repair" contract (§3.6 point 6), not the move-hint; the dense fixture
      // has thousands of buildings and an unset `moveHintSeen`, which would
      // otherwise ALSO (correctly — see `useTownStore.move.test.tsx`) queue
      // `{ kind: "moveHint" }` at this same boot. Marking it already-seen
      // keeps this file scoped to reconciliation.
      { ...fixture, buildings: withOneDuplicate(fixture.buildings), town: { ...fixture.town, moveHintSeen: true } },
      loaderClient,
    );
    loaderClient.flush();

    const trackSpy = vi.spyOn(analytics, "track");
    const start = performance.now();
    await mountAndWaitForBoot();
    const elapsedMs = performance.now() - start;
    console.info(`[AC-R4] repaired dense boot elapsedMs=${elapsedMs.toFixed(1)}`);

    expect(latest?.buildingCount).toBe(fixture.buildings.length);
    const plotIndices = latest!.buildings.map((b) => b.plotIndex);
    expect(new Set(plotIndices).size).toBe(plotIndices.length); // repaired — no collision survives to the app
    expect(trackSpy).toHaveBeenCalledWith("placement_repaired", { count: 1 });
    expect(latest?.notice).toBeNull(); // silent repair — §3.6 point 6
    expect(elapsedMs).toBeLessThan(1_000); // the AC's own literal number — see the twin test above
  });
});
