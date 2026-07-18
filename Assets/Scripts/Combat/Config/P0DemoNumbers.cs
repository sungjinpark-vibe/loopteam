using UnityEngine;

namespace TouchRPG.Combat.Config
{
    /// <summary>
    /// Every field on this asset is a number that does NOT appear anywhere in
    /// docs/spec/00-gdd-v0.1.md — not in §12's constants appendix, not qualitatively
    /// beyond words like "소피해" (small damage). GDD §0 requires querying the planner
    /// for any gameplay-impacting number (damage, HP, drop rates) that isn't specified,
    /// rather than inventing it.
    ///
    /// This asset exists because the vertical slice needs *some* concrete number to
    /// render an HP bar and show a hit landing, and this task runs without a synchronous
    /// channel to ask mid-implementation. Every value here is therefore an explicit,
    /// reported placeholder — not a design decision — kept in its own asset (separate
    /// from GameplayConfig's GDD-sourced constants) specifically so it cannot be
    /// mistaken for one. See docs/qa/P0-provisional-gameplay-numbers-REPORT.md for the
    /// full list, the rationale for each value, and the open question to the planner —
    /// that file is the actual query GDD §0 requires, not just this comment.
    /// </summary>
    [CreateAssetMenu(fileName = "P0DemoNumbers", menuName = "TouchRPG/Combat/P0 Demo Numbers (PROVISIONAL - NOT IN GDD)")]
    public class P0DemoNumbers : ScriptableObject
    {
        [Header("NOT SPECIFIED IN GDD — PLACEHOLDER PENDING DIRECTOR CONFIRMATION")]
        [Header("Full rationale + open questions: docs/qa/P0-provisional-gameplay-numbers-REPORT.md")]

        [Tooltip("No monster HP total exists anywhere in the GDD. Placeholder only.")]
        public int monsterMaxHP = 1000;

        [Tooltip("No player HP total exists anywhere in the GDD. Placeholder only.")]
        public int playerMaxHP = 100;

        [Tooltip("IN-1 basic attack damage. GDD §4.1 only says '부위별 판정 존재', no number.")]
        public int basicAttackDamage = 5;

        [Tooltip("'소피해' (small) failure damage. GDD §7.2 uses this exact word for P1 " +
                 "(도토리 투척), P6 (도토리 비, '다단 소피해'), and P5's mitigated relay failure " +
                 "('전원 소피해') - reused across all three per the GDD's own qualitative label " +
                 "rather than inventing a second number for the same word. Renamed from " +
                 "'p1FailureDamageSmall' (T001) once P6/P5 needed the same value - see " +
                 "docs/qa/P0-provisional-gameplay-numbers-REPORT.md.")]
        public int failureDamageSmall = 5;

        [Tooltip("'중피해' (medium) failure damage. GDD §7.2 uses this word for P2 (꼬리치기) " +
                 "and P3 (구르기 돌진). Also reused for P4's '가짜 조기 탭 시 카운터 피격' " +
                 "(FailureSeverity.Counter) - the GDD names no separate counter-hit number, and " +
                 "a counter-hit reads as at least as punishing as a medium failure, so this is a " +
                 "reuse decision, not a new invented value - see the report above.")]
        public int failureDamageMedium = 15;

        [Header("NEW in this task - IN-5 차지 공격 (not in GDD; no equivalence to reuse)")]
        [Tooltip("IN-5 charge-attack damage on release. GDD §4.1 only says '차지 공격. 차지 중 " +
                 "패링 불가 (고딜·고리스크)' - no number, and unlike the failure-damage fields " +
                 "above there is no GDD-implied equivalence to an existing value (a charged hit " +
                 "is a NEW mechanic, not a re-description of an existing one), so this is a " +
                 "genuinely new placeholder, reported as a fresh ask.")]
        public int chargeAttackDamage = 25;
    }
}
