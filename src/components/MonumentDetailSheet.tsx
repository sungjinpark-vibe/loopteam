/**
 * F16 monument detail popover — MVP-SPEC.md §7 F16 AC: "Tapping a monument
 * shows that month's summary." Reuses the same `BottomSheet` (TDS) sheet
 * pattern `EntryDetailSheet.tsx` (S5) already established — same
 * open/onClose contract, same "return null once the subject is null" shape
 * — but read-only: `monumentSummary` is frozen at settlement (spec: "never
 * recomputed"), so there is no form state, no save, no delete. Row layout
 * reuses 기록's own `.history-total-*` classes (HistoryScreen.tsx) rather
 * than inventing a second stat-row style.
 */
import { BottomSheet, Button } from "@toss/tds-mobile";
import { BALANCE } from "../balance.approved";
import { parseYm } from "../calendar";
import { monumentOutcomeLabel } from "../content.placeholder";
import { formatSeedsWithUnit } from "../economy/format";
import { seeds as toSeedCount } from "../economy/types";
import { formatKrw } from "../format";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import type { Building } from "../types";

export interface MonumentDetailSheetProps {
  open: boolean;
  /** A building with `source.kind === "monument"` (carries `monumentSummary`); null closes the sheet. */
  monument: Building | null;
  onClose: () => void;
}

function formatPeriodLabel(period: string): string {
  const { y, m } = parseYm(period);
  return `${y}년 ${m}월`;
}

export function MonumentDetailSheet({ open, monument, onClose }: MonumentDetailSheetProps) {
  // Gate-3 round-3 fix — same sibling gap `BuildingDetailSheet` had (see
  // `useEscapeToClose`'s doc): called unconditionally, before the early
  // return below, per Rules of Hooks.
  useEscapeToClose(open, onClose);
  const summary = monument?.monumentSummary ?? null;
  if (summary === null) return null; // nothing to show — BottomSheet stays closed via `open` regardless

  return (
    <BottomSheet
      open={open}
      onDimmerClick={onClose}
      header={<div className="entry-sheet-title">{formatPeriodLabel(summary.period)} 결산</div>}
      cta={
        <Button as="button" display="block" size="xlarge" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="entry-sheet-body">
        <p className="history-pace-label">{monumentOutcomeLabel(summary.outcomeBucket)}</p>
        <div className="history-totals">
          <div className="history-total-item">
            <span className="history-total-label">지출</span>
            <span className="history-total-value">{formatKrw(summary.expenseKrw)}</span>
          </div>
          <div className="history-total-item">
            <span className="history-total-label">수입</span>
            <span className="history-total-value">{formatKrw(summary.incomeKrw)}</span>
          </div>
          <div className="history-total-item">
            <span className="history-total-label">저축</span>
            <span className="history-total-value">{formatKrw(summary.savingKrw)}</span>
          </div>
          <div className="history-total-item">
            <span className="history-total-label">기록한 날</span>
            <span className="history-total-value">{summary.daysLogged}일</span>
          </div>
        </div>
        {/* Gate-3-rerun fix (라이브옵스 PD TOP FIX): settlement's own seed grant
            used to have no line anywhere, including here. `primeLotCount`'s
            bonus lived only at drain time and isn't part of the frozen
            `MonthSummary` this sheet reads (reopening an old monument can't
            know how many prime lots the town had that day), so this states
            the guaranteed BASE grant only — true for every monument, never
            an invented exact total. */}
        {BALANCE.seedAwards.settlementByOutcomeBucket[summary.outcomeBucket] > 0 && (
          <p className="history-pace-label">
            이 정산으로 최소 {formatSeedsWithUnit(toSeedCount(BALANCE.seedAwards.settlementByOutcomeBucket[summary.outcomeBucket]))}를 받았어요
            (명당 보너스는 별도예요)
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
