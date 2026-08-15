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
import { formatSeedsWithUnit } from "../economy/format";
import { seeds as toSeedCount } from "../economy/types";
import { formatKrw } from "../format";
import type { MonthSummary } from "../types";

export interface SettlementCardProps {
  /** The most recently settled month's frozen summary, or null to render nothing. */
  summary: MonthSummary | null;
  /**
   * Gate-3-rerun fix (라이브옵스 PD TOP FIX): settlement is the single
   * largest seed grant in the game (`BALANCE.seedAwards.settlementByOutcomeBucket`
   * + a prime-lot bonus) and used to land with no line here at all — a
   * lapsed player's payday on the 1st, paid silently. Named on its OWN line
   * below the KRW figures (never inline with them — R-9b bans typographic
   * parallelism between the two), and only the grant this settlement paid,
   * never a running balance (rule 6 keeps the ongoing total off every
   * surface but the shop header and the reward toast).
   */
  seedsGranted: number;
  onDismiss: () => void;
}

function formatPeriodLabel(period: string): string {
  const { y, m } = parseYm(period);
  return `${y}년 ${m}월`;
}

export function SettlementCard({ summary, seedsGranted, onDismiss }: SettlementCardProps) {
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
        {seedsGranted > 0 && <span>이번 달 정산으로 {formatSeedsWithUnit(toSeedCount(seedsGranted))}를 받았어요</span>}
      </div>
      <button type="button" className="tier-celebration-dismiss" aria-label="닫기" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
