using System;
using LifeTown.Economy.Core.Models;

namespace LifeTown.Economy.Core
{
    /// <summary>
    /// Merge rules (spec §4.2): two Tier1 Lv5 buildings of the SAME category merge into one
    /// Tier2 Lv1 building for 5,000 coin (see <see cref="BuildCost.MergeCost"/>), capped at
    /// Tier2 max level 10.
    /// </summary>
    public static class MergeRule
    {
        public static bool CanMerge(BuildingInstance a, BuildingInstance b)
        {
            if (a == null || b == null) return false;
            if (ReferenceEquals(a, b) || a.buildingId == b.buildingId) return false;

            return a.tier == 1 && b.tier == 1
                && a.categoryId == b.categoryId
                && a.level >= LevelCurve.Tier1MaxLevel
                && b.level >= LevelCurve.Tier1MaxLevel;
        }

        public static BuildingInstance Merge(BuildingInstance a, BuildingInstance b, string newBuildingId, int gridX, int gridY, long createdAtMs)
        {
            if (!CanMerge(a, b))
                throw new InvalidOperationException("Buildings do not satisfy the merge rule (same category, both Tier1 Lv5 required).");

            return new BuildingInstance
            {
                buildingId = newBuildingId,
                categoryId = a.categoryId,
                tier = 2,
                level = 1,
                accumulatedExp = 0,
                gridX = gridX,
                gridY = gridY,
                createdAtMs = createdAtMs,
                constructionStartedAtMs = createdAtMs,
                constructionEndsAtMs = createdAtMs + ConstructionDuration.MergeDurationMs,
                mergedFromA = a.buildingId,
                mergedFromB = b.buildingId,
            };
        }
    }
}
