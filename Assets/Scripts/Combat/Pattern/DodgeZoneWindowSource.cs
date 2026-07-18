namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// Selects which GameplayConfig dodge-zone display-duration constant a C-2/C-5 step's
    /// zone(s) use (GDD §12: dodge.zone.p3.window = 1.2s vs cast.p6.window = 2.0s - two
    /// genuinely different named numbers, not two copies of the same one). Data-authored
    /// on MonsterPatternStep, consumed by MonsterPatternPlayer.ResolveDodgeWindowSeconds -
    /// deliberately generic member names (not "P3"/"P6") so a brand new dodge-zone pattern
    /// that reuses one of these two GDD windows needs only a new data asset, never a code
    /// edit. A pattern that needs a genuinely NEW window number still needs a new
    /// GameplayConfig field + a new member here, same as FailureSeverity already requires
    /// for a genuinely new severity tier - that is an accepted, existing convention in
    /// this codebase, not the coupling this enum exists to remove.
    /// </summary>
    public enum DodgeZoneWindowSource
    {
        DodgeZoneP3Window,
        CastP6Window
    }
}
