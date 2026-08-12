import { useEffect, useRef, useState } from "react";
import { useToast } from "@toss/tds-mobile";
import "./App.css";
import { BALANCE } from "./balance.approved";
import { levelUpToastFor } from "./content.placeholder";
import { HistoryScreen } from "./components/HistoryScreen";
import { Onboarding } from "./components/Onboarding";
import { SettingsSheet } from "./components/SettingsSheet";
import { SettlementCard } from "./components/SettlementCard";
import { CelebrationBanner, TierCelebration } from "./components/TierCelebration";
import { TownScreen } from "./components/TownScreen";
import { audio } from "./platform/audio";
import { useTownStore, type Notice } from "./useTownStore";

/**
 * One toast line per `Notice` kind that isn't its own banner ("tier",
 * "settlement" and "firstBuilding" each render as a non-blocking banner
 * instead, handled separately in the component below). A `switch` with an exhaustive `never`
 * default — not the ternary chain this replaces — so TypeScript itself
 * refuses to compile if a future `Notice` kind is added here without an
 * explicit case (ADDENDUM-01 §3.6 break B8: a binary ternary once silently
 * rendered `undefined` for a third notice kind; round-2 finding C3 re-opened
 * that exact hazard by adding "moveHint" as a fourth implicit `else` instead
 * of its own case).
 */
function noticeToastMessage(notice: Exclude<Notice, { kind: "tier" | "settlement" | "firstBuilding" }>): string {
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

// Mirrors `TownScreen.tsx`'s own constant/doc — TDS `openToast` doesn't know
// about this app's fixed `.bottom-tab-bar` (56px, App.css), so every toast
// here needs the same bottom clearance (liveops-pd finding, round-5).
const TOAST_GAP_ABOVE_TAB_BAR = 80;

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
  // F-BGM (ADDENDUM-05 §5) — start once for the app's lifetime. The port boots
  // its AudioContext suspended and resumes it on the first user gesture, so
  // this call is safe before any interaction and needs no gesture plumbing
  // here; it degrades to a no-op driver wherever AudioContext is absent (jsdom).
  useEffect(() => {
    audio.start();
    return () => audio.stop();
  }, []);
  useEffect(() => {
    audio.setMuted(store.bgmMuted);
  }, [store.bgmMuted]);
  const { openToast } = useToast();
  const [tab, setTab] = useState<Tab>("town");
  // S6 설정 — one instance for the whole shell (single `useTownStore()`,
  // §TownScreen.tsx's own doc on why two instances would race): both tabs'
  // 설정 entry points (기록's row, Town header's gear, and the mood nudge
  // when no budget is set) open this same sheet instead of each owning a
  // duplicate.
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    if (notice === null || notice.kind === "tier" || notice.kind === "settlement" || notice.kind === "firstBuilding") return;
    if (shownNoticeRef.current === notice) return;
    shownNoticeRef.current = notice;
    openToast(noticeToastMessage(notice), { gap: TOAST_GAP_ABOVE_TAB_BAR });
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

      {tab === "town" ? (
        <TownScreen store={store} onOpenSettings={() => setSettingsOpen(true)} />
      ) : (
        <HistoryScreen store={store} onOpenSettings={() => setSettingsOpen(true)} />
      )}

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

      <TierCelebration
        tier={notice?.kind === "tier" ? notice.tier : null}
        buildingCount={store.buildingCount}
        tierThresholds={BALANCE.tierThresholds}
        onDismiss={dismissNotice}
      />

      {/* Gate-3 follow-up (A2) — the first founding is the one moment the
          whole app exists for and it used to get nothing but the ordinary
          save toast. Same banner component the tier celebration renders, so
          it is non-blocking and auto-dismissing by construction (a blocking
          celebration modal was a round-1 Gate-3 failure — `TierCelebration
          .tsx`'s own header) and sits above the FAB/전체 보기 stack rather
          than behind it. */}
      {notice?.kind === "firstBuilding" && (
        <CelebrationBanner
          emoji="🏠"
          title="첫 건물이 세워졌어요!"
          subtitle="기록할 때마다 우리 동네에 건물이 한 채씩 늘어나요"
          onDismiss={dismissNotice}
        />
      )}

      <SettlementCard summary={notice?.kind === "settlement" ? notice.summary : null} onDismiss={dismissNotice} />

      <SettingsSheet
        open={settingsOpen}
        townName={store.townName}
        budgetKrw={store.budgetKrw}
        onClose={() => setSettingsOpen(false)}
        onSaveTownName={store.setTownName}
        onSaveBudget={store.setBudget}
        onResetAll={store.resetAll}
        onExport={store.exportData}
        onImport={store.importData}
        bgmMuted={store.bgmMuted}
        onSetBgmMuted={store.setBgmMuted}
      />

      {/* S1 — fires once, only for a genuinely fresh install (`onboarded`
          defaults false in `freshCore`; an existing player's persisted core
          is already `true`). Rendered last/on top of everything else in the
          shell, including the tab bar, so a first-timer can't tap around it
          into a half-explained state (round-1 playtest: zero onboarding was
          the single most common finding across all five expert lenses). */}
      {!store.onboarded && (
        <Onboarding dailyBuildSlots={store.dailyBuildSlots} onSetBudget={store.setBudget} onComplete={store.completeOnboarding} />
      )}
    </div>
  );
}

export default App;
