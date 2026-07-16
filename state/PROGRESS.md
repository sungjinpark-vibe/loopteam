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
- **Status**: 🛑 **PAUSED at the director's request.** They said "멈춰줘" on Discord 2026-07-16 09:58
  (msg 1527117309070671972). `state/loop.json` → `paused: true`. **A tick that starts while this is
  true must sleep immediately and do nothing** (`.claude/skills/tick/SKILL.md` Step 0).
  - **"멈춰줘" was not an approval.** It answered none of D1/D5/D7/D9/D11. Do not treat an unanswered
    decision as an approved one when the loop resumes.
  - To resume: set `paused: false` and run `/tick` or `/loop /tick`. The Discord listener stayed on, so
    anything the director sent while paused is already in `incoming.log`; `handled.txt` is at the stop
    message, so a resume picks up cleanly from whatever came after it.
- **Was**: Idle — T001 `awaiting-approval`; nothing else is `ready`
- **Main objective**: Ship Life Town (Unity) to a real player. Done = "a stranger installed it from a
  store link and logged a session" — a stop condition outside the team's own claims.
- **Current focus**: The director's answer on **D7 (Play Console: personal vs organization)**.
  **Nothing ships until that is answered** — a personal account needs 12 opted-in testers for 14
  *continuous* days, which is the longest-lead item on the project and is not a coding task.
- **Last updated**: 2026-07-16 09:15 (Tick 4)

## Last Run
- **Date**: 2026-07-16 09:15 (Tick 4)
- **Summary**: T001 **PASSED 93/90** (83 → 93 over 2 rounds). Ship-first spec won. Written to
  `lifetown/docs/spec/00-mvp-spec.md` and committed. Approval request sent to Discord.
- **Output**: the MVP spec (81,839 bytes) + 11 director decisions (D1-D11), each with a
  recommendation, a cost, and a default so the loop never blocks on them.

## Open Items
- **T001 awaiting director approval.** Three answers needed to start (D7 dev account, D5 EXP curve,
  D9 leisure multiplier); two more (D1 cloud sync, D11 landmarks) override locked decisions and need
  explicit approval. The other six have defaults and proceed silently if unanswered.
- **Unity MCP not connected.** Director ruled: connect once a project exists and it is needed
  (`VISION.md` §7 rule 5). Not a blocker while there is no project.
  - **Use the OFFICIAL one**: `com.unity.ai.assistant`, requires Unity 6000.0+ (we are on 6000.5.1f1 —
    supported, verified in Unity's docs 2026-07-16). Setup: Edit > Project Settings > AI > Unity MCP
    Server; the bridge auto-starts and installs a relay binary to `~/.unity/relay/` which Claude Code
    points at. Do not use third-party Unity MCPs; the official one exists.
  - Still **pre-release** (2.7.0-pre.3). Verify when actually installing.
  - **⚠️ It conflicts with our gate — design the sequencing before installing.** See Do Not Repeat.

## Blockers
- **D7 — Play Console account.** Personal (~$25, but 12 testers × 14 continuous days) vs organization
  (exempt from the 12-tester rule, needs a D-U-N-S number, slower approval). **This is the gate that
  silently held the original at zero players for a year** — it was never on anyone's plan. It cannot be
  shortened by coding, so it starts in week 1, before the product exists. Waiting on the director.

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
1. Delegate to `loop-scout`. If the director answered the approval request, reconcile it.
2. **On approval**: fold the answers into `lifetown/docs/spec/00-mvp-spec.md` (§12 D1-D11), set T001
   `done`, and open the next tasks from the spec's ship plan (§11). The spec's own §11.3 asks for the
   MVP scope to become a **`VISION.md` boundary** so the gate rejects out-of-scope work — do that; it
   is the rule whose absence let the original build 9 social screens that were locked out of MVP.
3. **If D7 is answered "personal"**: recruiting 12 testers starts immediately and is not a coding task.
   It is on the critical path — surface it every time, it is the thing that killed the original.
4. **If no answer**: stay idle. Nothing else is `ready`; everything depends on this spec. Do not
   manufacture work, and do not nudge every tick (`VISION.md` §6).
5. Commit + push both repos on any change (`origin/main` tracked in each).

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
- 2026-07-16 **Gate order.** Rubric scoring happens only after the mechanical gate is green. Broken
  builds are never scored — ch.29's Nodding Loop defense. (Superseded on bars only: it is now three
  gates, team lead at 90 and the expert panel at 90/floor-80. See the rules-6-8 entry above.)
- 2026-07-16 **The gates are real — proven, not asserted.** T001 scored 83 and was refused. Not
  "basically there", not nudged to 90. It was revised against the itemized deductions and passed at 93.
  If a future tick is tempted to soften a bar, this is the entry that says the bar works.

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
