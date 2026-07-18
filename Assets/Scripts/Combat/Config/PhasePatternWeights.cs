using UnityEngine;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Config
{
    /// <summary>
    /// One weighted bucket in a phase's composition pool: "pick classification X (optionally
    /// its fake variant) with this relative weight". <see cref="System.Serializable"/> so it
    /// shows up as an editable array element in the Inspector under
    /// <see cref="PhasePatternWeights"/> - was a private struct on PhasePatternSelector
    /// before this task relocated it here (GDD §0 MUST: gameplay constants live in a
    /// ScriptableObject, never hardcoded in logic).
    /// </summary>
    [System.Serializable]
    public struct BucketWeight
    {
        public PatternClass Classification;
        public bool FakeVariant;
        public float Weight;

        public BucketWeight(PatternClass classification, bool fakeVariant, float weight)
        {
            Classification = classification;
            FakeVariant = fakeVariant;
            Weight = weight;
        }
    }

    /// <summary>
    /// GDD §5.1 phase-weighted pattern selection data for <see cref="PhasePatternSelector"/>.
    /// Relocated out of that class (T004 fix) because it was hardcoded const/static readonly
    /// fields on a plain C# class - a MUST violation of GDD §0 / VISION.md's "every gameplay
    /// constant lives in a ScriptableObject, never hardcoded in code" rule.
    ///
    /// Deliberately its own dedicated asset rather than folded into GameplayConfig or
    /// P0DemoNumbers, because it straddles both of those assets' categories and folding it
    /// into either would blur the exact distinction this task needs to preserve:
    /// - <see cref="phase1Weights"/> IS a direct GDD §5.1 number (70/30), like GameplayConfig's
    ///   canonical GDD-sourced fields - it is NOT a placeholder pending director decision.
    /// - <see cref="phase2Weights"/>/<see cref="phase3Weights"/>/<see cref="relayPityIntervalPhase3"/>
    ///   are team-discretion judgment calls (GDD gives no numeric composition for phases 2/3,
    ///   only qualitative notes) - but unlike P0DemoNumbers' fields, these are NOT "asking the
    ///   planner" placeholders; the brief explicitly left the selection algorithm to the team
    ///   (see docs/qa/P0-provisional-gameplay-numbers-REPORT.md Addendum 2), so P0DemoNumbers'
    ///   "NOT SPECIFIED — PLACEHOLDER PENDING DIRECTOR CONFIRMATION" framing does not apply here.
    /// A single dedicated asset lets each field's own tooltip state which of those two
    /// categories it falls into, without borrowing (and diluting) either existing asset's
    /// header framing.
    ///
    /// Values are byte-for-byte identical to the ones this asset replaces - see
    /// docs/qa/P0-provisional-gameplay-numbers-REPORT.md Addendum 2 for the full rationale
    /// per field (unchanged by this relocation, only its "Location" column moved).
    /// </summary>
    [CreateAssetMenu(fileName = "PhasePatternWeights", menuName = "TouchRPG/Combat/Phase Pattern Weights")]
    public class PhasePatternWeights : ScriptableObject
    {
        [Header("Phase 3 relay pity counter — PROVISIONAL (team discretion, GDD §5.1 gives no exact count)")]
        [Tooltip("After this many non-relay picks in phase 3, the pity counter forces another " +
                 "relay attempt so multiple occurrences (GDD §5.1: '2~3회') keep recurring rather " +
                 "than depending purely on the small organic weight in phase3Weights below. " +
                 "Consumed by PhasePatternSelector.PickNext.")]
        public int relayPityIntervalPhase3 = 3;

        [Header("Phase 1 composition — GDD §5.1 verbatim: \"C-1 위주(약 70%) + C-2(약 30%). 릴레이·페이크 금지.\"")]
        [Tooltip("Direct GDD §5.1 numbers, reproduced verbatim (not invented, not provisional). " +
                 "Relay/fake are excluded structurally by PhasePatternSelector.IsSelectable, not " +
                 "by omission from this pool.")]
        public BucketWeight[] phase1Weights =
        {
            new BucketWeight(PatternClass.C1_Basic, false, 70f),
            new BucketWeight(PatternClass.C2_HeavyAttack, false, 30f),
        };

        [Header("Phase 2 composition — PROVISIONAL (team discretion)")]
        [Tooltip("GDD §5.1 phase 2 gives no numeric composition, only '엇박 변형 등장, C-3 릴레이 " +
                 "첫 등장'. The relay itself is NOT weighted here - it is handled entirely by " +
                 "PhasePatternSelector's forced-injection guarantee (exactly one shot, per §5.1's " +
                 "'1회 한정'), so this pool only governs the C-1/C-2 mix.")]
        public BucketWeight[] phase2Weights =
        {
            new BucketWeight(PatternClass.C1_Basic, false, 65f),
            new BucketWeight(PatternClass.C2_HeavyAttack, false, 35f),
        };

        [Header("Phase 3 composition — PROVISIONAL (team discretion)")]
        [Tooltip("GDD §5.1 phase 3 gives no numeric composition, only 'C-3 2~3회 + C-5, 페이크 " +
                 "해금, 패턴 밀도 최대'. Relay keeps a small organic weight on top of its forced " +
                 "entry-pick + pity counter so extra occurrences can also happen 'naturally'; " +
                 "density itself is handled by MonsterPatternPlayer's shorter phase-3 repeat " +
                 "interval, not by this weight table.")]
        public BucketWeight[] phase3Weights =
        {
            new BucketWeight(PatternClass.C1_Basic, false, 40f),
            new BucketWeight(PatternClass.C1_Basic, true, 20f),   // P4 fake variant
            new BucketWeight(PatternClass.C2_HeavyAttack, false, 15f),
            new BucketWeight(PatternClass.C5_CastAoE, false, 15f),
            new BucketWeight(PatternClass.C3_Relay, false, 10f),
        };
    }
}
