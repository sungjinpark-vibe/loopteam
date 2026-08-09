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
import { parseYm } from "../calendar";
import { monumentOutcomeLabel } from "../content.placeholder";
import { formatKrw } from "../format";
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
      </div>
    </BottomSheet>
  );
}
