# VISION — Direction Document (Loop Contract)

> **Re-read this file every tick.** The state file (`state/PROGRESS.md`) says *where the loop is*;
> this document says *where it must go*. In long sessions, repeated summarization silently drops
> goals and constraints (**Goal Drift**). Re-reading this is the only thing that prevents it.
>
> English per director rule 3. **The director never has to open this file.** Anything they must decide
> — a rubric, a boundary, a stack change — the PM presents in Korean on Discord and gets approval there.
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
- The director does not read code. Whatever they need in order to decide, the PM shows on Discord.

## 2. Current project — touchRPG (scaffolded; **brief pending**)

| Field | Value |
|---|---|
| Name | **touchRPG** |
| Stack | **Unity 6000.5.1f1** (fixed by director rule §7.5 — not a per-project choice) |
| One-line concept | _(awaiting the director's brief — asked on Discord 2026-07-17)_ |
| Target player | _(awaiting the director's brief)_ |
| Project folder | `C:\Users\user\loop_engine\touchRPG` (own git repo; gitignored from the engine) |
| Director's brief | 2026-07-17: *"이 프로젝트는 잠시 중단하고 새로운 게임 개발을 시작. touchRPG 폴더 생성해서 신규 개발 준비. 게임 개발은 현재 개발팀과 시스템을 그대로 사용."* |
| Spec | _(none yet — `T001` opens when the brief lands)_ |
| Scope | _(pending the brief)_ |
| Completion | **The 5-expert playtest gate (§3.3)** — unchanged. |

### Status: scaffolding only — do NOT invent the concept
Folder, git repo, and `docs/{spec,design,api,qa}` are ready. The loop is **waiting on the director's
concept brief**. The name alone ("touchRPG") is not a brief. Per §4, the PM must not invent the game
concept, genre, or target player. When the brief arrives:
1. Fill in this section (concept, target player, scope).
2. Open `T001` as an `explore` task for `planner` (the detailed spec).
3. Send the proposed scope to the director for approval — the spec task itself may start immediately;
   only its *output* needs approval.

**The team and system carry over unchanged** (director, 2026-07-17): same agents, same three gates,
same rubrics (§3.2), same expert panel (§3.3), same boundaries (§4) and failure policy (§5).

### Paused project — Life Town (resumable, not cancelled)
Paused by the director 2026-07-17 evening. Fully preserved:
- **Code + renders**: `lifetown/` (own repo, everything committed).
- **Contract snapshot at pause**: `lifetown/docs/paused-state/` — its VISION §2, its PROGRESS cockpit,
  its `backlog/` + task files.
- **Where it stopped**: all 7 category buildings + a polished village scene (v2), gate-green (81/81).
  **The open question was already answered** — 2026-07-17 17:56 the director replied *"실제 게임 동작
  진행해줘"*: village v2 is accepted, **proceed to real gameplay** (tap building → timer → growth/build,
  wiring Economy.Core T002 + Platform T003 + design system T004 into the village) → playable slice →
  Gate 3. Do **not** re-ask polish-vs-gameplay on resume. Full history in `state/journal.md`.
- **To resume**: restore §2 from that snapshot, restore its backlog, point `loop.json.project` back to
  lifetown, and continue from its PROGRESS "Next Run Should".

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
  `state/PROGRESS.md` and is reported on Discord with the score history.

## 4. Boundaries — what not to do

> ch.18: *"A good boundary defines how far the agent may go alone, rather than dictating what to fix."*

**Allowed without approval**
- Writing/editing code, docs, and tests inside the project folder; running Unity
- Updating `backlog/` and `state/`; committing and pushing the project repo
- Reporting and asking questions on Discord

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
| 5-round limit reached | Stop. **Never mark done.** Report on Discord with the score history. |
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
8. **Discord is the channel.** All work requests and instructions from the director, all result
   summaries, and **all permission/approval requests** go through Discord — in Korean.
   - This does not license blocking. A permission request is sent and the task is marked
     `awaiting-approval`; the loop **moves to the next `ready` task** (§4, §6).
   - The listener must be running whenever the team is idle, or a brief simply never arrives.
     `LoopEngine-DiscordDaemon-Watchdog` keeps it alive; leave it enabled.
   - **Agents still do not talk over Discord** (§6). The channel is director ↔ PM only.

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
