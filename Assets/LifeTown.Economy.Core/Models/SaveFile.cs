using System.Collections.Generic;

namespace LifeTown.Economy.Core.Models
{
    /// <summary>
    /// One JSON save file (spec §9), atomic write (temp -> move) on the App/Platform side.
    /// No SQLite, no DB, no ORM. `sessions` is the append-only source of truth; everything
    /// else here is a derived projection kept in sync as sessions commit.
    /// </summary>
    public class SaveFile
    {
        public int schemaVersion = 1;
        public PlayerProfile profile;
        public Wallet wallet;
        public TownState town;
        public List<SessionRecord> sessions = new List<SessionRecord>(); // append-only
        public List<DailyStat> dailyStats = new List<DailyStat>();
        public RunningSession running; // null when idle
    }
}
