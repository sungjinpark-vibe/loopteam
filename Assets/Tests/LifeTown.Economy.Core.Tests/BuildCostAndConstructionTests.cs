using NUnit.Framework;
using LifeTown.Economy.Core;

namespace LifeTown.Economy.Core.Tests
{
    public class BuildCostAndConstructionTests
    {
        [TestCase(1, 100)]
        [TestCase(2, 400)]
        [TestCase(3, 1000)]
        [TestCase(4, 2500)]
        public void FixedBracket_MatchesSpec(int nth, int expectedCoin)
        {
            Assert.AreEqual(expectedCoin, BuildCost.ForNth(nth));
        }

        [Test]
        public void FifthBuild_GrowsByThePointFiveMultiplier()
        {
            Assert.AreEqual((int)System.Math.Round(2500 * 2.5), BuildCost.ForNth(5));
        }

        [Test]
        public void SixthBuild_CompoundsTheMultiplierAgain()
        {
            int fifth = BuildCost.ForNth(5);
            Assert.AreEqual((int)System.Math.Round(fifth * 2.5), BuildCost.ForNth(6));
        }

        [Test]
        public void ForNth_ZeroOrNegative_Throws()
        {
            Assert.Throws<System.ArgumentOutOfRangeException>(() => BuildCost.ForNth(0));
            Assert.Throws<System.ArgumentOutOfRangeException>(() => BuildCost.ForNth(-1));
        }

        [Test]
        public void MergeCost_Is5000()
        {
            Assert.AreEqual(5000, BuildCost.MergeCost());
        }

        [TestCase(100, 1)]
        [TestCase(400, 4)]
        [TestCase(1000, 10)]
        [TestCase(2500, 20)]
        [TestCase(6250, 40)]
        [TestCase(50000, 90)]
        public void ConstructionBracket_MatchesSpec(int buildCost, int expectedMinutes)
        {
            Assert.AreEqual(expectedMinutes * 60_000L, ConstructionDuration.ForBuildCostMs(buildCost));
        }

        [Test]
        public void MergeDuration_IsFixedTwoHours()
        {
            Assert.AreEqual(2 * 60 * 60_000L, ConstructionDuration.MergeDurationMs);
        }
    }
}
