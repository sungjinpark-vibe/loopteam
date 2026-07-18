# VISION — Direction Document (Loop Contract)

> **Re-read this file every tick.** The state file (`state/PROGRESS.md`) says *where the loop is*;
> this document says *where it must go*. In long sessions, repeated summarization silently drops
> goals and constraints (**Goal Drift**). Re-reading this is the only thing that prevents it.
>
> English per director rule 3. **The director never has to open this file.** Anything they must decide
> — a rubric, a boundary, a stack change — the PM presents in Korean, on the channel §7 rule 8 currently
> specifies, and gets approval there.
>
> **This file is the tuning panel.** Rubrics (§3.2) and the expert panel (§3.3) live here on purpose:
> the director changes the bar by changing this file, not by editing agents.

---

## 1. Purpose of this loop

The director gives direction (intent, concept, feel). The dev team then builds — **repeating on its own
until the work clears the bar**. The director does not issue step-by-step instructions. They set the
bar, and approve or reject.

- **Director = the user.** Decides what to build, why, and how it should feel.
- **PM = the main agent.** Decides how, who, and — crucially — *when it is done*.
- The director does not read code. Whatever they need in order to decide, the PM shows them in Korean,
  on the channel §7 rule 8 currently specifies.

## 2. Current project — pointer only (per-project VISION files, director rule 2026-07-19)

**Every app carries its own contract**: `<app>/VISION.md`, inside the app's repo (director:
*"VISION 내용을 각 프로젝트에 분리해서 저장"*). This engine file holds only what is
project-independent — the gates, rubrics, boundaries, failure policy, standing rules. This section
never holds project detail again; it only points.

