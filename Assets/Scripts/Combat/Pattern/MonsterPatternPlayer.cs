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
    ///
    /// Beat scheduling: every beat in a step is launched as its OWN coroutine timed from
    /// the step's start time, not chained one-after-another. This matters for two reasons:
    /// (1) a missed/late beat must never perturb a later beat's telegraph window - each
    /// beat's spawn time is `stepStart + beatOffset - telegraphLead`, fixed regardless of
    /// what happened to any other beat; (2) the data schema (MonsterPatternStep.parryBeats)
    /// must be able to express overlapping/simultaneous beats for future patterns (P2-P7,
    /// future monsters) without this class being rewritten - independent coroutines already
    /// support that, a serialized "wait for beat N to resolve before scheduling beat N+1"
    /// loop structurally could not.
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

        // Constant per the current repeatIntervalSeconds value, so it is created once
        // instead of once per loop iteration of a coroutine designed to run forever.
        private WaitForSeconds _repeatWait;

        /// <summary>Bookkeeping-only holder so a step's beats can report completion back
        /// to the driving coroutine without a per-beat delegate/lambda allocation.</summary>
        private class BeatGroup
        {
            public int Remaining;
        }

        private void Start()
        {
            _repeatWait = new WaitForSeconds(repeatIntervalSeconds);
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
                    yield return _repeatWait;
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
            if (partRegistry == null || parryMarkerTemplate == null || step.parryBeats == null || step.parryBeats.Length == 0)
            {
                yield break;
            }

            var anchor = partRegistry.GetPartTransform(step.anchorPartId);
            if (anchor == null)
            {
                Debug.LogWarning($"[MonsterPatternPlayer] anchor part '{step.anchorPartId}' not found for step '{step.displayName}'.");
                yield break;
            }

            // All beats are timed from the SAME step-start instant, then launched as
            // independent coroutines. This is what keeps beat 2's telegraph correct even
            // when beat 1 resolved late (or auto-missed): beat 2's spawn time never
            // depends on when beat 1 finished, only on stepStartTime + its own offset.
            float stepStartTime = Time.time;
            var group = new BeatGroup { Remaining = step.parryBeats.Length };
            foreach (var beat in step.parryBeats)
            {
                StartCoroutine(RunBeat(step, anchor, stepStartTime, beat, group));
            }

            while (group.Remaining > 0)
            {
                yield return null;
            }
        }

        private IEnumerator RunBeat(MonsterPatternStep step, Transform anchor, float stepStartTime, ParryBeat beat, BeatGroup group)
        {
            float targetTime = stepStartTime + beat.beatOffsetSeconds;
            float spawnTime = targetTime - Mathf.Max(0.01f, beat.telegraphLeadSeconds);
            float waitSeconds = spawnTime - Time.time;
            if (waitSeconds > 0f)
            {
                // Per-beat wait is inherently variable (depends on the beat's own offset),
                // so unlike repeatIntervalSeconds above it cannot be pre-cached as a
                // shared WaitForSeconds.
                yield return new WaitForSeconds(waitSeconds);
            }

            var marker = Instantiate(parryMarkerTemplate, markerLayer);
            marker.gameObject.SetActive(true);
            marker.transform.position = anchor.position; // GDD §6.1 MUST: anchor to the monster part
            marker.Initialize(gameplayConfig, targetTime, beat.telegraphLeadSeconds);

            // Poll rather than subscribe: avoids allocating a per-beat closure just to
            // capture one result, and there is nothing to unsubscribe afterwards.
            while (!marker.IsResolved)
            {
                yield return null;
            }

            ApplyJudgment(step, marker.Result);
            group.Remaining--;
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
