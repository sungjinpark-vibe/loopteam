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
 * `useTownStore` boot (React mount, not a bare function call).
 *
 * ADDENDUM-08: the fixed 20x20 map's 193 ground cells are far smaller than
 * `dense`'s ~5,400 build attempts, so the fixture itself now carries many
 * baked-in collisions (devtools/fixtures.ts's own documented overflow
 * ceiling) — the repair branch is exercised for free, no artificial
 * duplicate needed.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTimeTravelDate } from "../platform/clock";
import { reconcilePlacement } from "../placement";
import { createChunkedStorage } from "../storage";
import { useTownStore } from "../useTownStore";
import { FIXTURES, loadFixtureIntoStorage } from "./fixtures";

/** An in-memory `StoragePort` — same shape `createChunkedStorage` needs, factored out of the two pure-function tests below (round-3 finding C3: was duplicated verbatim). */
function fakeInMemoryPort() {
  const map = new Map<string, string>();
  return { get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => void map.set(k, v), remove: (k: string) => void map.delete(k), keys: () => [...map.keys()] };
}

describe("AC-R4 — reconcilePlacement on the REAL dense fixture, read back through the real storage round trip", () => {
  // ADDENDUM-08: unlike the old growing-town pool, the fixed 20x20 map has
  // only 193 ground cells — `dense`'s ~5,400 build attempts (devtools/
  // fixtures.ts's own documented ceiling) vastly exceed that, so the
  // fixture itself already carries many genuine collisions (the overflow
  // fallback that keeps every building visible instead of landing off-map).
  // "Nothing to repair" is no longer the right claim at this scale; what
  // still matters is the two invariants spec §4/§9 actually name: reconcile
  // stays fast at ~5,400 items, and NO building is ever dropped — a
  // building reconcile can't seat lands in `unplacedIds`, still present in
  // `result.buildings`, never vanished.
  it("reconciles the dense fixture within a tight guard bound, with every building preserved and no two seated buildings colliding", async () => {
    const fixture = FIXTURES.dense();
    const fakePort = fakeInMemoryPort();
    const loaderClient = createChunkedStorage(fakePort);
    loadFixtureIntoStorage(fixture, loaderClient, fakePort);

    const boot = await loaderClient.loadBoot();
    expect(boot.buildings.length).toBe(fixture.buildings.length);

    const start = performance.now();
    const result = reconcilePlacement(boot.buildings);
    const elapsedMs = performance.now() - start;

    // Nothing dropped — every id from before reconcile is still present.
    expect(result.buildings.length).toBe(boot.buildings.length);
    const idsBefore = new Set(boot.buildings.map((b) => b.id));
    const idsAfter = new Set(result.buildings.map((b) => b.id));
    expect(idsAfter).toEqual(idsBefore);

    // The buildings reconcile actually SEATED (i.e. not in `unplacedIds`)
    // must be collision-free — that is the whole point of reconciling.
    const unplaced = new Set(result.unplacedIds);
    const seatedPlotIndices = result.buildings.filter((b) => !unplaced.has(b.id)).map((b) => b.plotIndex);
    expect(new Set(seatedPlotIndices).size).toBe(seatedPlotIndices.length);

    // reconcile itself is a sort + a handful of O(n) passes over ~5,400
    // items — this is a tight guard (not the 1000ms formality round-2
    // flagged), meant to catch a regression from microseconds to something
    // structurally worse.
    expect(elapsedMs).toBeLessThan(200);
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
  // ADDENDUM-08: `dense`'s ~5,400 build attempts vastly exceed the fixed
  // map's 193 ground cells, so the fixture itself already carries many
  // baked-in collisions (devtools/fixtures.ts's own documented overflow
  // ceiling) — "never fires placement_repaired" is no longer the right claim
  // at this scale. What still matters (spec §3.6/§4/§9): the boot stays fast,
  // self-heals silently (no player-facing notice), and drops nothing. The
  // isolated "exactly one duplicate gets repaired" proof lives at controlled
  // scale in `useTownStore.reconcile.test.tsx` instead, where it can actually
  // be isolated from a background of pre-existing collisions.
  it("boots the dense town within a smoke budget, self-heals its own overflow collisions silently, and drops nothing", async () => {
    const fixture = FIXTURES.dense();
    setTimeTravelDate(fixture.today);
    const loaderClient = createChunkedStorage(); // real browser localStorage port — same one useTownStore itself uses
    // ADDENDUM-02 §4.5 — this test is about the reconciler's OWN "silent
    // repair" contract (§3.6 point 6), not the move-hint; the dense fixture
    // has thousands of buildings and an unset `moveHintSeen`, which would
    // otherwise ALSO (correctly — see `useTownStore.move.test.tsx`) queue
    // `{ kind: "moveHint" }` at this same boot. Marking it already-seen keeps
    // this file scoped to reconciliation.
    loadFixtureIntoStorage({ ...fixture, town: { ...fixture.town, moveHintSeen: true } }, loaderClient);
    loaderClient.flush(); // land the debounced writes before useTownStore's own client reads them back

    const start = performance.now();
    await mountAndWaitForBoot();
    const elapsedMs = performance.now() - start;
    console.info(`[AC-R4] dense boot elapsedMs=${elapsedMs.toFixed(1)}`);

    expect(latest?.buildingCount).toBe(fixture.buildings.length); // nothing dropped, even the buildings reconcile couldn't seat
    // `placement_repaired` (analytics) counts buildings actually RE-SEATED,
    // not ones reconcile gave up on (`unplacedIds` — kept, at their stale
    // position, never dropped, per placement.ts's own contract) — at dense
    // scale most of the fixture's ~5,400 build attempts can never fit the
    // 193-cell map at all, so that count may legitimately land at 0. What
    // matters here is that the boot never throws and never surfaces a
    // player-facing notice for a repair the player did nothing wrong to cause.
    expect(latest?.notice).toBeNull(); // silent repair — §3.6 point 6, never a player-facing notice
    // Round-2 asserted a 3,000ms bound against §10.4's <1s AC — three times
    // the actual written number, so the AC as written was never really
    // checked (round-3 finding C4). Asserting the AC's own literal number
    // (1,000ms) instead — measured on this machine (logged above) the real
    // value is comfortably under it, so 1,000ms is not a coin-flip bound, it
    // is the spec's number, with real headroom to spare before it would ever
    // flake on CI.
    expect(elapsedMs).toBeLessThan(1_000);
  });
});
