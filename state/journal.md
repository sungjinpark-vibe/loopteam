# Loop Journal

Append-only. One entry per tick, newest at the bottom. Never rewrite history here.

**Why this exists:** the loop's conversation context is summarized and eventually lost, but the loop
keeps running. This journal is how a future tick — with none of today's context — finds out what was
already tried, what failed, and why a decision was made. Write for that reader: they have no memory
of this and cannot ask you.

Keep entries short. Record **decisions and outcomes**, not narration.

## Format

```
## Tick <n> — <YYYY-MM-DD HH:mm>
- did: <what happened this tick>
- task: <T### | none>
- result: <passed in N rounds | escalated | idle | replied>
- note: <anything a future tick needs that isn't obvious from the backlog>
```

---

## Tick 0 — engine bootstrap
- did: Loop engine scaffolded (agents, quality loop, backlog, state, Discord channel ported from
  app-dev-team with its own bot identity).
- task: none
- result: idle — no app assigned yet, backlog empty.
- note: Discord bot token not yet configured (`.discord/config.json`). The loop cannot report to the
  director until that exists.

## Tick 0b — audit against 《루프 엔지니어링》 (김동학, wikidocs.net/book/20486)
- did: Read ch.12 (Verify), 13 (State file), 14 (Stop condition), 18 (4파일 시스템), 29 (조용히
  실패하는 Loop). Audited the engine against the book's named failure patterns and rebuilt what failed.
- result: 5 real gaps found and closed.
- findings:
  - **Nodding Loop (29장) — the serious one.** The v1 quality loop's only gate was a 3-agent LLM judge
    panel. The book is explicit that this is opinion, not verification: "낙관적인 에이전트 둘이 서로
    고개만 끄덕이는 셈". Replaced with a two-stage gate: `gate/gate.ps1` (exit code, mechanical) must
    pass BEFORE `evaluator` scores a fixed rubric out of 100. Judges kept only for `explore` mode,
    where the output is a document and no mechanical signal exists.
  - **Goal Drift (29장)** — no direction doc existed; CLAUDE.md described the team, not the mission.
    Added `VISION.md`, re-read every tick per the book's prescription.
  - **Ralph Wiggum Loop (12·14장)** — success brake was an agent's opinion. Now: mechanical PASS + 95
    points. Added the missing failure brakes: 5-round hard limit + no-progress detection (±2 over 3 rounds).
  - **Amnesiac Loop (13·18장)** — had journal/backlog but no cockpit and no **Do Not Repeat**.
    Added `state/PROGRESS.md` with the book's section set.
  - **No failure policy (18장)** — "나쁜 Loop 대부분은 실패 정책이 없다. 그래서 에이전트가 즉흥적으로
    판단한다." Added `VISION.md` 5절 as a fixed table.
- verified: gate tested end-to-end on a throwaway Flutter project — FAILs closed on missing app dir and
  missing pubspec, PASSes a healthy project (exit 0), FAILs an injected type error with the exact line
  (exit 1). It discriminates; it is not decoration.
- note: **Tangled Loop (24장) does not apply** — the build loop runs a single implementer, and explore
  mode's parallel agents return text without writing files. No worktree needed. Revisit only if
  implementers are ever parallelized.
- note: 18장 says do not schedule a loop before it runs cleanly by hand. That applies to the LOOP
  (`/loop /tick`), which stays manual until `/tick` proves out by hand. It does not apply to the
  Discord listener's watchdog — that is messaging infrastructure, not the loop, and it must be up
  before a brief can even arrive. (Registered in Tick 0c.)

## Tick 0c — Discord channel live
- did: Wired the director's channel. Bot `Loop_team` (id 1526972090203504700) → `#loop-team`.
  Verified auth, channel access, send, and no self-echo. Registered scheduled task
  `LoopEngine-DiscordDaemon-Watchdog` (1 min) and proved self-heal by killing the daemon — the
  watchdog revived it (PID 14356 → 10752). Three project listeners now coexist without collision.
