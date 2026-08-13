> Produced by `planner` (explore mode), scored 92/100 by 기획팀장 (pass mark 90).
> Score history: 89 -> 92. Rounds: 2.
> **Not yet approved by the director** — this is the deliverable to send for approval, not a
> finalized spec (engine VISION.md §4: finalizing a spec requires director approval).
>
> Winning angle: Risk-first, unchanged from the winning proposal: design as if this ships and is maintained for years, optimise against dead ends rather than against today's diff size. Every change in this revision either closes a dead end (the one-step-ahead pool deletes the block-full state by arithmetic; reconcilePlacement now has a real body and a specified persistence path) or removes something the document itself could not stand behind (retracted illustrative code, a break-table row that was wrong about shipped test code, a DOM change taken for convenience). The one place the angle is expressed most sharply is unchanged: no gameplay constant is invented anywhere in this document, and every question that needs a number is routed to the director.

---

# ADDENDUM-02 — 랜덤 배치 & 롱탭 이동 (player-placed buildings) · rev. 2

> Proposed target path: `app_in_toss/docs/spec/ADDENDUM-02-placement-and-move.md`
> Status: **proposal, not approved.** `MVP-SPEC.md` and `ADDENDUM-01` are untouched; the PM merges after the director approves.
> Author: `planner` · 2026-08-04 · Angle: **risk-first** — assume this ships and is maintained for years; optimise against dead ends, not against today's diff size.
> Supersedes, if approved: **ADDENDUM-01 §7 D-31** (the engineering default "placement stays automatic"), **ADDENDUM-01 §3.1**'s closing paragraph, **ADDENDUM-01 §5.5**'s evidence rule (replaced, not waived — §7.4), **MVP-SPEC §5 F2** (placement sentence + AC, `MVP-SPEC.md:215,229,230`), **§8.1**'s `plotIndex` / `nextPlotIndex` field comments (`src/types.ts:76,109`), **§8.3 rule 1** (`MVP-SPEC.md:501`), and **§5 F16**'s "chronological plot order" clause (`MVP-SPEC.md:297` — F16 is not built yet; this is a wording fix ahead of the build).
> **Also requires sign-off for:** one **new MVP-SPEC §7 design invariant** (§6.6, D-39) — §7's own header says violating or adding one needs the director.
> Does **not** amend: F4, F13, F14, F15, the frontage invariant, `plotFromIndex`, `LAYOUT_VERSION`, or anything in the 저축 블록.

**What changed in rev. 2** (round-1 lead findings, all fixed):
1. **The pool is one step ahead** — `openPlotCount` is built from `renderedTileCount(need + 1)`, which *proves* at least one free lot exists at every town size. The "block exactly full ⇒ you cannot move anything" state, its Korean message, and its AC are **deleted, not handled** (§3.2, §3.4).
2. **`allocatePlots` ships its real implementation** — the retracted placeholder version is gone (§3.3).
3. **`reconcilePlacement` ships a body**, and its persistence is specified exactly: which months, in what order, where in the boot chain, and how it interacts with the 300 ms write debounce (§3.6).
4. **Tiles stay `<div>`s.** One delegated listener on `.town-grid` + `aria-activedescendant` roving cursor gives the whole town **one tab stop** at any size, instead of ~5,400 buttons (§4.3, §4.4). Break B23 (button chrome) is deleted with it.
5. **B17 was wrong and is corrected**: `noSpendActions.test.ts` has a `baseArgs` helper at `:25-38` feeding all seven call sites — **one line**, not seven (§7.1, §7.2).
6. **The discoverability hint is MUST**, with a zero-extra-write persistence trick (§4.6). The copy remains the director's (D-36).
7. **Uniform vs street-front-biased randomness is a director decision (D-38)**, not an assumption.

---

## 0. What the director asked, and what this delivers

Verbatim (Discord, 2026-08-04):

> 건물 위치는 유저가 선택할수 있도록 해줘. 최초 건물을 세울땐, 랜덤 위치 건설이고, 그 이후엔 건설된 건물을 롱탭해서 옮길수 있도록

| Ask | Delivered by | Not watered down because |
|---|---|---|
| 최초 건물을 세울땐 **랜덤 위치 건설** | `pickPlot()` — a **uniformly random free lot** among every lot the town currently shows (§3.3). Applies to *every* newly constructed building: entry builds (F2), queue drains (F14), 무지출 공원 (F15), and future 기념비 (F16). | It is real randomness over a real pool (12 candidate lots for the very first building, 12 fresh lots whenever a block opens), not "random within the next row" or a shuffled sequence. `nextPlotIndex++` as a *position* is deleted from the codebase; a grep-checkable rule (R-4) stops it coming back. |
| 그 이후엔 건설된 건물을 **롱탭해서 옮길수 있도록** | `moveBuilding(buildingId, toPlotIndex)` — a real mutation of stored `Building.plotIndex`, reachable by a 500 ms long-press on any building → tap a highlighted lot → done, with 되돌리기 (§4). | Any building can move, any number of times, free of charge, to any free lot in town — and **there is always at least one free lot, at every town size, provably** (§3.2). No slot cost, no daily limit, no "only today's building", no state in which the gesture is dead. The move persists across a hard reload (one storage key written). |

**What the player sees on day one:** they log a coffee and a café appears *somewhere* in the first block instead of always at the top-left. They long-press it, the town dims, every empty lot glows, they tap one, the café hops there, and a 되돌리기 button waits five seconds in case that was a mistake. Nothing about the ≤3-tap entry flow changes — placement happens **after the fact and optionally**, which is how this feature keeps MVP-SPEC F1's entry budget intact while overturning D-31.

---

## 1. How this serves the pillars (`app_in_toss/VISION.md` §2)

