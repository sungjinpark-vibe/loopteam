import { useEffect, useState } from "react";
import { Button, useToast } from "@toss/tds-mobile";
import "./App.css";
import { BALANCE } from "./balance.placeholder";
import { EntrySheet } from "./components/EntrySheet";
import { TierCelebration } from "./components/TierCelebration";
import { TownGrid } from "./components/TownGrid";
import { TownHeader } from "./components/TownHeader";
import type { EntryDraft } from "./entryActions";
import { tier as computeTier } from "./selectors";
import { useTownStore } from "./useTownStore";

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

  // One-shot notices (F10 recovered corruption, F14 "return promise kept" on
  // boot, F5 tier celebration) share one FIFO queue (useTownStore.ts's
  // `Notice`) — every kind but "tier" surfaces here as a toast and is popped
  // immediately; "tier" is rendered as the full-screen overlay below instead
  // and pops itself via `TierCelebration`'s `onDismiss`.
  useEffect(() => {
    if (notice === null || notice.kind === "tier") return;
    const message = notice.kind === "corruption" ? notice.message : `밀렸던 건물 ${notice.count}채가 오늘 아침에 완성됐어요!`;
    openToast(message);
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

      {store.buildingCount === 0 ? (
        <div className="town-empty-state">
          <p>첫 지출을 기록하면 첫 건물이 생겨요</p>
          <div className="town-empty-arrow" aria-hidden="true">
            ↘
          </div>
        </div>
      ) : (
        <TownGrid nextPlotIndex={store.nextPlotIndex} buildings={store.buildings} justBuiltId={store.justBuiltId} />
      )}

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

      <EntrySheet open={sheetOpen} today={store.today} onClose={() => setSheetOpen(false)} onSave={handleSave} />

      <TierCelebration tier={notice?.kind === "tier" ? notice.tier : null} onDismiss={dismissNotice} />
    </div>
  );
}

export default App;
