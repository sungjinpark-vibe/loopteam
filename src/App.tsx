import { useEffect, useState } from "react";
import { Button, useToast } from "@toss/tds-mobile";
import "./App.css";
import { BALANCE } from "./balance.placeholder";
import { EntrySheet } from "./components/EntrySheet";
import { TownGrid } from "./components/TownGrid";
import { TownHeader } from "./components/TownHeader";
import type { EntryDraft } from "./entryActions";
import { useTownStore } from "./useTownStore";

/**
 * S2 (우리 동네) + S4 (입력 시트) — MVP-SPEC build order step 2: "F1+F2+F3 = the
 * loop closes here." Log an entry -> a building appears -> reload -> it's
 * still there (storage round-trips via `useTownStore` / T002's `storage.ts`).
 */
function App() {
  const store = useTownStore();
  const { corruptionNotice, dismissCorruptionNotice } = store;
  const [sheetOpen, setSheetOpen] = useState(false);
  const { openToast } = useToast();

  // F10: "a visible one-time notice, never a white screen" for recovered
  // storage corruption. Fires once per boot (dismissed right after showing)
  // — this is the only screen in this task that could surface it.
  useEffect(() => {
    if (corruptionNotice === null) return;
    openToast(corruptionNotice);
    dismissCorruptionNotice();
  }, [corruptionNotice, dismissCorruptionNotice, openToast]);

  if (store.loading) {
    return <div className="town-loading">불러오는 중…</div>;
  }

  function handleSave(draft: EntryDraft) {
    const result = store.addEntry(draft);
    setSheetOpen(false);
    // F14 (the materials queue) is out of this task's scope, but the entry
    // still needs to say plainly it saved without a building — "saved,
    // no building today" must never look like "nothing happened".
    if (result.building === null) {
      openToast("저장했어요. 오늘 건축 슬롯을 모두 써서 건물은 짓지 못했어요.");
    }
  }

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
      />

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
    </div>
  );
}

export default App;
