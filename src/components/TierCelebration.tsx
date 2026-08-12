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

const AUTO_DISMISS_MS = 4000;

export interface CelebrationBannerProps {
  emoji: string;
  title: string;
  subtitle: string;
  onDismiss: () => void;
}

/**
 * The banner itself — the whole non-blocking contract above lives here (no
 * dimmer, no focus trap, `role="status"`, auto-dismiss, tap to close early),
 * so any one-shot celebration can reuse it instead of growing a second
 * notification style.
 *
 * Gate-3 follow-up (A2): founding the FIRST building — the moment the whole
 * app is about — produced no celebration at all, only the same bottom-docked
 * toast every routine save gets. It now renders this exact banner, which is
 * also why this shell was split out rather than a new component written:
 * re-blocking the screen was a Gate-3 failure once already (see above) and
 * must not be reintroduced by a second implementation drifting from this one.
 */
export function CelebrationBanner({ emoji, title, subtitle, onDismiss }: CelebrationBannerProps) {
  useEffect(() => {
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div className="tier-celebration" role="status">
      <span className="tier-celebration-emoji" aria-hidden="true">
        {emoji}
      </span>
      <div className="tier-celebration-text">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <button type="button" className="tier-celebration-dismiss" aria-label="닫기" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

export interface TierCelebrationProps {
  /** The tier index just crossed (0-based, matches `selectors.ts`'s `tier()`), or null to render nothing. */
  tier: number | null;
  /** Town's building count at the moment of celebration — only read to compute the "N more to next tier" line. */
  buildingCount: number;
  tierThresholds: readonly number[];
  onDismiss: () => void;
}

export function TierCelebration({ tier, buildingCount, tierThresholds, onDismiss }: TierCelebrationProps) {
  if (tier === null) return null;

  const nextThreshold = tierThresholds[tier + 1];
  const toNext = nextThreshold === undefined ? null : Math.max(0, nextThreshold - buildingCount);

  return (
    <CelebrationBanner
      emoji="🎉"
      title={`Tier ${tier + 1} 달성! 우리 동네가 한 단계 성장했어요.`}
      subtitle={toNext === null ? "지금이 가장 높은 Tier예요" : `건물 ${toNext}채를 더 지으면 다음 Tier예요`}
      onDismiss={onDismiss}
    />
  );
}
