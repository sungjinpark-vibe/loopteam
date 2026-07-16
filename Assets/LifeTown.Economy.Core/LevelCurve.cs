using System;
using LifeTown.Economy.Core.Models;

namespace LifeTown.Economy.Core
{
    /// <summary>
    /// Building EXP -> level curves (spec §4.2, §9 BuildingInstance.accumulatedExp).
    ///
    /// D5 (01-decisions-resolved.md): Tier1CumulativeExp is [0,60,240,720,2000] - the
    /// director's 2026-07-10 value, NOT the 07-11 value [0,30,120,360,1000]. The 07-11
    /// curve maxes a Tier1 building (Lv5) in a single 25-minute session, which permanently
    /// kills the EXP axis for that building (00-mvp-spec.md §4.1) - every session after the
    /// first pours EXP into an already-capped building. The 07-10 curve leaves headroom:
    /// one session reaches Lv4, not Lv5.
    /// </summary>
    public static class LevelCurve
    {
        /// <summary>Cumulative EXP required to REACH each Tier1 level. Index 0 = level 1.</summary>
        public static readonly int[] Tier1CumulativeExp = { 0, 60, 240, 720, 2000 };

        /// <summary>Cumulative EXP required to REACH each Tier2 level. Index 0 = level 1.</summary>
        public static readonly int[] Tier2CumulativeExp =
            { 0, 600, 1500, 2850, 4875, 7913, 12469, 19303, 29555, 44933 };

        public const int Tier1MaxLevel = 5;
        public const int Tier2MaxLevel = 10;

        public static int MaxAccumulatedExp(int tier) =>
            tier == 1 ? Tier1CumulativeExp[Tier1MaxLevel - 1] : Tier2CumulativeExp[Tier2MaxLevel - 1];

        /// <summary>Pure: derives a level from an accumulated-EXP total. Never mutates anything.</summary>
        public static int LevelForExp(int tier, int accumulatedExp)
        {
            int[] curve = tier == 1 ? Tier1CumulativeExp : Tier2CumulativeExp;
            int maxLevel = tier == 1 ? Tier1MaxLevel : Tier2MaxLevel;
            if (accumulatedExp <= 0) return 1;

            int level = 1;
            for (int i = 1; i < curve.Length; i++)
            {
                if (accumulatedExp >= curve[i]) level = i + 1;
                else break;
            }
            return Math.Min(level, maxLevel);
        }

        /// <summary>
        /// Credits EXP to a building and re-derives its level in place. Clamps
        /// accumulatedExp at the tier's cap - EXP above the cap does not push the level
        /// past its tier max, it simply stops mattering (the session's own expAwarded
        /// ledger entry is unaffected; only the building's own progress is capped).
        /// </summary>
        public static void ApplyExp(BuildingInstance building, int expAmount)
        {
            if (building == null) throw new ArgumentNullException(nameof(building));
            if (expAmount <= 0) return;

            int cap = MaxAccumulatedExp(building.tier);
            building.accumulatedExp = Math.Min(building.accumulatedExp + expAmount, cap);
            building.level = LevelForExp(building.tier, building.accumulatedExp);
        }
    }
}
