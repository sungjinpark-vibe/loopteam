using System;
using UnityEngine;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// GDD §5.1: the hunt's 3-phase session is driven by the monster's REAL, live HP
    /// (phase 1 = 100~70%, phase 2 = 70~35%, phase 3 = 35~0%) - not a manually-set
    /// inspector field. This class owns exactly that one job (single responsibility):
    /// listen to <see cref="HealthController.OnHealthChanged"/> on the monster and
    /// recompute the current phase from the live HP fraction against
    /// <see cref="GameplayConfig.phaseBoundaryHighPercent"/>/<see cref="GameplayConfig.phaseBoundaryLowPercent"/>,
    /// firing <see cref="OnPhaseChanged"/> the instant a boundary is crossed - including
    /// mid-pattern-cycle, since it reacts to the same event the HP bar itself reads
    /// (<see cref="HealthBarUI"/>), so the visible tick-crossing and the gameplay phase
    /// change happen on the same HP update, not on separate clocks.
    ///
    /// Phase never regresses (monster HP never heals in this game) - <see cref="ComputePhase"/>
    /// is a pure function so it can be unit tested without a scene, and this component
    /// additionally clamps against regression defensively.
    /// </summary>
    public class HuntPhaseTracker : MonoBehaviour
    {
        [SerializeField] private HealthController monsterHealth;
        [SerializeField] private GameplayConfig gameplayConfig;

        public int CurrentPhase { get; private set; } = 1;

        /// <summary>Fires with the new phase number (2 or 3) the instant a boundary is
        /// crossed. Never fires for phase 1 (that is the starting phase, not a transition).</summary>
        public event Action<int> OnPhaseChanged;

        private void Start()
        {
            if (monsterHealth != null)
            {
                monsterHealth.OnHealthChanged += HandleHealthChanged;
                HandleHealthChanged(monsterHealth.CurrentHP, monsterHealth.MaxHP);
            }
        }

        private void OnDestroy()
        {
            if (monsterHealth != null)
            {
                monsterHealth.OnHealthChanged -= HandleHealthChanged;
            }
        }

        private void HandleHealthChanged(int current, int max)
        {
            float highPercent = gameplayConfig != null ? gameplayConfig.phaseBoundaryHighPercent : 70f;
            float lowPercent = gameplayConfig != null ? gameplayConfig.phaseBoundaryLowPercent : 35f;
            float hpFraction = max <= 0 ? 0f : (float)current / max;

            int computed = ComputePhase(hpFraction, highPercent, lowPercent);
            // Defensive clamp against regression - HP only decreases in this game, but a
            // future heal/revive mechanic must not silently roll the phase (and its
            // pattern-eligibility gates) backwards without an explicit design decision.
            int next = Mathf.Max(CurrentPhase, computed);
            if (next != CurrentPhase)
            {
                CurrentPhase = next;
                OnPhaseChanged?.Invoke(CurrentPhase);
            }
        }

        /// <summary>Pure phase math, GDD §5.1 table: HP% &lt;= low -> phase 3,
        /// HP% &lt;= high -> phase 2, else phase 1. Static + pure so it is unit-testable
        /// (see HuntPhaseTrackerTests) without instantiating a MonoBehaviour/scene.</summary>
        public static int ComputePhase(float hpFraction, float highBoundaryPercent, float lowBoundaryPercent)
        {
            float hpPercent = hpFraction * 100f;
            if (hpPercent <= lowBoundaryPercent)
            {
                return 3;
            }
            if (hpPercent <= highBoundaryPercent)
            {
                return 2;
            }
            return 1;
        }
    }
}
