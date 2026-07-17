namespace TouchRPG.Combat.Pattern
{
    /// <summary>Mirrors the GDD §7.2 pattern sheet's qualitative "실패 시" column
    /// (e.g. "소피해", "중피해"). The GDD never gives numeric damage for these — the
    /// actual numbers live in TouchRPG.Combat.Config.P0DemoNumbers, explicitly flagged
    /// there as provisional/not-in-GDD.</summary>
    public enum FailureSeverity
    {
        None,
        Small,
        Medium,
        Counter
    }
}
