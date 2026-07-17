# PROGRESS — the loop's cockpit

> Only what the next tick needs to choose its next action. Bulk history lives in `state/journal.md`.

## Current State
- **Status**: Running (`paused: false`), tick 49. **touchRPG is bootstrapped and building.** The
  director delivered a full **GDD v0.1** → `touchRPG/docs/spec/00-gdd-v0.1.md` = **the single source of
  truth** (its own §0: if code/conversation/convention conflicts, *the doc wins*). Unity 6000.5.1f1
  project created; `VISION.md` §2 rewritten from the GDD; backlog rebuilt around P0.
- **The game**: touch-first online hunting action + persistent growth (**not** an MMORPG). Portrait
  fixed. Party 1-4. Hunt 10-15 min. *"탭 하나로 즐기는 타이밍 패링 협동 헌팅."* Target 20-30s
  light-midcore. Refs: Monster Hunter / Vindictus + Clair Obscur (timing parry).
- **In flight**: **T001 P0-A parry core** — quality-loop workflow `wf_756e669b-8fe` (client-dev →
  Gate 1 mechanical → 클라이언트팀장 90). It answers GDD §10's single P0 question:
  **"터치 패링이 손맛이 있는가"**.
- **Team/system**: unchanged by director's instruction — same agents, same three gates, same rubrics
  (`VISION.md` §3.2), same expert panel (§3.3), same boundaries/failure policy (§4/§5).
- **Last updated**: 2026-07-17 22:00 (Tick 49)

## Last Run
- **Date**: 2026-07-17 22:00 (Tick 49)
- **Summary**: GDD ingested and made the source of truth; Unity project created; `VISION.md` §2 rewritten
  (pillars, P0 scope, GDD §0 decision-authority + §11 non-goals, numbers-externalized MUST, TBD rule as
  a gate); T001 opened + dispatched via the full quality-loop. Then the director added the channel rule
  (in-session ⇒ no Discord mirroring), recorded in `VISION.md` §7 rule 8 + `CLAUDE.md`.
- **Output**: touchRPG Unity project + GDD in `docs/spec/`; T001 running; contract updated.

## The rules this project lives or dies by (re-read before briefing any agent)
1. **The GDD wins.** `touchRPG/docs/spec/00-gdd-v0.1.md`. This cockpit and `VISION.md` §2 are pointers,
   not replacements.
2. **TBD-1…TBD-7 (GDD §13) MUST NOT be filled in by the team** — they are deliberately the director's.
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
