using UnityEngine;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// One row of a monster's standard pattern sheet (GDD §7.2 table format: #, 패턴명,
    /// 분류, 예고, 요구 입력, 윈도우, 실패 시, 리듬 특성, 등장 페이즈). This is data, not
    /// code — every field here is a column from that table, so a new pattern (P2-P7, or
    /// a whole new monster) is authored as a new asset, never a new C# branch. The
    /// "윈도우" column is intentionally NOT duplicated here: GDD §7.2's windows for
    /// C1 patterns match the global perfect/good windows in GameplayConfig 1:1
    /// (e.g. P1 = ±0.35s = parry.good.window), so judgment always reads from that single
    /// source instead of risking two copies of the same constant drifting apart.
    /// </summary>
    [CreateAssetMenu(fileName = "MonsterPatternStep", menuName = "TouchRPG/Combat/Monster Pattern Step")]
    public class MonsterPatternStep : ScriptableObject
    {
        [Header("Identity - GDD §7.2 '#' / '패턴명' / '분류' columns")]
        public string patternId = "P1";
        public string displayName = "도토리 투척";
        public PatternClass classification = PatternClass.C1_Basic;

        [Header("Anchoring - GDD §6.1 MUST: markers anchor to monster parts, not screen")]
        [Tooltip("Matches a TouchRPG.Combat.Core.MonsterPart.PartId (e.g. \"cheek_pouch\").")]
        public string anchorPartId = "cheek_pouch";

        [Header("Required input - GDD §7.2 '요구 입력' column. Consumed only when " +
                 "classification == C1_Basic in this task; other classes are a data seam.")]
        public ParryBeat[] parryBeats = { new ParryBeat(), new ParryBeat { beatOffsetSeconds = 1.3f } };

        [Header("Phase gating - GDD §7.2 '등장 페이즈' column")]
        [Range(1, 3)]
        public int minPhase = 1;

        [Header("Failure - GDD §7.2 '실패 시' column (qualitative in GDD; numeric value " +
                 "lives in P0DemoNumbers, explicitly flagged provisional there)")]
        public FailureSeverity failureSeverity = FailureSeverity.Small;

        [Header("Rhythm note - GDD §7.2 '리듬 특성' column (documentation only)")]
        [TextArea]
        public string rhythmNote = "정박 2연 (학습용)";

        [Header("C-2/C-5 dodge zone (P3/P6) - window seconds is READ FROM GameplayConfig " +
                 "at execution time via dodgeZoneWindowSource below, NOT duplicated on this " +
                 "asset - same reasoning as the C1 windows above.")]
        [Tooltip("Number of simultaneous dodge zones this step spawns. GDD §7.2 P3 = 1 " +
                 "(position randomizes left/right), P6 = multiple '낙하점'. Structural/" +
                 "compositional detail, like parryBeats.Length is for C1 - not a judgment " +
                 "window number.")]
        public int dodgeZoneCount = 1;

        [Tooltip("Which GameplayConfig window this step's dodge zone(s) read their display " +
                 "duration from (GDD §12: dodge.zone.p3.window vs cast.p6.window - two " +
                 "DIFFERENT named constants, not a shared value). This is a per-asset DATA " +
                 "choice, not a code branch: MonsterPatternPlayer.ResolveDodgeWindowSeconds " +
                 "switches on THIS enum, never on patternId/displayName, so a brand new " +
                 "dodge-zone pattern that reuses one of these two windows is authored purely " +
                 "as a new asset - no code edit required (a prior review round flagged a " +
                 "literal 'P3'/'P6' string switch on patternId as breaking exactly that " +
                 "invariant; this field is the fix).")]
        public DodgeZoneWindowSource dodgeZoneWindowSource = DodgeZoneWindowSource.DodgeZoneP3Window;

        [Tooltip("GDD §7.2 P3 row '예고': '지면 붉은 라인' - a brief ground-line telegraph " +
                 "shown just before this step's dodge zone(s) appear. Color tie-break " +
                 "(documented on GroundTelegraphLine): §4.5 fixes C-2's channel as BLUE and " +
                 "states the 4-channel mapping is MUST/고정, so this renders in the Dodge " +
                 "channel rather than introducing red (reserved for C-3/relay) into a C-2 " +
                 "pattern. P6's telegraph is the different '하늘 캐스팅+다중 낙하점' visual, " +
                 "not a ground line, so this defaults false and is only set true on P3.")]
        public bool showGroundTelegraphLine = false;

        [Tooltip("GDD §7.2 P3 실패: '중피해+넉백' - an unanswered dodge zone additionally " +
                 "knocks the player back away from the zone, on top of the usual failure " +
                 "damage. P6 실패 ('다단 소피해') names no knockback, so this defaults false " +
                 "and is only set true on P3.")]
        public bool knockbackOnDodgeFailure = false;

        [Header("C-1 fake variant - GDD §7.2 P4 ('C-1 변형')")]
        [Tooltip("GDD §7.2 P4: '볼주머니 페이크... 진짜만 패링'. When true, MonsterPatternPlayer " +
                 "runs the fake-aware execution path instead of the plain C1_Basic path: each " +
                 "execution randomly resolves REAL (behaves exactly like an ordinary beat) or " +
                 "FAKE (the marker dissolves grey just before it would resolve, and any tap " +
                 "before that dissolve is a counter-hit - GDD: '가짜 조기 탭 시 카운터 피격'). " +
                 "The real/fake tell MUST live only in monster animation (see " +
                 "LampangCheekTellAnimator), never on the marker.")]
        public bool isFakeVariant = false;

        [Header("C-4 groggy rush (P7) - duration is READ FROM GameplayConfig.groggyRushDurationSeconds")]
        [Tooltip("Taps required to fill the rush gauge and trigger the finish flourish. " +
                 "PROVISIONAL staging value - GDD names no number for this, only that it is " +
                 "'the only mash-rewarded window' (besides IN-6 itself, which this IS).")]
        public int rushRequiredTaps = 8;

        [Header("C-3 relay chain (P5 -> P7)")]
        [Tooltip("GDD §7.2 P7 row: '예고: P5 성공 시'. The step a successful C3_Relay " +
                 "resolution on THIS step triggers next. Null for every pattern except the " +
                 "relay that gates a groggy step - data-driven, so MonsterPatternPlayer never " +
                 "hardcodes a specific pattern id for the P5->P7 chain.")]
        public MonsterPatternStep triggeredOnSuccess;
    }
}
