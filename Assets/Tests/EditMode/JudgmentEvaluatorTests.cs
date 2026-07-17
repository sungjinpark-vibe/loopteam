using NUnit.Framework;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests
{
    /// <summary>GDD §4.3/§12: perfect ±0.15s, good ±0.35s, both must be config-driven.</summary>
    public class JudgmentEvaluatorTests
    {
        private const float PerfectWindow = 0.15f;
        private const float GoodWindow = 0.35f;

        [Test]
        public void WithinPerfectWindow_ReturnsPerfect()
        {
            var result = JudgmentEvaluator.Evaluate(10.10f, 10f, PerfectWindow, GoodWindow);
            Assert.AreEqual(ParryJudgment.Perfect, result);
        }

        [Test]
        public void ExactlyAtPerfectBoundary_IsInclusivePerfect()
        {
            var result = JudgmentEvaluator.Evaluate(10.15f, 10f, PerfectWindow, GoodWindow);
            Assert.AreEqual(ParryJudgment.Perfect, result);
        }

        [Test]
        public void OutsidePerfectButWithinGood_ReturnsGood()
        {
            var result = JudgmentEvaluator.Evaluate(10.25f, 10f, PerfectWindow, GoodWindow);
            Assert.AreEqual(ParryJudgment.Good, result);
        }

        [Test]
        public void EarlyTapWithinGood_AlsoReturnsGood()
        {
            var result = JudgmentEvaluator.Evaluate(9.75f, 10f, PerfectWindow, GoodWindow);
            Assert.AreEqual(ParryJudgment.Good, result);
        }

        [Test]
        public void OutsideGoodWindow_ReturnsMiss()
        {
            var result = JudgmentEvaluator.Evaluate(10.5f, 10f, PerfectWindow, GoodWindow);
            Assert.AreEqual(ParryJudgment.Miss, result);
        }

        // Demonstrates the acceptance criterion "perfect/good windows are read from
        // config, not code": the same raw tap classifies differently purely because the
        // window arguments (which always come from GameplayConfig at call sites) changed.
        [Test]
        public void ChangingWindowArguments_ChangesClassificationForTheSameTap()
        {
            const float tapTime = 10.20f;
            const float targetTime = 10f;

            var withDefaultGoodWindow = JudgmentEvaluator.Evaluate(tapTime, targetTime, PerfectWindow, 0.35f);
            var withNarrowedGoodWindow = JudgmentEvaluator.Evaluate(tapTime, targetTime, PerfectWindow, 0.10f);

            Assert.AreEqual(ParryJudgment.Good, withDefaultGoodWindow);
            Assert.AreEqual(ParryJudgment.Miss, withNarrowedGoodWindow);
        }
    }
}
