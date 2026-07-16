using NUnit.Framework;
using LifeTown.Economy.Core;
using LifeTown.Economy.Core.Models;

namespace LifeTown.Economy.Core.Tests
{
    /// <summary>
    /// Drives spec §10's QA checklist (Q01-Q08, plus D9 parity) purely through
    /// <see cref="FakeClock"/> and <see cref="Settlement"/> - headless, no device, no
    /// PlayMode. Q09-Q12 need the running app (App/Platform layers) and are out of scope
    /// for this assembly.
    /// </summary>
    public class SettlementTests
    {
        private const long Hour = 60 * 60 * 1000L;
        private const long Min = 60 * 1000L;

        // ── Q01: 9h, never confirmed ─────────────────────────────────────
        [Test]
        public void Q01_NineHoursNeverConfirmed_CreditsOnlyAboutSeventyMinutes()
        {
            var clock = new FakeClock();
            long startElapsed = clock.ElapsedMs;
            long startWall = clock.WallMs;
            clock.Advance(9 * Hour);

            var record = Settlement.CommitLive(
                sessionId: "s1", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: startWall, endWallMs: clock.WallMs,
                startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                lastConfirmedElapsedOffsetMs: 0, // never confirmed past session start
                usageSoFar: DailyCaps.UsageSoFar.Empty);

            Assert.AreEqual(70 * 60, record.creditedSeconds, "70 min = 60 min first ping + 10 min response window");
            Assert.Contains(AdjustmentReason.PresenceTimeout, record.adjustments);
            Assert.Less(record.creditedSeconds, 9 * 3600, "must be nowhere near the raw 9 hours");
        }

        // ── Q02 / Q03: wall-clock tampering must not move the payout ─────
        [Test]
        public void Q02_WallClockMovedForwardMidSession_CreditedUnaffected()
        {
            var withoutShift = CommitFixedLiveSession(wallShiftMs: 0);
            var withForwardShift = CommitFixedLiveSession(wallShiftMs: 5 * Hour);

            Assert.AreEqual(withoutShift.creditedSeconds, withForwardShift.creditedSeconds,
                "ElapsedMs drove it - a wall-clock jump forward must not change the payout");
        }

        [Test]
        public void Q03_WallClockMovedBackwardMidSession_CreditedUnaffected_NoNegativePayout()
        {
            var withoutShift = CommitFixedLiveSession(wallShiftMs: 0);
            var withBackwardShift = CommitFixedLiveSession(wallShiftMs: -5 * Hour);

            Assert.AreEqual(withoutShift.creditedSeconds, withBackwardShift.creditedSeconds);
            Assert.GreaterOrEqual(withBackwardShift.creditedSeconds, 0, "no negative payout, ever");
        }

        private static SessionRecord CommitFixedLiveSession(long wallShiftMs)
        {
            var clock = new FakeClock();
            long startElapsed = clock.ElapsedMs;
            long startWall = clock.WallMs;
            clock.Advance(25 * Min); // the canonical session length
            clock.WallMs += wallShiftMs; // tamper with wall time only - elapsed is untouched

            return Settlement.CommitLive(
                sessionId: "s", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: startWall, endWallMs: clock.WallMs,
                startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                lastConfirmedElapsedOffsetMs: 0,
                usageSoFar: DailyCaps.UsageSoFar.Empty);
        }

        // ── Q04: simulated reboot ─────────────────────────────────────────
        [Test]
        public void Q04_SimulatedReboot_CommitsAtLastConfirmed_FlagsClockUntrusted()
        {
            var clock = new FakeClock();
            long startElapsed = clock.ElapsedMs;
            long startWall = clock.WallMs;
            long bootTimeAtStart = startWall - startElapsed;

            clock.Advance(90 * Min);
            long lastConfirmed = clock.ElapsedMs - startElapsed; // presence confirmed at the 90-min mark

            // Reboot: ElapsedMs resets near 0, WallMs keeps moving forward normally.
            clock.WallMs += 2 * Hour;
            clock.ElapsedMs = 5_000;

            var record = Settlement.CommitRecovered(
                sessionId: "s1", categoryId: "study", appliedToBuildingId: "b1",
                startWallMs: startWall, endWallMs: clock.WallMs,
                startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                bootTimeMsAtStart: bootTimeAtStart,
                lastConfirmedElapsedOffsetMs: lastConfirmed,
                usageSoFar: DailyCaps.UsageSoFar.Empty);

            Assert.Contains(AdjustmentReason.ClockUntrusted, record.adjustments);
            Assert.AreEqual((int)(lastConfirmed / 1000), record.creditedSeconds, "commits at the last confirmed presence (90 min), not at the bogus post-reboot elapsed reading");
            Assert.IsTrue(record.wasRecovered);
        }

