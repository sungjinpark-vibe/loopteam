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
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Button, ConfirmDialog, useToast } from "@toss/tds-mobile";
import { BALANCE } from "../balance.approved";
import { CATEGORY_CONTENT, moodContentFor } from "../content.placeholder";
import { formatSeeds } from "../economy/format";
import { seeds as toSeedCount } from "../economy/types";
import { BuildingDetailSheet } from "./BuildingDetailSheet";
import { ChargeSheet } from "./ChargeSheet";
import { EntrySheet } from "./EntrySheet";
import { ShopFab, ShopSheet } from "./ShopSheet";
import { MonumentDetailSheet } from "./MonumentDetailSheet";
import { TownGrid } from "./TownGrid";
import { TownHeader } from "./TownHeader";
import type { EntryDraft } from "../entryActions";
import { useGrowPickMode } from "../hooks/useGrowPickMode";
import { useMoveMode } from "../hooks/useMoveMode";
import { budgetPace, levelOf, moodTier, tier as computeTier } from "../selectors";
import type { TownStore } from "../useTownStore";

export interface TownScreenProps {
  store: TownStore;
  onOpenSettings: () => void;
}

// Stable reference so passing it during grow-pick mode doesn't defeat
// `TownGrid`'s `React.memo` every render the way a fresh inline arrow would.
const noopLongPress = () => false;

// Gate-3-rerun fix — see `AddEntryResult.seedsGranted`'s doc. ADDENDUM-05 §6's
// own "transient reward toast" surface, folded onto the existing build/
// level-up toast rather than opening a third notification channel (the panel
// already flagged toast/banner stacking as a defect — a new standalone seed
// toast would only add to that pile).
// Gate-3-RE-RUN fix (round-5 panel, UX-researcher/target-player/liveops-pd):
// "(+3개)" named no unit — a player can't tell buildings from seeds from
// days. `formatSeeds` itself stays a plain "N개" (economy/format.ts's own
// R-7 doc: never a currency-like label baked into the shared formatter) —
// the "씨앗" word belongs to this ONE call site, same as ShopSheet's header
// already prefixes it by hand.
function seedSuffix(amount: number): string {
  return amount > 0 ? ` (+씨앗 ${formatSeeds(toSeedCount(amount))})` : "";
}

// Toss TDS `openToast`'s default position ignores this app's own
// `.bottom-tab-bar` (fixed, 56px, spec-owned — App.css `--tab-bar-h`), so a
// toast with no `gap` sits low enough to occlude both tab labels (liveops-pd
// finding, round-5: the level-up toast covered "우리 동네"/"기록"). `gap` is
// TDS's own offset-from-bottom option (`BaseToastOptions.gap`) — bump it
// clear of the tab bar plus a small margin.
const TOAST_GAP_ABOVE_TAB_BAR = 80;

