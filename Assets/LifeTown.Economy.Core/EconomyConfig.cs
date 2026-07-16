namespace LifeTown.Economy.Core
{
    /// <summary>
    /// Every tunable economy constant in one place (spec §4.2, §5.3, §5.4), with the
    /// director's binding decisions baked in as the defaults:
    ///
    ///   D5 (01-decisions-resolved.md): Tier1 EXP curve lives in <see cref="LevelCurve"/>,
    ///       not here - it is [0,60,240,720,2000], NOT the 07-11 [0,30,120,360,1000] value
    ///       that maxes a building in a single session.
    ///
    ///   D9 (01-decisions-resolved.md): leisure reward multiplier = x1.0. There is
    ///       deliberately no leisure-specific field anywhere in this class or in
    ///       <see cref="Settlement"/> - growth and leisure categories run through the exact
    ///       same EXP/coin formula. Structural absence of a branch IS the x1.0, not a
    ///       constant that happens to equal 1.
    /// </summary>
    public sealed class EconomyConfig
    {
        // §4.2 - payout: 1 EXP + 1 coin per credited second, identically for every category.
        public int ExpPerSecond = 1;
        public int CoinPerSecond = 1;

        // I4 - minimum session (misclick guard).
        public int MinSessionSeconds = 60;

        // I5 - clamps: single-session ceiling.
        public int SingleSessionCeilingSeconds = 12 * 60 * 60;

        // I3 - flat daily caps (a deliberate ship-first simplification over a diminishing
        // integral - spec §5.4 I3 - excess above either cap is simply 0, never negative).
        public int DailyTotalCapSeconds = 12 * 60 * 60;
        public int DailyCategoryCapSeconds = 6 * 60 * 60;

        // I2 - Confirmed-Presence Rule (§5.3): first ping at +60min, then every 30min,
        // each with a 10min response window before the session commits at the last confirm.
        public long PresenceFirstPingMs = 60L * 60_000L;
        public long PresenceSubsequentPingMs = 30L * 60_000L;
        public long PresenceResponseWindowMs = 10L * 60_000L;

        // I6 - reboot / wall-clock-edit detection (§7.3.2): drift beyond this tolerance
        // means elapsed is untrustworthy.
        public long ClockDriftToleranceMs = 5_000L;

        // §4.2 - build costs: 100 -> 400 -> 1,000 -> 2,500, then x2.5 per further build.
        public int[] FixedBuildCosts = { 100, 400, 1000, 2500 };
        public double BuildCostGrowthMultiplier = 2.5;
        public int MergeCostCoin = 5000;

        public static readonly EconomyConfig Default = new EconomyConfig();
    }
}
