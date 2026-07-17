using NUnit.Framework;
using UnityEditor;
using UnityEngine;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Tests
{
    /// <summary>Verifies the pattern sheet is genuinely data-driven (GDD §7.2): phase
    /// gating and step content come from the ScriptableObject asset, not a code branch.</summary>
    public class MonsterPatternSheetTests
    {
        private static MonsterPatternStep CreateStep(string id, int minPhase, PatternClass cls = PatternClass.C1_Basic)
        {
            var step = ScriptableObject.CreateInstance<MonsterPatternStep>();
            step.patternId = id;
            step.minPhase = minPhase;
            step.classification = cls;
            return step;
        }

        [Test]
        public void GetStepsForPhase_OnlyReturnsStepsUnlockedAtOrBeforeThatPhase()
        {
            var p1 = CreateStep("P1", minPhase: 1);
            var p5 = CreateStep("P5", minPhase: 2);
            var p6 = CreateStep("P6", minPhase: 3);

            var sheet = ScriptableObject.CreateInstance<MonsterPatternSheet>();
            sheet.steps = new[] { p1, p5, p6 };

            var phase1 = sheet.GetStepsForPhase(1);
            var phase2 = sheet.GetStepsForPhase(2);
            var phase3 = sheet.GetStepsForPhase(3);

            Assert.AreEqual(1, phase1.Length);
            Assert.AreEqual(2, phase2.Length);
            Assert.AreEqual(3, phase3.Length);
        }

        [Test]
        public void LampangP1_MatchesGddSevenTwoAcornThrowSpec()
        {
            // Loads the actual shipped data asset (Assets/Data/Patterns) so this test
            // fails if the asset is ever hand-edited away from the GDD §7.2 spec:
            // classification C-1, parry x2, phase 1+, cheek-pouch anchor, small failure.
            var step = AssetDatabase.LoadAssetAtPath<MonsterPatternStep>("Assets/Data/Patterns/Lampang_P1_AcornThrow.asset");

            Assert.IsNotNull(step, "Lampang P1 data asset must exist under Assets/Data/Patterns");
            Assert.AreEqual(PatternClass.C1_Basic, step.classification);
            Assert.AreEqual("cheek_pouch", step.anchorPartId);
            Assert.AreEqual(2, step.parryBeats.Length, "GDD §7.2 P1: 패링 ×2");
            Assert.AreEqual(1, step.minPhase, "GDD §7.2 P1: 등장 페이즈 1~");
            Assert.AreEqual(FailureSeverity.Small, step.failureSeverity, "GDD §7.2 P1: 실패 시 소피해");
        }
    }
}
