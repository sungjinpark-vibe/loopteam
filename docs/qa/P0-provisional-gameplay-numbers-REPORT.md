# P0 client-dev task report — provisional gameplay numbers (open questions to the planner)

- Task: P0 vertical slice — tap-parry loop (touchRPG)
- Author: client-dev
- Status: **NOT DECIDED** — every number below is a placeholder pending planner/director confirmation
- Source of truth: `docs/spec/00-gdd-v0.1.md`

## Why this report exists

GDD §0 (규약):

> 문서에 없는 수치가 필요한 경우: 게임플레이에 영향 없는 값 ... 은 MAY 재량으로 정하고 기록한다.
> 게임플레이에 영향 있는 값(판정, 데미지, 드랍률 등)은 MUST 기획자에게 질의한다.
> 불확실하면 질의한다. 그럴듯한 보간(hallucinated design)은 이 프로젝트에서 가장 경계하는 실패 모드다.

The P0 vertical slice cannot render an HP bar or show a hit landing without *some* concrete numbers
for monster/player HP and per-hit damage. None of these numbers exist anywhere in the GDD — not in
§12's constants appendix, not qualitatively beyond words like "소피해" (small damage) / "중피해"
(medium damage). This task runs without a synchronous channel to the planner mid-implementation, so
rather than silently inventing them, they were isolated into their own asset
(`Assets/Scripts/Combat/Config/P0DemoNumbers.cs`, `Assets/Data/Config/P0DemoNumbers.asset`) — kept
separate from `GameplayConfig.cs` (which holds only GDD-sourced §12 constants and the two `[TBD-1]`/
`[TBD-2]` values the GDD itself flags as pending) — and are reported here explicitly, as the GDD
requires.

**These are placeholders, not design decisions.** Do not treat any value below as final. This report is
the query the GDD requires; the PM should relay it to the director/planner for confirmation before P0's
"터치 패링이 손맛이 있는가" playtest is read as validating any of these specific numbers (the playtest
validates the *feel* of timing/parry, which does not depend on the exact HP/damage figures below — but
the figures themselves are still open).

## The five invented values — each a question to the planner

| # | Field (`P0DemoNumbers`) | Placeholder used | Why a number was needed now | Question for the planner |
|---|---|---|---|---|
| 1 | `monsterMaxHP` | 1000 | HP bar (§6.1 정보층) needs a denominator to render fill%/phase ticks at 70%/35%. | What is Lampang's actual max HP for P0? |
| 2 | `playerMaxHP` | 100 | Player must be able to take failure damage and (eventually) die/fail a hunt; needs a denominator. | What is the player's max HP for P0 (or is HP not player-facing yet — e.g. hunts don't fail on HP=0 in P0)? |
| 3 | `basicAttackDamage` | 5 | IN-1 (§4.1: "기본 공격. 부위별 판정 존재") has no damage number in the GDD. | What should a basic attack (IN-1) deal, and does it vary per monster part as "부위별 판정" implies, or is one flat number correct for P0? |
| 4 | `p1FailureDamageSmall` | 5 | Lampang P1 (§7.2) failure is specified only as "소피해" (small damage), no number. | What number (or % of player max HP) counts as "소피해" for P1's failure? |
| 5 | `failureDamageMedium` | 15 | Reserved for future patterns GDD-labeled "중피해" (P2/P3/P5 in §7.2) — not consumed by P1, kept here so `FailureSeverity.Medium` has somewhere real to point once those patterns are built (P0 only builds P1). | What number (or % of player max HP) counts as "중피해"? Also: is there a "대피해" tier for later patterns not yet named in §12? |

None of these were fabricated to "look plausible" — they are round, clearly-placeholder numbers
(1000 / 100 / 5 / 5 / 15) deliberately chosen to be easy to spot and swap, not tuned or justified as
game design. No other missing gameplay number (judgment windows, combo rules, drop rates) was invented
beyond these five — judgment windows come from GDD §12 verbatim via `GameplayConfig`, and TBD-1/TBD-2
(combo cap, damage curve) are separately labeled provisional per GDD §13 in `GameplayConfig.cs`, not
part of this report.

## Where these live in code

- `Assets/Scripts/Combat/Config/P0DemoNumbers.cs` — the ScriptableObject definition, each field
  tooltip-labeled "NOT SPECIFIED IN GDD — PLACEHOLDER PENDING DIRECTOR CONFIRMATION" and cross-referencing
  this report by path.
