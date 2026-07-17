# Backlog

The loop's work queue. **This file is the single source of truth for what to do next** — the loop's
context gets summarized and reset, but this file survives. If it isn't written here, it doesn't exist.

Owned by `loop-scout` (writes) and the PM (reads, and marks done). One row per task, highest priority
at the top. Reorder rows to reprioritize.

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

## Queue

| ID | Title | Status | Agent | Mode | Priority | Notes |
|---|---|---|---|---|---|---|
| T001 | Spec the Life Town Unity rebuild | `done` | planner | explore | 1 | **93/90** (83→93). Approved with overrides 2026-07-16 (D1/D11 keep, D7 defer ship). Spec + 01-decisions-resolved.md. |
| T002 | Build Economy.Core — pure-C# spine | `done` | client-dev | build | 1 | **99/90** r1. Gate green (55/55 tests). Committed a9238c2. |
| T003 | Build LifeTown.Platform — Android clock + save-file IO | `done` | client-dev | build | 1 | **99/90** r1. Gate green (81/81 tests). Committed 99db431. |
| T004 | Art design system — village + core screens | `done` | ui-ux | explore | 1 | **92/90** r1 (cohesion won; readability+delight grafted per director). Committed. |
| T005 | Art mockups — village visual direction | `dropped` | ui-ux | — | 1 | Director chose C (build in Unity). Mockup retired; building-form direction proven → carried into T006/T007. |
| T006 | Unity building asset strategy | `done` | ui-ux | explore | 1 | **93/90**. Rec: custom ProBuilder (confirms D6). Free packs rejected on identity fit. ~2wk. Doc committed. |
| T007 | One-building ProBuilder spike | `done` | client-dev | build | 1 | **93/90**. Library approved by director. Kit proven → reuse for rest. |
| T008 | Add Gym building (lightweight) | `awaiting-approval` | client-dev | — | 1 | Done via single agent ~73k (vs 540k workflow). Wide/low hall, distinct from Library. Sent to director. |

## Task file format

Every task gets `backlog/tasks/<id>.md`. ID = `T###` (zero-padded, never reused).

```markdown
---
id: T001
title: Short imperative title
status: ready
agent: client-dev        # planner | ui-ux | server-dev | client-dev | qa
mode: build              # build (implement→gate→lead scores 90→revise) | explore (N proposals→lead picks winner)
priority: 1              # 1 = highest
created: 2026-07-15
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
- 2026-07-15 created from Discord message 123456789
```

## Choosing `mode`

- **`explore`** — the solution space is wide and the output is a *document or decision*: specs, feature
  design, gamification loops, architecture choices, art direction. Runs N proposals from different
  angles in parallel and picks a winner. Safe in parallel because nothing writes files.
- **`build`** — the output is *code* and the answer is roughly known. Implements once, clears the
  mechanical gate, QA gathers evidence, then the team lead scores it against that team's rubric — and
  it revises until it clears 90.

When unsure: if you could imagine three genuinely different good answers, use `explore`.
