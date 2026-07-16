namespace LifeTown.Economy.Core.Models
{
    /// <summary>
    /// Append-only event log entry - THE source of truth (spec §9). Wallet, BuildingInstance
    /// and DailyStat are all derived projections that must be rebuildable from a sequence
    /// of these. Produced by <see cref="Settlement"/>; app code should never hand-construct
    /// one outside of tests.
    /// </summary>
    public class SessionRecord
    {
        public string sessionId;            // GUID, created at session start, immutable -> future idempotency key
        public string categoryId;           // FK -> CategoryDef.id
        public long startWallMs;            // Unix ms. DISPLAY/day-bucketing only - never for duration
        public long endWallMs;              // Unix ms. display only
        public long bootTimeMs;             // wallMs - elapsedMs at start (I6 reboot detection, §7.3.2)
        public long monotonicElapsedMs;     // elapsedRealtime delta - THE time source (I1)
        public long lastConfirmedAtMs;      // monotonic offset (from session start) of last presence confirm (I2)
        public int rawSeconds;              // what the clock said
        public int creditedSeconds;         // what was paid (after I2/I3/I4/I5/I6)
        public int expAwarded;
        public int coinAwarded;
        public string appliedToBuildingId;  // null = coin only, no EXP target
        public string[] adjustments;        // e.g. ["presence_timeout","daily_cap_total","clock_untrusted"] (I7)
        public int presenceConfirmCount;
        public bool wasRecovered;           // committed via crash/reboot recovery
    }
}
