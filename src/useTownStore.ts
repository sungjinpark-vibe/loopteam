/**
 * S2/S4 state — boots from chunked storage (T002), applies F1+F2 on save,
 * and now (this task, build order step 3) wires the retention layer: F4
 * daily slot reset, F14 queue drain, F5 tier celebration, F7 streak, and F15
 * 무지출 데이 claim/revoke.
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
import { useCallback, useEffect, useRef, useState } from "react";
import { applyNewEntry, type EntryDraft } from "./entryActions";
import { claimNoSpendDay } from "./noSpendActions";
import { drainQueue } from "./queueActions";
import { makeId } from "./id";
import { clock } from "./platform/clock";
import { BALANCE } from "./balance.placeholder";
import { buildingCount as countBuildings, canClaimNoSpend as selectCanClaimNoSpend, slotsRemainingToday } from "./selectors";
import { createChunkedStorage, defaultTownState, yieldToMainThread, type CoreState } from "./storage";
import type { Building, BudgetSetting, LedgerEntry, TownState } from "./types";

interface LoadedState {
  town: TownState;
  buildings: Building[];
  /** Current month only (F10) — sufficient for F15's "any 지출 today?" check. */
  entries: LedgerEntry[];
  budget: BudgetSetting;
  onboarded: boolean;
}

export interface AddEntryResult {
  /** The building placed for this entry, or null when it queued, overflowed, or was a 저축 entry. */
  building: Building | null;
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
}

