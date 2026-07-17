# PROGRESS — the loop's cockpit

> Only what the next tick needs to choose its next action. Bulk history lives in `state/journal.md`.

## Current State
- **Status**: Running (`paused: false`), tick 47. **Project switched to touchRPG** (director,
  2026-07-17 evening). Scaffolding done: `touchRPG/` + its own git repo + `docs/{spec,design,api,qa}`,
  gitignored from the engine. **Waiting on the director's concept brief** — asked on Discord.
- **Blocked on**: the brief. Per `VISION.md` §2/§4 the PM must **not invent** the game concept, genre,
  or target player. The name "touchRPG" is not a brief.
- **Team/system**: unchanged by director's instruction — same agents, same three gates, same rubrics
  (`VISION.md` §3.2), same expert panel (§3.3), same boundaries/failure policy (§4/§5).
- **Last updated**: 2026-07-17 18:15 (Tick 47)

## Last Run
- **Date**: 2026-07-17 18:15 (Tick 47)
- **Summary**: Director paused Life Town and asked to prep touchRPG using the same team/system. Created
  the folder + repo + docs skeleton, gitignored it, archived Life Town's contract state into its own
  repo, rewrote `VISION.md` §2 for touchRPG (concept pending), reset this cockpit and the backlog.
- **Output**: touchRPG scaffolding + a Discord message asking the director for the concept (4 questions).

## Open Items
- **The touchRPG concept brief** — the only thing blocking work. Once it lands:
  1. Fill `VISION.md` §2 (concept, target player, scope).
  2. Open `T001` = `explore` for `planner` (detailed spec) — may start immediately.
  3. Send the proposed scope to the director for approval.
- **touchRPG has no git remote** (same as lifetown). Local commits only until the director provides one.
- **No Unity project created yet** for touchRPG — create it once the spec/scope justifies it
  (`Unity.exe -batchmode -quit -createProject <path> -logFile <log>`; a batchmode run takes ~30-90s).

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
- None mechanical. The only blocker is the missing concept brief (see Open Items).

## Needs Human Review
- None.

## Next Run Should
1. **If the brief arrived**: fill `VISION.md` §2, then open `T001` via the quality-loop workflow
   (`mode: 'explore'`, `agent: 'planner'`, `team: '기획팀장'`, rubric = `VISION.md` §3.2 기획팀장 table
   verbatim, `passMark: 90`). Send the proposed scope to the director. **Never invent the rubric** — it
   is pre-written in `VISION.md`; a rubric written at grading time bends to fit the result.
2. **If no brief yet**: idle. **Do not invent the concept.** Nudge at most once every several ticks
   (`VISION.md` §6).
3. Commit the engine repo on any `state/`/`backlog/` change; touchRPG commits locally in its own repo.

## Decisions Made
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