- result: channel ready; loop can report. Waiting on the director's first brief.
- found + fixed: **Discord cursor bug**, inherited latent from app-dev-team. `le-daemon.ps1` skipped
  the bot's own messages with `continue` BEFORE advancing `$lastId`, so our own sends never moved the
  cursor. Since `?after=<id>&limit=100` returns the OLDEST 100 after the cursor, an autonomous loop —
  which reports far more often than the director replies — would fill that window with its own reports
  and never read the director's next message, waiting forever on an approval already given. Chat-driven
  use hides this; a loop walks straight into it. Fixed by advancing the cursor for every message and
  filtering only the logging. Verified: last-id went 0 → real message id after the fix.
- note: the same bug is still live in app-dev-team's `discord-daemon.ps1`. Logged under Needs Human
  Review — not ours to change unasked.
- note: `loopteam` repo still does not exist on GitHub; engine is committed locally only. gh CLI is not
  installed and credential extraction was (correctly) blocked, so the director must create it.

## Tick 0d — receive verified; app-dev-team left alone
- did: Director sent two "테스트" messages; both landed in incoming.log and last-id advanced to the
  newest. Full round trip now proven: send, receive, cursor advance, self-heal.
- decision: Offered to fix the same cursor bug in app-dev-team's daemon. **Director said no
  ("건드리지 마"). Closed — do not propose it again.** Recorded in PROGRESS.md → Do Not Repeat.
  The bug stays live there; that project is chat-driven, so it is far less exposed than a loop.
- did: Marked the two test messages as handled so the first real tick does not mistake "테스트" for a
  project brief.
- result: engine ready. Waiting on the director's first brief. Nothing blocking.

## Tick 0e — engine complete; team wakes on restart
- did: Tried to validate the loop by hand (18장: prove it by hand before scheduling). Attempted to run
  `loop-scout` and it failed: "Agent type 'loop-scout' not found".
- cause: Claude Code reads `.claude/agents/` and `.claude/skills/` at session start. This session began
  before those files existed, so the team is not registered in it. Not a defect in the files —
  frontmatter names all verified against filenames.
- result: **The engine is complete but unexercised. The first real `/tick` must run in a fresh Claude
  Code session.** Recorded in PROGRESS.md → Next Run Should step 0.
- what IS verified: mechanical gate end-to-end (passes healthy, catches an injected error, fails
  closed); Discord round trip (send, receive, cursor advance, no self-echo, watchdog self-heal);
  repo pushed to loopteam with no token in history; all agent references in quality-loop.js resolve.
- what is NOT verified: a full tick, and the two gates running against a real task. Nothing has been
  built by this team yet.

## Tick 1 — 2026-07-16 00:45 — first real tick
- did: Read VISION.md + PROGRESS.md, checked kill switch (paused:false), delegated to `loop-scout`.
- task: none
- result: **IDLE** — no brief has arrived; VISION.md §2 is still the template, backlog is empty.
- note: This tick existed to test one property: **does the loop invent work when there is none?**
  It does not. The scout read the inbox, found both messages already handled, found an empty backlog,
  and returned IDLE with an honest reason rather than manufacturing a task to look useful. That is the
  correct behavior and the whole reason for the "브리프 없으면 일을 만들지 말 것" rule.
- note: Team loaded correctly after the Claude Code restart — 9 agents + the /tick skill. The
  "Agent type not found" failure from Tick 0e was purely the session-start registration issue.
- note: Cleaned up a Do Not Repeat entry that was worded as "don't check the git toplevel", which read
  as discouraging a safety check. Rewrote it to say what was actually meant: never `git add` from the
  home folder. Do Not Repeat is binding, so a confusingly worded entry there is a real liability.
- what is still unexercised: the two gates against a real task. Nothing has been built yet.

## Tick 1b — 2026-07-16 — director rules 1-5; stack switched to Unity
- did: Adopted five standing director rules (recorded in `VISION.md` §7).
- rules: ① permissions follow the parent `.claude/settings.json` ② always use rtk ③ English for
  everything except director reports ④ token-efficient ⑤ **Unity only** (MCP later, once a project
  exists).
- decided with director: rtk needs no new work — the global settings already hook Bash/PowerShell
  through `rtk hook claude`, so shell output is token-filtered automatically. VISION.md/PROGRESS.md
  translated to English; the director reads the rubric on Discord in Korean instead, which matches the
  standing "the director does not read files" principle.
