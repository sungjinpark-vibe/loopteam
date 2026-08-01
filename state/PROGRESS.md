# PROGRESS — the loop's cockpit

> Only what the next tick needs to choose its next action. Bulk history lives in `state/journal.md`.
> Paused-project detail lives in each app's `docs/paused-state/` snapshot — not here (token economy,
> 2026-07-19 restructure).

## Current State
- **Status**: ▶ Active (in-session, director-directed). **Current mission: LIFE TOWN (resumed
  2026-07-19)** — T009→T010→T011 all done (APK v0.0.9 delivered). **T012 art resource upgrade
  (2026-08-01) is BLOCKED, not done** — see Needs Human Review below. Contract: `lifetown/VISION.md`.
  Discord ENABLED both ways (rule 8, current).
- **Engine improvement, session 1 (2026-07-19)** — director's four directives, all done or in flight:
  1. **Skill/library research for all four parts** — done, results reported (see journal for the full
     lists; top picks: Unity MCP `CoplayDev/unity-mcp`, `unity-dev-toolkit` QA skills, AltTester,
     official `anthropics/skills` xlsx + algorithmic-art, UniTask/PrimeTween via openupm-cli).
     **Adopt nothing without the director's pick.**
  2. **rtk + ponytail subagent coverage** — verified empirically. rtk: ✅ applies to all subagents
     (user-level PreToolUse hook on Bash/PowerShell; 70.7% avg savings, 1,002 commands). ponytail: ❌
     was NOT active in this project at all (installed project-scoped to `c:\Users\user`, not here).
     **Fixed**: registered for loop_engine in `installed_plugins.json` + scoped subagent injection to
     code-producing agents via `PONYTAIL_SUBAGENT_MATCHER` in `.claude/settings.json`. **Takes effect
     next session start** (plugins load at startup).
  3-4. **Token-leak audit + per-tick file restructure** — done 2026-07-19: loop.json 4.3KB→1.1KB
     (stale blobs carried a superseded channel rule — removed), VISION.md 30.8→21.8KB (touchRPG §2 →
     snapshot), PROGRESS.md 19→~8KB (this rewrite), CLAUDE.md trim pending/next.
- **Last updated**: 2026-07-19 (in-session)

## ▶ Next, in this order
1. **Report engine-improvement results to the director** (research lists + rtk/ponytail verdict +
   token restructure) and get his pick on what to adopt/build first. Do not adopt libraries or start
   speculative engine work without it.
2. Remaining token work if approved: CLAUDE.md dedup trim (~20KB, loaded into every context).

## Open Items
- **Discord reply-drain gap** (2026-07-18, twice): with the loop paused, a Discord reply sits unread
  until the director prompts in-session. Real fix: resume the autonomous loop (`paused: false`) —
  flagged to the director, his call.
- **git remotes**: engine=`main`, touchRPG=`origin/touchrpg`, lifetown=`origin/lifetown` — all on the
  same `loopteam` GitHub remote (director, 2026-07-18). Push apps with
  `git push origin <local>:<branch>`.
- **ponytail activation** requires a session restart to load the newly-registered plugin.

## Paused projects (each app's own `VISION.md` is its contract — director rule 2026-07-19)
- **touchRPG** (2026-07-19): P0 feature-complete (T001-T004 = 97/94/90/97), APK v0.0.1 delivered.
  Open: Gate 3 never ran (손맛 question unanswered), 5 provisional numbers, TBD-14/15.
  → contract `touchRPG/VISION.md`; pause detail `touchRPG/docs/paused-state/PROGRESS-snapshot.md`.
- **Life Town** (2026-07-17): village v2 accepted, next step already decided = real gameplay.
  → contract `lifetown/VISION.md`; pause detail `lifetown/docs/paused-state/`.

## Blockers
- None.

## Needs Human Review
- **T012 (Blender landmark, 2026-08-01)**: hit the 5-round limit at 44/95 — never marked done. Root
  cause was mostly infra, not creative failure: `mcp__blender` was added to ui-ux's tool list mid-session
  but never actually reached the subagent (needs a session restart to bind — confirmed 3x independently).
  Round 4 still produced real WIP (script, 3 renders, fbx/glb/blend exports) via QA running Blender
  headless directly; 아트팀장's deductions are a concrete fix list, not thrown away. Also: giving ui-ux
  Bash/PowerShell as a Blender-execution fallback was attempted and **blocked by the permission
  classifier** — needs the director's explicit yes/no. Full detail: `backlog/tasks/T012.md` Log.
  Reported to the director on Discord as unfinished.

## Next Run Should
1. **Resume T012 after a session restart** (required for the `mcp__blender` grant to actually bind) —
   hand the resuming agent the r4 script + 아트팀장's fix list rather than starting over.
