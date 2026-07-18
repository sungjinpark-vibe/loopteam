using NUnit.Framework;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Tests
{
    /// <summary>
    /// GDD §5.1's HP-driven phase table (100~70% / 70~35% / 35~0%), tested against the
    /// pure static function so this needs no scene/HealthController instance - see
    /// HuntPhaseTracker.ComputePhase's own remark.
    /// </summary>
    public class HuntPhaseTrackerTests
    {
        private const float High = 70f;
        private const float Low = 35f;

        [Test]
        public void FullHp_IsPhase1()
        {
            Assert.AreEqual(1, HuntPhaseTracker.ComputePhase(1.0f, High, Low));
        }

        [Test]
        public void JustAboveHighBoundary_IsPhase1()
        {
            Assert.AreEqual(1, HuntPhaseTracker.ComputePhase(0.71f, High, Low));
        }

        [Test]
        public void ExactlyAtHighBoundary_IsPhase2()
        {
            // GDD §5.1 table: phase 1 = 100~70%, phase 2 = 70~35% - 70% itself belongs to
            // the phase-2 band (inclusive lower bound of phase 1's range).
            Assert.AreEqual(2, HuntPhaseTracker.ComputePhase(0.70f, High, Low));
        }

        [Test]
        public void MidPhase2_IsPhase2()
        {
            Assert.AreEqual(2, HuntPhaseTracker.ComputePhase(0.50f, High, Low));
        }

        [Test]
        public void ExactlyAtLowBoundary_IsPhase3()
        {
            Assert.AreEqual(3, HuntPhaseTracker.ComputePhase(0.35f, High, Low));
        }

        [Test]
        public void JustBelowLowBoundary_IsPhase3()
        {
            Assert.AreEqual(3, HuntPhaseTracker.ComputePhase(0.34f, High, Low));
        }

        [Test]
        public void ZeroHp_IsPhase3()
        {
            Assert.AreEqual(3, HuntPhaseTracker.ComputePhase(0f, High, Low));
        }
    }
}
