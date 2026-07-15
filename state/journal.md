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
- note: 18장 says do not schedule a loop before it runs cleanly by hand. Watchdog scheduled task
  deliberately NOT registered yet. Run `/tick` manually first.

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
