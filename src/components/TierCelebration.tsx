/**
 * F5 tier-up celebration — MVP-SPEC.md §5 F5 / §6.1 asset #8: "Layout is
 * identical per tier; only the label string and a badge colour token
 * differ." Built on TDS's `ConfirmDialog` (idiomatic-TDS, VISION.md C3) —
 * it already gives this a real dialog: dimmer-click dismiss, back-event
 * dismiss, and focus/aria handling, none of which a hand-rolled `<div>`
 * gets for free. A simple overlay is enough (task brief: "do not over-build
 * the animation") — real per-tier art/labels are a later task (§6.1's
 * "text-driven, 5 tier slots").
 */
import { ConfirmDialog } from "@toss/tds-mobile";

export interface TierCelebrationProps {
  /** The tier index just crossed (0-based, matches `selectors.ts`'s `tier()`), or null to render nothing. */
  tier: number | null;
  onDismiss: () => void;
}

export function TierCelebration({ tier, onDismiss }: TierCelebrationProps) {
  return (
    <ConfirmDialog
      open={tier !== null}
      title={tier !== null ? `Tier ${tier + 1}` : ""}
      description="우리 동네가 한 단계 성장했어요!"
      onClose={onDismiss}
      confirmButton={<ConfirmDialog.ConfirmButton onClick={onDismiss}>동네로 돌아가기</ConfirmDialog.ConfirmButton>}
    />
  );
}
