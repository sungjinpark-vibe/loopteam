/**
 * Move-mode orchestration — ADDENDUM-02 §4.3's "Move mode" state machine,
 * extracted from `App.tsx` so the semantics (what a long-press/tap MEANS)
 * are testable independent of the gesture recognizer (`useTileGestures`,
 * which only reports raw events) and independent of rendering.
 *
 * `moving` state lives here (mirrors the addendum's "state lives in App.tsx
 * as `moving: { id, from } | null`" — this hook IS that state, just factored
 * out), ephemeral and never persisted: a reload always lands in the normal
 * town, which is the correct and cheapest behaviour (§4.3).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "../platform/analytics";
import { haptics } from "../platform/haptics";
import type { MoveResult } from "../placement";
import type { Building } from "../types";
import { useBackGuard } from "./useBackGuard";

const UNDO_TIMEOUT_MS = 5000; // assumption (§9) — the ~5s auto-hide on the 되돌리기 bar
const REJECT_MESSAGE_MS = 2500;

/** Placeholder copy (D-36) — the director may edit; only the mechanism is MUST. */
const OCCUPIED_MESSAGE = "이미 건물이 있는 자리예요";
/** Placeholder copy — shown when 되돌리기 itself is rejected (round-2 finding C2 #3). */
const UNDO_FAILED_MESSAGE = "원래 자리에 다른 건물이 생겼어요";

export interface JustMoved {
  id: string;
  from: number;
  to: number;
}

export interface UseMoveModeResult {
  /** The building currently being moved, or null outside move mode. */
  movingId: string | null;
  /** Roving keyboard cursor — null until the first arrow key (pointer users never pay for it). */
  cursorIndex: number | null;
  /** Non-null for ~5s after a successful move — drives the 되돌리기 bar. */
  justMoved: JustMoved | null;
  /** Non-null briefly after tapping an occupied lot in move mode — mode stays open. */
  rejectMessage: string | null;
  /**
   * Non-null briefly after 되돌리기 (undo) itself was rejected — e.g. the
   * vacated `from` lot was taken by a new build during the 5s undo window.
   * `justMoved` is left untouched in that case (not dismissed) so the bar
   * stays up and a retry is still possible for as long as the window lasts.
   */
  undoFailedMessage: string | null;
  /** Returns whether a building was actually grabbed — see `useTileGestures`'s `onLongPress` contract. */
  onPlotLongPress: (plotIndex: number) => boolean;
  onPlotTap: (plotIndex: number) => void;
  onCursorMove: (nextIndex: number) => void;
  /** [취소] button / Escape (via TownGrid) / Android back (via useBackGuard, wired internally). */
  cancel: () => void;
  /** 되돌리기 — moves the same building back to `justMoved.from`. */
  undo: () => void;
  /** 완료 — dismisses the post-move bar early. */
  dismissJustMoved: () => void;
}

