using NUnit.Framework;
using UnityEngine;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests
{
    /// <summary>GDD §4.4: +1 per perfect (capped), good maintains, hit resets to 0,
    /// cover mitigates a reset to floor(stage * mitigation) instead of a hard reset.</summary>
    public class ComboControllerTests
    {
        private static GameplayConfig CreateConfig(int cap = 5, float coverMitigation = 0.5f)
        {
            var config = ScriptableObject.CreateInstance<GameplayConfig>();
            config.comboCapStages_TBD1 = cap;
            config.coverMitigationFraction = coverMitigation;
            config.comboResetOnHit = true;
            return config;
        }

        private static ComboController CreateCombo(GameplayConfig config)
        {
            var go = new GameObject("ComboUnderTest");
            var combo = go.AddComponent<ComboController>();
            combo.Configure(config);
            return combo;
        }

        [Test]
        public void PerfectIncreasesStageByOne()
        {
            var combo = CreateCombo(CreateConfig());
            combo.RegisterPerfect();
            combo.RegisterPerfect();
            Assert.AreEqual(2, combo.Stage);
            Object.DestroyImmediate(combo.gameObject);
        }

        [Test]
        public void GoodMaintainsButDoesNotRaiseStage()
        {
            var combo = CreateCombo(CreateConfig());
            combo.RegisterPerfect();
            combo.RegisterGood();
            Assert.AreEqual(1, combo.Stage);
            Object.DestroyImmediate(combo.gameObject);
        }

        [Test]
        public void HitResetsStageToZero()
        {
            var combo = CreateCombo(CreateConfig());
            combo.RegisterPerfect();
            combo.RegisterPerfect();
            combo.RegisterHit();
            Assert.AreEqual(0, combo.Stage);
            Object.DestroyImmediate(combo.gameObject);
        }

        [Test]
        public void StageIsClampedAtTheConfiguredProvisionalCap()
        {
            var combo = CreateCombo(CreateConfig(cap: 2));
            combo.RegisterPerfect();
            combo.RegisterPerfect();
            combo.RegisterPerfect();
            Assert.AreEqual(2, combo.Stage);
            Object.DestroyImmediate(combo.gameObject);
        }

        [Test]
        public void CoveredHitMitigatesToFlooredHalfInsteadOfFullReset()
        {
            var combo = CreateCombo(CreateConfig(coverMitigation: 0.5f));
            for (int i = 0; i < 5; i++) combo.RegisterPerfect(); // stage = 5
            combo.RegisterCoveredHit();
            Assert.AreEqual(2, combo.Stage); // floor(5 * 0.5) = 2
            Object.DestroyImmediate(combo.gameObject);
        }
    }
}