- `Assets/Data/Config/P0DemoNumbers.asset` — the actual instance wired into the scene (created by
  `Assets/Editor/SceneBuilder.cs`).
- Consumers: `Assets/Scripts/Combat/Core/MonsterController.cs` (basic attack damage),
  `Assets/Scripts/Combat/Pattern/MonsterPatternPlayer.cs` (failure damage by severity),
  `Assets/Editor/SceneBuilder.cs` (wires `monsterMaxHP`/`playerMaxHP` into the two `HealthController`
  instances at scene-build time).

## Other provisional values in this task (team discretion — not asking, reporting)

GDD §0 splits missing numbers into two buckets: gameplay-affecting (MUST ask — the five above) and
non-gameplay-affecting like staging/effect timing (MAY decide at team discretion, but record it). These
fall in the second bucket and were decided, not queried — listed here for completeness since the brief
asks every provisional value used to be reported:

| Field | Value | Why it's non-gameplay | Location |
|---|---|---|---|
| `PlayerToken.moveSpeedPixelsPerSecond` | 900 px/s | IN-4 movement pacing/feel only; the GDD says "이동" with no speed number and does not tie movement speed to any judgment/damage/drop outcome in P0. | `Assets/Scripts/Combat/Core/PlayerToken.cs` |
| `MonsterPatternPlayer.repeatIntervalSeconds` | 2.5s | P0 demo-driver pacing between repeated pattern steps — explicitly NOT the GDD §5.1 three-phase session system (a separate, larger task); exists only so the loop is repeatable/demonstrable now. | `Assets/Scripts/Combat/Pattern/MonsterPatternPlayer.cs` |

The two `[TBD-1]`/`[TBD-2]` values (combo stage cap, damage-multiplier curve) are **not** repeated here —
they are the GDD's own explicitly-named TBDs (§13), already labeled and reported inline in
`Assets/Scripts/Combat/Config/GameplayConfig.cs`.

## Ask

Planner/director: please confirm or replace the five gameplay-affecting values in the table above. Until
then they remain labeled provisional in code and should not be read as balance decisions. The two
"other provisional values" do not require sign-off (team discretion per GDD §0) but are listed for
transparency.

---

## Addendum — full P0 input grammar + Lampang P2-P7 (this task)

Source of truth for this addendum: `docs/spec/00-gdd-v0.3.md`. Same rule as above applies: every number
below is either (a) a genuinely new placeholder, reported as a fresh ask, or (b) an explicit REUSE of an
existing value/config field, documented so it is auditable rather than silently duplicated.

### Renamed field (not a new value)

`P0DemoNumbers.p1FailureDamageSmall` → **`failureDamageSmall`**. GDD §7.2 labels P1, P6 ("다단 소피해"),
and P5's mitigated failure ("전원 소피해") with the exact same word "소피해" - the field is reused across
all three per that qualitative equivalence, not duplicated, so it no longer makes sense named "p1-". The
asset (`Assets/Data/Config/P0DemoNumbers.asset`) was updated to match; no consumer duplicates the number.

### New value - genuinely new, no GDD equivalence (ask)

| # | Field (`P0DemoNumbers`) | Placeholder used | Why a number was needed now | Question for the planner |
|---|---|---|---|---|
| 6 | `chargeAttackDamage` | 25 | IN-5 (§4.1: "차지 공격... 고딜·고리스크") has no damage number, and unlike the failure-damage fields there is no GDD-implied equivalence to reuse - a charged hit is a new mechanic, not a re-description of an existing "실패 시" qualitative word. | What should a full IN-5 charge deal (flat number, or relative to basicAttackDamage)? |

### Reuse decisions (not new values - documented so they're auditable)

