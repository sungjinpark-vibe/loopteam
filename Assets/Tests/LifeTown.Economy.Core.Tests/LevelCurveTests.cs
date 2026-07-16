using NUnit.Framework;
using LifeTown.Economy.Core;
using LifeTown.Economy.Core.Models;

namespace LifeTown.Economy.Core.Tests
{
    public class LevelCurveTests
    {
        [Test]
        public void Tier1Curve_MatchesD5_NotThe0711Curve()
        {
            // D5 (01-decisions-resolved.md): [0,60,240,720,2000], NOT [0,30,120,360,1000].
            CollectionAssert.AreEqual(new[] { 0, 60, 240, 720, 2000 }, LevelCurve.Tier1CumulativeExp);
        }

        [Test]
        public void OneCanonicalSession_TakesNewBuildingToLevel4_NotMaxLevel5()
        {
            // Q07 (spec §10): a 25-min session = 1,500 EXP at 1 exp/sec.
            var building = new BuildingInstance { tier = 1, level = 1, accumulatedExp = 0 };

            LevelCurve.ApplyExp(building, 1500);

            Assert.AreEqual(4, building.level,
                "D5's whole point: one session must NOT max a Tier1 building - that would permanently kill the EXP axis (spec §4.1).");
            Assert.Less(building.level, LevelCurve.Tier1MaxLevel, "headroom must remain after a single session");
        }

        [Test]
        public void ExpAtExactCurveBoundary_ReachesThatLevel()
        {
            var building = new BuildingInstance { tier = 1, level = 1, accumulatedExp = 0 };
            LevelCurve.ApplyExp(building, 2000);
            Assert.AreEqual(LevelCurve.Tier1MaxLevel, building.level);
        }

        [Test]
        public void ExpJustBelowBoundary_StaysAtLowerLevel()
        {
            var building = new BuildingInstance { tier = 1, level = 1, accumulatedExp = 0 };
            LevelCurve.ApplyExp(building, 1999);
            Assert.AreEqual(4, building.level);
        }

        [Test]
        public void ExpNeverExceedsTierCap_EvenWithAMassiveAward()
        {
            var building = new BuildingInstance { tier = 1, level = 1, accumulatedExp = 0 };
            LevelCurve.ApplyExp(building, 999_999);
            Assert.AreEqual(LevelCurve.MaxAccumulatedExp(1), building.accumulatedExp);
            Assert.AreEqual(LevelCurve.Tier1MaxLevel, building.level);
        }

        [Test]
        public void ApplyExp_NullBuilding_Throws()
        {
            Assert.Throws<System.ArgumentNullException>(() => LevelCurve.ApplyExp(null, 100));
        }

        [Test]
        public void ApplyExp_ZeroOrNegative_IsANoOp()
        {
            var building = new BuildingInstance { tier = 1, level = 1, accumulatedExp = 100 };
            LevelCurve.ApplyExp(building, 0);
            LevelCurve.ApplyExp(building, -50);
            Assert.AreEqual(100, building.accumulatedExp);
        }

        [Test]
        public void Tier2MaxLevel_IsTen()
        {
            var building = new BuildingInstance { tier = 2, level = 1, accumulatedExp = 0 };
            LevelCurve.ApplyExp(building, 999_999);
            Assert.AreEqual(10, building.level);
        }
    }
}
