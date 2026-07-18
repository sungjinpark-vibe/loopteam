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
