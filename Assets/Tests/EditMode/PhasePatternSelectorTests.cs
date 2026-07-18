using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Tests
{
    /// <summary>
    /// Covers GDD §5.1's MUST eligibility gates (phase 1 forbids relay/fake/off-beat C-1
    /// variants that appear later, phase 2 unlocks relay, phase 3 unlocks fakes) and the
    /// guaranteed-relay-per-phase mechanism this task adds, entirely without a scene -
    /// PhasePatternSelector is plain C# (see its own remark for why), so this runs in
    /// EditMode with synthetic step assets, same pattern as MonsterPatternSheetTests.
    /// </summary>
    public class PhasePatternSelectorTests
    {
        private static MonsterPatternStep CreateStep(string id, PatternClass cls, int minPhase, bool isFake = false)
        {
            var step = ScriptableObject.CreateInstance<MonsterPatternStep>();
            step.patternId = id;
            step.classification = cls;
            step.minPhase = minPhase;
            step.isFakeVariant = isFake;
            return step;
        }

        private static MonsterPatternStep[] BuildLampangLikeSheet()
        {
            return new[]
            {
                CreateStep("P1", PatternClass.C1_Basic, 1),
                CreateStep("P2", PatternClass.C1_Basic, 2),
                CreateStep("P3", PatternClass.C2_HeavyAttack, 1),
                CreateStep("P4", PatternClass.C1_Basic, 3, isFake: true),
                CreateStep("P5", PatternClass.C3_Relay, 2),
                CreateStep("P6", PatternClass.C5_CastAoE, 3),
                CreateStep("P7", PatternClass.C4_Groggy, 2),
            };
        }

        // ── IsSelectable gates (MUST, GDD §5.1) ─────────────────────────────────────

        [Test]
        public void IsSelectable_Relay_NeverEligiblePhase1_EligibleFromPhase2()
        {
            var relay = CreateStep("P5", PatternClass.C3_Relay, minPhase: 1); // even if authored too permissively
            Assert.IsFalse(PhasePatternSelector.IsSelectable(relay, 1), "GDD §5.1 MUST: phase 1 forbids relay outright.");
            Assert.IsTrue(PhasePatternSelector.IsSelectable(relay, 2));
            Assert.IsTrue(PhasePatternSelector.IsSelectable(relay, 3));
        }

        [Test]
        public void IsSelectable_Fake_OnlyEligiblePhase3()
        {
            var fake = CreateStep("P4", PatternClass.C1_Basic, minPhase: 1, isFake: true); // even if authored too permissively
            Assert.IsFalse(PhasePatternSelector.IsSelectable(fake, 1), "GDD §5.1 MUST: fakes forbidden before phase 3.");
            Assert.IsFalse(PhasePatternSelector.IsSelectable(fake, 2), "GDD §5.1 MUST: fakes forbidden before phase 3.");
            Assert.IsTrue(PhasePatternSelector.IsSelectable(fake, 3));
        }

        [Test]
        public void IsSelectable_Groggy_NeverDirectlySelectable()
        {
            var groggy = CreateStep("P7", PatternClass.C4_Groggy, minPhase: 1);
            Assert.IsFalse(PhasePatternSelector.IsSelectable(groggy, 1));
            Assert.IsFalse(PhasePatternSelector.IsSelectable(groggy, 2));
            Assert.IsFalse(PhasePatternSelector.IsSelectable(groggy, 3), "C4_Groggy is only reachable via a successful C3_Relay chain - never picked directly, at any phase.");
        }

        [Test]
        public void IsSelectable_RespectsAssetMinPhase_OnTopOfClassGates()
        {
            var onBeat = CreateStep("P1", PatternClass.C1_Basic, minPhase: 2);
            Assert.IsFalse(PhasePatternSelector.IsSelectable(onBeat, 1), "Per-asset minPhase must still gate, even for a class with no other restriction.");
            Assert.IsTrue(PhasePatternSelector.IsSelectable(onBeat, 2));
        }

        // ── Phase 1 composition (MUST): never relay/fake/off-beat P2 ────────────────

        [Test]
        public void Phase1_NeverPicksRelayFakeOrOffBeatP2_OverManyDraws()
        {
            var sheet = BuildLampangLikeSheet();
            var selector = new PhasePatternSelector();

            for (int i = 0; i < 200; i++)
            {
                var picked = selector.PickNext(1, sheet);
                Assert.IsNotNull(picked);
                Assert.AreNotEqual("P2", picked.patternId, "GDD §5.1 phase 1: off-beat P2 must not appear yet.");
                Assert.AreNotEqual(PatternClass.C3_Relay, picked.classification, "GDD §5.1 phase 1 MUST: 릴레이 금지.");
                Assert.AreNotEqual(PatternClass.C4_Groggy, picked.classification);
                Assert.IsFalse(picked.isFakeVariant, "GDD §5.1 phase 1 MUST: 페이크 금지.");
            }
        }

        [Test]
        public void Phase1_OnlyOffersC1AndC2_BothClassesActuallyAppear()
        {
            var sheet = BuildLampangLikeSheet();
            var selector = new PhasePatternSelector();
            var seenIds = new HashSet<string>();

            for (int i = 0; i < 200; i++)
            {
                seenIds.Add(selector.PickNext(1, sheet).patternId);
            }

            Assert.IsTrue(seenIds.Contains("P1"), "GDD §5.1 phase 1: C-1 위주(약 70%) - P1 must appear.");
            Assert.IsTrue(seenIds.Contains("P3"), "GDD §5.1 phase 1: C-2(약 30%) - P3 must appear.");
            Assert.AreEqual(2, seenIds.Count, "Phase 1's eligible pool is exactly {P1, P3} for this synthetic sheet.");
        }

        // ── Guaranteed relay-per-phase (MUST: groggy rush at least once per transition) ──

        [Test]
        public void Phase2_FirstPickOnEnteringPhaseIsForcedRelay()
        {
            var sheet = BuildLampangLikeSheet();
            var selector = new PhasePatternSelector();

            var first = selector.PickNext(2, sheet);
            Assert.AreEqual("P5", first.patternId, "Entering phase 2 must force the relay attempt first - this is the groggy-rush guarantee mechanism.");
        }

        [Test]
        public void Phase2_RelayNeverPickedAgainAfterTheOneGuaranteedAttempt()
        {
            var sheet = BuildLampangLikeSheet();
            var selector = new PhasePatternSelector();

            var first = selector.PickNext(2, sheet);
            Assert.AreEqual(PatternClass.C3_Relay, first.classification);

            for (int i = 0; i < 100; i++)
            {
                var picked = selector.PickNext(2, sheet);
                Assert.AreNotEqual(PatternClass.C3_Relay, picked.classification, "GDD §5.1: phase 2 relay is '1회 한정' - must not recur after the guaranteed attempt.");
                Assert.IsFalse(picked.isFakeVariant, "GDD §5.1 phase 2 MUST: 페이크 still forbidden.");
            }
        }

        [Test]
        public void Phase3_FirstPickOnEnteringPhaseIsForcedRelay()
        {
            var sheet = BuildLampangLikeSheet();
            var selector = new PhasePatternSelector();

            var first = selector.PickNext(3, sheet);
            Assert.AreEqual("P5", first.patternId);
        }

        [Test]
        public void Phase3_RelayRecursViaPityCounter_MultipleOccurrencesOverExtendedPlay()
        {
            var sheet = BuildLampangLikeSheet();
            var selector = new PhasePatternSelector();

            int relayCount = 0;
            const int draws = 60;
            for (int i = 0; i < draws; i++)
            {
                var picked = selector.PickNext(3, sheet);
                if (picked.classification == PatternClass.C3_Relay)
                {
                    relayCount++;
                }
            }

            Assert.GreaterOrEqual(relayCount, 3, "GDD §5.1 phase 3: relay must recur multiple times ('2~3회') across an extended phase, not just the single guaranteed entry pick.");
        }

        [Test]
        public void Phase3_FakeVariantCanAppear_OverManyDraws()
        {
            var sheet = BuildLampangLikeSheet();
            var selector = new PhasePatternSelector();
            bool sawFake = false;

            for (int i = 0; i < 200 && !sawFake; i++)
            {
                sawFake = selector.PickNext(3, sheet).isFakeVariant;
            }

            Assert.IsTrue(sawFake, "GDD §5.1 phase 3: 페이크 해금 - P4 must be reachable through the normal weighted pool.");
        }

        [Test]
        public void ReenteringAPhaseAfterLeaving_ForcesTheGuaranteedRelayAgain()
        {
            var sheet = BuildLampangLikeSheet();
            var selector = new PhasePatternSelector();

            // Spend phase 2's single guaranteed relay.
            var p2First = selector.PickNext(2, sheet);
            Assert.AreEqual(PatternClass.C3_Relay, p2First.classification);

            // Transition to phase 3 - a NEW phase, so its own guarantee must fire fresh,
            // independent of phase 2's cap having already been spent.
            var p3First = selector.PickNext(3, sheet);
            Assert.AreEqual(PatternClass.C3_Relay, p3First.classification, "Phase 3's own guaranteed relay attempt must fire on entry, independent of phase 2's already-spent cap.");
        }

        [Test]
        public void PickNext_ReturnsNull_WhenNoStepsProvided()
        {
            var selector = new PhasePatternSelector();
            Assert.IsNull(selector.PickNext(1, System.Array.Empty<MonsterPatternStep>()));
            Assert.IsNull(selector.PickNext(1, null));
        }
    }
}
