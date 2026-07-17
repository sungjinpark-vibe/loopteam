# PROGRESS — the loop's cockpit

> Only what the next tick needs to choose its next action. Bulk history lives in `state/journal.md`.

## Current State
- **Status**: ⏸ **PAUSED** (`paused: true`), tick 50 — director 2026-07-17 23:30: *"오늘은 여기까지.
  내일 계속할꺼야."* Clean stop, nothing in a broken state. **Resume**: `paused=false` + `/tick`.
- **Project**: **touchRPG** — touch-first online hunting action + persistent growth (**not** an MMORPG).
  Portrait fixed. Party 1-4. Hunt 10-15 min. *"탭 하나로 즐기는 타이밍 패링 협동 헌팅."* Target 20-30s
  light-midcore. Refs: Monster Hunter / Vindictus + Clair Obscur (timing parry).
- **Source of truth**: **GDD v0.3** → `touchRPG/docs/spec/00-gdd-v0.3.md` (v0.1/v0.2 kept as history).
  Its §0: if code/conversation/convention conflicts with it, *the doc wins*.
- **T001 P0-A parry core**: **Gate 1 PASSED** 23:25 (`state/gate-result.json` — compile exit=0,
  CS errors=0, tests **19/19**). ⚠️ **Gate 2 (클라이언트팀장 ≥90) result NOT received** before the stop.
  **It is NOT done** — a passed mechanical gate only makes it *scoreable* (`VISION.md` §3).
- **Team/system**: unchanged by director's instruction — same agents, same three gates, same rubrics
  (`VISION.md` §3.2), same expert panel (§3.3), same boundaries/failure policy (§4/§5).
- **Last updated**: 2026-07-17 23:30 (Tick 50)

## ▶ Tomorrow, in this order
1. **Finish T001.** Check the quality-loop result (`wf_756e669b-8fe`). If the workflow never delivered a
   Gate 2 score, **re-run only the 클라이언트팀장 scoring** — the build is committed and green; do not
   rebuild. Then report the score to the director **and list every provisional/TBD value used**
   (esp. TBD-1 combo cap / TBD-2 damage curve — the agent appears to have isolated them into
   `Assets/Data/Config/P0DemoNumbers.asset`; **verify that separation is real**, don't take it on faith).
2. **Collect the director's answers to TBD-12 and TBD-13** — he said he'd give them tomorrow.
3. **TBD-11** (skill/weapon dev priority) is still unanswered. PM recommendation stands: **P1**, because
   GDD §10 forbids starting P1 before the 손맛 question is answered.
4. Only then: T002 (P0-B — IN-3 회피존 / IN-5 차지 / IN-6 러시 + 람팡 P2-P7 into the same data-driven
   pattern sheet).

## Last Run
- **Date**: 2026-07-17 22:00 (Tick 49)
- **Summary**: GDD ingested and made the source of truth; Unity project created; `VISION.md` §2 rewritten
  (pillars, P0 scope, GDD §0 decision-authority + §11 non-goals, numbers-externalized MUST, TBD rule as
  a gate); T001 opened + dispatched via the full quality-loop. Then the director added the channel rule
  (in-session ⇒ no Discord mirroring), recorded in `VISION.md` §7 rule 8 + `CLAUDE.md`.
- **Output**: touchRPG Unity project + GDD in `docs/spec/`; T001 running; contract updated.

## Locked by the director 2026-07-17 (GDD v0.3 — do not re-open without him)
- **No active skills at all.** Growth is passive-centric. Chosen to *remove* the P-2 collision rather
  than compromise it: activatable skills need a trigger input, and §4.1/§6.3 forbid new buttons.
  **In-combat input remains exactly §4.1 — nothing else.**
- **Passive cards = 장식주 socketed into the 탈리스만 slots** (MH gear→decoration structure). Not a new
  growth axis — §8.1's 60/30/10 stands unchanged. Set in the pre-hunt 대기실; **locked at hunt start**.
- **Weapons = 3**: 총(원거리) / 창(중거리) / 검과 방패(근접) — they split the engagement-distance axis
  cleanly (대검 dropped; it overlapped 검과 방패). **Judgment windows ±0.15/±0.35 are weapon-common —
  per-weapon judgment is MUST NOT.** Weapons differ only by rhythm/speed, distance, part-break affinity.
- **A weapon that structurally dodges patterns is as wrong as one that out-damages them** (§4.6 MUST) —
  the live risk with 총 (TBD-13).

## The rules this project lives or dies by (re-read before briefing any agent)
1. **The GDD wins.** `touchRPG/docs/spec/00-gdd-v0.3.md`. This cockpit and `VISION.md` §2 are pointers,
   not replacements.
2. **The 10 live TBDs (GDD §13) MUST NOT be filled in by the team** — they are deliberately the
   director's. Live: TBD-1..7, 11, **12** (shield's game identity), **13** (range axis / 총's ranged
   advantage). TBD-8/9/10 were resolved on 2026-07-17.
   The GDD names its most-guarded failure mode in its own words: *"그럴듯한 보간(hallucinated design)"*.
   That is our **Nodding Loop** by another name. An agent that invents a TBD has failed the task
   however good the result looks. Combo cap / damage curve stay provisional + labelled until the
   director sets them **after** the P0 playtest (his plan, §13).
