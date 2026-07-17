using NUnit.Framework;
using UnityEditor;
using UnityEngine;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests
{
    /// <summary>
    /// GDD §4.3/§12: perfect ±0.15s, good ±0.35s, both must be config-driven. Loads the
    /// REAL Assets/Data/Config/GameplayConfig.asset via AssetDatabase and evaluates
    /// against its LIVE field values, rather than a locally-duplicated copy of the same
    /// numbers - a second copy of a gameplay constant is exactly the drift GDD §0
    /// forbids, and it is what let an earlier version of this suite report green while
    /// editing the on-disk config changed nothing at all (the suite had its own private
    /// 0.15f/0.35f consts and never touched the asset). EditingGoodWindowOnTheAsset_...
    /// below is the acceptance criterion itself, proven against the shipped asset.
    /// </summary>
    public class JudgmentEvaluatorTests
    {
        private const string ConfigPath = "Assets/Data/Config/GameplayConfig.asset";

        private GameplayConfig _config;
        private float _originalPerfect;
        private float _originalGood;

        [SetUp]
        public void LoadLiveConfig()
        {
            _config = AssetDatabase.LoadAssetAtPath<GameplayConfig>(ConfigPath);
            Assert.IsNotNull(_config,
                $"{ConfigPath} must exist - run 'TouchRPG/Build Combat Scene (P0)' (SceneBuilder) first to create it.");
            _originalPerfect = _config.perfectWindowSeconds;
            _originalGood = _config.goodWindowSeconds;
        }

        [TearDown]
        public void RestoreLiveConfigIfMutated()
        {
            if (_config == null)
            {
                return;
            }
            // Some tests below intentionally mutate the on-disk asset to prove the
            // "edit config -> behavior changes" acceptance criterion. Restore it so a
            // test run never leaves a dirty asset for the next run or another dev.
            if (!Mathf.Approximately(_config.perfectWindowSeconds, _originalPerfect) ||
                !Mathf.Approximately(_config.goodWindowSeconds, _originalGood))
            {
                _config.perfectWindowSeconds = _originalPerfect;
                _config.goodWindowSeconds = _originalGood;
                EditorUtility.SetDirty(_config);
                AssetDatabase.SaveAssets();
            }
        }

        [Test]
        public void ShippedConfigMatchesGddCanonicalWindowNumbers()
        {
            // GDD §12 constants appendix: parry.perfect.window = ±0.15s, parry.good.window
            // = ±0.35s. This pins the SHIPPED asset's numbers to the GDD, as opposed to
            // every other test here which would pass no matter what the asset says.
            Assert.AreEqual(0.15f, _originalPerfect, 0.0001f, "GameplayConfig.asset perfectWindowSeconds must match GDD §12.");
            Assert.AreEqual(0.35f, _originalGood, 0.0001f, "GameplayConfig.asset goodWindowSeconds must match GDD §12.");
        }

        [Test]
        public void WithinPerfectWindow_ReturnsPerfect()
        {
            float tapTime = 10f + _config.perfectWindowSeconds * 0.5f;
            var result = JudgmentEvaluator.Evaluate(tapTime, 10f, _config.perfectWindowSeconds, _config.goodWindowSeconds);
            Assert.AreEqual(ParryJudgment.Perfect, result);
        }

        [Test]
        public void ExactlyAtPerfectBoundary_IsInclusivePerfect()
        {
            float tapTime = 10f + _config.perfectWindowSeconds;
            var result = JudgmentEvaluator.Evaluate(tapTime, 10f, _config.perfectWindowSeconds, _config.goodWindowSeconds);
            Assert.AreEqual(ParryJudgment.Perfect, result);
        }

        [Test]
        public void OutsidePerfectButWithinGood_ReturnsGood()
        {
            float mid = (_config.perfectWindowSeconds + _config.goodWindowSeconds) * 0.5f;
            var result = JudgmentEvaluator.Evaluate(10f + mid, 10f, _config.perfectWindowSeconds, _config.goodWindowSeconds);
            Assert.AreEqual(ParryJudgment.Good, result);
        }

        [Test]
        public void EarlyTapWithinGood_AlsoReturnsGood()
        {
            float mid = (_config.perfectWindowSeconds + _config.goodWindowSeconds) * 0.5f;
            var result = JudgmentEvaluator.Evaluate(10f - mid, 10f, _config.perfectWindowSeconds, _config.goodWindowSeconds);
            Assert.AreEqual(ParryJudgment.Good, result);
        }

        [Test]
        public void OutsideGoodWindow_ReturnsMiss()
        {
            float tapTime = 10f + _config.goodWindowSeconds + 0.15f;
            var result = JudgmentEvaluator.Evaluate(tapTime, 10f, _config.perfectWindowSeconds, _config.goodWindowSeconds);
            Assert.AreEqual(ParryJudgment.Miss, result);
        }

        [Test]
        public void EditingGoodWindowOnTheAsset_ChangesClassificationForTheSameTap()
        {
            // The acceptance criterion itself: "perfect ±0.15s / good ±0.35s are READ
            // FROM CONFIG, not code - editing the config changes behavior (demonstrate)."
            // This mutates the LIVE asset on disk (via AssetDatabase), re-evaluates the
            // exact same tap, and asserts the classification actually flips - then
            // TearDown restores the asset so the repo is left clean.
            const float tapTime = 10.20f;
            const float targetTime = 10f;

            _config.goodWindowSeconds = 0.35f;
            EditorUtility.SetDirty(_config);
            AssetDatabase.SaveAssets();
            var beforeEdit = JudgmentEvaluator.Evaluate(tapTime, targetTime, _config.perfectWindowSeconds, _config.goodWindowSeconds);

            _config.goodWindowSeconds = 0.10f;
            EditorUtility.SetDirty(_config);
            AssetDatabase.SaveAssets();
            var afterEdit = JudgmentEvaluator.Evaluate(tapTime, targetTime, _config.perfectWindowSeconds, _config.goodWindowSeconds);

            Assert.AreEqual(ParryJudgment.Good, beforeEdit, "0.35s good window should classify a 0.20s-late tap as Good.");
            Assert.AreEqual(ParryJudgment.Miss, afterEdit, "0.10s good window should classify the SAME 0.20s-late tap as Miss.");
        }
    }
}
