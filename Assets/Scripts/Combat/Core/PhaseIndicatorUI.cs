using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §5.1/§6.1: the HP bar's tick marks already expose the two phase boundaries
    /// visually (see HealthBarUI, which reads live current/max HP so the fill crossing a
    /// tick IS the phase transition, on the same HP-change event this reads). This adds a
    /// small explicit "phase N" text next to it for unambiguous QA/demo observability -
    /// not a GDD requirement by itself, just a thin display of state HuntPhaseTracker
    /// already computes. Single responsibility: this class only renders the phase number,
    /// it does not compute it.
    /// </summary>
    public class PhaseIndicatorUI : MonoBehaviour
    {
        [SerializeField] private HuntPhaseTracker phaseTracker;
        [SerializeField] private Text phaseText;

        private void Start()
        {
            if (phaseTracker == null)
            {
                return;
            }
            phaseTracker.OnPhaseChanged += HandlePhaseChanged;
            HandlePhaseChanged(phaseTracker.CurrentPhase);
        }

        private void OnDestroy()
        {
            if (phaseTracker != null)
            {
                phaseTracker.OnPhaseChanged -= HandlePhaseChanged;
            }
        }

        private void HandlePhaseChanged(int phase)
        {
            if (phaseText != null)
            {
                phaseText.text = $"PHASE {phase}";
            }
        }
    }
}
