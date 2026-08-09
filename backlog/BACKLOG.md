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

| ID | Title | Status | Agent | Mode | Priority |
|---|---|---|---|---|---|
| T001 | app_in_toss MVP spec — Fortune-City-style gamified ledger for Toss | done | planner | explore | 1 |
| T002 | app_in_toss scaffold + foundational plumbing (no UI yet) | done | client-dev | build | 1 |
| T003 | app_in_toss first vertical slice — town view + entry sheet | done | client-dev | build | 1 |
| T004 | app_in_toss retention layer — slots, streak, tier, queue, no-spend day | done | client-dev | build | 1 |
| T005 | app_in_toss spec addendum — savings buildings + road layout | done | planner | explore | 1 |
| T006 | app_in_toss road-based village layout (ADDENDUM-01 §3) | done | client-dev | build | 1 |
| T007 | app_in_toss — buildings need to read as houses, not squares | done | client-dev | build | 1 |
| T008 | app_in_toss spec addendum — player-controlled building placement | done | planner | explore | 1 |
| T009 | app_in_toss random building placement (ADDENDUM-02, part a) | done | client-dev | build | 1 |
| T010 | app_in_toss long-press move UI (ADDENDUM-02, part b) | done | client-dev | build | 1 |
| T011 | app_in_toss savings buildings (ADDENDUM-01 §2) | done | client-dev | build | 1 |
| T012 | app_in_toss 기록 (history) screen + edit/delete (F8, F9, S3, S5) | done | client-dev | build | 1 |
| T013 | app_in_toss town mood (F6) + settings sheet (S6) | done | client-dev | build | 1 |
| T014 | app_in_toss JSON export / import (F12) | done | client-dev | build | 1 |
| T015 | app_in_toss — two known follow-up bugs (dialog backdrop, month-nav flash) | done | client-dev | build | 1 |
| T016 | app_in_toss — balance pass (director-approved values, flip BALANCE_UNSET) | done | client-dev | build | 1 |
| T017 | app_in_toss — harden EntrySheet backdrop fix (fix-forward round 2) | done | client-dev | build | 1 |
| T018 | app_in_toss spec addendum — monetization (ads, paid extra builds, decoration shop) | awaiting-approval | planner | explore | 1 |
| T019 | app_in_toss — Gate 3 findings worked back (verified S1 WIP + director scope decisions) | done | client-dev | build | 1 |
| T020 | app_in_toss — building EXP (grow an existing building instead of always sprawling) | done | client-dev | build | 1 |
| T021 | app_in_toss — amount-proportional building EXP (all types) + F16 monthly settlement/monuments | done | client-dev | build | 1 |
| T022 | app_in_toss — monument chronological placement behind off-by-default flag; drop overspend penalty | done | client-dev | build | 1 |

_T001-T018 done. **Gate 3 hard-failed on its first run (T019, avg 64.4/100)** — root cause: MVP-SPEC
step 5 (F16 settlement/monuments, S1 onboarding, F17 memo chips) was never built, plus design gaps
(reward decoupled from money; overspend had no consequence). **T019-T022 worked this back** with the
director's 2026-08-09 in-session decisions (recorded in
`app_in_toss/docs/spec/ADDENDUM-04-building-exp.md`): finding #1 → T021 amount-proportional EXP (a big
entry founds a higher-level building); finding #3 → S1 onboarding built + verified (WIP `7ed237d`
verified as T019, commit `ab0f461`); finding #4 → F16 settlement/monuments built (T021); finding #5
(blocking tier modal) → rebuilt as a non-blocking auto-dismiss banner. Finding #2 (overspend penalty)
**excluded by director decision** (T022). F17 stays cut. All on the `app_in_toss` branch, Gate 1 green
(vitest 493/493, tsc/lint/build clean), pushed. **Remaining: the Gate 3 re-run** (5-expert playtest,
the real MVP-completion gate) has not run since the 64.4 fail — that is the next milestone gate.
T018 (monetization spec, 94/100) remains `awaiting-approval`._

_touchRPG and Life Town remain paused; their full backlogs are archived at
`<app>/docs/paused-state/backlog/`. Restore the relevant archive here when either resumes._

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
