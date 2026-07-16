using System.Threading;
using NUnit.Framework;
using LifeTown.Economy.Core;

namespace LifeTown.Economy.Core.Tests
{
    public class ClockTests
    {
        [Test]
        public void FakeClock_Advance_MovesBothElapsedAndWall()
        {
            var clock = new FakeClock { ElapsedMs = 1000, WallMs = 2000 };
            clock.Advance(500);
            Assert.AreEqual(1500, clock.ElapsedMs);
            Assert.AreEqual(2500, clock.WallMs);
        }

        [Test]
        public void FakeClock_CanFastForwardHoursInMicroseconds()
        {
            var clock = new FakeClock();
            var sw = System.Diagnostics.Stopwatch.StartNew();
            clock.Advance(9L * 60 * 60 * 1000); // 9 hours of simulated elapsed time
            sw.Stop();

            Assert.AreEqual(9L * 60 * 60 * 1000, clock.ElapsedMs);
            Assert.Less(sw.ElapsedMilliseconds, 50,
                "advancing simulated hours must take microseconds of real time, not hours - this is the entire point of the seam (spec §7.3.3)");
        }

        [Test]
        public void FakeClock_ElapsedAndWallCanDivergeIndependently_ToSimulateRebootOrClockEdit()
        {
            var clock = new FakeClock { ElapsedMs = 5_000_000, WallMs = 10_000_000 };
            clock.WallMs += 5 * 60 * 60 * 1000; // manual wall-clock edit, ElapsedMs untouched
            Assert.AreEqual(5_000_000, clock.ElapsedMs);
            Assert.AreEqual(10_000_000 + 5 * 60 * 60 * 1000, clock.WallMs);
        }

        [Test]
        public void EditorMonotonicClock_ElapsedIsMonotonic_WallLooksLikeUnixMs()
        {
            IMonotonicClock clock = new EditorMonotonicClock();
            long first = clock.ElapsedMs;
            Thread.Sleep(20);
            long second = clock.ElapsedMs;

            Assert.GreaterOrEqual(second, first, "ElapsedMs must never run backward");
            Assert.Greater(clock.WallMs, 1_700_000_000_000L, "WallMs must be plausible Unix epoch milliseconds (post-2023)");
        }
    }
}
