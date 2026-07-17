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
        public IEnumerator CombatScene_LoadsAndSpawnsTheFirstLampangP1MarkerWithoutErrors()
        {
            yield return SceneManager.LoadSceneAsync("CombatScene", LoadSceneMode.Single);

            Assert.IsNotNull(GameObject.Find("MonsterHealth"), "MonsterHealth must exist in the loaded scene");
            Assert.IsNotNull(GameObject.Find("PlayerHealth"), "PlayerHealth must exist in the loaded scene");
            Assert.IsNotNull(GameObject.Find("ComboController"), "ComboController must exist in the loaded scene");
            Assert.IsNotNull(GameObject.Find("MonsterPatternPlayer"), "MonsterPatternPlayer must exist in the loaded scene");

            bool markerSeen = false;
            for (int frame = 0; frame < 90 && !markerSeen; frame++) // ~1.5s at 60fps
            {
                yield return null;
                markerSeen = Object.FindFirstObjectByType<ParryMarker>() != null;
            }

            Assert.IsTrue(markerSeen, "Expected a ParryMarker (Lampang P1 beat 1) to spawn within ~1.5s of scene start");
        }
    }
}