export function useMoveMode(
  buildings: readonly Building[],
  moveBuilding: (id: string, to: number) => MoveResult,
): UseMoveModeResult {
  const [movingId, setMovingId] = useState<string | null>(null);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [justMoved, setJustMoved] = useState<JustMoved | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const [undoFailedMessage, setUndoFailedMessage] = useState<string | null>(null);

  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoFailedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);
  const clearRejectTimer = useCallback(() => {
    if (rejectTimerRef.current !== null) {
      clearTimeout(rejectTimerRef.current);
      rejectTimerRef.current = null;
    }
  }, []);
  const clearUndoFailedTimer = useCallback(() => {
    if (undoFailedTimerRef.current !== null) {
      clearTimeout(undoFailedTimerRef.current);
      undoFailedTimerRef.current = null;
    }
  }, []);

  // Unmount safety only — these timers never drive persistence, just UI state.
  useEffect(
    () => () => {
      clearUndoTimer();
      clearRejectTimer();
      clearUndoFailedTimer();
    },
    [clearUndoTimer, clearRejectTimer, clearUndoFailedTimer],
  );

  const dismissJustMoved = useCallback(() => {
    clearUndoTimer();
    clearUndoFailedTimer();
    setJustMoved(null);
    setUndoFailedMessage(null);
  }, [clearUndoTimer, clearUndoFailedTimer]);

  const cancel = useCallback(() => {
    clearRejectTimer();
    setMovingId(null);
    setRejectMessage(null);
  }, [clearRejectTimer]);

  // Guard (§4.3 "Guard" row): the moving building may vanish from `buildings`
  // (deleted, or a boot re-entry) while move mode is open — leave move mode
  // rather than pointing at a stale id.
  useEffect(() => {
    if (movingId !== null && !buildings.some((b) => b.id === movingId)) cancel();
  }, [buildings, movingId, cancel]);

  // Android/gesture back consumes one back press while move mode is open,
  // the repo's proven WebView-safe pattern (§4.3 "Cancel" row).
  useBackGuard(movingId !== null, false, cancel);

  // Tap-elsewhere-to-cancel (§4.3 "Cancel" row: "[취소], Escape, tapping the
  // moving building again, or back"; the assignment's own Move-mode-UI
  // acceptance bullet also names "tap-elsewhere"). `.town-grid`'s own
  // delegated listener (`useTileGestures`) already handles every tap INSIDE
  // it (a droppable lot commits, the moving tile itself cancels via
  // `onPlotTap`'s own "tap the moving building again" branch) — this only
  // needs to catch what's outside it: the header, the FAB slot, the move
  // bar's own dead space. Delegated at `document`, not the grid, because
  // App.tsx renders the move bar as a SIBLING of `.town-grid` (§4.3), so the
  // grid element alone isn't "everything move mode owns" (round-2 finding C1
  // #3). Harmless when it also fires for a tap on the bar's own [취소]
  // button — `cancel` is idempotent.
  useEffect(() => {
    if (movingId === null) return;
    function onOutsidePointerDown(e: PointerEvent) {
      const target = e.target;
      if (target instanceof Element && target.closest(".town-grid")) return; // the grid handles its own taps
      cancel();
    }
    document.addEventListener("pointerdown", onOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", onOutsidePointerDown);
  }, [movingId, cancel]);

  const onPlotLongPress = useCallback(
    (plotIndex: number): boolean => {
      const building = buildings.find((b) => b.plotIndex === plotIndex);
      // An empty lot has nothing to move (long-press on ground is a no-op) —
      // `false` tells `useTileGestures` NOT to suppress the tail click, since
      // a >=500ms press on a droppable lot IS that lot's commit tap (round-2
      // finding C2 #1).
      if (!building) return false;
      clearRejectTimer();
      setMovingId(building.id);
      setRejectMessage(null);
      haptics.trigger("tickWeak");
      analytics.track("move_started");
      return true;
    },
    [buildings, clearRejectTimer],
  );

  const onPlotTap = useCallback(
    (plotIndex: number) => {
      if (movingId === null) return; // a plain tap outside move mode does nothing (only long-press starts it)
      const moving = buildings.find((b) => b.id === movingId);
      if (!moving) return; // the boot-race guard effect above will clear `movingId` shortly

      if (plotIndex === moving.plotIndex) {
        cancel(); // tapping the moving building again cancels (§4.3 "Cancel")
        return;
      }

      const result = moveBuilding(movingId, plotIndex);
      if (!result.ok) {
        // D-34: an occupied lot is rejected, not swapped — inline hint, mode stays open (§4.3 "Reject").
        // ("out-of-town"/"not-found"/"same-plot" are unreachable here in the
        // normal UI, since only droppable — free, in-pool — lots are tappable
        // as a destination; the same reject copy is a safe fallback either way.)
        setRejectMessage(OCCUPIED_MESSAGE);
        clearRejectTimer();
        rejectTimerRef.current = setTimeout(() => setRejectMessage(null), REJECT_MESSAGE_MS);
        return;
      }

      setMovingId(null);
      setRejectMessage(null);
      setJustMoved({ id: movingId, from: result.from, to: result.to });
      clearUndoTimer();
      undoTimerRef.current = setTimeout(() => setJustMoved(null), UNDO_TIMEOUT_MS);
    },
    [movingId, buildings, moveBuilding, cancel, clearUndoTimer, clearRejectTimer],
  );

  const onCursorMove = useCallback((nextIndex: number) => setCursorIndex(nextIndex), []);

  const undo = useCallback(() => {
    if (justMoved === null) return;
    // Same operation, no undo stack, no new persistence (§4.3 "Commit") — but
    // its result must be honored: the vacated `from` lot can have been taken
    // by a NEW build during the 5s undo window (the FAB is visible in the
    // `justMoved` state, and a new build lands on a uniformly random free
    // lot, which can be exactly that one). Dismissing unconditionally there
    // would make the user's explicit 되돌리기 tap silently do nothing
    // (round-2 finding C2 #3). On failure, leave `justMoved`/the bar as-is —
    // still tappable again for as long as the undo window lasts — and show a
    // reason instead.
    const result = moveBuilding(justMoved.id, justMoved.from);
    if (!result.ok) {
      setUndoFailedMessage(UNDO_FAILED_MESSAGE);
      clearUndoFailedTimer();
      undoFailedTimerRef.current = setTimeout(() => setUndoFailedMessage(null), REJECT_MESSAGE_MS);
      return;
    }
    dismissJustMoved();
  }, [justMoved, moveBuilding, dismissJustMoved, clearUndoFailedTimer]);

  return {
    movingId,
    cursorIndex,
    justMoved,
    rejectMessage,
    undoFailedMessage,
    onPlotLongPress,
    onPlotTap,
    onCursorMove,
    cancel,
    undo,
    dismissJustMoved,
  };
}