export function TownScreen({ store, onOpenSettings }: TownScreenProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  // ADDENDUM-05 §6 — the 상점 and the 충전소 stub. Mutually exclusive by
  // construction (see `onOpenCharge` below), never stacked.
  const [shopOpen, setShopOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  // 충전소 was requested from inside the shop, and the shop is still unwinding.
  //
  // Both sheets use `useBackGuard`, whose cleanup consumes its own history
  // entry with `history.back()`. Opening the second sheet in the same tick as
  // closing the first makes the new sheet's freshly-attached `popstate`
  // listener catch the OLD sheet's teardown pop and close itself instantly.
  // So the charge sheet opens only once the shop is actually closed.
  //
  // ponytail: scoped to this one hand-off. The general fix is to make
  // `useBackGuard` ignore popstates that are not its own entry, but that hook
  // backs every modal in the app (EntrySheet, settings, monument, charge) and
  // is not worth re-cutting for one transition. Revisit if a second
  // sheet-to-sheet hand-off ever appears.
  const [chargePending, setChargePending] = useState(false);
  useEffect(() => {
    if (!chargePending || shopOpen) return;
    const id = window.setTimeout(() => {
      setChargePending(false);
      setChargeOpen(true);
    }, 250);
    return () => window.clearTimeout(id);
  }, [chargePending, shopOpen]);
  // ADDENDUM-04 §4 — the draft held between the entry sheet closing and the
  // grow choice being resolved (새 건물 세우기 / 기존 건물 키우기), and again
  // for the duration of grid pick-mode when there are 2+ candidates. Non-null
  // for exactly the lifetime of "the ConfirmDialog OR pick mode is showing".
  const [growDraft, setGrowDraft] = useState<EntryDraft | null>(null);
  // F16 — the monument detail popover's subject. Null closes the sheet
  // (`MonumentDetailSheet` mirrors `EntryDetailSheet`'s own contract).
  const [selectedMonumentId, setSelectedMonumentId] = useState<string | null>(null);
  // Gate-3-rerun fix — same idea, ordinary (non-monument) buildings: null closes `BuildingDetailSheet`.
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const { openToast } = useToast();
  const move = useMoveMode(store.buildings, store.moveBuilding);

  // Gate-3-rerun fix (near-unanimous finding): the persistent "건물을 길게
  // 누르면 옮길 수 있어요" moveHint toast could still be showing when the
  // move-mode/post-move banner (`.town-move-bar`, below) appears, stacking
  // two bottom banners. The hint's whole job — teach the long-press gesture
  // — is done the instant the player actually uses it, so dismiss it right
  // then instead of leaving it to overlap the banner it just taught someone
  // to trigger.
  const { notice, dismissNotice } = store;
  useEffect(() => {
    if (move.movingId !== null && notice?.kind === "moveHint") dismissNotice();
  }, [move.movingId, notice, dismissNotice]);

  function saveEntry(draft: EntryDraft, growTargetId?: string) {
    const result = store.addEntry(draft, growTargetId);
    // F14: a save with zero slots either queues (return-promise toast) or,
    // once the queue itself is full, overflows plainly — never a silent no-op.
    if (result.queued) {
      // `result.queueLength` is the queue's length AFTER this save (post-push) —
      // `store.queueLength` would read the PRE-save value here, from the
      // render closure captured before `addEntry`'s state commit re-renders.
      openToast(`오늘 슬롯을 다 썼어요. 내일 아침에 지어드릴게요 (대기 ${result.queueLength}개)`, { gap: TOAST_GAP_ABOVE_TAB_BAR });
    } else if (result.queueOverflow) {
      openToast("대기열도 가득 찼어요. 건물 없이 저장했어요.", { gap: TOAST_GAP_ABOVE_TAB_BAR });
    } else if (result.grew) {
      // ADDENDUM-04 §5/§8 — one-line level-up feedback on the same toast
      // channel as F14's notices above; no celebration system (§4's "what
      // was deliberately NOT built" applies to this feedback too).
      openToast(`레벨이 올랐어요! (Lv.${levelOf(result.grew, BALANCE.expPerLevel, BALANCE.maxLevel)})${seedSuffix(result.seedsGranted)}`, {
        gap: TOAST_GAP_ABOVE_TAB_BAR,
      });
    } else if (result.building?.categoryId) {
      // Gate-3-rerun fix (ux-researcher/target-player TOP FIX): the reward
      // used to resolve as a silent speck somewhere in an already-dense map
      // — `TownGrid`'s own `justBuiltId` effect now zooms/scrolls the camera
      // to it (reusing ADDENDUM-09's zoom), and this toast names what just
      // rose so the moment reads as "you built something", not "a header
      // number changed". Design invariant 2 (spec §7): no KRW amount here —
      // `seedSuffix` below is a game-currency count, not money, so it's a
      // different axis from the invariant this note is guarding.
      const content = CATEGORY_CONTENT[result.building.categoryId];
      openToast(`${content.icon} ${content.label} 건물이 생겼어요${seedSuffix(result.seedsGranted)}`, {
        gap: TOAST_GAP_ABOVE_TAB_BAR,
      });
    }
  }

  function handleGrowPickCommit(buildingId: string) {
    if (growDraft === null) return; // defensive — pick mode can't be active with no held draft
    saveEntry(growDraft, buildingId);
    setGrowDraft(null);
  }

  const growPick = useGrowPickMode(store.buildings, handleGrowPickCommit);
  const pickModeActive = growPick.candidateIds !== null;
  // Dialog and pick-mode are two phases of the SAME `growDraft`, never shown
  // together — the dialog closes the instant pick mode starts (§4: "the
  // sheet is already closed, the town is visible, candidates highlighted").
  const growDialogOpen = growDraft !== null && !pickModeActive;

  function handleSave(draft: EntryDraft) {
    // ADDENDUM-04 §4 — the choice trigger, evaluated once at save time.
    const canGrow =
      draft.type !== "saving" && store.slotsRemaining > 0 && store.growCandidates(draft.categoryId).length > 0;
    if (!canGrow) {
      saveEntry(draft);
      setSheetOpen(false);
      return;
    }
    // Close the sheet FIRST — the dialog must never nest inside an open
    // BottomSheet (the vendor backdrop bug `useConfirmDialogBackdropFix`
    // exists for; avoided here by construction, not patched a second time).
    setSheetOpen(false);
    setGrowDraft(draft);
  }

  function handleBuildNew() {
    if (growDraft === null) return;
    saveEntry(growDraft);
    setGrowDraft(null);
  }

  function handleGrow() {
    if (growDraft === null) return;
    const candidates = store.growCandidates(growDraft.categoryId);
    if (candidates.length === 1) {
      saveEntry(growDraft, candidates[0].id);
      setGrowDraft(null);
      return;
    }
    // 2+ candidates — grid pick mode (§4). `growDraft` stays held; the
    // ConfirmDialog closes on its own via `growDialogOpen` above.
    growPick.start(new Set(candidates.map((c) => c.id)));
  }

  function handleGrowPickCancel() {
    growPick.cancel();
    setGrowDraft(null);
  }

  // F16 — a plain tap on a monument (outside move/pick mode, where a plain
  // tap otherwise does nothing — `useMoveMode.onPlotTap`'s own doc) opens the
  // detail popover instead. Any other tap keeps going through move mode
  // exactly as before this task.
  //
  // Gate-3-rerun fix — every expert's top/near-top finding: a plain tap on
  // an ORDINARY building was a total silent no-op (only long-press did
  // anything). Widened the exact same branch to any occupied plot, not just
  // monuments, reusing `BuildingDetailSheet` (mirrors `MonumentDetailSheet`).
  function handlePlotTap(plotIndex: number) {
    if (pickModeActive) {
      growPick.onPlotTap(plotIndex);
      return;
    }
    if (move.movingId === null) {
      const building = store.buildings.find((b) => b.plotIndex === plotIndex);
      if (building?.source.kind === "monument") {
        setSelectedMonumentId(building.id);
        return;
      }
      if (building) {
        setSelectedBuildingId(building.id);
        return;
      }
    }
    move.onPlotTap(plotIndex);
  }

  // Gate-3-rerun fix — the founding/growing entry for `selectedBuildingId`
  // (amount + type, shown in the sheet's teaching line). Only `source.kind
  // === "entry"` buildings have one; a building built in a past month needs
  // that month loaded first (`getMonthEntries` returns `[]` for an unloaded
  // one — same contract `HistoryScreen.tsx` already relies on).
  const { ensureMonthLoaded, getMonthEntries } = store;
  const selectedBuilding = store.buildings.find((b) => b.id === selectedBuildingId) ?? null;
  const selectedBuildingYm = selectedBuilding !== null ? selectedBuilding.builtOn.slice(0, 7) : null;
  // `useLayoutEffect`, same reasoning as `HistoryScreen.tsx`'s own
  // `ensureMonthLoaded` call: `getMonthEntries` below reads DURING render, so
  // a plain `useEffect` would paint one frame with `selectedEntry === null`
  // (no amount line) before a past month's chunk loads in.
  useLayoutEffect(() => {
    if (selectedBuilding?.source.kind === "entry") ensureMonthLoaded(selectedBuildingYm!);
  }, [selectedBuilding, selectedBuildingYm, ensureMonthLoaded]);
  const selectedEntryId = selectedBuilding?.source.kind === "entry" ? selectedBuilding.source.entryId : null;
  const selectedEntry = selectedEntryId ? (getMonthEntries(selectedBuildingYm!).find((e) => e.id === selectedEntryId) ?? null) : null;

  function handleClaimNoSpend() {
    const claimed = store.claimNoSpend();
    if (claimed) {
      openToast(
        BALANCE.noSpendDayCostsSlot ? "오늘은 무지출! 공원이 생겼어요. (슬롯 1개 사용)" : "오늘은 무지출! 공원이 생겼어요.",
        { gap: TOAST_GAP_ABOVE_TAB_BAR },
      );
    }
  }

  // Gate-3-rerun fix (every expert's confirmed defect, QA's TOP FIX): tier
  // now reads the SAME literal count `TownHeader`'s `buildingCount` prop
  // shows below — there is exactly one number, so it cannot drift from what
  // the tier-up banner (`TierCelebration`, fed `store.buildingCount` too)
  // says either. See `entryActions.ts`'s `buildingCountBeforeThis` doc for
  // why this used to be the growth score instead.
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
        moodIcon={moodContent.icon}
        budgetUnset={mood === -1}
        onOpenSettings={onOpenSettings}
        bgmMuted={store.bgmMuted}
        onSetBgmMuted={store.setBgmMuted}
      />

      {store.canClaimNoSpend && (
        <div className="town-nospend-action">
          <Button as="button" color="primary" variant="weak" size="medium" display="block" onClick={handleClaimNoSpend}>
            오늘 무지출!
          </Button>
          {/* ux-researcher, playtest round 1: this button silently consumed a
              build slot with no disclosure anywhere before the tap. */}
          {BALANCE.noSpendDayCostsSlot && <p className="town-nospend-hint">건축 슬롯 1개를 사용해요</p>}
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
        buildings={store.buildings}
        justBuiltId={store.justBuiltId}
        savingsByCategoryKrw={store.savingsByCategoryKrw}
        ladder={BALANCE.savingsTowerSegments}
        ladderOverrides={BALANCE.savingsStructureSegments}
        expPerLevel={BALANCE.expPerLevel}
        maxLevel={BALANCE.maxLevel}
        justGrew={store.justGrew}
        onRiseSettled={store.clearJustGrew}
        movingId={move.movingId}
        cursorIndex={move.cursorIndex}
        npcCount={store.npcCount}
        // ADDENDUM-04 §4 — the two grid modes are mutually exclusive (see
        // this file's own state comments): while pick mode is active, a
        // long-press must not also start move mode, and a tap routes to the
        // grow commit instead of the move commit.
        onPlotLongPress={pickModeActive ? noopLongPress : move.onPlotLongPress}
        onPlotTap={handlePlotTap}
        onCursorMove={move.onCursorMove}
        growCandidateIds={growPick.candidateIds ?? undefined}
        onCancel={pickModeActive ? handleGrowPickCancel : move.cancel}
      />

      {/* ADDENDUM-02 §4.3/§4.4 + ADDENDUM-04 §4 — rendered OUTSIDE
          `.town-grid` (a sibling, not a grid child) so ADDENDUM-01 §2.4a's
          direct-children guard on the grid (AC-M7) is untouched. Move mode,
          grow-pick mode, and the post-move bar are mutually exclusive on
          screen — this if/else-if chain is what keeps exactly one banner
          visible at a time. */}
      {move.movingId !== null ? (
        <div className="town-move-bar" role="status">
          <span>{move.rejectMessage ?? "옮길 자리를 골라주세요"}</span>
          <Button as="button" color="primary" variant="weak" size="small" onClick={move.cancel}>
            취소
          </Button>
        </div>
      ) : pickModeActive ? (
        <div className="town-move-bar" role="status">
          <span>키울 건물을 선택하세요</span>
          <Button as="button" color="primary" variant="weak" size="small" onClick={handleGrowPickCancel}>
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

      {/* The FAB hides in move mode AND grow-pick mode — one `useBackGuard`
          history entry per open in-page modal at a time (§4.3 "Enter" row;
          ADDENDUM-04 §4 extends the same rule to pick mode). */}
      {move.movingId === null && !pickModeActive && (
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

      {/* ADDENDUM-05 §6 (F-ECON) — the 꾸미기 mini-FAB sits directly above the ⊕
          FAB and hides under exactly the same two conditions, so neither grid
          mode ever has a second floating action competing with its status bar. */}
      {move.movingId === null && !pickModeActive && (
        <ShopFab onClick={() => setShopOpen(true)} economy={store.economy} npcCount={store.npcCount} />
      )}

      <EntrySheet open={sheetOpen} today={store.today} onClose={() => setSheetOpen(false)} onSave={handleSave} />

      <ShopSheet
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        economy={store.economy}
        buildings={store.buildings}
        npcCount={store.npcCount}
        purchaseSku={store.purchaseSku}
        applyTownSku={store.applyTownSku}
        applyBuildingSku={store.applyBuildingSku}
        formatSeeds={formatSeeds}
        onOpenCharge={() => {
          // Never both at once — one dimmer, one back-guard entry.
          setShopOpen(false);
          setChargePending(true);
        }}
      />

      <ChargeSheet open={chargeOpen} onClose={() => setChargeOpen(false)} />

      <MonumentDetailSheet
        open={selectedMonumentId !== null}
        monument={store.buildings.find((b) => b.id === selectedMonumentId) ?? null}
        onClose={() => setSelectedMonumentId(null)}
      />

      <BuildingDetailSheet
        open={selectedBuildingId !== null}
        building={selectedBuilding}
        entry={selectedEntry}
        expPerLevel={BALANCE.expPerLevel}
        maxLevel={BALANCE.maxLevel}
        onClose={() => setSelectedBuildingId(null)}
      />

      {/* ADDENDUM-04 §4 — the choice dialog. Opens only after the entry
          sheet above has already closed (never nested inside it, see
          `handleSave`'s own comment). No "remember my choice" toggle — the
          spec explicitly rejects one (§4 "what was deliberately NOT built"):
          fixed button positions every time. */}
      <ConfirmDialog
        open={growDialogOpen}
        title="같은 종류 건물이 이미 있어요"
        // Gate-3-rerun fix (3 experts: game-designer/ux-researcher/target-
        // player) — ADDENDUM-04 §5 already makes 키우기 spend a build slot
        // exactly like founding (`entryActions.ts` — "growing consumes a
        // slot ... exactly like building"), but this dialog never disclosed
        // it, so a player choosing 키우기 to be tidy paid the same scarce
        // resource as founding with no way to know. Behavior is unchanged;
        // only the copy now says what both buttons already cost.
        description="새로 지을까요, 기존 건물을 키울까요? 둘 다 건축 슬롯 1개를 써요."
        onClose={() => setGrowDraft(null)}
        cancelButton={<ConfirmDialog.CancelButton onClick={handleBuildNew}>새로 짓기</ConfirmDialog.CancelButton>}
        confirmButton={<ConfirmDialog.ConfirmButton onClick={handleGrow}>키우기</ConfirmDialog.ConfirmButton>}
      />
    </div>
  );
}
