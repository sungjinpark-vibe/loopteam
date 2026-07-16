namespace LifeTown.Economy.Core
{
    /// <summary>
    /// Timed construction brackets (spec §4.3, D10 decided-in, `14-timed-construction.md`).
    /// Duration scales with build cost so the very first building (100 coin) finishes in
    /// ~1 minute - onboarding is never blocked - while the Tier2 merge is a fixed 2-hour
    /// anticipation. Construction delays the reveal, never the reward: EXP/coin are granted
    /// at settlement time regardless of how long the scaffold sits on the grid.
    /// </summary>
    public static class ConstructionDuration
    {
        public static long ForBuildCostMs(int buildCostCoin)
        {
            if (buildCostCoin <= 100) return 1 * 60_000L;
            if (buildCostCoin <= 400) return 4 * 60_000L;
            if (buildCostCoin <= 1000) return 10 * 60_000L;
            if (buildCostCoin <= 2500) return 20 * 60_000L;
            if (buildCostCoin <= 6250) return 40 * 60_000L;
            return 90 * 60_000L; // capped
        }

        public const long MergeDurationMs = 2L * 60L * 60_000L;
    }
}
