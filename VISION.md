# VISION — Direction Document (Loop Contract)

> **Re-read this file every tick.** The state file (`state/PROGRESS.md`) says *where the loop is*;
> this document says *where it must go*. In long sessions, repeated summarization silently drops
> goals and constraints (**Goal Drift**). Re-reading this is the only thing that prevents it.
>
> Written in English per the director's rule: everything except reports to the director is English.
> **The director never has to open this file.** Anything they must decide — the rubric, the
> boundaries, a stack change — the PM presents in Korean on Discord and gets approval there.

---

## 1. Purpose of this loop

The director gives direction (intent, concept, feel). The dev team then builds — **repeating on its own
until the work clears the bar**. The director does not issue step-by-step instructions. They set the
bar, and approve or reject.

- **Director = the user.** Decides what to build, why, and how it should feel.
- **PM = the main agent.** Decides how, who, and — crucially — *when it is done*.
- The director does not read code. Whatever they need in order to decide, the PM shows on Discord.

## 2. Current project

| Field | Value |
|---|---|
| Name | _(unassigned — awaiting first brief)_ |
| Stack | **Unity 6000.5.1f1** (fixed by director rule — not a per-project choice) |
| One-line concept | _(TBD)_ |
| Project folder | _(TBD)_ |

> When the first brief arrives, the PM fills this table and rewrites sections 3-5 for the project.
> **Until it is filled, this loop writes no code.**

## 3. Stop condition — the loop's constitution

> ch.14: *"The stop condition must live OUTSIDE the agent's claim, not inside it."*
> ch.29: *"A loop must stop on a signal, not an opinion."*

Work is **done** only after clearing **both gates, in this order**. Failing either one means not done.
An agent saying "it's finished" is **not** evidence of completion.

### Gate 1 — Mechanical (objective signal; must pass first)

No human, no LLM. A command returns 0 or it does not.

- Scripts compile with zero C# errors
- EditMode tests pass (when the project has any)
- The build succeeds
- **The game actually runs and the changed screen/behavior appears**

Run via `gate/gate.ps1`. **If this gate fails, no scoring happens at all.**
Scoring a broken build is meaningless, and it is the most common way a grader gets fooled.

> Unity note (do not "simplify" this away): Unity in batchmode is known to exit 0 even when scripts
> failed to compile. The gate therefore judges compilation by **both** the exit code **and** a scan of
> the editor log for `error CS####`, and either one failing fails the gate. Verified 2026-07-16
> against an injected compile error.

### Gate 2 — Rubric (95 points)

> ch.12: *"For work with no single right answer, build a rubric and score it."*

What machines cannot judge — fun, polish, fidelity to intent — is **scored by the planning team
(`evaluator`) against a rubric**.

- **Pass mark: 95 out of 100.**
- The grader is **not the builder**. It never sees the implementer's explanation or reasoning — only
  the rubric and **observed behavior** (screenshots, logs, a recorded run).
- The rubric is **written before the work starts**. A rubric written during grading bends to fit the
  result.
- Below 95, the grader returns **itemized deductions** and the work is redone.

#### Rubric (director adjusts once the project is set)

| # | Criterion | Max | What is examined (must be observable) |
|---|---|---|---|
| 1 | Fidelity to intent | 30 | Does the spec's core intent actually appear on screen? |
| 2 | Core loop works | 25 | Does the main flow run start to finish without breaking? |
| 3 | Polish | 20 | No blank screens, broken layout, or leftover placeholders |
| 4 | Fun / motivation | 15 | Are reward, feedback, and progress actually felt? |
| 5 | Failure handling | 10 | Empty data, errors, and mashed input do not collapse the game |

> **Honest caveat, recorded on purpose.** A 95 from an LLM is still an opinion. For it to work as a
> real gate: ① Gate 1 must have passed first, ② the rubric must be fixed in advance, ③ every criterion
> must be **checkable against a real run**, and ④ the grader must be separate from the builder. Break
> any of the four and this is not a gate — it is two agents nodding at each other (**Nodding Loop**).

