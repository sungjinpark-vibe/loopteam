/**
 * F16 — "지난달 결산" one-time card, MVP-SPEC.md §7 F16: "Show a one-time
 * '지난달 결산' card summarizing the most recent settled month." Reuses the
 * exact non-blocking toast-style banner `TierCelebration.tsx` already
 * established (same `.tier-celebration*` classes, App.css) rather than
 * adding a new overlay layer — the two never show together (one `Notice` at
 * a time, useTownStore.ts's FIFO), so sharing the banner's position/z-index
 * is safe. Unlike a tier's one-line brag, this card carries real numbers
 * worth reading, so dismiss is manual only — no auto-timer.
 *
 * Naturally never reappears on reload once dismissed: settlement only ever
 * pushes this notice on the boot that actually minted a monument, and
 * `settleMonths` is idempotent (`useTownStore.ts`'s own doc) — a later boot
 * finds nothing unsettled and pushes nothing.
 */
import { parseYm } from "../calendar";
import { monumentOutcomeLabel } from "../content.placeholder";
import { formatKrw } from "../format";
import type { MonthSummary } from "../types";

export interface SettlementCardProps {
  /** The most recently settled month's frozen summary, or null to render nothing. */
  summary: MonthSummary | null;
  onDismiss: () => void;
}

function formatPeriodLabel(period: string): string {
  const { y, m } = parseYm(period);
  return `${y}년 ${m}월`;
}

export function SettlementCard({ summary, onDismiss }: SettlementCardProps) {
  if (summary === null) return null;

  return (
    <div className="tier-celebration" role="status">
      <span className="tier-celebration-emoji" aria-hidden="true">
        🏛️
      </span>
      <div className="tier-celebration-text">
        <strong>
          {formatPeriodLabel(summary.period)} 결산 — {monumentOutcomeLabel(summary.outcomeBucket)}
        </strong>
        <span>
          지출 {formatKrw(summary.expenseKrw)} · 수입 {formatKrw(summary.incomeKrw)} · 저축 {formatKrw(summary.savingKrw)}
        </span>
      </div>
      <button type="button" className="tier-celebration-dismiss" aria-label="닫기" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
