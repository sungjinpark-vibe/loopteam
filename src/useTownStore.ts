/**
 * S2/S4 state — boots from chunked storage (T002), applies F1+F2 on save,
 * wires the retention layer (F4 daily slot reset, F14 queue drain, F5 tier
 * celebration, F7 streak, F15 무지출 데이 claim/revoke), and now (ADDENDUM-02
 * §3) places every new building on a random free lot instead of a sequential
 * cursor, and self-heals the town's occupancy at boot before anything else
 * touches `plotIndex` (§3.6).
 *
 * Single responsibility: owns the town/buildings/entries state and the
 * mutations this task's UI needs (`addEntry`, `claimNoSpend`). All the actual
 * domain logic lives in `entryActions.ts` / `queueActions.ts` /
 * `noSpendActions.ts` (pure, unit-tested); this hook is only wiring — read
 * boot state, call the pure function, persist the result, re-render.
 *
 * `addEntry`/`claimNoSpend` deliberately do NOT use `setState(prev => ...)`:
 * each is a plain event handler (called once per tap, never from inside a
 * state updater), so it reads `stateRef.current` directly, performs the
 * storage side effects once, then commits a plain next-state value. See the
 * original T003 note on why this matters under `<StrictMode>`.
 *
 * `justBuiltId` is never cleared back to `null` — see T003's original note;
 * unchanged by this task.
 *
 * Only the CURRENT month's entries are kept in state (`state.entries`), per
 * F10's "current month at boot, others on 기록 navigation" — that is exactly
 * enough for F15's `canClaimNoSpend`, which only ever looks at `today`.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyNewEntry, resolveGrowChoice as applyGrowChoice, type EntryDraft } from "./entryActions";
import { buildingForEntry, deleteEntryEffects, editEntryEffects, type EntryEditPatch } from "./historyActions";
import { claimNoSpendDay } from "./noSpendActions";
import { drainQueue } from "./queueActions";
import { settleMonths } from "./settlementActions";
import { isPrimePlotIndex } from "./townLayout";
import {
  placeMany as placeManyPlots,
  placeMonument,
  moveBuilding as movePlacement,
  placeNew,
  reconcilePlacement,
  type MoveResult,
  type Placed,
} from "./placement";
import { makeId } from "./id";
import { analytics } from "./platform/analytics";
import { clock, getTimeTravelDate, subscribeTimeTravel, ymdToDate } from "./platform/clock";
import { random } from "./platform/random";
import { BALANCE } from "./balance.approved";
import {
  buildingCount as countBuildings,
  canClaimNoSpend as selectCanClaimNoSpend,
  expGainFor,
  fuseOf,
  totalLevelOf,
  growCandidates as selectGrowCandidates,
  grownStructures,
  growthScore as computeGrowthScore,
  ladderFor,
  slotsRemainingToday,
  townScale,
} from "./selectors";
import { monthBefore } from "./calendar";
import {
  applyFusion,
  fusePartners,
  fusionChunkWrites,
  remapEntryBuildingRefs,
  repairPendingFusions,
  transferBuildingSku,
} from "./fusionActions";
import { createChunkedStorage, defaultTownState, serializeExport, yieldToMainThread, type CoreState, type ImportResult } from "./storage";
import { applyAward, awardFor, revokeAward, type AwardEvent } from "./economy/awards";
import { defaultEconomyState, NPC_MAX_VISIBLE, NPC_SLOT_SKU, seeds as seedCount, type EconomyState } from "./economy/types";
import type { Building, BudgetSetting, CategoryId, LedgerEntry, MonthSummary, PendingGrowChoice, SavingCategoryId, TownState } from "./types";

interface LoadedState {
  town: TownState;
  buildings: Building[];
  /** Current month only (F10) — sufficient for F15's "any 지출 today?" check. */
  entries: LedgerEntry[];
  /**
   * F8/F9 — every OTHER month's entries the 기록 screen has navigated to so
   * far, loaded lazily one chunk at a time (`ensureMonthLoaded`) and kept
   * here for the session so re-visiting a month doesn't re-read/re-parse its
   * chunk. The CURRENT month deliberately lives in `entries` above, not here
   * — one array per month, never two sources of truth for the same chunk.
   */
  historyEntries: Record<string, LedgerEntry[]>;
  budget: BudgetSetting;
  onboarded: boolean;
  // ADDENDUM-05 (F-ECON / F-BGM) — economy is its own storage key (absent
  // for a pre-economy town, defaulted here at read); `bgmMuted` rides on
  // `budget` (`BudgetSetting`'s own doc comment explains why) rather than
  // getting a field of its own here.
  economy: EconomyState;
}

/** `ym`'s entries from whichever of `entries`/`historyEntries` holds them — `undefined` if that month hasn't been loaded yet (F8's "only the viewed chunk loads"). */
function entriesForMonth(
  state: Pick<LoadedState, "entries" | "historyEntries">,
  ym: string,
  todayYm: string,
): LedgerEntry[] | undefined {
  return ym === todayYm ? state.entries : state.historyEntries[ym];
}

/**
 * ADDENDUM-12 §5 — fusion entanglement: `entry.buildingId` names a fused
 * survivor (catches a remapped post-fusion entry — `remapEntryBuildingRefs`,
 * ADDENDUM-11 §5.4) OR this entry itself founded/grew a now-fused survivor
 * (`buildingForEntry`). Either shape means deleting/amount-editing this entry
 * would silently corrupt the fused tower's EXP (spec §5's table).
 */
function isFusionEntangled(buildings: readonly Building[], entry: LedgerEntry): boolean {
  const viaRef = entry.buildingId !== null ? buildings.find((b) => b.id === entry.buildingId) : undefined;
  if (viaRef && fuseOf(viaRef) > 0) return true;
  const bound = buildingForEntry(buildings, entry.id);
  return bound !== undefined && fuseOf(bound) > 0;
}

/**
 * Guided highlight sequence (건물 건축/레벨업/병합 → 배경 딤처리 → 하이라이트 →
 * 안내 팝업) — the ONE building the town-screen UI should dim-and-lift right
 * now, plus which of the three moments this is (drives the popup copy).
 * `seq` is the same per-event counter `justGrew` already uses (its own doc,
 * ~496): re-triggering the SAME building (e.g. two level-ups in one session)
 * must still produce a fresh scroll/highlight, which a bare `buildingId`
 * change can't guarantee — React sees no change if the id repeats.
 */
export interface Spotlight {
  buildingId: string;
  kind: "built" | "levelUp" | "fused";
  seq: number;
}

export type SpotlightKind = Spotlight["kind"];

/** ADDENDUM-11 §3 — what one committed fusion produced, for the confirming UI's toast. */
export interface FuseBuildingsResult {
  /** The surviving building, `fuse` already incremented — same id, plotIndex and footprint it had before. */
  survivor: Building;
  /** The building that was consumed; already gone from `store.buildings`. */
  consumedId: string;
  /** The survivor's new VISIBLE level (`totalLevelOf`) — 6..10. */
  level: number;
  /** Seeds this fusion actually paid (§5.3); 0 if the award was already granted for this tier. */
  seedsGranted: number;
}

export interface AddEntryResult {
  /** The building placed for this entry, or null when it queued, overflowed, grew, or was a 저축 entry. */
  building: Building | null;
  /** ADDENDUM-04 §5 — the host this save grew instead of building, EXP already added; null unless it actually grew. Lets the UI toast/animate the level-up. */
  grew: Building | null;
  /** True when this save queued a material instead of building today (F14). */
  queued: boolean;
  /** True when the queue was already full — entry saved with no material at all (F14). */
  queueOverflow: boolean;
  /**
   * The queue's length AFTER this save (post-push) — the caller's F14 toast
   * needs N as of after the push (spec §5 F14). Reading `store.queueLength`
   * instead, in the same render that just called `addEntry`, would read the
   * PRE-save value from a stale closure (addEntry is a plain event handler,
   * not a `setState` updater — its state commit hasn't re-rendered yet).
   */
  queueLength: number;
  /**
   * Gate-3-rerun fix (E1, near-every expert: "the 씨앗 economy has no
   * verified earn path"). Seeds WERE already being granted here via
   * `grantSeeds` (build + tier awards) — ADDENDUM-05 §6 F-ECON — but nothing
   * ever surfaced the grant to the player; the balance only ever appeared
   * inside `ShopSheet`, which nobody opens on the turn a grant happens. Total
   * seeds actually paid out by THIS save (0 when nothing was granted, e.g. a
   * grow or a duplicate-tier no-op), so the caller can fold it into the
   * existing build/level-up toast — ADDENDUM-05 §6's own "transient reward
   * toast" surface, not a new competing one.
   */
  seedsGranted: number;
}

// F9's edit-patch shape (now including `type`, round-4 finding C1) lives in
// `historyActions.ts` next to the pure functions that apply it — re-exported
// here so existing importers (`EntryDetailSheet`, `HistoryScreen`) keep
// reading it off `useTownStore`.
export type { EntryEditPatch };

/** `purchaseSku`'s outcome (ADDENDUM-05 §F-ECON shop). `"maxed"` — NPC_SLOT_SKU only: buildings.length + purchasedNpcSlots already saturates NPC_MAX_VISIBLE, so the slot would buy nothing (checked BEFORE any seed deduction). */
export type PurchaseSkuResult = "ok" | "insufficient" | "alreadyOwned" | "maxed";

/**
 * ADDENDUM-12 §9 — the store's edit/delete contract. `entryMutability` is the
 * single source of truth BOTH the UI (to grey things out, §7) and the store
 * itself (`deleteEntry`/`updateEntry`'s own first-line self-check, the real
 * trust boundary — a disabled button is only ever a hint) read.
 */
export interface EntryMutability {
  canEdit: boolean;
  canEditAmount: boolean;
  canDelete: boolean;
  reason: null | "past-month" | "fused";
}

function freshCore(now: number, today: string): LoadedState {
  return {
    // F16 (Gate-3 round-3, unanimous panel finding — TOP FIX every lens
    // gave). `unsettledPeriods(lastSettledPeriod, today)` is EXCLUSIVE of
    // `lastSettledPeriod` itself: it only returns months strictly after it.
    // Seeding `lastSettledPeriod` to THIS period (the founding month) marked
    // the founding month "already settled" before a single entry existed —
    // so when that month later closed, `unsettledPeriods` skipped it forever
    // (it's <= lastSettledPeriod) and the very next month was excluded too
    // (it's the still-open current period). Every fresh install's first
    // month permanently never settled: 0 monuments, no 결산 card, confirmed
    // across three forward month-jumps. Seeding to the month BEFORE the
    // founding month instead means "nothing settled before this town
    // existed" (still true — there IS nothing retroactive to settle on day
    // one, since `unsettledPeriods` also excludes the still-open current
    // month), while leaving the founding month itself eligible to settle
    // once it actually closes.
    town: { ...defaultTownState(), lastSettledPeriod: monthBefore(today.slice(0, 7)) },
    buildings: [],
    entries: [],
    historyEntries: {},
    budget: { monthlyBudgetKrw: null, updatedAt: now, bgmMuted: false }, // F-BGM — "default: ON" (unmuted)
    onboarded: false, // F11 — a genuinely fresh install (boot.core === null) sees the onboarding overlay once
    economy: defaultEconomyState(),
  };
}

/** One human-readable line for F10's "visible one-time notice, never a white screen" — not the raw per-key reasons (those are for debugging, not the player). */
function summarizeCorruption(count: number): string {
  return count === 1
    ? "저장된 데이터 일부가 손상되어 복구했어요."
    : `저장된 데이터 ${count}곳이 손상되어 복구했어요.`;
}

/**
 * A one-shot notice queued for the player — collapses what used to be three
 * parallel `useState`s (corruption / drained-on-boot / tier celebration),
 * each with its own dismisser and, in App.tsx, its own near-identical
 * effect (round-2 finding C3). `App.tsx` renders `kind: "tier"` as the
 * full-screen celebration overlay and every other kind as a toast; only one
 * notice is ever on screen at a time, shown FIFO.
 */
export type Notice =
  | { kind: "corruption"; message: string }
  | { kind: "drained"; count: number }
  | { kind: "tier"; tier: number }
  // ADDENDUM-01 §3.6 — "마을에 도로가 새로 놓였어요" one-time toast, fired when
  // `loadBoot()` detects a pre-existing town's index predates LAYOUT_VERSION.
  | { kind: "relayout" }
  // ADDENDUM-02 §4.5 (D-36, MUST) — the long-press-to-move discoverability
  // hint. Queued at most once per session (see `hintQueuedRef` below); the
  // copy is a placeholder the director may edit.
  | { kind: "moveHint" }
  // ADDENDUM-01 §2.6a — a savings structure just crossed a ladder threshold.
  // `App.tsx` renders it as a toast via `levelUpToastFor(id)`.
  | { kind: "savings"; id: SavingCategoryId }
  // F16 — at least one month was just settled on this boot; carries the MOST
  // RECENTLY settled month's summary for the one-time "지난달 결산" card.
  // Naturally never reappears on reload (idempotent settlement mints nothing
  // further, so no notice is pushed on a later boot) — same reasoning
  // "drained" already relies on.
  // `seedsGranted` — 라이브옵스 PD TOP FIX (Gate-3-rerun): the month's biggest
  // seed grant (`BALANCE.seedAwards.settlementByOutcomeBucket` + prime-lot
  // bonus) used to land with no on-screen line at all. Carried alongside the
  // summary so `SettlementCard` can say what this settlement actually paid,
  // without recomputing the award off stale live state (prime-lot count
  // drifts after the fact; this is the amount awarded AT settlement time).
  | { kind: "settlement"; summary: MonthSummary; seedsGranted: number }
  // Gate-3 follow-up (A2) — the town's FIRST building was just founded. Fired
  // exactly once per town (the guard is `countBuildings(prev) === 0`, so a
  // town that later empties out and re-founds legitimately celebrates again).
  // `App.tsx` renders it with the SAME non-blocking auto-dismissing banner
  // `kind: "tier"` uses (`CelebrationBanner`), never a modal — a blocking
  // celebration was a round-1 Gate-3 failure and must not come back.
  | { kind: "firstBuilding" };