3. **Gameplay constants MUST be externalized** (config/ScriptableObject), never hardcoded (GDD §0/§12).
4. **P0's question is the only question**: *"터치 패링이 손맛이 있는가."* GDD §10 forbids starting P1
   (party, talismans, daily loop) before it is answered. Do not broaden scope.
5. **Director approval required** for: input vocabulary, judgment-window system, growth axes,
   monetization, pattern classification, screen orientation, anything on the §11 non-goal list.

## Open Items
- **T001 in flight** — on landing: read the score, report to the director *in the channel he last spoke
  in*, list every provisional/TBD value the agent used.
- **touchRPG has no git remote** (same as lifetown). Local commits only until the director provides one.

## Paused: Life Town
Paused, **not cancelled** — fully resumable. Snapshot: `lifetown/docs/paused-state/` (its VISION §2, its
PROGRESS cockpit — which carries a READ-THIS-FIRST resume banner — and its backlog + task files).
Code/renders all committed in `lifetown/`. It stopped with all 7 category buildings + a polished village
v2, gate-green (81/81).

**Its open question was already answered** (2026-07-17 17:56, arrived just before the project switch):
the director replied *"실제 게임 동작 진행해줘"* → **village v2 accepted; next task = real gameplay**
(tap building → timer → growth/build; wire Economy.Core T002 + Platform T003 + design system T004 into
the village scene) → playable slice → Gate 3. **Do not re-ask polish-vs-gameplay on resume.**
See `VISION.md` §2 → "Paused project" and `state/journal.md` for full history.

## Blockers
- None. T001 is running.

## Needs Human Review
- None.

## Next Run Should
1. **When T001 lands `ok: true`** (Gate 1 green + 클라이언트팀장 ≥90): mark it `done`, commit+push
   touchRPG, report to the director with the score **and every provisional/TBD value used**. Then open
   **T002** (P0-B: IN-3 회피존 / IN-5 차지 / IN-6 러시 + 람팡 P2-P7 into the same data-driven pattern
   sheet). Rubric = `VISION.md` §3.2 클라이언트팀장 C1-C5 **verbatim** — never invented at grading time.
2. **If T001 comes back `escalate: true`** (5-round limit / score flat ±2 over 3 rounds / grader
   refused): **do not mark it done**. Push it to `blocked`, add to Needs Human Review + `loop.json`
   `escalations`, and tell the director plainly on Discord that it is unfinished, with the score
   history (`VISION.md` §5). A silently-shipped rejection is the Ralph Wiggum Loop.
3. **If it fails without `escalate`** (infrastructure): leave it `ready`, record the cause in
   **Do Not Repeat**, journal it, don't loop on it.
4. **Gate 3 (5-expert playtest) is NOT for now** — it runs when a meaningful slice is playable, i.e.
   after P0 is genuinely completable solo. Five experts × five rounds on a half-built screen is pure
   burn (`VISION.md` §6).
5. Commit the engine repo on any `state/`/`backlog/` change; touchRPG commits locally in its own repo.

## Decisions Made
- 2026-07-17 — **Channel rule (director)**: *"내가 vs코드로 대화하면 디스코드로는 보내지 말아줘."*
  In-session (VS Code) conversation is answered **in-session only — never mirrored to Discord**.
  Discord is the **async** channel: it carries what happens while he is away, which is what makes the
  unattended loop work. Judge by where he last spoke. Recorded in `VISION.md` §7 rule 8 + `CLAUDE.md`.
  **Still drain the Discord inbox every tick**, including in-session ticks (a real message was skipped
  this way on 2026-07-17).
- 2026-07-17 — **Project switch**: Life Town paused (resumable), touchRPG begins. Team + system carry
  over unchanged (director). Each app keeps its own folder + git repo, gitignored from the engine.
- 2026-07-17 — **Token economy (director, repeated 3x)**: default to the **frugal path** for
  proven-pattern work — one subagent + the mechanical gate + a PM visual check + honest disclosure to
  the director — and reserve full quality-loop workflows for genuinely novel/risky work. Proven on
  Life Town: 5 buildings in one fresh-agent run cost 200k vs 442k for a single building via a heavy
  resumed agent.
- 2026-07-17 — **Don't spend big speculatively**: when a large, direction-heavy build has been teed up
  as a question to the director, wait for the answer rather than pre-build it.

## Do Not Repeat
(engine-level; still binding across projects)
- A workflow's `meta` must be a **pure literal** (even `'a' + 'b'` is rejected). A broken meta makes the
  workflow **invisible** — `Workflow({name:'x'})` then reports "not found", which looks like a discovery
  problem but is a parse error. Diagnose meta first; call by `scriptPath`, which fails loudly.
- `args` arrives as a **JSON string**, not an object. Our scripts coerce it — don't "fix" that away.
- Unity can **exit 0 with compile errors** — `gate/gate.ps1` also scans the editor log for `error CS####`.
  Never trust the exit code alone. Never leave an editor holding the project lock (use `-quit`).
- **Never `git add` from the home folder** (`C:\Users\user`) — it is an accidental git repo and would
  swallow the whole home directory.
- Discord resource-scoped routes 403 with `{"code":40333}` unless a real `User-Agent` is sent — every
  `.discord` script already does this.
