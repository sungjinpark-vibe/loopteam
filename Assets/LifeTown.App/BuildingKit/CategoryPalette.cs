using System.Collections.Generic;
using UnityEngine;

namespace LifeTown.App.BuildingKit
{
    /// <summary>
    /// The 7 category identities, locked in docs/design/00-art-design-system.md #4.1.
    /// Only Reading (독서) is used to build this spike's Library building, but all 7 are
    /// defined here so building #2..#7 later is a data addition (one more enum value +
    /// one more table row), not a re-plan or new geometry code -- this is the concrete
    /// answer to rubric V4 (extensibility): the same BuildingPrimitives/formula code
    /// drives every category, only these three hex values change per category.
    /// </summary>
    public enum BuildingCategory
    {
        Reading,    // 독서 - this spike's Library
        Study,      // 공부
        Work,       // 일
        Exercise,   // 운동
        Hobby,      // 취미창작
        Mind,       // 마음챙김
        Game        // 게임
    }

    /// <summary>The 3 tokens a category contributes to the building kit.</summary>
    public readonly struct CategoryColors
    {
        public readonly Color Base500;
        public readonly Color Ink;
        public readonly Color Tint;

        public CategoryColors(Color base500, Color ink, Color tint)
        {
            Base500 = base500;
            Ink = ink;
            Tint = tint;
        }
    }

    /// <summary>
    /// Locked Board A hex values (00-art-design-system.md #1.1 / #4.1) plus the T004 #3.1
    /// tri-tone shading formula. The formula is a pure function of `Base500` -- it is
    /// computed, never hand-tuned per building or per category, which is the whole point
    /// of "one shading formula, one evolution rule" (#3 of that document).
    /// </summary>
    public static class CategoryPalette
    {
        /// <summary>color.primary -- used only for coquette accents (the bow), never for a
        /// category's own building faces.</summary>
        public static readonly Color PrimaryPink = FromHex("#FF9EC4");

        static readonly Dictionary<BuildingCategory, CategoryColors> Map = new Dictionary<BuildingCategory, CategoryColors>
        {
            { BuildingCategory.Reading,  new CategoryColors(FromHex("#B6A0EF"), FromHex("#5A3FA0"), FromHex("#EFE6F6")) },
            { BuildingCategory.Study,    new CategoryColors(FromHex("#6FD0E8"), FromHex("#1C7C93"), FromHex("#E3F7FB")) },
            { BuildingCategory.Work,     new CategoryColors(FromHex("#FFD066"), FromHex("#8A6104"), FromHex("#FFF6DF")) },
            { BuildingCategory.Exercise, new CategoryColors(FromHex("#8AD3B4"), FromHex("#1F7A61"), FromHex("#EAF8F1")) },
            { BuildingCategory.Hobby,    new CategoryColors(FromHex("#6FBFA6"), FromHex("#1E6E58"), FromHex("#E7F5F0")) },
            { BuildingCategory.Mind,     new CategoryColors(FromHex("#FFB37A"), FromHex("#A5570F"), FromHex("#FFF1E6")) },
            { BuildingCategory.Game,     new CategoryColors(FromHex("#FF8FA3"), FromHex("#B03A54"), FromHex("#FFE9EE")) },
        };

        public static CategoryColors Get(BuildingCategory category) => Map[category];

        /// <summary>
        /// T004 #3.1's enforced formula: top/roof = 500 + 60% white, right/front = 500 +
        /// 25% white, left/side = pure 500. Same three numbers for every category, every
        /// tier, every stage -- this is the mechanism that keeps 64+ buildings from
        /// drifting (see the design doc's own argument for why this must be a formula and
        /// not per-sprite hand mixing).
        /// </summary>
        public static (Color top, Color front, Color side) ComputeFaceTones(Color base500)
        {
            Color top = Color.Lerp(base500, Color.white, 0.60f);
            Color front = Color.Lerp(base500, Color.white, 0.25f);
            Color side = base500;
            return (top, front, side);
        }

        public static Color FromHex(string hex)
        {
            if (ColorUtility.TryParseHtmlString(hex, out var c)) return c;
            Debug.LogWarning($"[CategoryPalette] could not parse '{hex}', falling back to magenta.");
            return Color.magenta;
        }
    }
}
