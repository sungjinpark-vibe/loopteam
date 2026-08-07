/**
 * F5 tier-up celebration — MVP-SPEC.md §5 F5 / §6.1 asset #8: "Layout is
 * identical per tier; only the label string and a badge colour token
 * differ."
 *
 * Round-1 5-expert playtest (game-designer/ux-researcher/liveops-pd/qa-lead/
 * target-player all flagged this): the original build used TDS's
 * `ConfirmDialog`, a full-screen BLOCKING modal that swallowed every pointer
 * event — including the FAB — until explicitly dismissed, landing exactly at
 * the moment a player is mid-batch logging (the app's core "fast entry"
 * promise). It also said nothing about what a tier actually means. Rebuilt
 * as a non-blocking toast-style banner instead: no dimmer, no focus trap, the
 * FAB and every other control keep working underneath it, and it auto-
 * dismisses on its own after a few seconds (still tappable to dismiss early)
 * — the same "acknowledge and keep going" pattern the app's other one-shot
 * notices (`App.tsx`'s toast queue) already use. States what changed (tier
 * number + how many buildings until the next one) instead of a bare "다음
 * Tier까지" placeholder.
 */
import { useEffect } from "react";

export interface TierCelebrationProps {
  /** The tier index just crossed (0-based, matches `selectors.ts`'s `tier()`), or null to render nothing. */
  tier: number | null;
  /** Town's building count at the moment of celebration — only read to compute the "N more to next tier" line. */
  buildingCount: number;
  tierThresholds: readonly number[];
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4000;

export function TierCelebration({ tier, buildingCount, tierThresholds, onDismiss }: TierCelebrationProps) {
  useEffect(() => {
    if (tier === null) return;
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [tier, onDismiss]);

  if (tier === null) return null;

  const nextThreshold = tierThresholds[tier + 1];
  const toNext = nextThreshold === undefined ? null : Math.max(0, nextThreshold - buildingCount);

  return (
    <div className="tier-celebration" role="status">
      <span className="tier-celebration-emoji" aria-hidden="true">
        🎉
      </span>
      <div className="tier-celebration-text">
        <strong>Tier {tier + 1} 달성! 우리 동네가 한 단계 성장했어요.</strong>
        <span>{toNext === null ? "지금이 가장 높은 Tier예요" : `건물 ${toNext}채를 더 지으면 다음 Tier예요`}</span>
      </div>
      <button type="button" className="tier-celebration-dismiss" aria-label="닫기" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
