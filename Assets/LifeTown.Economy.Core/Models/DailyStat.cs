using System.Collections.Generic;

namespace LifeTown.Economy.Core.Models
{
    public class DailyStat
    {
        public string dateKey;                // "2026-07-16", device-local day
        public int totalCreditedSeconds;      // vs 12h cap (I3)
        public Dictionary<string, int> perCategoryCreditedSeconds = new Dictionary<string, int>(); // vs 6h cap (I3)
        public int growthSeconds;             // the report's numbers (07 #1)
        public int leisureSeconds;
        public int rawSecondsBeforeCaps;      // report shows RAW; economy pays CREDITED
        public List<long[]> sessionIntervals = new List<long[]>(); // [startWallMs, endWallMs] per session
    }
}
