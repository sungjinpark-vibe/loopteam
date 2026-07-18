using UnityEngine;

namespace TouchRPG.Combat.Config
{
    /// <summary>
    /// Externalized gameplay constants. GDD §0 (MUST): every numeric constant used by
    /// gameplay logic must live here (or another ScriptableObject), never hardcoded in
    /// C# logic. Values below mirror GDD §12's constants appendix 1:1 by name/source.
    ///
    /// TWO fields are explicitly and deliberately provisional (GDD §13, TBD-1/TBD-2):
    /// the director has NOT decided them yet and will after the P0 playtest. They are
    /// kept here, clearly labeled, so the *mechanism* (combo cap clamp, damage curve
    /// lookup) is fully wired without pretending a design decision has been made.
    /// Do not remove the "_TBD1"/"_TBD2" suffixes or the warnings below — they are the
    /// visible flag that stops this from silently becoming a hallucinated decision.
    /// </summary>
    [CreateAssetMenu(fileName = "GameplayConfig", menuName = "TouchRPG/Combat/Gameplay Config")]
    public class GameplayConfig : ScriptableObject
    {
        [Header("Judgment windows — GDD §4.3 / §12 (canonical values, do not hardcode elsewhere)")]
        [Tooltip("parry.perfect.window — GDD §12: ±0.15s")]
        public float perfectWindowSeconds = 0.15f;

        [Tooltip("parry.good.window — GDD §12: ±0.35s")]
        public float goodWindowSeconds = 0.35f;

        [Tooltip("relay.party.window (per person) — GDD §12: ±0.5s. Reserved for the real " +
                 "party relay (P1 scope has no networking - see MonsterPatternPlayer.ExecuteC3Relay, " +
                 "which uses relaySoloWindowSeconds below instead for the solo substitute).")]
        public float relayPartyWindowPerPersonSeconds = 0.5f;

        [Tooltip("relay.solo.window — GDD §12: ±0.35s. Consumed by MonsterPatternPlayer.ExecuteC3Relay " +
                 "for Lampang P5's solo substitute sequence (GDD §5.2) - deliberately tighter than " +
                 "the party window per §4.3's P-3 rationale ('파티가 더 쉬워야 한다').")]
        public float relaySoloWindowSeconds = 0.35f;

        [Header("Combo — GDD §4.4 / §12")]
        [Tooltip("combo.reset.on_hit — GDD §12: true")]
        public bool comboResetOnHit = true;

        [Tooltip("combo.cover.mitigation — GDD §12: 50% (floor). Seam for IN-7 cover action; " +
                 "not reachable from P0 solo content, but the math is implemented and tested.")]
        [Range(0f, 1f)]
        public float coverMitigationFraction = 0.5f;

        [Header("[TBD-1] Combo stage cap — GDD §4.4 + §13. NOT DECIDED.")]
        [Tooltip("GDD §4.4: '퍼펙트 패링 시 +1단계, 상한 [TBD-1]단계.' GDD §13 explicitly assigns " +
                 "this to the director, decided AFTER the P0 playtest. This value is a PLACEHOLDER " +
                 "only so the clamp mechanism has something to clamp to during this vertical slice. " +
                 "MUST NOT be read as a design decision — report it as provisional.")]
        public int comboCapStages_TBD1 = 5;

        [Header("[TBD-2] Damage multiplier curve per combo stage — GDD §4.4 + §13. NOT DECIDED.")]
        [Tooltip("GDD §4.4: '단계당 데미지 배율 곡선 [TBD-2].' Index 0 = stage 0 (no combo). " +
                 "PLACEHOLDER linear curve only, so ComboController.CurrentDamageMultiplier has a " +
                 "value to return. MUST NOT be read as a design decision — report it as provisional.")]
        public float[] damageMultiplierByStage_TBD2 = { 1.0f, 1.1f, 1.2f, 1.3f, 1.4f, 1.5f };

        [Header("Other constants — GDD §12 (canonical)")]
        [Tooltip("groggy.rush.duration — GDD §12: 6s (Lampang P7). Consumed by " +
                 "MonsterPatternPlayer.ExecuteC4Groggy for the IN-6 rush window.")]
        public float groggyRushDurationSeconds = 6f;

        [Tooltip("phase.boundaries (high) — GDD §12: HP 70%")]
        [Range(0f, 100f)]
        public float phaseBoundaryHighPercent = 70f;

        [Tooltip("phase.boundaries (low) — GDD §12: HP 35%")]
        [Range(0f, 100f)]
        public float phaseBoundaryLowPercent = 35f;

        [Tooltip("cover.alert.duration — GDD §12: 3s. Reserved seam (IN-7 party cover action is " +
                 "still out of scope - a separate, later task).")]
        public float coverAlertDurationSeconds = 3f;

        [Tooltip("dodge.zone.p3.window — GDD §12: 1.2s. Consumed by " +
                 "MonsterPatternPlayer.ResolveDodgeWindowSeconds for Lampang P3.")]
        public float dodgeZoneP3WindowSeconds = 1.2f;

        [Tooltip("cast.p6.window — GDD §12: 2.0s. Consumed by " +
                 "MonsterPatternPlayer.ResolveDodgeWindowSeconds for Lampang P6.")]
        public float castP6WindowSeconds = 2.0f;

        /// <summary>
        /// Damage multiplier for a given combo stage, clamped to the [TBD-2] curve's length.
        /// The curve itself is provisional (see header) — this method is the permanent
        /// mechanism, independent of whatever final numbers the director sets.
        /// </summary>
        public float GetDamageMultiplier(int stage)
        {
            if (damageMultiplierByStage_TBD2 == null || damageMultiplierByStage_TBD2.Length == 0)
            {
                return 1f;
            }
            int clamped = Mathf.Clamp(stage, 0, damageMultiplierByStage_TBD2.Length - 1);
            return damageMultiplierByStage_TBD2[clamped];
        }
    }
}
