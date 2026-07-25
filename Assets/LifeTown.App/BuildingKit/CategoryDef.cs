using UnityEngine;

namespace LifeTown.App.BuildingKit
{
    /// <summary>Growth vs Leisure, per category (00-mvp-spec.md §9 / §6.4 D9 — leisure is
    /// paid identically to growth; this enum is metadata for the S6 balance report later,
    /// never a multiplier).</summary>
    public enum CategoryType { Growth, Leisure }

    /// <summary>
    /// Data-driven counterpart to <see cref="BuildingCategory"/>/<see cref="CategoryPalette"/>
    /// (00-mvp-spec.md §9's `CategoryDef : ScriptableObject`). `LifeTown.Economy.Core` is
    /// deliberately colour-free (§7.4 — no UnityEngine reference); this is where the 7
    /// category hex values from docs/design/00-art-design-system.md #4.1 become something
    /// the App layer can hand to a session/UI without re-deriving from
    /// <see cref="CategoryPalette"/> everywhere. `id` doubles as the FK every
    /// `SessionRecord.categoryId` / `BuildingInstance.categoryId` uses.
    /// </summary>
    public class CategoryDef : ScriptableObject
    {
        public string id;
        public string displayName;
        public BuildingCategory buildingCategory;
        public CategoryType type;
        public Color color;
    }

    /// <summary>
    /// The 7 fixed categories (spec §9's closing paragraph, carried verbatim from
    /// `category_catalog.dart`): reading/study/work/exercise/hobby = Growth,
    /// mind/game = Leisure. Built once from <see cref="CategoryPalette"/> — the single
    /// source of truth for the hex values — rather than duplicating hex strings here,
    /// so a palette correction in one place stays in sync everywhere.
    /// </summary>
    public static class CategoryCatalog
    {
        static CategoryDef[] _all;

        public static CategoryDef[] All => _all ??= BuildAll();

        public static CategoryDef ById(string id)
        {
            foreach (var def in All)
                if (def.id == id) return def;
            return null;
        }

        static CategoryDef[] BuildAll() => new[]
        {
            Make(BuildingCategory.Reading, "Reading", CategoryType.Growth),
            Make(BuildingCategory.Study, "Study", CategoryType.Growth),
            Make(BuildingCategory.Work, "Work", CategoryType.Growth),
            Make(BuildingCategory.Exercise, "Exercise", CategoryType.Growth),
            Make(BuildingCategory.Hobby, "Hobby", CategoryType.Growth), // [assumption] per spec §9 — Hobby's Growth assignment is marked unconfirmed in the source
            Make(BuildingCategory.Mind, "Mind", CategoryType.Leisure),
            Make(BuildingCategory.Game, "Game", CategoryType.Leisure),
        };

        static CategoryDef Make(BuildingCategory category, string displayName, CategoryType type)
        {
            var def = ScriptableObject.CreateInstance<CategoryDef>();
            def.id = category.ToString().ToLowerInvariant(); // matches spec §9 ids: "reading","study","work","exercise","hobby","mind","game"
            def.displayName = displayName;
            def.buildingCategory = category;
            def.type = type;
            def.color = CategoryPalette.Get(category).Base500;
            return def;
        }
    }
}
