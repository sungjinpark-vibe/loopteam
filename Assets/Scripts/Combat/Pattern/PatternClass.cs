namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// GDD §4.5 (MUST): every monster pattern belongs to exactly one of 5 fixed classes.
    /// Adding a 6th needs director approval (GDD §0 - "패턴 분류 체계 변경"). Only
    /// C1_Basic is executed by MonsterPatternPlayer in this task; the others are real
    /// enum members (so pattern data can already declare them) with runtime execution
    /// left as an explicit, logged seam for later tasks.
    /// </summary>
    public enum PatternClass
    {
        C1_Basic,       // 노랑 이중 링, 패링 탭
        C2_HeavyAttack, // 파랑 지면 회피 존, 회피 존 탭
        C3_Relay,       // 빨강 순번 링 + 전용음, 순차 패링
        C4_Groggy,      // 금색 약점 영역, 연타
        C5_CastAoE      // 파랑 다중 + 하늘 연출, 회피 존 -> 지면 탭
    }
}