| Situation | Reused value | Rationale |
|---|---|---|
| P3 실패 (구르기 돌진, "중피해+넉백") | `failureDamageMedium` | GDD §7.2 says "중피해" verbatim - same word as P2, already covered by this field. Knockback distance itself is a staging/visual number, not built as a gameplay-affecting number in this task (see "other provisional" below). |
| P4 가짜 조기 탭 ("가짜 조기 탭 시 카운터 피격") | `failureDamageMedium` via `FailureSeverity.Counter` | GDD names no separate counter-hit number. A counter-hit reads as at least as punishing as a medium failure, so this reuses that tier rather than inventing a 6th number. Flagged here as a judgment call, not a silent invention - if the planner wants a distinct (likely harsher) counter number, `FailureSeverity.Counter`'s switch case in `MonsterPatternPlayer.ApplyFailureDamageForSeverity` is the one place to change it. |
| P6 실패 (도토리 비, "다단 소피해", per zone) | `failureDamageSmall` | Same "소피해" word as P1. |
| P5 실패 (대회전 꼬리, "전원 소피해 (완화형)") | `failureDamageSmall` | Same "소피해" word as P1; solo reading (no party to split "전원" across). |
| IN-6 러시 (P7) per-tap monster damage | `basicAttackDamage` | A rush tap is still fundamentally "a tap landing on the monster" - GDD implies equivalence to IN-1, not a new number. |
| IN-5 quick-tap fallback (hold released before the charge threshold) | `basicAttackDamage` | Falls through to the ordinary IN-1 path (`MonsterPart.RaiseBasicAttack`) rather than a separate "aborted charge" number. |

### P5 judgment window - a resolved tension between this task's brief and GDD §4.3 (not a TBD, a documented reading)

GDD §7.2's P5 row prints "윈도우: 각 ±0.5s" (the party relay window). GDD §4.3 separately and explicitly
names **relay.solo.window = ±0.35s** for "릴레이 대체 시퀀스 (솔로)" - exactly the mechanic this task
builds (§5.2: solo has no party, so it substitutes a 2-3 tap sequence) - and gives the reason: "파티가
더 쉬워야 한다는 원칙(P-3) 유지" (party must be easier than solo). Implementing P5's solo substitute with
the party number (±0.5s, easier) would invert that principle. This task's own instructions say GDD wins
on a disagreement with the brief, so `MonsterPatternPlayer.ExecuteC3Relay` reads
**`GameplayConfig.relaySoloWindowSeconds`** (±0.35s) for the live per-tap judgment band, and leaves
`relayPartyWindowPerPersonSeconds` (±0.5s) as the reserved seam for a real (future, P1+) party
implementation. Both numbers are still read from `GameplayConfig`, never hardcoded, either way - flagging
this here so the planner can override the reading if the ±0.5s framing was intentional after all.

### Other provisional values (team discretion - not asking, reporting, per GDD §0's non-gameplay bucket)