function freshCore(now: number): LoadedState {
  return {
    town: defaultTownState(),
    buildings: [],
    entries: [],
    budget: { monthlyBudgetKrw: null, updatedAt: now },
    onboarded: true, // F11 onboarding is out of scope for this task — go straight to the town
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
  | { kind: "tier"; tier: number };

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
 * F14: drains the queue (pure `drainQueue`) then performs the storage side
 * effects a real drain needs — patching each drained material's own
 * `LedgerEntry` (buildingId + queued:false) and writing the new buildings /
 * updated core. Runs once, right after boot, before the app is shown.
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
async function drainQueueAndPersist(
  storageClient: ReturnType<typeof createChunkedStorage>,
  town: TownState,
  buildings: readonly Building[],
  budget: BudgetSetting,
  onboarded: boolean,
  today: string,
  now: number,
): Promise<{ town: TownState; buildings: Building[]; celebrateTier: number | null; drainedCount: number }> {
  const result = drainQueue(
    town,
    buildings.length,
    today,
    BALANCE.dailyBuildSlots,
    BALANCE.tierThresholds,
    // One deterministic id per drained material, keyed off its queue index
    // (i = 0, 1, 2, ...) per the function's own contract — not a random id
    // that happens to be unique by luck of `Math.random()`.
    (i) => makeId("b", now + i),
    now,
  );
  if (result.drained.length === 0) {
    return { town: result.town, buildings: [...buildings], celebrateTier: null, drainedCount: 0 };
  }

  const patchesByMonth = new Map<string, Map<string, string>>(); // ym -> entryId -> buildingId
  for (const { material, building } of result.drained) {
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

  const newBuildings = result.drained.map((d) => d.building);
  const buildYm = today.slice(0, 7);
  mutateBuildingsForMonth(storageClient, buildYm, (existing) => [...existing, ...newBuildings]);
  storageClient.saveCore(core);

  return {
    town: result.town,
    buildings: [...buildings, ...newBuildings],
    celebrateTier: result.celebrateTier,
    drainedCount: result.drained.length,
  };
}

export function useTownStore() {
  // One client for the component's lifetime — its debounce buffer must
  // survive across renders/saves, not reset per save.
  const storageRef = useRef(createChunkedStorage());
  const [state, setState] = useState<LoadedState | null>(null);
  const [justBuiltId, setJustBuiltId] = useState<string | null>(null);
  // One FIFO queue for every one-shot notice (F10 corruption, F14 "return
  // promise kept" on boot, F5 tier celebration) — see the `Notice` doc
  // comment above. `notice` is always the head; dismissing pops it.
  const [noticeQueue, setNoticeQueue] = useState<Notice[]>([]);
  const notice = noticeQueue[0] ?? null;
  const dismissNotice = useCallback(() => setNoticeQueue((q) => q.slice(1)), []);
  const pushNotices = useCallback((...toAdd: Notice[]) => {
    if (toAdd.length === 0) return;
    setNoticeQueue((q) => [...q, ...toAdd]);
  }, []);

  // Mirrors `state` for `addEntry`/`claimNoSpend` to read synchronously,
  // written only from an effect (never during render) and then updated again
  // by those handlers directly, same reasoning as T003's original note.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // `bootPromiseRef` caches the in-flight `loadBoot()` call itself across
  // StrictMode's dev-only mount -> cleanup -> remount — see T003's original
  // note on why a second real call would be unsafe.
  const bootPromiseRef = useRef<ReturnType<(typeof storageRef)["current"]["loadBoot"]> | null>(null);
  useEffect(() => {
    let cancelled = false;
    bootPromiseRef.current ??= storageRef.current.loadBoot();
    void bootPromiseRef.current.then(async (boot) => {
      if (cancelled) return;
      const core = boot.core ?? freshCore(clock.now());
      const today = clock.today();
      const storageClient = storageRef.current;

      // F14: drain the materials queue FIFO, AFTER F4's slot reset — the
      // reset is purely evaluated (slotsRemainingToday) at drain time.
      const drained = await drainQueueAndPersist(
        storageClient,
        core.town,
        boot.buildings,
        core.budget,
        core.onboarded,
        today,
        clock.now(),
      );
      if (cancelled) return;
      const { entries: currentMonthEntries } = storageClient.loadEntriesForMonth(today.slice(0, 7));

      setState({
        town: drained.town,
        buildings: drained.buildings,
        entries: currentMonthEntries,
        budget: core.budget,
        onboarded: core.onboarded,
      });
      const bootNotices: Notice[] = [];
      if (boot.corrupted.length > 0) bootNotices.push({ kind: "corruption", message: summarizeCorruption(boot.corrupted.length) });
      if (drained.drainedCount > 0) bootNotices.push({ kind: "drained", count: drained.drainedCount });
      if (drained.celebrateTier !== null) bootNotices.push({ kind: "tier", tier: drained.celebrateTier });
      pushNotices(...bootNotices);
    });
    return () => {
      cancelled = true;
    };
  }, [pushNotices]);

  // storage.ts's own doc comment on `flush()` — unchanged from T003.
  useEffect(() => {
    function flushNow() {
      storageRef.current.flush();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flushNow();
    }
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // NOTE (T003, still true): assumes addEntry/claimNoSpend are called once
  // and awaited (via the UI) before the next call.
  const addEntry = useCallback((draft: EntryDraft): AddEntryResult => {
    const prev = stateRef.current;
    if (prev === null) return { building: null, queued: false, queueOverflow: false, queueLength: 0 };

    const today = clock.today();
    const now = clock.now();
    const entryId = makeId("e", now);
    const buildingId = makeId("b", now);
    const variantIndex = Math.floor(Math.random() * BALANCE.variantsPerCategory);

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
    }

    const todayYm = today.slice(0, 7);
    const entries = entryYm === todayYm ? [...prev.entries, result.entry] : prev.entries;

    const next: LoadedState = { ...prev, town: result.town, buildings, entries };
    stateRef.current = next;
    setState(next);
    if (result.building) setJustBuiltId(result.building.id);
    if (result.celebrateTier !== null) pushNotices({ kind: "tier", tier: result.celebrateTier });

    return {
      building: result.building,
      queued: result.queuedMaterial !== null,
      queueOverflow: result.queueOverflow,
      queueLength: result.town.queue.length,
    };
  }, [pushNotices]);

  /** F15: claim [오늘 무지출!]. Returns false when the domain function rejected the claim (already claimed, an expense exists today, or no slots). */
  const claimNoSpend = useCallback((): boolean => {
    const prev = stateRef.current;
    if (prev === null) return false;

    const today = clock.today();
    const now = clock.now();
    const buildingId = makeId("b", now);

    const result = claimNoSpendDay({
      town: prev.town,
      existingBuildingCount: prev.buildings.length,
      entries: prev.entries,
      today,
      dailyBuildSlots: BALANCE.dailyBuildSlots,
      noSpendDayCostsSlot: BALANCE.noSpendDayCostsSlot,
      tierThresholds: BALANCE.tierThresholds,
      buildingId,
      createdAt: now,
    });
    if (result === null) return false;

    const storageClient = storageRef.current;
    const core: CoreState = { town: result.town, budget: prev.budget, onboarded: prev.onboarded };
    const buildYm = today.slice(0, 7);
    const newBuilding = result.building;
    mutateBuildingsForMonth(storageClient, buildYm, (existing) => [...existing, newBuilding]);
    storageClient.saveCore(core);

    const next: LoadedState = { ...prev, town: result.town, buildings: [...prev.buildings, result.building] };
    stateRef.current = next;
    setState(next);
    setJustBuiltId(result.building.id);
    if (result.celebrateTier !== null) pushNotices({ kind: "tier", tier: result.celebrateTier });
    return true;
  }, [pushNotices]);

  const today = clock.today();
  return {
    loading: state === null,
    townName: state?.town.townName ?? "",
    buildings: state?.buildings ?? [],
    nextPlotIndex: state?.town.nextPlotIndex ?? 0,
    buildingCount: state ? countBuildings(state.buildings) : 0,
    slotsRemaining: state ? slotsRemainingToday(state.town, today, BALANCE.dailyBuildSlots) : BALANCE.dailyBuildSlots,
    dailyBuildSlots: BALANCE.dailyBuildSlots,
    streakDays: state?.town.streakDays ?? 0,
    longestStreakDays: state?.town.longestStreakDays ?? 0,
    queueLength: state?.town.queue.length ?? 0,
    canClaimNoSpend: state
      ? selectCanClaimNoSpend(state.entries, state.town, today, BALANCE.dailyBuildSlots, BALANCE.noSpendDayCostsSlot)
      : false,
    today,
    justBuiltId,
    notice,
    dismissNotice,
    addEntry,
    claimNoSpend,
  };
}
