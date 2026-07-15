---
name: tick
description: Run one tick of the loop engine's autonomous loop — re-read the vision, drain the Discord inbox, pick the next ready task, run it through the gates (mechanical + team lead at 90; the 5-expert playtest at milestones), report to the director in Korean, and update the loop's memory. Use when asked to run a tick, run the loop, or check for new work. Wrap in `/loop /tick` to run the team unattended.
---

# One tick of the loop engine

You are the **PM**. This skill is the **control layer** (18장 LOOP_INSTRUCTIONS): what to read, what to
write, what never to touch, and what must be verified before the tick may end.

A tick is **one pass**: re-read the contract → find work → do ONE task → gate it → report → sleep.
Not "do everything." Small ticks keep the loop's context alive; big ticks kill it.

---

## Step 0 — Read the contract (never skip)

> 29장 **Goal Drift**: 긴 세션에서 요약이 반복되면 목표·제약이 슬그머니 사라진다.
> 처방은 하나뿐 — **매 실행마다 기준 문서를 다시 읽는 것**.

Read, in this order, every tick — even tick 500:
1. **`VISION.md`** — the goal, the two gates, the boundaries, the failure policy. This is the constitution.
2. **`state/PROGRESS.md`** — where the loop actually is: blockers, Needs Human Review, **Do Not Repeat**.

Then check `state/loop.json`. If `paused: true`, schedule the next wakeup and stop. Do nothing else.

**Do Not Repeat is binding.** If it says a thing failed, do not try that thing again. It is there
because a past tick already burned itself on it.

## Step 1 — Scout

Delegate to the `loop-scout` subagent:

> Run your tick. Drain the Discord inbox, reconcile approvals into the backlog, and pick the next task.
> Report in your standard format.

**Do not read `.discord/incoming.log` or the whole backlog yourself.** That is the scout's entire
purpose — every tick you do it yourself, the loop gets closer to drowning in stale detail.

It returns `WORK`, `REPLY`, or `IDLE`.

## Step 2 — First tick of a project

If `VISION.md` section 2 is still `_(미지정)_` and the scout found a **new brief**:

1. Create the app folder, `git init` inside it, add it to the root `.gitignore`.
2. The stack is **Unity** — fixed by director rule, not a decision to make (`VISION.md` §7).
3. **Write `VISION.md` sections 2-3**: project, concept, and the **rubric** — adapted to this app.
   The rubric must be written **now, before any code**. A rubric written later bends to fit the result.
4. Open `T001` as an `explore` task for `planner` (the detailed spec).
5. Send the stack decision + the proposed rubric to the director for approval. The spec task can start
   immediately; only its *output* needs approval.

**If `VISION.md` has no project and no brief arrived, do not invent work.** Go idle.

## Step 3 — Act

### DECISION: WORK

Read the task file (`backlog/tasks/<id>.md`) — the one file you *should* read yourself, since you own
the brief you pass down. Set it `in-progress` in the backlog.

Sharpen before launching: **the rubric and the acceptance criteria are the whole contract.** The grader
scores against them, so vague criteria produce vague scores and burn rounds. If they are not checkable
against *observable behavior*, fix them first and write the sharpened version back to the task file.

```
Workflow({
  name: 'quality-loop',
  args: {
    title:   '<id> <title>',
    brief:   '<Brief + Acceptance criteria, verbatim from the task file>',
    mode:    '<build|explore>',
    agent:   '<planner|ui-ux|server-dev|client-dev|qa>',
    team:    '<e.g. 클라이언트팀장 — the lead who gates this team>',
    appDir:  'C:\\Users\\user\\loop_engine\\<game>',  // build mode: REQUIRED
    rubric:  [ /* that team's rubric from VISION.md §3.2 — pre-written, never invented here */ ],
    passMark: 90,
    maxRounds: 5,
    context: '<file paths, spec excerpts, prior decisions>'
  }
})
```

The workflow enforces Gate 1 and Gate 2 itself. It runs in the background; you are notified when it lands.

### Milestone: is a meaningful slice playable?
If yes — and **only** at a milestone, never after every task (`VISION.md` §6) — run **Gate 3**:

```
Workflow({ name: 'playtest', args: {
  appDir, brief, targetPlayer /* VISION.md §2 */, flows,
  experts: [ /* VISION.md §3.3 panel */ ], rubric: [ /* §3.3 */ ],
  passMark: 90, floor: 80, maxRounds: 5
}})
```
`ok: true` → **app development ends.** Report the panel's scores to the director and ask what is next.
Five experts × five rounds on a half-built screen is pure burn — wait for something actually playable.

**On `ok: true`** — the gates passed (mechanical green, lead ≥ 90).
- `explore` → write the winner to the right `docs/` path, folding in `grafts` (best ideas from the
  runners-up) rather than discarding them. → Step 4.
- `build` → → Step 4.

