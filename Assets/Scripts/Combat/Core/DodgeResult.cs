namespace TouchRPG.Combat.Core
{
    /// <summary>GDD §3/§4.1: IN-3's two outcomes. Not <see cref="ParryJudgment"/> - a
    /// dodge zone has no perfect/good split, only "tapped in time" vs "expired unanswered"
    /// (GDD §4.3: "회피 존 | 존 표시 후 만료까지 탭").</summary>
    public enum DodgeResult
    {
        Success,
        Miss
    }
}
