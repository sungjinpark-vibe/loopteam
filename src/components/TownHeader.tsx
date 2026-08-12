/**
 * S2 header (spec §6): "Header: town name, tier badge, building count,
 * streak, slot counter, queue promise line." This task (build order step 3)
 * adds tier/streak/queue — the previous task shipped town name, building
 * count, and the slot counter.
 *
 * F-BGM (ADDENDUM-05 §5) adds a speaker toggle here — "a small speaker
 * toggle button ... one tap, no menu diving; this is the one people actually
 * use." Mirrors `settingsRow`'s toggle in `SettingsSheet.tsx`; both drive the
 * same `bgmMuted` flag the parent owns.
 */
import "../bgm.css";

export interface TownHeaderProps {
  townName: string;
  buildingCount: number;
  slotsRemaining: number;
  dailyBuildSlots: number;
  tier: number;
  streakDays: number;
  queueLength: number;
  /** F6 — one-line mood status ("이번 달 페이스가 ..." or the null-budget nudge). Pure content, computed by the caller from `selectors.moodTier`. */
  moodLabel: string;
  /** F6 — weather emoji for the same mood tier (content.placeholder.ts's `MoodContent.icon`) — makes "동네 날씨" (onboarding step 3) legible next to the text, not just the S2 sky-gradient background. */
  moodIcon: string;
  /** True when `moodLabel` is the null-budget nudge (`moodTier === -1`) — the caller already knows this from computing `moodLabel`, so it's cheaper to pass than to re-match the string here. Makes the nudge itself tappable straight into 설정 (ux-researcher/liveops-pd finding, playtest round 1: the mood line asks the player to set a budget but offered no way to). */
  budgetUnset: boolean;
  /** S6 설정 is also reachable straight from the Town tab now, not only via 기록. */
  onOpenSettings: () => void;
  /** F-BGM — current mute state, persisted on `core.budget.bgmMuted` by the parent. */
  bgmMuted: boolean;
  /** F-BGM — flips the shared mute flag; also driven from the settings-sheet row. */
  onSetBgmMuted: (muted: boolean) => void;
}

export function TownHeader({
  townName,
  buildingCount,
  slotsRemaining,
  dailyBuildSlots,
  tier,
  streakDays,
  queueLength,
  moodLabel,
  moodIcon,
  budgetUnset,
  onOpenSettings,
  bgmMuted,
  onSetBgmMuted,
}: TownHeaderProps) {
  return (
    <header className="town-header">
      <div className="town-header-top">
        <div className="town-header-name">{townName}</div>
        <div className="town-header-top-right">
          {/* Game-side quantity, never rendered like money (design invariant 2, spec §7) — a plain "Tier N" label. */}
          <span className="town-header-tier-badge">Tier {tier + 1}</span>
          <button
            type="button"
            className="town-header-bgm-toggle"
            aria-label="배경음악 음소거"
            aria-pressed={!bgmMuted}
            onClick={() => onSetBgmMuted(!bgmMuted)}
          >
            {bgmMuted ? "🔇" : "🔊"}
          </button>
          <button type="button" className="town-header-settings" aria-label="설정" onClick={onOpenSettings}>
            ⚙️
          </button>
        </div>
      </div>
      <div className="town-header-stats">
        <span>건물 {buildingCount}채</span>
        <span aria-hidden="true">·</span>
        <span>
          남은 건축 슬롯 {slotsRemaining}/{dailyBuildSlots}
        </span>
        <span aria-hidden="true">·</span>
        <span>연속 {streakDays}일</span>
      </div>
      {/* F6 — ambient only: never removes/greys/downgrades a building, just this one line of text. Tappable straight into 설정 when there's no budget yet, since the copy itself asks the player to set one (playtest round 1). */}
      {budgetUnset ? (
        <button type="button" className="town-header-mood town-header-mood--link" onClick={onOpenSettings}>
          <span aria-hidden="true">{moodIcon}</span> {moodLabel} ›
        </button>
      ) : (
        <p className="town-header-mood">
          <span aria-hidden="true">{moodIcon}</span> {moodLabel}
        </p>
      )}
      {queueLength > 0 && <div className="town-header-queue-promise">내일 지을 건물 {queueLength}개 대기 중</div>}
    </header>
  );
}