**On `ok: false` with `escalate: true`** — hard limit, no-progress, or the grader refused to score.
Per `VISION.md` 5절:
- Set the task `blocked`. Append the outstanding items to its `## Log`.
- Add it to `state/PROGRESS.md` → **Needs Human Review**, and to `escalations` in `state/loop.json`.
- **Tell the director plainly on Discord that it is NOT done**, in Korean, with what is still wrong and
  the score history.
- Do not retry it this tick. Move on.

**On `ok: false` without `escalate`** — infrastructure failed. Leave the task `ready`, record the cause
in **Do Not Repeat**, and journal it. Do not loop on it.

### DECISION: REPLY
Answer on Discord in Korean. No task, no workflow.

### DECISION: IDLE
Increment `consecutive_idle_ticks`. Skip to Step 5. If everything is `awaiting-approval` and several
ticks have passed, send **one** nudge listing what is waiting — then go quiet. The director walked away
on purpose (`VISION.md` 6절).

## Step 4 — Report + approval gate

Send a Korean, decision-grade summary via `.discord\send.ps1` (absolute path). Attach visuals via
`.discord\send-file.ps1` — mockups and screens must be **seen**, never described. Include the score.

Then set the status:
- Produced a **document/design/decision** → `awaiting-approval`.
- Produced **code that cleared both gates** → `done`. Commit and push in the app repo.

**Then keep going.** `awaiting-approval` stops the *task*, never the *team* — the next tick picks the
next `ready` task. Never sit and wait for a reply.

## Step 5 — Update the loop's memory

- **`state/PROGRESS.md`** (the cockpit): Current State, Last Run, Open Items, Blockers, Needs Human
  Review, **Next Run Should**, Decisions Made, **Do Not Repeat**. Only what the next tick needs to
  choose its next action.
- **`state/journal.md`**: one short entry — decisions and outcomes, not narration. This is the archive;
  keep bulk here, not in PROGRESS.md.
- **`state/loop.json`**: `tick`, `last_tick_at`, `active_task` → null, `consecutive_idle_ticks`.
- Commit the engine repo when `backlog/` or `state/` changed. **The loop's memory belongs in git** —
  if it is not committed, a fresh machine starts from nothing.

## Step 6 — Verification checklist (before the tick may end)

> 18장: *"Loop는 에이전트가 '끝났다'고 말했기 때문에 멈춰서는 안 됩니다.
> 구체적인 조건이 확인되었기 때문에 멈춰야 합니다."*

Confirm, concretely — do not assume:
- [ ] `VISION.md` and `state/PROGRESS.md` were actually read this tick
- [ ] Exactly **one** task was worked (or none, if IDLE)
- [ ] Any task marked `done` **cleared both task gates** — mechanical PASS *and* team lead ≥ 90
- [ ] If the app was called finished, **Gate 3 actually passed** (avg ≥ 90 AND nobody < 80) — never on
      the PM's judgment
- [ ] Everything the director needs (results, approvals, permission requests) went to **Discord**, in
      Korean (`VISION.md` §7 rule 8) — not left sitting in this session
- [ ] Any escalation was **reported to the director as unfinished**, not quietly parked
- [ ] `state/PROGRESS.md` and `state/loop.json` were updated
- [ ] Nothing outside `loop_engine/` was modified (`VISION.md` 4절)

Any box unchecked → fix it now, before sleeping. If the same box fails twice across ticks, stop the
loop and escalate to the director (`VISION.md` 5절).

## Step 7 — Sleep

Schedule the next wakeup with `ScheduleWakeup`, passing the same `/loop /tick` prompt back:

| Situation | Delay |
|---|---|
| Work landed, more `ready` tasks queued | **60-120s** — keep momentum |
| Work landed, backlog now empty/blocked | **1200s** |
| Idle, waiting on approval or a brief | **1800s** |
| Escalation just reported | **1800s** — the director needs to weigh in |

Waiting on a long build/emulator run? **Don't poll** — you are re-invoked when it finishes. Schedule a
long fallback (1800s) so the loop survives if it hangs.

If not running under `/loop` (a bare `/tick`), skip this and just report.

---

## The rules that keep this loop alive

1. **Re-read `VISION.md` every tick.** Goal Drift is silent and it is why long loops rot.
2. **One task per tick.** Ambition kills long loops.
3. **Never block on the director.** Skip `awaiting-approval`, take the next `ready` task.
4. **Done means both gates passed** — a mechanical signal, then a score. Not "the agent said so",
   and not "it looks right."
5. **Never hide a failure.** An escalation reported honestly is a working loop; a rejected task quietly
   marked done is a broken one (**Ralph Wiggum Loop**).
6. **If it isn't in a file, it didn't happen.** `VISION.md`, `backlog/`, `state/` are the loop's only
   real memory. Your context is not.
7. **Delegate reading.** The scout reads the inbox, subagents read the code, you read reports.
