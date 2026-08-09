/**
 * Grid pick-mode for ADDENDUM-04 §4's grow dialog ("기존 건물 키우기" with 2+
 * candidates) — the exact same shape as `useMoveMode.ts` (enter a mode,
 * highlight tiles, tap one to commit, cancel via `onCancel`/`useBackGuard`),
 * factored the same way so `TownScreen` composes both without duplicating the
 * back-guard/cancel plumbing.
 *
 * Unlike `useMoveMode`, there is no reject-message/undo here — a tap outside
 * the candidate set is a documented no-op (§4: "tapping one grows it"; no AC
 * asks for a rejection toast), and a successful grow has nothing to undo
 * (§5: growing only adds EXP, there's no plot to move back).
 *
 * Mutually exclusive with move mode by construction, not by a shared lock:
 * pick mode can only start from `TownScreen.handleGrow` (after the entry
 * sheet has already closed), and the FAB — the only way to open that sheet —
 * is hidden whenever `useMoveMode`'s `movingId` is set, so the two can never
 * both be entered. `TownScreen` also has to stop long-press from starting
 * move mode WHILE pick mode is active (see its own wiring) — this hook only
 * owns its own half.
 */
import { useCallback, useState } from "react";
import type { Building } from "../types";
import { useBackGuard } from "./useBackGuard";

export interface UseGrowPickModeResult {
  /** The live candidate ids, or null outside pick mode. */
  candidateIds: ReadonlySet<string> | null;
  /** Enters pick mode with this candidate set. */
  start: (candidateIds: ReadonlySet<string>) => void;
  /** A tile was tapped — commits (calls `onCommit`) only if it's a candidate; otherwise a no-op. */
  onPlotTap: (plotIndex: number) => void;
  /** [취소] / Escape / Android back — leaves pick mode with nothing committed. */
  cancel: () => void;
}

export function useGrowPickMode(
  buildings: readonly Building[],
  onCommit: (buildingId: string) => void,
): UseGrowPickModeResult {
  const [candidateIds, setCandidateIds] = useState<ReadonlySet<string> | null>(null);

  const cancel = useCallback(() => setCandidateIds(null), []);

  // Same Android/gesture-back consumption `useMoveMode` uses. Safe to wire
  // unconditionally (armed only while `candidateIds !== null`) for the same
  // reason `useMoveMode`'s own `cancel` is idempotent.
  useBackGuard(candidateIds !== null, false, cancel);

  const start = useCallback((ids: ReadonlySet<string>) => setCandidateIds(ids), []);

  const onPlotTap = useCallback(
    (plotIndex: number) => {
      if (candidateIds === null) return;
      const building = buildings.find((b) => b.plotIndex === plotIndex);
      if (!building || !candidateIds.has(building.id)) return; // non-candidate tap: no-op
      setCandidateIds(null);
      onCommit(building.id);
    },
    [candidateIds, buildings, onCommit],
  );

  return { candidateIds, start, onPlotTap, cancel };
}
