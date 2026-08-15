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
import { formatSeeds, formatSeedsWithUnit } from "../economy/format";
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
import { budgetPace, moodTier, totalLevelOf, tier as computeTier } from "../selectors";
import type { Building } from "../types";
import type { AddEntryResult, TownStore } from "../useTownStore";

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
//
// Gate-3 follow-up (A5): "(+3개)" named no unit AND showed no balance, so a
// player could never tell what they were collecting or how much of it they
// had. The transient reward toast is one of exactly two surfaces
// ADDENDUM-03 §5.2 rule 6 allows the BALANCE on (the other is the shop
// header, the place it gets spent) — so it carries both now: the grant, named,
// and the running total after it.
//
// `balanceAfter` is `economy.seeds + seedsGranted` computed by the caller:
// `store.economy.seeds` read during the same render that just called
// `addEntry` is the PRE-save value from a stale closure, exactly like
// `queueLength` (see `AddEntryResult.queueLength`'s doc).
function seedSuffix(amount: number, balanceAfter: number): string {
  return amount > 0 ? ` (+${formatSeedsWithUnit(toSeedCount(amount))} · 모은 ${formatSeeds(toSeedCount(balanceAfter))})` : "";
}

// FT-1 fix — both queue-deferral toasts below (an over-cap entry and a
// no-spend park) share this same fragment, and both had the same defect:
// promising "내일 아침에" (tomorrow morning). Both ride `queueActions.ts`'s
// `drainQueue`, whose own doc says a drain "may return FEWER than requested
// — town could be full" (queueActions.ts:61); an entry can queue for either
// reason (`entryActions.ts`'s `decideBuildOrQueue`: daily slots exhausted OR
// `placeNew` found no room), so neither call site can tell, at queue time,
// whether tomorrow will actually have room. A promise the app can't
// guarantee — fixed once here so the two toasts can't drift back out of
// sync (a comment saying "borrows that path's wording verbatim" is not
// enough; a shared constant is).
const QUEUED_BUILD_PROMISE = "자리가 나면 지어드릴게요";