- **Gate 1 rewritten for Unity.** The Flutter gate is gone — the stack is fixed now.
  - Verified batchmode works on this PC and the license activates (exit 0, project created).
  - **Unity exits 0 with compile errors is real and dangerous.** The gate therefore judges compilation
    by exit code AND an `error CS####` log scan; either failing fails the gate. Tested: healthy
    project → exit 0; two injected compile errors → exit 1 with exact file/line. It discriminates.
  - The gate refuses to open a project whose editor version differs, rather than silently upgrading it.
  - Found and fixed: `Start-Process -PassThru` returns an EMPTY `.ExitCode` unless `$p.Handle` is
    touched before exit — it made every compile look inconclusive. The gate failed closed rather than
    passing, which is the correct behavior, but the cause is now fixed.
- swept every instruction file for Flutter/Pixel_9 leftovers (CLAUDE.md, tick skill, quality-loop,
  client-dev, gate-runner). Leaving them would have been textbook Goal Drift: the next tick reads
  CLAUDE.md and would have reached for Flutter while VISION.md said Unity.
- result: engine consistent on Unity. Still waiting on the director's first brief.
- **still unexercised**: the two gates against a real task. No game exists yet, and Unity MCP is not
  connected (deliberate — nothing to install it into).

## Tick 1c — 2026-07-16 — roles restructured (director rules 6-8)
- did: Rebuilt the gate structure from two gates to three, per director rules 6-8.
  - **Gate 2 is now the team lead at 90.** Every team is member + lead; the lead scores its own
    member's deliverable against that team's fixed rubric (`VISION.md` §3.2 — five rubrics written).
  - **Gate 3 is new: a 5-expert playtest panel** that ends app development. avg ≥90 AND nobody <80.
  - Gate 1 (mechanical) untouched — it is the only non-opinion signal in the whole system.
- **The floor is the real design decision.** `95·94·92·90·79` averages to exactly 90. That 79 is one
  expert saying something is badly wrong, and an average would ship it. The floor is what makes a
  five-expert panel better than one grader instead of just more expensive.
- retired: `evaluator` (single 95-point grader) and `judge`. Superseded. `explore` proposals are now
  scored by that team's own lead against the same rubric — one consistent standard per deliverable
  rather than an ad-hoc panel per mode.
- built: `team-lead` and `game-expert` as **2 generic agents**, not 10. Rubrics and the expert panel
  live in `VISION.md` §3.2/§3.3 and are passed per call. The director tunes the bar in one file, and
  near-duplicate agent files cannot drift apart. New workflow: `playtest.js`.
- guarded (ch.26): a lead is structurally on their team's side, which is the whole danger. Leads are
  given the deliverable and the rubric and **never the member's reasoning** — understanding *why* a
  shortcut was taken is exactly what makes a grader generous.
- **declined**: the director allowed per-member Discord bots for team chatter but flagged the token
  cost. Rejected — agents already exchange structured data inside the workflow, and Discord chatter
  would refill the listener's 100-message window, re-creating the cursor bug fixed the same day (the
  director's next brief stops being read). Recorded in `VISION.md` §6.
- rule 8 adopted: **Discord is the channel** for all director requests, result summaries, and
  permission/approval requests. It does not license blocking — send, mark `awaiting-approval`, and move
  to the next `ready` task.
- swept stale references (`evaluator`/`judge`/95/passMark) out of CLAUDE.md, the tick skill, BACKLOG,
  and server-dev. Leaving them is how Goal Drift starts.
- verified: both workflows parse; every `agentType` they call resolves to a real agent file.
- **still unexercised**: all three gates against a real task. No game exists yet.

## Tick 2 — 2026-07-16 06:45 — REPLY (tooling research)
- did: Scout drained the inbox and classified the director's 06:30 message as a question, correctly
  refusing to stretch a tooling request into a game brief. PM researched and replied on Discord.
