using UnityEngine;
using UnityEngine.SceneManagement;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// This task's brief: "when MonsterHealth.CurrentHP reaches 0, the hunt ends - stop
    /// the pattern-drive loop cleanly, show a clear hunt-complete state, and make it
    /// possible to start a fresh run afterward." Single responsibility: this class owns
    /// exactly that state transition (listening for the monster's death and driving the
    /// result panel/restart), NOT the pattern-drive loop itself (that stays
    /// MonsterPatternPlayer.StopHunt's job) and NOT phase tracking (HuntPhaseTracker).
    ///
    /// "Fresh run" mechanism chosen: reload the current scene (SceneManager.LoadScene).
    /// This is deliberately simpler and more robust than manually resetting every
    /// stateful component's fields one by one (HealthController.CurrentHP, ComboController.Stage,
    /// PhasePatternSelector's per-phase guarantee counters, PlayerToken position, etc.) -
    /// a scene reload guarantees a genuinely clean slate with zero risk of a
    /// half-reset field silently carrying over into the next hunt. GDD §0 grants this
    /// kind of implementation-mechanism choice to team discretion.
    /// </summary>
    public class HuntCompletionController : MonoBehaviour
    {
        [SerializeField] private HealthController monsterHealth;
        [SerializeField] private MonsterPatternPlayer patternPlayer;
        [SerializeField] private GameObject resultPanel;

        private bool _huntEnded;

        private void Start()
        {
            if (monsterHealth != null)
            {
                monsterHealth.OnDepleted += HandleMonsterDepleted;
            }
            if (resultPanel != null)
            {
                resultPanel.SetActive(false);
            }
        }

        private void OnDestroy()
        {
            if (monsterHealth != null)
            {
                monsterHealth.OnDepleted -= HandleMonsterDepleted;
            }
        }

        private void HandleMonsterDepleted()
        {
            if (_huntEnded)
            {
                return;
            }
            _huntEnded = true;

            if (patternPlayer != null)
            {
                patternPlayer.StopHunt();
            }
            if (resultPanel != null)
            {
                resultPanel.SetActive(true);
            }
        }

        /// <summary>Wired to the result panel's "Restart" button (GDD §0: internal tooling
        /// wiring is team discretion). Reloads the current scene so the next hunt starts
        /// from a genuinely clean slate - see class remark for why a full reload was
        /// chosen over manual per-component resets.</summary>
        public void RestartHunt()
        {
            var scene = SceneManager.GetActiveScene();
            SceneManager.LoadScene(scene.name, LoadSceneMode.Single);
        }
    }
}
