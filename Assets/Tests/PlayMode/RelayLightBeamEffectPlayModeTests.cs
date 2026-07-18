using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// GDD §5.2 MUST: "성공 연출은 파티원 초상 → 몬스터로 빛이 '이어지는' 흐름." Covers
    /// RelayLightBeamEffect in isolation (positioning/orientation between two arbitrary
    /// anchors, self-destruction) without going through the full P5 relay sequence -
    /// see LampangP4P5P7ScenePlayModeTests for the end-to-end trigger path. Runs under
    /// PlayMode because the effect schedules a delayed Object.Destroy via its own
    /// Update loop, same reasoning as ParryMarker/ParryBurstEffect's PlayMode tests.
    /// </summary>
    public class RelayLightBeamEffectPlayModeTests
    {
        private static RectTransform CreateAnchor(string name, Vector2 worldish)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rect = (RectTransform)go.transform;
            rect.position = worldish;
            return rect;
        }

        [UnityTest]
        public IEnumerator Spawn_PositionsBetweenSourceAndTarget_AndSelfDestructsAfterLifetime()
        {
            var parent = new GameObject("Parent", typeof(RectTransform));
            var source = CreateAnchor("Source", new Vector2(0f, 0f));
            var target = CreateAnchor("Target", new Vector2(200f, 0f));

            var beam = RelayLightBeamEffect.Spawn(parent.transform, source, target, lifetimeSeconds: 0.1f);
            Assert.IsNotNull(beam);

            var rect = (RectTransform)beam.transform;
            Assert.AreEqual(100f, rect.position.x, 0.5f, "Beam must sit at the midpoint between source and target.");
            Assert.AreEqual(200f, rect.sizeDelta.x, 0.5f, "Beam length must equal the source-target distance.");

            yield return new WaitForSeconds(0.3f); // past the 0.1s lifetime
            Assert.IsTrue(beam == null, "RelayLightBeamEffect must self-destruct once its lifetime elapses.");

            Object.Destroy(parent);
            Object.Destroy(source.gameObject);
            Object.Destroy(target.gameObject);
        }

        [Test]
        public void Spawn_WithMissingAnchor_ReturnsNullInsteadOfThrowing()
        {
            var parent = new GameObject("Parent", typeof(RectTransform));
            var source = CreateAnchor("Source", Vector2.zero);

            Assert.IsNull(RelayLightBeamEffect.Spawn(parent.transform, source, null),
                "A missing target anchor must not throw - MonsterPatternPlayer's fields can legitimately be unwired in a stripped-down test fixture.");

            Object.Destroy(parent);
            Object.Destroy(source.gameObject);
        }
    }
}
