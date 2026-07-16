using System;
using LifeTown.Economy.Core;

namespace LifeTown.Platform.ClockIntegrity
{
    /// <summary>
    /// Platform-side reboot / wall-clock-tamper DETECTION (spec §7.3.2):
    ///
    /// <code>
    /// At session start:  bootTimeMs = clock.WallMs - clock.ElapsedMs   -> persisted
    /// On resume/commit:  bootNow    = clock.WallMs - clock.ElapsedMs
    ///                     if (Math.Abs(bootNow - bootTimeMs) > 5_000)
    ///                         -> the device rebooted or the wall clock was edited
    ///                         -> elapsed is untrustworthy, flag "clock_untrusted"
    /// </code>
    ///
    /// This class only answers the detection question above - it never computes credited
    /// seconds, EXP, or coin, and it never decides where a session commits from. That is
    /// settlement arithmetic and lives exclusively in
    /// <see cref="Settlement.CommitRecovered"/> (spec §7.4's non-negotiable boundary:
    /// no cap/clamp/curve/settlement math outside <c>LifeTown.Economy.Core</c>), which
    /// independently re-derives the identical drift check from the values it is handed.
    /// This class exists purely to give the App layer a cheap, early answer (e.g. "should I
    /// even attempt a live commit, or go straight to recovery") without touching or
    /// duplicating that authoritative clamp.
    ///
    /// Driven entirely by the injected <see cref="IMonotonicClock"/> seam, so it is fully
    /// EditMode-testable against <c>FakeClock</c> / explicit values with no real Android
    /// device - see spec §7.3.3.
    /// </summary>
    public sealed class RebootTamperGuard
    {
        private readonly IMonotonicClock _clock;
        private readonly long _driftToleranceMs;

        /// <summary>Uses the same 5000ms tolerance as Core's own I6 clamp (single source of truth: <see cref="EconomyConfig.ClockDriftToleranceMs"/>).</summary>
        public RebootTamperGuard(IMonotonicClock clock) : this(clock, EconomyConfig.Default.ClockDriftToleranceMs)
        {
        }

        public RebootTamperGuard(IMonotonicClock clock, long driftToleranceMs)
        {
            _clock = clock ?? throw new ArgumentNullException(nameof(clock));
            _driftToleranceMs = driftToleranceMs;
        }

        /// <summary>
        /// Call at session start. Persist the result (e.g. on
        /// <see cref="LifeTown.Economy.Core.Models.RunningSession.bootTimeMs"/>) so
        /// <see cref="CheckDrift"/> can compare against it later.
        /// </summary>
        public long CaptureBootTimeMs() => _clock.WallMs - _clock.ElapsedMs;

        /// <summary>
        /// Call on resume/commit. <paramref name="bootTimeMsAtStart"/> is the value
        /// previously captured by <see cref="CaptureBootTimeMs"/> at session start, or
        /// <c>null</c> when there is no prior session to compare against (first run ever -
        /// always trusted, since nothing has been observed to drift from).
        /// </summary>
        public RebootDriftResult CheckDrift(long? bootTimeMsAtStart)
        {
            long bootTimeMsNow = CaptureBootTimeMs();

            if (bootTimeMsAtStart == null)
                return new RebootDriftResult(bootTimeMsNow, driftMs: 0, isUntrusted: false);

            long driftMs = Math.Abs(bootTimeMsNow - bootTimeMsAtStart.Value);
            bool isUntrusted = driftMs > _driftToleranceMs;
            return new RebootDriftResult(bootTimeMsNow, driftMs, isUntrusted);
        }
    }
}
