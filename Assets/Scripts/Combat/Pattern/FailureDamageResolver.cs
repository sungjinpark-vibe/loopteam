using TouchRPG.Combat.Config;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// Pure lookup: maps GDD §7.2's qualitative "실패 시" severities (소피해/중피해/카운터
    /// 피격) to the concrete placeholder numbers in P0DemoNumbers. Split out of
    /// MonsterPatternPlayer (a team-lead review flagged that ~600-line MonoBehaviour as
    /// mixing coroutine-driving, five execution strategies, dev/QA overrides, AND this
    /// damage math into one class) so the number lookup has no dependency on Unity's
    /// component/coroutine machinery and can be unit tested in isolation.
    /// </summary>
    public static class FailureDamageResolver
    {
        public static int Resolve(FailureSeverity severity, P0DemoNumbers demoNumbers)
        {
            if (demoNumbers == null)
            {
                return 0;
            }
            return severity switch
            {
                FailureSeverity.Small => demoNumbers.failureDamageSmall,
                FailureSeverity.Medium => demoNumbers.failureDamageMedium,
                // GDD §7.2 P4: "가짜 조기 탭 시 카운터 피격" - no separate counter-hit number
                // exists in the GDD, and a counter-hit reads as at least as punishing as a
                // medium failure, so this is a documented reuse decision (see
                // P0DemoNumbers.failureDamageMedium's tooltip), not a new invented value.
                FailureSeverity.Counter => demoNumbers.failureDamageMedium,
                _ => 0
            };
        }
    }
}