- task: none (REPLY)
- result: replied.
- **why the director saw no answer for hours**: the listener was healthy the whole time and the message
  was sitting in `incoming.log` since 06:30. Nothing read it because **no tick was running**. Discord is
  an inbox, not a chat — the loop must be turning for anything to happen. `/loop /tick` was never
  started (deliberately: prove it by hand first, then the session ended). This is the failure mode the
  autonomous loop exists to remove, demonstrated live.
- findings (recommendation): the team already has what it needs — rtk is already hooked, 17 community
  skills installed. **One thing worth adding: the OFFICIAL Unity MCP** (`com.unity.ai.assistant`,
  needs Unity 6000.0+; we are on 6000.5.1f1 — verified in Unity's own docs). It would let QA read
  scene/console/tests directly instead of a 30-90s batchmode round trip, which is where Gate 3's
  evidence cost lives. Still pre-release (2.7.0-pre.3).
- **⚠️ real conflict found**: Unity MCP needs a **running Editor**, and a running Editor **holds the
  project lock** — the exact thing that makes `gate/gate.ps1` fail. Turning MCP on naively would break
  Gate 1 every run. Recorded in Do Not Repeat; the sequencing must be designed when the project is
  created, not discovered after the gate starts failing.
- declined: third-party Unity MCPs (CoplayDev, CoderGamester) — the official one exists.
- next: starting `/loop /tick` so the inbox is actually read from now on.

## Tick 3 — 2026-07-16 08:40 — first project brief; T001 launched
- did: Monitor fired on the director's 08:25 message — the loop woke on the event, not on the 30-min
  heartbeat. That is the responsiveness fix working.
- task: T001 (explore, planner) — spec the Life Town Unity rebuild
- result: project created, T001 running.
- brief: rebuild `lifetown` in Unity, but "make it better achieve the app's purpose" — not a port.
- **survey finding (delegated, read-only)**: the repo notes claimed lifetown "shipped through v0.0.5".
  **It never shipped** — that is an internal label; debug signing, test AdMob IDs, no developer account.
  It is 34,344 lines / 210 files / 27 screens of real, polished work. But **the integrity system does
  not exist**: no caps, no focus enforcement, no clock-tamper defense, and **no server at all** (no
  Cloud Functions). `economy.dart:10-12` admits it. The spec marks all of it Must.
- **the insight worth keeping**: the purpose is "내 시간과 노력을 눈에 보이게". If the timer can be
  cheated, the village mirrors nothing and becomes decoration — the purpose collapses. Making the
  village *trustworthy* may serve the brief more than any feature. **Not assumed** — handed to planner
  as one of three competing angles (trust / feel / ship) for the lead to score.
- scope deliberately NOT decided by the PM. 34k lines is not automatically the MVP; that is the
  director's call, and the winning proposal will go to Discord for approval.
- **three infrastructure bugs found and fixed** (all in our own code/usage, see Do Not Repeat):
  1. `meta` must be a pure literal — our `whenToUse` used `'a' + 'b'` concatenation. A broken meta makes
     a workflow **invisible**, so `name:` lookup says "not found" and *looks* like a discovery problem.
     Nearly recorded as the wrong lesson before both workflows appeared by name once meta parsed.
  2. `args` arrives as a **JSON string**, not an object — verified with both a large and a minimal
     payload. Died before any agent ran. Both workflows now coerce it.
  3. `Start-Process -PassThru` empty `.ExitCode` (fixed earlier, Tick 1b).
- note: Unity project created via batchmode (exit 0) and git-initialised with a Unity .gitignore —
  24 files tracked, Library/ excluded. Root `.gitignore` now excludes `/lifetown/`.

## Tick 3b — 2026-07-16 09:00 — T001 scored 83, rejected; explore revise loop added
- task: T001 (explore, planner)
- result: **NOT passed.** Best of 3 proposals scored **83/90**. 기획팀장 refused it.
- **the gate worked.** An 83 was not waved through as "basically there". That refusal is the whole
  reason this system exists — worth recording as evidence the bar is real, not decoration.
- winner: SHIP-FIRST. Its thesis: the original's failure was not missing features — it was 34,344
  lines / 27 screens / 61 test files reaching **zero players in a year**. Cut to 7 screens, ship a
  signed build to a store track in week 1, and treat "a stranger installed it and logged a session"
  as the only definition of done.
- lead's deductions (specific and fair):
  - **-4 P2: the integrity position is unimplementable as written.** The whole trust argument rests on
    a monotonic clock, and the spec never says how to get one in Unity (no SystemClock.elapsedRealtime
    JNI call, no Editor fallback, no injection seam). The lead's own words: that makes 관문 1
    decoration on the exact subsystem the proposal argued hardest for. Sharp catch.
  - -2 P1: defers the '보이게' half of the purpose; -2 P1: a 30-min "still there?" ping is policing,
    contradicting a target user defined as "무거운 생산성 앱엔 지친 사람".
  - -2 P2: ui-ux cannot start (village art direction unresolved); -3 P3: weakest return hook, admits it;
    -2 P3: ships a known-broken economy axis (25 min = Lv1→Lv5); -1 P4: 8-week timeline optimistic;
    -1 P5: cut Landmark without flagging it overrides a locked decision.
- **bug found in our own workflow**: `VISION.md` §5 says "Gate 2 below 90 → take the deductions, fix,
  re-score" — but **explore mode had no revise loop**. It escalated on the spot. Build mode revised;
  explore did not. Contract and code disagreed, and the code was wrong.
- fixed: explore now revises the winner with the lead's deductions + the losers' grafts, re-scores, and
  carries the same no-progress brake. Resumed via `resumeFromRunId` so the 3 proposals and round-1
  scoring replay from cache — no re-burn of 241k tokens.
- also fixed: the success path reported round-1 `perCriterion`, which goes stale after a revision.
- cost so far on T001: 4 agents, 241k subagent tokens, ~15 min.

## Tick 4 — 2026-07-16 09:15 — T001 PASSED 93; awaiting director approval
- task: T001 (explore, planner)
- result: **PASSED 93/90.** scoreHistory [83, 93], 2 rounds. Spec written to
  `lifetown/docs/spec/00-mvp-spec.md` (81,839 bytes) and committed to the app repo.
- score: P1 24/25 · P2 23/25 · P3 18/20 · **P4 15/15** · P5 13/15
- **the revise loop paid for itself immediately.** The bug I fixed this same tick was the difference
  between shipping an 83 as an escalation and shipping a 93. The lead's own round-2 note: "The prior
  round's two blockers are gone. §7.3 makes the load-bearing monotonic clock implementable."
- resume worked as designed: `workflowProgress` confirms the 3 proposals + round-1 lead replayed from
  cache (`cached: true`) and only revise + re-score ran live. 133k tokens instead of another 241k.
- **the planner found the thing nobody had measured**: Google Play personal developer accounts need
  **12 opted-in testers for 14 continuous days** before production. Unshortenable by coding, never on
  anyone's plan. At every moment of that year the original was — at best — an account + 12 humans + 14
  days away from a player. **That is why it sat at zero.** Shipping is now the longest-lead step and
  starts in week 1, before the product exists.
- other findings worth keeping:
  - The director's own 07-11 EXP curve `[0,30,120,360,1000]` lets one 25-min session take a building
    Lv1→Lv5 max, killing the EXP axis after session 1. The spec defaults to **his own earlier 07-10
    value**, not a planner's invention, and flags it. That is the right way to not-drift.
  - Landmark arithmetic: 2 × Tier2 Lv10 = ~25 h of logged time. A 14-day test at 1 h/day = 14 h.
    **No tester can reach one.** Cutting it is not laziness; building it would be content for zero humans.
  - D9: the spec was explicitly *permitted* to pay leisure less, and refused — "a leisure penalty is
    the exact mechanism that converts a neutral mirror back into a productivity app, quietly, through a
    constant, with no document ever saying so." Surfaced as the director's call rather than taken.
- **note on the count**: 14 of the original's 27 screens (52%) are social + mini-games, both locked
  OUT of MVP. The team built the half locked out and skipped the half locked in. §11.3 of the new spec
  asks for the MVP scope to become a `VISION.md` boundary so the gate can reject that — worth doing.
- next: awaiting the director. T001 is `awaiting-approval`; nothing else is `ready`, so the loop idles.
  Blocking answer is D7. D1 and D11 override locked decisions and need explicit approval.
