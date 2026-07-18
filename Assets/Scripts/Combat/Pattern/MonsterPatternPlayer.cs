using System.Collections;
using UnityEngine;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// Drives a <see cref="MonsterPatternSheet"/>: picks phase-eligible steps and executes
    /// them by <see cref="PatternClass"/>. All five classes have a real execution path:
    /// C1_Basic (plain + P4's fake variant), C2_HeavyAttack/C5_CastAoE (dodge zones,
    /// IN-3), C3_Relay (solo substitute sequence, GDD §5.2), C4_Groggy (rush, IN-6).
    ///
    /// DEFAULT PLAY PATH (this task, GDD §5.1): DriveLoop below is the real 3-phase hunt
    /// session, not a demo cycle. Phase is read live from <see cref="phaseTracker"/> (which
    /// itself derives it from the monster's actual current HP, GDD §5.1's HP table - see
    /// HuntPhaseTracker), and the next step to run is chosen by <see cref="PhasePatternSelector"/>,
    /// which enforces each phase's eligibility gates/composition and guarantees a relay
    /// attempt near each phase transition (GDD §5.1 MUST: at least one groggy rush (C4)
    /// per phase transition - see that class's remark for the exact mechanism). The
    /// monster's death (HP 0) stops this loop via <see cref="StopHunt"/>, called by
    /// HuntCompletionController - see that class for the hunt-complete UI/restart flow.
    ///
    /// DEV/QA ESCAPE HATCH (unchanged by this task): <see cref="TriggerPatternById"/> lets
    /// any of P1-P7 be triggered independently of phase gating, and is how
    /// <see cref="AutoPlayToggleButton"/>/<see cref="PatternTriggerButton"/> (dev/QA
    /// tooling, GDD §0 team discretion) drive the demo scene - both keep working exactly
    /// as before; they bypass PhasePatternSelector entirely rather than being gated by it.
    ///
    /// Beat scheduling: every beat in a step is launched as its OWN coroutine timed from
    /// the step's start time, not chained one-after-another (except C3_Relay, which is
    /// INTENTIONALLY sequential - GDD §5.2's relay chain fails as soon as one link fails,
    /// so later beats must not even spawn once an earlier one misses).
    /// </summary>
    public class MonsterPatternPlayer : MonoBehaviour
    {
        [SerializeField] private MonsterPatternSheet patternSheet;
        [SerializeField] private GameplayConfig gameplayConfig;
        [SerializeField] private P0DemoNumbers demoNumbers;
        [SerializeField] private MonsterPartRegistry partRegistry;
        [SerializeField] private ComboController combo;
        [SerializeField] private HealthController playerHealth;
        [SerializeField] private HealthController monsterHealth;
        [SerializeField] private RectTransform markerLayer;
        [SerializeField] private ParryMarker parryMarkerTemplate;

        [Header("IN-3 dodge zone (P3/P6) - GDD §4.1/§6.2")]
        [SerializeField] private DodgeZone dodgeZoneTemplate;
        [SerializeField] private RectTransform battlefieldPanel;
        [SerializeField] private PlayerToken playerToken;
        [Tooltip("PROVISIONAL staging value - GDD gives no dodge-zone size number.")]
        [SerializeField] private float dodgeZoneRadiusPixels = 130f;
        [Tooltip("PROVISIONAL staging value - how far left/right of center a single (P3-style) " +
                 "dodge zone spawns.")]
        [SerializeField] private float dodgeZoneSingleOffsetPixels = 280f;
        [Tooltip("PROVISIONAL staging value, purely cosmetic pacing (does not change any " +
                 "judgment/outcome) - how long a GDD §7.2 P3 ground-line telegraph (see " +
                 "MonsterPatternStep.showGroundTelegraphLine) is visible before the dodge " +
                 "zone itself spawns at the same position.")]
        [SerializeField] private float groundTelegraphLeadSeconds = 0.3f;
        [Tooltip("PROVISIONAL staging value - how far a GDD §7.2 P3 failure ('넉백') knocks " +
                 "the player back away from the missed zone. Not a judgment number, purely " +
                 "a movement-pacing value (same status as PlayerToken.dashSpeedMultiplier).")]
        [SerializeField] private float dodgeFailureKnockbackDistancePixels = 160f;

        [Header("IN-6 rush (P7) - GDD §4.1/§6.2")]
        [SerializeField] private RushZone rushZoneTemplate;

        [Header("P4 fake tell (GDD §7.2 MUST - animation only, never the marker)")]
        [SerializeField] private LampangCheekTellAnimator cheekTellAnimator;

        [Tooltip("Seconds between repeated pattern-step executions in phase 1/2. Not a GDD " +
                 "number - PROVISIONAL staging value, team discretion.")]
        [SerializeField] private float repeatIntervalSeconds = 2.5f;

        [Tooltip("Seconds between repeated pattern-step executions in phase 3 ONLY. GDD " +
                 "§5.1 phase 3: '패턴 밀도 최대' (maximum pattern density) - this is that " +
                 "density knob: a SHORTER gap between beats than phase 1/2, not a new " +
                 "per-beat judgment timing (those are unchanged, still ParryBeat/GameplayConfig " +
                 "values). PROVISIONAL staging value, team discretion, same category as " +
                 "repeatIntervalSeconds above.")]
        [SerializeField] private float repeatIntervalSecondsPhase3 = 1.2f;

        [Tooltip("GDD §5.1: the hunt's real 3-phase session, driven by the monster's live " +
                 "HP - see HuntPhaseTracker. Required for the default (non-dev-override) " +
                 "play path; TriggerPatternById does not need this (it bypasses phase gating).")]
        [SerializeField] private HuntPhaseTracker phaseTracker;

        [Tooltip("Dev/QA only - pauses the auto-cycling DriveLoop so a manually triggered " +
                 "pattern (TriggerPatternById) can be observed without the next auto-cycled " +
                 "step spawning on top of it.")]
        [SerializeField] private bool autoPlayEnabled = true;

        // Constant per the current repeatIntervalSeconds/Phase3 values, so each is created
        // once instead of once per loop iteration of a coroutine designed to run forever.
        private WaitForSeconds _repeatWait;
        private WaitForSeconds _repeatWaitPhase3;

        // P4's real/fake pick + its dev/QA forced-outcome override live in their own
        // plain-C# helper (see P4FakeOutcomePicker) - split out so this MonoBehaviour's
        // job stays "drive the pattern sheet", not also "own P4's randomness state".
        private readonly P4FakeOutcomePicker _p4FakeOutcomePicker = new P4FakeOutcomePicker();

        // GDD §5.1 phase-weighted pattern selection + guaranteed-relay-per-phase logic -
        // split out for the same single-responsibility reason as P4FakeOutcomePicker (see
        // PhasePatternSelector's own remark for the full mechanism).
        private readonly PhasePatternSelector _patternSelector = new PhasePatternSelector();

        public bool AutoPlayEnabled => autoPlayEnabled;

        /// <summary>GDD §5.1 live phase, read from <see cref="phaseTracker"/> (which derives
        /// it from the monster's actual HP). Falls back to phase 1 if no tracker is wired
        /// (e.g. a test fixture that only cares about TriggerPatternById).</summary>
        public int CurrentPhase => phaseTracker != null ? phaseTracker.CurrentPhase : 1;

        /// <summary>Bookkeeping-only holder so a step's parallel beats/zones can report
        /// completion back to the driving coroutine without a per-beat delegate/lambda
        /// allocation.</summary>
        private class BeatGroup
        {
            public int Remaining;
        }

        private void Start()
        {
            _repeatWait = new WaitForSeconds(repeatIntervalSeconds);
            _repeatWaitPhase3 = new WaitForSeconds(repeatIntervalSecondsPhase3);
            if (patternSheet != null)
            {
                StartCoroutine(DriveLoop());
            }
        }

        public void SetAutoPlayEnabled(bool enabled)
        {
            autoPlayEnabled = enabled;
        }

        /// <summary>Called once by HuntCompletionController when the monster's HP reaches
        /// 0 (this task's brief: "stop the pattern-drive loop cleanly (no orphaned
        /// coroutines/markers)"). Stops DriveLoop AND every in-flight beat/zone coroutine
        /// this MonoBehaviour owns (StopAllCoroutines - same technique already used by
        /// LampangP4P5P7ScenePlayModeTests to isolate a manually-driven pattern), then
        /// destroys any marker/zone still on screen so nothing interactable is left
        /// orphaned after the hunt ends.</summary>
        public void StopHunt()
        {
            autoPlayEnabled = false;
            StopAllCoroutines();

            foreach (var marker in FindObjectsByType<ParryMarker>(FindObjectsSortMode.None))
            {
                Destroy(marker.gameObject);
            }
            foreach (var zone in FindObjectsByType<DodgeZone>(FindObjectsSortMode.None))
            {
                Destroy(zone.gameObject);
            }
            foreach (var rush in FindObjectsByType<RushZone>(FindObjectsSortMode.None))
            {
                Destroy(rush.gameObject);
            }
        }

        /// <summary>Dev/QA escape hatch (this task's brief: "each of P2-P7 can be triggered
        /// and observed independently"). Bypasses the auto-cycle's C4_Groggy gate - in
        /// REAL play (DriveLoop), C4_Groggy is only reachable via a successful C3_Relay
        /// chain (see ExecuteStep below); this method exists specifically so QA does not
        /// have to grind a full relay just to observe P7 in isolation.</summary>
        public void TriggerPatternById(string patternId)
        {
            if (patternSheet == null || patternSheet.steps == null)
            {
                return;
            }
            foreach (var step in patternSheet.steps)
            {
                if (step != null && step.patternId == patternId)
                {
                    StartCoroutine(ExecuteStep(step, calledDirectly: true));
                    return;
                }
            }
            Debug.LogWarning($"[MonsterPatternPlayer] No pattern step with id '{patternId}' found on the sheet.");
        }

        /// <summary>Dev/QA-only: forces the NEXT P4 execution to resolve real or fake
        /// instead of the normal 50/50 randomness, so the fake-vs-real behavior can be
        /// demonstrated deterministically. Consumed once, then reverts to random.</summary>
        public void ForceNextP4Outcome(bool isReal)
        {
            _p4FakeOutcomePicker.ForceNext(isReal);
        }

        /// <summary>GDD §5.1 real hunt session: repeatedly asks <see cref="_patternSelector"/>
        /// for the next phase-appropriate step (live phase from <see cref="phaseTracker"/>)
        /// and executes it. Stops entirely once the monster is depleted - HuntCompletionController
        /// calls <see cref="StopHunt"/>, which StopAllCoroutines()'s this loop away; the extra
        /// CurrentHP guard below is a defensive belt-and-suspenders so a pattern is never
        /// freshly picked against an already-dead monster even in the single frame between
        /// HP hitting 0 and StopHunt() actually landing.</summary>
        private IEnumerator DriveLoop()
        {
            while (true)
            {
                if (!autoPlayEnabled || (monsterHealth != null && monsterHealth.CurrentHP <= 0))
                {
                    yield return null;
                    continue;
                }

                int phase = CurrentPhase;
                var step = _patternSelector.PickNext(phase, patternSheet.steps);
                if (step == null)
                {
                    yield return null;
                    continue;
                }

                yield return StartCoroutine(ExecuteStep(step));
                yield return phase >= 3 ? _repeatWaitPhase3 : _repeatWait;
            }
        }

        private IEnumerator ExecuteStep(MonsterPatternStep step, bool calledDirectly = false)
        {
            if (!calledDirectly && step.classification == PatternClass.C4_Groggy)
            {
                // GDD §7.2 P7 row ("예고: P5 성공 시") + this task's brief (MUST): C4_Groggy
                // is only reachable via a successful C3_Relay chain in real play - never the
                // normal auto-cycling DriveLoop. calledDirectly=true is the explicit dev/QA
                // escape hatch (TriggerPatternById) for independent observation.
                Debug.LogWarning($"[MonsterPatternPlayer] '{step.displayName}' is C4_Groggy and only reachable via a successful relay in normal play - skipping in auto-cycle.");
                yield break;
            }

            switch (step.classification)
            {
                case PatternClass.C1_Basic:
                    if (step.isFakeVariant)
                    {
                        yield return StartCoroutine(ExecuteC1FakeVariant(step));
                    }
                    else
                    {
                        yield return StartCoroutine(ExecuteC1Basic(step));
                    }
                    break;
                case PatternClass.C2_HeavyAttack:
                case PatternClass.C5_CastAoE:
                    yield return StartCoroutine(ExecuteDodgeZonePattern(step));
                    break;
                case PatternClass.C3_Relay:
                    yield return StartCoroutine(ExecuteC3Relay(step));
                    break;
                case PatternClass.C4_Groggy:
                    yield return StartCoroutine(ExecuteC4Groggy(step));
                    break;
            }
        }

        // ── C1_Basic (plain) - unchanged from T001 ─────────────────────────────────

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
            ApplyFailureDamageForSeverity(step.failureSeverity);
        }

        private void ApplyFailureDamageForSeverity(FailureSeverity severity)
        {
            if (playerHealth == null || demoNumbers == null)
            {
                return;
            }
            // Number lookup lives in FailureDamageResolver, not here - see that class's
            // remark for why this was split out of MonsterPatternPlayer.
            int damage = FailureDamageResolver.Resolve(severity, demoNumbers);
            playerHealth.TakeDamage(damage);
        }

        // ── C1_Basic, P4 fake variant - GDD §7.2 ('C-1 변형') ──────────────────────

        private IEnumerator ExecuteC1FakeVariant(MonsterPatternStep step)
        {
            if (partRegistry == null || parryMarkerTemplate == null || gameplayConfig == null ||
                demoNumbers == null || step.parryBeats == null || step.parryBeats.Length == 0)
            {
                yield break;
            }

            var anchor = partRegistry.GetPartTransform(step.anchorPartId);
            if (anchor == null)
            {
                Debug.LogWarning($"[MonsterPatternPlayer] anchor part '{step.anchorPartId}' not found for step '{step.displayName}'.");
                yield break;
            }

            bool isReal = _p4FakeOutcomePicker.ResolveIsReal();
            // GDD §7.2 P4 MUST: the tell lives ONLY in monster animation - played BEFORE
            // the marker spawns, same as the real telegraph would read.
            if (cheekTellAnimator != null)
            {
                cheekTellAnimator.PlayTell(isReal);
            }

            var beat = step.parryBeats[0];
            float stepStartTime = Time.time;
            float targetTime = stepStartTime + beat.beatOffsetSeconds;
            float spawnTime = targetTime - Mathf.Max(0.01f, beat.telegraphLeadSeconds);
            float waitSeconds = spawnTime - Time.time;
            if (waitSeconds > 0f)
            {
                yield return new WaitForSeconds(waitSeconds);
            }

            var marker = Instantiate(parryMarkerTemplate, markerLayer);
            marker.gameObject.SetActive(true);
            marker.transform.position = anchor.position;
            // Deliberately the SAME call shape as a real beat (no color/shape branch on
            // isReal) - GDD MUST: the marker itself carries no real/fake tell.
            marker.Initialize(gameplayConfig, targetTime, beat.telegraphLeadSeconds);

            if (isReal)
            {
                while (!marker.IsResolved)
                {
                    yield return null;
                }
                ApplyJudgment(step, marker.Result);
                yield break;
            }

            // FAKE: dissolve before target time unless tapped early. dissolveLead is
            // self-enforcing (always > the live good window, read from config) so an
            // early tap on a fake can never land inside a real judgment band and be
            // mistaken for a genuine parry.
            float goodWindow = gameplayConfig.goodWindowSeconds;
            float dissolveLead = Mathf.Max(demoNumbers.p4FakeDissolveLeadFloorSeconds,
                goodWindow + demoNumbers.p4FakeDissolveLeadMarginSeconds);
            float dissolveTime = targetTime - dissolveLead;

            while (!marker.IsResolved && Time.time < dissolveTime)
            {
                yield return null;
            }

            if (marker.IsResolved)
            {
                // Tapped before the dissolve point = early tap on a fake -> counter-hit.
                // GDD §7.2 P4: "가짜 조기 탭 시 카운터 피격".
                ApplyFailureDamageForSeverity(FailureSeverity.Counter);
                if (combo != null) combo.RegisterHit();
            }
            else
            {
                // Correctly held back - neither a hit nor a parry. No damage, combo untouched.
                marker.DissolveAsFake();
            }
        }

        // ── C2_HeavyAttack / C5_CastAoE - IN-3 dodge zones (P3/P6) ─────────────────

        private IEnumerator ExecuteDodgeZonePattern(MonsterPatternStep step)
        {
            if (dodgeZoneTemplate == null || battlefieldPanel == null || playerToken == null)
            {
                yield break;
            }

            float windowSeconds = ResolveDodgeWindowSeconds(step);
            int count = Mathf.Max(1, step.dodgeZoneCount);
            float halfWidth = Mathf.Max(0f, battlefieldPanel.rect.width * 0.5f - dodgeZoneRadiusPixels);

            var group = new BeatGroup { Remaining = count };
            for (int i = 0; i < count; i++)
            {
                float x = count == 1
                    // GDD §7.2 P3: "존 위치 좌우 랜덤" - single zone, left or right of center.
                    ? (Random.value < 0.5f ? -1f : 1f) * Mathf.Min(halfWidth, dodgeZoneSingleOffsetPixels)
                    // GDD §7.2 P6: "다중 낙하점" - multiple scattered fall points.
                    : Random.Range(-halfWidth, halfWidth);

                StartCoroutine(SpawnDodgeZone(step, x, windowSeconds, group));
            }

            while (group.Remaining > 0)
            {
                yield return null;
            }
        }

        /// <summary>Optionally shows the P3 ground-line telegraph (GDD §7.2 '예고: 지면
        /// 붉은 라인' - see GroundTelegraphLine/MonsterPatternStep.showGroundTelegraphLine)
        /// for <see cref="groundTelegraphLeadSeconds"/> BEFORE the dodge zone itself
        /// spawns at the same x position, then hands off to RunDodgeZone as before.</summary>
        private IEnumerator SpawnDodgeZone(MonsterPatternStep step, float x, float windowSeconds, BeatGroup group)
        {
            if (step.showGroundTelegraphLine)
            {
                GroundTelegraphLine.Spawn(battlefieldPanel, x, groundTelegraphLeadSeconds);
                yield return new WaitForSeconds(groundTelegraphLeadSeconds);
            }

            var zone = Instantiate(dodgeZoneTemplate, battlefieldPanel);
            zone.gameObject.SetActive(true);
            var zoneRect = (RectTransform)zone.transform;
            zoneRect.anchoredPosition = new Vector2(x, 0f);
            zone.Initialize(windowSeconds, dodgeZoneRadiusPixels, playerToken, battlefieldPanel);

            yield return StartCoroutine(RunDodgeZone(step, zone, group));
        }

        private IEnumerator RunDodgeZone(MonsterPatternStep step, DodgeZone zone, BeatGroup group)
        {
            while (!zone.IsResolved)
            {
                yield return null;
            }
            if (zone.Result == DodgeResult.Miss)
            {
                // GDD §7.2 P3 실패: "중피해+넉백" - medium damage (via failureSeverity)
                // PLUS a knockback move away from the zone when the step opts in.
                // P6 실패: "다단 소피해" - reuses the small-failure number per zone, no
                // knockback (knockbackOnDodgeFailure defaults/stays false on P6).
                ApplyFailureDamageForSeverity(step.failureSeverity);
                if (step.knockbackOnDodgeFailure && playerToken != null)
                {
                    playerToken.KnockbackAwayFrom(zone.LocalPosition, dodgeFailureKnockbackDistancePixels);
                }
            }
            group.Remaining--;
        }

        private float ResolveDodgeWindowSeconds(MonsterPatternStep step)
        {
            if (gameplayConfig == null)
            {
                return 1f;
            }
            // GDD §4.3: dodge-zone display duration is pattern-specific (not a shared
            // judgment window) - §12 names these per pattern (dodge.zone.p3.window,
            // cast.p6.window). Which one applies is a DATA choice authored on the step
            // (MonsterPatternStep.dodgeZoneWindowSource), never inferred from patternId -
            // see that enum's remark for why.
            return step.dodgeZoneWindowSource switch
            {
                DodgeZoneWindowSource.CastP6Window => gameplayConfig.castP6WindowSeconds,
                _ => gameplayConfig.dodgeZoneP3WindowSeconds
            };
        }

        // ── C3_Relay - solo substitute sequence (GDD §5.2), P5 ─────────────────────

        private IEnumerator ExecuteC3Relay(MonsterPatternStep step)
        {
            if (partRegistry == null || parryMarkerTemplate == null || gameplayConfig == null ||
                step.parryBeats == null || step.parryBeats.Length == 0)
            {
                yield break;
            }

            var anchor = partRegistry.GetPartTransform(step.anchorPartId);
            if (anchor == null)
            {
                Debug.LogWarning($"[MonsterPatternPlayer] anchor part '{step.anchorPartId}' not found for step '{step.displayName}'.");
                yield break;
            }

            // GDD §5.2: solo substitute for C-3 relay = a 2-3 tap CONSECUTIVE sequence
            // (NOT real party networking) - reuses MonsterPatternStep.parryBeats as the
            // sequence, run SEQUENTIALLY (not parallel like C1): a missed link ends the
            // whole relay immediately, matching §5.2's "무임승차 구조적 차단" spirit.
            //
            // Window: GDD §4.3 names relay.solo.window (±0.35s) for THIS solo substitute
            // specifically, distinct from relay.party.window (±0.5s/인, real party mode -
            // not built in P0). §4.3's own rationale ("파티가 더 쉬워야 한다는 원칙(P-3) 유지")
            // requires solo to be STRICTER than party, so this reads relaySoloWindowSeconds
            // here, not the party number - see this class's remark and the QA report for
            // the full reasoning (this resolves an apparent tension between this task's
            // brief text and GDD §4.3; GDD wins per this task's own tie-break rule).
            float window = gameplayConfig.relaySoloWindowSeconds;
            float stepStartTime = Time.time;
            bool allSucceeded = true;

            for (int i = 0; i < step.parryBeats.Length; i++)
            {
                var beat = step.parryBeats[i];
                float targetTime = stepStartTime + beat.beatOffsetSeconds;
                float spawnTime = targetTime - Mathf.Max(0.01f, beat.telegraphLeadSeconds);
                float waitSeconds = spawnTime - Time.time;
                if (waitSeconds > 0f)
                {
                    yield return new WaitForSeconds(waitSeconds);
                }

                var marker = Instantiate(parryMarkerTemplate, markerLayer);
                marker.gameObject.SetActive(true);
                marker.transform.position = anchor.position;
                // Red relay channel (GDD §6.2: "릴레이 마커: 붉은 링") + single relay.solo.window
                // band - passing the SAME value for perfect/good collapses Good to
                // unreachable, which is correct: relay per §4.3 is one pass/fail band, not
                // a two-tier judgment.
                marker.Initialize(gameplayConfig, targetTime, beat.telegraphLeadSeconds,
                    markerColorOverride: GameplayColors.Relay,
                    perfectWindowOverrideSeconds: window,
                    goodWindowOverrideSeconds: window);

                while (!marker.IsResolved)
                {
                    yield return null;
                }

                if (marker.Result == ParryJudgment.Miss)
                {
                    allSucceeded = false;
                    break;
                }

                if (combo != null) combo.RegisterPerfect();
            }

            if (!allSucceeded)
            {
                // GDD §7.2 P5 실패: "전원 소피해 (완화형)" - solo reading: the player takes
                // the small-failure number.
                ApplyFailureDamageForSeverity(FailureSeverity.Small);
                yield break;
            }

            if (step.triggeredOnSuccess != null)
            {
                // GDD §7.2 P7: "예고: P5 성공 시" - the ONLY way C4_Groggy is reachable in
                // real (non-demo-triggered) play.
                yield return StartCoroutine(ExecuteStep(step.triggeredOnSuccess, calledDirectly: true));
            }
        }

        // ── C4_Groggy - IN-6 rush (P7) ──────────────────────────────────────────────

        private IEnumerator ExecuteC4Groggy(MonsterPatternStep step)
        {
            if (rushZoneTemplate == null || partRegistry == null || gameplayConfig == null || monsterHealth == null)
            {
                yield break;
            }

            var anchor = partRegistry.GetPartTransform(step.anchorPartId);
            if (anchor == null)
            {
                Debug.LogWarning($"[MonsterPatternPlayer] anchor part '{step.anchorPartId}' not found for step '{step.displayName}'.");
                yield break;
            }

            var zone = Instantiate(rushZoneTemplate, markerLayer);
            zone.gameObject.SetActive(true);
            zone.transform.position = anchor.position;
            zone.Initialize(gameplayConfig.groggyRushDurationSeconds, step.rushRequiredTaps);

            bool done = false;
            void HandleTapLanded(RushZone rushZone)
            {
                // IN-6: reuses IN-1's basicAttackDamage per landed tap - it is still
                // fundamentally "a tap that hits the monster", not a new mechanic that
                // needs its own invented number (GDD implies equivalence).
                if (demoNumbers != null)
                {
                    monsterHealth.TakeDamage(demoNumbers.basicAttackDamage);
                }
            }
            void HandleDone(RushZone rushZone) => done = true;

            zone.OnTapLanded += HandleTapLanded;
            zone.OnFinished += HandleDone;
            zone.OnExpired += HandleDone;

            while (!done)
            {
                yield return null;
            }

            zone.OnTapLanded -= HandleTapLanded;
            zone.OnFinished -= HandleDone;
            zone.OnExpired -= HandleDone;
        }
    }
}