/**
 * Load-modify-save on one month's buildings chunk — the same three-line
 * sequence was open-coded at four call sites (drain, F15 revocation, a
 * normal save's build, a claim's build); factored here so there is exactly
 * one place that knows the chunk round-trip.
 */
function mutateBuildingsForMonth(
  storageClient: ReturnType<typeof createChunkedStorage>,
  ym: string,
  mutate: (existing: Building[]) => Building[],
): void {
  const { buildings } = storageClient.loadBuildingsForMonth(ym);
  storageClient.saveBuildingsForMonth(ym, mutate(buildings));
}

/**
 * ADDENDUM-11 §5.4 — repoints every `LedgerEntry` that referenced `fromId` at
 * `toId`, in whichever month chunks hold them, and returns the patched lists
 * by month so a caller with in-memory entries can fold them in. Empty map when
 * nothing referenced `fromId` — and no chunk is written in that case either
 * (`remapEntryBuildingRefs` returns its input by reference when unchanged).
 *
 * ponytail: reads every known entries chunk, because the index has no
 * buildingId -> month reverse map and inventing one would be a second source
 * of truth for a link `LedgerEntry.buildingId` already holds. Bounded by the
 * months a town has ever logged, and only ever runs on a fusion (a rare,
 * deliberate act) or on a boot that found a `fusePending`. Add an index if
 * fusions ever become frequent.
 */
function remapLedgerRefs(
  storageClient: ReturnType<typeof createChunkedStorage>,
  core: CoreState,
  fromId: string,
  toId: string,
): Map<string, LedgerEntry[]> {
  const patched = new Map<string, LedgerEntry[]>();
  for (const ym of storageClient.entryMonths()) {
    const { entries } = storageClient.loadEntriesForMonth(ym);
    const next = remapEntryBuildingRefs(entries, fromId, toId);
    if (next === entries) continue;
    storageClient.saveEntriesForMonth(ym, next, core);
    patched.set(ym, next);
  }
  return patched;
}

/**
 * F16 settlement (pure `settleMonths`) THEN F14 drain (pure `drainQueue`),
 * persisted together in ONE core write. Runs once, right after boot, before
 * the app is shown.
 *
 * Settlement runs first, in memory — its output `town` (`lastSettledPeriod`
 * already advanced) is what `drainQueue` mutates FURTHER, so
 * whichever `saveCore` call fires below carries both advances at once: there
 * is no intermediate state where settlement happened but the drain (or a
 * crash/reload) could observe a stale `lastSettledPeriod`. Any minted
 * monuments are folded into `buildingsWithMonuments` before the drain picks
 * its own plots/tier score, so a same-boot drain can never collide with a
 * monument's lot or undercount it for F5.
 *
 * Storage side effects (patching each drained material's own `LedgerEntry`,
 * writing new buildings / updated core) mirror what F14 always needed;
 * settlement adds no new write shape, only more buildings in the same
 * `buildYm` chunk write (a monument's `builtOn` is `today`, same as every
 * other building placed this boot, per `settlementActions.ts`).
 *
 * Async and yields to the main thread between chunk writes (§10.4 budget,
 * same discipline `storage.ts`'s `readBuildingChunksBatched` already uses)
 * instead of running the whole patch-then-write sequence in one blocking
 * pass — `materialQueueMax` bounds it, but a full month's entries/buildings
 * chunk can still be large.
 *
 * Each drained material's own `LedgerEntry` chunk is located via
 * `material.entryYm` (the entry's `occurredOn` month, carried on
 * `QueuedMaterial` since round 2) — NOT `queuedOn`'s month, which is only
 * the same chunk when the entry wasn't backdated across a month boundary
 * before its slot ran out.
 */
async function settleAndDrainAndPersist(
  storageClient: ReturnType<typeof createChunkedStorage>,
  town: TownState,
  buildings: readonly Building[],
  budget: BudgetSetting,
  onboarded: boolean,
  today: string,
  now: number,
): Promise<{
  town: TownState;
  buildings: Building[];
  celebrateTier: number | null;
  drainedCount: number;
  /** F16 — one per settled month this boot, oldest first; empty when nothing was unsettled. */
  monuments: Building[];
  /** ADDENDUM-05 (F-ECON) — the buildings actually drained this boot (entry-sourced, so each earns a build award); distinct from `monuments`, which are F16-sourced and earn a settlement award instead. */
  drained: Building[];
}> {
  const settled = settleMonths({
    town,
    today,
    entriesForPeriod: (period) => storageClient.loadEntriesForMonth(period).entries,
    budgetKrw: budget.monthlyBudgetKrw,
    moodPaceThresholds: BALANCE.moodPaceThresholds,
    // Deterministic id per monument, keyed off its own index — same
    // contract the drain's own id generator below already follows.
    buildingIdFor: (i) => makeId("b", now + i),
    createdAt: now,
    // ADDENDUM-08 §2.2 — a monument always tries 2x2 first (`placeMonument`),
    // never the generic roll+downgrade `placeMany` (townLayout's ordinary
    // buildings use below). `settleMonths` only knows how to ask for N
    // placements at once, so this loops `placeMonument` itself, folding each
    // pick's cells into `occ` before the next call so two monuments settled
    // in the same run can never overlap. Returns fewer than `count` (settling
    // fewer months this boot; the rest stay unsettled and retry next boot —
    // `settleMonths`'s own "fewer placements than months" contract) once even
    // a downgraded `placeMonument` can't find room — never dropped.
    placeMany: (count) => {
      const placements: Placed[] = [];
      let occ: readonly Building[] = buildings;
      for (let i = 0; i < count; i++) {
        const placed = placeMonument(occ, random.next);
        if (placed === null) break;
        placements.push(placed);
        occ = [
          ...occ,
          {
            id: `__monumentScratch${i}`,
            source: { kind: "monument", period: "" },
            categoryId: null,
            variantIndex: 0,
            plotIndex: placed.anchor,
            w: placed.w,
            h: placed.h,
            builtOn: "",
            createdAt: 0,
          },
        ];
      }
      return placements;
    },
  });
  const buildingsWithMonuments = [...buildings, ...settled.monuments];

  const result = drainQueue(
    settled.town,
    // Gate-3-rerun fix: the literal count (monuments minted above already
    // included) — the tier gate must use the same number `TownHeader`
    // displays, not the growth score (see `entryActions.ts`'s
    // `BuildOrQueueArgs.buildingCountBeforeThis` doc for the full story).
    // ADDENDUM-11 §5.1.3: that one number is now `townScale` (Σ 2**fuse) —
    // still ONE accessor shared with the header, just counting Lv.5-equivalents.
    townScale(buildingsWithMonuments),
    today,
    BALANCE.dailyBuildSlots,
    BALANCE.tierThresholds,
    // One deterministic id per drained material, keyed off its queue index
    // (i = 0, 1, 2, ...) per the function's own contract — not a random id
    // that happens to be unique by luck of `Math.random()`.
    (i) => makeId("b", now + i),
    now,
    // ADDENDUM-08 §3: N distinct footprint placements for this drain, drawn
    // once so no two drained buildings (or a monument just allocated above)
    // can collide.
    (count) => placeManyPlots(buildingsWithMonuments, count, random.next),
    BALANCE.expAmountTiers, // ADDENDUM-04 §6/§7
  );
  if (result.drained.length === 0 && settled.monuments.length === 0) {
    return { town: result.town, buildings: [...buildings], celebrateTier: null, drainedCount: 0, monuments: [], drained: [] };
  }

  const patchesByMonth = new Map<string, Map<string, string>>(); // ym -> entryId -> buildingId
  for (const { material, building } of result.drained) {
    if (material.entryYm === undefined || material.entryId === undefined) continue; // 무지출 park material — no ledger entry behind it, nothing to patch
    const ym = material.entryYm;
    const patches = patchesByMonth.get(ym) ?? new Map<string, string>();
    patches.set(material.entryId, building.id);
    patchesByMonth.set(ym, patches);
  }

  // Same time-budgeted yielding storage.ts's own boot read uses
  // (`readBuildingChunksBatched`, TIME_BUDGET_MS = 8) rather than an
  // unconditional yield per chunk — `materialQueueMax` bounds this to a
  // handful of months in the worst case, so most drains never need to yield
  // at all, and a real reload's boot chain settles in one tick, same as
  // every other boot path here.
  const TIME_BUDGET_MS = 8;
  const core: CoreState = { town: result.town, budget, onboarded };
  let sliceStart = performance.now();
  for (const [ym, patches] of patchesByMonth) {
    const { entries } = storageClient.loadEntriesForMonth(ym);
    const patched = entries.map((e) => (patches.has(e.id) ? { ...e, buildingId: patches.get(e.id)!, queued: false } : e));
    storageClient.saveEntriesForMonth(ym, patched, core);
    if (performance.now() - sliceStart > TIME_BUDGET_MS) {
      await yieldToMainThread();
      sliceStart = performance.now();
    }
  }

  const drainedBuildings = result.drained.map((d) => d.building);
  const buildYm = today.slice(0, 7);
  mutateBuildingsForMonth(storageClient, buildYm, (existing) => [...existing, ...settled.monuments, ...drainedBuildings]);
  storageClient.saveCore(core);

  return {
    town: result.town,
    buildings: [...buildings, ...settled.monuments, ...drainedBuildings],
    celebrateTier: result.celebrateTier,
    drainedCount: result.drained.length,
    monuments: settled.monuments,
    drained: drainedBuildings,
  };
}

