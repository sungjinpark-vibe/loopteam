# Backlog

The loop's work queue. **This file is the single source of truth for what to do next** — the loop's
context gets summarized and reset, but this file survives. If it isn't written here, it doesn't exist.

Owned by `loop-scout` (writes) and the PM (reads, and marks done). One row per task, highest priority
at the top. Reorder rows to reprioritize.

**Current project: touchRPG.** Life Town is paused (resumable); its finished backlog + task files are
archived at `lifetown/docs/paused-state/backlog/`.

## Status values

| Status | Meaning | Loop picks it up? |
|---|---|---|
| `ready` | Approved and unblocked. Go. | **Yes** |
| `in-progress` | A quality loop is running on it right now. | No (already running) |
| `awaiting-approval` | Waiting on the user to approve a spec/design/decision. | **No — skip past it** |
| `blocked` | Blocked by another task, or by something the PM can't resolve. | **No — skip past it** |
| `done` | Shipped and verified. | No |
| `dropped` | Decided against. Kept for the record. | No |

**The rule that makes the loop autonomous:** `awaiting-approval` and `blocked` tasks are *skipped*, not
waited on. The loop always moves to the next `ready` task. It only goes idle when nothing at all is ready.

## Queue — touchRPG

| ID | Title | Status | Agent | Mode | Priority | Notes |
|---|---|---|---|---|---|---|
| T001 | P0-A — parry core (the "손맛" prototype) | `in-progress` | client-dev | build | 1 | quality-loop running (클라이언트팀장, 90). Answers GDD §10's single P0 question: *"터치 패링이 손맛이 있는가"*. |
| T002 | P0-B — remaining input (IN-3 회피존, IN-5 차지, IN-6 러시) + 람팡 P2-P7 | `blocked` | client-dev | build | 2 | Depends on T001. Do **not** start until the 손맛 question is answered (GDD §10). |
| T003 | P0-C — 3-phase session + solo run to completion | `blocked` | client-dev | build | 3 | Depends on T002. GDD §5.1; grogg y rush guaranteed once per phase transition. |
| T004 | P0-D — combat UI §6.1-6.2 completion | `blocked` | ui-ux → client-dev | — | 4 | Depends on T001. Marker visual language, party layer. |

> **Numbering restarts at `T001` for touchRPG.** Life Town's T001-T008 live in its archive, not here.
>
> **The spec was written by the director** — `touchRPG/docs/spec/00-gdd-v0.1.md` (GDD v0.1). There is no
> `planner` spec task: the GDD *is* the spec and the **single source of truth**. T001+ implement it.
>
> **P1/P2 are not in this queue on purpose.** GDD §10: do not start P1 (party, talismans, daily loop)
> before P0's question — *"터치 패링이 손맛이 있는가"* — is answered.
>
> **TBD-1…TBD-7 (GDD §13) MUST NOT be filled in by the team.** They are the director's, deliberately.

## Task file format

Every task gets `backlog/tasks/<id>.md`. ID = `T###` (zero-padded, never reused within a project).

```markdown
---
id: T001
title: Short imperative title
status: ready
agent: client-dev        # planner | ui-ux | server-dev | client-dev | qa
mode: build              # build (implement→gate→lead scores 90→revise) | explore (N proposals→lead picks winner)
priority: 1              # 1 = highest
created: 2026-07-17
depends_on: []           # [T000] — task is `blocked` until these are `done`
---

## Brief
What to do. Concrete enough for the agent to start without asking.

## Acceptance criteria
- [ ] Specific, checkable things. The team lead scores against these, so vague
      criteria produce vague verdicts and wasted revise rounds.

## Context
Relevant file paths, spec excerpts, links, prior decisions.

## Log
- 2026-07-17 created from Discord message 123456789
```

## Choosing `mode`

- **`explore`** — the solution space is wide and the output is a *document or decision*: specs, feature
  design, gamification loops, architecture choices, art direction. Runs N proposals from different
  angles in parallel and picks a winner. Safe in parallel because nothing writes files.
- **`build`** — the output is *code* and the answer is roughly known. Implements once, clears the
  mechanical gate, QA gathers evidence, then the team lead scores it against that team's rubric — and
  it revises until it clears 90.

When unsure: if you could imagine three genuinely different good answers, use `explore`.

> **Token economy (director, 2026-07-17):** for *proven-pattern* work prefer the **frugal path** — one
> subagent + `gate/gate.ps1` + a PM check + honest disclosure — and reserve the full quality-loop
> workflow for genuinely novel or risky work. This is a cost rule, not a quality rule: the gates still
> decide "done."
