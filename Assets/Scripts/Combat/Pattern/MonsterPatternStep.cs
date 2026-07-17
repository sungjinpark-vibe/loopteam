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
    }
}
