namespace LifeTown.Economy.Core
{
    /// <summary>
    /// I7 transparency (spec §5.4, §5.6): the fixed vocabulary of reason codes appended to
    /// <see cref="Models.SessionRecord.adjustments"/>. Every adjustment is itemized
    /// honestly; a session with none of these fired shows zero deduction rows on the
    /// receipt - the honest user never sees the integrity system at all.
    /// </summary>
    public static class AdjustmentReason
    {
        public const string PresenceTimeout = "presence_timeout";
        public const string ClockUntrusted = "clock_untrusted";
        public const string DailyCapCategory = "daily_cap_category";
        public const string DailyCapTotal = "daily_cap_total";
        public const string MinSessionRejected = "min_session_rejected";
    }
}
