using NUnit.Framework;
using LifeTown.Economy.Core;
using LifeTown.Platform.ClockIntegrity;

namespace LifeTown.Platform.Tests
{
    /// <summary>
    /// Drives spec §7.3.2 (reboot / wall-clock-tamper detection) entirely through
    /// <see cref="FakeClock"/> and explicit injected values - no real Android device, no
    /// PlayMode, headless in the editor gate (the CRITICAL testability constraint the task
    /// calls out: AndroidJavaClass cannot be exercised in EditMode, so all of the actually
    /// falsifiable logic must live behind IMonotonicClock instead).
    /// </summary>
    public class RebootTamperGuardTests
    {
        private const long Hour = 60 * 60 * 1000L;

        [Test]
        public void NormalSessionNoReboot_ElapsedAndWallAdvanceTogether_Trusted()
        {
            var clock = new FakeClock();
            var guard = new RebootTamperGuard(clock);
            long bootTimeAtStart = guard.CaptureBootTimeMs();

            clock.Advance(2 * Hour); // ordinary passage of time - both clocks move together

            var result = guard.CheckDrift(bootTimeAtStart);

            Assert.IsFalse(result.IsUntrusted);
            Assert.IsNull(result.AdjustmentReason);
            Assert.AreEqual(0, result.DriftMs, "no reboot, no clock edit -> bootTimeMs must not have moved at all");
        }

        [Test]
        public void SimulatedReboot_ElapsedResetsButWallKeepsMoving_Untrusted()
        {
            var clock = new FakeClock { ElapsedMs = 5_000_000, WallMs = 10_000_000 };
            var guard = new RebootTamperGuard(clock);
            long bootTimeAtStart = guard.CaptureBootTimeMs();

            // Reboot: ElapsedMs resets near 0 (SystemClock.elapsedRealtime restarts at
            // boot); WallMs keeps advancing normally as real time passed.
            clock.WallMs += 2 * Hour;
            clock.ElapsedMs = 5_000;

            var result = guard.CheckDrift(bootTimeAtStart);

            Assert.IsTrue(result.IsUntrusted);
            Assert.AreEqual(AdjustmentReason.ClockUntrusted, result.AdjustmentReason);
        }

        [Test]
        public void ManualWallClockEditForward_WithoutReboot_Untrusted()
        {
            var clock = new FakeClock { ElapsedMs = 1_000_000, WallMs = 1_000_000 };
            var guard = new RebootTamperGuard(clock);
            long bootTimeAtStart = guard.CaptureBootTimeMs();

            clock.WallMs += 6 * Hour; // user set the clock forward; elapsed untouched

            var result = guard.CheckDrift(bootTimeAtStart);

            Assert.IsTrue(result.IsUntrusted, "a wall-clock edit with no matching elapsed change must also flag untrusted");
        }

        [Test]
        public void NegativeDrift_WallMovedBackward_StillDetectedViaAbsoluteValue()
        {
            var clock = new FakeClock { ElapsedMs = 1_000_000, WallMs = 10_000_000 };
            var guard = new RebootTamperGuard(clock);
            long bootTimeAtStart = guard.CaptureBootTimeMs();

            clock.WallMs -= 6 * Hour; // user set the clock backward

            var result = guard.CheckDrift(bootTimeAtStart);

            Assert.IsTrue(result.IsUntrusted, "drift must be judged on magnitude - a backward edit is just as untrustworthy as forward");
            Assert.Greater(result.DriftMs, 0);
        }

        [Test]
        public void DriftExactlyAtToleranceBoundary_5000Ms_IsStillTrusted()
        {
            var clock = new FakeClock { ElapsedMs = 0, WallMs = 0 };
            var guard = new RebootTamperGuard(clock, driftToleranceMs: 5_000L);
            long bootTimeAtStart = guard.CaptureBootTimeMs(); // 0

            clock.WallMs = 5_000; // bootTimeMsNow becomes exactly 5000 -> drift == tolerance

            var result = guard.CheckDrift(bootTimeAtStart);

            Assert.AreEqual(5_000L, result.DriftMs);
            Assert.IsFalse(result.IsUntrusted, "the spec's rule is strictly greater-than 5000ms - the boundary itself must still be trusted");
        }

        [Test]
        public void DriftOneMillisecondOverBoundary_IsUntrusted()
        {
            var clock = new FakeClock { ElapsedMs = 0, WallMs = 0 };
            var guard = new RebootTamperGuard(clock, driftToleranceMs: 5_000L);
            long bootTimeAtStart = guard.CaptureBootTimeMs();

            clock.WallMs = 5_001;

            var result = guard.CheckDrift(bootTimeAtStart);

            Assert.IsTrue(result.IsUntrusted);
        }

        [Test]
        public void DriftJustUnderBoundary_4999Ms_IsTrusted()
        {
            var clock = new FakeClock { ElapsedMs = 0, WallMs = 0 };
            var guard = new RebootTamperGuard(clock, driftToleranceMs: 5_000L);
            long bootTimeAtStart = guard.CaptureBootTimeMs();

            clock.WallMs = 4_999;

            var result = guard.CheckDrift(bootTimeAtStart);

            Assert.IsFalse(result.IsUntrusted);
        }

        [Test]
        public void FirstRunEver_NoPriorBootTime_AlwaysTrusted()
        {
            var clock = new FakeClock { ElapsedMs = 123_456, WallMs = 987_654_321 };
            var guard = new RebootTamperGuard(clock);

            var result = guard.CheckDrift(bootTimeMsAtStart: null);

            Assert.IsFalse(result.IsUntrusted, "nothing has been observed to drift from yet - the very first session must never be flagged");
            Assert.IsNull(result.AdjustmentReason);
            Assert.AreEqual(0, result.DriftMs);
        }

        [Test]
        public void DefaultTolerance_MatchesCoreEconomyConfig_SingleSourceOfTruth()
        {
            var clock = new FakeClock();
            var guard = new RebootTamperGuard(clock); // no explicit tolerance
            long bootTimeAtStart = guard.CaptureBootTimeMs();

            clock.WallMs += EconomyConfig.Default.ClockDriftToleranceMs; // exactly at Core's own tolerance
            Assert.IsFalse(guard.CheckDrift(bootTimeAtStart).IsUntrusted);

            clock.WallMs += 1;
            Assert.IsTrue(guard.CheckDrift(bootTimeAtStart).IsUntrusted);
        }

        [Test]
        public void CaptureBootTimeMs_IsWallMinusElapsed()
        {
            var clock = new FakeClock { ElapsedMs = 42_000, WallMs = 1_700_000_000_000L };
            var guard = new RebootTamperGuard(clock);

            Assert.AreEqual(clock.WallMs - clock.ElapsedMs, guard.CaptureBootTimeMs());
        }

        [Test]
        public void NullClock_Throws()
        {
            Assert.Throws<System.ArgumentNullException>(() => new RebootTamperGuard(null));
        }
    }
}
