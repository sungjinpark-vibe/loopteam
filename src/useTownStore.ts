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
import { applyNewEntry, type EntryDraft } from "./entryActions";
import { buildingForEntry, deleteEntryEffects, editEntryEffects, type EntryEditPatch } from "./historyActions";
import { claimNoSpendDay } from "./noSpendActions";
import { drainQueue } from "./queueActions";
import { allocatePlots, moveBuilding as movePlacement, pickPlot, reconcilePlacement, type MoveResult } from "./placement";
import { makeId } from "./id";
import { analytics } from "./platform/analytics";
import { clock, getTimeTravelDate, subscribeTimeTravel } from "./platform/clock";
import { random } from "./platform/random";
import { BALANCE } from "./balance.approved";
import {
  buildingCount as countBuildings,
  canClaimNoSpend as selectCanClaimNoSpend,
  grownStructures,
  ladderFor,
  slotsRemainingToday,
} from "./selectors";
import { createChunkedStorage, defaultTownState, serializeExport, yieldToMainThread, type CoreState, type ImportResult } from "./storage";
import type { Building, BudgetSetting, LedgerEntry, SavingCategoryId, TownState } from "./types";

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
}

/** `ym`'s entries from whichever of `entries`/`historyEntries` holds them — `undefined` if that month hasn't been loaded yet (F8's "only the viewed chunk loads"). */
function entriesForMonth(
  state: Pick<LoadedState, "entries" | "historyEntries">,
  ym: string,
  todayYm: string,
): LedgerEntry[] | undefined {
  return ym === todayYm ? state.entries : state.historyEntries[ym];
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

// F9's edit-patch shape (now including `type`, round-4 finding C1) lives in
// `historyActions.ts` next to the pure functions that apply it — re-exported
// here so existing importers (`EntryDetailSheet`, `HistoryScreen`) keep
// reading it off `useTownStore`.
export type { EntryEditPatch };

function freshCore(now: number): LoadedState {
  return {
    town: defaultTownState(),
    buildings: [],
    entries: [],
    historyEntries: {},
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
  | { kind: "savings"; id: SavingCategoryId };

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
    // ADDENDUM-02 §3.3/§3.5 (B18): N distinct random lots for this drain,
    // drawn once so no two drained buildings can collide.
    (count) => allocatePlots(town.nextPlotIndex, buildings, count, random.next),
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
  // One FIFO queue for every one-shot notice (F10 corruption, F14 "return
  // promise kept" on boot, F5 tier celebration) — see the `Notice` doc
  // comment above. `notice` is always the head; dismissing pops it.
  const [noticeQueue, setNoticeQueue] = useState<Notice[]>([]);
  const notice = noticeQueue[0] ?? null;
  const dismissNotice = useCallback(() => {
    // ADDENDUM-02 §4.5 — "dismissed forever ... by an explicit dismiss": the
    // moveHint is one-shot across SESSIONS, not just within one, so dismissing
    // it must flip `moveHintSeen` in memory right here (not only on a
    // successful move) so it rides whatever `saveCore` happens next for any
    // other reason (round-2 finding C1 #2 — this was previously the ONLY gap:
    // a player who saw the toast and never moved anything got it re-queued
    // every session, forever).
    if (notice?.kind === "moveHint" && stateRef.current && !stateRef.current.town.moveHintSeen) {
      const next: LoadedState = { ...stateRef.current, town: { ...stateRef.current.town, moveHintSeen: true } };
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

      // ADDENDUM-02 §3.6 — self-healing reconcile, BEFORE anything else
      // (the drain below allocates lots and must see sane occupancy). Zero
      // storage writes for the 100%-of-real-towns case where nothing is
      // wrong (repaired === 0 and plotsOpened already matches nextPlotIndex).
      const reconciled = reconcilePlacement(core.town.nextPlotIndex, boot.buildings);
      const coreNeedsWrite = reconciled.plotsOpened !== core.town.nextPlotIndex;
      const reconciledTown: TownState = coreNeedsWrite ? { ...core.town, nextPlotIndex: reconciled.plotsOpened } : core.town;
      if (reconciled.repaired > 0) {
        // Only months that actually contain a repaired building, ascending
        // ym order — rebuilt from the reconciled in-memory array, never
        // read-modify-write. Position-indexed comparison against `boot.buildings`
        // is safe: `reconcilePlacement` preserves array order/identity for
        // every untouched entry (its own contract).
        const repairedMonths = new Set<string>();
        for (let i = 0; i < reconciled.buildings.length; i++) {
          if (reconciled.buildings[i] !== boot.buildings[i]) repairedMonths.add(reconciled.buildings[i].builtOn.slice(0, 7));
        }
        for (const ym of [...repairedMonths].sort()) {
          storageClient.saveBuildingsForMonth(ym, reconciled.buildings.filter((b) => b.builtOn.slice(0, 7) === ym));
        }
        // No player-facing notice — they did nothing wrong (§3.6 point 6).
        analytics.track("placement_repaired", { count: reconciled.repaired });
      }
      if (coreNeedsWrite) {
        storageClient.saveCore({ town: reconciledTown, budget: core.budget, onboarded: core.onboarded });
      }

      // F14: drain the materials queue FIFO, AFTER F4's slot reset — the
      // reset is purely evaluated (slotsRemainingToday) at drain time.
      const drained = await drainQueueAndPersist(
        storageClient,
        reconciledTown,
        reconciled.buildings,
        core.budget,
        core.onboarded,
        today,
        clock.now(),
      );
      if (cancelled) return;
      entriesYmRef.current = today.slice(0, 7);
      const { entries: currentMonthEntries } = storageClient.loadEntriesForMonth(today.slice(0, 7));

      setState({
        town: drained.town,
        buildings: drained.buildings,
        entries: currentMonthEntries,
        historyEntries: {},
        budget: core.budget,
        onboarded: core.onboarded,
      });
      const bootNotices: Notice[] = [];
      if (boot.corrupted.length > 0) bootNotices.push({ kind: "corruption", message: summarizeCorruption(boot.corrupted.length) });
      if (drained.drainedCount > 0) bootNotices.push({ kind: "drained", count: drained.drainedCount });
      if (drained.celebrateTier !== null) bootNotices.push({ kind: "tier", tier: drained.celebrateTier });
      if (boot.relayout) bootNotices.push({ kind: "relayout" }); // ADDENDUM-01 §3.6
      pushNotices(...bootNotices);
      // ADDENDUM-02 §4.5 is a STATE condition ("once the town has >= 2
      // buildings and the hint has not been seen, the town screen shows a
      // one-shot hint"), not a build-action event — so it must also be
      // evaluated right here, once, at the end of boot. Every town that
      // exists today has `moveHintSeen` unset; without this call none of them
      // would ever be told the gesture exists until their NEXT build-producing
      // action (round-2 finding C1 #1). `maybeQueueMoveHint`'s own queue-order
      // guard (skip if the notice queue is already non-empty) means this
      // never races the boot notices just pushed above.
      maybeQueueMoveHint(drained.town, countBuildings(drained.buildings));
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

  // NOTE (T003, still true): assumes addEntry/claimNoSpend are called once
  // and awaited (via the UI) before the next call.
  const addEntry = useCallback((draft: EntryDraft): AddEntryResult => {
    const prev = stateRef.current;
    if (prev === null) return { building: null, queued: false, queueOverflow: false, queueLength: 0 };

    const today = clock.today();
    const now = clock.now();
    const entryId = makeId("e", now);
    const buildingId = makeId("b", now);
    const variantIndex = Math.floor(random.next() * BALANCE.variantsPerCategory);
    // ADDENDUM-02 §3.3/§3.5 (B16/B24): a uniformly random free lot, computed
    // here exactly like `variantIndex` already is, and passed in — placement.ts
    // is the only module allowed to decide a plotIndex (rule R-4).
    const plotIndex = pickPlot(prev.town.nextPlotIndex, prev.buildings, random.next);

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
    maybeQueueMoveHint(result.town, countBuildings(buildings));

    return {
      building: result.building,
      queued: result.queuedMaterial !== null,
      queueOverflow: result.queueOverflow,
      queueLength: result.town.queue.length,
    };
  }, [pushNotices, maybeQueueMoveHint]);

  /** F15: claim [오늘 무지출!]. Returns false when the domain function rejected the claim (already claimed, an expense exists today, or no slots). */
  const claimNoSpend = useCallback((): boolean => {
    const prev = stateRef.current;
    if (prev === null) return false;

    const today = clock.today();
    const now = clock.now();
    const buildingId = makeId("b", now);
    const plotIndex = pickPlot(prev.town.nextPlotIndex, prev.buildings, random.next);

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
      plotIndex,
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
    maybeQueueMoveHint(result.town, countBuildings(next.buildings));
    return true;
  }, [pushNotices, maybeQueueMoveHint]);

  /**
   * ADDENDUM-02 §4.2/§4.5 — the ONLY store action that mutates a building's
   * `plotIndex` after placement-time. Persists exactly one storage key: the
   * MOVED building's own month chunk, rebuilt from memory (never
   * read-modify-write — same reasoning `mutateBuildingsForMonth` explains).
   * `core` (and therefore `nextPlotIndex`) is never written here — a move is
   * not a build-producing act (no slot, no streak, no tier, no queue). The
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

    const result = movePlacement(prev.town.nextPlotIndex, prev.buildings, id, to);
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

  /**
   * F9 delete — thin wiring over `historyActions.deleteEntryEffects` (pure):
   * persists the removed building's OLD month chunk (if any — round-4
   * finding C3: building count -1, plot becomes a permanent empty lot,
   * `nextPlotIndex` never decremented so nothing else reflows, and the slot
   * is NOT refunded) and the entry's own month chunk (which also carries
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

    const result = deleteEntryEffects({ town: prev.town, buildings: prev.buildings, entry });
    const storageClient = storageRef.current;
    if (result.removedBuilding) {
      const { id, ym: buildYm } = result.removedBuilding;
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => existing.filter((b) => b.id !== id));
    }

    const newList = list!.filter((e) => e.id !== entryId);
    const core: CoreState = { town: result.town, budget: prev.budget, onboarded: prev.onboarded };
    storageClient.saveEntriesForMonth(ym, newList, core);

    const next: LoadedState = {
      ...prev,
      town: result.town,
      buildings: result.buildings,
      entries: ym === todayYm ? newList : prev.entries,
      historyEntries: ym === todayYm ? prev.historyEntries : { ...prev.historyEntries, [ym]: newList },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  /**
   * F9 edit — thin wiring over `historyActions.editEntryEffects` (pure, see
   * its own doc for the four type-change cases; round-4 finding C1 made
   * `type` itself editable). A fresh building/plot/variant is only rolled
   * when the edit could possibly need one (저축 -> 지출/수입, the one case
   * that can newly consume a slot) — same `pickPlot`/`random.next` calls
   * `addEntry` already makes for a real F1 save.
   */
  const updateEntry = useCallback((entryId: string, ym: string, patch: EntryEditPatch) => {
    const prev = stateRef.current;
    if (prev === null) return;
    const todayYm = clock.today().slice(0, 7);
    const list = entriesForMonth(prev, ym, todayYm);
    const oldEntry = list?.find((e) => e.id === entryId);
    if (!oldEntry) return;

    const now = clock.now();
    const needsFreshBuilding = oldEntry.type === "saving" && patch.type !== undefined && patch.type !== "saving";
    const newBuildingId = needsFreshBuilding ? makeId("b", now) : "";
    const variantIndex = needsFreshBuilding ? Math.floor(random.next() * BALANCE.variantsPerCategory) : 0;
    const plotIndex = needsFreshBuilding ? pickPlot(prev.town.nextPlotIndex, prev.buildings, random.next) : 0;

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
      now,
    });

    const storageClient = storageRef.current;
    const oldBound = buildingForEntry(prev.buildings, entryId);
    if (result.removedBuilding) {
      const { id, ym: buildYm } = result.removedBuilding;
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => existing.filter((b) => b.id !== id));
    } else if (result.newBuilding) {
      const newBuilding = result.newBuilding;
      const buildYm = newBuilding.builtOn.slice(0, 7);
      mutateBuildingsForMonth(storageClient, buildYm, (existing) => [...existing, newBuilding]);
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

    const next: LoadedState = { ...prev, town: result.town, buildings: result.buildings, entries, historyEntries };
    stateRef.current = next;
    setState(next);
  }, []);

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
    const next = freshCore(clock.now());
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
   * than re-running `reconcilePlacement`/`drainQueueAndPersist` — the
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
    savingsByCategoryKrw: state?.town.savingsByCategoryKrw,
    justGrew,
    clearJustGrew,
    notice,
    dismissNotice,
    addEntry,
    claimNoSpend,
    moveBuilding,
    // ── F8/F9 기록 ──
    budgetKrw: state?.budget.monthlyBudgetKrw ?? null,
    noSpendDays: state?.town.noSpendDays ?? [],
    getMonthEntries,
    ensureMonthLoaded,
    deleteEntry,
    updateEntry,
    // ── S6 설정 ──
    setBudget,
    setTownName,
    resetAll,
    exportData,
    importData,
  };
}

/** The hook's own return shape — lets S3/S5 components (`HistoryScreen`, `EntryDetailSheet`'s callers) type a `Pick<TownStore, ...>` prop instead of re-declaring each field's type by hand. */
export type TownStore = ReturnType<typeof useTownStore>;