- **Active project: none — the mission is the loop engine itself** (director, 2026-07-19: *"우리 루프
  엔지니어링 팀의 고도화가 먼저"*). Direction within engine work is set by the director per task.
- **Paused** (not cancelled): **touchRPG** (2026-07-19, P0 complete, Gate 3 pending) →
  `touchRPG/VISION.md`. **Life Town** (2026-07-17, next step already decided: real gameplay) →
  `lifetown/VISION.md`.

**Tick rule**: when a project is active, Step 0 reads the engine `VISION.md` **and** that app's
`VISION.md` — both, every tick. Paused projects' files are not read (that is the token point).
**To resume**: point `state/loop.json` `project` at the app; its `VISION.md` carries its own resume
banner. **To start a new app**: create `<app>/VISION.md` from the brief before any code (see tick
skill Step 2).

## 3. Stop conditions — the loop's constitution

> ch.14: *"The stop condition must live OUTSIDE the agent's claim, not inside it."*
> ch.29: *"A loop must stop on a signal, not an opinion."*

There are **three gates**. Two close a *task*; the third closes the *app*.

| Gate | Scope | Who judges | Bar |
|---|---|---|---|
| **1. Mechanical** | every task | nobody (a command) | exit code 0 |
| **2. Team lead** | every task | that team's lead | **≥ 90 / 100** |
| **3. Expert playtest** | the app | 5 game experts | **avg ≥ 90 AND nobody < 80** |

**Order is load-bearing. A broken build is never scored** — it is the easiest way to fool a grader and
the shortest road back to a Nodding Loop.

An agent saying "it's finished" is **not** evidence of completion. Only a passed gate is.

### 3.1 Gate 1 — Mechanical (objective signal; first, always)

No human, no LLM. A command returns 0 or it does not.

- Scripts compile with zero C# errors
- EditMode tests pass (when the project has any)
- The build succeeds
- **The game actually runs and the changed behavior appears**

Run via `gate/gate.ps1`. **If this gate fails, no scoring happens at all.**

> Unity note (do not "simplify" this away): Unity in batchmode is known to exit 0 even when scripts
> failed to compile. The gate judges compilation by **both** the exit code **and** a scan of the editor
> log for `error CS####`; either failing fails the gate. Verified 2026-07-16 against an injected error.

### 3.2 Gate 2 — Team lead (90 points, per task)

Every team is **member + lead**. The member produces; the lead scores against the team's fixed rubric.
**≥ 90 passes. 89 does not.** Below 90 → itemized deductions → the member reworks.

> **Why this needs guarding (ch.26 self-preferential bias).** A lead is structurally on their team's
> side — someone who understands *why* a shortcut was taken forgives it. So the lead:
> - **never sees the member's explanation or reasoning** — only the deliverable and the rubric
> - scores against the rubric below, **fixed before the work started**
> - must be able to fail it. A lead who always lands on 90+ is decoration, not a gate.

#### 기획팀장 — planner's lead (scores the spec)
| # | Criterion | Max | What is examined |
|---|---|---|---|
| P1 | Fidelity to the director's intent | 25 | Is the brief's core actually alive in the spec? |
| P2 | Ready to start from | 25 | Can dev/art begin **without asking a question**? |
| P3 | Core loop design | 20 | Does the loop actually cycle — not a feature list? |
| P4 | Scope honesty | 15 | Is the MVP a real MVP, not padded? |
| P5 | Open decisions surfaced | 15 | Are assumptions/undecided items visible, not buried? |

#### 아트팀장 — ui-ux's lead (scores the design)
| # | Criterion | Max | What is examined |
|---|---|---|---|
| A1 | Intent made visual | 25 | Is the concept translated into screens? |
| A2 | Design-system consistency | 25 | Do tokens (color/type/spacing) hold across screens? |
| A3 | Implementable specificity | 20 | Are hex, px, and states all pinned down? |
| A4 | Accessibility | 15 | Contrast, touch targets, legibility |
| A5 | Originality | 15 | Did it escape templated AI defaults? |

#### 클라이언트팀장 — client-dev's lead (scores Unity code)
| # | Criterion | Max | What is examined |
|---|---|---|---|
| C1 | Spec satisfied | 30 | Does the requirement work **on screen**? |
| C2 | Correctness | 25 | Boundaries, null, mashed input, state persistence |
| C3 | Unity structure | 20 | Single-responsibility MonoBehaviours, data in ScriptableObjects |
| C4 | Performance | 15 | Update abuse, GC allocation, draw calls |
| C5 | No regression | 10 | Existing screens/flows still work |

#### 서버팀장 — server-dev's lead (scores backend)
| # | Criterion | Max | What is examined |
|---|---|---|---|
| S1 | API contract satisfied | 30 | Does it match the documented contract exactly? |
| S2 | Data integrity | 25 | Can scores/progress be lost, duplicated, or raced? |
| S3 | Security | 20 | Input validation, auth, secret handling |
| S4 | Failure handling | 15 | What happens when it breaks? |
| S5 | Docs in sync | 10 | Do the API docs match the code? |

#### QA팀장 — qa's lead (scores the QA work itself)
| # | Criterion | Max | What is examined |
|---|---|---|---|
| Q1 | Coverage | 30 | Are the spec's flows and edges actually exercised? |
| Q2 | Reproducibility | 25 | Do the repro steps actually reproduce it? |
| Q3 | Evidence quality | 25 | Observed **facts**, not verdicts or vibes |
| Q4 | Severity judgment | 20 | Is what blocks a release separated from what does not? |

### 3.3 Gate 3 — Expert playtest (the app's completion line)

**This is the gate that ends app development.** Five game experts assess the built game.

- Each scores **0-100**, independently, from their own lens.
- **Pass = average ≥ 90 AND no single expert below 80.**
  The floor exists because an average hides a killer: `95, 94, 92, 90, 79` averages to 90, but that 79
  is one expert saying something is badly wrong. The average would ship it. The floor does not.
- Below the bar → itemized deductions → the team fixes → re-playtest.

> **Honest limit, recorded on purpose.** These experts are LLM agents. **They cannot literally play a
> game or feel fun.** What actually happens: `qa` drives the real build and records observed facts
> (screenshots, logs, a step-by-step run), and each expert scores **that evidence** through their lens.
> This is far better than one grader guessing from code — but it is not a human playtest, and it must
> never be reported to the director as one.
>
> For this to be a gate at all: ① Gate 1 passed, ② the panel and rubric are fixed in advance,
> ③ every criterion is checkable against a real run, ④ no expert built the thing. Break any of the four
> and this is five agents nodding instead of one (**Nodding Loop**).

#### The panel — five deliberately different lenses
Redundant experts catch the same things. These are chosen to disagree.

| Expert | Lens | What only this one catches |
|---|---|---|
| **game-designer** | Core loop, balance, pacing | Does the loop close? Is the reward on time? Is it trivially exploitable? |
| **ux-researcher** | First 30 seconds, learnability | Understandable without a tutorial? Where do players drop out? |
| **liveops-pd** | Retention, motivation | **Is there a reason to open it tomorrow?** Does progress feel owned? |
| **qa-lead** | Stability, edges | Mashing, empty data, interruption, resume — does it hold? |
| **target-player** | Fun, for the actual target | Would the real target player (§2) enjoy this, or only an adult reviewer? |

#### Shared rubric — each expert scores all five, weighted by their lens
| # | Criterion | Max |
|---|---|---|
| E1 | Fun / motivation to continue | 30 |
| E2 | Core loop works end to end | 25 |
| E3 | Polish (no blanks, breaks, placeholders) | 20 |
| E4 | Clarity (understandable without explanation) | 15 |
| E5 | Stability under abuse | 10 |

> Each expert scores **all five criteria**, but weights their own lens hardest and says so. Five full
> independent assessments beat five partial ones — and disagreement between them is signal, not noise.

### 3.4 Failure brakes (hard limits)

With only a success brake, a loop never stops on work that can never succeed.

- **Max 5 rounds** per task (Gate 2) and per playtest cycle (Gate 3).
- **No-progress detection**: if the score does not move (±2) across 3 rounds, stop.
  Circling in place is not iteration, it is waste.
- Work stopped by a limit is **never marked done**. It goes to **Needs Human Review** in
  `state/PROGRESS.md` and is reported to the director with the score history (channel per §7 rule 8).

## 4. Boundaries — what not to do

> ch.18: *"A good boundary defines how far the agent may go alone, rather than dictating what to fix."*

**Allowed without approval**
- Writing/editing code, docs, and tests inside the project folder; running Unity
- Updating `backlog/` and `state/`; committing and pushing the project repo
- Reporting and asking questions to the director (channel per §7 rule 8)
- **2026-07-18 standing grant**: *"프로토타입이 나올 때까지 내 허락없이 진행해줘"* — chain P0 tasks
  (T004 onward, and whatever remains toward a playable P0) **without pausing to ask "continue?" between
  them.** This does NOT waive anything else in this section — still no finalizing a design decision, no
  stack/monetization change, no rubric edit, and still report honestly (scores, deductions, fixes) as
  each task lands; it only removes the *"should I proceed to the next task"* checkpoint until a
  playable P0 prototype exists. Once P0 is feature-complete, that **is** the prototype — report it, don't
  keep inventing further work under this grant.

**Requires director approval**
- **Finalizing** a spec, design, art direction, or API contract (proposing is free; finalizing is not)
- Changing the stack, adding a paid service, changing monetization/ads
- Store release, or handing out a build
- **Changing any rubric or the expert panel in §3** — the bar is the director's, not the team's

**Never**
- Modifying anything outside `loop_engine/`. In particular **never `git add` from the home folder
  (`C:\Users\user`)** — it is an accidental git repo and would swallow the whole home directory.
  Problems found in other projects (e.g. `app-dev-team`) get **recorded, not fixed** (director ruled
  2026-07-16).
- Exposing secrets (`.discord/config.json`) in logs, commits, or messages
- Disabling tests, or lowering a rubric, to make something pass
- Writing off a Gate 1 failure as "an environment problem" and marking work done
- Rewriting project history (force push) without director approval
- **Deleting a file or directory that was not explicitly named as the target** — even one that looks
  like obvious build/log garbage (found 2026-07-18: a QA subagent `rm -rf`'d a stray nested folder it
  judged safe; it turned out to genuinely be safe — a duplicate log dir from a gate.ps1 bug, since fixed
  — but "gitStatus is clean" only proves nothing tracked would be lost, not that the folder's actual
  contents are disposable). Report the stray path to the PM instead and let a human/PM-level decision
  authorize the delete, the same way a boundary question would be surfaced.

## 5. Failure policy

> ch.18: *"Most bad loops have no failure policy, so the agent improvises when something breaks."*

Decided in advance. No improvising.

| Situation | Response |
|---|---|
| Gate 1 fails | Fix and retry. **Do not score.** |
| Gate 2 below 90 | Take the itemized deductions, fix, re-score |
| Gate 3 below bar (avg <90, or anyone <80) | Deductions → fix → re-playtest |
| Same check fails twice in a row | Hand to human review |
| Score flat for 3 rounds | Stop iterating, hand to human review |
| 5-round limit reached | Stop. **Never mark done.** Report to the director with the score history (channel per §7 rule 8). |
| A lead/expert refuses to score (rubric does not fit) | Stop and escalate — do not force a score |
| Boundary (§4) violation detected | **Stop immediately.** Revert and report to the director. |
| Unity/build infrastructure failure | Return the task to `ready`; record the cause in `Do Not Repeat` |

## 6. Budget guardrails

> ch.27/32: a loop without limits is not automation, it is an open-ended bill.

- Max **5 rounds** per task and per playtest cycle
- **Gate 3 is a milestone gate, not a per-task gate.** Run the 5-expert playtest when a meaningful
  slice is playable — not after every task. Five experts × 5 rounds on a half-built screen is pure burn.
- With nothing to do, **go idle**. Never manufacture work.
- Nudge about pending approvals **once every several ticks**, never every tick
- The director can stop the team at any time via `paused: true` in `state/loop.json`

### Agents do not talk over Discord
The director allowed adding per-member Discord bots for team chatter (2026-07-16) but flagged the token
cost. **Decision: do not.** Agents already exchange structured data directly through the workflow —
routing that through Discord adds polling and round-trips and buys nothing. Worse, it would refill the
listener's 100-message window with team chatter and re-create the exact cursor failure fixed on
2026-07-16: **the director's next brief would stop being read.**

**Discord is the director's channel only.** Team-internal communication stays inside the workflow.

## 7. Standing director rules (2026-07-16)

1. **Permissions** follow `C:\Users\user\.claude\settings.json` (the parent `.claude`). Do not add
   project-local permission settings that override it.
2. **Use `rtk` always.** The global settings already hook Bash/PowerShell through `rtk hook claude`,
   so shell output is token-filtered automatically.
3. **English for everything except reports to the director.** Docs, code, comments, commits, agent
   prompts, backlog, state — English. Discord and in-session reports to the director — Korean.
4. **Work token-efficiently.** Delegate reading; keep `PROGRESS.md` a cockpit, not a warehouse.
5. **Unity only** (locally installed, 6000.5.1f1). Not Flutter. Connect Unity MCP when a project
   exists and it is needed.
6. **Every team is member + lead; the lead gates at 90** (§3.2).
7. **The app ends at the 5-expert playtest gate** (§3.3), not at the PM's judgment.
8. **Reports to the director go to Discord.** (Superseded 2026-07-18 by the director, in-session:
   *"지금부터 답변은 디스코드로 해줘."* — overrides the 2026-07-17 in-session-only default below.)
   - **CURRENT (2026-07-18 →): answer via Discord**, via `.discord\send.ps1` (absolute path), **even
     when the director is talking in-session.** Do not silently fall back to in-session replies — this
     was an explicit, unqualified instruction ("from now on"), not a one-off.
   - The in-session chat window is still fine for quick back-and-forth *during* a live conversation
     (e.g. this kind of instruction itself, or a clarifying question mid-task) — but the actual
     deliverable/report/decision-grade summary goes to Discord.
   - *(Dormant unless the director reverts to it)* — the 2026-07-17 rule was: if talking in-session,
     answer in-session only, never mirror to Discord; Discord was for when he is away; judge by where he
     last spoke. That heuristic is **not in effect** while the 2026-07-18 instruction stands. If the
     director later says something like "다시 세션 안에서 답해줘" or stops mentioning Discord, ask which
     regime applies rather than silently reverting — the whole point of writing this down is to not
     re-litigate it from memory.
   - This does not license blocking. A permission request is sent and the task is marked
     `awaiting-approval`; the loop **moves to the next `ready` task** (§4, §6).
   - The listener must run whenever the team is idle, or a brief simply never arrives.
     `LoopEngine-DiscordDaemon-Watchdog` keeps it alive; leave it enabled. **Drain the inbox every tick.**
     A Discord message sent in the same window as other work is otherwise stepped over by the cursor and
     silently lost (this actually happened 2026-07-17: the director's *"실제 게임 동작 진행해줘"* sat
     unread through a project switch).
   - **Agents still do not talk over Discord** (§6). The channel is director ↔ PM only.
   - Korean either way (rule 3).

---

## Change log
- 2026-07-16 Created (project unassigned template).
- 2026-07-16 Director rules 1-5 added. Stack fixed to Unity; Gate 1 rewritten for Unity;
  translated to English per rule 3.
- 2026-07-16 **Roles restructured (rules 6-7).** Every team is member + lead, lead gates at 90 (§3.2).
  App completion moved to a 5-expert playtest panel at avg ≥90 with an 80 floor (§3.3). The old single
  95-point `evaluator` is retired — superseded by the team leads and the expert panel. `judge` retired
  too: `explore` proposals are now scored by that team's own lead against the same fixed rubric, so
  every deliverable is judged by one consistent standard.
- 2026-07-17 **Project switch**: Life Town paused (resumable — snapshot in `lifetown/docs/paused-state/`), **touchRPG** begins. §2 rewritten; concept pending the director's brief (the PM must not invent it). Team, gates, rubrics (§3), boundaries (§4) and failure policy (§5) carry over **unchanged** by director's instruction.
- 2026-07-17 **Rule 8 amended** (director): Discord is the *async* channel. In-session (VS Code) conversation is answered in-session only and never mirrored to Discord; Discord carries what happens while he is away. Also made "drain the inbox every tick, including in-session ticks" explicit after a real message was skipped.
- 2026-07-17 **System audit** (director-requested): every remaining unconditional "report on Discord" in this file, `CLAUDE.md`, the tick skill, and agent files was aligned with rule 8 ("channel the director last spoke in"). No rules changed — wording only. Companion fixes: stale GDD pointers → v0.3, TBD list → the 10 live ones, `gate.ps1` now version-checks a supplied `-UnityExe` (closing a silent-upgrade backdoor), quality-loop escalates immediately on a round-1 grader refusal, playtest re-runs the compile gate after each fix round.
- 2026-07-18 **Rule 8 superseded** (director, in-session): *"지금부터 답변은 디스코드로 해줘."* Reports
  now go to Discord unconditionally, even in-session — the 2026-07-17 in-session-only default is dormant,
  not deleted, in case the director reverts it later. Every file that pointed at "§7 rule 8" for its
  channel logic (VISION §1/§3.4/§5, `CLAUDE.md`, the tick skill, `loop-scout`) follows automatically —
  none of them hardcode the heuristic, they all defer to this section.
- 2026-07-18 **GDD → v0.4** (director, via Discord, answering questions asked 2026-07-17): TBD-11
  resolved (dev priority = P1), TBD-12 resolved (shield = damage reduction on timed defense; exact %
  moved to new TBD-14), TBD-13 resolved (range axis introduced; exact mechanism + how 총 is kept from
  structurally dodging melee patterns moved to new TBD-15). §2 spec pointer moved to v0.4.
- 2026-07-18 **Standing grant — proceed without approval to a prototype** (director, in-session):
  *"프로토타입이 나올 때까지 내 허락없이 진행해줘."* §4 amended: chain remaining P0 tasks without an
  inter-task "continue?" checkpoint until P0 is playable. Everything else in §4 still applies unchanged.
- 2026-07-19 **touchRPG paused; engine improvement first** (director, in-session): *"touchRPG도
  이쯤에서 마무리해줘. 우리 루프 엔지니어링 팀의 고도화가 먼저 되어야 할 것 같아."* §2 header marked
  paused (resume state in `state/PROGRESS.md`). The 2026-07-18 standing grant is fulfilled/expired with
  P0's completion — it does not carry over to engine work. Current mission: the loop engine itself,
  direction set by the director per task.
- 2026-07-19 **Token-economy restructure** (PM, under the director's engine-improvement directive):
  §2 slimmed to a paused-projects table — touchRPG's full §2 moved verbatim to
  `touchRPG/docs/paused-state/VISION-s2-snapshot.md` (same pattern as lifetown's 2026-07-17 snapshot);
  the separate Life Town subsection folded into the same table. `state/loop.json` stale narrative blobs
  removed (one carried the superseded 2026-07-17 channel rule). `state/PROGRESS.md` rewritten as a true
  cockpit (touchRPG detail → `PROGRESS-snapshot.md`). `CLAUDE.md` deduplicated to pointers (gates → §3,
  tick → the skill, escalation → §5, daemon internals → `.discord/DAEMON.md`). No rule *content*
  changed — only where each rule lives. Per-tick fixed overhead roughly halved.
- 2026-07-19 **Per-project VISION split** (director: *"VISION 파일의 내용을 각 프로젝트에 분리해서
  저장하면 안되나?"*): every app now carries its own contract at `<app>/VISION.md`, inside the app's
  repo — created for touchRPG (from the §2 snapshot, promoted to repo root) and Life Town (extracted
  from its paused-state snapshot). This engine file keeps only project-independent content; §2 is a
  pointer, never project detail. Tick Step 0 reads the engine VISION + the active app's VISION (paused
  apps' files are not read). New-app bootstrap (tick Step 2) writes `<app>/VISION.md` before any code.
