/**
 * S2 (우리 동네) + S4 (입력 시트) — MVP-SPEC build order. Extracted from what
 * used to be the whole of `App.tsx` once a second tab (S3 기록) needed its own
 * screen component sharing the SAME `useTownStore()` instance (one storage
 * client, one debounce buffer — two separate `useTownStore()` calls would
 * each own an independent buffer and could race on the same underlying
 * `localStorage` keys). `App.tsx` now owns the single store instance, the
 * bottom tab bar, and the notice-toast/tier-celebration plumbing that must
 * fire regardless of which tab is showing; this component owns everything
 * S2/S4-specific.
 */
import { useMemo, useState } from "react";
import { Button, useToast } from "@toss/tds-mobile";
import { BALANCE } from "../balance.placeholder";
import { moodContentFor } from "../content.placeholder";
import { EntrySheet } from "./EntrySheet";
import { TownGrid } from "./TownGrid";
import { TownHeader } from "./TownHeader";
import type { EntryDraft } from "../entryActions";
import { useMoveMode } from "../hooks/useMoveMode";
import { budgetPace, moodTier, tier as computeTier } from "../selectors";
import type { TownStore } from "../useTownStore";

export interface TownScreenProps {
  store: TownStore;
}

export function TownScreen({ store }: TownScreenProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { openToast } = useToast();
  const move = useMoveMode(store.buildings, store.moveBuilding);

  function handleSave(draft: EntryDraft) {
    const result = store.addEntry(draft);
    setSheetOpen(false);
    // F14: a save with zero slots either queues (return-promise toast) or,
    // once the queue itself is full, overflows plainly — never a silent no-op.
    if (result.queued) {
      // `result.queueLength` is the queue's length AFTER this save (post-push) —
      // `store.queueLength` would read the PRE-save value here, from the
      // render closure captured before `addEntry`'s state commit re-renders.
      openToast(`오늘 슬롯을 다 썼어요. 내일 아침에 지어드릴게요 (대기 ${result.queueLength}개)`);
    } else if (result.queueOverflow) {
      openToast("대기열도 가득 찼어요. 건물 없이 저장했어요.");
    }
  }

  function handleClaimNoSpend() {
    const claimed = store.claimNoSpend();
    if (claimed) openToast("오늘은 무지출! 공원이 생겼어요.");
  }

  const tier = computeTier(store.buildingCount, BALANCE.tierThresholds);

  // F6 — town mood, reusing `budgetPace`/`moodTier` (selectors.ts) exactly as
  // 기록's pace bar already does, so the two never disagree. Continuous
  // through the month (budgetPace prorates by `dayOfMonth`, not a
  // month-end-only calc) and pinned neutral whenever `budgetKrw === null`
  // (`moodTier` returns -1 for a null pace). Current month's entries only —
  // `getMonthEntries` returns the SAME array reference `state.entries` holds
  // until the next save, so this only recomputes when spending/budget/date
  // actually change, not on every unrelated re-render (rubric C4).
  const todayYm = store.today.slice(0, 7);
  const monthEntries = store.getMonthEntries(todayYm);
  const pace = useMemo(
    () => budgetPace(monthEntries, todayYm, store.budgetKrw, store.today),
    [monthEntries, todayYm, store.budgetKrw, store.today],
  );
  const mood = moodTier(pace, BALANCE.moodPaceThresholds);
  const moodContent = moodContentFor(mood);

  return (
    <div className={`town-screen town-screen--mood-${moodContent.skyClass}`}>
      <TownHeader
        townName={store.townName}
        buildingCount={store.buildingCount}
        slotsRemaining={store.slotsRemaining}
        dailyBuildSlots={store.dailyBuildSlots}
        tier={tier}
        streakDays={store.streakDays}
        queueLength={store.queueLength}
        moodLabel={moodContent.headerLabel}
      />

      {store.canClaimNoSpend && (
        <div className="town-nospend-action">
          <Button as="button" color="primary" variant="weak" size="medium" display="block" onClick={handleClaimNoSpend}>
            오늘 무지출!
          </Button>
        </div>
      )}

      {/* ADDENDUM-01 §2.4 (break B13) — the town grid now always renders: the
          저축 블록 is a row of it, and it must exist on a fresh install. The
          empty-state copy is a banner ABOVE the grid, not an alternative to
          it, and keeps F3's AC (message + ↘ arrow at 0 buildings). */}
      {store.buildingCount === 0 && (
        <div className="town-empty-state town-empty-state--with-grid">
          <p>첫 지출을 기록하면 첫 건물이 생겨요</p>
          <div className="town-empty-arrow" aria-hidden="true">
            ↘
          </div>
        </div>
      )}

      <TownGrid
        nextPlotIndex={store.nextPlotIndex}
        buildings={store.buildings}
        justBuiltId={store.justBuiltId}
        savingsByCategoryKrw={store.savingsByCategoryKrw}
        ladder={BALANCE.savingsTowerSegments}
        ladderOverrides={BALANCE.savingsStructureSegments}
        justGrew={store.justGrew}
        onRiseSettled={store.clearJustGrew}
        movingId={move.movingId}
        cursorIndex={move.cursorIndex}
        onPlotLongPress={move.onPlotLongPress}
        onPlotTap={move.onPlotTap}
        onCursorMove={move.onCursorMove}
        onCancel={move.cancel}
      />

      {/* ADDENDUM-02 §4.3/§4.4 — rendered OUTSIDE `.town-grid` (a sibling,
          not a grid child) so ADDENDUM-01 §2.4a's direct-children guard on
          the grid (AC-M7) is untouched. */}
      {move.movingId !== null ? (
        <div className="town-move-bar" role="status">
          <span>{move.rejectMessage ?? "옮길 자리를 골라주세요"}</span>
          <Button as="button" color="primary" variant="weak" size="small" onClick={move.cancel}>
            취소
          </Button>
        </div>
      ) : (
        move.justMoved !== null && (
          <div className="town-move-bar" role="status">
            <span>{move.undoFailedMessage ?? "건물을 옮겼어요"}</span>
            <Button as="button" color="primary" variant="weak" size="small" onClick={move.undo}>
              되돌리기
            </Button>
            <Button as="button" color="primary" variant="fill" size="small" onClick={move.dismissJustMoved}>
              완료
            </Button>
          </div>
        )
      )}

      {/* The FAB hides in move mode — one `useBackGuard` history entry per
          open in-page modal at a time (§4.3 "Enter" row). */}
      {move.movingId === null && (
        <Button
          as="button"
          color="primary"
          variant="fill"
          size="xlarge"
          aria-label="거래 입력"
          className="town-fab"
          onClick={() => setSheetOpen(true)}
        >
          +
        </Button>
      )}

      <EntrySheet open={sheetOpen} today={store.today} onClose={() => setSheetOpen(false)} onSave={handleSave} />
    </div>
  );
}
