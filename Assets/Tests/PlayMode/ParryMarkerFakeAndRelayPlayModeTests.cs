using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// Covers the two ParryMarker additions this task needed without touching its
    /// existing tested behavior (see JudgmentEvaluatorTests/TapResolutionPlayModeTests
    /// for the unchanged C1 path): (1) optional color/window overrides, used by the C-3
    /// relay solo substitute (GDD §6.2: red ring, GDD §4.3: relay.solo.window); (2)
    /// DissolveAsFake, used by P4's fake variant (GDD §7.2 MUST: no marker-side tell).
    /// Runs under PlayMode because Resolve()/DissolveAsFake() schedule a delayed
    /// Object.Destroy - only legal while the player loop is running. Resolve() is
    /// invoked via reflection with an EXPLICIT tapTime instead of live Time.time, for a
    /// deterministic offset from targetTime.
    /// </summary>
    public class ParryMarkerFakeAndRelayPlayModeTests
    {
        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"field '{fieldName}' not found on {target.GetType().Name}");
            field.SetValue(target, value);
        }

        private static ParryMarker CreateMarker(out Image outerImage)
        {
            var root = new GameObject("MarkerUnderTest", typeof(RectTransform));
            outerImage = new GameObject("Outer", typeof(RectTransform)).AddComponent<Image>();
            outerImage.transform.SetParent(root.transform, false);
            var inner = new GameObject("Inner", typeof(RectTransform)).AddComponent<Image>();
            inner.transform.SetParent(root.transform, false);
            var tapArea = new GameObject("TapArea", typeof(RectTransform)).AddComponent<Image>();
            tapArea.transform.SetParent(root.transform, false);

            var marker = root.AddComponent<ParryMarker>();
            SetPrivateField(marker, "outerRing", outerImage.rectTransform);
            SetPrivateField(marker, "innerRing", inner.rectTransform);
            SetPrivateField(marker, "outerRingImage", outerImage);
            SetPrivateField(marker, "innerRingImage", inner);
            SetPrivateField(marker, "tapArea", tapArea);
            return marker;
        }

        private static GameplayConfig CreateConfig(float perfect, float good)
        {
            var config = ScriptableObject.CreateInstance<GameplayConfig>();
            config.perfectWindowSeconds = perfect;
            config.goodWindowSeconds = good;
            return config;
        }

        private static void InvokeResolve(ParryMarker marker, float tapTime)
        {
            var method = typeof(ParryMarker).GetMethod("Resolve", BindingFlags.NonPublic | BindingFlags.Instance);
            method.Invoke(marker, new object[] { tapTime });
        }

        [Test]
        public void ColorOverride_TintsBothRings_DefaultsToParryYellowWhenOmitted()
        {
            var marker = CreateMarker(out var outerImage);
            var config = CreateConfig(0.15f, 0.35f);

            marker.Initialize(config, targetTime: Time.time + 10f, telegraphLeadSeconds: 1f);
            Assert.AreEqual(GameplayColors.Parry, outerImage.color, "No override -> default GDD §6.2 yellow parry color.");
            Object.Destroy(marker.gameObject);

            marker = CreateMarker(out outerImage);
            marker.Initialize(config, targetTime: Time.time + 10f, telegraphLeadSeconds: 1f, markerColorOverride: GameplayColors.Relay);
            Assert.AreEqual(GameplayColors.Relay, outerImage.color, "C-3 relay reuses the same ring with the red channel override.");

            Object.Destroy(marker.gameObject);
            Object.Destroy(config);
        }

        [Test]
        public void RelayInfo_ShowsSequenceBadge_AndBorderPulse_AndKeepsJudgmentUnforked()
        {
            var marker = CreateMarker(out var outerImage);
            var config = CreateConfig(0.15f, 0.35f);
            float targetTime = 100f;

            marker.Initialize(config, targetTime, telegraphLeadSeconds: 1f,
                markerColorOverride: GameplayColors.Relay,
                perfectWindowOverrideSeconds: 0.35f, goodWindowOverrideSeconds: 0.35f,
                relayInfo: new RelayMarkerInfo(2, 3));

            Assert.AreEqual(GameplayColors.Relay, outerImage.color, "GDD §6.2: relay marker must draw in the red channel.");

            var sequenceText = marker.GetComponentInChildren<Text>(includeInactive: true);
            Assert.IsNotNull(sequenceText, "GDD §6.2 MUST: relay marker must show a sequence number ('+ 순번').");
            Assert.IsTrue(sequenceText.gameObject.activeSelf, "Sequence badge must be visible for an active relay beat.");
            Assert.AreEqual("2/3", sequenceText.text, "Badge must show THIS beat's 1-based position in the sequence.");

            var borderPulse = marker.transform.Find("RelayBorderPulse");
            Assert.IsNotNull(borderPulse, "GDD §6.2 MUST triple signal: relay marker needs a border-pulse element.");
            Assert.IsTrue(borderPulse.gameObject.activeSelf, "Border pulse must be active while this relay beat is live (solo = always '내 차례').");

            // Judgment must still be computed via the SAME JudgmentEvaluator/config-driven
            // window path as any other marker - relay info only changes cosmetics.
            InvokeResolve(marker, tapTime: 100.10f); // within the 0.35s override window
            Assert.AreEqual(ParryJudgment.Perfect, marker.Result, "Relay beat judgment must still resolve via JudgmentEvaluator with the injected window, unchanged by the new visuals.");
            Assert.IsFalse(borderPulse.gameObject.activeSelf, "Border pulse must be hidden once the beat resolves.");
            Assert.IsFalse(sequenceText.gameObject.activeSelf, "Sequence badge must be hidden once the beat resolves.");

            Object.Destroy(marker.gameObject);
            Object.Destroy(config);
        }

        [Test]
        public void NoRelayInfo_NeverShowsRelayVisuals()
        {
            var marker = CreateMarker(out var outerImage);
            var config = CreateConfig(0.15f, 0.35f);

            marker.Initialize(config, targetTime: Time.time + 10f, telegraphLeadSeconds: 1f);

            Assert.AreEqual(GameplayColors.Parry, outerImage.color, "A plain parry beat must stay yellow, never the relay red.");
            Assert.IsNull(marker.GetComponentInChildren<Text>(includeInactive: true), "A plain parry beat must not show a relay sequence badge.");
            Assert.IsNull(marker.transform.Find("RelayBorderPulse"), "A plain parry beat must not build a relay border-pulse element at all.");

            Object.Destroy(marker.gameObject);
            Object.Destroy(config);
        }

        [Test]
        public void WindowOverride_IsUsedInsteadOfConfigWindows()
        {
            var marker = CreateMarker(out _);
            // Config windows are deliberately WIDE so if the override were ignored, this
            // offset would read as Perfect - only a correctly-applied narrow override
            // makes it a Miss.
            var config = CreateConfig(perfect: 0.5f, good: 0.5f);
            float targetTime = 100f;
            float tapTime = 100.20f; // 0.20s late

            marker.Initialize(config, targetTime, telegraphLeadSeconds: 1f,
                perfectWindowOverrideSeconds: 0.05f, goodWindowOverrideSeconds: 0.05f);
            InvokeResolve(marker, tapTime);

            Assert.AreEqual(ParryJudgment.Miss, marker.Result,
                "0.20s late must be a Miss under the 0.05s override, even though the SAME offset would be Perfect under the config's own 0.5s windows.");

            Object.Destroy(marker.gameObject);
            Object.Destroy(config);
        }

        [Test]
        public void NoWindowOverride_FallsBackToConfigWindows()
        {
            var marker = CreateMarker(out _);
            var config = CreateConfig(perfect: 0.15f, good: 0.35f);
            float targetTime = 100f;
            float tapTime = 100.20f; // within config's good window, outside perfect

            marker.Initialize(config, targetTime, telegraphLeadSeconds: 1f);
            InvokeResolve(marker, tapTime);

            Assert.AreEqual(ParryJudgment.Good, marker.Result);

            Object.Destroy(marker.gameObject);
            Object.Destroy(config);
        }

        [Test]
        public void DissolveAsFake_ResolvesWithoutFiringOnResolved_AndDisablesInput()
        {
            var marker = CreateMarker(out _);
            var config = CreateConfig(0.15f, 0.35f);
            marker.Initialize(config, targetTime: Time.time + 50f, telegraphLeadSeconds: 1f);

            bool resolvedFired = false;
            marker.OnResolved += (m, j) => resolvedFired = true;

            Assert.IsTrue(marker.IsTappable);
            marker.DissolveAsFake();

            Assert.IsFalse(marker.IsTappable, "A dissolved fake must no longer be tappable.");
            Assert.IsFalse(resolvedFired, "GDD §7.2 MUST: holding back on a fake is neither a hit nor a parry - OnResolved must not fire.");
            Assert.IsNull(Object.FindFirstObjectByType<ParryBurstEffect>(), "Dissolving a fake must not spawn a burst.");

            Object.Destroy(marker.gameObject);
            Object.Destroy(config);
        }

        [Test]
        public void DissolveAsFake_IsIdempotent_WhenAlreadyResolved()
        {
            var marker = CreateMarker(out _);
            var config = CreateConfig(0.15f, 0.35f);
            marker.Initialize(config, targetTime: Time.time + 50f, telegraphLeadSeconds: 1f);

            marker.OnTapped(Vector2.zero); // resolves it normally first
            Assert.IsTrue(marker.IsResolved);

            Assert.DoesNotThrow(() => marker.DissolveAsFake());

            Object.Destroy(marker.gameObject);
            Object.Destroy(config);
        }
    }
}
