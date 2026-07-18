using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// IN-6 (GDD §4.1/§4.5): "연타가 보상되는 유일한 구간" - RushZone is the ONE deliberate
    /// exception to this game's mash-guard convention (every other tappable, e.g.
    /// ParryMarker, ignores taps after it resolves). Runs under PlayMode (not EditMode)
    /// because RushZone.Finish()/expiry schedule a delayed Object.Destroy, which is only
    /// legal while the player loop is actually running. Private fields are wired via
    /// reflection (this assembly does not reference UnityEditor - see
    /// TapResolutionPlayModeTests for the same convention).
    /// </summary>
    public class RushZonePlayModeTests
    {
        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"field '{fieldName}' not found on {target.GetType().Name}");
            field.SetValue(target, value);
        }

        private static RushZone CreateZone()
        {
            var go = new GameObject("RushZoneUnderTest", typeof(RectTransform));
            var image = go.AddComponent<Image>();
            var zone = go.AddComponent<RushZone>();
            SetPrivateField(zone, "zoneImage", image);
            return zone;
        }

        [Test]
        public void EveryTapBeforeCompletion_LandsAndAdvancesProgress()
        {
            var zone = CreateZone();
            zone.Initialize(windowSeconds: 6f, requiredTaps: 4);
            int landed = 0;
            zone.OnTapLanded += _ => landed++;

            zone.OnTapped(Vector2.zero);
            zone.OnTapped(Vector2.zero);
            zone.OnTapped(Vector2.zero);

            Assert.AreEqual(3, landed, "Mashing must count every tap while the zone is live - IN-6 is the mash-rewarded exception.");
            Assert.IsFalse(zone.IsFinished, "3 of 4 required taps must not finish the zone yet.");
            Object.Destroy(zone.gameObject);
        }

        [Test]
        public void ReachingRequiredTaps_FiresOnFinishedExactlyOnce()
        {
            var zone = CreateZone();
            zone.Initialize(windowSeconds: 6f, requiredTaps: 3);
            int finishedCount = 0;
            zone.OnFinished += _ => finishedCount++;

            zone.OnTapped(Vector2.zero);
            zone.OnTapped(Vector2.zero);
            zone.OnTapped(Vector2.zero);

            Assert.AreEqual(1, finishedCount, "OnFinished must fire exactly once on completion (finish flourish).");
            Assert.IsTrue(zone.IsFinished);
        }

        [Test]
        public void TapsAfterFinished_DoNotLandOrRefire()
        {
            var zone = CreateZone();
            zone.Initialize(windowSeconds: 6f, requiredTaps: 1);
            int landed = 0;
            int finished = 0;
            zone.OnTapLanded += _ => landed++;
            zone.OnFinished += _ => finished++;

            zone.OnTapped(Vector2.zero); // finishes it
            zone.OnTapped(Vector2.zero); // mash after finish - must be a no-op
            zone.OnTapped(Vector2.zero);

            Assert.AreEqual(1, landed, "No tap should land after the zone has finished.");
            Assert.AreEqual(1, finished, "OnFinished must not re-fire from post-finish taps.");
        }

        [Test]
        public void IsTappable_FalseOnceFinished()
        {
            var zone = CreateZone();
            zone.Initialize(windowSeconds: 6f, requiredTaps: 1);
            Assert.IsTrue(zone.IsTappable);
            zone.OnTapped(Vector2.zero);
            Assert.IsFalse(zone.IsTappable);
        }
    }
}
