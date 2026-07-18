using System.Collections;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.TestTools;
using UnityEngine.UI;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// IN-5 (GDD §4.1 MUST): "차지 중 패링 불가". Builds a minimal live Canvas/EventSystem
    /// (not the full CombatScene) with a real ChargeAttackController and a real
    /// ParryMarker at DIFFERENT screen points, drives BOTH through the actual
    /// CombatInputController.ResolveTap raycast path, and observes: a tap on the marker
    /// WHILE charging never resolves it (mashing the marker mid-hold is a no-op), it then
    /// times out to Miss on its own exactly like an ignored marker would, and releasing
    /// the hold fires the charged attack.
    /// </summary>
    public class ChargeSuppressesParryPlayModeTests
    {
        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"field '{fieldName}' not found on {target.GetType().Name}");
            field.SetValue(target, value);
        }

        [UnityTest]
        public IEnumerator MarkerTappedDuringHold_NeverResolves_ThenAutoMisses_AndReleaseFiresChargedAttack()
        {
            // A prior fixture may have left a CombatScene (or its own Canvas/EventSystem)
            // loaded - clear it so THIS test's raycast is isolated to only the objects it
            // builds below, regardless of test execution order (same defensive pattern as
            // TapResolutionPlayModeTests.DestroyAllMarkers).
            foreach (var existingCanvas in Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None))
            {
                Object.Destroy(existingCanvas.gameObject);
            }
            foreach (var existingEventSystem in Object.FindObjectsByType<EventSystem>(FindObjectsSortMode.None))
            {
                Object.Destroy(existingEventSystem.gameObject);
            }
            yield return null;

            // ── Minimal live UI: Canvas + EventSystem + GraphicRaycaster ──
            var canvasGo = new GameObject("Canvas", typeof(RectTransform), typeof(Canvas), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var eventSystemGo = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            var eventSystem = eventSystemGo.GetComponent<EventSystem>();

            var inputControllerGo = new GameObject("CombatInputController");
            var inputController = inputControllerGo.AddComponent<CombatInputController>();
            SetPrivateField(inputController, "eventSystem", eventSystem);

            // ── ChargeAttackController target (IN-5) at one screen point ──
            var chargeScreenPoint = new Vector2(Screen.width * 0.3f, Screen.height * 0.5f);
            var chargeImg = new GameObject("ChargeTarget", typeof(RectTransform)).AddComponent<Image>();
            chargeImg.transform.SetParent(canvasGo.transform, false);
            chargeImg.raycastTarget = true;
            var chargeRect = chargeImg.rectTransform;
            chargeRect.sizeDelta = new Vector2(200f, 200f);
            chargeRect.position = chargeScreenPoint;
            var charge = chargeImg.gameObject.AddComponent<ChargeAttackController>();

            bool chargedAttackFired = false;
            charge.OnChargedAttackReleased += () => chargedAttackFired = true;

            // ── A real ParryMarker at a DIFFERENT screen point, short good window so the
            // test does not need to wait long for the auto-miss timeout ──
            var markerScreenPoint = new Vector2(Screen.width * 0.7f, Screen.height * 0.5f);
            var markerRoot = new GameObject("Marker", typeof(RectTransform));
            markerRoot.transform.SetParent(canvasGo.transform, false);
            ((RectTransform)markerRoot.transform).position = markerScreenPoint;

            var outer = new GameObject("Outer", typeof(RectTransform)).AddComponent<Image>();
            outer.transform.SetParent(markerRoot.transform, false);
            var inner = new GameObject("Inner", typeof(RectTransform)).AddComponent<Image>();
            inner.transform.SetParent(markerRoot.transform, false);
            var tapArea = new GameObject("TapArea", typeof(RectTransform)).AddComponent<Image>();
            tapArea.transform.SetParent(markerRoot.transform, false);
            tapArea.raycastTarget = true;
            ((RectTransform)tapArea.transform).sizeDelta = new Vector2(220f, 220f);

            var marker = markerRoot.AddComponent<ParryMarker>();
            SetPrivateField(marker, "outerRing", outer.rectTransform);
            SetPrivateField(marker, "innerRing", inner.rectTransform);
            SetPrivateField(marker, "outerRingImage", outer);
            SetPrivateField(marker, "innerRingImage", inner);
            SetPrivateField(marker, "tapArea", tapArea);

            var config = ScriptableObject.CreateInstance<GameplayConfig>();
            config.perfectWindowSeconds = 0.05f;
            config.goodWindowSeconds = 0.10f; // short, so the timeout below is fast

            float targetTime = Time.time + 0.05f;
            marker.Initialize(config, targetTime, telegraphLeadSeconds: 0.05f);

            yield return null; // let both graphics register with the raycaster this frame

            // ── Start the IN-5 hold ──
            inputController.ResolveTap(chargeScreenPoint);
            Assert.IsTrue(inputController.IsHoldActive, "Tapping the charge target must start a hold.");
            Assert.IsTrue(charge.IsCharging);

            // ── While charging, "mash" the marker - GDD MUST: this must NOT parry it ──
            inputController.ResolveTap(markerScreenPoint);
            yield return null;

            Assert.IsFalse(marker.IsResolved,
                "GDD §4.1 MUST ('차지 중 패링 불가'): a tap on a parry marker while charging must not resolve it.");

            // ── Let the marker's own good-window timeout elapse - it must auto-miss,
            // exactly as if it had simply been ignored ──
            yield return new WaitUntil(() => Time.time - targetTime > config.goodWindowSeconds);
            yield return null;

            Assert.IsTrue(marker.IsResolved, "The marker must eventually auto-resolve once its window closes.");
            Assert.AreEqual(ParryJudgment.Miss, marker.Result,
                "A marker that could not be answered during a hold must resolve as a Miss, never a parry.");

            // ── Releasing the hold fires the charged attack (only once held past
            // ChargeAttackController's minHoldSecondsForCharge, default 0.35s) ──
            yield return new WaitForSeconds(0.4f);
            inputController.ReleaseHold();
            Assert.IsFalse(inputController.IsHoldActive);
            Assert.IsTrue(chargedAttackFired, "Releasing after a full hold must fire the charged attack.");

            Object.Destroy(canvasGo);
            Object.Destroy(eventSystemGo);
            Object.Destroy(inputControllerGo);
            Object.Destroy(config);
        }
    }
}
