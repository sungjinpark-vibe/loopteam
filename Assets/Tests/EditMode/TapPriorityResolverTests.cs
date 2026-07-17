using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Tests
{
    /// <summary>GDD §4.2 (MUST): parry marker &gt; dodge zone &gt; party portrait &gt; monster
    /// part &gt; ground, with no exceptions. Tested against the pure resolver so it does
    /// not depend on a live EventSystem/Canvas.</summary>
    public class TapPriorityResolverTests
    {
        private class FakeTappable : ITappable
        {
            public TapPriority Priority { get; }
            public bool IsTappable { get; set; } = true;
            public FakeTappable(TapPriority priority) => Priority = priority;
            public void OnTapped(Vector2 screenPosition) { }
        }

        [Test]
        public void ParryMarkerBeatsEveryOtherCandidate()
        {
            var candidates = new List<ITappable>
            {
                new FakeTappable(TapPriority.Ground),
                new FakeTappable(TapPriority.MonsterPart),
                new FakeTappable(TapPriority.PartyPortrait),
                new FakeTappable(TapPriority.DodgeZone),
                new FakeTappable(TapPriority.ParryMarker),
            };

            var winner = CombatInputController.ResolvePriority(candidates);

            Assert.AreEqual(TapPriority.ParryMarker, winner.Priority);
        }

        [Test]
        public void MonsterPartBeatsGround_WhenNoMarkerPresent()
        {
            var candidates = new List<ITappable>
            {
                new FakeTappable(TapPriority.Ground),
                new FakeTappable(TapPriority.MonsterPart),
            };

            var winner = CombatInputController.ResolvePriority(candidates);

            Assert.AreEqual(TapPriority.MonsterPart, winner.Priority);
        }

        [Test]
        public void GroundWinsWhenItIsTheOnlyCandidate()
        {
            var candidates = new List<ITappable> { new FakeTappable(TapPriority.Ground) };

            var winner = CombatInputController.ResolvePriority(candidates);

            Assert.AreEqual(TapPriority.Ground, winner.Priority);
        }

        [Test]
        public void EmptyCandidateList_ResolvesToNull()
        {
            // IsTappable filtering happens upstream in CombatInputController.ResolveTap
            // before candidates ever reach the pure resolver; an empty list (e.g. every
            // candidate was filtered out) must resolve to "no winner", not throw.
            var winner = CombatInputController.ResolvePriority(new List<ITappable>());

            Assert.IsNull(winner);
        }

        [Test]
        public void FullPriorityChainHoldsForEveryAdjacentPair()
        {
            var order = new[]
            {
                TapPriority.ParryMarker, TapPriority.DodgeZone, TapPriority.PartyPortrait,
                TapPriority.MonsterPart, TapPriority.Ground
            };

            for (int i = 0; i < order.Length - 1; i++)
            {
                var higher = new FakeTappable(order[i]);
                var lower = new FakeTappable(order[i + 1]);

                var winner = CombatInputController.ResolvePriority(new List<ITappable> { lower, higher });

                Assert.AreEqual(order[i], winner.Priority, $"{order[i]} should beat {order[i + 1]}");
            }
        }
    }
}