// Gate-3 follow-up (A6): the toast layer's clearance above the bottom tab bar
// and the FAB column is owned entirely by App.css's
// `#tds-mobile-portal-container > [aria-live="polite"]` rule now — see its
// comment for the measurement. `openToast`'s `gap` option only moved the card
// (leaving the wrapper itself over the tab bar, swallowing its taps), so no
// call site here passes one; a new toast is correctly placed by default.

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
  // ADDENDUM-04 §4 — the open 새 건물 세우기 / 기존 건물 키우기 choice, read
  // straight off the store's PERSISTED marker (`PendingGrowChoice`). This used
  // to be `useState<EntryDraft | null>` holding an UNSAVED draft, which meant a
  // reload while the dialog (or pick mode) was showing destroyed the entry
  // outright — gone from 기록, from 씨앗, from everywhere. The entry is
  // committed before this is ever non-null now; only the building effect is
  // still open. Non-null for exactly the lifetime of "the ConfirmDialog OR
  // pick mode is showing", same as before, but across reloads too.
  const pendingGrow = store.pendingGrowChoice;
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

  // Split out of `saveEntry` so the deferred-choice resolution
  // (`resolveGrow` below) announces its outcome through the SAME four
  // branches: both paths produce the identical `AddEntryResult`, and a second
  // copy of this toast logic is exactly how the two would drift.
  // `levelBeforeGrow` is captured by the caller BEFORE the mutation.
  function announce(result: AddEntryResult, levelBeforeGrow: number | null) {
    // A5 — the balance AFTER this save. `store.economy.seeds` is the pre-save
    // value here (stale render closure, same as `queueLength` below).
    const seedsAfter = store.economy.seeds + result.seedsGranted;
    // A6 — the first founding raises A2's celebration banner, and both it and
    // the routine build toast are bottom-docked: measured in the browser, they
    // land on the same line and the toast covers the banner's copy. The banner
    // IS the feedback for that one save, so the toast stands down rather than
    // stacking on it (`store.buildingCount` is the pre-save count, same stale
    // closure as `seedsAfter` above). Every later build toasts as before.
    const isFirstFounding = result.building !== null && store.buildingCount === 0;
    // F14: a save with zero slots either queues (return-promise toast) or,
    // once the queue itself is full, overflows plainly — never a silent no-op.
    if (result.queued) {
      // `result.queueLength` is the queue's length AFTER this save (post-push) —
      // `store.queueLength` would read the PRE-save value here, from the
      // render closure captured before `addEntry`'s state commit re-renders.
      // B4 — a queued save still earns the entry award, so it carries the same
      // suffix as the build/level-up toasts below; without it the only saves
      // that ever showed a reward were the ones that raised a building.
      openToast(`오늘 슬롯을 다 썼어요. ${QUEUED_BUILD_PROMISE} (대기 ${result.queueLength}개)${seedSuffix(result.seedsGranted, seedsAfter)}`);
    } else if (result.queueOverflow) {
      openToast("대기열도 가득 찼어요. 건물 없이 저장했어요.");
    } else if (result.grew) {
      // ADDENDUM-04 §5/§8 — one-line level-up feedback on the same toast
      // channel as F14's notices above; no celebration system (§4's "what
      // was deliberately NOT built" applies to this feedback too).
      //
      // Gate-3 round-5 fix (A4). Two defects in the old one-liner
      // `레벨이 올랐어요! (Lv.N)`:
      //   1. A bare "(Lv.N)" does not say whether N is the resulting level or
      //      the number of levels gained. "(지금 Lv.N)" names it as the level
      //      the building is at NOW.
      //   2. It fired on every grow, but a grow only ADDS EXP — the level
      //      moves solely when that exp crosses a threshold, so a small save
      //      into a Lv.1 building announced a level-up that had not happened
      //      (the panel caught exactly this, as "(Lv.1)"). The save still
      //      spent a build slot and still earned seeds, so it must not go
      //      silent either; it gets the honest message instead of the wrong one.
      // Guarded here rather than per call site: `announce` is the single
      // function all three grow paths (handleBuildNew, handleGrow,
      // handleGrowPickCommit) route through.
      const levelAfterGrow = totalLevelOf(result.grew, BALANCE.expPerLevel, BALANCE.maxLevel);
      const grewMessage =
        levelBeforeGrow !== null && levelAfterGrow > levelBeforeGrow
          ? `레벨이 올랐어요! (지금 Lv.${levelAfterGrow})`
          : `경험치가 쌓였어요 (지금 Lv.${levelAfterGrow})`;
      openToast(`${grewMessage}${seedSuffix(result.seedsGranted, seedsAfter)}`);
    } else if (result.building?.categoryId && !isFirstFounding) {
      // Gate-3-rerun fix (ux-researcher/target-player TOP FIX): the reward
      // used to resolve as a silent speck somewhere in an already-dense map
      // — `TownGrid`'s own `justBuiltId` effect now zooms/scrolls the camera
      // to it (reusing ADDENDUM-09's zoom), and this toast names what just
      // rose so the moment reads as "you built something", not "a header
      // number changed". Design invariant 2 (spec §7): no KRW amount here —
      // `seedSuffix` below is a game-currency count, not money, so it's a
      // different axis from the invariant this note is guarding.
      const content = CATEGORY_CONTENT[result.building.categoryId];
      openToast(`${content.icon} ${content.label} 건물이 생겼어요${seedSuffix(result.seedsGranted, seedsAfter)}`);
    }
  }

  // A4 — the grow target's level BEFORE the mutation, so `announce` can tell
  // "the level moved" from "exp landed inside the same level band". Read
  // through the SAME `totalLevelOf` the toast uses for the after-value, so the
  // two sides can never disagree about what a level is.
  function levelOfTarget(growTargetId?: string): number | null {
    const before = growTargetId ? store.buildings.find((b) => b.id === growTargetId) : undefined;
    return before ? totalLevelOf(before, BALANCE.expPerLevel, BALANCE.maxLevel) : null;
  }

  function saveEntry(draft: EntryDraft, deferGrowChoice?: boolean) {
    announce(store.addEntry(draft, undefined, deferGrowChoice), null);
  }

  // ADDENDUM-04 §4 — answer the persisted choice. `undefined` means 새로 짓기,
  // which is also what a dismissed dialog defaults to: the entry is already
  // saved either way, so there is no path left that drops it.
  function resolveGrow(growTargetId?: string) {
    const levelBefore = levelOfTarget(growTargetId);
    const result = store.resolveGrowChoice(growTargetId);
    if (result === null) return; // nothing pending — a double tap, or a resolve racing a reload
    announce(result, levelBefore);
  }

  function handleGrowPickCommit(buildingId: string) {
    resolveGrow(buildingId);
  }

  // ADDENDUM-11 §6 — fusion reuses `useGrowPickMode` wholesale rather than a
  // second pick-mode hook (spec is explicit about this): one `pickPurpose`
  // flag beside the existing `growPick` instance, branching the banner copy
  // and the commit callback. The two purposes can never both be active — grow
  // starts from the entry sheet, fusion from the detail sheet, and both entry
  // points are unreachable while pick mode is already open (the FAB that
  // opens either is hidden for the duration).
  const [pickPurpose, setPickPurpose] = useState<"grow" | "fuse">("grow");
  // The building that started fusion pick mode (survives the fusion) — held
  // only for the lifetime of fuse pick mode, read once the partner is tapped.
  const [fuseSurvivorId, setFuseSurvivorId] = useState<string | null>(null);
  // The confirm step (§6 "Confirmation step"): fusion consumes a building and
  // has no undo, unlike grow or move, so committing a tap only stages this —
  // the actual `store.fuseBuildings` call waits for the dialog's confirm tap.
  const [fuseConfirm, setFuseConfirm] = useState<{ survivor: Building; consumed: Building } | null>(null);

  function handleFusePickCommit(buildingId: string) {
    const survivor = fuseSurvivorId !== null ? store.buildings.find((b) => b.id === fuseSurvivorId) : undefined;
    const consumed = store.buildings.find((b) => b.id === buildingId);
    setFuseSurvivorId(null);
    if (!survivor || !consumed) return; // defensive — one of the pair vanished mid-pick
    setFuseConfirm({ survivor, consumed });
  }

  function handlePickCommit(buildingId: string) {
    if (pickPurpose === "fuse") {
      handleFusePickCommit(buildingId);
      return;
    }
    handleGrowPickCommit(buildingId);
  }

  const growPick = useGrowPickMode(store.buildings, handlePickCommit);
  const pickModeActive = growPick.candidateIds !== null;
  // Escape / Android back exit pick mode through the hook's OWN `cancel`
  // (`useBackGuard` inside the hook), which never touches TownScreen's
  // `pickPurpose`/`fuseSurvivorId` — without this, a back-gestured-out-of
  // fusion would leave `pickPurpose` stuck on "fuse" and silently misroute
  // the next grow pick's commit. Fires on every exit (취소, a valid commit,
  // Escape, Android back) — idempotent, since the commit paths above already
  // clear `fuseSurvivorId` themselves.
  useEffect(() => {
    if (growPick.candidateIds === null) setPickPurpose("grow");
  }, [growPick.candidateIds]);
  // Dialog and pick-mode are two phases of the SAME `growDraft`, never shown
  // together — the dialog closes the instant pick mode starts (§4: "the
  // sheet is already closed, the town is visible, candidates highlighted").
  const growDialogOpen = pendingGrow !== null && !pickModeActive;

  function handleSave(draft: EntryDraft) {
    // ADDENDUM-04 §4 — the choice trigger, evaluated once at save time.
    const canGrow =
      draft.type !== "saving" && store.slotsRemaining > 0 && store.growCandidates(draft.categoryId).length > 0;
    // Close the sheet FIRST — the dialog must never nest inside an open
    // BottomSheet (the vendor backdrop bug `useConfirmDialogBackdropFix`
    // exists for; avoided here by construction, not patched a second time).
    setSheetOpen(false);
    // Either way the entry is WRITTEN by this call. `deferGrowChoice` only
    // parks the building effect; the dialog below opens off the persisted
    // marker that write produced. If the town turned out to be full, the store
    // queues instead and leaves no marker — no dialog, and `announce` already
    // fired the F14 queued toast.
    saveEntry(draft, canGrow);
  }

  function handleBuildNew() {
    resolveGrow();
  }

  function handleGrow() {
    if (pendingGrow === null) return;
    const candidates = store.growCandidates(pendingGrow.categoryId);
    // Zero candidates is reachable only after a reload (the last same-category
    // building was deleted or fused away while the choice sat open) — 키우기
    // has nothing to grow, so it resolves as 새로 짓기 rather than dead-ending.
    if (candidates.length <= 1) {
      resolveGrow(candidates[0]?.id);
      return;
    }
    // 2+ candidates — grid pick mode (§4). The pending marker stays put; the
    // ConfirmDialog closes on its own via `growDialogOpen` above.
    growPick.start(new Set(candidates.map((c) => c.id)));
    // Gate-3 follow-up (A1) — the third affordance move mode has and pick
    // mode did not. Move mode teaches its own gesture with a one-shot hint
    // toast (`Notice.moveHint`); pick mode hid the FAB with nothing but a
    // highlight to explain why, so a player who missed the highlight read it
    // as "the primary button vanished". Same transient toast channel every
    // other TownScreen feedback line already uses — no new surface.
    openToast(`반짝이는 건물 ${candidates.length}채 중에서 키울 건물을 탭하세요`);
  }

  function handleGrowPickCancel() {
    growPick.cancel();
    setFuseSurvivorId(null);
    // The pending choice is deliberately NOT cleared: backing out of pick mode
    // returns to the dialog it came from. This used to drop the held draft,
    // which silently threw the entry away.
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

  // ADDENDUM-11 §6 step 2 — the CTA on `BuildingDetailSheet` renders only when
  // a legal partner exists; `store.fuseCandidates` already applies every §2.2
  // condition (F1-F6), so this is surfaced, never re-derived.
  const fuseCandidateBuildings = selectedBuilding ? store.fuseCandidates(selectedBuilding.id) : [];

  function handleFuseStart() {
    if (selectedBuildingId === null || fuseCandidateBuildings.length === 0) return;
    setSelectedBuildingId(null); // close the detail sheet — the sheet is already closed once pick mode starts (§6, mirrors grow)
    setPickPurpose("fuse");
    setFuseSurvivorId(selectedBuildingId);
    growPick.start(new Set(fuseCandidateBuildings.map((b) => b.id)));
    // Same entry-hint-toast affordance the A1 grow follow-up added — pick
    // mode hides the FAB, so the reason needs to be said out loud, not just
    // shown as a highlight.
    openToast(`반짝이는 건물 ${fuseCandidateBuildings.length}채 중에서 융합할 건물을 탭하세요`);
  }

  // §6 "Confirmation step" — fusion consumes a building and has no undo
  // (unlike move), so the tap that picked a partner only staged `fuseConfirm`
  // above; the actual mutation happens here, on an explicit confirm tap.
  function handleFuseConfirm() {
    if (fuseConfirm === null) return;
    const { survivor, consumed } = fuseConfirm;
    setFuseConfirm(null);
    const result = store.fuseBuildings(survivor.id, consumed.id);
    if (result === null) return; // defensive — re-checked in the store; a stale pick can't commit an illegal fusion
    const seedsAfter = store.economy.seeds + result.seedsGranted;
    openToast(`두 건물이 합쳐져 Lv.${result.level} 건물이 됐어요!${seedSuffix(result.seedsGranted, seedsAfter)}`);
  }

  function handleFuseCancel() {
    setFuseConfirm(null);
    // Gate-3-rerun fix (all five expert lenses): pick mode itself already
    // exits the instant a partner is tapped (`useGrowPickMode.onPlotTap`
    // clears `candidateIds` before committing), so by the time this dialog's
    // own 취소 fires, fuse-pick mode is provably NOT active — the FAB is
    // already back. The bug QA hit was purely cosmetic but genuinely
    // ambiguous: the vendor toast (`@toss/tds-mobile`'s `useToast`, no
    // `closeToast` in its exposed API) from `handleFuseStart`'s "반짝이는
    // 건물 N채 중에서..." instruction can still be mid-display, with no 취소
    // bar left to contradict it, so it reads as "still picking". Firing a
    // fresh toast is the only way this vendor hook lets us retire a stale
    // one early — it replaces whatever is on screen with an explicit,
    // unambiguous "cancelled" message.
    openToast("합치기를 취소했어요");
  }

  function handleClaimNoSpend() {
    const claimed = store.claimNoSpend();
    if (!claimed) return;
    if (claimed.queued) {
      // Town full — the park deferred onto the same queue an over-cap entry
      // uses, so it shares that path's `QUEUED_BUILD_PROMISE` fragment
      // (see the queued branch of `handleAddEntry` above): 공원 for 건물,
      // nothing else new.
      openToast(`오늘은 무지출! 공원은 ${QUEUED_BUILD_PROMISE} (대기 ${claimed.queueLength}개)`);
      return;
    }
    openToast(BALANCE.noSpendDayCostsSlot ? "오늘은 무지출! 공원이 생겼어요. (슬롯 1개 사용)" : "오늘은 무지출! 공원이 생겼어요.");
  }

  // Gate-3-rerun fix (round 3, near-unanimous panel finding): tier reads
  // `store.townScale` (Σ 2**fuse), NOT `store.buildingCount` — the latter is
  // now the literal, player-facing count `TownHeader` displays and must
  // never drive the tier gate or it drifts the moment a fusion changes one
  // but not the other. See `useTownStore.ts`'s `buildingCount`/`townScale`
  // doc and `entryActions.ts`'s `buildingCountBeforeThis` doc for the split.
  const tier = computeTier(store.townScale, BALANCE.tierThresholds);

  // A1 — see `TownHeader`'s `nextTierLabel` doc. Same `tierThresholds` array
  // and the same `store.townScale` the tier itself is computed from one line
  // up, so the readout can never disagree with the badge it sits beside.
  // `undefined` past the last threshold === already at the top tier.
  const nextTierThreshold = BALANCE.tierThresholds[tier + 1];
  const nextTierLabel =
    nextTierThreshold === undefined
      ? null
      : `Tier ${tier + 2}까지 ${Math.max(0, nextTierThreshold - store.townScale)}채분`;

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
        streakAtRisk={store.streakAtRisk}
        lastActOn={store.lastActOn}
        today={store.today}
        nextTierLabel={nextTierLabel}
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
        onInvalidDrop={move.onInvalidDrop}
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
          {/* Gate-3 follow-up (A1): reads `rejectMessage ?? instruction`,
              exactly like the move-mode banner one branch up, so a tap on a
              non-candidate answers instead of doing nothing. ADDENDUM-11 §6:
              the instruction branches on `pickPurpose` — the reject copy for
              a stray tap stays shared, matching grow's own behaviour. */}
          <span>{growPick.rejectMessage ?? (pickPurpose === "fuse" ? "융합할 건물을 선택하세요" : "키울 건물을 선택하세요")}</span>
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
        // A5 — the labelled formatter: every seed number the shop renders
        // (balance chip and prices alike) now names its unit, so the spend
        // surface and the earn toast can't disagree about what "N개" means.
        formatSeeds={formatSeedsWithUnit}
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
        canFuse={fuseCandidateBuildings.length > 0}
        onFuse={handleFuseStart}
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
        //
        // Gate-3 round-5 fix (A2): cost parity alone still hid the PAYOFF —
        // "a choice with a hidden payoff is not a decision, it is a coin flip
        // the player later discovers was wrong." Each button now names what
        // it actually leaves behind: 새로 짓기 produces the second
        // same-category same-footprint building that `fusionActions.canFuse`
        // requires as a fusion partner (once BOTH reach `maxLevel` — stated,
        // because a fusion partner that isn't usable yet is exactly the kind
        // of hidden payoff this finding was about), 키우기 moves the existing
        // building's level now. `BALANCE.maxLevel` rather than a literal 5 so
        // the copy cannot drift from the rule it describes.
        description={`새로 지으면 같은 건물이 한 채 더 생겨요 — 둘 다 Lv.${BALANCE.maxLevel}가 되면 합쳐서 더 높은 건물 한 채로 만들 수 있어요. 키우면 지금 있는 건물의 레벨이 올라가요. 둘 다 건축 슬롯 1개를 써요.`}
        // Dismissing without choosing defaults to 새로 짓기 (the entry is
        // already saved; this only settles which building effect it gets).
        onClose={handleBuildNew}
        cancelButton={<ConfirmDialog.CancelButton onClick={handleBuildNew}>새로 짓기</ConfirmDialog.CancelButton>}
        confirmButton={<ConfirmDialog.ConfirmButton onClick={handleGrow}>키우기</ConfirmDialog.ConfirmButton>}
      />

      {/* ADDENDUM-11 §6 "Confirmation step" — fusion CONSUMES a building the
          player built and has no undo (unlike move), so it must never commit
          from a single ambiguous tap. Names the category, both buildings'
          current level, and the resulting level before anything happens. */}
      {fuseConfirm && (
        <ConfirmDialog
          open
          title="건물을 융합할까요?"
          description={`${fuseConfirm.survivor.categoryId ? CATEGORY_CONTENT[fuseConfirm.survivor.categoryId].label : "건물"} Lv.${store.levelOfBuilding(fuseConfirm.survivor)} 두 채를 합쳐 Lv.${store.levelOfBuilding(fuseConfirm.survivor) + 1} 건물 하나로 만들어요. 사라지는 건물은 되돌릴 수 없어요.`}
          onClose={handleFuseCancel}
          cancelButton={<ConfirmDialog.CancelButton onClick={handleFuseCancel}>취소</ConfirmDialog.CancelButton>}
          // Deliberately NOT "융합하기" — `BuildingDetailSheet`'s CTA keeps that
          // label and its `BottomSheet` stays mounted (closed, not unmounted,
          // same contract `EntrySheet` documents) even after this dialog opens,
          // so an identical label here would be a second, ambiguous button.
          confirmButton={<ConfirmDialog.ConfirmButton onClick={handleFuseConfirm}>합치기</ConfirmDialog.ConfirmButton>}
        />
      )}
    </div>
  );
}
