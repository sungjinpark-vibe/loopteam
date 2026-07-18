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
| P3 실패의 "넉백" (knockback) | not built | GDD names knockback qualitatively for P3's failure but gives no distance/force number, and this task did not add a knockback visual/physics effect (dash-out on success is the only movement effect built) - flagged as a scope gap, not a silently invented number. | — |
| P3 텔레그래프 "지면 붉은 라인" pre-cursor | not built | GDD §7.2 P3's "예고" column separately from the dodge-zone itself; this task builds the zone (circle+guideline+gauge, GDD §6.2 MUST) but not an additional line-telegraph flourish before it appears - a staging/art gap, not a judgment/damage number. | — |

### TBD list - unchanged

TBD-1/TBD-2/TBD-11/TBD-12/TBD-13 are not touched by this task, per the task's own instruction that they
are the director's alone.
