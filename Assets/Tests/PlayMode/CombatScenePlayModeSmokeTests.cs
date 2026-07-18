using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// Not part of the mechanical gate (which only runs EditMode) - this is a self-check
    /// so a wiring mistake in SceneBuilder (e.g. a missing serialized reference causing a
    /// NullReferenceException at runtime) is caught before handoff, rather than only
    /// discovered when QA drives the build. Loads the real generated CombatScene and lets
    /// it run for real frames; fails on ANY logged error/exception, not just assertions.
    /// </summary>
    public class CombatScenePlayModeSmokeTests
    {
        [UnityTest]
        public IEnumerator CombatScene_LoadsAndSpawnsPhase1ContentWithoutErrors()
        {
            yield return SceneManager.LoadSceneAsync("CombatScene", LoadSceneMode.Single);

            Assert.IsNotNull(GameObject.Find("MonsterHealth"), "MonsterHealth must exist in the loaded scene");
            Assert.IsNotNull(GameObject.Find("PlayerHealth"), "PlayerHealth must exist in the loaded scene");
            Assert.IsNotNull(GameObject.Find("ComboController"), "ComboController must exist in the loaded scene");
            Assert.IsNotNull(GameObject.Find("MonsterPatternPlayer"), "MonsterPatternPlayer must exist in the loaded scene");

            // Phase 1's DEFAULT play path picks between P1 (C-1, spawns a ParryMarker) and
            // P3 (C-2, spawns a DodgeZone) via PhasePatternSelector's weighted random -
            // NOT a fixed P1-always-first order any more (see that class's own remark).
            // This smoke test's job is confirming the hunt actually starts driving SOME
            // phase-1 content without errors, not pinning which specific pattern happens
            // to be picked first.
            bool contentSeen = false;
            float deadline = Time.time + 3f;
            while (!contentSeen && Time.time < deadline)
            {
                yield return null;
                contentSeen = Object.FindFirstObjectByType<ParryMarker>() != null
                    || Object.FindFirstObjectByType<DodgeZone>() != null;
            }

            Assert.IsTrue(contentSeen, "Expected phase 1 to spawn a ParryMarker (P1) or a DodgeZone (P3) within ~3s of scene start");
        }
    }
}
