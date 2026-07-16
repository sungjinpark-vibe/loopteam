using NUnit.Framework;
using LifeTown.Economy.Core;

namespace LifeTown.Economy.Core.Tests
{
    public class PresenceRuleTests
    {
        private static readonly EconomyConfig Config = EconomyConfig.Default;

        [Test]
        public void UnderFirstPingThreshold_NotTimedOut()
        {
            var result = PresenceRule.Evaluate(lastConfirmedElapsedOffsetMs: 0, rawElapsedMs: 69 * 60 * 1000L, Config);
            Assert.IsFalse(result.TimedOut);
            Assert.AreEqual(69 * 60 * 1000L, result.CreditedElapsedMs);
        }

        [Test]
        public void PastFirstPingAndResponseWindow_TimesOutAtSeventyMinutes()
        {
            var result = PresenceRule.Evaluate(lastConfirmedElapsedOffsetMs: 0, rawElapsedMs: 3 * 60 * 60 * 1000L, Config);
            Assert.IsTrue(result.TimedOut);
            Assert.AreEqual(70 * 60 * 1000L, result.CreditedElapsedMs);
        }

        [Test]
        public void AfterAnExplicitConfirm_SubsequentThresholdIsFortyMinutes()
        {
            long confirmedAt = 90 * 60 * 1000L;               // confirmed once, at the 90-minute mark
            long rawElapsed = confirmedAt + 41 * 60 * 1000L;   // then silent for 41 more minutes

            var result = PresenceRule.Evaluate(confirmedAt, rawElapsed, Config);

            Assert.IsTrue(result.TimedOut);
            Assert.AreEqual(confirmedAt + 40 * 60 * 1000L, result.CreditedElapsedMs);
        }

        [Test]
        public void AfterAnExplicitConfirm_WithinFortyMinutes_NotTimedOut()
        {
            long confirmedAt = 90 * 60 * 1000L;
            long rawElapsed = confirmedAt + 39 * 60 * 1000L;

            var result = PresenceRule.Evaluate(confirmedAt, rawElapsed, Config);

            Assert.IsFalse(result.TimedOut);
            Assert.AreEqual(rawElapsed, result.CreditedElapsedMs);
        }

        [Test]
        public void NegativeInputs_ClampToZero_NeverThrows()
        {
            var result = PresenceRule.Evaluate(-100, -100, Config);
            Assert.AreEqual(0, result.CreditedElapsedMs);
            Assert.IsFalse(result.TimedOut);
        }
    }
}