        [Test]
        public void CommitRecovered_NoActualDrift_BehavesLikeALiveCommit()
        {
            var clock = new FakeClock();
            long startElapsed = clock.ElapsedMs;
            long startWall = clock.WallMs;
            long bootTimeAtStart = startWall - startElapsed;
            clock.Advance(25 * Min);

            var record = Settlement.CommitRecovered(
                sessionId: "s", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: startWall, endWallMs: clock.WallMs,
                startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                bootTimeMsAtStart: bootTimeAtStart,
                lastConfirmedElapsedOffsetMs: 0,
                usageSoFar: DailyCaps.UsageSoFar.Empty);

            CollectionAssert.DoesNotContain(record.adjustments, AdjustmentReason.ClockUntrusted);
            Assert.AreEqual(25 * 60, record.creditedSeconds);
        }

        // ── Q05 / Q06: I3 flat daily caps, across a realistic sequence of sessions ──
        [Test]
        public void Q05_TwentyHoursOneCategoryAcrossSessions_CumulativeCreditedClampedToSixHourCategoryCap()
        {
            var usage = DailyCaps.UsageSoFar.Empty;
            int totalCredited = 0;
            int totalRaw = 0;

            for (int i = 0; i < 5; i++) // 5 x 4h = 20h raw, all "reading"
            {
                var clock = new FakeClock();
                long startElapsed = clock.ElapsedMs;
                long startWall = clock.WallMs;
                clock.Advance(4 * Hour);

                var record = Settlement.CommitLive(
                    sessionId: "s" + i, categoryId: "reading", appliedToBuildingId: "b1",
                    startWallMs: startWall, endWallMs: clock.WallMs,
                    startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                    lastConfirmedElapsedOffsetMs: clock.ElapsedMs - startElapsed, // fully confirmed - isolates I3 from I2
                    usageSoFar: usage);

                totalCredited += record.creditedSeconds;
                totalRaw += record.rawSeconds;
                usage = new DailyCaps.UsageSoFar(
                    categoryCreditedSeconds: usage.CategoryCreditedSeconds + record.creditedSeconds,
                    totalCreditedSeconds: usage.TotalCreditedSeconds + record.creditedSeconds);
            }

            Assert.AreEqual(20 * 3600, totalRaw, "the mirror still shows the raw total honestly (rawSecondsBeforeCaps)");
            Assert.AreEqual(6 * 3600, totalCredited, "but the economy only ever pays the 6h category cap");
        }

        [Test]
        public void Q06_SixHoursEachAcrossThreeCategories_CumulativeCreditedCappedAtTwelveHourTotal()
        {
            string[] categories = { "reading", "study", "exercise" };
            var usage = DailyCaps.UsageSoFar.Empty;
            int totalCredited = 0;

            foreach (var category in categories) // 3 x 6h = 18h raw, three different categories
            {
                var clock = new FakeClock();
                long startElapsed = clock.ElapsedMs;
                long startWall = clock.WallMs;
                clock.Advance(6 * Hour);

                var record = Settlement.CommitLive(
                    sessionId: "s-" + category, categoryId: category, appliedToBuildingId: "b1",
                    startWallMs: startWall, endWallMs: clock.WallMs,
                    startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                    lastConfirmedElapsedOffsetMs: clock.ElapsedMs - startElapsed,
                    usageSoFar: usage);

                totalCredited += record.creditedSeconds;
                usage = new DailyCaps.UsageSoFar(
                    categoryCreditedSeconds: 0, // each category starts fresh under its own 6h cap - only the TOTAL carries over
                    totalCreditedSeconds: usage.TotalCreditedSeconds + record.creditedSeconds);
            }

            Assert.AreEqual(12 * 3600, totalCredited, "12h total cap binds even though no single category exceeded its own 6h cap");
        }

        // ── Q08: below the minimum session floor ─────────────────────────
        [Test]
        public void Q08_FiftyNineSeconds_RejectedEntirely()
        {
            var clock = new FakeClock();
            long startElapsed = clock.ElapsedMs;
            long startWall = clock.WallMs;
            clock.Advance(59 * 1000L);

            var record = Settlement.CommitLive(
                sessionId: "s", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: startWall, endWallMs: clock.WallMs,
                startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                lastConfirmedElapsedOffsetMs: 0,
                usageSoFar: DailyCaps.UsageSoFar.Empty);

            Assert.AreEqual(0, record.creditedSeconds);
            Assert.AreEqual(0, record.expAwarded);
            Assert.AreEqual(0, record.coinAwarded);
            Assert.IsNull(record.appliedToBuildingId);
            Assert.Contains(AdjustmentReason.MinSessionRejected, record.adjustments);
        }

        [Test]
        public void SixtySecondSession_IsAccepted_BoundaryIsInclusive()
        {
            var clock = new FakeClock();
            long startElapsed = clock.ElapsedMs;
            long startWall = clock.WallMs;
            clock.Advance(60 * 1000L);

            var record = Settlement.CommitLive(
                sessionId: "s", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: startWall, endWallMs: clock.WallMs,
                startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                lastConfirmedElapsedOffsetMs: 0,
                usageSoFar: DailyCaps.UsageSoFar.Empty);

            Assert.AreEqual(60, record.creditedSeconds);
            Assert.AreEqual("b1", record.appliedToBuildingId);
        }

