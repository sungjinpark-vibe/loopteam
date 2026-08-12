/**
 * Grid pick-mode for ADDENDUM-04 §4's grow dialog ("기존 건물 키우기" with 2+
 * candidates) — the exact same shape as `useMoveMode.ts` (enter a mode,
 * highlight tiles, tap one to commit, cancel via `onCancel`/`useBackGuard`),
 * factored the same way so `TownScreen` composes both without duplicating the
 * back-guard/cancel plumbing.
 *
 * Unlike `useMoveMode`, there is no undo here — a successful grow has nothing
 * to undo (§5: growing only adds EXP, there's no plot to move back).
 *
 * Gate-3 follow-up (A1): a tap outside the candidate set used to be a SILENT
 * no-op, which — with the FAB hidden for the duration of pick mode — is what
 * made the panel report "no way out, the primary button is gone". Move mode
 * already solved the same problem with an inline `rejectMessage` shown in its
 * banner while the mode stays open; this hook now mirrors that field exactly
 * (same state + timer + clear-on-cancel shape), so `TownScreen` can render
 * both banners from one `rejectMessage ?? instruction` expression.
 *
 * Mutually exclusive with move mode by construction, not by a shared lock:
 * pick mode can only start from `TownScreen.handleGrow` (after the entry
 * sheet has already closed), and the FAB — the only way to open that sheet —
 * is hidden whenever `useMoveMode`'s `movingId` is set, so the two can never
 * both be entered. `TownScreen` also has to stop long-press from starting
 * move mode WHILE pick mode is active (see its own wiring) — this hook only
 * owns its own half.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Building } from "../types";
import { useBackGuard } from "./useBackGuard";

/** Same duration `useMoveMode` shows its own inline reject hint for. */
const REJECT_MESSAGE_MS = 2500;
/** Placeholder copy (D-36 discipline) — shown when a tap lands outside the highlighted candidates. */
const NOT_A_CANDIDATE_MESSAGE = "표시된 건물 중에서 골라주세요";

export interface UseGrowPickModeResult {
  /** The live candidate ids, or null outside pick mode. */
  candidateIds: ReadonlySet<string> | null;
  /** Non-null briefly after tapping anything that is not a candidate — mode stays open (mirrors `useMoveMode.rejectMessage`). */
  rejectMessage: string | null;
  /** Enters pick mode with this candidate set. */
  start: (candidateIds: ReadonlySet<string>) => void;
  /** A tile was tapped — commits (calls `onCommit`) only if it's a candidate; otherwise shows `rejectMessage`. */
  onPlotTap: (plotIndex: number) => void;
  /** [취소] / Escape / Android back — leaves pick mode with nothing committed. */
  cancel: () => void;
}

export function useGrowPickMode(
  buildings: readonly Building[],
  onCommit: (buildingId: string) => void,
): UseGrowPickModeResult {
  const [candidateIds, setCandidateIds] = useState<ReadonlySet<string> | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRejectTimer = useCallback(() => {
    if (rejectTimerRef.current !== null) {
      clearTimeout(rejectTimerRef.current);
      rejectTimerRef.current = null;
    }
  }, []);
  // Unmount safety only — this timer drives UI state, never persistence.
  useEffect(() => clearRejectTimer, [clearRejectTimer]);

  const cancel = useCallback(() => {
    clearRejectTimer();
    setCandidateIds(null);
    setRejectMessage(null);
  }, [clearRejectTimer]);

  // Same Android/gesture-back consumption `useMoveMode` uses. Safe to wire
  // unconditionally (armed only while `candidateIds !== null`) for the same
  // reason `useMoveMode`'s own `cancel` is idempotent.
  useBackGuard(candidateIds !== null, false, cancel);

  const start = useCallback(
    (ids: ReadonlySet<string>) => {
      clearRejectTimer();
      setRejectMessage(null);
      setCandidateIds(ids);
    },
    [clearRejectTimer],
  );

  const onPlotTap = useCallback(
    (plotIndex: number) => {
      if (candidateIds === null) return;
      const building = buildings.find((b) => b.plotIndex === plotIndex);
      if (!building || !candidateIds.has(building.id)) {
        // Was a silent no-op before the Gate-3 A1 follow-up — same inline
        // hint/mode-stays-open shape `useMoveMode` uses for an occupied lot.
        setRejectMessage(NOT_A_CANDIDATE_MESSAGE);
        clearRejectTimer();
        rejectTimerRef.current = setTimeout(() => setRejectMessage(null), REJECT_MESSAGE_MS);
        return;
      }
      clearRejectTimer();
      setRejectMessage(null);
      setCandidateIds(null);
      onCommit(building.id);
    },
    [candidateIds, buildings, onCommit, clearRejectTimer],
  );

  return { candidateIds, rejectMessage, start, onPlotTap, cancel };
}
