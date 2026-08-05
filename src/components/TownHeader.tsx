/**
 * S2 header (spec §6): "Header: town name, tier badge, building count,
 * streak, slot counter, queue promise line." This task (build order step 3)
 * adds tier/streak/queue — the previous task shipped town name, building
 * count, and the slot counter.
 */
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
}: TownHeaderProps) {
  return (
    <header className="town-header">
      <div className="town-header-top">
        <div className="town-header-name">{townName}</div>
        {/* Game-side quantity, never rendered like money (design invariant 2, spec §7) — a plain "Tier N" label. */}
        <span className="town-header-tier-badge">Tier {tier + 1}</span>
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
      {/* F6 — ambient only: never removes/greys/downgrades a building, just this one line of text. */}
      <p className="town-header-mood">{moodLabel}</p>
      {queueLength > 0 && <div className="town-header-queue-promise">내일 지을 건물 {queueLength}개 대기 중</div>}
    </header>
  );
}
