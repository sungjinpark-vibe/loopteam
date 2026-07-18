using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using TouchRPG.Combat.Core;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// Drives IN-4 (GDD §4.1: tap on bare ground, no marker = move) through the REAL
    /// <see cref="CombatInputController.ResolveTap"/> raycast path against the real,
    /// generated CombatScene, and observes the <see cref="PlayerToken"/>'s
    /// RectTransform actually arrive near the tapped point over real elapsed frames.
    ///
    /// This closes the gap the previous round's team-lead review found: GroundTapZone
    /// (§4.2 lowest-priority tappable) -> PlayerToken.MoveTowardScreenPoint were wired
    /// and unit-testable in isolation, but the acceptance criterion "bare ground taps
    /// move [the player]" was never actually exercised end to end through the same
    /// production tap-resolution path the parry tests use.
    /// </summary>
    public class GroundTapPlayModeTests
    {
        [UnitySetUp]
        public IEnumerator LoadCombatScene()
        {
            yield return SceneManager.LoadSceneAsync("CombatScene", LoadSceneMode.Single);
        }

        [UnityTest]
        public IEnumerator TapOnBareGround_MovesThePlayerToken_ViaRealInputResolution()
        {
            var inputController = Object.FindFirstObjectByType<CombatInputController>();
            var playerTokenGo = GameObject.Find("PlayerToken");
            Assert.IsNotNull(inputController, "CombatInputController must exist in CombatScene.");
            Assert.IsNotNull(playerTokenGo, "PlayerToken must exist in CombatScene.");

            var playerRect = playerTokenGo.GetComponent<RectTransform>();
            Assert.IsNotNull(playerRect, "PlayerToken must have a RectTransform.");
            Vector2 startPos = playerRect.anchoredPosition;

            // A ground point well clear of the player token's own footprint, inside
            // BattlefieldLayer (GDD §6.1: 60-85% from the top of a portrait screen,
            // i.e. bottom-fraction 0.15-0.40 - see SceneBuilder.BuildLayerPanel), and
            // offset to the RIGHT of the player's start so any observed movement is
            // unambiguously "toward the tap", not incidental drift. No MonsterPart,
            // ParryMarker, DodgeZone, or PartyPortrait exists at this screen point, so
            // §4.2 priority resolution has exactly one real candidate here: Ground.
            Vector2 groundScreenPoint = new Vector2(Screen.width * 0.5f + 260f, Screen.height * 0.28f);

            inputController.ResolveTap(groundScreenPoint);

            // Real elapsed time, not a single frame: PlayerToken.Update moves at a
            // finite speed (Mathf.MoveTowards), so this observes the tap's actual
            // EFFECT - the token arriving - not just that a private target field got
            // set by GroundTapZone.OnTapped.
            float timeout = Time.time + 2f;
            while (Time.time < timeout && Vector2.Distance(playerRect.anchoredPosition, startPos) < 50f)
            {
                yield return null;
            }

            float moved = Vector2.Distance(playerRect.anchoredPosition, startPos);
            Assert.Greater(moved, 50f,
                "IN-4 (GDD §4.1/§4.2): tapping bare ground must move the PlayerToken. " +
                $"Observed movement after 2s was only {moved}px from a real ResolveTap call - " +
                "GroundTapZone -> PlayerToken.MoveTowardScreenPoint did not actually move the token.");

            Assert.Greater(playerRect.anchoredPosition.x, startPos.x,
                "The tapped ground point was to the right of the player's start; the token must have " +
                "moved right (toward the tap), not merely moved in some arbitrary direction.");
        }

        [UnityTest]
        public IEnumerator TapOnBareGround_DoesNotChangeMonsterOrPlayerHP()
        {
            // IN-4 is pure movement (§4.1: "이동") - it must never register as an attack
            // or a hit. This is the ground-tap half of §4.2's mis-input guard: with
            // nothing else under the tap point, the lowest-priority Ground candidate
            // must still resolve to ONLY a move, never fall through to damage logic.
            HealthController monsterHealth = null;
            HealthController playerHealth = null;
            foreach (var health in Object.FindObjectsByType<HealthController>(FindObjectsSortMode.None))
            {
                if (health.gameObject.name == "MonsterHealth") monsterHealth = health;
                if (health.gameObject.name == "PlayerHealth") playerHealth = health;
            }
            Assert.IsNotNull(monsterHealth, "MonsterHealth must exist in CombatScene.");
            Assert.IsNotNull(playerHealth, "PlayerHealth must exist in CombatScene.");

            var inputController = Object.FindFirstObjectByType<CombatInputController>();
            int monsterHpBefore = monsterHealth.CurrentHP;
            int playerHpBefore = playerHealth.CurrentHP;

            Vector2 groundScreenPoint = new Vector2(Screen.width * 0.5f - 260f, Screen.height * 0.28f);
            inputController.ResolveTap(groundScreenPoint);
            yield return null;
            yield return null;

            Assert.AreEqual(monsterHpBefore, monsterHealth.CurrentHP, "A ground tap must not damage the monster.");
            Assert.AreEqual(playerHpBefore, playerHealth.CurrentHP, "A ground tap must not damage the player.");
        }
    }
}
