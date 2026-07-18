# VISION — touchRPG (project contract)

> **This is the app's own contract** — split out of the engine's `VISION.md` §2 on 2026-07-19 per
> director instruction ("VISION 내용을 각 프로젝트에 분리"). The engine's `VISION.md` still holds
> everything project-independent: the three gates, rubrics, boundaries, failure policy, standing rules.
> When touchRPG is the **active** project, the tick reads BOTH files (engine first, then this).
> The GDD (`docs/spec/00-gdd-v0.4.md`) outranks this file wherever they overlap — this is the loop's
> compact pointer, the GDD is the design authority.
>
> **Status: PAUSED 2026-07-19** (director: *"touchRPG도 이쯤에서 마무리해줘"*). NOT cancelled.
> P0 feature-complete (T001-T004, Gate 2: 97/94/90/97); APK v0.0.1 delivered to the director.
> Open at pause: **Gate 3 never ran** (P0's 손맛 question unanswered — GDD §10 forbids P1 before it);
> 5 provisional numbers unconfirmed (`docs/qa/P0-provisional-gameplay-numbers-REPORT.md`); TBD-14/15.
> Full pause state: `docs/paused-state/PROGRESS-snapshot.md`. **To resume**: point the engine's
> `state/loop.json` `project` here and pick up from the snapshot's "Open at pause".

> **The GDD is the single source of truth**: `touchRPG/docs/spec/00-gdd-v0.4.md` (director-authored;
> v0.4, 2026-07-18 — supersedes v0.3/v0.2/v0.1, which stay as the record). Its §0 says so outright — if code comments, past conversation, or inferred
> convention conflict with that document, **the document wins**. This §2 is a compact pointer for the
> loop, **not a replacement**. When they disagree, the GDD is right. Read it before briefing any agent.

| Field | Value |
|---|---|
| Name | **touchRPG** — working title "람팡" (final naming = TBD-6, director's) |
| Genre | Touch-first online hunting action + persistent growth. **Not an MMORPG** (GDD §11) |
| Stack | **Unity 6000.5.1f1** (director rule §7.5; GDD §1 agrees) |
| Platform | Mobile (iOS/Android) first, PC cross-platform. **Portrait fixed** — landscape is a non-goal |
| One-line concept | *"탭 하나로 즐기는 타이밍 패링 협동 헌팅. 잘 피하고 꾸준히 때리는 자가 이긴다."* |
| Target player | 20-30s men and women, light-to-midcore (GDD §1) |
| Session | One hunt 10-15 min; 30-60 min/day recommended. Party 1-4 |
| References | Monster Hunter / Vindictus (big single-target hunts, part-breaking, mastery-through-repetition); Clair Obscur: Expedition 33 (precise timing input as the heart of combat). **Differentiator**: that feel, rebuilt as portrait + single-tap gesture + party relay parry |
| Project folder | `C:\Users\user\loop_engine\touchRPG` (own git repo, gitignored from the engine) |
| Spec | `touchRPG/docs/spec/00-gdd-v0.4.md` (v0.1/v0.2/v0.3 kept as history) |
| Completion | **The 5-expert playtest gate (§3.3)** — unchanged |

### The four pillars (GDD §2 — if a feature conflicts with a pillar, the feature is wrong)
- **P-1 실력은 회피와 리듬** — skill, not stat inflation, decides outcomes. 딜찍누 is MUST NOT.
- **P-2 입력은 탭 하나, 판단은 무한** — the only gestures are tap (+ hold, + repeat-tap). Depth comes
  from *when and what* to tap. New gestures (swipe, joystick) MUST NOT without director approval.
- **P-3 협동은 딜 합산이 아니라 기회 창출** — party value = safe damage windows, judgment leniency,
  mistake buffering. Never "headcount × damage". Scale by pattern composition, **never by HP multipliers**.
- **P-4 성장은 숫자가 아니라 기회를 넓힌다** — growth widens judgment windows and opportunity. Pure
  attack-power options may exist **only** in the 공세 slot.

Two supporting rules, both MUST: **"화면이 아니라 몬스터를 보게 만든다"** — the cue distinguishing a fake
lives in the monster's animation, never in a UI marker (GDD §6.2/§7.2). **"마커가 있는 곳은 탭, 없는
곳은 이동"**. Gameplay colour is fixed at 4 channels (yellow=parry, blue=dodge, red=relay, gold=reward);
adding a gameplay colour is MUST NOT.

### Locked by the director on 2026-07-17 (GDD v0.3 — do not re-open without him)
- **No active skills at all.** Growth is passive-centric. This was chosen to *remove* the collision with
  P-2 rather than compromise it: activatable skills would have needed a trigger input, and §4.1/§6.3
  forbid new buttons/gestures. **In-combat input remains exactly §4.1 — nothing else.**
- **Passive cards = 장식주 socketed into the 탈리스만 slots** (Monster Hunter gear→decoration structure).
  Cards are *not* a new growth axis — §8.1's 60/30/10 split stands unchanged. Set in the pre-hunt 대기실;
  **locked at hunt start, never changed mid-combat**.
- **Weapons = 3: 총(원거리) / 창(중거리) / 검과 방패(근접)** — they split the engagement-distance axis
  cleanly. **Judgment windows (±0.15 / ±0.35) are weapon-common — per-weapon judgment is MUST NOT.**
  Weapons differ only by **rhythm/speed, engagement distance, part-break affinity, and (new in v0.4)
  hit-damage-reduction for shield only**.

### Locked by the director on 2026-07-18 (GDD v0.4 — do not re-open without him)
- **TBD-11 resolved**: skill/weapon system dev priority = **P1** (director approved the PM's
  recommendation as-is).
- **TBD-12 resolved**: the shield's identity = **damage reduction on a timed defense** (director's own
  words: *"타이밍에 맞춰서 몬스터의 공격을 방어하면 기존 피해량에 비해 크게 감소"*). §4.3's judgment
  windows are untouched (still weapon-common) — only what a successful defense *does* differs for
  shield. **Not yet decided** (new **TBD-14**): the exact reduction %, and whether it applies only on
  good/perfect judgments or partially on a near-miss too. Do not implement until that is confirmed.
- **TBD-13 resolved**: a **range axis is introduced** — weapons must differ by distance in damage
  advantage or strategy (director's own words: *"사거리에 따라 데미지 이점이나 무기 별 전략의 차이가
  존재해야 함"*). This confirms the *direction*, not the *mechanism* — the original risk TBD-13 raised
  (원거리 총이 근접 패턴을 구조적으로 회피 → §4.6 MUST/P-1 위반) is **still open**, now as **TBD-15**:
  what exactly stops 총 from structurally dodging 람팡's melee patterns. **Do not add distance behavior
  to any pattern sheet (§7) until TBD-15 is resolved** — GDD v0.4 §4.6.2.
- **A weapon that structurally dodges patterns is as wrong as one that out-damages them** (§4.6 MUST) —
  still the live constraint on 총 pending TBD-15.

### P0 — the only thing that matters right now (GDD §10)
P0 = the vertical slice: the full input grammar (IN-1~6), 람팡 + its complete pattern sheet, the 3-phase
session, a solo run to completion, combat UI §6.1-6.2.

> **P0's validation question is exactly one: "터치 패링이 손맛이 있는가."**
> The GDD says not to start P1 work before that is answered. The team obeys this — the early tasks exist
> to answer that question, not to broaden scope.

P1 = party of 4 (relay / cover / IN-7), minimal matching+lobby, talismans + part materials, daily loop.
P2 = monster #2 (험상궂음), mastery + codex, weekly raid, PC build.
Network/judgment architecture is **TBD-7**, decided with the director when P1 starts — out of scope now.

### Project boundaries (GDD §0/§11 — these bind *on top of* §4)
**Team discretion, no query needed**: code architecture, data structures, asset pipeline, presentation
detail, placeholder art, internal tools.
**Director approval required**: adding/changing the input vocabulary; changing the judgment-window
system; new growth axes; anything touching monetization; changing the pattern-classification system;
screen orientation; adding anything on the §11 non-goal list.
**Non-goals — do not build**: open/seamless world, PvP, extra control schemes (swipe/joystick), stress
monetization (enhance-failure, stamina gates, uncapped reroll gambling), auto-hunt or idle mechanics,
landscape mode, and **any monetization model at all** (a separate doc will cover it; assume nothing).

**Numbers**: every gameplay constant (GDD §12) MUST be externalized to config/ScriptableObject — never
hardcoded. A gameplay-affecting number that is not in the doc MUST be asked, never invented; a
presentation-only number (effect length, etc.) MAY be chosen and recorded.

**The `[TBD]` rule (GDD §0/§13) — treat this as a gate.** **Nine** items are *deliberately* undecided:
combo cap (TBD-1), damage curve (TBD-2), 람팡 유대 material part (TBD-3), enhance curve (TBD-4), daily
blessing count (TBD-5), final naming (TBD-6), network architecture (TBD-7), **shield's exact
damage-reduction % and trigger condition (TBD-14, new v0.4)**, **the range axis's exact mechanism +
what stops 총 from structurally dodging melee patterns (TBD-15, new v0.4)**. **MUST NOT fill them in.**
TBD-8/9/10 resolved 2026-07-17; TBD-11/12/13 resolved 2026-07-18 (their unresolved specifics moved to
TBD-14/15 — see "Locked by the director on 2026-07-18" above).
The GDD names the failure mode itself: *"그럴듯한 보간(hallucinated design)은 이 프로젝트에서 가장
경계하는 실패 모드다."*
That is this loop's **Nodding Loop** under another name — the exact thing §3
exists to prevent. An agent that invents a TBD has failed the task, however good the result looks.
