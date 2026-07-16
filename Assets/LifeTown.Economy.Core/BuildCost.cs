using System;

namespace LifeTown.Economy.Core
{
    /// <summary>Build and merge coin costs (spec §4.2).</summary>
    public static class BuildCost
    {
        /// <param name="nthBuildOneBased">1-based index of the building about to be placed
        /// (1 = the very first building on the grid).</param>
        public static int ForNth(int nthBuildOneBased, EconomyConfig config = null)
        {
            if (config == null) config = EconomyConfig.Default;
            if (nthBuildOneBased < 1)
                throw new ArgumentOutOfRangeException(nameof(nthBuildOneBased), "build index is 1-based");

            int[] fixedCosts = config.FixedBuildCosts;
            if (nthBuildOneBased <= fixedCosts.Length) return fixedCosts[nthBuildOneBased - 1];

            double cost = fixedCosts[fixedCosts.Length - 1];
            int extraSteps = nthBuildOneBased - fixedCosts.Length;
            for (int i = 0; i < extraSteps; i++) cost *= config.BuildCostGrowthMultiplier;
            return (int)Math.Round(cost);
        }

        public static int MergeCost(EconomyConfig config = null) =>
            (config == null ? EconomyConfig.Default : config).MergeCostCoin;
    }
}
