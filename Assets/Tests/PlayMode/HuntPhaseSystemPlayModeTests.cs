using System.Collections;
using System.Collections.Generic;
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
    /// Drives this task's DEFAULT play path end to end through the real, generated
    /// CombatScene: live HP-driven phase transitions (HuntPhaseTracker), phase-weighted
    /// pattern selection with the guaranteed-relay-per-phase mechanism (PhasePatternSelector,
    /// via MonsterPatternPlayer.DriveLoop - NOT TriggerPatternById), and hunt completion
    /// (HuntCompletionController). Also re-verifies the dev/QA escape hatches
    /// (TriggerPatternById, SetAutoPlayEnabled) are unaffected, per this task's brief.
    /// </summary>
    public class HuntPhaseSystemPlayModeTests
    {
        private MonsterPatternPlayer _patternPlayer;
        private CombatInputController _inputController;
        private HealthController _monsterHealth;
        private HuntCompletionController _completionController;

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
            _completionController = Object.FindFirstObjectByType<HuntCompletionController>();
            Assert.IsNotNull(_patternPlayer);
            Assert.IsNotNull(_inputController);
            Assert.IsNotNull(_completionController);

            foreach (var health in Object.FindObjectsByType<HealthController>(FindObjectsSortMode.None))
            {
                if (health.gameObject.name == "MonsterHealth") _monsterHealth = health;
            }
            Assert.IsNotNull(_monsterHealth);

            yield return null;
        }

        /// <summary>Stops whatever DriveLoop pick already started on scene load (its first
        /// MoveNext runs synchronously inside Start(), before test code gets a chance to
        /// intervene - same race every existing pattern test sidesteps this way) and clears
        /// any stray marker/zone, WITHOUT resetting PhasePatternSelector's internal state
        /// (that state lives on the same _patternSelector instance the coroutine restart
        /// below reuses).</summary>
        private void HaltInFlightStepAndClearStrayVisuals()
        {
            _patternPlayer.SetAutoPlayEnabled(false);
            _patternPlayer.StopAllCoroutines();
            foreach (var stray in Object.FindObjectsByType<ParryMarker>(FindObjectsSortMode.None))
            {
                Object.Destroy(stray.gameObject);
            }
            foreach (var stray in Object.FindObjectsByType<DodgeZone>(FindObjectsSortMode.None))
            {
                Object.Destroy(stray.gameObject);
            }
        }

        /// <summary>Restarts the private DriveLoop coroutine via reflection (it is not
        /// public - see MonsterPatternPlayer). Used after directly manipulating monster HP
        /// so the NEXT pick genuinely goes through PhasePatternSelector against the new
        /// live phase, instead of testing via TriggerPatternById (which deliberately
        /// bypasses phase gating and would not exercise the default path this task adds).</summary>
        private void RestartDriveLoop()
        {
            _patternPlayer.SetAutoPlayEnabled(true);
            var method = typeof(MonsterPatternPlayer).GetMethod("DriveLoop", BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(method);
            var enumerator = (IEnumerator)method.Invoke(_patternPlayer, null);
            _patternPlayer.StartCoroutine(enumerator);
        }

        private IEnumerator WaitForMarker(System.Action<ParryMarker> onFound, float timeoutSeconds = 6f)
        {
            ParryMarker marker = null;
            float deadline = Time.time + timeoutSeconds;
            while (marker == null && Time.time < deadline)
            {
                yield return null;
                marker = Object.FindFirstObjectByType<ParryMarker>();
            }
            Assert.IsNotNull(marker, "Expected a ParryMarker to spawn.");
            onFound(marker);
        }

        // ── Live HP-driven phase transitions (GDD §5.1) ─────────────────────────────

        [UnityTest]
        public IEnumerator Hunt_StartsAtPhase1()
        {
            Assert.AreEqual(1, _patternPlayer.CurrentPhase);
            yield break;
        }

        [UnityTest]
        public IEnumerator CrossingHpBoundaries_AdvancesPhaseImmediately_MidCycle()
        {
            HaltInFlightStepAndClearStrayVisuals();
            Assert.AreEqual(1, _patternPlayer.CurrentPhase);

            int maxHp = _monsterHealth.MaxHP;
            // Drop to 69% - crosses the 70% boundary - phase must advance the same frame
            // TakeDamage is called (HuntPhaseTracker reacts synchronously to OnHealthChanged).
            _monsterHealth.TakeDamage(Mathf.CeilToInt(maxHp * 0.31f));
            Assert.AreEqual(2, _patternPlayer.CurrentPhase, "Crossing 70% HP must advance to phase 2 immediately, mid-cycle.");

            // Drop to 34% - crosses the 35% boundary.
            _monsterHealth.TakeDamage(Mathf.CeilToInt(maxHp * 0.35f));
            Assert.AreEqual(3, _patternPlayer.CurrentPhase, "Crossing 35% HP must advance to phase 3 immediately.");
            yield break;
        }

        // ── Guaranteed groggy rush per phase (GDD §5.1 MUST) - via the DEFAULT path ──

        [UnityTest]
        public IEnumerator DefaultPath_Phase2_GuaranteedRelayAttempt_SucceedsAndTriggersGroggyRush()
        {
            HaltInFlightStepAndClearStrayVisuals();

            int maxHp = _monsterHealth.MaxHP;
            _monsterHealth.TakeDamage(Mathf.CeilToInt(maxHp * 0.31f)); // -> phase 2
            Assert.AreEqual(2, _patternPlayer.CurrentPhase);

            RestartDriveLoop();

            // GDD §5.1 MUST guarantee mechanism (forced injection - see PhasePatternSelector):
            // the very first step DriveLoop picks after entering phase 2 must be the relay.
            ParryMarker marker = null;
            yield return WaitForMarker(m => marker = m);

            var outerImage = (UnityEngine.UI.Image)typeof(ParryMarker)
                .GetField("outerRingImage", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(marker);
            Assert.AreEqual(GameplayColors.Relay, outerImage.color,
                "The forced guaranteed pick entering phase 2 must be the relay pattern (red channel), reached via the real DriveLoop/PhasePatternSelector path, not TriggerPatternById.");

            // Tap all sequential relay beats correctly (GDD §5.2 solo substitute).
            for (int i = 0; i < 3; i++)
            {
                ParryMarker beatMarker = null;
                yield return WaitForMarker(m => beatMarker = m);
                yield return new WaitUntil(() => Time.time >= beatMarker.TargetTime);
                _inputController.ResolveTap(beatMarker.transform.position);
                yield return null;
                yield return null;
                Assert.AreEqual(ParryJudgment.Perfect, beatMarker.Result, $"Relay beat {i + 1} must resolve on a correctly-timed tap.");
                Object.Destroy(beatMarker.gameObject);
            }

            RushZone rush = null;
            float deadline = Time.time + 3f;
            while (rush == null && Time.time < deadline)
            {
                yield return null;
                rush = Object.FindFirstObjectByType<RushZone>();
            }
            Assert.IsNotNull(rush, "GDD §5.1 MUST: a groggy rush (C-4/P7) must occur during phase 2, guaranteed by the forced relay attempt.");
        }

        [UnityTest]
        public IEnumerator DefaultPath_Phase3_GuaranteedRelayAttempt_SucceedsAndTriggersGroggyRush()
        {
            HaltInFlightStepAndClearStrayVisuals();

            int maxHp = _monsterHealth.MaxHP;
            _monsterHealth.TakeDamage(Mathf.CeilToInt(maxHp * 0.66f)); // -> phase 3 (34% remaining)
            Assert.AreEqual(3, _patternPlayer.CurrentPhase);

            RestartDriveLoop();

            ParryMarker marker = null;
            yield return WaitForMarker(m => marker = m);
            var outerImage = (UnityEngine.UI.Image)typeof(ParryMarker)
                .GetField("outerRingImage", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(marker);
            Assert.AreEqual(GameplayColors.Relay, outerImage.color,
                "The forced guaranteed pick entering phase 3 must also be the relay pattern.");

            for (int i = 0; i < 3; i++)
            {
                ParryMarker beatMarker = null;
                yield return WaitForMarker(m => beatMarker = m);
                yield return new WaitUntil(() => Time.time >= beatMarker.TargetTime);
                _inputController.ResolveTap(beatMarker.transform.position);
                yield return null;
                yield return null;
                Assert.AreEqual(ParryJudgment.Perfect, beatMarker.Result, $"Relay beat {i + 1} must resolve on a correctly-timed tap.");
                Object.Destroy(beatMarker.gameObject);
            }

            RushZone rush = null;
            float deadline = Time.time + 3f;
            while (rush == null && Time.time < deadline)
            {
                yield return null;
                rush = Object.FindFirstObjectByType<RushZone>();
            }
            Assert.IsNotNull(rush, "GDD §5.1 MUST: a groggy rush (C-4/P7) must also occur during phase 3.");
        }

        // ── Hunt completion (this task's brief) ─────────────────────────────────────

        [UnityTest]
        public IEnumerator MonsterDepleted_StopsDriveLoop_ShowsResultPanel_NoOrphanedVisuals()
        {
            var resultPanel = GetPrivateField<GameObject>(_completionController, "resultPanel");
            Assert.IsFalse(resultPanel.activeSelf, "Result panel must start hidden.");

            _monsterHealth.TakeDamage(_monsterHealth.CurrentHP); // kill it in one hit
            yield return null;
            yield return null;

            Assert.IsFalse(_patternPlayer.AutoPlayEnabled, "StopHunt must disable auto-cycling.");
            Assert.IsTrue(resultPanel.activeSelf, "Hunt-complete result panel must become visible.");

            yield return null;
            Assert.AreEqual(0, Object.FindObjectsByType<ParryMarker>(FindObjectsSortMode.None).Length, "No orphaned markers after hunt end.");
            Assert.AreEqual(0, Object.FindObjectsByType<DodgeZone>(FindObjectsSortMode.None).Length, "No orphaned dodge zones after hunt end.");
            Assert.AreEqual(0, Object.FindObjectsByType<RushZone>(FindObjectsSortMode.None).Length, "No orphaned rush zones after hunt end.");
        }

        [UnityTest]
        public IEnumerator RestartHunt_ReloadsSceneWithFreshState()
        {
            _monsterHealth.TakeDamage(_monsterHealth.CurrentHP);
            yield return null;

            _completionController.RestartHunt();
            yield return null;
            yield return null;

            HealthController freshMonsterHealth = null;
            foreach (var health in Object.FindObjectsByType<HealthController>(FindObjectsSortMode.None))
            {
                if (health.gameObject.name == "MonsterHealth") freshMonsterHealth = health;
            }
            Assert.IsNotNull(freshMonsterHealth, "A fresh MonsterHealth must exist after restart.");
            Assert.AreEqual(freshMonsterHealth.MaxHP, freshMonsterHealth.CurrentHP, "Restarted hunt must start at full HP.");

            var freshCompletionController = Object.FindFirstObjectByType<HuntCompletionController>();
            Assert.IsNotNull(freshCompletionController);
            var freshResultPanel = GetPrivateField<GameObject>(freshCompletionController, "resultPanel");
            Assert.IsFalse(freshResultPanel.activeSelf, "Restarted hunt's result panel must start hidden again.");

            var freshPatternPlayer = Object.FindFirstObjectByType<MonsterPatternPlayer>();
            Assert.IsTrue(freshPatternPlayer.AutoPlayEnabled, "Restarted hunt must be interactable (auto-cycle re-enabled), not left in a dead state.");
        }

        // ── Dev/QA tools unaffected (this task's brief MUST) ────────────────────────

        [UnityTest]
        public IEnumerator DevTool_TriggerPatternById_StillBypassesPhaseGating_InPhase1()
        {
            HaltInFlightStepAndClearStrayVisuals();
            Assert.AreEqual(1, _patternPlayer.CurrentPhase);

            // P5 (relay) is normally forbidden in phase 1 by PhasePatternSelector - the
            // dev/QA escape hatch must still be able to trigger it directly regardless.
            _patternPlayer.TriggerPatternById("P5");

            ParryMarker marker = null;
            yield return WaitForMarker(m => marker = m);
            var outerImage = (UnityEngine.UI.Image)typeof(ParryMarker)
                .GetField("outerRingImage", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(marker);
            Assert.AreEqual(GameplayColors.Relay, outerImage.color,
                "TriggerPatternById must still bypass phase gating - unaffected by the new default phase-driven path.");
        }

        [UnityTest]
        public IEnumerator DevTool_SetAutoPlayEnabled_StillPausesAndResumesTheDriveLoop()
        {
            Assert.IsTrue(_patternPlayer.AutoPlayEnabled);
            _patternPlayer.SetAutoPlayEnabled(false);
            Assert.IsFalse(_patternPlayer.AutoPlayEnabled);
            _patternPlayer.SetAutoPlayEnabled(true);
            Assert.IsTrue(_patternPlayer.AutoPlayEnabled);
            yield break;
        }
    }
}
