using System;
using System.Collections.Generic;

namespace LifeTown.Economy.Core
{
    /// <summary>
    /// I3 - flat daily caps (spec §5.4 I3): 12h total, 6h/category, excess = 0, no
    /// diminishing integral. "A deliberate ship-first simplification... delivers ~95% of
    /// the protection for ~2% of the code" - the diminishing-returns integral can be
    /// restored later behind this same static interface without touching call sites.
    /// </summary>
    public static class DailyCaps
    {
        /// <summary>What has already been credited today, BEFORE the session being
        /// committed right now. Derived from <see cref="Models.DailyStat"/> by the caller.</summary>
        public readonly struct UsageSoFar
        {
            public readonly int CategoryCreditedSeconds;
            public readonly int TotalCreditedSeconds;

            public UsageSoFar(int categoryCreditedSeconds, int totalCreditedSeconds)
            {
                CategoryCreditedSeconds = categoryCreditedSeconds;
                TotalCreditedSeconds = totalCreditedSeconds;
            }

            public static readonly UsageSoFar Empty = new UsageSoFar(0, 0);
        }

        /// <summary>Clamps <paramref name="creditedSecondsBeforeCaps"/> to whatever headroom
        /// remains today under both caps. Appends the tighter-binding reason to
        /// <paramref name="adjustments"/> when it clips anything (I7).</summary>
        public static int Apply(int creditedSecondsBeforeCaps, UsageSoFar usageSoFar, EconomyConfig config, List<string> adjustments)
        {
            if (config == null) config = EconomyConfig.Default;
            if (creditedSecondsBeforeCaps <= 0) return 0;

            int allowedByCategory = Math.Max(0, config.DailyCategoryCapSeconds - usageSoFar.CategoryCreditedSeconds);
            int allowedByTotal = Math.Max(0, config.DailyTotalCapSeconds - usageSoFar.TotalCreditedSeconds);
            int allowed = Math.Min(allowedByCategory, allowedByTotal);

            int credited = Math.Min(creditedSecondsBeforeCaps, allowed);
            if (credited < creditedSecondsBeforeCaps && adjustments != null)
            {
                adjustments.Add(allowedByCategory <= allowedByTotal
                    ? AdjustmentReason.DailyCapCategory
                    : AdjustmentReason.DailyCapTotal);
            }
            return credited;
        }
    }
}