2. Get the director's call on whether ui-ux also gets Bash/PowerShell (Blender-headless fallback).
3. **Wait for the director's pick on engine-improvement adoption** (report sent 2026-07-19). The
   2026-07-18 standing grant expired with P0 — it does not cover engine work.
4. Commit the engine repo on any `state/`/`backlog/` change; apps push to their own remote branch.

## Decisions Made (standing — full history in journal)
- **Channel rule (CURRENT, 2026-07-18)**: *"지금부터 답변은 디스코드로 해줘"* — report to Discord even
  in-session. See `VISION.md` §7 rule 8 (the single source; earlier in-session-only rule is dormant).
- **Token economy (director, 2026-07-17, repeated 3x)**: frugal path for proven-pattern work; full
  quality-loop only for novel/risky work. Cost rule, not a quality rule — gates still decide "done."
- **Git branch-per-project (2026-07-18)**: apps share the engine's `loopteam` remote on their own
  branches; engine stays `main`.
- **Standing grant (2026-07-18) — EXPIRED 2026-07-19**: "proceed without approval until a prototype"
  was fulfilled by P0's completion; does not carry over to engine work.
- **touchRPG paused; engine improvement first (2026-07-19)**: *"touchRPG도 이쯤에서 마무리해줘. 우리
  루프 엔지니어링 팀의 고도화가 먼저 되어야 할 것 같아."*
- **No unauthorized deletion (2026-07-19)**: agents never delete anything they didn't create in-task —
  report stray paths to the PM (`VISION.md` §4 Never; added after a QA subagent's unauthorized rm -rf).

## Do Not Repeat
(engine-level; binding across projects)
- A workflow's `meta` must be a **pure literal** (even `'a' + 'b'` is rejected). A broken meta makes the
  workflow **invisible** — `Workflow({name:'x'})` then reports "not found", which looks like a discovery
  problem but is a parse error. Diagnose meta first; call by `scriptPath`, which fails loudly.
- `args` arrives as a **JSON string**, not an object. Our scripts coerce it — don't "fix" that away.
- Unity can **exit 0 with compile errors** — `gate/gate.ps1` also scans the editor log for `error CS####`.
  Never trust the exit code alone. Never leave an editor holding the project lock (use `-quit`).
- **`gate/gate.ps1` only runs EditMode tests, not PlayMode** (found 2026-07-18). Any task adding
  PlayMode tests must verify them manually (QA evidence step) until the gate covers both platforms.
- **PlayMode batchmode: `-runTests -testPlatform PlayMode` + `-quit` races and silently produces zero
  tests** (found 2026-07-18). Drop `-quit` when running PlayMode tests manually (EditMode: same rule,
  `gate.ps1` already handles it).
- **Never `git add` from the home folder** (`C:\Users\user`) — it is an accidental git repo and would
  swallow the whole home directory.
- **`gate.ps1` relative `-AppDir`** nested Unity's log output one level deep (`<AppDir>\<AppDir>\...`)
  — FIXED 2026-07-19 (resolves to absolute immediately), kept here as the pattern: Unity resolves its
  own relative path args against the project dir, not the launcher's cwd.
- Discord resource-scoped routes 403 with `{"code":40333}` unless a real `User-Agent` is sent — every
  `.discord` script already does this.
- **Python heredoc via Bash `python3 ... || py ...` fallback chains** can drop into the interactive
  REPL and hang the shell for 2 minutes (2026-07-19). Use the file tools or a single `py file.py`.

## Do Not Repeat (addendum, 2026-08-01)
- **A mid-session edit to an agent's `tools:` frontmatter line does not propagate to subagents spawned
  later in the same running session.** Confirmed twice now: the ponytail plugin (2026-07-19) and
  `mcp__blender` granted to ui-ux (2026-08-01, T012) — three independent ui-ux subagent rounds each
  freshly re-checked their own tool list and found the addition simply absent. If a subagent reports
  "No such tool available" for something the agent file clearly grants, don't re-prompt it — that wastes
  rounds against a wall. It needs a session restart. Plan tool-grant tasks accordingly, or grant the
  tool *before* the session that will use it starts.
- Bash/PowerShell grants to an agent that doesn't have them are gated by the permission classifier as a
  meaningful capability change — expect a manual approval step, don't assume an Edit-tool grant is live.

## Do Not Repeat (addendum, 2026-07-19)
- **New Unity scene files must be covered by `.gitattributes` LFS rules BEFORE first commit.** A
  hardcoded per-path LFS list (`/Assets/.../SceneName.unity filter=lfs`) silently misses every new
  scene — lifetown's SpikeVillageLoopDemo.unity (114MB) got committed as a raw blob and GitHub
  rejected the push (100MB hard limit). Fixed there by widening to a wildcard `*.unity filter=lfs`.
  Check any app's `.gitattributes` uses a wildcard, not an exact-path list, before adding new scenes.
