/**
 * S2/S4 state — boots from chunked storage (T002) and applies F1+F2 on save.
 *
 * Single responsibility: owns the town/buildings state and the one mutation
 * (`addEntry`) this task needs. All the actual domain logic lives in
 * `entryActions.ts` (pure, unit-tested); this hook is only wiring — read the
 * boot state, call the pure function, persist the result, re-render.
 *
 * `addEntry` deliberately does NOT use `setState(prev => ...)`: it is a plain
 * event handler (called once per 저장 tap, never from inside a state updater),
 * so it reads `stateRef.current` directly, performs the storage side effects
 * once, then commits a plain next-state value. `<StrictMode>` (main.tsx)
 * double-invokes *updater functions* passed to `setState` to catch impurity —
 * it does not double-invoke plain event handlers — so keeping every side
 * effect (storage writes, the `variantIndex` roll) out of an updater is what
 * makes this safe under StrictMode, not just tidy.
 *
 * `justBuiltId` is never cleared back to `null`: it exists only so
 * `TownGrid` knows which building should play the CSS rise-in animation
 * (`building-tile-rise`, App.css). That animation runs once on mount and
 * holds its end state — it does not loop — so leaving the class (and this
 * id) in place forever is correct, not a leak, and it means a save's
 * `justBuiltId` update never fires a *second* time on a timer purely to
 * unset it. That second, timer-only update was pure animation-teardown
 * churn: it forced `TownGrid`'s tiles `useMemo` (keyed in part on
 * `justBuiltId`) to rebuild the whole tile list, at the exact tile counts
 * where that becomes the dense-state bottleneck (§5 F3's ~5,400-building AC,
 * deferred by this task but not to be made worse by it).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { applyNewEntry, type EntryDraft } from "./entryActions";
import { makeId } from "./id";
import { clock } from "./platform/clock";
import { BALANCE } from "./balance.placeholder";
import { buildingCount as countBuildings, slotsRemainingToday } from "./selectors";
import { createChunkedStorage, defaultTownState, type CoreState } from "./storage";
import type { Building, BudgetSetting, TownState } from "./types";

interface LoadedState {
  town: TownState;
  buildings: Building[];
  budget: BudgetSetting;
  onboarded: boolean;
}

export interface AddEntryResult {
  /** The building placed for this entry, or null when no build slot remained today (the entry still saved). */
  building: Building | null;
}

function freshCore(now: number): LoadedState {
  return {
    town: defaultTownState(),
    buildings: [],
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

export function useTownStore() {
  // One client for the component's lifetime — its debounce buffer must
  // survive across renders/saves, not reset per save.
  const storageRef = useRef(createChunkedStorage());
  const [state, setState] = useState<LoadedState | null>(null);
  const [justBuiltId, setJustBuiltId] = useState<string | null>(null);
  const [corruptionNotice, setCorruptionNotice] = useState<string | null>(null);
  const dismissCorruptionNotice = useCallback(() => setCorruptionNotice(null), []);

  // Mirrors `state` for `addEntry` to read synchronously, written only from
  // an effect (never during render — a render that's interrupted/discarded
  // must never leave this ref pointing at state that never actually
  // committed) and then updated again by `addEntry` itself below, which is a
  // plain event-handler write, not a render-phase one.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // `bootPromiseRef` caches the in-flight `loadBoot()` call itself (not just
  // its result) across StrictMode's dev-only mount -> cleanup -> remount:
  // `loadBoot()` isn't a pure read — `storage.ts` self-heals a corrupt index
  // chunk the moment it's read — so a second real call would find the first
  // call's healed index and silently report zero corruption, exactly the
  // "silently discarded" failure this effect exists to prevent. Reusing one
  // shared promise means the boot side effect runs exactly once regardless
  // of how many times this effect body runs; `cancelled` still guards which
  // *invocation* is allowed to commit the result to state.
  const bootPromiseRef = useRef<ReturnType<(typeof storageRef)["current"]["loadBoot"]> | null>(null);
  useEffect(() => {
    let cancelled = false;
    bootPromiseRef.current ??= storageRef.current.loadBoot();
    void bootPromiseRef.current.then((boot) => {
      if (cancelled) return;
      const core = boot.core ?? freshCore(clock.now());
      setState({ town: core.town, buildings: boot.buildings, budget: core.budget, onboarded: core.onboarded });
      if (boot.corrupted.length > 0) setCorruptionNotice(summarizeCorruption(boot.corrupted.length));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // storage.ts's own doc comment on `flush()`: "call before ... tearing down
  // a page where a pending 300ms debounce timer would otherwise never fire."
  // `pagehide` covers both tab close and backgrounding (fires more reliably
  // cross-browser than `beforeunload`, especially on mobile WebViews);
  // `visibilitychange` catches the same backgrounding case even when the
  // page is merely hidden, not torn down, since a debounced write left
  // pending while backgrounded is exactly the loss this task's reload AC
  // must not have.
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

  // NOTE: assumes addEntry is called once and awaited (via the UI) before
  // the next call — true for this task's single save button. Two addEntry
  // calls fired back-to-back before a render flushes would both read the
  // same stateRef snapshot's *storage* reads (loadEntriesForMonth) since only
  // stateRef.current is updated synchronously here, not the storage client's
  // own view; add a queue if a second concurrent save path is ever added.
  const addEntry = useCallback((draft: EntryDraft): AddEntryResult => {
    const prev = stateRef.current;
    if (prev === null) return { building: null };

    const today = clock.today();
    const now = clock.now();
    const entryId = makeId("e", now);
    const buildingId = makeId("b", now);
    const variantIndex = Math.floor(Math.random() * BALANCE.variantsPerCategory);

    const { entry, building, town } = applyNewEntry({
      town: prev.town,
      draft,
      entryId,
      buildingId,
      createdAt: now,
      today,
      dailyBuildSlots: BALANCE.dailyBuildSlots,
      variantIndex,
    });

    const storageClient = storageRef.current;
    const core: CoreState = { town, budget: prev.budget, onboarded: prev.onboarded };

    const entryYm = draft.occurredOn.slice(0, 7);
    const { entries: existingEntries } = storageClient.loadEntriesForMonth(entryYm);
    storageClient.saveEntriesForMonth(entryYm, [...existingEntries, entry], core);

    let buildings = prev.buildings;
    if (building) {
      const buildYm = building.builtOn.slice(0, 7);
      const { buildings: existingBuildings } = storageClient.loadBuildingsForMonth(buildYm);
      storageClient.saveBuildingsForMonth(buildYm, [...existingBuildings, building]);
      buildings = [...prev.buildings, building];
    }

    const next: LoadedState = { ...prev, town, buildings };
    stateRef.current = next;
    setState(next);
    if (building) setJustBuiltId(building.id);

    return { building };
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
    today,
    justBuiltId,
    corruptionNotice,
    dismissCorruptionNotice,
    addEntry,
  };
}
