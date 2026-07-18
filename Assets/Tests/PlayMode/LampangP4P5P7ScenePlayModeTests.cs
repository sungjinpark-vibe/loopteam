using System.Collections;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using TouchRPG.Combat.Core;
using TouchRPG.Combat.Input;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// Drives P4 (fake variant) and the P5-&gt;P7 relay/groggy chain through the REAL,
    /// generated CombatScene and the real MonsterPatternPlayer.TriggerPatternById /
    /// CombatInputController.ResolveTap paths - not synthetic fixtures. Covers acceptance
    /// criteria this task's brief calls out explicitly: P4 real vs fake is
    /// indistinguishable on the marker (only the demonstrated OUTCOME differs), a fake
    /// tapped early counter-hits, correctly holding back on a fake costs nothing, and P7
    /// is only reachable after a successful P5.
    /// </summary>
    public class LampangP4P5P7ScenePlayModeTests
    {
        private MonsterPatternPlayer _patternPlayer;
        private CombatInputController _inputController;
        private ComboController _combo;
        private HealthController _playerHealth;

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"field '{fieldName}' not found on {target.GetType().Name}");
            field.SetValue(target, value);
        }

        private static T GetPrivateField<T>(object target, string fieldName)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"field '{fieldName}' not found on {target.GetType().Name}");
            return (T)field.GetValue(target);
        }

        [UnitySetUp]
        public IEnumerator LoadCombatScene()
        {
            yield return SceneManager.LoadSceneAsync("CombatScene", LoadSceneMode.Single);

            _patternPlayer = Object.FindFirstObjectByType<MonsterPatternPlayer>();
            _inputController = Object.FindFirstObjectByType<CombatInputController>();
            _combo = Object.FindFirstObjectByType<ComboController>();
            Assert.IsNotNull(_patternPlayer);
            Assert.IsNotNull(_inputController);
            Assert.IsNotNull(_combo);

            foreach (var health in Object.FindObjectsByType<HealthController>(FindObjectsSortMode.None))
            {
                if (health.gameObject.name == "PlayerHealth") _playerHealth = health;
            }
            Assert.IsNotNull(_playerHealth);

            // Stop the autonomous P1 auto-cycle so it cannot spawn a competing marker
            // while these tests drive a specific pattern manually.
            _patternPlayer.SetAutoPlayEnabled(false);
            _patternPlayer.StopAllCoroutines();
            foreach (var stray in Object.FindObjectsByType<ParryMarker>(FindObjectsSortMode.None))
            {
                Object.Destroy(stray.gameObject);
            }
            yield return null;
        }

        /// <summary>Polls by REAL elapsed Time.time (up to 2s), not a fixed frame count -
        /// batchmode runs frames far faster than 60fps with nothing to render, so a
        /// frame-count budget can expire before a beat's real WaitForSeconds delay (e.g.
        /// P5's first beat spawns 0.2s after trigger, not immediately like P1/P4's first
        /// beat) has actually elapsed.</summary>
        private IEnumerator WaitForMarker(System.Action<ParryMarker> onFound)
        {
            ParryMarker marker = null;
            float deadline = Time.time + 2f;
            while (marker == null && Time.time < deadline)
            {
                yield return null;
                marker = Object.FindFirstObjectByType<ParryMarker>();
            }
            Assert.IsNotNull(marker, "Expected a ParryMarker to spawn.");
            onFound(marker);
        }

        [UnityTest]
        public IEnumerator P4_Real_TappedOnTime_ResolvesPerfect_AndMarkerColorIsUnaffected()
        {
            _patternPlayer.ForceNextP4Outcome(isReal: true);
            _patternPlayer.TriggerPatternById("P4");

            ParryMarker marker = null;
            yield return WaitForMarker(m => marker = m);

            var outerImage = (UnityEngine.UI.Image)typeof(ParryMarker)
                .GetField("outerRingImage", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(marker);
            Assert.AreEqual(GameplayColors.Parry, outerImage.color,
                "GDD §7.2 P4 MUST: the marker must look identical whether real or fake - always the plain yellow parry color.");

            yield return new WaitUntil(() => Time.time >= marker.TargetTime);
            _inputController.ResolveTap(marker.transform.position);
            yield return null;
            yield return null;

            Assert.AreEqual(ParryJudgment.Perfect, marker.Result, "A REAL P4 beat tapped on time must resolve exactly like a normal parry.");
            Assert.AreEqual(1, _combo.Stage);
        }

        [UnityTest]
        public IEnumerator P4_Fake_TappedEarly_CounterHits_AndMarkerColorIsUnaffected()
        {
            int hpBefore = _playerHealth.CurrentHP;
            _patternPlayer.ForceNextP4Outcome(isReal: false);
            _patternPlayer.TriggerPatternById("P4");

            ParryMarker marker = null;
            yield return WaitForMarker(m => marker = m);

            var outerImage = (UnityEngine.UI.Image)typeof(ParryMarker)
                .GetField("outerRingImage", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(marker);
            Assert.AreEqual(GameplayColors.Parry, outerImage.color,
                "GDD §7.2 P4 MUST: a fake marker must look identical to a real one - the tell is never on the marker.");

            // Tap immediately - well before the fake's dissolve point - this is the
            // "조기 탭" (early tap) GDD calls out as a counter-hit.
            _inputController.ResolveTap(marker.transform.position);
            yield return null;
            yield return null;

            Assert.Less(_playerHealth.CurrentHP, hpBefore,
                "GDD §7.2 P4: tapping a fake early must counter-hit the player.");
            Assert.AreEqual(0, _combo.Stage, "A counter-hit must reset combo like any other hit.");
        }

        [UnityTest]
        public IEnumerator P4_Fake_HeldBack_CostsNothing_AndDissolvesGrey()
        {
            int hpBefore = _playerHealth.CurrentHP;
            _patternPlayer.ForceNextP4Outcome(isReal: false);
            _patternPlayer.TriggerPatternById("P4");

            ParryMarker marker = null;
            yield return WaitForMarker(m => marker = m);

            // Deliberately do NOT tap. Wait long enough for the fake to dissolve
            // (dissolveLead = max(0.5, goodWindow+0.15) before its target time).
            yield return new WaitForSeconds(1.0f);
            yield return null;

            Assert.AreEqual(hpBefore, _playerHealth.CurrentHP, "Correctly holding back on a fake must cost nothing.");
            Assert.IsFalse(marker.IsTappable, "The fake must have dissolved (no longer tappable) once its window passed.");
        }

        [UnityTest]
        public IEnumerator P5_SoloRelaySuccess_TriggersP7_RushZone()
        {
            _patternPlayer.TriggerPatternById("P5");

            // Tap all three sequential relay beats correctly, one at a time.
            for (int i = 0; i < 3; i++)
            {
                ParryMarker marker = null;
                yield return WaitForMarker(m => marker = m);
                yield return new WaitUntil(() => Time.time >= marker.TargetTime);
                _inputController.ResolveTap(marker.transform.position);
                yield return null;
                yield return null;
                Assert.AreEqual(ParryJudgment.Perfect, marker.Result, $"Relay beat {i + 1} must resolve on a correctly-timed tap.");

                // Destroy it immediately (rather than waiting out its fade) so the NEXT
                // WaitForMarker call cannot alias this already-resolved marker instead of
                // the next beat's genuinely new one - a resolved marker is still onscreen
                // fading for a bit (see ParryMarker.Resolve's Destroy(gameObject, 0.4f)).
                Object.Destroy(marker.gameObject);
            }

            // A successful P5 must trigger P7 (belly rush, IN-6) automatically - this is
            // the ONLY way C4_Groggy is reachable in real (non-manually-triggered) play.
            RushZone rush = null;
            float rushDeadline = Time.time + 2f;
            while (rush == null && Time.time < rushDeadline)
            {
                yield return null;
                rush = Object.FindFirstObjectByType<RushZone>();
            }
            Assert.IsNotNull(rush, "GDD §7.2 P7: a successful P5 relay must spawn the groggy rush zone (P7).");
        }

        [UnityTest]
        public IEnumerator P3_SpawnsExactlyOneDodgeZone()
        {
            _patternPlayer.TriggerPatternById("P3");
            // GDD §7.2 P3 예고: "지면 붉은 라인" - P3's dodge zone is now preceded by a brief
            // ground-line telegraph (MonsterPatternStep.showGroundTelegraphLine /
            // groundTelegraphLeadSeconds) before the zone itself spawns, so this must wait
            // past that lead-in rather than just a couple of frames.
            float lead = GetPrivateField<float>(_patternPlayer, "groundTelegraphLeadSeconds");
            yield return new WaitForSeconds(lead + 0.1f);

            var zones = Object.FindObjectsByType<DodgeZone>(FindObjectsSortMode.None);
            Assert.AreEqual(1, zones.Length, "GDD §7.2 P3: a single dodge zone, position randomized left/right.");
        }

        [UnityTest]
        public IEnumerator P6_SpawnsMultipleSimultaneousDodgeZones()
        {
            _patternPlayer.TriggerPatternById("P6");
            yield return null;
            yield return null;

            var zones = Object.FindObjectsByType<DodgeZone>(FindObjectsSortMode.None);
            Assert.Greater(zones.Length, 1, "GDD §7.2 P6: '다중 낙하점' - multiple simultaneous dodge zones.");
        }

        [UnityTest]
        public IEnumerator P3_ShowsGroundTelegraphLineBeforeTheZoneItselfAppears()
        {
            _patternPlayer.TriggerPatternById("P3");
            yield return null; // one frame in: the telegraph should be up, the zone should not exist yet.

            var telegraph = Object.FindFirstObjectByType<GroundTelegraphLine>();
            Assert.IsNotNull(telegraph, "GDD §7.2 P3 예고: '지면 붉은 라인' must render before the dodge zone spawns.");
            var earlyZones = Object.FindObjectsByType<DodgeZone>(FindObjectsSortMode.None);
            Assert.AreEqual(0, earlyZones.Length, "The dodge zone itself must not exist yet during the ground telegraph lead-in.");

            float lead = GetPrivateField<float>(_patternPlayer, "groundTelegraphLeadSeconds");
            yield return new WaitForSeconds(lead + 0.1f);

            var zones = Object.FindObjectsByType<DodgeZone>(FindObjectsSortMode.None);
            Assert.AreEqual(1, zones.Length, "The dodge zone must exist once the telegraph lead-in has elapsed.");
        }

        [UnityTest]
        public IEnumerator P3_UnansweredZone_KnocksThePlayerBackOnFailure()
        {
            var playerToken = Object.FindFirstObjectByType<PlayerToken>();
            Assert.IsNotNull(playerToken);
            float startX = playerToken.LocalPosition.x;

            _patternPlayer.TriggerPatternById("P3");

            // Wait past the ground-telegraph lead-in, the P3 dodge-zone window itself
            // (GameplayConfig.dodgeZoneP3WindowSeconds = 1.2s), and enough margin for the
            // knockback move (PlayerToken.KnockbackAwayFrom, dash-speed channel) to land -
            // WITHOUT ever tapping the zone, so it resolves Miss (GDD §7.2 P3 실패: "중피해+넉백").
            yield return new WaitForSeconds(2.2f);

            float endX = playerToken.LocalPosition.x;
            Assert.AreNotEqual(startX, endX, "An unanswered P3 dodge zone must knock the player back away from it (GDD §7.2 '넉백').");
        }
    }
}
