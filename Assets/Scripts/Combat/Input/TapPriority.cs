namespace TouchRPG.Combat.Input
{
    /// <summary>
    /// GDD §4.2 (MUST): when multiple tappable targets overlap the same point, exactly
    /// one wins by this fixed order — parry marker &gt; dodge zone &gt; party portrait &gt;
    /// monster part &gt; ground. Higher enum value = wins. This is the core mis-input
    /// guard; the GDD calls out "no exceptions" explicitly. Do not reorder without
    /// director approval (GDD §0 — input vocabulary/priority changes need sign-off).
    /// </summary>
    public enum TapPriority
    {
        Ground = 0,        // IN-4
        MonsterPart = 1,   // IN-1
        PartyPortrait = 2, // IN-7 (seam only in this task)
        DodgeZone = 3,     // IN-3 (seam only in this task)
        ParryMarker = 4    // IN-2
    }
}
