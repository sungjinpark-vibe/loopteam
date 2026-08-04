import { useEffect, useRef, useState } from "react";
import { Button, useToast } from "@toss/tds-mobile";
import "./App.css";
import { BALANCE } from "./balance.placeholder";
import { levelUpToastFor } from "./content.placeholder";
import { EntrySheet } from "./components/EntrySheet";
import { TierCelebration } from "./components/TierCelebration";
import { TownGrid } from "./components/TownGrid";
import { TownHeader } from "./components/TownHeader";
import type { EntryDraft } from "./entryActions";
import { useMoveMode } from "./hooks/useMoveMode";
import { tier as computeTier } from "./selectors";
import { useTownStore, type Notice } from "./useTownStore";

/**
 * One toast line per non-"tier" `Notice` kind ("tier" renders as the
 * full-screen celebration overlay instead, handled separately in the
 * component below). A `switch` with an exhaustive `never` default — not the
 * ternary chain this replaces — so TypeScript itself refuses to compile if a
 * future `Notice` kind is added here without an explicit case (ADDENDUM-01
 * §3.6 break B8: a binary ternary once silently rendered `undefined` for a
 * third notice kind; round-2 finding C3 re-opened that exact hazard by
 * adding "moveHint" as a fourth implicit `else` instead of its own case).
 */
function noticeToastMessage(notice: Exclude<Notice, { kind: "tier" }>): string {
  switch (notice.kind) {
    case "corruption":
      return notice.message;
    case "drained":
      return `밀렸던 건물 ${notice.count}채가 오늘 아침에 완성됐어요!`;
    case "relayout":
      return "마을에 도로가 새로 놓였어요. 건물 위치가 조금 바뀌었어요."; // copy is D-26
    case "moveHint":
      return "건물을 길게 누르면 옮길 수 있어요"; // placeholder copy (D-36)
    case "savings":
      return levelUpToastFor(notice.id); // ADDENDUM-01 §2.6a — never an amount
    default: {
      const exhaustive: never = notice;
      throw new Error(`unhandled notice kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * S2 (우리 동네) + S4 (입력 시트) — MVP-SPEC build order.
 * Step 2 (T003) closed F1+F2+F3's loop. This task (step 3) adds the
 * retention layer: F4 slot reset, F14 materials queue, F5 tier celebration,
 * F7 streak, F15 무지출 데이.
 */
function App() {
  const store = useTownStore();
  const { notice, dismissNotice } = store;
  const [sheetOpen, setSheetOpen] = useState(false);
  const { openToast } = useToast();
  const move = useMoveMode(store.buildings, store.moveBuilding);

  // One-shot notices (F10 recovered corruption, F14 "return promise kept" on
  // boot, F5 tier celebration, ADDENDUM-02 §4.5 move hint) share one FIFO
  // queue (useTownStore.ts's `Notice`) — every kind but "tier" surfaces here
  // as a toast and is popped immediately; "tier" is rendered as the
  // full-screen overlay below instead and pops itself via
  // `TierCelebration`'s `onDismiss`.
  //
  // Round-4 finding C2 #4 — a multi-threshold 저축 save (one save crossing
  // 2+ ladder rungs on the same structure) showed the level-up toast TWICE.
  // `useTownStore`'s own enqueue is proven single (`grownStructures` returns
  // at most one id per structure regardless of how many rungs it crossed —
  // selectors.ts's own doc comment — and `useTownStore.savings.test.tsx`
  // asserts exactly one "savings" notice reaches the queue for such a save),
  // so the duplicate has to come from this effect running twice for the
  // SAME `notice` object — `openToast`/`dismissNotice` are not guaranteed
  // stable references (an unrelated re-render while the queue's head hasn't
  // advanced yet can still re-run this effect). `shownNoticeRef` makes the
  // effect body idempotent per notice OBJECT regardless of why it re-ran,
  // which is the one place every notice is shown, so it is guarded here
  // once rather than at every future call site that might reorder these deps.
  const shownNoticeRef = useRef<Notice | null>(null);
  useEffect(() => {
    if (notice === null || notice.kind === "tier") return;
    if (shownNoticeRef.current === notice) return;
    shownNoticeRef.current = notice;
    openToast(noticeToastMessage(notice));
    dismissNotice();
  }, [notice, dismissNotice, openToast]);

  if (store.loading) {
    return <div className="town-loading">불러오는 중…</div>;
  }

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

  return (
    <div className="town-screen">
      {BALANCE.BALANCE_UNSET && (
        <div className="balance-banner" role="status">
          밸런스 미승인 — 임시 수치
        </div>
      )}

      <TownHeader
        townName={store.townName}
        buildingCount={store.buildingCount}
        slotsRemaining={store.slotsRemaining}
        dailyBuildSlots={store.dailyBuildSlots}
        tier={tier}
        streakDays={store.streakDays}
        queueLength={store.queueLength}
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

      <TierCelebration tier={notice?.kind === "tier" ? notice.tier : null} onDismiss={dismissNotice} />
    </div>
  );
}

export default App;