| Pillar | Effect |
|---|---|
| **P-a** real habits → visible town | Neutral to positive. The town's *size* is still a pure function of your logging history (§3.4) — it just rounds up one block earlier at exactly 12/24/36 buildings. What changes is that the arrangement is yours, so the town reads as *your* town rather than a printout. |
| **P-b** budgeting less like a chore | **Protected by construction.** The saving flow gains **zero** taps: placement happens without asking. This is the entire reason the design is "random now, rearrange later" rather than "pick a lot on every save" — the second version puts a decision inside every logged coffee, which is what D-31 rejected and which this addendum still rejects. |
| **P-c** casual "watch something grow" | The biggest win, and the reason this is worth its risk. Rearranging a town you own is the classic endowment loop (Fortune City's retention comes as much from fiddling with the city as from logging). It is the first mechanic in the app that gives the player something to *do* with the town instead of only looking at it — and it costs no new content, no new art, no new balance number. |
| **P-d** Toss-native | Unchanged. Still CSS grid + SVG, still portrait, still no canvas, no SDK call, no new dependency. The gesture is pointer events + one timer + one delegated listener. |

**Gamification note (why this is not just a settings feature):** the long-press move is an *agency* mechanic layered on an existing reward, not a new reward. It adds no points, no badge, no currency — MVP-SPEC §7's exclusion list (`MVP-SPEC.md:395`) survives untouched. Its motivational driver is ownership/endowment; its cost is one interaction plus one mutable field.

---

## 2. The risk frame — five dead ends this design is shaped against

This is the first change in the project to make a **persisted field mutable**. Everything in §3–§4 is chosen to close one of these:

| # | Dead end | How it kills you in year two | Closed by |
|---|---|---|---|
| **DE-1** | Two buildings on one `plotIndex` | `TownGrid.tsx:58-62` builds `Map<plotIndex, Building>` — a duplicate **silently overwrites**, so one building vanishes from the town *forever* while still counting toward `buildingCount`, tier and 기록. Unreportable, unnoticeable, permanent. | Single-writer rule R-4 + `moveBuilding` rejecting occupied targets + **`reconcilePlacement()` self-repair at boot** (§3.6) + a dev-mode duplicate assertion in `TownGrid`. |
| **DE-2** | A building placed outside the rendered grid | It is simply invisible; nothing errors. Reachable via F12 import, corrupt-core recovery, or a future block-geometry change. | `openPlotCount()` is defined so its result is **always > every occupied index**, proved arithmetically in §3.2 for any block geometry, and `TownGrid` renders exactly that many lots. |
| **DE-3** | `Math.random()` inside domain logic | Placement becomes untestable and unreproducible; a director bug report ("건물이 겹쳤어요") can never be replayed. Also blocks any seeded-fixture QA. | `src/platform/random.ts` port, mirroring `src/platform/clock.ts` exactly, plus an eslint ban (R-6) reusing the mechanism that already bans `Date.now()` (`clock.ts:1-8`). |
| **DE-4** | Growth pacing quietly coupled to a new tunable | Any "open N extra lots so there's room to choose" constant is a pacing dial, i.e. a director decision, i.e. a `[TBD]` I am not allowed to invent — and once invented it is load-bearing forever. | The pool is derived from `renderedTileCount`, shipped in T006, with **one structural `+ 1`** whose value is forced by the guarantee it provides, not chosen. **Zero new constants.** §3.2, §3.4. |
| **DE-5** | A field whose name lies (`nextPlotIndex` no longer being "next") | The next maintainer re-derives a position from it and re-introduces sequential placement in one line, undetected. | The stored key keeps its name (**no migration**), but no code anywhere reads it as a position: `applyNewEntry` / `claimNoSpendDay` / `drainQueue` all receive their index as an argument, and the only readers are `openPlotCount()` and the increment sites. R-4's grep is the guard. |

Rules R-1 (`LAYOUT_VERSION`), R-2 (decoration is never persisted) and R-3 (no number in two files) from ADDENDUM-01 §3.5/§3.6 are unchanged and still binding. This addendum adds three:

- **R-4 — single writer.** `Building.plotIndex` is assigned in exactly five places: `entryActions.applyNewEntry`, `noSpendActions.claimNoSpendDay`, `queueActions.drainQueue`, `placement.moveBuilding`, `placement.reconcilePlacement` — and the first three receive the value as a parameter, computed only by `placement.ts`. Evidence: `git grep -n "plotIndex:" src/ | grep -v "\.test\.\|devtools/"` returns only those five files.
- **R-5 — the pool is what's on screen.** The eligible plot set is exactly the set of plot cells `TownGrid` renders. `placement.ts` may import `townLayout.ts`; `townLayout.ts` must never import `placement.ts`. A player may only place where they can see.
- **R-6 — no silent randomness.** Every random draw goes through `src/platform/random.ts`. `Math.random()` is banned outside that file by the same `no-restricted-syntax` eslint rule that already bans `Date.now()` (MVP-SPEC §10.2, `eslint.config.js`).

---

## 3. Random initial placement

### 3.1 Three concepts, named apart

Today one number does two jobs. It is split (in meaning, not in storage):

| Concept | Where it lives | Mutable? |
|---|---|---|
| **Opened lots** — how far the town has grown | `TownState.nextPlotIndex` (**same stored field, same key, same increments; meaning re-documented**) | monotonic, +1 per placed building, never decremented |
| **The open pool** — which lot indices exist right now | derived: `openPlotCount(town, buildings)` (§3.2) | derived, never stored |
| **Occupancy / position** — which lot a building stands on | `Building.plotIndex` | **mutable** (this is the change), unique among live buildings |

`plotFromIndex` (`selectors.ts:19-23`) and `TOWN_COLUMNS` (`selectors.ts:16`) are **byte-identical and not opened**, exactly as ADDENDUM-01 §3.1 requires. `cellFromIndex` and the whole road layout are untouched. This feature lives entirely in *which index a building holds*, never in what an index means on screen.

### 3.2 `openPlotCount` — one pool, two guarantees, zero new constants

> **Corrected 2026-08-04, after T009 (part a) implementation.** The `requiredLots` code block
> originally here — `Math.max(plotsOpened, highest-occupied-index + 1)` — was wrong: it folds every
> occupied index into the pool unconditionally, so one random draw landing near the top of the
> currently-open block (an ordinary, non-corrupt outcome, not misuse) drags the pool's size to that
> draw's position instead of to the number of buildings actually built. That breaks §3.4's growth
> table, §6.1's F2 AC, and AC-P4 under ordinary random gameplay — confirmed by T009's implementer via
> a 3,000-trial adversarial probe, and independently re-verified by 클라이언트팀장 during scoring. It
> also made `reconcilePlacement` (§3.6) see a false "mismatch" and fire a boot-time write on every
> valid, freshly-randomly-placed town — exactly the case §3.6 point 2 promises zero writes for. The
> corrected version below is what actually shipped (`src/placement.ts`, commit 7043dc7) and is now
> the authoritative text.

Verified against `townLayout.ts:190-206`: `TOWN_COLUMNS = 6`, `BLOCK_ROWS = 2`, so `renderedTileCount(n) = blockCount(n) * 12` and **`renderedTileCount(n)` is the smallest multiple of 12 that is ≥ `max(n, 1)`.**

```ts
// src/placement.ts (NEW) — pure domain. No React, no storage, no Date, no Math.random.
import { renderedTileCount } from "./townLayout";
import type { Building } from "./types";

/**
 * The lot count the growth pool must cover, for a given growth frontier
 * (`plotsOpened`, i.e. `nextPlotIndex`) and the town's CURRENT occupancy.
 *
 * The bump past `plotsOpened` fires ONLY when the frontier-only pool would
 * actually be unsafe for this occupancy: an index it cannot render (DE-2/G1),
 * or so many occupied lots that none would be left free (G2). Both branches
 * are proven safe for ANY (plotsOpened, taken) pair, including
 * adversarial/corrupt ones — see `poolSize`'s doc for the two-line proof.
 *
 * Under the real `pickPlot`/`allocatePlots` pipeline this never fires: every
 * live draw is already bounded by the SAME frontier-only pool it is about to
 * enlarge (`plotsOpened` only ever grows by exactly `+ 1` per placed
 * building — §3.5), so by induction `taken.size <= plotsOpened` and every
 * occupied index is already `< renderedTileCount(plotsOpened + 1)` before
 * this function is asked. It exists to protect the one case that genuinely
 * needs it: a `plotIndex` that did NOT come from this pipeline — an F12
 * import, hand-edited storage, or a corrupt-recovery survivor
 * `reconcilePlacement` chose not to re-seat because it was a valid, unique,
 * non-negative integer (just an implausibly large one).
 */
export function requiredLots(plotsOpened: number, taken: ReadonlySet<number>): number {
  const frontier = Math.max(plotsOpened, 0);
  const framedPool = renderedTileCount(frontier + 1);
  let highest = 0;
  for (const i of taken) if (Number.isInteger(i) && i >= 0) highest = Math.max(highest, i + 1);
  if (highest > framedPool || taken.size >= framedPool) return Math.max(highest, taken.size);
  return frontier;
}

/**
 * Every plot index the town currently shows — the single pool used by
 *   (a) a new building's random landing spot,
 *   (b) a move's legal destinations, and
 *   (c) TownGrid's tile count.
 * One definition, three consumers (rule R-5).
 *
 * The `+ 1` is not a tunable and not a "spare lots" pacing dial (DE-4): it is
 * exactly what buys the two guarantees below, and any other value breaks one
 * of them. With need = requiredLots(...):
 *
 *   G1 (DE-2, nothing invisible): renderedTileCount(m) >= m for all m >= 0, so
 *       openPlotCount >= need + 1 > need > every occupied index. No building
 *       can ever sit outside the rendered grid — including one that arrived
 *       from an F12 import, from corrupt-core recovery, or from a future change
 *       to BLOCK_ROWS / TOWN_COLUMNS.
 *
 *   G2 (there is ALWAYS somewhere to put a building): occupied indices are
 *       distinct integers in [0, need), so |occupied| <= need < need + 1 <=
 *       openPlotCount. Therefore the free-lot count is >= 1 at EVERY town
 *       size, forever. This is what deletes the "block is exactly full, you
 *       cannot rearrange anything" state (§3.4) — by arithmetic, not by a
 *       message.
 *
 * Idempotent enough for TownGrid: gridRowCount(openPlotCount(n, …)) ===
 * gridRowCount(n + 1), because blockCount(renderedTileCount(m)) === blockCount(m).
 */
export function poolSize(plotsOpened: number, taken: ReadonlySet<number>): number {
  return renderedTileCount(requiredLots(plotsOpened, taken) + 1);
}

/** Fresh, mutable Set — callers may add to it (allocatePlots does). */
export function occupiedPlots(buildings: readonly Building[]): Set<number> {
  const taken = new Set<number>();
  for (const b of buildings) taken.add(b.plotIndex);
  return taken;
}

export function openPlotCount(plotsOpened: number, buildings: readonly Building[]): number {
  return poolSize(plotsOpened, occupiedPlots(buildings));
}

/** Free lots, ascending. Bounded by the pool, so O(open lots) — ~5,412 on the dense fixture, one pass per save. */
export function freePlots(plotsOpened: number, buildings: readonly Building[]): number[] {
  const taken = occupiedPlots(buildings);
  const limit = poolSize(plotsOpened, taken);
  const out: number[] = [];
  for (let i = 0; i < limit; i++) if (!taken.has(i)) out.push(i);
  return out;
}
```

### 3.3 `pickPlot` / `allocatePlots` — the placement algorithm, complete and shippable

```ts
/**
 * Where a NEWLY CONSTRUCTED building lands: a uniformly random free lot in the
 * open pool. `taken` is the occupancy BEFORE this building.
 *
 * By G2 the pool is never empty, so the fallback below is unreachable for any
 * occupancy `reconcilePlacement` has accepted (i.e. all of them — it runs at
 * boot). It exists only so a save can NEVER throw on pathological input: a
 * throw here loses a real ledger entry, the one failure this app may not have.
 * `requiredLots(...)` is free by definition (every valid index is below it) and
 * inside the pool by G1, so the fallback is a correct answer, not a shrug.
 */
export function pickPlotIn(plotsOpened: number, taken: ReadonlySet<number>, rng: () => number): number {
  const need = requiredLots(plotsOpened, taken);
  const limit = renderedTileCount(need + 1);
  const pool: number[] = [];
  for (let i = 0; i < limit; i++) if (!taken.has(i)) pool.push(i);
  if (pool.length === 0) return need;
  const r = Math.min(Math.max(rng(), 0), 0.999_999_999); // rng() === 1 must not index past the end
  return pool[Math.floor(r * pool.length)];
}

export function pickPlot(plotsOpened: number, buildings: readonly Building[], rng: () => number): number {
  return pickPlotIn(plotsOpened, occupiedPlots(buildings), rng);
}

/**
 * N distinct lots for one F14 queue drain — no two drained buildings may
 * collide, and each must be legal at the moment it is drawn. `plotsOpened + k`
 * is what lets the k-th drained building see the block its predecessor opened.
 */
export function allocatePlots(
  plotsOpened: number,
  buildings: readonly Building[],
  count: number,
  rng: () => number,
): number[] {
  const taken = occupiedPlots(buildings); // fresh Set — safe to mutate
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const idx = pickPlotIn(plotsOpened + k, taken, rng);
    taken.add(idx);
    out.push(idx);
  }
  return out;
}
```

Cost: `O(count × pool)`, and `count ≤ dailyBuildSlots` (a single-digit balance value). Nothing here retracts anything; this is the implementation, not a sketch.

**The random port** (`src/platform/random.ts`, NEW) mirrors `src/platform/clock.ts` line for line, including the dev/test override, because that pattern is already proven in this repo (`useTownStore.test.tsx:48,56` uses `setTimeTravelDate`):

```ts
/**
 * random port — the ONLY file allowed to call Math.random() (rule R-6,
 * enforced by the same eslint no-restricted-syntax rule that bans Date.now()).
 * Everything random in the app — plot choice, variantIndex, id suffixes —
 * comes through here, which is what makes a town reproducible for a bug report.
 */
export interface RandomPort { next(): number; } // [0, 1)

let override: (() => number) | null = null;
export const browserRandom: RandomPort = { next: () => (override ?? Math.random)() };
export const random: RandomPort = browserRandom;

/** Dev/test only: pin the sequence. `null` restores Math.random. */
export function setRandomOverride(fn: (() => number) | null): void { override = fn; }

/** Deterministic driver for fixtures/QA — the same mulberry32 `devtools/fixtures.ts:60` already ships. */
export function seededRandom(seed: number): () => number { /* mulberry32 */ }
```

**Why this makes the compatibility story almost free:** `setRandomOverride(() => 0)` makes `pickPlot` return `pool[0]`, i.e. **the lowest free index** — which on a fresh town is exactly today's sequential behaviour. Every existing positional assertion in `useTownStore.test.tsx` survives verbatim behind one added setup line (§7).

### 3.4 Growth and the gap question — answered: **block-quantised pool, no permanent gaps, always a free lot**

The brief asks explicitly which of two valid designs to take. **Chosen: the town still grows by exactly one lot-worth of frontier per build, and every opened lot is eventually filled. Gaps are temporary, never permanent.**

| Buildings placed (= `nextPlotIndex`) | Pool = `renderedTileCount(n + 1)` | Free lots | Same as before this feature? |
|---|---|---|---|
| 0 | 12 | 12 | yes (`renderedTileCount(0)` is also 12) |
| 1 … 11 | 12 | 11 … 1 | yes |
| **12** | **24** | **12** | **no — one block (~184px) opens one build early** |
| 13 … 23 | 24 | 11 … 1 | yes |
| **24** | **36** | **12** | **no — same one-build-early rounding** |

- **Town size after N buildings is still a pure function of N** — `renderedTileCount(N + 1)`. Pacing, scroll length, tier feel and the dense-fixture perf budget all move by at most one block, and only at the instant `N` is a multiple of 12.
- **The price, stated exactly:** at N = 12/24/36 the town shows one extra block of empty lots — 2 plot rows (`TILE_HEIGHT_PX` 72 each) + 1 cross street (`ROAD_HEIGHT_PX` 22) + 3 gaps (`GRID_GAP_PX` 6) ≈ **184px** of empty ground, for one build. That is the whole cost of G2.
- **What it buys:** the player can *always* rearrange. There is no recurring, designed-in state in which the director's second requirement silently does not exist. A feature that stops working every twelfth building is a feature that will be reported as a bug.
- **F3's "readable picture of your spending" survives, and this is the argument for it:** what F3 promises is that the town's *extent* is your logging history made visible. Extent stays a function of history alone (§6.6 proposes making that a written invariant). What becomes unreadable is the *order within a block* — you can no longer tell which of twelve buildings came first by looking. That reading was never in an AC, and it is exactly what the director asked to hand to the player.
- **Why not "leave permanent gaps":** opening extra blocks so there is "room to choose" would need a pacing constant I am not allowed to invent (DE-4), would decouple town size from history, and would leave a two-year-old town looking abandoned.

### 3.5 Where the index is computed (call-site diff)

| Producer | Today | After |
|---|---|---|
| Entry build (`entryActions.ts:128`) | `plotIndex: town.nextPlotIndex` | `plotIndex: args.plotIndex` — supplied by `useTownStore`, exactly as `variantIndex` already is (`useTownStore.ts:291`) |
| Queue drain (`queueActions.ts:46-57`) | `let plotIndex = town.nextPlotIndex; … plotIndex++` | new **required** last parameter `allocatePlotIndices: (count: number) => number[]`, called once with `drainCount` |
| 무지출 공원 (`noSpendActions.ts:47`) | `plotIndex: town.nextPlotIndex` | `plotIndex: args.plotIndex` |
| 기념비 F16 (not built) | — | same shape; ADDENDUM-02 is written before F16 so it never ships sequential |

The `nextPlotIndex + 1` increments (`entryActions.ts:145`, `queueActions.ts:73` via `plotIndex`, `noSpendActions.ts:59`) keep their **arithmetic** — the counter still advances by exactly one per placed building. `queueActions.ts:73` changes form only (`nextPlotIndex: town.nextPlotIndex + drainCount` instead of the mutated cursor), with the same value. `drainQueue` receives an injected *allocator* rather than an rng, so a test can pass `(n) => [5, 6, 7]` and keep `queueActions.test.ts:45`'s exact expectation green (§7). The parameter is **required, not optional-with-a-sequential-default** — a default is DE-5 wearing a hat.

### 3.6 `reconcilePlacement` — the self-healing boot pass, with a body and a persistence contract

This is the year-two insurance and the single highest-value item in the document, so it ships as code, not as prose.

```ts
export interface ReconcileResult {
  /** Same order and same object identities as the input, except repaired entries. Identical reference when repaired === 0. */
  buildings: Building[];
  /** >= buildings.length and > every plotIndex. */
  plotsOpened: number;
  repaired: number;
}

/**
 * Deterministic by (createdAt, id, array position), so two devices repairing
 * the same corrupt export land on the same town. Keyed by POSITION, never by
 * id, so duplicate ids cannot collapse two buildings into one.
 * O(n log n) for the sort + O(n) passes; ~5,400 buildings on the dense fixture
 * is microseconds, inside the <1s first-paint budget (MVP-SPEC §10.4).
 */
export function reconcilePlacement(plotsOpened: number, buildings: readonly Building[]): ReconcileResult {
  const order = buildings.map((_, pos) => pos).sort((x, y) => {
    const a = buildings[x], b = buildings[y];
    return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : x - y);
  });

  const taken = new Set<number>();
  const losers: number[] = [];
  for (const pos of order) {
    const i = buildings[pos].plotIndex;
    if (Number.isInteger(i) && i >= 0 && !taken.has(i)) taken.add(i); // earliest claimant keeps the lot
    else losers.push(pos);                                            // duplicate, NaN, negative, fractional
  }

  let repaired = 0;
  const fixed = buildings.slice() as Building[];
  let cursor = 0;
  for (const pos of losers) {
    while (taken.has(cursor)) cursor++;
    taken.add(cursor);
    fixed[pos] = { ...buildings[pos], plotIndex: cursor };
    repaired++;
  }

  const highest = requiredLots(0, taken);
  return {
    buildings: repaired === 0 ? (buildings as Building[]) : fixed,
    plotsOpened: Math.max(plotsOpened, buildings.length, highest),
    repaired,
  };
}
```

**Persistence contract — exact, because "the store rewrites the affected chunks" is not a spec:**

1. **Where in the boot chain.** In `useTownStore`'s boot effect (`useTownStore.ts:223-240`), immediately after `loadBoot()` resolves and **before** `drainQueueAndPersist` — the drain allocates lots and must see a sane occupancy. Input: `core.town.nextPlotIndex`, `boot.buildings`. Output feeds the drain.
2. **When nothing is wrong** (`repaired === 0` **and** `plotsOpened === core.town.nextPlotIndex`): **zero writes.** The returned array is the same reference, so the store also skips the state copy. This is the case for 100% of real towns today (§7.3).
3. **Which months, when something is wrong.** Only months that actually contain a repaired building: `new Set(repairedBuildings.map(b => b.builtOn.slice(0, 7)))`. For each, in **ascending `ym` order** (deterministic, greppable in a port spy), one `storageClient.saveBuildingsForMonth(ym, reconciled.filter(b => b.builtOn.slice(0,7) === ym))` — rebuilt from the reconciled in-memory array, never read-modify-write (`loadBoot()` already read every chunk into memory: `storage.ts` buildings pass at `:196-203`).
4. **Core.** `saveCore` is called only if `plotsOpened !== core.town.nextPlotIndex`. A repair that only moves buildings does not touch core.
5. **Debounce.** These writes go through the same buffered/debounced port every other write uses (~300 ms), and are **not** force-flushed. Safe by construction: `reconcilePlacement` is deterministic and idempotent, so a repair lost to a hard kill is recomputed identically on the next boot. The existing `pagehide` flush (`useTownStore`, used by `useTownStore.test.tsx:98`) covers a normal exit.
6. **No player-facing notice.** They did nothing wrong and can do nothing about it. `analytics.track("placement_repaired", { count })` only (browser driver = `console.debug`; nothing leaves the device — `src/platform/analytics.ts`). Explicitly **not** a `Notice`, so it can never collide with ADDENDUM-01 §3.6's relayout toast.
7. **F12 import (future task) must call it** on imported state before committing. Recorded here so that task inherits the requirement.

---

## 4. Move via long-press

### 4.1 The operation

```ts
export type MoveRejection = "not-found" | "same-plot" | "out-of-town" | "occupied";

export type MoveResult =
  | { ok: true; buildings: Building[]; from: number; to: number }
  | { ok: false; reason: MoveRejection };

/**
 * The ONLY mutator of Building.plotIndex outside placement-time (rule R-4).
 * Pure: returns a new array with exactly one building's plotIndex replaced.
 * Never throws, never mutates an input, and touches NOTHING else on the
 * building — not id, source, categoryId, variantIndex, builtOn or createdAt.
 */
export function moveBuilding(
  plotsOpened: number,
  buildings: readonly Building[],
  buildingId: string,
  toPlotIndex: number,
): MoveResult;
```

| # | Rule | Reason |
|---|---|---|
| V1 | The building must exist in `buildings` → else `not-found` | Guards a stale `movingId` after a delete/boot race |
| V2 | `to === building.plotIndex` → `same-plot` | UI treats it as "cancel", not as an error |
| V3 | `Number.isInteger(to) && 0 <= to < openPlotCount(plotsOpened, buildings)` → else `out-of-town` | **You may not move into ground the town has not grown into.** Otherwise a player pushes one building far down and permanently inflates the town's rendered size, breaking the promise the whole app rests on (§3.4, §6.6). This is D-37 if the director disagrees. |
| V4 | No other building may hold `to` → else `occupied` | DE-1. Ships as a rejection, not a swap — D-34. |
| V5 | **Frontage needs no check.** | Every plot index maps through `cellFromIndex` to a cell with a road neighbour — ADDENDUM-01 §3.3's invariant, already asserted in `townLayout.test.ts`. Since every destination is a plot index, **a move cannot violate the frontage invariant, ever.** AC-M11 re-asserts it over the whole open pool at three town sizes so the two modules stay welded. |
| V6 | **Savings cells are unreachable.** | A destination is a *plot index*; savings structures have no plot index and live on cells outside the image of `cellFromIndex` (`townLayout.ts:139-154`'s `+ TOWN_HEAD_ROWS` term; ADDENDUM-01 §2.1's disjointness arithmetic). Structural, not a rule anyone must remember. |
| V7 | Every kind of building is movable — entry, 공원(F15), 기념비(F16) | A type-based exception is a permanent branch plus a "why can't I move this?" explanation UI. Uniform is cheaper to keep true. D-35 if the director disagrees. |

**There is no "no free lots" branch.** By G2 (§3.2) the free-lot count is ≥ 1 at every town size, so long-press always has somewhere to go. Rev. 1's `옮길 빈 자리가 없어요` message and its AC are deleted.

### 4.2 What persists — exactly one storage key

```ts
// useTownStore.moveBuilding — the persistence half
const result = moveBuilding(prev.town.nextPlotIndex, prev.buildings, id, to);
if (!result.ok) return result;

const moved = result.buildings.find((b) => b.id === id)!;
const ym = moved.builtOn.slice(0, 7);           // the building's OWN month chunk, not today's
storageClient.saveBuildingsForMonth(ym, result.buildings.filter((b) => b.builtOn.slice(0, 7) === ym));
```

Four deliberate properties:

1. **The chunk is rebuilt from memory, not read-modify-written.** `loadBoot()` reads every buildings chunk into `state.buildings` (`storage.ts:196-203`), so filtering memory by month reproduces that chunk exactly — and it is idempotent and self-correcting, where `mutateBuildingsForMonth` (`useTownStore.ts:102-109`) would silently no-op if the id had drifted out of the stored chunk (a move that looks fine until reload).
2. **Core is not written.** `nextPlotIndex` does not change on a move; nothing else in `TownState` does either. F10's "one entry save writes exactly two keys" AC is untouched, and a move gets its own AC: **exactly one key** (`registerMonth` is a no-op for an already-registered month — `storage.ts:279`).
3. **A move is not a build-producing act.** No slot, no streak (`advanceStreak` is not called), no tier check, no queue interaction, no `justBuiltId`, no `builtOn` change. §5 states this per feature.
4. **A building whose month chunk was quarantined at boot** (`storage.ts:199-200`) is not in `state.buildings`, so it is not on screen and cannot be long-pressed. Consistent by construction.

### 4.3 The interaction, concretely — one delegated listener, one tab stop

Rev. 1 turned every tile into a `<button>`. That is reverted: **tiles stay `<div>`s** (`TownGrid.tsx:79-90` unchanged in element type), ADDENDUM-01's grid structure is untouched, and there is no button-chrome CSS reset to get wrong.

**New hook `src/hooks/useTileGestures.ts`** — attached **once** to the `.town-grid` container, resolving targets by `(e.target as HTMLElement).closest("[data-plot-index]")`:

```ts
export const LONG_PRESS_MS = 500;            // platform interaction default (assumption; director may retune — not a balance dial)
export const LONG_PRESS_TOLERANCE_PX = 8;    // same
```

Contract, each line of which exists because of a known WebView failure:

- `pointerdown` on a tile starts a timer. **Do not `preventDefault()`** — that kills the town's vertical scroll.
- `pointermove` beyond 8 px, or `pointerup` / `pointercancel` / `scroll` / `blur` before 500 ms → cancel. The town must stay scrollable through a building.
- `.town-grid` gains `touch-action: pan-y`; `.town-tile` gains `user-select: none` and `-webkit-touch-callout: none` (**neither exists in `App.css` today** — verified; this is an addition, break B23).
- `contextmenu` on the grid → `preventDefault()` (Android WebView otherwise pops the system menu at ~500 ms and eats the gesture).
- On fire: `haptics.trigger(...)` (port exists, no-op on desktop — `src/platform/haptics.ts`) and **set a `suppressNextClick` ref**. A long-press is followed by a real `click` on the same element; without the guard, entering move mode immediately re-handles the same tap as a destination/cancel. This is the most likely silent bug in the feature (B22).
- **Why delegation:** one listener set instead of ~5,400, and — critically — no per-tile callback props, so `TownGrid.tsx:67-94`'s `tiles` `useMemo` keeps its current dependency shape for all pointer interaction. Its deps gain `movingId` and `cursorIndex` only.

**Keyboard / AT — one tab stop for the entire town, at any size:**

- `.town-grid` itself gets `tabIndex={0}`, `role="group"`, `aria-label="마을 지도"`, and `aria-activedescendant={cursorIndex === null ? undefined : "plot-" + cursorIndex}`. Each tile gets `id={"plot-" + i}` and `data-plot-index={i}`. **No tile ever gets `tabIndex`.** A dense town therefore has exactly one tab stop, which is the fix for rev. 1's admitted a11y weakness.
- `cursorIndex` starts `null` (pointer users never pay for it) and is set on the first arrow key.
- Arrow keys move the cursor: **left/right = ±1 in index space** (a screen-adjacent lot, guaranteed by F2's serpentine AC — index 6 is directly below index 5), **up/down = one plot row**, computed as `indexFromPlot({ row: row ∓ 1, col })` using the existing exact inverse `indexFromPlot` (`townLayout.ts:134-137`) — no new geometry math.
- `Enter`/`Space` on a building enters move mode; in move mode it commits to the cursor lot; `Escape` cancels.

**Move mode** — state lives in `App.tsx` as `moving: { id: string; from: number } | null`. Ephemeral, never persisted (a reload lands in the normal town, which is the correct and cheapest behaviour).

| Step | Behaviour |
|---|---|
| Enter | Long-press (or Enter) a building → `moving` set → haptic → `analytics.track("move_started")`. The FAB hides (prevents a second `useBackGuard` history entry stacking under the entry sheet). |
| During | `.town-grid--moving` on the container. The moving tile gets `.town-tile--moving` (lifted, `aria-selected="true"`). Every **free** lot in the open pool gets `.town-tile--droppable` (glow) and `role="button"` + `aria-label="빈 터, 여기로 옮기기"`. Occupied lots and the road are inert. The town still scrolls normally. |
| Bar | A fixed bottom bar `.town-move-bar` (rendered in `App.tsx`, **outside `.town-grid`** so ADDENDUM-01 §2.4a's direct-children guard is untouched): "옮길 자리를 골라주세요" + [취소]. |
| Commit | Tap a droppable lot → `store.moveBuilding(id, i)` → mode exits → the bar switches to "건물을 옮겼어요" + [되돌리기] + [완료], auto-hiding after ~5 s. 되돌리기 calls the same `moveBuilding(id, from)` — one operation, no undo stack, no new persistence. |
| Reject | Tapping an occupied lot shows an inline hint in the bar ("이미 건물이 있는 자리예요"); mode stays open. |
| Cancel | [취소], `Escape`, tapping the moving building again, or Android/gesture back via **`useBackGuard(moving !== null, false, cancel)`** — the hook already exists and is tested (`hooks/useBackGuard.ts:19`), and is the repo's proven WebView-safe way to consume one back press. |
| Guard | An effect clears `moving` if that building is no longer in `store.buildings` (deleted, or a boot re-entry). |

**Memoisation:** `TownGrid` is `React.memo` (`TownGrid.tsx:147`). The new callback props **must** be `useCallback`-stable in `App.tsx`, or every unrelated render rebuilds the whole tile array — the exact trap ADDENDUM-01 §2.4 rejected a `ReactNode` prop over. `movingId` and `cursorIndex` are primitives and memo-compare fine.

### 4.4 DOM contract (for `ui-ux` and the `[dom]` ACs)

`.town-tile` remains a `<div>`, still one direct child of `.town-grid`, still carrying the same inline `gridColumn`/`gridRow` and `town-tile--left/right` classes, so every existing `TownGrid.test.tsx` assertion holds:

```html
<div id="plot-7" data-plot-index="7"
     class="town-tile town-tile--left town-tile--droppable"
     role="button" aria-label="빈 터, 여기로 옮기기"
     style="grid-column:2; grid-row:4">…</div>
```

| Class / attr | When | Read by |
|---|---|---|
| `data-plot-index`, `id="plot-N"` | always | delegation target resolution, `aria-activedescendant`, AC-M6/AC-P8, and QA's fastest way to verify randomness without pixels |
| `role="button"` + `aria-label` | building tiles always; empty tiles only while droppable | AT; never on inert ground |
| `.town-tile--moving` | `movingId === building.id` | AC-M5 |
| `.town-tile--droppable` | move mode ∧ lot free | AC-M6 |
| `.town-tile--cursor` | `cursorIndex === i` | keyboard AC-K1 |
| `.town-move-bar` | move mode, or ≤5 s after a move — **in `App.tsx`, not in the grid** | AC-M7 |

### 4.5 What the player must be told about the gesture — MUST, not SHOULD

A gesture with no affordance is invisible; rev. 1 filed the hint as SHOULD while calling it the feature's biggest gap. Corrected:

- **Mechanism (MUST):** once the town has ≥ 2 buildings and the hint has not been seen, the town screen shows a one-shot hint (existing Notice FIFO, no new UI system). It is dismissed forever by the first successful move or by an explicit dismiss.
- **Persistence (revised, Gate-3 round-3):** `TownState` gains **optional** `moveHintSeen?: boolean`. A successful move still folds it into whatever `saveCore` that move performs anyway (§4.2) — no extra write there. But an **explicit dismiss with no move** now calls `saveCore` directly instead of only flipping the in-memory flag and hoping "the next unrelated save" arrives before the player closes the app. The original zero-extra-write plan assumed that save would show up soon; live playtest showed a player who sees the toast and closes the app with no further action (a completely ordinary session shape, not a hard-kill edge case) got the hint again on every reload — the panel caught this from all five expert lenses in the same run. One small `setItem` on explicit dismiss is worth it to keep the AC-H1 promise ("dismissed forever") true in the common case; a hard kill between "hint seen" and dismiss can still show it once more, same as before.
- **No migration:** the field is optional, so an old core reads `undefined` → falsy → hint eligible. `storage.ts`'s `defaultTownState()` (`:112-120`) is **not** opened.
- **The copy, and whether to show it at all, is the director's (D-36).** What is MUST is that the mechanism cannot be dropped under time pressure; turning it off is then a one-line flag rather than an unbuilt feature.

---

## 5. What explicitly does NOT change

| Thing | Status | Why it is safe to say so |
|---|---|---|
| **F4 daily build-slot cap** | **Untouched.** `slotsRemainingToday`, the reset rule, `slotsUsedOn/Today` — not read, not written by placement or by a move. A move costs no slot and cannot be used to build. | `placement.ts` has no access to slot state; `moveBuilding` returns only a buildings array. |
| **F14 materials queue** | **Untouched** in behaviour: FIFO order, cap, drain timing, "never builds the day it queued", the toast copy, overflow. The only change is that the drained buildings' *positions* come from `allocatePlots` instead of a counter. | `queueActions.ts`'s change is one injected parameter; every other line, including the slot arithmetic at `:71-79`, is identical in value. |
| **F13 저축 / the 저축 블록** | **Untouched, structurally unreachable.** Savings structures have no `plotIndex`, are not in `buildings[]`, render on fixed cells disjoint from `cellFromIndex`'s image. They cannot be long-pressed, cannot be a destination, and are not in the pool. `SavingsRow.tsx`, `savingsBuckets.ts`, `savingsCellFor`, `freeSavingsCells` are not opened. | `townLayout.ts:139-154` + ADDENDUM-01 §2.1's arithmetic, unchanged by this addendum. |
| **The frontage invariant** | **Untouched and now doubly asserted.** Every destination is a plot index; every plot index has road frontage by construction. | §4.1 V5, AC-M11. |
| **The road layout / `LAYOUT_VERSION`** | **No bump.** No layout constant changes, so no building moves on screen and **no "마을에 도로가 새로 놓였어요" toast fires.** Existing towns look exactly as they did. | `townLayout.ts` is read-only for this feature (R-5). |
| **`plotFromIndex`, `TOWN_COLUMNS`, `cellFromIndex`, `indexFromPlot`** | Byte-identical; `indexFromPlot` gains a second caller, not an edit. | R-5; evidence rule §7.4. |
| **F5 tier / F7 streak / F6 mood / F8 기록** | Untouched. A move changes no count and no total. | `moveBuilding` returns only a buildings array; the store's move path calls no selector. |
| **MVP-SPEC §7 invariants 1–5** (`MVP-SPEC.md:389-393`) | All survive verbatim. Invariant 4 ("nothing is destroyed by a financial outcome") is about destruction, not position; a move never shrinks the town. §6.6 *adds* a sixth, it amends none. | Stated so a reviewer does not have to re-derive it. |

---

## 6. Wording changes MVP-SPEC needs (this is the part that contradicts a shipped AC)

### 6.1 F2 — "nothing ever reflows" is directly contradicted. Retire it.

**`MVP-SPEC.md:229` today:** *"`plotIndex` is monotonic and never reused. Deletion leaves a permanent empty lot; nothing ever reflows."*

**Proposed replacement:**

> `plotIndex` is a **position, not an identity**: it is unique among live buildings, it may be changed by the player (F2b), and the lot a deleted building leaves returns to the free pool. `town.nextPlotIndex` is still incremented by exactly one per placed building, but it counts **opened lots (the town's growth frontier)**, not the next position.
> **The app never moves a building.** Only the player moves a building, one at a time, by long-press, and every move is immediately undoable. Nothing reflows as a side effect of building, deleting, draining the queue, or settling a month.

That second paragraph is the honest successor to "nothing ever reflows": what the original sentence protected was *the player's trust that the town does not rearrange itself behind their back*, and that promise is kept in full. What it is not is "plotIndex is write-once", and pretending otherwise would be the failure mode this project is named against.

**`MVP-SPEC.md:215` (F2 body)** — replace `plot = plotFromIndex(town.nextPlotIndex++)` with: `plotIndex = pickPlot(town.nextPlotIndex, buildings, random.next)` — a uniformly random free lot among the town's open lots (ADDENDUM-02 §3.3); `town.nextPlotIndex += 1`.

**`MVP-SPEC.md:230` (F2 AC)** — replace *"at `plotFromIndex(n)` and nowhere else"* with:

> N-th build-producing act of the day where N ≤ cap → exactly one new building of that category's family, **on a free lot inside the town's open lots, drawn uniformly at random through the random port**; with the port pinned to a fixed seed the chosen index is reproducible. **No two live buildings ever share a plot index** (asserted over 1,000 seeded placements with deletions interleaved). **The number of open lots after N buildings is a pure function of N** (`renderedTileCount(N + 1)`) — random placement changes *where*, never *how much*. Amount never changes the number of buildings. Slot counter survives a full app reload. Building at index 6 is still directly below index 5 (serpentine adjacency, unit-tested on `plotFromIndex` for i = 0..23) — **the mapping is untouched; only which index a building holds is now random.**

### 6.2 F3 — one clause added, AC otherwise unchanged

The empty state, header, dense-fixture budget and scroll preservation are unchanged. Add: *"A newly built building may appear anywhere in the town's open lots, including above the previously newest one; the auto-scroll to the newest building (existing behaviour, `TownGrid.tsx:104-108`) is what makes it findable."* And S2 (§6 screen list) gains a state: **이동 모드** — dimmed town, glowing free lots, bottom bar; entered by long-press, left by 취소 / back / Escape / commit.

### 6.3 F10 — one AC clause added

> **A move writes exactly one storage key** — the moved building's own `builtOn` month chunk (never core, never today's chunk unless they coincide) — verified by a spy on the port. A hard reload shows the building on its new lot.

### 6.4 F9, `types.ts`, §8.3, F16

- **F9 (delete):** behaviour unchanged. AC *"the plot becomes an empty lot, remaining buildings do not shift"* stays **true**. Add: the freed lot rejoins the free pool and a later building may land there.
- **`src/types.ts:76`** — `// monotonic; plot = plotFromIndex(plotIndex) — absolute, never reflows` → `// position on the town grid; unique among live buildings; changed only by the player's move (F2b)`.
- **`src/types.ts:109`** — `// monotonic; deletion leaves a permanent empty lot` → `// opened-lot counter (growth frontier); +1 per placed building, never decremented. NOT the next building's position.`
- **`MVP-SPEC.md:501` (§8.3 rule 1)** — `plotIndex is monotonic and never reused, so nothing reflows on delete` → `plotIndex is unique among live buildings and is written only by placement.ts (rule R-4). A deleted building's lot returns to the free pool; no existing building ever moves on delete.`
- **`MVP-SPEC.md:297` (F16 AC, not yet built)** — *"exactly 3 monuments in chronological plot order"* → *"exactly 3 monuments, chronological by `createdAt`, each on its own random free lot, each engraved with its own `YYYY-MM`."* Flagged now so F16 is never written against the old sentence.
- **Resolved (director, 2026-08-09), now that F16 is built:** chronological placement is implemented but NOT enabled; random placement (R-5 above) remains the shipped behaviour (`MONUMENT_CHRONOLOGICAL_PLOTS`, `settlementActions.ts`).

### 6.5 ADDENDUM-01 §7 D-31 and §3.1

D-31's engineering default ("placement stays automatic; player-chosen placement is not shipped and is not an option in this document", ADDENDUM-01 line 17) is **overturned by the director**, 2026-08-04. The reasoning that produced it is not wrong and is preserved: the ≤3-tap entry budget is why placement is **random-then-rearrangeable** rather than **chosen-at-save**. ADDENDUM-01 §3.1's final paragraph should be replaced with a pointer to this addendum. Everything else in ADDENDUM-01 §3 stands unchanged.

### 6.6 A new §7 design invariant, routed for sign-off (D-39)

V3 (§4.1) is the only thing standing between this feature and the app's core promise, and a validity-table row is easy for a future task to soften without anyone noticing. Proposed as **MVP-SPEC §7 invariant 6** (adding one needs the director's sign-off, per §7's own header at `MVP-SPEC.md:387`):

> 6. **The town's area is a function of how many buildings you have earned, never of where they are put.** Moving a building never grows or shrinks the town; only earning one does.

This is what makes "the town is a picture of your logging history" durable once positions are player-controlled. It also gives D-37 a clear cost: loosening V3 means amending this invariant, not editing a rule.

---

## 7. Compatibility — diff against T002–T007's real shipped code

Every line number and count below was read out of the working tree, not recalled.

### 7.1 Breaks that are real (continuing ADDENDUM-01's B-series)

| # | Break | Cause | Status |
|---|---|---|---|
| **B16** | `entryActions.ts:128` + `ApplyNewEntryArgs` gains required `plotIndex: number` | Placement leaves the domain function | **Real, compile break** (Gate 1 catches). Fix: 1 line in `entryActions.ts`, 1 field in the interface, 1 line in `useTownStore.ts:293-306`, and **1 line in `entryActions.test.ts`'s `callArgs` helper (`:35-51`)** — verified: all 16 `applyNewEntry` call sites in that file (`:56,72,81,90,97,115,134,145,153,172,188,204,229,245,258,285`) go through it, so `plotIndex: 0` there keeps `:59`, `:61`, `:63`, `:75`, `:76`, `:85` green verbatim. |
| **B17** | `noSpendActions.ts:47` + `ClaimNoSpendArgs` gains required `plotIndex: number` | Same | **Real, compile break — and smaller than rev. 1 claimed.** `noSpendActions.test.ts` has a `baseArgs` helper at **`:25-38`** feeding **all seven** call sites (`:42,54,72,76,82,89,96`), so the test change is **one line** (`plotIndex: 0`), not seven object literals. `:46`'s `expect(...plotIndex).toBe(0)` stays green. Source: 2 lines. |
| **B18** | `queueActions.ts:46-57,73` — `drainQueue` gains a required last parameter `allocatePlotIndices: (count: number) => number[]` | A drain places N buildings and they may not collide | **Real, compile break.** 1 source change; **8 call sites** — 7 in `queueActions.test.ts` (`:28,41,62,72,80,93,102`) and 1 in `useTownStore.ts:138-149`. Tests pass `(n) => Array.from({ length: n }, (_, i) => 5 + i)`, so **`:45`'s `toEqual([5,6,7])` and `:48`'s `nextPlotIndex` 8 stay green with no assertion rewritten**; `:30`/`:74`'s `expect(result.town).toBe(town)` early-return identity also holds (the allocator is never called when nothing drains). |
| **B19** | `TownGridProps` (`TownGrid.tsx:47-53`) gains `movingId`, `cursorIndex`, `onPlotLongPress`, `onPlotTap`, `onCursorMove` (all required) | The grid owns the tiles, so it owns the delegated gesture surface | **Real, contained.** `App.tsx:109-114` is the only production call site; `TownGrid.test.tsx`'s `mountGrid` helper (`:51-56`) is one edit. Required (not optional) so a forgetful call site is a compile error, not a dead feature. |
| **B20** | `TownGrid.tsx:64-65` — `renderedTileCount(nextPlotIndex)` / `gridRowCount(nextPlotIndex)` become `openPlotCount(nextPlotIndex, buildings)`-based | A moved/imported building may hold an index ≥ the old tile count → **invisible building** (DE-2); and G2 needs the rendered pool to be the one-step-ahead pool | **Real, and it is a latent-bug fix, not just an adaptation.** **Every existing `TownGrid.test.tsx` assertion still passes** — proof in §7.2. |
| **B21** | `TownGrid.tsx:58-62` — `map.set(b.plotIndex, b)` silently drops a duplicate | DE-1's blast radius | **Not a test break — a silent data-loss amplifier.** Fix: keep the first claimant and, under `import.meta.env.DEV`, `console.error` on collision. Real repair is `reconcilePlacement`; this is the tripwire. |
| **B22** | The `click` that follows a long-press re-enters/exits move mode instantly | Pointer + click event ordering | **Not a test break — the most likely silent UX bug in the feature.** `suppressNextClick` ref in `useTileGestures` (§4.3). AC-M9 is the regression. |
| **B23** | `.town-grid` has **no** `touch-action` and `.town-tile` has **no** `user-select` today (verified in `App.css:151-161`) | Long-press fights scroll and pops the WebView selection/callout menu | **Not a test break — a device-only defect.** Additions: `touch-action: pan-y` on `.town-grid`; `user-select: none` + `-webkit-touch-callout: none` on `.town-tile`; plus the three new state classes. `[qa]` verifies. |
| **B24** | `useTownStore.ts:291`'s `Math.random()` violates rule R-6 once the eslint ban lands | The lint rule is the enforcement of DE-3 | **Real, 1 line** (`random.next()`), plus **1 line in `id.ts`** (same swap, no signature change). Bonus: `variantIndex` and ids become reproducible under a seeded override too. |
| **B25** | `useTownStore.test.tsx`'s positional assertions (`:72,85,86,88,89,104`) would be non-deterministic | Random placement in the store | **Real, and it is two lines:** `setRandomOverride(() => 0)` beside `setTimeTravelDate(TODAY)` at `:48`, and `setRandomOverride(null)` at `:56`. `rng() = 0` ⇒ `pool[0]` ⇒ lowest free index ⇒ **exactly today's sequential behaviour**, so all six assertions stay green unchanged. |

**Net:** three signature changes with **zero rewritten assertions** (B16–B18), one props widening (B19), one latent-bug fix that no test notices (B20), two setup lines (B25), and four silent-defect guards (B21–B24). **Zero data migrations. Zero schema bumps. No `LAYOUT_VERSION` bump.**

### 7.2 Per-file verdict — every file in `src/`, with the traced reason

| File | Verdict | Reason |
|---|---|---|
| `selectors.ts` | **verbatim** | `plotFromIndex`/`TOWN_COLUMNS` not opened; `placement.ts` imports nothing from it |
| `selectors.test.ts` | **verbatim** | its `plotFromIndex` block asserts a mapping this feature does not touch |
| `townLayout.ts` | **verbatim** | read-only: `renderedTileCount`, `indexFromPlot`, `cellFromIndex` are imported, never edited (R-5) |
| `townLayout.test.ts` | **verbatim** | frontage/geometry assertions unchanged; AC-M11 *adds* a test, in `placement.test.ts` |
| `placement.ts`, `placement.test.ts`, `platform/random.ts`, `hooks/useTileGestures.ts` | **new** | §3, §4 |
| `entryActions.ts` | **1 line + 1 interface field** | B16 — `:128` takes the supplied index; `:145`'s `+ 1` untouched |
| `entryActions.test.ts` | **1 line** | `callArgs` (`:35-51`) feeds all 16 call sites; assertions verbatim |
| `noSpendActions.ts` | **1 line + 1 interface field** | B17 — `:47`; `:59`'s `+ 1` untouched |
| `noSpendActions.test.ts` | **1 line** | `baseArgs` (`:25-38`) feeds all 7 call sites; `:46` stays green |
| `queueActions.ts` | **1 param, 2 lines** | B18 — allocator replaces the cursor; `:71-79` slot arithmetic identical |
| `queueActions.test.ts` | **7 lines (one arg each)** | B18 — `:45`, `:48`, `:30`, `:74` assertions verbatim |
| `useTownStore.ts` | **changed** | boot reconcile (§3.6), index supply to three producers, `moveBuilding` action, `Math.random` → port (`:291`), hint flag fold-in |
| `useTownStore.test.tsx` | **2 setup lines** | B25; its six positional assertions verbatim |
| `components/TownGrid.tsx` | **changed** | B19–B21 + `data-plot-index`/`id` + delegated listener attach point |
| `components/TownGrid.test.tsx` | **verbatim (all 11 tests) + 1 helper line** | Traced: the file mounts at `nextPlotIndex` 0, 1 and 13 only. New tile count = `renderedTileCount(n+1)`: `rt(1)=12` vs today's `rt(0)=12`; `rt(2)=12` vs `rt(1)=12`; `rt(14)=24` vs `rt(13)=24` — **equal at all three mount points** (they differ only at multiples of 12 ≥ 12, which no test uses). Rows: `gridRowCount(12)=6` matches `:114`'s `gridRowCount(0)` expectation, `gridRowCount(24)=9` matches `:115`'s `gridRowCount(13)`; `:111`'s span regex therefore still matches. Direct-children formula at `:165-167` computes 22 from `renderedTileCount(0)`, and the component still renders 12 tiles at mount 0 → `22`. `mountGrid` (`:52-54`) gains the five new props. |
| `storage.ts` | **verbatim** | `moveHintSeen` is optional, so `defaultTownState()` (`:112-120`) is not opened; `:348`'s corrupt-recovery `nextPlotIndex = max(plotIndex + 1)` stays correct and is now additionally floor-checked by `reconcilePlacement` |
| `storage.test.ts`, `storage.relayout.test.ts` | **verbatim** | no exact-object assertion involves a plot index; `layoutVersion` already carried from ADDENDUM-01 |
| `useTownStore.relayout.test.tsx` | **verbatim** | its town (`nextPlotIndex: 1`, one building at `plotIndex: 0`) is already consistent → `repaired === 0`, no rewrite, no notice |
| `useTownStore.retention.test.tsx` | **verbatim** | asserts no plot index |
| `balance.placeholder.ts`, `balance.placeholder.test.ts` | **verbatim, not opened** | **no balance constant is added, changed or read by this feature** |
| `App.tsx` | **changed** | move-mode state, 5 props, move bar, `useBackGuard(moving !== null, false, cancel)` |
| `App.css` | **changed** | B23 + `.town-tile--moving/--droppable/--cursor` + `.town-move-bar` |
| `types.ts` | **3 lines** | two comments (`:76`, `:109`) + optional `moveHintSeen?: boolean` on `TownState` (`:107-120`) |
| `id.ts` | **1 line** | B24 |
| `eslint.config.js` | **1 rule extension** | R-6, same `no-restricted-syntax` mechanism that already bans `Date.now()` |
| `devtools/fixtures.ts` | **verbatim** | its sequential `plotCursor` (`:217,290,363,419,469,521,556`) keeps producing valid towns. *(SHOULD: shuffle `dense`'s indices through `seededRandom` so QA sees a realistically scattered three-year town — a few lines, deterministic, no new fixture.)* |
| `SavingsRow.tsx`, `savingsBuckets.ts(.test)`, `EmptyLot.tsx`, `PlaceholderBuilding.tsx`, `EntrySheet.tsx`, `TownHeader.tsx`, `TierCelebration.tsx`, `calendar.ts`, `format.ts`, `hooks/useBackGuard.ts(.test)` | **verbatim** | none is in the placement, occupancy or gesture path; `useBackGuard` gains a caller, not an edit |

### 7.3 Persisted data — a town saved before this change

**It just works, with no migration and no boot-time rewrite.**

- Every stored byte is valid input: a pre-change town has buildings at `plotIndex` 0..N-1 with `nextPlotIndex = N`. That is a legal occupancy set (dense, no duplicates, all inside the pool), so `reconcilePlacement` returns `repaired: 0`, the same array reference, `plotsOpened = N` — and **writes nothing**.
- **No building moves on screen.** No layout constant changed, so no relayout notice and no second "your town moved" message — a real risk this design deliberately avoids after ADDENDUM-01 already spent one.
- **The one visible difference for an existing town:** if it sits at exactly 12/24/36 buildings, one extra block of empty lots appears below it (§3.4). Empty ground appearing is not a relayout: nothing that exists moves.
- **The change is otherwise visible only going forward:** the *next* building lands randomly among the open free lots, and the player can now rearrange the old ones.
- **F12 import (future task) must call `reconcilePlacement` on the imported state.** An export from a future build, or a hand-edited file, is the one realistic source of a duplicate index. Recorded here so that task inherits the requirement.

### 7.4 The evidence rule this feature retires, and its replacement

ADDENDUM-01 **§5.5** currently reads (verbatim, line 1596): *"neither task's Gate-1 evidence may show a diff touching `plotFromIndex`, `TOWN_COLUMNS`, or `nextPlotIndex`'s allocation logic in `selectors.ts` or `entryActions.ts` … Evidence: `git diff -G'plotFromIndex|TOWN_COLUMNS|nextPlotIndex' -- src/selectors.ts src/entryActions.ts` is empty for both tasks."*

**This feature breaks that rule by design** — changing `nextPlotIndex`'s allocation logic in `entryActions.ts` is the whole point. Waiving it would quietly retire the project's best mechanical guard on `plotFromIndex`. It is therefore **replaced by a narrower rule that is still machine-checkable**:

> **ADDENDUM-02 evidence rule.** (a) `git diff -G'plotFromIndex|TOWN_COLUMNS' -- src/selectors.ts` is **empty**, and `git diff -- src/townLayout.ts` is **empty** — the storage mapping and the road layout are still untouchable. (b) In `entryActions.ts`, `noSpendActions.ts` and `queueActions.ts`, the only changed lines mentioning `plotIndex`/`nextPlotIndex` are the **address assignments** (`plotIndex: …`) and, in `queueActions.ts`, the counter's form (`+ drainCount` for `+ 1` repeated). **Every `nextPlotIndex` increment keeps its value** — i.e. `nextPlotIndex` still advances by exactly one per placed building, which `AC-P4` asserts numerically rather than textually. (c) `git grep -n "plotIndex:" src/ | grep -v "\.test\.\|devtools/"` returns only the five files rule R-4 names.

Part (b) is a reviewer-readable allow-list rather than an empty diff, because an empty diff is no longer honest here; part (a) keeps the empty-diff discipline where it still applies, and part (c) is the new guard that replaces what (b) gives up.

---

## 8. Scope, build order, MoSCoW, AC

### 8.1 MoSCoW

**MUST (this feature's definition of done):** `src/platform/random.ts` + R-6 lint rule; `src/placement.ts` (`requiredLots`, `poolSize`, `openPlotCount`, `freePlots`, `pickPlot`, `pickPlotIn`, `allocatePlots`, `moveBuilding`, `reconcilePlacement`); the four producer call-site changes (B16–B18; F16 not yet built); boot reconcile wiring with the §3.6 persistence contract; `useTileGestures` (delegated pointer + keyboard cursor); move mode in `App.tsx` + `TownGrid` (B19–B24); persistence of a move; 되돌리기; back/Escape cancel; **the discoverability hint mechanism (§4.5)**.

**SHOULD:** haptic on grab and on drop; a lift/drop CSS transition; `dense` fixture shuffled for QA.

**COULD (explicitly deferred, none blocked by this design):** continuous drag-to-move; swap two buildings (D-34); multi-select; a "정리하기" auto-arrange.

**WON'T (this addendum):** moving into unopened ground (D-37); moving savings structures; pan/zoom; rotation; any cost, cooldown or cap on moving (D-33).

### 8.2 Build order

One task, after T007, sized like the road task. No dependency on the 저축 블록 task and no shared files, so the two can proceed in either order. Suggested split if the task proves too large for one pass: **(a)** random placement + random port + reconcile (data only; demoable as "buildings now land randomly"), then **(b)** long-press move + hint (UI). (a) is independently shippable and carries all the risk; (b) carries all the interaction fiddliness. **Do not split the other way** — a move feature on top of sequential placement would build the mutation without the reconciler that protects it.

### 8.3 Acceptance criteria

**Placement** — `[unit]` unless marked:
- **AC-P1** With the random port pinned, `pickPlot` returns a lot that is free and inside `openPlotCount`, for 1,000 seeded placements interleaved with deletions.
- **AC-P2** No two live buildings ever share a `plotIndex` across those 1,000 placements.
- **AC-P3** `openPlotCount(n, buildings) > max(n - 1, maxPlotIndex)` for n = 0..600 and for randomised occupancy sets — DE-2's guarantee (G1).
- **AC-P4** Open-lot count after N buildings equals `renderedTileCount(N + 1)` for N = 0..600, and `nextPlotIndex` after N build-producing acts is exactly N — pacing is provably a function of history alone (§3.4, §6.6).
- **AC-P5** **`freePlots(...).length >= 1` for every N = 0..600, and for randomised occupancy sets** — G2, the AC that replaces rev. 1's "no free lots" message.
- **AC-P6** `allocatePlots(_, _, k, rng)` returns k distinct free lots for k = 1..cap, each inside the pool at the moment it is drawn.
- **AC-P7** `rng() = 0` reproduces the pre-change sequential town exactly (0, 1, 2, …) on a fresh town — the compatibility bridge B25 relies on.
- **AC-P8** `pickPlot` never throws, including on an empty buildings array, a `NaN`/negative/fractional `plotIndex`, and `rng()` returning exactly 1.
- **AC-P9** `[dom]` A grid mounted with buildings at scattered indices renders each at `data-plot-index` matching its `plotIndex`, renders no lot twice, and renders exactly `openPlotCount` tiles.

**Move** — `[unit]` unless marked:
- **AC-M1** `moveBuilding` to a free in-town lot returns `ok: true` and a new array whose only difference is that building's `plotIndex`.
- **AC-M2** Occupied → `occupied`; `to === from` → `same-plot`; `to < 0` / `to >= openPlotCount` / non-integer → `out-of-town`; unknown id → `not-found`. Inputs are never mutated.
- **AC-M3** After a move, the building's `id`, `source`, `categoryId`, `variantIndex`, `builtOn` and `createdAt` are identical (`toEqual` on the object minus `plotIndex`).
- **AC-M4** A move changes no `TownState` field: `slotsUsedToday`, `slotsUsedOn`, `streakDays`, `lastActOn`, `highestTierSeen`, `queue`, `nextPlotIndex`, `noSpendDays`, `cumulativeSavingsKrw` all identical.
- **AC-M5** `[dom]` `movingId` set → exactly one `.town-tile--moving`, with `aria-selected="true"`.
- **AC-M6** `[dom]` In move mode, `.town-tile--droppable` count === free-lot count (**always ≥ 1**), no droppable tile holds a building, and none sits on the road column or a cross-street/savings row (re-uses `TownGrid.test.tsx:88-96`'s style read).
- **AC-M7** `[dom]` `.town-grid`'s direct-children count is unchanged from ADDENDUM-01 §2.4a's formula while in move mode — the bar is not a grid child.
- **AC-M8** `[dom]` A 500 ms `pointerdown` with no movement fires the handler once; a 12 px `pointermove` before 500 ms fires it zero times; `pointerup` at 300 ms fires zero times. All through the single delegated listener.
- **AC-M9** `[dom]` The `click` immediately following a fired long-press does not reach the tile handler (B22's regression).
- **AC-M10** `[qa]` Move → force-quit → reopen: the building is on its new lot. A port spy shows **exactly one** key written for the move.
- **AC-M11** For every index in the open pool at three town sizes (12 / 24 / 600), `cellFromIndex(i)` has an orthogonal road neighbour — the frontage invariant re-asserted over the *destination* space.

**Keyboard / a11y** — `[dom]`:
- **AC-K1** The whole grid contributes **exactly one tab stop** at every town size (0, 12, 600 buildings): `.town-grid[tabindex="0"]`, and `container.querySelectorAll('.town-tile[tabindex]').length === 0`.
- **AC-K2** Arrow keys move `aria-activedescendant` between adjacent lots; `Enter` on a building enters move mode; `Enter` on a free lot in move mode commits; `Escape` cancels.

**Hint:**
- **AC-H1** With 2 buildings and `moveHintSeen` unset, the hint appears exactly once; after a successful move it never reappears, and **no storage write is issued by the hint itself** (port spy: zero keys between the hint being satisfied and the next unrelated save).

**Repair / compatibility:**
- **AC-R1** `reconcilePlacement` on a town with two buildings at index 4 re-seats the later one (by `createdAt`, then `id`) at the lowest free lot, leaves the earlier one alone, preserves array order, returns `repaired: 1`, and is idempotent on a second run. Two buildings sharing an `id` are still both preserved.
- **AC-R2** `reconcilePlacement` on a valid pre-change town (indices 0..N-1, `nextPlotIndex = N`) returns `repaired: 0` and **the same array reference** — **no boot write, no notice** (port spy: zero keys at boot).
- **AC-R3** `[qa]` A town saved before this change opens with every building in the same on-screen position as before, and no toast.
- **AC-R4** `[qa]` Load the `dense` fixture (~5,400 buildings): boot with reconcile still paints in < 1 s; entering move mode does not drop frames on the mid-range Android WebView floor.

---

## 9. Open decisions — director's call, not mine

> Nothing below is filled in with a guessed value, and **this addendum introduces no balance constant** (`balance.placeholder.ts` is not opened). `LONG_PRESS_MS = 500` and the 8 px tolerance are platform interaction defaults, in the same category as ADDENDUM-01's layout px — flagged as assumptions, not as dials.

| # | Decision | Ships as | Why it is not mine |
|---|---|---|---|
| **D-33** | **Does moving cost anything?** A slot, a daily move limit, a cooldown, or free and unlimited. | **Free and unlimited** — the only option that invents no number. | Any cost is a pacing/economy constant, i.e. a `[TBD]`, and it changes what the mechanic *means* (a toy you fiddle with vs. a resource you spend). |
| **D-34** | **Should tapping an occupied lot swap the two buildings**, instead of being rejected? | **Reject** (V4). | Now a pure taste call: rev. 1's strongest argument for swap (the block-full deadlock) is gone (§3.2 G2). Cost if yes: one branch in `moveBuilding`, one AC, one more animation. Which one feels right is his read. |
| **D-35** | **Are the 무지출 공원 and the (future) 기념비 movable like everything else, or pinned?** | **Movable, uniformly** (V7). | Pinning them says "these are the app's, not yours", which is a statement about the reward. Also: a pinned building needs a "왜 안 움직여요?" explanation, which is UI he would have to approve anyway. |
| **D-36** | **The hint copy** — proposed: after the second building, "건물을 길게 누르면 옮길 수 있어요", dismissed forever on the first successful move. | The **mechanism is MUST** (§4.5); the **copy, and whether to show it at all**, are his (turning it off is a one-line flag). | It is a message to the player in his voice — the same reason D-26 (the relayout toast) was his. |
| **D-37** | **May the player move a building into ground the town has not grown into yet** (spreading the town out early), or only among the lots already open? | **Only among open lots** (V3). | Loosening it buys expressive freedom and costs the promise §6.6 proposes writing down. If he wants it, it is one changed bound in V3 **plus** an amendment to the new invariant **plus** a new answer for how far "not yet grown" extends — which *would* be a new constant, and therefore his. |
| **D-38** | **Uniform random, or biased toward the street front?** A young town of 5 buildings scattered over 12 lots reads very differently from 5 clustered along the main street. This is the single most visible aesthetic consequence of "랜덤" for the first ~20 buildings. | **Uniform** — the only variant that invents no weight. | A bias needs a weighting number (how much more likely is a street-front lot?), which is a balance dial he owns. It is also a *look* decision, not a mechanic: both versions are equally correct code. If he wants street-front bias, `pickPlotIn` gains a weighted draw over the same pool and nothing else in this document changes. |
| **D-39** | **Sign-off on the new §7 design invariant** (§6.6): "the town's area is a function of how many buildings you have earned, never of where they are put." | Proposed, not written. | MVP-SPEC §7 says adding or violating an invariant needs the director. It is also the sentence that makes D-37 answerable later without re-deriving the argument. |

**Assumptions I did make** (cheap to overturn, all interaction/naming, none of them balance): `LONG_PRESS_MS = 500` and `LONG_PRESS_TOLERANCE_PX = 8`; the ~5 s auto-hide on the 되돌리기 bar; every class name in §4.4; the Korean strings in §4.3; commit-on-tap with undo rather than a confirm step; keeping tiles as `<div>` with `aria-activedescendant` rather than buttons; move mode living in `App.tsx` rather than the store; the hint's trigger being "the second building exists".

**Engineering choices I did make** (mine, recorded so they can be overturned cheaply): the one-step-ahead pool `renderedTileCount(need + 1)` (§3.2); keeping the stored field name `nextPlotIndex` while re-documenting it (DE-5); injecting an *allocator* into `drainQueue` rather than an rng; rebuilding the month chunk from memory on a move rather than read-modify-write (§4.2); `reconcilePlacement` running at boot, repairing silently, position-keyed, debounced not flushed (§3.6); one delegated listener instead of per-tile handlers; `moveHintSeen` as an optional field folded into an existing write; the random port mirroring the clock port; making the new `TownGrid` props required rather than optional.

---

## 10. Trade-offs the author admits

1. **A persisted field becomes mutable, and that is permanently more expensive than the alternative.** Every future feature that touches buildings (F12 import, F16 monuments, a collection album, any future server sync) now has to know that a plot index is a position, not an identity. `reconcilePlacement` is the price paid up front so that the *first* bug in that class is recoverable instead of permanent. If a reviewer wants to cut something from this document, that function is the last thing that should go.
2. **The one-step-ahead pool shows empty ground one build early.** At exactly 12, 24, 36 … buildings the town renders a block that today only appears on the next build — ~184px of empty lots (§3.4). I take that trade knowingly: a visible strip of empty ground for one build is cheaper than a mechanic that dies every twelfth building, and it costs no new constant.
3. **Within a block, the town stops being a chronological record.** You can no longer read "this café came before that bus fare" off the grid. F3's written promise (extent ⇔ history) survives and §6.6 proposes strengthening it; an unwritten pleasure of the current build does not.
4. **Long-press is invisible until told.** The hint is now MUST precisely because of this, but a hint is a weaker teacher than an affordance, and some users will still never find the gesture. Continuous drag-to-move (COULD) would be more discoverable and is deliberately deferred.
5. **Three of this design's most likely defects cannot be caught by Vitest** — the click-after-long-press double-fire, long-press fighting scroll on a real touchscreen, and the new `touch-action`/`user-select` CSS. Same shape as ADDENDUM-01's trade-off 16, same answers: keep constants in a module a unit test can read, assert node counts and classes where geometry is unreachable, hand the rest to `qa` on a real device. AC-M8/M9 cover what jsdom reaches; AC-M10 and the scroll behaviour are `[qa]`'s.
6. **The keyboard cursor rebuilds the tile array on every arrow press.** `aria-activedescendant` buys one tab stop instead of thousands, but `cursorIndex` sits in `TownGrid`'s `tiles` memo, so a dense-town arrow press re-renders ~5,400 tiles. It stays `null` until the first arrow key, so pointer users never pay it; a keyboard user on a three-year-old town will feel it. Fixable later by the same virtualization F3's dense-town item already owes.
7. **`nextPlotIndex` keeps a name that no longer describes it.** I chose a truthful comment plus a grep-checkable single-writer rule over a rename, because a rename touches ~30 references across nine files plus a permanent `??` fallback for old exports — more surface, more risk, same protection. If a schema bump happens for another reason, rename it then.
8. **A move writes a whole month chunk.** On the dense fixture's heaviest month that is a few hundred KB of JSON per move, debounced at 300 ms. Acceptable (moves are rare and deliberate, and the existing entry save already rewrites a month chunk), but it is the one place this feature could feel slow on a three-year-old town, and it is `[qa]`'s AC-R4.
9. **`moveHintSeen` can be lost in a hard kill.** The zero-extra-write trick means the flag rides the next unrelated save; a force-quit in between shows the hint once more. I chose one possible repeat hint over one guaranteed extra write on a path that currently writes nothing.

---

## Trade-offs the author admits

Costs I am accepting, in the order I would defend them:

1. The one-step-ahead pool (the lead's highest-value fix) shows one extra block of empty lots — about 184px, computed from TILE_HEIGHT_PX 72 x 2 + ROAD_HEIGHT_PX 22 + 3 x GRID_GAP_PX 6 — at exactly 12/24/36 buildings, one build earlier than today. I take it: a strip of empty ground for one build is cheaper than a mechanic that dies every twelfth building, and it invents no constant. It also slightly weakens the "town size equals your history" reading (the town now rounds up one block sooner), which is why I route the new invariant wording to the director rather than assuming it.

2. Tiles staying divs with aria-activedescendant instead of buttons fixes the ~5,400-tab-stop problem but puts cursorIndex inside TownGrid's tiles useMemo, so a keyboard arrow press re-renders the whole dense town. Pointer users never pay it (cursorIndex is null until the first arrow key). I judged one tab stop + a keyboard-only perf cost better than thousands of tab stops + a CSS reset on every tile.

3. reconcilePlacement's writes are debounced, not force-flushed. A repair lost to a hard kill recomputes identically next boot because the function is deterministic and idempotent — that property is load-bearing and is asserted (AC-R1 idempotence).

4. moveHintSeen rides the next unrelated core save (zero extra writes), so a force-quit between "hint dismissed" and the next save shows the hint once more. One possible repeat hint beats one guaranteed write on a path that writes nothing today.

5. Within a block the town stops being a chronological record. F3's written promise survives; an unwritten pleasure of the current build does not.

6. plotIndex becomes mutable forever, which every future building-touching feature (F12 import, F16, any sync) inherits. reconcilePlacement is the up-front premium on that.

Deductions handled: block-full state deleted by arithmetic (G2 in section 3.2, proved from renderedTileCount being the smallest multiple of 12 >= n, verified at townLayout.ts:190-206); hint promoted to MUST with P2's zero-write trick; allocatePlots ships its real Set-based body with nothing retracted; reconcilePlacement ships a body plus an exact persistence contract (which months, ascending ym order, position in the boot chain before drainQueueAndPersist, debounce rationale); buttons reverted to divs + delegation; B17 corrected against src/noSpendActions.test.ts:25-38 (one baseArgs helper, seven call sites, one line); uniform-vs-street-front randomness promoted to D-38. Grafted from the losers: P1's one-step-ahead pool and per-file test verdict table, P2's delegated listener, hint-persistence trick, invariant promotion (D-39), and the observation that ADDENDUM-01 section 5.5's evidence rule is retired by this feature — replaced in section 7.4 with a three-part checkable rule rather than waived.
