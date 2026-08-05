import { useEffect, useRef, useState } from "react";
import { useToast } from "@toss/tds-mobile";
import "./App.css";
import { BALANCE } from "./balance.placeholder";
import { levelUpToastFor } from "./content.placeholder";
import { HistoryScreen } from "./components/HistoryScreen";
import { TierCelebration } from "./components/TierCelebration";
import { TownScreen } from "./components/TownScreen";
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

type Tab = "town" | "history";

/**
 * Root shell: one `useTownStore()` instance (one storage client, one
 * debounce buffer — see `TownScreen.tsx`'s doc for why this must not be
 * called twice), the 2-tab bottom nav between S2 (우리 동네) and S3 (기록,
 * this task), and the notice-toast/tier-celebration plumbing that must fire
 * regardless of which tab is active (a boot-time notice can arrive before
 * the player ever looks at either tab). Nothing here is screen-specific —
 * that all lives in `TownScreen`/`HistoryScreen`.
 */
function App() {
  const store = useTownStore();
  const { notice, dismissNotice } = store;
  const { openToast } = useToast();
  const [tab, setTab] = useState<Tab>("town");

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

  return (
    <div className="app-shell">
      {BALANCE.BALANCE_UNSET && (
        <div className="balance-banner" role="status">
          밸런스 미승인 — 임시 수치
        </div>
      )}

      {tab === "town" ? <TownScreen store={store} /> : <HistoryScreen store={store} />}

      {/* Minimal 2-item bottom tab bar (spec §6: "a 2-item bottom tab bar
          (우리 동네 / 기록). Maximum depth is 2") — no router: two screens,
          switched by local state, is the whole navigation model this app
          needs right now. */}
      <nav className="bottom-tab-bar" role="tablist" aria-label="화면 전환">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "town"}
          className={`bottom-tab${tab === "town" ? " bottom-tab--active" : ""}`}
          onClick={() => setTab("town")}
        >
          <span className="bottom-tab-icon" aria-hidden="true">
            🏠
          </span>
          <span>우리 동네</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={`bottom-tab${tab === "history" ? " bottom-tab--active" : ""}`}
          onClick={() => setTab("history")}
        >
          <span className="bottom-tab-icon" aria-hidden="true">
            📒
          </span>
          <span>기록</span>
        </button>
      </nav>

      <TierCelebration tier={notice?.kind === "tier" ? notice.tier : null} onDismiss={dismissNotice} />
    </div>
  );
}

export default App;
