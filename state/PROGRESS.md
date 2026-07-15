# Loop Progress — Cockpit

> **ch.13**: agents forget, files remember. Without this file every tick starts from a blank page.
> **ch.18**: PROGRESS.md is a **cockpit, not a warehouse**. Keep only what is needed to choose the next
> action. Bulk history goes to `state/journal.md`. Once this file sprawls it stops being useful.
>
> English per director rule 3. The director never needs to read this — the PM reports in Korean.

Updated by the PM at the end of every tick. Direction lives in `VISION.md`, the work queue in
`backlog/BACKLOG.md`. This file is **current state**.

---

## Current State
- **Status**: Idle — team standing by, waiting on the first brief
- **Main objective**: Receive the director's first brief and start building
- **Current focus**: Waiting for the brief (what game, concept, feel). Build nothing without one.
- **Last updated**: 2026-07-16 (Tick 1 + director rules 1-5)

## Last Run
- **Date**: 2026-07-16 00:45 (Tick 1 — first real tick)
- **Summary**: Team loaded after restart (9 agents + `/tick`). Contract re-read → `loop-scout` →
  **IDLE**. Confirmed the loop does not manufacture work when no brief exists — the point of the tick.
- **Output**: none (intended). State updated only.

## Open Items
- No project assigned. `VISION.md` §2 still the template.
- **Unity MCP not connected.** Director ruled: connect once a project exists and it is needed
  (`VISION.md` §7 rule 5). Not a blocker while there is no project.
  - **Use the OFFICIAL one**: `com.unity.ai.assistant`, requires Unity 6000.0+ (we are on 6000.5.1f1 —
    supported, verified in Unity's docs 2026-07-16). Setup: Edit > Project Settings > AI > Unity MCP
    Server; the bridge auto-starts and installs a relay binary to `~/.unity/relay/` which Claude Code
    points at. Do not use third-party Unity MCPs; the official one exists.
  - Still **pre-release** (2.7.0-pre.3). Verify when actually installing.
  - **⚠️ It conflicts with our gate — design the sequencing before installing.** See Do Not Repeat.

## Blockers
- None. Channel wired, remote pushed, Unity gate verified. Waiting on the first brief.

## Needs Human Review
- ~~app-dev-team cursor bug~~ → **Director ruled "건드리지 마" 2026-07-16. Closed.** See Do Not Repeat.
- **The home folder (`C:\Users\user`) is an accidental git repo** (0 commits, 0 tracked, 41MB `.git`).
  loop_engine sidesteps it by being its own repo, but the home repo itself was left untouched. A
  `git add -A` from any other project there would swallow the whole home directory. Director's call.
- **Bot token was pasted into chat** (2026-07-16). Low risk for a personal bot, but if it matters:
  Reset Token in the Developer Portal and edit `.discord/config.json` directly.
- **Nature of every score gate (90 lead, 90 panel)**: an LLM's score is an opinion. It is paired with a
  mechanical gate and pre-fixed rubrics, but that limit does not disappear. `VISION.md` §3.
- **The 5 experts cannot actually play.** They score QA's recorded evidence of a real run. Better than
  one grader guessing from code, but **not a human playtest** — never report it as one. `VISION.md` §3.3.

## Next Run Should
1. Delegate to `loop-scout` to find a brief. (Channel live — bot `Loop_team`, `#loop-team`.)
2. If a brief exists: create the Unity project folder → `git init` → add to root `.gitignore` →
   fill `VISION.md` §2-3 (project + **rubric**) → send the rubric to the director for approval in
   Korean → open T001 (`explore`, `planner`).
   **Fix the rubric before a line of code.** Written later, it bends to fit the result.
3. If no brief: **idle**. Do not manufacture work. (Verified in Tick 1.)
4. Commit + push the engine repo on any change (`origin/main` tracked).

## Decisions Made
- 2026-07-16 **Roles restructured (director rules 6-8).** Every team is member + lead; the lead gates
  at **90** against that team's fixed rubric (`VISION.md` §3.2). App completion moved to a **5-expert
  playtest panel: avg ≥90 AND nobody <80** (§3.3). The floor matters more than the average —
  `95·94·92·90·79` averages to exactly 90, and that 79 is one expert saying something is badly broken.
  An average alone would ship it.
- 2026-07-16 **`evaluator` (95) and `judge` retired.** Superseded by team leads + the expert panel.
  `explore` proposals are now scored by that team's own lead against the same rubric, so **every
  deliverable is judged by one consistent standard** instead of an ad-hoc panel.
- 2026-07-16 **Leads/experts are 2 generic agents, not 10 files.** `team-lead` and `game-expert` receive
  their rubric/persona per call; the rubrics and the panel live in `VISION.md` §3.2/§3.3. The director
  tunes the bar by editing one file, and ten near-duplicate agent files cannot drift apart.
- 2026-07-16 **Agents do NOT talk over Discord.** The director allowed per-member bots but flagged the
  token cost. Rejected: agents already exchange structured data inside the workflow, and Discord
  chatter would refill the listener's 100-message window — re-creating the exact cursor bug fixed the
  same day, where the director's next brief stops being read. Discord is director ↔ PM only.
- 2026-07-16 **Director rules 1-5 adopted** (`VISION.md` §7): parent `.claude/settings.json` governs
  permissions; rtk always (hook already active); English except director reports; token-efficient;
  **Unity only**.
- 2026-07-16 **Gate 1 rewritten for Unity.** Flutter version deleted — the stack is fixed to Unity now.
  Compile is judged by **exit code AND an `error CS####` log scan**, because Unity batchmode can exit 0
  with compile errors. Verified: healthy project → exit 0; injected compile error → exit 1 with the
  exact file/line. It discriminates.
- 2026-07-16 **Unity editor version is matched to the project.** The gate refuses to open a project
  with a different editor version rather than silently upgrading it — a destructive side effect a gate
  must never cause.
- 2026-07-16 **Discord cursor bug fixed** (`le-daemon.ps1`): advance `$lastId` for every message
  *before* skipping our own. Original code let the bot's own sends never move the cursor, and
  `?after=<id>&limit=100` returns the OLDEST 100 after it — so a loop that reports more than the
  director replies would fill the window with its own reports and never read the next brief.
- 2026-07-16 **One implementer, many checkers.** Racing parallel implementers would need worktree
  isolation plus a merge step; for code the cost exceeds the benefit. The leverage is in the gates,
  not in competing builders. (ch.24 Tangled Loop only applies with parallel implementers.)
- 2026-07-16 **`explore` mode writes no files.** Design/spec work generates 3 proposals in parallel but
  returns them as text; the PM records the winner. No worktree needed, no conflicts.
- 2026-07-16 **Awaiting-approval never stops the team.** It stops that *task*; the loop moves to the
  next `ready` one. The single rule that lets an approval gate coexist with an autonomous loop.
- 2026-07-16 **Two gates.** Rubric scoring (95) only after the mechanical gate is green. Broken builds
  are never scored — ch.29's Nodding Loop defense.

## Do Not Repeat
> ch.18: if a failed attempt is not written down, the next run repeats it.

- **Never `git add` from the home folder (`C:\Users\user`)** — it is a git repo, so `git add -A` there
  indexes the entire home directory. (2026-07-16: the first commit attempt hit exactly this.)
  Inside `loop_engine/` it is safe; that is its own repo now.
- **Do not call agents/skills in the same session that created them.** Claude Code registers
  `.claude/agents/` and `.claude/skills/` at session start; until a restart, calls fail with
  "Agent type not found". (Confirmed 2026-07-16; loaded fine after restart in Tick 1.)
- **A workflow whose `meta` fails to parse is INVISIBLE, not loudly broken.** It silently does not
  register, so `Workflow({name:'x'})` reports "not found. Available: deep-research, code-review" — which
  looks like `.claude/workflows/` isn't discoverable at all. It is. The real cause was the `meta` bug
  below. Once fixed, both workflows appeared by name immediately.
  **Diagnose "workflow not found" as a meta/parse error first**, not as a discovery limitation.
  (2026-07-16, Tick 3 — this nearly got written down as the wrong lesson.)
  `scriptPath` works either way and is what our docs use, since it fails loudly instead of silently.
- **Pass `args` to Workflow as a real JSON OBJECT, not a JSON-encoded string.** A stringified object
  arrives as one string, so `args.brief` is undefined and the workflow dies instantly with 0 agents
  run. (2026-07-16, Tick 3 — cost one failed launch.)
- **A workflow's `meta` must be a PURE LITERAL.** Even `'a' + 'b'` string concatenation fails with
  "meta must be a pure literal: non-literal node type in meta: BinaryExpression". No variables, no
  template interpolation, no concatenation — every value a single literal. (2026-07-16, Tick 3: both
  workflows had multi-line concatenated `whenToUse` strings and neither would load.)
- **Do not trust Unity's batchmode exit code alone.** It can exit 0 with compile errors. Always also
  scan the editor log for `error CS####`. (This is why `gate/gate.ps1` checks both.)
- **Do not install Unity MCP without solving the project-lock conflict first.** Unity MCP needs a
  **running Editor**, and a running Editor **holds the project lock** — which is exactly what stops
  `gate/gate.ps1` from opening the project in batchmode. Naively turning MCP on makes Gate 1 fail every
  time. Decide the sequencing (e.g. QA gathers evidence via MCP with the Editor up, then the Editor
  closes before the gate runs) as part of creating the project — not after Gate 1 starts failing.
  (Found 2026-07-16 while researching; not yet hit because no project exists.)
- **`Start-Process -PassThru` gives an EMPTY `.ExitCode`** unless `$p.Handle` is touched before the
  process exits. (2026-07-16: made every Unity compile look inconclusive until fixed.)
- **Do not use `grep -P` in Git Bash** — this PC's locale fails with "grep: -P supports only unibyte
  and UTF-8 locales". Use node or `Select-String`.
- **Do not pass Git Bash paths (`/c/...`) to node as arguments** — node reads them as `C:\c\...` and
  throws ENOENT. `cd` first and use relative paths, or pass a Windows path.
- **wikidocs article bodies are not reachable via WebFetch (403).** Use `curl` with a browser
  User-Agent. The body is in the static HTML, in the ~12000 chars before `마지막 편집일시`.
- **Do not touch repos outside `loop_engine/`.** On 2026-07-16 the offer to fix app-dev-team's
  identical cursor bug was explicitly refused ("건드리지 마"). Do not propose it again. Problems found
  elsewhere get **recorded and left alone** (`VISION.md` §4).

---

## Rules for maintaining this file
- Keep only what the next tick needs to choose an action. Everything else goes to `state/journal.md`.
- **Never delete** `Do Not Repeat` or `Needs Human Review` entries (mark them resolved; leave them).
- Update every tick. A tick that did not update this file is a failed tick.
