namespace LifeTown.Economy.Core.Models
{
    /// <summary>Derived projection (spec §9). Timed-construction fields per §4.3.</summary>
    public class BuildingInstance
    {
        public string buildingId;      // GUID
        public string categoryId;      // FK
        public int tier;               // 1 | 2
        public int level;              // tier1: 1-5, tier2: 1-10
        public int accumulatedExp;     // vs Tier{n}CumulativeExp
        public int gridX, gridY;       // 0..7
        public long createdAtMs;

        // ── Timed construction (§4.3, 14-timed-construction.md) ──
        public long constructionStartedAtMs; // wall ms - a wait the user WANTS to pass; wall clock is correct here
        public long constructionEndsAtMs;    // 0 => already complete
        public bool IsConstructing(long nowWallMs) => constructionEndsAtMs > nowWallMs;

        // ── Provenance ──
        public string mergedFromA, mergedFromB; // null for new builds
    }
}