| Field | Value | Why it's non-gameplay | Location |
|---|---|---|---|
| `PlayerToken.dashSpeedMultiplier` | 4x | IN-3 dash feel only - GDD names an "automatic dash" with no speed number. | `PlayerToken.cs` |
| `ChargeAttackController.minHoldSecondsForCharge` | 0.35s | Threshold between "quick tap = IN-1" and "hold = IN-5 charge". Affects feel/pacing, not a judgment window or damage figure. | `ChargeAttackController.cs` |
| `ChargeAttackController.fullChargeSeconds` | 1.2s | Visual gauge pacing only - does not gate whether a charge counts (that's minHoldSecondsForCharge). | `ChargeAttackController.cs` |
| `MonsterPatternPlayer.dodgeZoneRadiusPixels` | 130px | Zone size/dash-clear-distance, staging only. | `MonsterPatternPlayer.cs` |
| `MonsterPatternPlayer.dodgeZoneSingleOffsetPixels` | 280px | How far left/right of center P3's single zone spawns. | `MonsterPatternPlayer.cs` |
| `MonsterPatternStep.dodgeZoneCount` (P6 asset value) | 3 | "다중 낙하점" - GDD names no exact count. | `Assets/Data/Patterns/Lampang_P6_AcornRain.asset` |
| `MonsterPatternStep.rushRequiredTaps` (P7 asset value) | 8 | Taps needed to fill the IN-6 gauge - GDD names no number, only "the only mash-rewarded window". | `Assets/Data/Patterns/Lampang_P7_BellyFlipGroggy.asset` |
| P4 real/fake ratio | 50/50 (`Random.value < 0.5f`) | GDD names no fake frequency, only the qualitative "참는 판단 요구" rhythm note. Overridable per-call via `MonsterPatternPlayer.ForceNextP4Outcome` for deterministic demo/QA. | `MonsterPatternPlayer.ExecuteC1FakeVariant` |
| P3/P4/P5/P6 `ParryBeat`/relay beat offsets and telegraph leads | e.g. P2 = 1.75s, P4 = 1.2s, P5 = 1.0/2.2/3.4s | Same category as P1's existing beat timings (already flagged provisional in `ParryBeat.cs`) - rhythm/pacing, not judgment numbers. | `Assets/Data/Patterns/Lampang_P2..P7*.asset` |
| `MonsterPatternPlayer.dodgeFailureKnockbackDistancePixels` | 160px | GDD §7.2 P3 실패 ("중피해+넉백") names knockback qualitatively but gives no distance/force number. `PlayerToken.KnockbackAwayFrom` reuses the existing dash-speed channel (`dashSpeedMultiplier`, already reported above) for pacing, so only the distance is a new staging value. Round-2 fix (was previously flagged as a scope gap, not built - now built). | `MonsterPatternPlayer.cs` |
| `MonsterPatternPlayer.groundTelegraphLeadSeconds` | 0.3s | GDD §7.2 P3's "예고" column ("지면 붉은 라인") is now built as `GroundTelegraphLine`, shown briefly before the dodge zone spawns. GDD names no lead-time number for this pre-roll; purely cosmetic pacing, does not change the zone's own judgment window (still `dodgeZoneP3WindowSeconds`, unchanged). Round-2 fix (was previously flagged not built). Color tie-break (blue, not the row text's literal "붉은"/red) documented on `GroundTelegraphLine` and `MonsterPatternStep.showGroundTelegraphLine` - §4.5's fixed C-2=blue channel mapping is treated as canonical over §7.2's informal row prose, since §4.5 explicitly states the 4-channel mapping is MUST/고정 and red is reserved for C-3/relay. | `MonsterPatternPlayer.cs`, `GroundTelegraphLine.cs` |

### T004 fix - previously un-reported inline literals, now externalized (ask)

Gate 2 review of T002 flagged that `MonsterPatternPlayer.ExecuteC1FakeVariant`'s dissolve-lead formula
for P4 (볼주머니 페이크) used two inline literals that were never added to this report, violating GDD §0
the same way the values above were correctly reported. This fix relocates them into `P0DemoNumbers`
alongside the rest of this report's provisional values — **the numbers themselves are unchanged**, only
their location moved from inline code to the config asset.

| # | Field (`P0DemoNumbers`) | Placeholder used | Why a number was needed now | Question for the planner |
|---|---|---|---|---|
| 7 | `p4FakeDissolveLeadFloorSeconds` | 0.5s | Lower bound on how early a P4 fake marker must dissolve relative to its would-be judgment time, so an early tap on a fake can never fall inside a real judgment band. GDD §7.2 gives the qualitative outcome ("가짜 조기 탭 시 카운터 피격") but no timing number. | Is 0.5s the right floor, or should it scale with `goodWindowSeconds` differently? |
| 8 | `p4FakeDissolveLeadMarginSeconds` | 0.15s | Margin added on top of the live `goodWindowSeconds` in `Mathf.Max(p4FakeDissolveLeadFloorSeconds, goodWindow + p4FakeDissolveLeadMarginSeconds)` — ensures the dissolve point tracks the judgment window's actual size, not just the fixed floor. GDD §7.2 gives no number for this margin. | Is 0.15s the right safety margin above `goodWindowSeconds`? |

Both fields are used together in `MonsterPatternPlayer.ExecuteC1FakeVariant` (line ~358) as
`Mathf.Max(demoNumbers.p4FakeDissolveLeadFloorSeconds, goodWindow + demoNumbers.p4FakeDissolveLeadMarginSeconds)`
— the formula itself is unchanged from T002, only its data source moved from inline literals to this
config asset.

### TBD list - unchanged

TBD-1/TBD-2/TBD-11/TBD-12/TBD-13 are not touched by this task, per the task's own instruction that they
are the director's alone.

---

## Addendum 2 - GDD §5.1 real hunt-session task (phase transitions, phase-weighted selection, hunt completion)

Source of truth for this addendum: `docs/spec/00-gdd-v0.4.md` §5.1-§5.3, §6.1. Same rule as above: every
number below is either (a) a genuinely new placeholder, reported as team-discretion (non-gameplay-affecting
per GDD §0's own split), or (b) an explicit reuse of an existing config value. No gameplay-affecting number
(judgment, damage, drop rate) was invented for this task - the phase HP boundaries (70%/35%) and the groggy
rush guarantee itself are both already GDD §5.1 MUST values, read from the existing `GameplayConfig`
(`phaseBoundaryHighPercent`/`phaseBoundaryLowPercent`) unchanged.

### New provisional values (team discretion - not asking, reporting)

| Field | Value | Why it's non-gameplay | Location |
|---|---|---|---|
| `MonsterPatternPlayer.repeatIntervalSecondsPhase3` | 1.2s | GDD §5.1 phase 3: "패턴 밀도 최대" (maximum pattern density) names no exact number, only the qualitative direction ("shorter gaps than earlier phases"). Same category as the existing `repeatIntervalSeconds` (2.5s, used for phase 1/2) already reported above - pure pacing between pattern-step executions, not a judgment/damage number. | `MonsterPatternPlayer.cs` |
| `PhasePatternWeights.relayPityIntervalPhase3` | 3 (non-relay picks) | This task's brief explicitly calls for a "guarantee" mechanism and names "a pity-counter" as one acceptable option (either is fine, per the brief) - GDD gives no number for how often relay should recur within phase 3 beyond the qualitative "2~3회". This constant governs how many non-relay picks pass before the pity counter forces another relay attempt. | `PhasePatternWeights.cs` (relocated by T004 from a `const` on `PhasePatternSelector.cs` - GDD §0 MUST: gameplay constants live in a ScriptableObject, never hardcoded in logic. Value unchanged.) |
| `PhasePatternWeights` phase 1/2/3 bucket weights (e.g. phase 2: C1 65% / C2 35%; phase 3: C1 40% / C1-fake 20% / C2 15% / C5 15% / C3 10%) | see table in the class's own remark | This task's brief explicitly states "the exact selection algorithm... is your call - but the phase-eligibility gates above (what CAN appear each phase) are MUST, not suggestions." Phase 1's weights (C-1 ~70% / C-2 ~30%) ARE a direct GDD §5.1 number and are reproduced verbatim, not invented. Phase 2/3 have no GDD-given numeric composition (only qualitative notes), so those bucket weights are a documented team-discretion judgment call governing ONLY the relative mix of classes that are already eligibility-gated correctly - they do not change what CAN appear, only how often within what's already allowed. | `PhasePatternWeights.cs` (relocated by T004 from `static readonly` arrays on `PhasePatternSelector.cs` - same MUST as above. Values unchanged.) |

### Guarantee mechanism - stated explicitly (not a new number, a design decision per the brief's own request)

GDD §5.1 MUST: "페이즈 전환마다 그로기 러시(C-4)를 최소 1회 보장한다." Chosen mechanism: **forced injection**,
not a pure pity counter, for the moment of phase entry - `PhasePatternSelector.EnterPhase` forces the very
NEXT pick after transitioning into phase 2 or phase 3 to be the relay step (P5), instead of leaving it to
the weighted pool (which could, by bad luck, never draw relay before the phase ends). Phase 2 additionally
enforces GDD §5.1's own "1회 한정" cap (the relay bucket is excluded from the phase-2 pool once that one
forced attempt is spent). Phase 3 has no such cap, so a pity counter (`PhasePatternWeights.relayPityIntervalPhase3`)
is layered on top to keep multiple occurrences recurring across the phase, matching §5.1's "2~3회" note.

**Important clarification, stated in-code and repeated here**: "guaranteed" means the relay ATTEMPT is
deterministically scheduled, not that it auto-succeeds. Whether the attempt actually lands a groggy rush
still depends on the player's tap timing, same as every other judgment in this game (GDD P-1: "실력은
회피와 리듬이다") - auto-granting success would remove player skill from the one MUST-guaranteed moment per
phase, which reads as a bigger GDD violation than leaving success to input. This was verified via
`HuntPhaseSystemPlayModeTests` (correctly-timed relay taps through the real DriveLoop/PhasePatternSelector
path, not TriggerPatternById) - see that file for the observed evidence.

### Reuse decisions (not new values)

| Situation | Reused value | Rationale |
|---|---|---|
| Phase transition HP boundaries (70%/35%) | `GameplayConfig.phaseBoundaryHighPercent`/`phaseBoundaryLowPercent` | Already a GDD §12 canonical constant (§5.1's own table), already externalized by T001 for `HealthBarUI`'s tick marks. `HuntPhaseTracker` reads the SAME fields - no second copy of this number exists anywhere in the codebase. |
| Groggy-rush duration, rush required taps, relay solo window, failure severities | Unchanged from T001/T002 | This task adds WHEN/HOW OFTEN each pattern is picked, not how any individual pattern executes - every already-tuned per-pattern number is untouched. |

### TBD list - unchanged (this addendum)

TBD-1/2/3/4/5/6/7/14/15 are not touched by this task, per the task's own instruction that they are the
director's alone.
