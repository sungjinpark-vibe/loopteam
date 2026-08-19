/**
 * Guided highlight sequence's third beat (건물 건축/레벨업/병합 → 딤처리 →
 * 하이라이트 → 안내 팝업, TownScreen.tsx owns the staging/timing; the dim +
 * lifted tile themselves live in TownGrid.tsx/App.css).
 *
 * Reuses the exact `BottomSheet` + `useEscapeToClose` contract
 * `BuildingDetailSheet.tsx`/`MonumentDetailSheet.tsx` already established
 * (open/onClose, dimmer via `onDimmerClick`, Escape via the shared hook) —
 * verified against the vendor bundle that `BottomSheet` already renders
 * Radix's `role="dialog"`/`aria-modal="true"` and runs `trapFocus`/
 * `onOpenAutoFocus`/`onCloseAutoFocus` internally, so this gets a real modal
 * dialog (focus moved in on open, returned on close) for free, exactly like
 * every other sheet in this app already does.
 *
 * `CelebrationBanner` (TierCelebration.tsx) was deliberately NOT reused
 * here: its own header comment states the opposite contract on purpose ("no
 * dimmer, no focus trap ... the FAB and every other control keep working
 * underneath it") — built that way after a round-1 playtest rejected a
 * blocking modal for THAT moment. This feature explicitly asks for a dimmed,
 * modal, guided moment, so `CelebrationBanner` is the wrong shape here.
 */
import { BottomSheet, Button } from "@toss/tds-mobile";
import { CATEGORY_CONTENT } from "../content.placeholder";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { totalLevelOf } from "../selectors";
import type { Building } from "../types";
import type { SpotlightKind } from "../useTownStore";

export interface SpotlightPopupProps {
  open: boolean;
  kind: SpotlightKind | null;
  /** The spotlighted building, or null while nothing's spotlighted (or its id no longer resolves). */
  building: Building | null;
  expPerLevel: number;
  maxLevel: number;
  onClose: () => void;
}

function subtitleFor(kind: SpotlightKind, level: number): string {
  switch (kind) {
    case "built":
      return "새 건물이 생겼어요";
    case "levelUp":
      return `Lv.${level}(으)로 레벨업했어요`;
    case "fused":
      return `두 건물이 합쳐져 Lv.${level} 건물이 됐어요`;
  }
}

export function SpotlightPopup({ open, kind, building, expPerLevel, maxLevel, onClose }: SpotlightPopupProps) {
  useEscapeToClose(open, onClose); // called unconditionally — Rules of Hooks — before the early return below
  if (building === null || kind === null) return null;

  // Same content-helper lookup `BuildingDetailSheet.tsx` uses, never a
  // hand-rolled name table — `categoryId` is `'park'` (not null) for the
  // 무지출 park tile, so `CATEGORY_CONTENT` already covers it ("무지출 공원");
  // only a monument (categoryId null) would fall back, and monuments never
  // reach this popup (none of the three trigger sites ever spotlight one).
  const name = building.categoryId ? CATEGORY_CONTENT[building.categoryId].label : "건물";
  const level = totalLevelOf(building, expPerLevel, maxLevel);

  return (
    <BottomSheet
      open={open}
      onDimmerClick={onClose}
      header={<div className="entry-sheet-title">{name}</div>}
      cta={
        <Button as="button" display="block" size="xlarge" onClick={onClose}>
          확인
        </Button>
      }
    >
      <div className="entry-sheet-body">
        <p className="history-pace-label">{subtitleFor(kind, level)}</p>
      </div>
    </BottomSheet>
  );
}
