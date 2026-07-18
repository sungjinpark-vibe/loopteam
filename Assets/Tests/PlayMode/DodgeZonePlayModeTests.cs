using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// IN-3 (GDD §4.1/§6.2): tapping inside a dodge zone triggers an automatic dash out
    /// of it and resolves Success; an unanswered zone resolves Miss once its window
    /// expires. Runs under PlayMode because DodgeZone.Resolve() schedules a delayed
    /// Object.Destroy - only legal while the player loop is running. See
    /// CombatScenePlayModeSmokeTests/GroundTapPlayModeTests for the real end-to-end
    /// raycast + priority-order coverage against the generated CombatScene.
    /// </summary>
    public class DodgeZonePlayModeTests
    {
        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"field '{fieldName}' not found on {target.GetType().Name}");
            field.SetValue(target, value);
        }

        private static (DodgeZone zone, RectTransform battlefield, PlayerToken player) CreateZoneWithPlayer()
        {
            var battlefieldGo = new GameObject("Battlefield", typeof(RectTransform));
            var battlefield = (RectTransform)battlefieldGo.transform;
            battlefield.sizeDelta = new Vector2(1000f, 800f);

            var playerGo = new GameObject("Player", typeof(RectTransform));
            var playerRect = (RectTransform)playerGo.transform;
            playerRect.SetParent(battlefield, false);
            var player = playerGo.AddComponent<PlayerToken>();
            SetPrivateField(player, "battlefieldPanel", battlefield);
            SetPrivateField(player, "self", playerRect);

            var zoneGo = new GameObject("Zone", typeof(RectTransform));
            zoneGo.transform.SetParent(battlefield, false);
            var zoneImage = zoneGo.AddComponent<Image>();
            var zone = zoneGo.AddComponent<DodgeZone>();
            SetPrivateField(zone, "zoneImage", zoneImage);

            return (zone, battlefield, player);
        }

        [Test]
        public void TapInsideZone_ResolvesSuccess()
        {
            var (zone, battlefield, player) = CreateZoneWithPlayer();
            ((RectTransform)zone.transform).anchoredPosition = new Vector2(200f, 0f);
            var playerRect = (RectTransform)player.transform;
            playerRect.anchoredPosition = new Vector2(200f, 0f); // start exactly on the zone

            zone.Initialize(windowSeconds: 1.2f, radiusPixels: 100f, player, battlefield);
            zone.OnTapped(Vector2.zero);

            Assert.AreEqual(DodgeResult.Success, zone.Result);
            Assert.IsTrue(zone.IsResolved);
            Object.Destroy(battlefield.gameObject);
        }

        [Test]
        public void IsTappable_FalseAfterResolution()
        {
            var (zone, battlefield, player) = CreateZoneWithPlayer();
            zone.Initialize(windowSeconds: 1.2f, radiusPixels: 100f, player, battlefield);
            Assert.IsTrue(zone.IsTappable);

            zone.OnTapped(Vector2.zero);

            Assert.IsFalse(zone.IsTappable, "A resolved dodge zone must not remain tappable (no double-resolve on mash).");
            Object.Destroy(battlefield.gameObject);
        }

        [Test]
        public void SecondTapAfterResolution_DoesNotChangeResult()
        {
            var (zone, battlefield, player) = CreateZoneWithPlayer();
            zone.Initialize(windowSeconds: 1.2f, radiusPixels: 100f, player, battlefield);

            zone.OnTapped(Vector2.zero);
            var firstResult = zone.Result;
            zone.OnTapped(Vector2.zero);

            Assert.AreEqual(firstResult, zone.Result, "A mashed second tap on an already-resolved zone must be a no-op.");
            Object.Destroy(battlefield.gameObject);
        }

        [UnityEngine.TestTools.UnityTest]
        public System.Collections.IEnumerator UnansweredZone_ResolvesMissAfterWindowExpires()
        {
            var (zone, battlefield, player) = CreateZoneWithPlayer();
            zone.Initialize(windowSeconds: 0.2f, radiusPixels: 100f, player, battlefield);

            yield return new WaitForSeconds(0.35f);

            Assert.AreEqual(DodgeResult.Miss, zone.Result, "An unanswered dodge zone must auto-resolve Miss once its window closes.");
            Object.Destroy(battlefield.gameObject);
        }
    }
}
