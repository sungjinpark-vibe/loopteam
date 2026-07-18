using System.Collections.Generic;
using UnityEngine;
using TouchRPG.Combat.Config;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// GDD §5.1: picks the next pattern step for MonsterPatternPlayer's real-play drive
    /// loop, honoring each phase's composition/eligibility rules. Plain C# class (no
    /// MonoBehaviour/ScriptableObject needed - same reasoning as P4FakeOutcomePicker):
    /// it holds only short-lived per-hunt state and has no scene lifecycle, which also
    /// makes it directly unit-testable without a scene (see PhasePatternSelectorTests).
    ///
    /// Two responsibilities, kept together because they share the same phase-transition
    /// state machine:
    ///
    /// 1. ELIGIBILITY GATES (<see cref="IsSelectable"/>, MUST per this task's brief,
    ///    re-derived from GDD §5.1 regardless of how a step asset's own minPhase is
    ///    authored - defense in depth, not a duplicate source of truth): phase 1 never
    ///    selects a fake (P4) or a relay (P5); phase 2 unlocks relay; phase 3 unlocks
    ///    fakes. C4_Groggy is NEVER directly selectable - it is reachable only via a
    ///    successful C3_Relay chain (MonsterPatternPlayer.ExecuteC3Relay), same as
    ///    before this task.
    ///
    /// 2. COMPOSITION WEIGHTS (team discretion per GDD §0 - the brief explicitly leaves
    ///    "the exact selection algorithm" to the team while making the eligibility gates
    ///    themselves MUST): phase 1 uses GDD §5.1's own numbers verbatim (C-1 ~70% /
    ///    C-2 ~30%). Phase 2/3 numbers are NOT given by the GDD beyond qualitative
    ///    composition notes, so this class's bucket weights are a documented judgment
    ///    call, reported as provisional in docs/qa/P0-provisional-gameplay-numbers-REPORT.md
    ///    like every other non-GDD number in this codebase. The weights themselves (and the
    ///    phase-3 pity interval) are externalized into <see cref="PhasePatternWeights"/> (a
    ///    ScriptableObject, GDD §0 MUST) rather than hardcoded here - this class only owns
    ///    the selection ALGORITHM that consumes them.
    ///
    /// GUARANTEE MECHANISM (GDD §5.1 MUST: "페이즈 전환마다 그로기 러시(C-4)를 최소 1회
    /// 보장한다") - chosen mechanism: FORCED INJECTION, not a pity counter, for the
    /// per-phase-entry guarantee. The moment a phase transition into 2 or 3 is observed
    /// (<see cref="EnterPhase"/>), the very NEXT pick is forced to be the relay step
    /// (P5) instead of going through the weighted pool - since C4_Groggy is only
    /// reachable via a successful relay, forcing the relay ATTEMPT to happen early in
    /// the phase is what makes the groggy rush opportunity guaranteed rather than left
    /// to chance (a weighted random draw could, by bad luck, never pick relay before the
    /// phase ends). Phase 2 additionally respects GDD §5.1's "1회 한정" cap: once that
    /// forced attempt is spent, C3_Relay is excluded from the phase-2 pool for the rest
    /// of the phase. Phase 3 has no such cap (§5.1: "2~3회"), so on top of its own forced
    /// entry-pick this class ALSO runs a pity counter (<see cref="PhasePatternWeights.relayPityIntervalPhase3"/>)
    /// that re-forces another relay attempt after enough non-relay picks pass, so
    /// multiple relay (and therefore potential groggy-rush) opportunities keep recurring
    /// across the phase instead of depending purely on the small organic weight.
    ///
    /// IMPORTANT: "guaranteed" here means the relay ATTEMPT is deterministically
    /// scheduled - it does NOT mean the relay auto-succeeds. Whether it succeeds (and
    /// therefore whether the groggy rush actually triggers) still depends on the
    /// player's tap timing, exactly like every other judgment in this game (GDD P-1:
    /// "실력은 회피와 리듬이다"). Auto-granting success would remove player skill from the
    /// one MUST-guaranteed moment per phase, which would be a worse violation of the
    /// GDD than leaving success to input. See this task's QA report for how this was
    /// verified (a correctly-timed relay tap sequence, same as the existing P5 tests).
    /// </summary>
    public class PhasePatternSelector
    {
        // Externalized (T004 fix, GDD §0 MUST): weights + pity interval now live on a
        // ScriptableObject asset instead of const/static readonly fields on this class -
        // see PhasePatternWeights for the values and the per-field GDD-sourced-vs-provisional
        // rationale. Required (non-null) constructor argument, not a default-null field, so
        // a caller cannot silently forget to wire a real asset.
        private readonly PhasePatternWeights _weights;

        public PhasePatternSelector(PhasePatternWeights weights)
        {
            _weights = weights != null ? weights : ScriptableObject.CreateInstance<PhasePatternWeights>();
        }

        private int _trackedPhase;
        private bool _phase2RelayConsumed;
        private int _picksSinceRelayPhase3;
        private bool _forceRelayNextPick;

        /// <summary>Test/diagnostic seam - true when the NEXT PickNext call is committed
        /// to forcing a relay attempt (either the phase-entry guarantee or the phase-3
        /// pity counter).</summary>
        public bool ForceRelayPending => _forceRelayNextPick;

        /// <summary>GDD §5.1 eligibility gates, re-derived from phase + classification
        /// (not solely trusted from a step asset's own minPhase - defense in depth so a
        /// future data-authoring mistake cannot silently violate a MUST). Public/static
        /// so it can be unit tested directly and reused wherever eligibility needs
        /// checking (e.g. MonsterPatternPlayer's TriggerPatternById intentionally does
        /// NOT call this - the dev/QA escape hatch bypasses phase gating on purpose).</summary>
        public static bool IsSelectable(MonsterPatternStep step, int phase)
        {
            if (step == null)
            {
                return false;
            }
            if (phase < step.minPhase)
            {
                return false;
            }
            switch (step.classification)
            {
                case PatternClass.C4_Groggy:
                    // Only reachable via a successful C3_Relay chain - never picked directly.
                    return false;
                case PatternClass.C3_Relay:
                    // GDD §5.1 MUST: phase 1 forbids relay outright.
                    return phase >= 2;
                case PatternClass.C1_Basic:
                    if (step.isFakeVariant)
                    {
                        // GDD §5.1 MUST: fakes forbidden before phase 3 ("페이크 해금" only phase 3).
                        return phase >= 3;
                    }
                    return true;
                default:
                    return true;
            }
        }

        /// <summary>Picks the next step to run for the given live phase. Returns null if
        /// nothing is eligible (caller should simply wait a frame and retry, same as the
        /// old empty-eligible-list behavior).</summary>
        public MonsterPatternStep PickNext(int phase, IReadOnlyList<MonsterPatternStep> allSteps)
        {
            if (allSteps == null || allSteps.Count == 0)
            {
                return null;
            }
            if (phase != _trackedPhase)
            {
                EnterPhase(phase);
            }

            if (_forceRelayNextPick)
            {
                var forcedRelay = FindFirstSelectable(allSteps, phase, PatternClass.C3_Relay, fakeVariant: false);
                if (forcedRelay != null)
                {
                    _forceRelayNextPick = false;
                    if (phase == 2)
                    {
                        _phase2RelayConsumed = true;
                    }
                    _picksSinceRelayPhase3 = 0;
                    return forcedRelay;
                }
                // No relay step authored on the sheet at all - do not stall the hunt
                // forever waiting for something that cannot exist; fall through to the
                // organic pool instead.
                _forceRelayNextPick = false;
            }

            var pool = BuildWeightedPool(phase, allSteps);
            var picked = WeightedPick(pool);
            if (picked == null)
            {
                return null;
            }

            if (phase == 3)
            {
                if (picked.classification == PatternClass.C3_Relay)
                {
                    _picksSinceRelayPhase3 = 0;
                }
                else
                {
                    _picksSinceRelayPhase3++;
                    if (_picksSinceRelayPhase3 >= _weights.relayPityIntervalPhase3)
                    {
                        _forceRelayNextPick = true;
                    }
                }
            }

            return picked;
        }

        private void EnterPhase(int phase)
        {
            _trackedPhase = phase;
            _phase2RelayConsumed = false;
            _picksSinceRelayPhase3 = 0;
            // GDD §5.1 MUST guarantee: force the very first pick of phase 2/3 to be the
            // relay attempt (see class remark for the full mechanism/rationale). Phase 1
            // has no relay at all, so nothing to force there.
            _forceRelayNextPick = phase == 2 || phase == 3;
        }

        private List<(MonsterPatternStep step, float weight)> BuildWeightedPool(int phase, IReadOnlyList<MonsterPatternStep> allSteps)
        {
            BucketWeight[] buckets = phase switch
            {
                1 => _weights.phase1Weights,
                2 => _weights.phase2Weights,
                _ => _weights.phase3Weights,
            };

            var result = new List<(MonsterPatternStep, float)>();
            foreach (var bucket in buckets)
            {
                if (phase == 2 && bucket.Classification == PatternClass.C3_Relay && _phase2RelayConsumed)
                {
                    // GDD §5.1: phase 2 relay is "1회 한정" - already spent this phase.
                    continue;
                }

                var matches = new List<MonsterPatternStep>();
                foreach (var step in allSteps)
                {
                    if (step == null || step.classification != bucket.Classification || step.isFakeVariant != bucket.FakeVariant)
                    {
                        continue;
                    }
                    if (!IsSelectable(step, phase))
                    {
                        continue;
                    }
                    matches.Add(step);
                }
                if (matches.Count == 0)
                {
                    continue;
                }
                float perStepWeight = bucket.Weight / matches.Count;
                foreach (var step in matches)
                {
                    result.Add((step, perStepWeight));
                }
            }
            return result;
        }

        private static MonsterPatternStep WeightedPick(List<(MonsterPatternStep step, float weight)> pool)
        {
            if (pool.Count == 0)
            {
                return null;
            }
            float total = 0f;
            foreach (var entry in pool)
            {
                total += entry.weight;
            }
            if (total <= 0f)
            {
                return pool[0].step;
            }
            float roll = Random.value * total;
            float cumulative = 0f;
            foreach (var entry in pool)
            {
                cumulative += entry.weight;
                if (roll <= cumulative)
                {
                    return entry.step;
                }
            }
            return pool[pool.Count - 1].step;
        }

        private static MonsterPatternStep FindFirstSelectable(IReadOnlyList<MonsterPatternStep> allSteps, int phase, PatternClass classification, bool fakeVariant)
        {
            foreach (var step in allSteps)
            {
                if (step == null || step.classification != classification || step.isFakeVariant != fakeVariant)
                {
                    continue;
                }
                if (!IsSelectable(step, phase))
                {
                    continue;
                }
                return step;
            }
            return null;
        }
    }
}
