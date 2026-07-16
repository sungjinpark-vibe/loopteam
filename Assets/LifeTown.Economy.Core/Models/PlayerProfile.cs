namespace LifeTown.Economy.Core.Models
{
    public class PlayerProfile
    {
        public string playerId;   // local GUID (upgrade seat for a future uid)
        public long firstOpenedAtMs;
        public int daysRecordedCount;    // cumulative, NEVER resets (D4)
        public string lastRecordedDateKey;
        public bool onboardingComplete;
        public bool notificationsEnabled;
        public int notificationHour, notificationMinute;
    }
}
