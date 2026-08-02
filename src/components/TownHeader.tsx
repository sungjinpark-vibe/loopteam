/**
 * S2 header (spec §6): "Header: town name, tier badge, building count,
 * streak, slot counter, queue promise line". Tier/streak/queue are out of
 * this task's scope (build order step 3+) — this renders the minimum the
 * task's AC requires: town name, building count, slot counter.
 */
export interface TownHeaderProps {
  townName: string;
  buildingCount: number;
  slotsRemaining: number;
  dailyBuildSlots: number;
}

export function TownHeader({ townName, buildingCount, slotsRemaining, dailyBuildSlots }: TownHeaderProps) {
  return (
    <header className="town-header">
      <div className="town-header-name">{townName}</div>
      <div className="town-header-stats">
        <span>건물 {buildingCount}채</span>
        <span aria-hidden="true">·</span>
        <span>
          남은 건축 슬롯 {slotsRemaining}/{dailyBuildSlots}
        </span>
      </div>
    </header>
  );
}
