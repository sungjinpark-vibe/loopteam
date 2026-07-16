namespace LifeTown.Platform.ClockIntegrity
{
    /// <summary>
    /// The outcome of one <see cref="RebootTamperGuard.CheckDrift"/> call (spec §7.3.2).
    /// Plain data - no arithmetic beyond what <see cref="RebootTamperGuard"/> already did.
    /// </summary>
    public readonly struct RebootDriftResult
    {
        /// <summary>bootTimeMs = clock.WallMs - clock.ElapsedMs, recomputed at the moment of the check.</summary>
        public long BootTimeMsNow { get; }

        /// <summary>abs(BootTimeMsNow - bootTimeMsAtStart). Zero on the first-ever session (no prior boot time to compare against).</summary>
        public long DriftMs { get; }

        /// <summary>True when DriftMs exceeded the tolerance - the device rebooted or the wall clock was edited (§7.3.2).</summary>
        public bool IsUntrusted { get; }

        /// <summary><see cref="LifeTown.Economy.Core.AdjustmentReason.ClockUntrusted"/> when untrusted, else null - ready to append to a SessionRecord's adjustments (I7).</summary>
        public string AdjustmentReason => IsUntrusted ? LifeTown.Economy.Core.AdjustmentReason.ClockUntrusted : null;

        public RebootDriftResult(long bootTimeMsNow, long driftMs, bool isUntrusted)
        {
            BootTimeMsNow = bootTimeMsNow;
            DriftMs = driftMs;
            IsUntrusted = isUntrusted;
        }
    }
}