export function useTownStore() {
  // One client for the component's lifetime — its debounce buffer must
  // survive across renders/saves, not reset per save.
  const storageRef = useRef(createChunkedStorage());
  const [state, setState] = useState<LoadedState | null>(null);

  // F6 round-2 fix (C2 finding #3): `today` below (near the return) is
  // `clock.today()`, recomputed fresh on every render — but nothing forced a
  // RENDER across a real day/month rollover while the component stayed
  // mounted with no unrelated state change, so mood/pace could sit stale on
  // screen. Two triggers cover the two ways "today" changes while mounted:
  // TimeTravel (dev/test, `clock.ts`'s own doc: built exactly for "re-render
  // on date change... not needing remount/poll") is wired here for the
  // re-render side effect alone — the value itself is unused, `today` below
  // still reads through `clock.today()`. The real-device case (no
  // TimeTravel) has no such push channel; that half is covered by the
  // visibilitychange effect further down instead.
  useSyncExternalStore(subscribeTimeTravel, getTimeTravelDate, getTimeTravelDate);
  // This render's canonical "current month" — recomputed fresh every render
  // (cheap: one `slice`), same value the rollover-reconciliation effect
  // below keys off.
  const todayYm = clock.today().slice(0, 7);
  const [justBuiltId, setJustBuiltId] = useState<string | null>(null);
  // ADDENDUM-01 §2.6a — the savings structure that just crossed a ladder
  // threshold, plus a per-event sequence number. `justBuiltId` gets away with
  // being a bare id because building ids are unique per build; a bare
  // `SavingCategoryId` would not — saving into the same structure twice in a
  // row and crossing a threshold both times would set the same value, React
  // would see no change, and the second rise animation would never play.
  //
  // UNLIKE `justBuiltId`, this IS cleared back to `null` — round-4 finding
  // C1 #2: a savings structure's rise is a one-shot animation (§2.6), not a
  // permanent state, and `justBuiltId` staying set forever is fine because
  // it only ever highlights the single most-recent tile, whereas leaving
  // `justGrew` set forever pins the most-recently-grown structure in
  // `.savings-plot--rise` for the rest of the session and it never returns
  // to its `idleAnim` loop. `clearJustGrew` below is called by
  // `SavingsRow`'s `onRiseSettled` once the rise animation's native
  // `animationend` fires.
  const [justGrew, setJustGrew] = useState<{ id: SavingCategoryId; seq: number } | null>(null);
  const clearJustGrew = useCallback(() => setJustGrew(null), []);
  const growSeqRef = useRef(0);
  // Guided highlight sequence (see `Spotlight`'s own doc) — one state, set at
  // every trigger site (build/level-up/fusion) below, cleared by the popup's
  // dismiss. Same seq-number pattern as `justGrew` right above, for the same
  // reason: the same building can trigger this twice in one session (e.g.
  // level up, then fuse) and each occurrence must re-run the sequence.
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const clearSpotlight = useCallback(() => setSpotlight(null), []);
  const spotlightSeqRef = useRef(0);
  // One FIFO queue for every one-shot notice (F10 corruption, F14 "return
  // promise kept" on boot, F5 tier celebration) — see the `Notice` doc
  // comment above. `notice` is always the head; dismissing pops it.
  const [noticeQueue, setNoticeQueue] = useState<Notice[]>([]);
  const notice = noticeQueue[0] ?? null;
  const dismissNotice = useCallback(() => {
    // ADDENDUM-02 §4.5 — "dismissed forever ... by an explicit dismiss": the
    // moveHint is one-shot across SESSIONS, not just within one. Gate-3
    // round-3 finding (all five expert lenses): flipping `moveHintSeen` in
    // memory and waiting for "whatever saveCore happens next" was the bug —
    // a player who saw the toast and reloaded WITHOUT touching budget/name/a
    // move first got it re-queued on every single reload, because nothing
    // had actually persisted the flag yet. `saveCore` is called directly
    // here, same as every other core-field mutation in this file, so the
    // flip survives the very next reload regardless of what the player does
    // (or doesn't do) afterward.
    if (notice?.kind === "moveHint" && stateRef.current && !stateRef.current.town.moveHintSeen) {
      const town = { ...stateRef.current.town, moveHintSeen: true };
      storageRef.current.saveCore({ town, budget: stateRef.current.budget, onboarded: stateRef.current.onboarded });
      const next: LoadedState = { ...stateRef.current, town };
      stateRef.current = next;
      setState(next);
    }
    setNoticeQueue((q) => q.slice(1));
  }, [notice]);
  const pushNotices = useCallback((...toAdd: Notice[]) => {
    if (toAdd.length === 0) return;
    setNoticeQueue((q) => [...q, ...toAdd]);
  }, []);

  // ADDENDUM-02 §4.5 — queues the move-discoverability hint AT MOST ONCE per
  // component lifetime (AC-H1's "appears exactly once"). The PERSISTENT gate
  // is `town.moveHintSeen` (survives reload); this ref only stops the SAME
  // session from re-queuing it on every subsequent render once the
  // condition is already true.
  //
  // Deliberately skips queuing (leaving the ref untouched, so a LATER call
  // still gets a chance) whenever the notice queue is already non-empty:
  // every other Notice kind here is a one-off event a single action can
  // legitimately fire (F5 tier, F14 drained, ...), and this hint must never
  // stack behind/ahead of one of those in the same FIFO — the queue (and
  // `App.tsx`'s toast/overlay rendering) was built assuming one visible
  // notice at a time.
  const hintQueuedRef = useRef(false);
  const maybeQueueMoveHint = useCallback((town: TownState, buildingCount: number) => {
    if (hintQueuedRef.current || town.moveHintSeen || buildingCount < 2) return;
    setNoticeQueue((q) => {
      if (q.length > 0) return q;
      hintQueuedRef.current = true;
      return [...q, { kind: "moveHint" }];
    });
  }, []);

  // Mirrors `state` for `addEntry`/`claimNoSpend` to read synchronously,
  // written only from an effect (never during render) and then updated again
  // by those handlers directly, same reasoning as T003's original note.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Which 'YYYY-MM' `state.entries` currently holds — set once at boot, then
  // kept in sync by the rollover-reconciliation effect below. `null` until
  // boot resolves (mirrors `state` itself being `null` pre-boot).
  const entriesYmRef = useRef<string | null>(null);

  // F6 round-2 fix (C2 finding #3): `state.entries` is only ever loaded for
  // "the current month" ONCE, at boot (this file's own header doc). A real
  // rollover while the component stays mounted (no remount, no re-boot) left
  // `state.entries` holding the OUTGOING month's entries forever — worse than
  // just a stale mood/pace display, `addEntry` appends any NEW entry whose
  // `occurredOn` matches the (new) `today` straight onto that stale array
  // (`entryYm === todayYm` in `addEntry` below), silently mixing an old
  // month's spending into the new month's totals. Reconciles whenever this
  // render's `todayYm` (now forced to refresh promptly by the TimeTravel/
  // visibilitychange triggers above) no longer matches what `state.entries`
  // was last loaded for: folds the OUTGOING month into `historyEntries` (F8's
  // own lazy-load cache — a later 기록 nav back to it finds it with no re-read,
  // the same contract `ensureMonthLoaded` already promises every other month)
  // and loads the new current month exactly like boot does.
  useEffect(() => {
    if (state === null || entriesYmRef.current === null || entriesYmRef.current === todayYm) return;
    const outgoingYm = entriesYmRef.current;
    entriesYmRef.current = todayYm;
    const { entries: incomingEntries } = storageRef.current.loadEntriesForMonth(todayYm);
    setState((s) => {
      if (s === null) return s;
      return { ...s, entries: incomingEntries, historyEntries: { ...s.historyEntries, [outgoingYm]: s.entries } };
    });
  }, [state, todayYm]);

  // Gate-3-rerun fix (root cause of the F16 "settlement notice never fires"
  // finding, every expert's E2): `bootPromiseRef` used to cache only the
  // `loadBoot()` CALL — every real side effect downstream of it (the F16
  // settle + F14 drain + their storage writes + the notices they produce)
  // lived in the `.then()` callback, which is re-attached fresh on EVERY
  // effect invocation. Under `<StrictMode>`'s dev mount->cleanup->remount,
  // the SAME `loadBoot()` promise ends up with two `.then()` subscribers —
  // ordinarily harmless (the first sees `cancelled` and bails), but any
  // interleaving where BOTH subscribers reach `settleAndDrainAndPersist`
  // before either's `cancelled` flag is checked runs the settle/drain twice
  // against the same stale `boot.core`/`reconciled.buildings` snapshot: two
  // independent monument-minting persists racing each other, and only
  // whichever `.then()` happens to lose the "is this the current effect"
  // race never gets to `pushNotices` — so the monuments (a storage write)
  // land while the one-time notice (a `setState` in a callback that bailed)
  // does not. Caching the WHOLE settle-and-compute chain, not just the
  // fetch, guarantees `settleAndDrainAndPersist` (and everything after it)
  // runs exactly once per component instance no matter how many effect
  // invocations attach a `.then()` — `cancelled` now only gates whether
  // THIS invocation applies the (single, shared) result to React state.
  const bootProcessedRef = useRef<Promise<{ state: LoadedState; notices: Notice[] }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    bootProcessedRef.current ??= (async (): Promise<{ state: LoadedState; notices: Notice[] }> => {
      const boot = await storageRef.current.loadBoot();
      const today = clock.today();
      const core = boot.core ?? freshCore(clock.now(), today);
      const storageClient = storageRef.current;

      // ADDENDUM-08 §3.6/§4 — self-healing reconcile, BEFORE anything else
      // (the drain below places new buildings and must see sane occupancy).
      // `boot.forceReseat` (true exactly on a version<4 boot) tells the
      // reconciler every stored plotIndex is meaningless in the new 20x20
      // coordinate space — every building lays out fresh, oldest first
      // (§4's migration). Zero storage writes for the ordinary case where
      // nothing is wrong (repaired === 0, no forced reseat).
      // ADDENDUM-11 §3.1 — finish (never roll back) any fusion that was
      // interrupted between its two chunk writes, BEFORE reconcile so the
      // consumed building's cells are already free when placement runs. A
      // `fusePending` can only exist inside that window, so the ordinary boot
      // does no work and writes nothing here.
      const fusionRepair = repairPendingFusions(boot.buildings);
      if (fusionRepair.repairs.length > 0) {
        const repairCore: CoreState = { town: core.town, budget: core.budget, onboarded: core.onboarded };
        for (const repair of fusionRepair.repairs) {
          // The consumed building's own chunk first: dropping it is the write
          // that may still be missing. Skipped when it is already gone (a
          // crash after write 2), where only the stale field remains.
          if (repair.consumedYm !== null) {
            mutateBuildingsForMonth(storageClient, repair.consumedYm, (existing) =>
              existing.filter((b) => b.id !== repair.consumedId));
          }
          // §5.4 — the remap is re-run rather than assumed: a crash before it
          // would otherwise leave 기록 entries pointing at a deleted id.
          // Idempotent (nothing points at the consumed id the second time).
          remapLedgerRefs(storageClient, repairCore, repair.consumedId, repair.survivorId);
          mutateBuildingsForMonth(storageClient, repair.survivorYm, (existing) =>
            existing.map((b) => (b.id === repair.survivorId ? fusionRepair.buildings.find((x) => x.id === b.id) ?? b : b)));
        }
        analytics.track("fusion_repaired", { count: fusionRepair.repairs.length });
      }

      const reconciled = reconcilePlacement(fusionRepair.buildings, { forceReseat: boot.forceReseat });
      // ponytail: `unplacedIds` (buildings.length > 193 ground cells) is
      // unreachable for any real save (spec §4: "193 ground cells >> any
      // existing save") — those buildings are kept, at their stale
      // plotIndex, inside `reconciled.buildings` already (placement.ts's own
      // contract: "never dropped"); they simply re-attempt a normal seat the
      // next time `reconcilePlacement` runs. No separate storage/UI path for
      // them exists yet — add one if a save ever legitimately exceeds capacity.
      if (reconciled.repaired > 0) {
        // Only months that actually contain a repaired building, ascending
        // ym order — rebuilt from the reconciled in-memory array, never
        // read-modify-write. Position-indexed comparison against the
        // reconciler's own INPUT (`fusionRepair.buildings` — `boot.buildings`
        // itself, by reference, on any boot with no fusion to repair; a repair
        // can DROP a consumed building, which would shift every later index)
        // is safe: `reconcilePlacement` preserves array order/identity for
        // every untouched entry (its own contract).
        const repairedMonths = new Set<string>();
        for (let i = 0; i < reconciled.buildings.length; i++) {
          if (reconciled.buildings[i] !== fusionRepair.buildings[i]) repairedMonths.add(reconciled.buildings[i].builtOn.slice(0, 7));
        }
        for (const ym of [...repairedMonths].sort()) {
          storageClient.saveBuildingsForMonth(ym, reconciled.buildings.filter((b) => b.builtOn.slice(0, 7) === ym));
        }
        // No player-facing notice — they did nothing wrong (§3.6 point 6).
        analytics.track("placement_repaired", { count: reconciled.repaired });
      }

      // F16 settlement THEN F14 queue drain, both AFTER F4's slot reset (the
      // reset is purely evaluated — slotsRemainingToday — at drain time) and
      // persisted together in one write (see the function's own doc).
      const settleDrain = await settleAndDrainAndPersist(
        storageClient,
        core.town,
        reconciled.buildings,
        core.budget,
        core.onboarded,
        today,
        clock.now(),
      );
      const { entries: currentMonthEntries } = storageClient.loadEntriesForMonth(today.slice(0, 7));

      // ADDENDUM-05 (F-ECON) — grant seeds for whatever this boot's
      // settlement/drain just produced (PM-DECISIONS §F-ECON table rows 1/4:
      // "any entry-sourced build, including a queue drain" and "monthly
      // settlement completes"), plus a tier bonus if the drain crossed one.
      // `applyAward` is idempotent and a no-op returns the SAME reference, so
      // `economy` only actually changes (and only then gets persisted) when
      // this boot minted something new — a reload of an already-settled town
      // never re-grants.
      const bootEconomySeed = boot.economy ?? defaultEconomyState();
      let economy = bootEconomySeed;
      // `kind: "build"` is the ENTRY-sourced build award (§F-ECON table row 1).
      // A deferred 무지출 park draining here was already paid its `nospend`
      // award on the day it was claimed — `seed:nospend:<date>` is keyed by the
      // claim date, so it survives the queue->drain hop and `applyAward` would
      // no-op it anyway; paying it a `build` award on top would be a second,
      // differently-keyed grant for one act. Skipped, so a park pays exactly
      // once whichever branch it took.
      for (const b of settleDrain.drained) {
        if (b.source.kind === "nospend") continue;
        // `b.exp` is the founding gain queueActions.ts stored for this drain
        // (omitted, not zeroed, when it was 0/1 — see its own doc), so `?? 0`
        // reads that correctly instead of an unset field as "undefined".
        economy = applyAward(economy, awardFor({ kind: "build", buildingId: b.id, expGain: b.exp ?? 0 }));
      }
      // period -> the seeds that settlement's award actually paid (라이브옵스
      // PD TOP FIX) — captured per-monument so the F16 card below can name
      // the SPECIFIC month it's showing, not just whichever ran last.
      const settlementSeedsByPeriod = new Map<string, number>();
      for (const m of settleDrain.monuments) {
        if (m.monumentSummary) {
          const settlementAward = awardFor({
            kind: "settlement",
            period: m.monumentSummary.period,
            outcomeBucket: m.monumentSummary.outcomeBucket,
            primeLotCount: settleDrain.buildings.filter((b) => isPrimePlotIndex(b.plotIndex)).length,
          });
          settlementSeedsByPeriod.set(m.monumentSummary.period, settlementAward.amount);
          economy = applyAward(economy, settlementAward);
        }
      }
      if (settleDrain.celebrateTier !== null) economy = applyAward(economy, awardFor({ kind: "tier", tier: settleDrain.celebrateTier }));
      if (economy !== bootEconomySeed) storageClient.saveEconomy(economy);

      const bootNotices: Notice[] = [];
      if (boot.corrupted.length > 0) bootNotices.push({ kind: "corruption", message: summarizeCorruption(boot.corrupted.length) });
      if (settleDrain.drainedCount > 0) bootNotices.push({ kind: "drained", count: settleDrain.drainedCount });
      if (settleDrain.celebrateTier !== null) bootNotices.push({ kind: "tier", tier: settleDrain.celebrateTier });
      if (boot.relayout) bootNotices.push({ kind: "relayout" }); // ADDENDUM-01 §3.6
      // F16 — one card for the MOST RECENTLY settled month, even when this
      // boot settled several at once (a long absence never shows more than
      // one 지난달 결산 card).
      const latestMonument = settleDrain.monuments[settleDrain.monuments.length - 1];
      if (latestMonument?.monumentSummary) {
        bootNotices.push({
          kind: "settlement",
          summary: latestMonument.monumentSummary,
          seedsGranted: settlementSeedsByPeriod.get(latestMonument.monumentSummary.period) ?? 0,
        });
      }

      return {
        state: {
          town: settleDrain.town,
          buildings: settleDrain.buildings,
          entries: currentMonthEntries,
          historyEntries: {},
          budget: core.budget,
          onboarded: core.onboarded,
          economy,
        },
        notices: bootNotices,
      };
    })();
    void bootProcessedRef.current.then(({ state: bootState, notices }) => {
      if (cancelled) return;
      entriesYmRef.current = clock.today().slice(0, 7);
      setState(bootState);
      pushNotices(...notices);
      // ADDENDUM-02 §4.5 is a STATE condition ("once the town has >= 2
      // buildings and the hint has not been seen, the town screen shows a
      // one-shot hint"), not a build-action event — so it must also be
      // evaluated right here, once, at the end of boot. Every town that
      // exists today has `moveHintSeen` unset; without this call none of them
      // would ever be told the gesture exists until their NEXT build-producing
      // action (round-2 finding C1 #1). `maybeQueueMoveHint`'s own queue-order
      // guard (skip if the notice queue is already non-empty) means this
      // never races the boot notices just pushed above.
      maybeQueueMoveHint(bootState.town, countBuildings(bootState.buildings));
    });
    return () => {
      cancelled = true;
    };
  }, [pushNotices, maybeQueueMoveHint]);

  // storage.ts's own doc comment on `flush()` — unchanged from T003, PLUS
  // (ADDENDUM-02 round-3 finding C2): flush on the effect's own cleanup too,
  // not only on pagehide/visibilitychange. Without this, a component
  // teardown that ISN'T a real page exit (a test's `root.unmount()`; a
  // future in-app unmount) leaves this `storageRef`'s debounced writes
  // sitting in a live ~300ms `setTimeout` that nothing will ever cancel.
  // That timer still closes over the SAME shared storage port (real
  // `window.localStorage` in the browser and in every test here), so it can
  // fire later — during a LATER test's run, after that test's own `beforeEach`
  // has already cleared and repopulated the same keys — and silently
  // overwrite fresh state with a stale snapshot. This is a real gap
  // independent of `reconcilePlacement` (any addEntry/claim write can leave
  // one buffered), and it is what let round-3's own reconcile-boot-write
  // regression corrupt a LATER, unrelated test's storage instead of just
  // that test failing on its own. Flushing here is a no-op cost (idempotent
  // when the buffer is already empty) and changes nothing about WHEN a write
  // happens for an app that keeps running — it only guarantees a torn-down
  // instance never leaves a live timer pointed at storage behind it. See
  // `useTownStore.retention.test.tsx`'s "no dangling debounced write..." test.
  // `forceTick` has no reader — its only job is to be a NEW value each call,
  // so the `setForceTick` below always triggers a render (an object/counter
  // that a memoized child can't shortcut past), unlike re-committing `state`
  // itself (which would falsely look like a real state change to props that
  // key off it by reference elsewhere, e.g. `EntryDetailSheet`'s `entries`
  // identity checks).
  const [, setForceTick] = useState(0);
  useEffect(() => {
    function flushNow() {
      storageRef.current.flush();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushNow();
      } else {
        // Becoming visible again is the practical mobile-webview signal that
        // real time may have passed while the host backgrounded this mini-app
        // (e.g. overnight) — force a render so `today` (recomputed fresh
        // below on every render) picks up a day/month rollover with no other
        // trigger required (F6 round-2 fix, C2 finding #3).
        setForceTick((n) => n + 1);
      }
    }
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      flushNow();
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  /**
   * ADDENDUM-05 (F-ECON) — the one write path every seed grant goes through
   * (`addEntry`/`claimNoSpend` below call this, nothing else mutates
   * `economy.seeds` upward). Idempotent via `applyAward` (economy/awards.ts):
   * a no-op award returns the exact same object reference, which is how this
   * tells "nothing to persist" apart from "granted" without a second check.
   * Returns whether it actually paid — callers don't currently use the
   * return value, but `purchaseSku`'s sibling actions below do use their own
   * result unions, so this matches that shape rather than returning void.
   */
  const grantSeeds = useCallback((event: AwardEvent): boolean => {
    const prev = stateRef.current;
    if (prev === null) return false;
    const economy = applyAward(prev.economy, awardFor(event));
    if (economy === prev.economy) return false;
    storageRef.current.saveEconomy(economy);
    const next: LoadedState = { ...prev, economy };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  // NOTE (T003, still true): assumes addEntry/claimNoSpend are called once
  // and awaited (via the UI) before the next call.
  /**
   * ADDENDUM-04 §4 — `deferGrowChoice` saves the entry and spends its slot NOW
   * and leaves only the 새로짓기/키우기 building effect open (see
   * `PendingGrowChoice`). The entry row and the marker land in ONE
   * `saveEntriesForMonth` call (which writes the chunk AND core), so a reload
   * while the dialog is showing can never see one without the other — the
   * defect this replaced held the whole draft in React state and lost it.
   */
  const addEntry = useCallback((draft: EntryDraft, growTargetId?: string, deferGrowChoice?: boolean): AddEntryResult => {
    const prev = stateRef.current;
    if (prev === null) return { building: null, grew: null, queued: false, queueOverflow: false, queueLength: 0, seedsGranted: 0 };

    const today = clock.today();
    const now = clock.now();
    const entryId = makeId("e", now);
    const buildingId = makeId("b", now);
    const variantIndex = Math.floor(random.next() * BALANCE.variantsPerCategory);
    // ADDENDUM-08 §2.2/§3 (B16/B24): a random footprint on a random free
    // anchor, computed here exactly like `variantIndex` already is, and
    // passed in — placement.ts is the only module allowed to decide a
    // plotIndex (rule R-4).
    // `placeNew` returns null when the town has no legal anchor left. That is
    // now a reachable state (the RX1-N2 spacing rule caps the map near 81
    // buildings, ~8 days at 10 slots), so the null is passed straight through:
    // `decideBuildOrQueue` queues the entry instead of founding a building on
    // a fallback cell. The old `?? 0` founded an invisible building on cell 0
    // (void terrain the grid never renders) and collided the next one with it.
    const placed = placeNew(prev.buildings, random.next);
    const plotIndex = placed?.anchor ?? null;
    const w = placed?.w ?? 1;
    const h = placed?.h ?? 1;
    // ADDENDUM-04 §3/§7 — director-closed Option 3: EXP scales with amount
    // for every entry type, no per-type branching. Computed here (the only
    // place BALANCE.expAmountTiers is read) and passed down as a plain
    // number, same as `variantIndex` above, so entryActions.ts stays
    // balance-free. Feeds whichever branch `decideBuildOrQueue` takes —
    // growing `growTargetId`'s host, or founding a new Building with exp
    // `expGain - 1` (§3 parity: both branches contribute `expGain`).
    const expGain = expGainFor(draft.amountKrw, BALANCE.expAmountTiers);

    const result = applyNewEntry({
      town: prev.town,
      buildings: prev.buildings,
      draft,
      entryId,
      buildingId,
      createdAt: now,
      today,
      dailyBuildSlots: BALANCE.dailyBuildSlots,
      materialQueueMax: BALANCE.materialQueueMax,
      tierThresholds: BALANCE.tierThresholds,
      noSpendDayCostsSlot: BALANCE.noSpendDayCostsSlot,
      variantIndex,
      plotIndex,
      w,
      h,
      growTargetId,
      expGain,
      deferGrowChoice,
    });

    const storageClient = storageRef.current;
    let buildings = prev.buildings;

    // F15 revocation: remove the revoked park tile from its own month chunk
    // — which, for a PAST claimed date, is a DIFFERENT month chunk than
    // whatever this save's own building lands in below.
    if (result.revokedNoSpend?.buildingId) {
      const revokedId = result.revokedNoSpend.buildingId;
      buildings = buildings.filter((b) => b.id !== revokedId);
      const revokedYm = result.revokedNoSpend.date.slice(0, 7);
      mutateBuildingsForMonth(storageClient, revokedYm, (existing) => existing.filter((b) => b.id !== revokedId));
    }

    const core: CoreState = { town: result.town, budget: prev.budget, onboarded: prev.onboarded };
    const entryYm = draft.occurredOn.slice(0, 7);
    const { entries: existingEntries } = storageClient.loadEntriesForMonth(entryYm);
    storageClient.saveEntriesForMonth(entryYm, [...existingEntries, result.entry], core);

    if (result.building) {
      const newBuilding = result.building;
      const buildYm = newBuilding.builtOn.slice(0, 7);
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => [...existing, newBuilding]);
      buildings = [...buildings, newBuilding];
    } else if (result.grownBuilding) {
      // ADDENDUM-04 §5/§6 — persist into the HOST's OWN builtOn month chunk,
      // which may differ from this save's `entryYm` (the host can predate
      // this month), so this is never lumped into the write above.
      const grownBuilding = result.grownBuilding;
      const grownYm = grownBuilding.builtOn.slice(0, 7);
      mutateBuildingsForMonth(storageClient, grownYm, (existing) => existing.map((b) => (b.id === grownBuilding.id ? grownBuilding : b)));
      buildings = buildings.map((b) => (b.id === grownBuilding.id ? grownBuilding : b));
      // Guided highlight sequence — a genuine level UP only (before < after
      // `totalLevelOf`), never every exp gain: most grows add exp without
      // crossing a level boundary, and a highlight for those would fire
      // constantly and mean nothing. `prev.buildings` is the pre-save
      // snapshot (same one the tier/streak checks elsewhere in this save
      // already read from).
      const grownBefore = prev.buildings.find((b) => b.id === grownBuilding.id);
      if (
        grownBefore &&
        totalLevelOf(grownBefore, BALANCE.expPerLevel, BALANCE.maxLevel) <
          totalLevelOf(grownBuilding, BALANCE.expPerLevel, BALANCE.maxLevel)
      ) {
        setSpotlight({ buildingId: grownBuilding.id, kind: "levelUp", seq: spotlightSeqRef.current++ });
      }
    }

    const todayYm = today.slice(0, 7);
    const entries = entryYm === todayYm ? [...prev.entries, result.entry] : prev.entries;

    const next: LoadedState = { ...prev, town: result.town, buildings, entries };
    stateRef.current = next;
    setState(next);
    // Gate-3-rerun fix — see `AddEntryResult.seedsGranted`'s doc: sums
    // whatever `grantSeeds` actually paid (0 on an idempotent no-op) instead
    // of discarding its result, so the caller can show it.
    let seedsGranted = 0;
    // B4 — the entry itself is the play action, so it pays whether it founded,
    // grew (ADDENDUM-04 §5) or queued (F14); `entryId` is minted per save, so
    // the idempotency key is unique by construction. The build/tier awards
    // below stay separate bonuses on top.
    //
    // Gated on the save having actually PRODUCED something, which is what
    // bounds a day's earnings at `dailyBuildSlots + materialQueueMax` rewarded
    // saves (see the ceiling arithmetic on `BALANCE.seedAwards`). The one
    // remaining excluded case is a queue-overflow save (the town is full for
    // today — the app itself says "건물 없이 저장했어요"), which is unbounded on
    // purpose: it produced nothing to cap.
    // A deferred save (`result.pendingGrowChoice`) counts as "produced
    // something" here: it already spent the build slot and advanced the
    // streak, so it carries the same bound the build/grow/queue branches do —
    // and paying at 저장 time is what makes the award durable across the
    // reload this whole deferral exists to survive. The award key is the
    // entryId, so `resolveGrowChoice` re-attempting it later is a no-op.
    if (result.building || result.grownBuilding || result.queuedMaterial || result.pendingGrowChoice) {
      const entryAward = { kind: "entry", entryId, expGain } as const;
      if (grantSeeds(entryAward)) seedsGranted += awardFor(entryAward).amount;
    } else if (draft.type === "saving" && result.town.lastActOn !== prev.town.lastActOn) {
      // Gate-3-rerun fix (게임 디자이너's TOP FIX, panel's #1 finding): 저축 used
      // to pay literally 0 seeds and never advance the streak — the reward
      // gradient ran backwards for a household-ledger app (a 150,000원 spend
      // earned 18 seeds and a Lv.5 tower; a 1,000,000원 저축 earned nothing and
      // read as a broken streak the next morning). It now earns the same
      // amount-tiered `entry` award every expense already gets — same key
      // shape (`entryId`), so the existing entryId-keyed clawback/settle in
      // `historyActions.ts` reverses it correctly on edit/delete with no
      // changes there. Gated to the day's FIRST act (the same `lastActOn`
      // transition the streak award above keys off): 저축 has no
      // `dailyBuildSlots`/`materialQueueMax` cap by design (F13), so paying
      // every 저축 entry here — unlike a founding/growing/queueing expense —
      // would reopen the exact day-one seed-farm ceiling `awards.ts` exists to
      // hold (log N 저축 entries, collect N awards, no cap in sight).
      const entryAward = { kind: "entry", entryId, expGain } as const;
      if (grantSeeds(entryAward)) seedsGranted += awardFor(entryAward).amount;
    }
    // Gate-3-rerun fix (liveops-pd's TOP FIX): pays the day's FIRST act that
    // actually extends 연속 N일 — `result.town.lastActOn` only changes on that
    // exact transition (`advanceStreak`'s same-day call is a true no-op, same
    // object reference, so `lastActOn` cannot have moved). Keyed by date, so
    // this cannot double-pay even if a second entry lands the same day.
    if (result.town.lastActOn !== prev.town.lastActOn) {
      const streakAward = { kind: "streak", date: today, streakDays: result.town.streakDays } as const;
      if (grantSeeds(streakAward)) seedsGranted += awardFor(streakAward).amount;
    }
    if (result.building) {
      setJustBuiltId(result.building.id);
      setSpotlight({ buildingId: result.building.id, kind: "built", seq: spotlightSeqRef.current++ });
      // Gate-3 follow-up (A2) — queued BEFORE the tier notice below so the
      // FIFO shows "첫 건물" first if a fresh town somehow crosses a tier on
      // the same save. `prev.buildings` is the pre-save town by construction.
      if (countBuildings(prev.buildings) === 0) pushNotices({ kind: "firstBuilding" });
      const award = { kind: "build", buildingId: result.building.id, expGain } as const; // ADDENDUM-05 — entry-sourced build, § F-ECON table row 1
      if (grantSeeds(award)) seedsGranted += awardFor(award).amount;
    }
    if (result.celebrateTier !== null) {
      pushNotices({ kind: "tier", tier: result.celebrateTier });
      const award = { kind: "tier", tier: result.celebrateTier } as const; // ADDENDUM-05 — § F-ECON table row 3
      if (grantSeeds(award)) seedsGranted += awardFor(award).amount;
    }
    // ADDENDUM-01 §2.6a — detect a savings level-up by comparing the town
    // BEFORE/AFTER this save (both already in hand: `prev.town`/`result.town`).
    // By construction `grownStructures` returns at most one id for a normal
    // save (one entry has one categoryId).
    const grown = grownStructures(prev.town, result.town, (id) =>
      ladderFor(id, BALANCE.savingsTowerSegments, BALANCE.savingsStructureSegments));
    if (grown.length > 0) {
      setJustGrew({ id: grown[0], seq: growSeqRef.current++ });
      pushNotices(...grown.map((id): Notice => ({ kind: "savings", id })));
    }
    // Gate-3-rerun fix (near-unanimous finding): `TownScreen.saveEntry` fires
    // its OWN `openToast` for every one of these four outcomes (queued,
    // overflow, grew, or a non-first founding) — a call this hook has no
    // visibility into, so `maybeQueueMoveHint`'s "don't stack behind another
    // Notice" guard (it only inspects the internal FIFO) never saw it. The
    // hint and a founding toast landing in the same commit is exactly what
    // produced the garbled, overlapping toast text QA caught (a large-entry
    // save whose "OO 건물이 생겼어요" reward line got clipped by the hint).
    // Skipping the queue attempt here (leaving `hintQueuedRef` untouched)
    // just defers it to the next opportunity with nothing else on screen —
    // next boot, or a later save/claim that itself produces none of these
    // four outcomes (a plain 저축 entry, most commonly).
    if (
      !result.building &&
      !result.grownBuilding &&
      !result.queuedMaterial &&
      !result.queueOverflow &&
      // A deferred save opens the choice ConfirmDialog in the same commit —
      // exactly the "something else is already on screen" case this guard is
      // about, so the hint waits for a quieter moment like every other branch.
      !result.pendingGrowChoice
    ) {
      maybeQueueMoveHint(result.town, countBuildings(buildings));
    }

    return {
      building: result.building,
      grew: result.grownBuilding,
      queued: result.queuedMaterial !== null,
      queueOverflow: result.queueOverflow,
      queueLength: result.town.queue.length,
      seedsGranted,
    };
  }, [pushNotices, maybeQueueMoveHint, grantSeeds]);

  /**
   * ADDENDUM-04 §4 — answer the pending 새로짓기/키우기 choice for an entry that
   * is ALREADY saved (`addEntry(..., deferGrowChoice)` above). `growTargetId`
   * names the building to 키우기; omit it for 새로 짓기, which is also the
   * default the UI applies when the dialog is dismissed without a choice.
   *
   * Returns null when there is nothing pending (a double tap, or a resolve
   * racing a reload) — storage untouched, same contract `fuseBuildings` has.
   *
   * Write order mirrors `fuseBuildings`'s (§5.4): the ledger chunk and core go
   * FIRST, in a single `saveEntriesForMonth` call, then the buildings chunk.
   * A crash between the two leaves the entry pointing at a building that
   * doesn't exist yet — inconsistent but nothing lost and nothing duplicated.
   * The other order would leave the marker set with the building already
   * standing, and re-presenting the dialog would build a SECOND one.
   *
   * ponytail: the two writes share the ~300ms debounce buffer and normally
   * flush in one batch, so that window is a formality. A true cross-chunk
   * transaction would need a boot-repair pass like `repairPendingFusions`;
   * add one only if the raw port ever stops coalescing.
   */
  const resolveGrowChoiceAction = useCallback((growTargetId?: string): AddEntryResult | null => {
    const prev = stateRef.current;
    const pending = prev?.town.pendingGrowChoice;
    if (prev === null || pending === undefined) return null;

    const today = clock.today();
    const now = clock.now();
    const storageClient = storageRef.current;
    const todayYm = today.slice(0, 7);
    // The persisted row, not the in-memory one: a backdated entry lives in a
    // month chunk `state.entries` (current month only, F10) may not hold.
    const { entries: chunkEntries } = storageClient.loadEntriesForMonth(pending.entryYm);
    // Placement is rolled HERE, not at 저장 time — the town may have filled up
    // in between (a boot drain, a 무지출 park), and `placeNew`'s answer then
    // would be stale. Same three values `addEntry` passes.
    const placed = placeNew(prev.buildings, random.next);
    const result = applyGrowChoice({
      town: prev.town,
      buildings: prev.buildings,
      entry: chunkEntries.find((e) => e.id === pending.entryId),
      growTargetId,
      buildingId: makeId("b", now),
      variantIndex: Math.floor(random.next() * BALANCE.variantsPerCategory),
      createdAt: now,
      today,
      tierThresholds: BALANCE.tierThresholds,
      materialQueueMax: BALANCE.materialQueueMax,
      plotIndex: placed?.anchor ?? null,
      w: placed?.w ?? 1,
      h: placed?.h ?? 1,
    });
    if (result === null) {
      // The marker outlived its entry (a corrupt/missing chunk). Clearing it
      // is the only way out — leaving it would re-present a dialog forever.
      const town: TownState = { ...prev.town };
      delete town.pendingGrowChoice;
      storageClient.saveCore({ town, budget: prev.budget, onboarded: prev.onboarded });
      const cleared: LoadedState = { ...prev, town };
      stateRef.current = cleared;
      setState(cleared);
      return null;
    }

    const patchedChunk = chunkEntries.map((e) => (e.id === result.entry.id ? result.entry : e));
    const core: CoreState = { town: result.town, budget: prev.budget, onboarded: prev.onboarded };
    storageClient.saveEntriesForMonth(pending.entryYm, patchedChunk, core);

    let buildings = prev.buildings;
    if (result.building) {
      const newBuilding = result.building;
      mutateBuildingsForMonth(storageClient, newBuilding.builtOn.slice(0, 7), (existing) => [...existing, newBuilding]);
      buildings = [...buildings, newBuilding];
    } else if (result.grownBuilding) {
      // The HOST's own builtOn month, which may predate this one — same
      // reasoning `addEntry`'s grow branch documents.
      const grownBuilding = result.grownBuilding;
      mutateBuildingsForMonth(storageClient, grownBuilding.builtOn.slice(0, 7), (existing) =>
        existing.map((b) => (b.id === grownBuilding.id ? grownBuilding : b)),
      );
      buildings = buildings.map((b) => (b.id === grownBuilding.id ? grownBuilding : b));
      // Guided highlight sequence — same before/after `totalLevelOf` compare
      // `addEntry`'s own grow branch documents; this is the OTHER path that
      // can grow an existing building (the deferred 새로짓기/키우기 choice).
      const grownBefore = prev.buildings.find((b) => b.id === grownBuilding.id);
      if (
        grownBefore &&
        totalLevelOf(grownBefore, BALANCE.expPerLevel, BALANCE.maxLevel) <
          totalLevelOf(grownBuilding, BALANCE.expPerLevel, BALANCE.maxLevel)
      ) {
        setSpotlight({ buildingId: grownBuilding.id, kind: "levelUp", seq: spotlightSeqRef.current++ });
      }
    }

    const next: LoadedState = {
      ...prev,
      town: result.town,
      buildings,
      entries: pending.entryYm === todayYm ? patchedChunk : prev.entries,
      historyEntries:
        pending.entryYm !== todayYm && prev.historyEntries[pending.entryYm] !== undefined
          ? { ...prev.historyEntries, [pending.entryYm]: patchedChunk }
          : prev.historyEntries,
    };
    stateRef.current = next;
    setState(next);

    // The entry/streak awards were already paid at 저장 time (both are keyed
    // by something this call can't change), so only the build and tier
    // bonuses are outstanding — the exact same two `addEntry` grants on its
    // own build branch.
    let seedsGranted = 0;
    if (result.building) {
      setJustBuiltId(result.building.id);
      setSpotlight({ buildingId: result.building.id, kind: "built", seq: spotlightSeqRef.current++ });
      if (countBuildings(prev.buildings) === 0) pushNotices({ kind: "firstBuilding" });
      const award = { kind: "build", buildingId: result.building.id, expGain: result.building.exp ?? 0 } as const;
      if (grantSeeds(award)) seedsGranted += awardFor(award).amount;
    }
    if (result.celebrateTier !== null) {
      pushNotices({ kind: "tier", tier: result.celebrateTier });
      const award = { kind: "tier", tier: result.celebrateTier } as const;
      if (grantSeeds(award)) seedsGranted += awardFor(award).amount;
    }
    return {
      building: result.building,
      grew: result.grownBuilding,
      queued: result.queuedMaterial !== null,
      queueOverflow: result.queueOverflow,
      queueLength: result.town.queue.length,
      seedsGranted,
    };
  }, [pushNotices, grantSeeds]);

  /**
   * F15: claim [오늘 무지출!]. Returns null when the domain function rejected
   * the claim (already claimed, an expense exists today, no slots, or a full
   * town whose queue is also at the cap); otherwise `queued` says whether the
   * park went up now or deferred to tomorrow morning's drain like an over-cap
   * ledger entry, so the toast can say which.
   */
  const claimNoSpend = useCallback((): { queued: boolean; queueLength: number } | null => {
    const prev = stateRef.current;
    if (prev === null) return null;

    const today = clock.today();
    const now = clock.now();
    const buildingId = makeId("b", now);
    const placed = placeNew(prev.buildings, random.next);
    const plotIndex = placed?.anchor ?? null; // null = town full -> park defers onto F14's queue, never an invisible park tile
    const w = placed?.w ?? 1;
    const h = placed?.h ?? 1;

    const result = claimNoSpendDay({
      town: prev.town,
      // Gate-3-rerun fix: literal count, matching the tier gate everywhere
      // else now (see `entryActions.ts`'s `buildingCountBeforeThis` doc), and
      // ADDENDUM-11 §5.1.3 makes that number `townScale`.
      existingBuildingCount: townScale(prev.buildings),
      entries: prev.entries,
      today,
      dailyBuildSlots: BALANCE.dailyBuildSlots,
      noSpendDayCostsSlot: BALANCE.noSpendDayCostsSlot,
      tierThresholds: BALANCE.tierThresholds,
      materialQueueMax: BALANCE.materialQueueMax,
      buildingId,
      createdAt: now,
      plotIndex,
      w,
      h,
    });
    if (result === null) return null;

    const storageClient = storageRef.current;
    const core: CoreState = { town: result.town, budget: prev.budget, onboarded: prev.onboarded };
    const newBuilding = result.building;
    // Deferred park: the queue lives on `town`, so the core write IS the whole
    // persistence — no buildings chunk yet, and nothing to celebrate until the
    // drain actually places it (same as an over-cap ledger entry's save).
    if (newBuilding !== null) {
      const buildYm = today.slice(0, 7);
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => [...existing, newBuilding]);
    }
    storageClient.saveCore(core);

    const next: LoadedState = {
      ...prev,
      town: result.town,
      buildings: newBuilding !== null ? [...prev.buildings, newBuilding] : prev.buildings,
    };
    stateRef.current = next;
    setState(next);
    if (newBuilding !== null) {
      setJustBuiltId(newBuilding.id);
      setSpotlight({ buildingId: newBuilding.id, kind: "built", seq: spotlightSeqRef.current++ });
      // Gate-3 follow-up (A2) — same first-building celebration as `addEntry`:
      // on a fresh town the 무지출 park can legitimately be building #1, and the
      // moment shouldn't be celebrated only on one of the two ways to reach it.
      if (countBuildings(prev.buildings) === 0) pushNotices({ kind: "firstBuilding" });
    }
    // Row 2 pays for the CLAIM, not for the tile — the day is 무지출 either way,
    // so this fires here on both branches, exactly once. Its key
    // (`seed:nospend:<date>`) is the claim date, so it survives the queue->drain
    // hop and the boot drain cannot pay for the same day a second time.
    grantSeeds({ kind: "nospend", date: today }); // ADDENDUM-05 — § F-ECON table row 2
    // Same streak-extension check as `addEntry` above — a claimed 무지출 day is
    // a full streak act (F7), so it can be the day's own streak-extending act too.
    if (result.town.lastActOn !== prev.town.lastActOn) {
      grantSeeds({ kind: "streak", date: today, streakDays: result.town.streakDays });
    }
    if (result.celebrateTier !== null) {
      pushNotices({ kind: "tier", tier: result.celebrateTier });
      grantSeeds({ kind: "tier", tier: result.celebrateTier }); // ADDENDUM-05 — § F-ECON table row 3
    }
    // Gate-3-rerun fix — same reasoning as `addEntry` above: `TownScreen.
    // handleClaimNoSpend` ALWAYS fires its own toast (either "대기" or "공원이
    // 생겼어요"), on every successful claim, so queuing the hint here would
    // always land in the same commit as that toast. Never attempted from this
    // path; deferred to the next boot or to a save that doesn't itself toast.
    return { queued: result.queuedMaterial !== null, queueLength: result.town.queue.length };
  }, [pushNotices, grantSeeds]);

  /**
   * ADDENDUM-11 §3/§3.1/§5.3/§5.4 — fuse `consumedId` into `survivorId`.
   *
   * Returns `null` and touches nothing when the pair fails any of §2.2's
   * F1-F6: the legality check lives in `applyFusion` (the one place that
   * mutates), not only at the CTA that offered it, so a stale sheet can never
   * commit an illegal fusion.
   *
   * Write order matters and is not arbitrary:
   *  1. 기록/cosmetics FIRST (§5.4). A crash after these leaves BOTH buildings
   *     standing with the entries already pointing at the survivor — nothing
   *     lost, nothing duplicated. Doing them last would open a window where
   *     the consumed building is gone and its entries point at a dead id with
   *     no `fusePending` left to trigger the boot repair.
   *  2. Then the buildings chunks, in `fusionChunkWrites`'s exact order — see
   *     its doc for the atomicity argument.
   */
  const fuseBuildings = useCallback((survivorId: string, consumedId: string): FuseBuildingsResult | null => {
    const prev = stateRef.current;
    if (prev === null) return null;
    const result = applyFusion(prev.buildings, survivorId, consumedId, BALANCE.expPerLevel, BALANCE.maxLevel);
    if (result === null) return null;

    const storageClient = storageRef.current;
    const core: CoreState = { town: prev.town, budget: prev.budget, onboarded: prev.onboarded };
    const patchedMonths = remapLedgerRefs(storageClient, core, consumedId, survivorId);
    const economy = transferBuildingSku(prev.economy, consumedId, survivorId);
    if (economy !== prev.economy) storageClient.saveEconomy(economy);

    for (const write of fusionChunkWrites(result.survivor, result.consumed)) {
      mutateBuildingsForMonth(storageClient, write.ym, write.mutate);
    }

    const todayYm = clock.today().slice(0, 7);
    let historyEntries = prev.historyEntries;
    for (const [ym, list] of patchedMonths) {
      if (ym !== todayYm && historyEntries[ym] !== undefined) historyEntries = { ...historyEntries, [ym]: list };
    }
    const next: LoadedState = {
      ...prev,
      buildings: result.buildings,
      entries: patchedMonths.get(todayYm) ?? prev.entries,
      historyEntries,
      economy,
    };
    stateRef.current = next;
    setState(next);

    // Gate-3-rerun fix (panel finding E2, all five experts): the fusion just
    // freed `result.consumed`'s cell(s), but nothing drained the F14 queue
    // to fill it — that only ran at next boot, so a full-town fusion showed
    // an emptied cell AND an unchanged "waiting for space" header in the
    // SAME session; the queued building only appeared after a reload. This
    // runs the exact same pure `drainQueue` boot already uses
    // (`settleAndDrainAndPersist`), right here, against the post-fusion
    // occupancy — no new drain logic, just wiring the existing one into the
    // moment a cell actually frees, same as boot wires it to app-open.
    const today = clock.today();
    const now = clock.now();
    const drainResult = drainQueue(
      next.town,
      townScale(next.buildings),
      today,
      BALANCE.dailyBuildSlots,
      BALANCE.tierThresholds,
      (i) => makeId("b", now + i),
      now,
      (count) => placeManyPlots(next.buildings, count, random.next),
      BALANCE.expAmountTiers,
    );
    if (drainResult.drained.length > 0) {
      const drainCore: CoreState = { town: drainResult.town, budget: next.budget, onboarded: next.onboarded };
      // Same "patch each drained material's own LedgerEntry" shape
      // `settleAndDrainAndPersist` uses — see that function's doc for why
      // `entryYm` (not `queuedOn`'s month) locates the chunk.
      const patchesByMonth = new Map<string, Map<string, string>>();
      for (const { material, building } of drainResult.drained) {
        if (material.entryYm === undefined || material.entryId === undefined) continue; // 무지출 park material — no ledger entry behind it
        const ym = material.entryYm;
        const patches = patchesByMonth.get(ym) ?? new Map<string, string>();
        patches.set(material.entryId, building.id);
        patchesByMonth.set(ym, patches);
      }
      const patchEntries = (entries: LedgerEntry[], patches: Map<string, string>) =>
        entries.map((e) => (patches.has(e.id) ? { ...e, buildingId: patches.get(e.id)!, queued: false } : e));
      for (const [ym, patches] of patchesByMonth) {
        const { entries } = storageClient.loadEntriesForMonth(ym);
        storageClient.saveEntriesForMonth(ym, patchEntries(entries, patches), drainCore);
      }
      const drainedBuildings = drainResult.drained.map((d) => d.building);
      const buildYm = today.slice(0, 7);
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => [...existing, ...drainedBuildings]);
      storageClient.saveCore(drainCore);

      let drainHistoryEntries = next.historyEntries;
      for (const [ym, patches] of patchesByMonth) {
        if (ym === buildYm) continue;
        const cached = drainHistoryEntries[ym];
        if (cached === undefined) continue; // not loaded into this session yet — the storage write above is enough, `ensureMonthLoaded` reads it fresh later
        drainHistoryEntries = { ...drainHistoryEntries, [ym]: patchEntries(cached, patches) };
      }
      const todaysPatches = patchesByMonth.get(buildYm);
      const postDrain: LoadedState = {
        ...next,
        town: drainResult.town,
        buildings: [...next.buildings, ...drainedBuildings],
        entries: todaysPatches ? patchEntries(next.entries, todaysPatches) : next.entries,
        historyEntries: drainHistoryEntries,
      };
      stateRef.current = postDrain;
      setState(postDrain);

      // Same award shape boot grants for its own drain (F-ECON table row 1);
      // `grantSeeds` is idempotent per building/tier id so this can never
      // double-pay if a future path also drains the same material.
      for (const b of drainedBuildings) {
        if (b.source.kind === "nospend") continue; // already paid on claim day (see settleAndDrainAndPersist's own note)
        grantSeeds({ kind: "build", buildingId: b.id, expGain: b.exp ?? 0 });
      }
      if (drainResult.celebrateTier !== null) grantSeeds({ kind: "tier", tier: drainResult.celebrateTier });
      pushNotices(
        { kind: "drained", count: drainResult.drained.length },
        ...(drainResult.celebrateTier !== null ? [{ kind: "tier", tier: drainResult.celebrateTier } as const] : []),
      );
    }

    // §5.3 — the idempotency key carries the RESULTING fuse tier, so the same
    // survivor pays again at every rung on its way to Lv.10 (an id-only key
    // would read a Lv.7 as an already-paid Lv.6). Granted after `stateRef` is
    // updated, same order `addEntry` uses — `grantSeeds` reads it.
    const award = { kind: "fuse", buildingId: survivorId, fuseTier: fuseOf(result.survivor) } as const;
    const seedsGranted = grantSeeds(award) ? awardFor(award).amount : 0;

    // Guided highlight sequence — the survivor is the one building left
    // standing; the consumed partner is already gone from `store.buildings`
    // by this point (`result.buildings` above), so there is nothing else it
    // could point at.
    setSpotlight({ buildingId: result.survivor.id, kind: "fused", seq: spotlightSeqRef.current++ });

    return {
      survivor: result.survivor,
      consumedId,
      level: totalLevelOf(result.survivor, BALANCE.expPerLevel, BALANCE.maxLevel),
      seedsGranted,
    };
  }, [grantSeeds, pushNotices]);

  /**
   * ADDENDUM-02 §4.2/§4.5 — the ONLY store action that mutates a building's
   * `plotIndex` after placement-time. Persists exactly one storage key: the
   * MOVED building's own month chunk, rebuilt from memory (never
   * read-modify-write — same reasoning `mutateBuildingsForMonth` explains).
   * `core` is never written here — a move is not a build-producing act (no
   * slot, no streak, no tier, no queue). The
   * discoverability hint's `moveHintSeen` flag is folded into the in-memory
   * `town` on the FIRST successful move (D-36) and rides whatever `saveCore`
   * happens next for any other reason — it is NOT written here, which is
   * what keeps this "exactly one key" (AC-M10/AC-H1).
   *
   * Flushed to the raw port IMMEDIATELY (not left on the normal ~300ms
   * debounce every other write uses) — a move is a single, deliberate,
   * infrequent tap, not a burst of rapid saves the debounce exists to
   * coalesce, and AC-M10 ("force-quit -> reopen: the building is on its new
   * lot") names exactly the failure mode a debounce window creates: a kill
   * inside those ~300ms would otherwise lose the move with nothing left to
   * flush it (round-2 finding C2 #2). Flushing also empties whatever OTHER
   * writes were still pending, which only ever moves their write earlier,
   * never adds one — the AC-M10 test still observes exactly one raw
   * `setItem` call for a move that runs with nothing else pending, matching
   * the "exactly one key" guarantee this fixes for the case that matters.
   */
  const moveBuilding = useCallback((id: string, to: number): MoveResult => {
    const prev = stateRef.current;
    if (prev === null) return { ok: false, reason: "not-found" };

    const result = movePlacement(prev.buildings, id, to);
    if (!result.ok) return result;

    const moved = result.buildings.find((b) => b.id === id)!;
    const ym = moved.builtOn.slice(0, 7);
    storageRef.current.saveBuildingsForMonth(
      ym,
      result.buildings.filter((b) => b.builtOn.slice(0, 7) === ym),
    );
    storageRef.current.flush();

    const town = prev.town.moveHintSeen ? prev.town : { ...prev.town, moveHintSeen: true };
    const next: LoadedState = { ...prev, town, buildings: result.buildings };
    stateRef.current = next;
    setState(next);
    return result;
  }, []);

  // ── F8/F9 — 기록 (history) ──

  /** Loads `ym`'s entries chunk into `historyEntries` if it isn't already known — a no-op for the current month (already in `entries`) or an already-cached month. Synchronous: `loadEntriesForMonth` only ever hits the (already in-memory) debounce buffer or a single `localStorage.getItem`. */
  const ensureMonthLoaded = useCallback((ym: string) => {
    const prev = stateRef.current;
    if (prev === null) return;
    const todayYm = clock.today().slice(0, 7);
    if (ym === todayYm || prev.historyEntries[ym] !== undefined) return;
    const { entries } = storageRef.current.loadEntriesForMonth(ym);
    const next: LoadedState = { ...prev, historyEntries: { ...prev.historyEntries, [ym]: entries } };
    stateRef.current = next;
    setState(next);
  }, []);

  /** `ym`'s entries — `[]` if that month hasn't been loaded yet (call `ensureMonthLoaded` first). */
  const getMonthEntries = useCallback((ym: string): LedgerEntry[] => {
    const prev = stateRef.current;
    if (prev === null) return [];
    return entriesForMonth(prev, ym, clock.today().slice(0, 7)) ?? [];
  }, []);

  /** ADDENDUM-12 §9 — see `EntryMutability`'s own doc. `ym` is the month chunk the caller has `entry` loaded from (same param `deleteEntry`/`updateEntry` take). */
  const entryMutability = useCallback((entry: LedgerEntry, ym: string): EntryMutability => {
    const todayYm = clock.today().slice(0, 7);
    if (ym !== todayYm) return { canEdit: false, canEditAmount: false, canDelete: false, reason: "past-month" };
    if (isFusionEntangled(stateRef.current?.buildings ?? [], entry)) {
      return { canEdit: true, canEditAmount: false, canDelete: false, reason: "fused" };
    }
    return { canEdit: true, canEditAmount: true, canDelete: true, reason: null };
  }, []);

  /** ADDENDUM-12 §3.3/§7 — the delete confirm dialog's honest preview: seeds this delete would actually claw back, and the shortfall (if any) that would land on `seedDebt` instead. Mirrors `deleteEntryEffects`' own recompute-from-stored-fields math (INV-12.1) without mutating anything. */
  const seedClawbackPreview = useCallback((entry: LedgerEntry): { seeds: number; shortfall: number } => {
    const prev = stateRef.current;
    if (prev === null) return { seeds: 0, shortfall: 0 };
    const gain = expGainFor(entry.amountKrw, BALANCE.expAmountTiers);
    let total = 0;
    const entryAward = awardFor({ kind: "entry", entryId: entry.id, expGain: gain });
    if (prev.economy.grantedEventKeys.includes(entryAward.eventKey)) total += entryAward.amount;
    const bound = buildingForEntry(prev.buildings, entry.id);
    if (bound) {
      const buildAward = awardFor({ kind: "build", buildingId: bound.id, expGain: gain });
      if (prev.economy.grantedEventKeys.includes(buildAward.eventKey)) total += buildAward.amount;
    }
    return { seeds: total, shortfall: Math.max(0, total - prev.economy.seeds) };
  }, []);

  /**
   * F9 delete — thin wiring over `historyActions.deleteEntryEffects` (pure):
   * persists the removed building's OLD month chunk (if any — round-4
   * finding C3: building count -1, the plot becomes a permanent empty lot,
   * and the slot is NOT refunded) and the entry's own month chunk (which also carries
   * `town` — the queue-drop for a still-queued entry and the 저축 back-out,
   * both computed by the pure function, round-4 finding C2/C3).
   */
  const deleteEntry = useCallback((entryId: string, ym: string) => {
    const prev = stateRef.current;
    if (prev === null) return;
    const todayYm = clock.today().slice(0, 7);
    const list = entriesForMonth(prev, ym, todayYm);
    const entry = list?.find((e) => e.id === entryId);
    if (!entry) return;
    // ADDENDUM-12 §9 — the trust boundary: self-check even though the UI
    // already disables this action (§4 past-month, §5 fused).
    if (!entryMutability(entry, ym).canDelete) return;

    let result = deleteEntryEffects({ town: prev.town, buildings: prev.buildings, entry, expAmountTiers: BALANCE.expAmountTiers, economy: prev.economy });

    // Gate-3-rerun fix (all 5 experts' TOP FIX, record-then-delete streak
    // leak): `deleteEntryEffects` claws back this entry's own `seed:entry`/
    // `seed:build` grants, but the day's `seed:streak:<date>` grant is a
    // separate per-DAY act, not per-entry, so it survived — net +2..20
    // seeds with zero entries left to justify the streak. Only reversed
    // when TODAY is the day in question: that's the only day whose
    // streakDays-at-grant-time we can still recover (`prev.town.streakDays`
    // — it cannot have advanced again since, because a day only advances
    // the streak once). A backdated entry deleted on a LATER day would need
    // that earlier day's streakDays snapshot, which nothing persists.
    // ponytail: bounded ceiling (today-only); persist streakDays-per-date
    // if an exact reversal for older days is ever needed.
    const today = clock.today();
    const todayStartMs = ymdToDate(today).getTime();
    const createdToday = entry.createdAt >= todayStartMs && entry.createdAt < todayStartMs + 86_400_000;
    if (createdToday) {
      const otherActToday = prev.entries
        .concat(...Object.values(prev.historyEntries))
        .some((e) => e.id !== entry.id && e.createdAt >= todayStartMs && e.createdAt < todayStartMs + 86_400_000);
      const nospendToday = prev.buildings.some((b) => b.source.kind === "nospend" && b.source.date === today);
      if (!otherActToday && !nospendToday) {
        result = { ...result, economy: revokeAward(result.economy, awardFor({ kind: "streak", date: today, streakDays: prev.town.streakDays })) };
      }
    }

    const storageClient = storageRef.current;
    // ADDENDUM-12 §8 — write order: economy FIRST (a mid-write abort here
    // only costs the player seeds, never a live/dead-entry mismatch), THEN
    // the building chunk, THEN entries.
    if (result.economy !== prev.economy) storageClient.saveEconomy(result.economy);
    if (result.removedBuilding) {
      const { id, ym: buildYm } = result.removedBuilding;
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => existing.filter((b) => b.id !== id));
    } else if (result.grownBuilding) {
      // ADDENDUM-04 §6 — a grow-contribution delete backs EXP out of the
      // host's OWN month chunk instead (may differ from `ym`).
      const grownBuilding = result.grownBuilding;
      const grownYm = grownBuilding.builtOn.slice(0, 7);
      mutateBuildingsForMonth(storageClient, grownYm, (existing) => existing.map((b) => (b.id === grownBuilding.id ? grownBuilding : b)));
    }

    const newList = list!.filter((e) => e.id !== entryId);
    const core: CoreState = { town: result.town, budget: prev.budget, onboarded: prev.onboarded };
    storageClient.saveEntriesForMonth(ym, newList, core);

    const next: LoadedState = {
      ...prev,
      town: result.town,
      buildings: result.buildings,
      economy: result.economy,
      entries: ym === todayYm ? newList : prev.entries,
      historyEntries: ym === todayYm ? prev.historyEntries : { ...prev.historyEntries, [ym]: newList },
    };
    stateRef.current = next;
    setState(next);
  }, [entryMutability]);

  /**
   * F9 edit — thin wiring over `historyActions.editEntryEffects` (pure, see
   * its own doc for the four type-change cases; round-4 finding C1 made
   * `type` itself editable). A fresh building/plot/variant is only rolled
   * when the edit could possibly need one (저축 -> 지출/수입, the one case
   * that can newly consume a slot) — same `placeNew`/`random.next` calls
   * `addEntry` already makes for a real F1 save.
   */
  const updateEntry = useCallback((entryId: string, ym: string, patch: EntryEditPatch) => {
    const prev = stateRef.current;
    if (prev === null) return;
    const todayYm = clock.today().slice(0, 7);
    const list = entriesForMonth(prev, ym, todayYm);
    const oldEntry = list?.find((e) => e.id === entryId);
    if (!oldEntry) return;
    // ADDENDUM-12 §9 — the trust boundary: self-check even though the UI
    // already disables the relevant fields (§4 past-month, §5 fused).
    const mutability = entryMutability(oldEntry, ym);
    if (!mutability.canEdit) return;
    // canEditAmount also gates `type` (spec §9 doc: "금액·타입(경제에 영향)").
    if ((patch.amountKrw !== undefined || patch.type !== undefined) && !mutability.canEditAmount) return;
    // ADDENDUM-12 §4 — occurredOn must stay inside the current month; `ym`
    // is already known === todayYm here (mutability.canEdit ruled out past-month).
    if (patch.occurredOn !== undefined && patch.occurredOn.slice(0, 7) !== todayYm) return;

    const now = clock.now();
    const needsFreshBuilding = oldEntry.type === "saving" && patch.type !== undefined && patch.type !== "saving";
    const newBuildingId = needsFreshBuilding ? makeId("b", now) : "";
    const variantIndex = needsFreshBuilding ? Math.floor(random.next() * BALANCE.variantsPerCategory) : 0;
    const placed = needsFreshBuilding ? placeNew(prev.buildings, random.next) : null;
    // Null both when no fresh building is needed (nothing reads it) and when
    // the town is full — `decideBuildOrQueue` queues rather than founding.
    const plotIndex = placed?.anchor ?? null;
    const w = placed?.w ?? 1;
    const h = placed?.h ?? 1;

    const result = editEntryEffects({
      town: prev.town,
      buildings: prev.buildings,
      entry: oldEntry,
      patch,
      today: clock.today(),
      dailyBuildSlots: BALANCE.dailyBuildSlots,
      materialQueueMax: BALANCE.materialQueueMax,
      tierThresholds: BALANCE.tierThresholds,
      newBuildingId,
      variantIndex,
      plotIndex,
      w,
      h,
      now,
      expAmountTiers: BALANCE.expAmountTiers,
      economy: prev.economy,
    });

    const storageClient = storageRef.current;
    // ADDENDUM-12 §8 — economy FIRST, same order/reasoning as `deleteEntry`.
    if (result.economy !== prev.economy) storageClient.saveEconomy(result.economy);
    const oldBound = buildingForEntry(prev.buildings, entryId);
    if (result.removedBuilding) {
      const { id, ym: buildYm } = result.removedBuilding;
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => existing.filter((b) => b.id !== id));
    } else if (result.newBuilding) {
      const newBuilding = result.newBuilding;
      const buildYm = newBuilding.builtOn.slice(0, 7);
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => [...existing, newBuilding]);
    } else if (result.grownBuilding) {
      // ADDENDUM-04 §6 — a grow-contribution's 지출/수입 -> 저축 edit backs EXP
      // out of the host's OWN month chunk instead (may differ from `ym`/`newYm`).
      const grownBuilding = result.grownBuilding;
      const grownYm = grownBuilding.builtOn.slice(0, 7);
      mutateBuildingsForMonth(storageClient, grownYm, (existing) => existing.map((b) => (b.id === grownBuilding.id ? grownBuilding : b)));
    } else if (oldBound) {
      // Same building, possibly re-skinned in place (category or 지출<->수입 type flip) — only re-persist its chunk when it actually changed.
      const stillBound = result.buildings.find((b) => b.id === oldBound.id);
      if (stillBound && stillBound.categoryId !== oldBound.categoryId) {
        const buildYm = oldBound.builtOn.slice(0, 7);
        mutateBuildingsForMonth(storageClient, buildYm, (existing) => existing.map((b) => (b.id === oldBound.id ? stillBound : b)));
      }
    }

    const newEntry = result.entry;
    const newYm = newEntry.occurredOn.slice(0, 7);
    const core: CoreState = { town: result.town, budget: prev.budget, onboarded: prev.onboarded };
    let entries = prev.entries;
    let historyEntries = prev.historyEntries;

    if (newYm === ym) {
      const updatedList = list!.map((e) => (e.id === entryId ? newEntry : e));
      storageClient.saveEntriesForMonth(ym, updatedList, core);
      if (ym === todayYm) entries = updatedList;
      else historyEntries = { ...historyEntries, [ym]: updatedList };
    } else {
      // Cross-month re-date: remove from the OLD chunk, append to the NEW
      // one — two `saveEntriesForMonth` writes, exactly the "moves the entry
      // between month chunks" the spec names. The destination month's
      // existing entries are read fresh from storage when this session
      // hasn't visited it yet, never assumed empty.
      const oldList = list!.filter((e) => e.id !== entryId);
      storageClient.saveEntriesForMonth(ym, oldList, core);
      if (ym === todayYm) entries = oldList;
      else historyEntries = { ...historyEntries, [ym]: oldList };

      const destList = entriesForMonth({ entries, historyEntries }, newYm, todayYm) ?? storageClient.loadEntriesForMonth(newYm).entries;
      const newDestList = [...destList, newEntry];
      storageClient.saveEntriesForMonth(newYm, newDestList, core);
      if (newYm === todayYm) entries = newDestList;
      else historyEntries = { ...historyEntries, [newYm]: newDestList };
    }

    const next: LoadedState = { ...prev, town: result.town, buildings: result.buildings, economy: result.economy, entries, historyEntries };
    stateRef.current = next;
    setState(next);
  }, [entryMutability]);

  // ── S6 설정 — F6's "editable from 기록" half + town name + 데이터 초기화 ──

  /** F6: the one global monthly budget, `null` to unset it (pins mood neutral, `moodTier`'s own contract). Persists via `saveCore` like every other core-field mutation here (setTownName below, F9's edits). */
  const setBudget = useCallback((monthlyBudgetKrw: number | null) => {
    const prev = stateRef.current;
    if (prev === null) return;
    const budget: BudgetSetting = { monthlyBudgetKrw, updatedAt: clock.now() };
    storageRef.current.saveCore({ town: prev.town, budget, onboarded: prev.onboarded });
    const next: LoadedState = { ...prev, budget };
    stateRef.current = next;
    setState(next);
  }, []);

  const setTownName = useCallback((townName: string) => {
    const prev = stateRef.current;
    if (prev === null) return;
    const town: TownState = { ...prev.town, townName };
    storageRef.current.saveCore({ town, budget: prev.budget, onboarded: prev.onboarded });
    const next: LoadedState = { ...prev, town };
    stateRef.current = next;
    setState(next);
  }, []);

  /**
   * F11 — S1's one-shot dismiss. Fires once, when the cold-start onboarding
   * overlay closes (skip or finish, treated identically — spec makes no
   * distinction). Same write shape as `setTownName`/`setBudget` above: only
   * `onboarded` changes, everything else on `core` rides along unchanged.
   */
  const completeOnboarding = useCallback(() => {
    const prev = stateRef.current;
    if (prev === null || prev.onboarded) return;
    storageRef.current.saveCore({ town: prev.town, budget: prev.budget, onboarded: true });
    const next: LoadedState = { ...prev, onboarded: true };
    stateRef.current = next;
    setState(next);
    // A5 — see awards.ts's "welcome" doc. Placed after the `onboarded` write
    // so `grantSeeds` re-reads the state just committed to `stateRef`; it is
    // itself idempotent on the `seed:welcome` key, and the early return above
    // already makes a second `completeOnboarding()` a no-op, so this cannot
    // double-pay from either direction.
    grantSeeds({ kind: "welcome" });
  }, [grantSeeds]);

  // ── ADDENDUM-05 (F-BGM / F-ECON) ──

  /** F-BGM mute toggle — lives on `budget` (see `BudgetSetting.bgmMuted`'s own doc comment), same write shape as `setBudget`/`setTownName` above. */
  const setBgmMuted = useCallback((muted: boolean) => {
    const prev = stateRef.current;
    if (prev === null) return;
    const budget: BudgetSetting = { ...prev.budget, bgmMuted: muted };
    storageRef.current.saveCore({ town: prev.town, budget, onboarded: prev.onboarded });
    const next: LoadedState = { ...prev, budget };
    stateRef.current = next;
    setState(next);
  }, []);

  /**
   * S8 shop — buys `sku` for `priceSeeds`. Never goes negative (checked
   * before deducting). Two shapes, per the frozen SKU convention
   * (economy/types.ts's `NPC_SLOT_SKU` doc comment):
   *  - `NPC_SLOT_SKU` — repeatable, bumps `purchasedNpcSlots`, never touches
   *    `ownedSkus` (so it can never return `"alreadyOwned"`). Refused with
   *    `"maxed"`, seeds untouched, once another slot would buy nothing
   *    visible (`npcCount` already at `NPC_MAX_VISIBLE`).
   *  - everything else (`deco.*`, `npc.species.*`) — one-time, appends to
   *    `ownedSkus`; ownership is permanent (ADDENDUM-03 DE-9 rule 4 —
   *    deleting a building never revokes a purchase, since ownership lives
   *    here, not on the building).
   */
  const purchaseSku = useCallback((sku: string, priceSeeds: number): PurchaseSkuResult => {
    const prev = stateRef.current;
    if (prev === null) return "insufficient";

    if (sku === NPC_SLOT_SKU) {
      const npcCountNow = 1 + townScale(prev.buildings) + prev.economy.purchasedNpcSlots; // same formula as `npcCount` below — ADDENDUM-11 §5.5
      if (npcCountNow >= NPC_MAX_VISIBLE) return "maxed";
      if (prev.economy.seeds < priceSeeds) return "insufficient";
      const economy: EconomyState = {
        ...prev.economy,
        seeds: seedCount(prev.economy.seeds - priceSeeds),
        purchasedNpcSlots: prev.economy.purchasedNpcSlots + 1,
      };
      storageRef.current.saveEconomy(economy);
      const next: LoadedState = { ...prev, economy };
      stateRef.current = next;
      setState(next);
      return "ok";
    }

    if (prev.economy.ownedSkus.includes(sku)) return "alreadyOwned";
    if (prev.economy.seeds < priceSeeds) return "insufficient";
    const economy: EconomyState = {
      ...prev.economy,
      seeds: seedCount(prev.economy.seeds - priceSeeds),
      ownedSkus: [...prev.economy.ownedSkus, sku],
    };
    storageRef.current.saveEconomy(economy);
    const next: LoadedState = { ...prev, economy };
    stateRef.current = next;
    setState(next);
    return "ok";
  }, []);

  /** S8 — selects (or clears, `sku: null`) the town-wide 마을 꾸미기 skin. A no-op when `sku` isn't owned (defensive; the shop UI should never offer an unowned sku here). */
  const applyTownSku = useCallback((sku: string | null) => {
    const prev = stateRef.current;
    if (prev === null || (sku !== null && !prev.economy.ownedSkus.includes(sku))) return;
    const economy: EconomyState = { ...prev.economy, appliedTownSku: sku };
    storageRef.current.saveEconomy(economy);
    const next: LoadedState = { ...prev, economy };
    stateRef.current = next;
    setState(next);
  }, []);

  /** S8 — selects (or clears) a per-building 건물 꾸미기 cosmetic. Same ownership guard as `applyTownSku`. */
  const applyBuildingSku = useCallback((buildingId: string, sku: string | null) => {
    const prev = stateRef.current;
    if (prev === null || (sku !== null && !prev.economy.ownedSkus.includes(sku))) return;
    const appliedByBuildingId = { ...prev.economy.appliedByBuildingId };
    if (sku === null) delete appliedByBuildingId[buildingId];
    else appliedByBuildingId[buildingId] = sku;
    const economy: EconomyState = { ...prev.economy, appliedByBuildingId };
    storageRef.current.saveEconomy(economy);
    const next: LoadedState = { ...prev, economy };
    stateRef.current = next;
    setState(next);
  }, []);

  /**
   * 데이터 초기화 (S6) — wipes every stored chunk (`storage.ts`'s `clearAll`,
   * written for exactly this call site — see its own doc comment) and resets
   * in-memory state to the same fresh-install shape `freshCore` gives a
   * brand-new boot, in place. Deliberately NOT a `window.location.reload()`:
   * `clearAll` already cancels any pending debounced write (so nothing can
   * resurrect after), and resetting in memory keeps this synchronous and
   * testable without depending on jsdom/real navigation.
   */
  const resetAll = useCallback(() => {
    const prev = stateRef.current;
    if (prev === null) return;
    storageRef.current.clearAll();
    const next = freshCore(clock.now(), clock.today());
    stateRef.current = next;
    setState(next);
  }, []);

  /**
   * F12 내보내기 — serializes every stored chunk plus the core into one JSON
   * string ready to hand to a `<a download>`/Blob. Both `storage.ts` steps
   * are time-budgeted/yielded (§10.4): `exportAll` reads every chunk back
   * out, `serializeExport` then stringifies it chunk-by-chunk rather than
   * one `JSON.stringify` over the whole state — round-1 finding C4 #2, the
   * one genuinely unbounded step a dense town's export used to have. Toss
   * mini-app constraint (this task's brief): this is a WebView, not a native
   * shell — "download a file" needs no Apps-in-Toss SDK, only the standard
   * browser APIs the caller (SettingsSheet) already reaches for.
   */
  const exportData = useCallback(async (): Promise<{ json: string; filename: string }> => {
    const data = await storageRef.current.exportAll();
    const json = await serializeExport(data);
    return { json, filename: `town-export-${clock.today()}.json` };
  }, []);

  /**
   * F12 가져오기 — validates + replaces every chunk (`storage.ts`'s
   * `importAll`: an unknown/missing `schemaVersion` or malformed JSON is
   * rejected there, storage untouched, before this function is even reached
   * for the success path). On success, reloads in-memory state straight from
   * storage via `loadBoot` (the exact same read path a real boot uses) rather
   * than re-running `reconcilePlacement`/`settleAndDrainAndPersist` — the
   * imported chunks already went through both once, on the machine that
   * exported them, so replaying either here would risk the "byte-identical"
   * AC by re-deriving instead of just loading what was written.
   */
  const importData = useCallback(async (rawJson: string): Promise<ImportResult> => {
    const result = storageRef.current.importAll(rawJson);
    if (!result.ok) return result;

    const boot = await storageRef.current.loadBoot();
    if (boot.core === null) {
      // importAll just wrote a core chunk — reading back null means the
      // WRITE itself failed (storage quota/blocked, platform/storage.ts's
      // own "silently dropped" note), not that the imported file was invalid.
      return { ok: false, error: "가져오기에 실패했어요. 저장 공간을 확인해주세요." };
    }
    const today = clock.today();
    entriesYmRef.current = today.slice(0, 7);
    const { entries } = storageRef.current.loadEntriesForMonth(today.slice(0, 7));
    const next: LoadedState = {
      town: boot.core.town,
      buildings: boot.buildings,
      entries,
      historyEntries: {},
      budget: boot.core.budget,
      onboarded: boot.core.onboarded,
      economy: boot.economy ?? defaultEconomyState(),
    };
    stateRef.current = next;
    setState(next);
    return { ok: true };
  }, []);

  const today = clock.today();
  return {
    loading: state === null,
    townName: state?.town.townName ?? "",
    buildings: state?.buildings ?? [],
    // Gate-3-rerun fix (near-unanimous panel finding, both rounds): the
    // "single accessor" idea above sounded clean but was wrong — it made
    // `TownHeader`'s "건물 N채" report `townScale`, which does not decrement
    // when a fusion consumes a building, so the header overstated the town's
    // literal building count forever after any fusion (confirmed in two
    // independent runs, and the stale figure survived a reload since it's
    // persisted). The literal array length is what "건물 N채" means to a
    // player counting his own grid; `townScale` is a separate concept (tier
    // math only, Σ 2**fuse) and gets its own field below.
    buildingCount: state ? countBuildings(state.buildings) : 0,
    // ADDENDUM-11 §5.1.3 — the town's scale in Lv.5-equivalents, for tier
    // math and the tier-celebration's "N more to next tier" line ONLY. Never
    // feed this to anything that displays as a building count. Identical to
    // `buildingCount` above for a town with nothing fused, so an existing
    // save's tier is unchanged on first load.
    townScale: state ? townScale(state.buildings) : 0,
    // ADDENDUM-04 §3 — the tier-driving score (`buildings.length + Σexp`).
    // `buildingCount` above is unchanged and still the literal count 기록/UI want.
    growthScore: state ? computeGrowthScore(state.buildings) : 0,
    // ADDENDUM-04 §4 — pure selector the UI calls to build the grow dialog's
    // candidate set / pick-mode highlight.
    growCandidates: (categoryId: CategoryId) => (state ? selectGrowCandidates(state.buildings, categoryId) : []),
    // ── ADDENDUM-11 (building fusion) ──
    // §6 step 2 — the partners `buildingId` may fuse with. Empty when the
    // tapped building itself is ineligible (not Lv.5, a monument, a 무지출
    // park tile, already Lv.10) or simply has no matching partner, which is
    // the condition for showing the 융합하기 CTA at all: no partner, no button.
    fuseCandidates: (buildingId: string) =>
      state ? fusePartners(state.buildings, buildingId, BALANCE.expPerLevel, BALANCE.maxLevel) : [],
    fuseBuildings,
    /** §2.4 — the level a building displays, EXP level + fuse tier (1..10). */
    levelOfBuilding: (b: Building) => totalLevelOf(b, BALANCE.expPerLevel, BALANCE.maxLevel),
    slotsRemaining: state ? slotsRemainingToday(state.town, today, BALANCE.dailyBuildSlots) : BALANCE.dailyBuildSlots,
    dailyBuildSlots: BALANCE.dailyBuildSlots,
    streakDays: state?.town.streakDays ?? 0,
    longestStreakDays: state?.town.longestStreakDays ?? 0,
    // Header-honesty fix: `streakAtRisk` below collapses "alive, act today to
    // extend" and "already broken, today restarts from 1" into one boolean,
    // so the header showed a dead 31-day streak as if it were still running.
    // The raw date goes out too, and `selectors.streakDisplay` derives the
    // shown number/copy from it through the SAME `advanceStreak` rule the
    // save path uses — the display can't drift from what a save will do.
    lastActOn: state?.town.lastActOn ?? null,
    // Gate-3-rerun fix (liveops-pd's TOP FIX): true once a streak exists AND
    // today's act hasn't happened yet — the header's one visible "act today
    // or the streak resets tonight" signal. `lastActOn !== today` alone would
    // also be true on the very first day of a town's life (streakDays still
    // 0 then), which is not a streak "at risk" — nothing to protect yet.
    streakAtRisk: state ? state.town.streakDays > 0 && state.town.lastActOn !== today : false,
    queueLength: state?.town.queue.length ?? 0,
    canClaimNoSpend: state
      ? selectCanClaimNoSpend(state.entries, state.town, today, BALANCE.dailyBuildSlots, BALANCE.noSpendDayCostsSlot)
      : false,
    today,
    justBuiltId,
    savingsByCategoryKrw: state?.town.savingsByCategoryKrw,
    justGrew,
    clearJustGrew,
    spotlight,
    clearSpotlight,
    notice,
    dismissNotice,
    // F11 — S1 onboarding: `false` only for a genuinely fresh install
    // (`freshCore`'s default) until `completeOnboarding` fires once.
    onboarded: state?.onboarded ?? true,
    completeOnboarding,
    addEntry,
    // ADDENDUM-04 §4 — the persisted 새로짓기/키우기 choice, or null. The UI
    // shows its dialog off THIS, not off a local `useState`, which is what
    // makes the choice survive a reload instead of taking the entry with it.
    pendingGrowChoice: (state?.town.pendingGrowChoice ?? null) as PendingGrowChoice | null,
    resolveGrowChoice: resolveGrowChoiceAction,
    claimNoSpend,
    moveBuilding,
    // ── F8/F9 기록 ──
    budgetKrw: state?.budget.monthlyBudgetKrw ?? null,
    noSpendDays: state?.town.noSpendDays ?? [],
    getMonthEntries,
    ensureMonthLoaded,
    deleteEntry,
    updateEntry,
    entryMutability,
    seedClawbackPreview,
    // ── S6 설정 ──
    setBudget,
    setTownName,
    resetAll,
    exportData,
    importData,
    // ── ADDENDUM-05 (F-BGM / F-ECON) ──
    bgmMuted: state?.budget.bgmMuted ?? false,
    setBgmMuted,
    economy: state?.economy ?? defaultEconomyState(),
    grantSeeds,
    purchaseSku,
    applyTownSku,
    applyBuildingSku,
    // F-NPC count rule: 1 base + 1 per building + purchased slots, capped at
    // NPC_MAX_VISIBLE (a render-perf ceiling — see that const's own comment).
    // ADDENDUM-11 §5.5 — fed `townScale` so the crowd does not thin out with
    // every fusion (a fusion removes a building but the town got no smaller).
    npcCount: state ? Math.min(1 + townScale(state.buildings) + state.economy.purchasedNpcSlots, NPC_MAX_VISIBLE) : 1,
  };
}

/** The hook's own return shape — lets S3/S5 components (`HistoryScreen`, `EntryDetailSheet`'s callers) type a `Pick<TownStore, ...>` prop instead of re-declaring each field's type by hand. */
export type TownStore = ReturnType<typeof useTownStore>;
