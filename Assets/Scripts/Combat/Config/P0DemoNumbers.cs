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

        [Tooltip("Lampang P1 failure damage. GDD §7.2 says only the word '소피해' (small), " +
                 "no number.")]
        public int p1FailureDamageSmall = 5;

        [Tooltip("Reserved for future patterns whose failure is GDD-labeled '중피해' (medium). " +
                 "Not consumed by P1; kept here so the severity enum has somewhere real to " +
                 "point once those patterns are built.")]
        public int failureDamageMedium = 15;
    }
}