### Failure brakes (hard limits)

With only a success brake, a loop never stops on work that can never succeed.

- **Max 5 rounds.** Not at 95 within 5 rounds → stop and hand it to the director.
- **No-progress detection**: if the score does not move (±2) across 3 rounds, stop. Circling in place
  is not iteration, it is waste.
- Work stopped by a limit is **never marked done**. It goes to **Needs Human Review** in
  `state/PROGRESS.md` and is reported on Discord.

## 4. Boundaries — what not to do

> ch.18: *"A good boundary defines how far the agent may go alone, rather than dictating what to fix."*

The loop runs unattended, so the range it may act in alone is deliberately **narrow**.

**Allowed without approval**
- Writing/editing code, docs, and tests inside the project folder; running Unity
- Updating `backlog/` and `state/`; committing and pushing the project repo
- Reporting and asking questions on Discord

**Requires director approval**
- **Finalizing** a spec, design, art direction, or API contract (proposing is free; finalizing is not)
- Changing the stack, adding a paid service, changing monetization/ads
- Store release, or handing out a build

**Never**
- Modifying anything outside `loop_engine/`. In particular **never `git add` from the home folder
  (`C:\Users\user`)** — it is an accidental git repo and would swallow the whole home directory.
  Problems found in other projects (e.g. `app-dev-team`) get **recorded, not fixed** — the director
  ruled on this 2026-07-16.
- Exposing secrets (`.discord/config.json`) in logs, commits, or messages
- Disabling tests, or lowering the rubric, to make something pass
- Writing off a Gate 1 failure as "an environment problem" and marking work done
- Rewriting project history (force push) without director approval

## 5. Failure policy

> ch.18: *"Most bad loops have no failure policy, so the agent improvises when something breaks."*

Decided in advance. No improvising.

| Situation | Response |
|---|---|
| Gate 1 fails | Fix and retry. Do not score. |
| Rubric below 95 | Take the itemized deductions, fix, re-score |
| Same check fails twice in a row | Hand to human review |
| Score flat for 3 rounds | Stop iterating, hand to human review |
| 5-round limit reached | Stop. **Never mark done.** Report on Discord. |
| Boundary (§4) violation detected | **Stop immediately.** Revert and report to the director. |
| Unity/build infrastructure failure | Return the task to `ready`; record the cause in `Do Not Repeat` |

## 6. Budget guardrails

> ch.27/32: a loop without limits is not automation, it is an open-ended bill.

- Max **5 quality-loop rounds** per task
- With nothing to do, **go idle**. Never manufacture work.
- Nudge about pending approvals **once every several ticks**, never every tick
- The director can stop the team at any time via `paused: true` in `state/loop.json`

## 7. Standing director rules (2026-07-16)

1. **Permissions** follow `C:\Users\user\.claude\settings.json` (the parent `.claude`). Do not add
   project-local permission settings that override it.
2. **Use `rtk` always.** The global settings already hook Bash/PowerShell through `rtk hook claude`,
   so shell commands are token-filtered automatically. Prefer `rtk read`/`rtk grep`/`rtk test` over
   raw equivalents where a tool does not already cover it.
3. **English for everything except reports to the director.** Docs, code, comments, commits, agent
   prompts, backlog, state — English. Discord messages and in-session reports to the director — Korean.
4. **Work token-efficiently.** Delegate reading; keep `PROGRESS.md` a cockpit, not a warehouse.
5. **Unity only** (locally installed, 6000.5.1f1). Not Flutter. Connect Unity MCP when a project
   exists and it is needed.

---

## Change log
- 2026-07-16 Created (project unassigned template).
- 2026-07-16 Director rules 1-5 added. Stack fixed to Unity (was PM's choice between Flutter/Unity);
  Gate 1 rewritten for Unity; document translated to English per rule 3.
