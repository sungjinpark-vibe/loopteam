using NUnit.Framework;
using LifeTown.Economy.Core;
using LifeTown.Economy.Core.Models;

namespace LifeTown.Economy.Core.Tests
{
    public class MergeRuleTests
    {
        private static BuildingInstance MaxedTier1(string id, string category) =>
            new BuildingInstance { buildingId = id, categoryId = category, tier = 1, level = LevelCurve.Tier1MaxLevel };

        [Test]
        public void TwoMaxedSameCategory_CanMerge()
        {
            var a = MaxedTier1("a", "reading");
            var b = MaxedTier1("b", "reading");
            Assert.IsTrue(MergeRule.CanMerge(a, b));
        }

        [Test]
        public void DifferentCategories_CannotMerge()
        {
            var a = MaxedTier1("a", "reading");
            var b = MaxedTier1("b", "game");
            Assert.IsFalse(MergeRule.CanMerge(a, b));
        }

        [Test]
        public void BelowMaxLevel_CannotMerge()
        {
            var a = MaxedTier1("a", "reading");
            var b = new BuildingInstance { buildingId = "b", categoryId = "reading", tier = 1, level = 4 };
            Assert.IsFalse(MergeRule.CanMerge(a, b));
        }

        [Test]
        public void Tier2Buildings_CannotMergeAgain()
        {
            var a = new BuildingInstance { buildingId = "a", categoryId = "reading", tier = 2, level = 10 };
            var b = new BuildingInstance { buildingId = "b", categoryId = "reading", tier = 2, level = 10 };
            Assert.IsFalse(MergeRule.CanMerge(a, b));
        }

        [Test]
        public void SameBuildingTwice_CannotMergeWithItself()
        {
            var a = MaxedTier1("a", "reading");
            Assert.IsFalse(MergeRule.CanMerge(a, a));
        }

        [Test]
        public void Merge_ProducesTier2LevelOne_WithProvenanceAndConstructionWindow()
        {
            var a = MaxedTier1("a", "reading");
            var b = MaxedTier1("b", "reading");

            var merged = MergeRule.Merge(a, b, "merged-1", 3, 4, 1_000_000L);

            Assert.AreEqual(2, merged.tier);
            Assert.AreEqual(1, merged.level);
            Assert.AreEqual(0, merged.accumulatedExp);
            Assert.AreEqual("reading", merged.categoryId);
            Assert.AreEqual("a", merged.mergedFromA);
            Assert.AreEqual("b", merged.mergedFromB);
            Assert.AreEqual(ConstructionDuration.MergeDurationMs, merged.constructionEndsAtMs - merged.constructionStartedAtMs);
        }

        [Test]
        public void Merge_WhenRulesNotSatisfied_Throws()
        {
            var a = MaxedTier1("a", "reading");
            var b = new BuildingInstance { buildingId = "b", categoryId = "game", tier = 1, level = LevelCurve.Tier1MaxLevel };
            Assert.Throws<System.InvalidOperationException>(() => MergeRule.Merge(a, b, "x", 0, 0, 0));
        }
    }
}
