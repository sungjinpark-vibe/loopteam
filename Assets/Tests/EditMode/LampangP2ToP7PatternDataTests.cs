using NUnit.Framework;
using UnityEditor;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Tests
{
    /// <summary>
    /// GDD §7.2's standard pattern sheet, rows P2-P7 - each is a DATA asset on the same
    /// MonsterPatternStep structure P1 already used (T001), created by
    /// TouchRPG.EditorTools.SceneBuilder.GetOrCreatePatternSheet. These tests pin each
    /// asset to its GDD row so a hand-edit away from the spec fails loudly, mirroring
    /// MonsterPatternSheetTests.LampangP1_MatchesGddSevenTwoAcornThrowSpec.
    /// </summary>
    public class LampangP2ToP7PatternDataTests
    {
        private const string Dir = "Assets/Data/Patterns/";

        private static MonsterPatternStep Load(string fileName)
        {
            var step = AssetDatabase.LoadAssetAtPath<MonsterPatternStep>(Dir + fileName + ".asset");
            Assert.IsNotNull(step, $"{fileName}.asset must exist under {Dir} - run 'TouchRPG/Build Combat Scene (P0)' first.");
            return step;
        }

        [Test]
        public void P2_TailSwipe_MatchesGddRow()
        {
            var step = Load("Lampang_P2_TailSwipe");
            Assert.AreEqual("P2", step.patternId);
            Assert.AreEqual(PatternClass.C1_Basic, step.classification, "GDD §7.2 P2: 분류 C-1");
            Assert.AreEqual("tail", step.anchorPartId);
            Assert.AreEqual(2, step.minPhase, "GDD §7.2 P2: 등장 페이즈 2~");
            Assert.AreEqual(FailureSeverity.Medium, step.failureSeverity, "GDD §7.2 P2: 실패 시 중피해");
            Assert.IsFalse(step.isFakeVariant);
            Assert.AreEqual(1, step.parryBeats.Length);
        }

        [Test]
        public void P3_RollingCharge_MatchesGddRow()
        {
            var step = Load("Lampang_P3_RollingCharge");
            Assert.AreEqual(PatternClass.C2_HeavyAttack, step.classification, "GDD §7.2 P3: 분류 C-2");
            Assert.AreEqual(1, step.dodgeZoneCount, "GDD §7.2 P3: 회피 존 1개, 좌우 랜덤");
            Assert.AreEqual(1, step.minPhase, "GDD §7.2 P3: 등장 페이즈 1~");
            Assert.AreEqual(FailureSeverity.Medium, step.failureSeverity, "GDD §7.2 P3: 실패 시 중피해+넉백");
        }

        [Test]
        public void P4_CheekFake_MatchesGddRow()
        {
            var step = Load("Lampang_P4_CheekFake");
            Assert.AreEqual(PatternClass.C1_Basic, step.classification, "GDD §7.2 P4: 분류 C-1 변형");
            Assert.IsTrue(step.isFakeVariant, "P4 MUST be flagged as the fake-aware execution path.");
            Assert.AreEqual("cheek_pouch", step.anchorPartId);
            Assert.AreEqual(3, step.minPhase, "GDD §7.2 P4: 등장 페이즈 3");
            Assert.AreEqual(1, step.parryBeats.Length);
        }

        [Test]
        public void P5_TailSpin_MatchesGddRow_AndChainsToP7()
        {
            var step = Load("Lampang_P5_TailSpin");
            Assert.AreEqual(PatternClass.C3_Relay, step.classification, "GDD §7.2 P5: 분류 C-3");
            Assert.AreEqual("tail", step.anchorPartId);
            Assert.AreEqual(2, step.minPhase, "GDD §7.2 P5: 등장 페이즈 2~");
            // GDD §5.2 solo substitute: 2-3 tap consecutive sequence, not real relay networking.
            Assert.GreaterOrEqual(step.parryBeats.Length, 2);
            Assert.LessOrEqual(step.parryBeats.Length, 3);
            Assert.IsNotNull(step.triggeredOnSuccess, "GDD §7.2 P7 row ('예고: P5 성공 시') - P5 must chain into a step on success.");
            Assert.AreEqual("P7", step.triggeredOnSuccess.patternId);
        }

        [Test]
        public void P6_AcornRain_MatchesGddRow()
        {
            var step = Load("Lampang_P6_AcornRain");
            Assert.AreEqual(PatternClass.C5_CastAoE, step.classification, "GDD §7.2 P6: 분류 C-5");
            Assert.Greater(step.dodgeZoneCount, 1, "GDD §7.2 P6: '다중 낙하점' - more than one simultaneous zone.");
            Assert.AreEqual(3, step.minPhase, "GDD §7.2 P6: 등장 페이즈 3");
            Assert.AreEqual(FailureSeverity.Small, step.failureSeverity, "GDD §7.2 P6: 실패 시 다단 소피해");
        }

        [Test]
        public void P7_BellyFlipGroggy_MatchesGddRow()
        {
            var step = Load("Lampang_P7_BellyFlipGroggy");
            Assert.AreEqual(PatternClass.C4_Groggy, step.classification, "GDD §7.2 P7: 분류 C-4");
            Assert.AreEqual("belly", step.anchorPartId);
            Assert.AreEqual(2, step.minPhase, "GDD §7.2 P7: 등장 페이즈 2~");
            Assert.Greater(step.rushRequiredTaps, 0);
        }

        [Test]
        public void PatternSheet_ListsAllSevenLampangPatterns()
        {
            var sheet = AssetDatabase.LoadAssetAtPath<MonsterPatternSheet>("Assets/Data/Patterns/Lampang_PatternSheet.asset");
            Assert.IsNotNull(sheet);
            Assert.IsNotNull(sheet.steps);
            Assert.AreEqual(7, sheet.steps.Length, "GDD §7.2's standard pattern sheet lists P1-P7 - all seven must be present as data assets.");

            var ids = new System.Collections.Generic.HashSet<string>();
            foreach (var step in sheet.steps)
            {
                Assert.IsNotNull(step);
                ids.Add(step.patternId);
            }
            foreach (var expected in new[] { "P1", "P2", "P3", "P4", "P5", "P6", "P7" })
            {
                Assert.IsTrue(ids.Contains(expected), $"Pattern sheet must include {expected}.");
            }
        }
    }
}