        // ── D9 parity - Q12's Core-testable half ──────────────────────────
        [Test]
        public void D9_GameThreeHours_EqualsReadingThreeHours()
        {
            var gameRecord = CommitConfirmedSession("game", 3 * Hour);
            var readingRecord = CommitConfirmedSession("reading", 3 * Hour);

            Assert.AreEqual(readingRecord.creditedSeconds, gameRecord.creditedSeconds);
            Assert.AreEqual(readingRecord.expAwarded, gameRecord.expAwarded, "D9: leisure pays identically to growth");
            Assert.AreEqual(readingRecord.coinAwarded, gameRecord.coinAwarded);
        }

        private static SessionRecord CommitConfirmedSession(string categoryId, long durationMs)
        {
            var clock = new FakeClock();
            long startElapsed = clock.ElapsedMs;
            long startWall = clock.WallMs;
            clock.Advance(durationMs);

            return Settlement.CommitLive(
                sessionId: "s-" + categoryId, categoryId: categoryId, appliedToBuildingId: "b1",
                startWallMs: startWall, endWallMs: clock.WallMs,
                startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                lastConfirmedElapsedOffsetMs: clock.ElapsedMs - startElapsed, // fully present the whole time
                usageSoFar: DailyCaps.UsageSoFar.Empty);
        }

        // ── Determinism / correctness (C2) ────────────────────────────────
        [Test]
        public void SameInputTwice_ProducesIdenticalOutput()
        {
            var a = CommitConfirmedSession("reading", 25 * Min);
            var b = CommitConfirmedSession("reading", 25 * Min);

            Assert.AreEqual(a.creditedSeconds, b.creditedSeconds);
            Assert.AreEqual(a.expAwarded, b.expAwarded);
            Assert.AreEqual(a.coinAwarded, b.coinAwarded);
            CollectionAssert.AreEqual(a.adjustments, b.adjustments);
        }

        [Test]
        public void ZeroElapsed_ProducesZeroPayout_NoException()
        {
            var record = Settlement.CommitLive(
                sessionId: "s", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: 0, endWallMs: 0, startElapsedMs: 0, endElapsedMs: 0,
                lastConfirmedElapsedOffsetMs: 0, usageSoFar: DailyCaps.UsageSoFar.Empty);

            Assert.AreEqual(0, record.creditedSeconds);
        }

        [Test]
        public void NegativeElapsed_ClampsToZero_NoException()
        {
            // endElapsedMs before startElapsedMs should never happen on a real monotonic
            // clock, but a defensive clamp must hold rather than throw or pay negative.
            var record = Settlement.CommitLive(
                sessionId: "s", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: 0, endWallMs: 0, startElapsedMs: 100_000, endElapsedMs: 0,
                lastConfirmedElapsedOffsetMs: 0, usageSoFar: DailyCaps.UsageSoFar.Empty);

            Assert.AreEqual(0, record.creditedSeconds);
            Assert.GreaterOrEqual(record.rawSeconds, 0);
        }

        [Test]
        public void SingleSessionCeiling_ClampsAnAbsurdlyLongSession()
        {
            var clock = new FakeClock();
            long startElapsed = clock.ElapsedMs;
            long startWall = clock.WallMs;
            clock.Advance(30 * Hour); // far beyond the 12h single-session ceiling

            var record = Settlement.CommitLive(
                sessionId: "s", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: startWall, endWallMs: clock.WallMs,
                startElapsedMs: startElapsed, endElapsedMs: clock.ElapsedMs,
                lastConfirmedElapsedOffsetMs: clock.ElapsedMs - startElapsed, // fully confirmed throughout
                usageSoFar: DailyCaps.UsageSoFar.Empty);

            Assert.LessOrEqual(record.creditedSeconds, 12 * 3600, "I5: single-session ceiling");
        }

        [Test]
        public void NullOrEmptySessionId_Throws()
        {
            Assert.Throws<System.ArgumentException>(() => Settlement.CommitLive(
                sessionId: null, categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: 0, endWallMs: 1000, startElapsedMs: 0, endElapsedMs: 1000,
                lastConfirmedElapsedOffsetMs: 0, usageSoFar: DailyCaps.UsageSoFar.Empty));

            Assert.Throws<System.ArgumentException>(() => Settlement.CommitLive(
                sessionId: "", categoryId: "reading", appliedToBuildingId: "b1",
                startWallMs: 0, endWallMs: 1000, startElapsedMs: 0, endElapsedMs: 1000,
                lastConfirmedElapsedOffsetMs: 0, usageSoFar: DailyCaps.UsageSoFar.Empty));
        }

        [Test]
        public void NullOrEmptyCategoryId_Throws()
        {
            Assert.Throws<System.ArgumentException>(() => Settlement.CommitLive(
                sessionId: "s", categoryId: null, appliedToBuildingId: "b1",
                startWallMs: 0, endWallMs: 1000, startElapsedMs: 0, endElapsedMs: 1000,
                lastConfirmedElapsedOffsetMs: 0, usageSoFar: DailyCaps.UsageSoFar.Empty));
        }
    }
}
