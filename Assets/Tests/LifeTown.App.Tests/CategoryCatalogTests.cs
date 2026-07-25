using NUnit.Framework;
using LifeTown.App.BuildingKit;

namespace LifeTown.App.Tests
{
    /// <summary>
    /// T010: the 7 category hex values live in <see cref="CategoryPalette"/>
    /// (LifeTown.Economy.Core has none — the documented trap this task calls out); this
    /// asserts <see cref="CategoryCatalog"/> is a faithful ScriptableObject wrapper over
    /// that single source of truth, not a second, driftable copy of the hex values.
    /// </summary>
    public class CategoryCatalogTests
    {
        [Test]
        public void All_HasExactlySevenCategories_WithSpecIds()
        {
            var ids = new System.Collections.Generic.List<string>();
            foreach (var def in CategoryCatalog.All) ids.Add(def.id);

            Assert.AreEqual(7, CategoryCatalog.All.Length);
            CollectionAssert.AreEquivalent(
                new[] { "reading", "study", "work", "exercise", "hobby", "mind", "game" }, ids);
        }

        [Test]
        public void All_ColorsMatchCategoryPalette_NoDrift()
        {
            foreach (var def in CategoryCatalog.All)
                Assert.AreEqual(CategoryPalette.Get(def.buildingCategory).Base500, def.color, $"category '{def.id}'");
        }

        [Test]
        public void LeisureCategories_AreExactlyMindAndGame_PerD9()
        {
            var leisure = new System.Collections.Generic.List<string>();
            foreach (var def in CategoryCatalog.All)
                if (def.type == CategoryType.Leisure) leisure.Add(def.id);

            CollectionAssert.AreEquivalent(new[] { "mind", "game" }, leisure);
        }

        [Test]
        public void ById_UnknownId_ReturnsNull()
        {
            Assert.IsNull(CategoryCatalog.ById("does-not-exist"));
        }
    }
}
