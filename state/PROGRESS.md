# PROGRESS — the loop's cockpit

> Only what the next tick needs to choose its next action. Bulk history lives in `state/journal.md`.
> Paused-project detail lives in each app's `docs/paused-state/` snapshot — not here (token economy,
> 2026-07-19 restructure).

## Current State
- **Status**: ▶ Active (in-session, director-directed). **Current mission: ENGINE IMPROVEMENT**
  (director, 2026-07-19). No app project is active. `loop.json` carries `paused: true`; work is
  direct in-session, not the autonomous `/tick` loop.
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
- None.

## Next Run Should
1. **Wait for the director's pick on engine-improvement adoption** (report sent 2026-07-19). The
   2026-07-18 standing grant expired with P0 — it does not cover engine work.
2. Commit the engine repo on any `state/`/`backlog/` change; apps push to their own remote branch.

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
