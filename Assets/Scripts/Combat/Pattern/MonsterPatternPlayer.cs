using System.Collections;
using UnityEngine;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// Drives a <see cref="MonsterPatternSheet"/>: picks phase-eligible steps and executes
    /// them by <see cref="PatternClass"/>. Only <see cref="PatternClass.C1_Basic"/> is
    /// executed in this task (spawn parry marker(s) anchored to a monster part, wait for
    /// judgment, apply combo/damage) - that is the whole of what this task builds. The
    /// other four classes are real switch cases that log-and-skip; the brief's clean-seam
    /// requirement means a later task adds a case body here, not a rewrite of this class
    /// or the data schema.
    ///
    /// The repeat loop below (waiting <see cref="repeatIntervalSeconds"/> between steps) is
    /// a P0 demo driver only, NOT the GDD §5.1 three-phase session system - that is a
    /// separate, larger task. It exists so the tap-parry loop this task is responsible for
    /// is actually repeatable and demonstrable end to end.
    /// </summary>
    public class MonsterPatternPlayer : MonoBehaviour
    {
        [SerializeField] private MonsterPatternSheet patternSheet;
        [SerializeField] private GameplayConfig gameplayConfig;
        [SerializeField] private P0DemoNumbers demoNumbers;
        [SerializeField] private MonsterPartRegistry partRegistry;
        [SerializeField] private ComboController combo;
        [SerializeField] private HealthController playerHealth;
        [SerializeField] private RectTransform markerLayer;
        [SerializeField] private ParryMarker parryMarkerTemplate;

        [Tooltip("Seconds between repeated pattern-step executions in this P0 demo driver. " +
                 "Not a GDD number (the real session/phase pacing is a separate task) - " +
                 "PROVISIONAL staging value, team discretion.")]
        [SerializeField] private float repeatIntervalSeconds = 2.5f;

        [SerializeField] [Range(1, 3)] private int currentPhase = 1;

        private void Start()
        {
            if (patternSheet != null)
            {
                StartCoroutine(DriveLoop());
            }
        }

        private IEnumerator DriveLoop()
        {
            while (true)
            {
                var eligible = patternSheet.GetStepsForPhase(currentPhase);
                if (eligible.Length == 0)
                {
                    yield return null;
                    continue;
                }

                foreach (var step in eligible)
                {
                    yield return StartCoroutine(ExecuteStep(step));
                    yield return new WaitForSeconds(repeatIntervalSeconds);
                }
            }
        }

        private IEnumerator ExecuteStep(MonsterPatternStep step)
        {
            switch (step.classification)
            {
                case PatternClass.C1_Basic:
                    yield return StartCoroutine(ExecuteC1Basic(step));
                    break;
                default:
                    // Seam for later tasks - brief: "leave clean seams, do NOT build them."
                    Debug.LogWarning($"[MonsterPatternPlayer] {step.classification} not implemented in this task - skipping '{step.displayName}'.");
                    break;
            }
        }

        private IEnumerator ExecuteC1Basic(MonsterPatternStep step)
        {
            if (partRegistry == null || parryMarkerTemplate == null || step.parryBeats == null)
            {
                yield break;
            }

            var anchor = partRegistry.GetPartTransform(step.anchorPartId);
            if (anchor == null)
            {
                Debug.LogWarning($"[MonsterPatternPlayer] anchor part '{step.anchorPartId}' not found for step '{step.displayName}'.");
                yield break;
            }

            float stepStartTime = Time.time;
            foreach (var beat in step.parryBeats)
            {
                float targetTime = stepStartTime + beat.beatOffsetSeconds;
                float waitSeconds = (targetTime - beat.telegraphLeadSeconds) - Time.time;
                if (waitSeconds > 0f)
                {
                    yield return new WaitForSeconds(waitSeconds);
                }

                var marker = Instantiate(parryMarkerTemplate, markerLayer);
                marker.gameObject.SetActive(true);
                marker.transform.position = anchor.position; // GDD §6.1 MUST: anchor to the monster part
                marker.Initialize(gameplayConfig, targetTime, beat.telegraphLeadSeconds);

                bool resolved = false;
                var result = ParryJudgment.Miss;
                marker.OnResolved += (m, judgment) =>
                {
                    resolved = true;
                    result = judgment;
                };

                while (!resolved)
                {
                    yield return null;
                }

                ApplyJudgment(step, result);
            }
        }

        private void ApplyJudgment(MonsterPatternStep step, ParryJudgment judgment)
        {
            switch (judgment)
            {
                case ParryJudgment.Perfect:
                    if (combo != null) combo.RegisterPerfect();
                    break;
                case ParryJudgment.Good:
                    if (combo != null) combo.RegisterGood();
                    break;
                case ParryJudgment.Miss:
                    if (combo != null) combo.RegisterHit();
                    ApplyFailureDamage(step);
                    break;
            }
        }

        private void ApplyFailureDamage(MonsterPatternStep step)
        {
            if (playerHealth == null || demoNumbers == null)
            {
                return;
            }
            int damage = step.failureSeverity switch
            {
                FailureSeverity.Small => demoNumbers.p1FailureDamageSmall,
                FailureSeverity.Medium => demoNumbers.failureDamageMedium,
                _ => 0
            };
            playerHealth.TakeDamage(damage);
        }
    }
}
