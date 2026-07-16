# Director Decisions — Resolved (2026-07-16)

This file records the director's answers to the 11 open decisions in `00-mvp-spec.md` §12, and — where an
answer overrides the winning spec's own recommendation — what that changes. **Where this file and
`00-mvp-spec.md` disagree, THIS file wins.** It is the newer director record.

Source: Discord message 1527210387135528991 (16:08) + PM clarification 2026-07-16.

## The answers

| D | Question | Spec's recommendation | Director's decision | Overrides the spec? |
|---|---|---|---|---|
| D1 | Cut accounts/cloud sync from MVP? | Cut (local-first + export) | **Keep it.** Accounts + cloud sync stay in scope. | **Yes** — spec recommended cutting. |
| D5 | Tier1 EXP curve | Ship `[0,60,240,720,2000]` (his 07-10 value) | **Accepted the planner's proposal** → `[0,60,240,720,2000]`. | No — adopts the recommendation. |
| D7 | Play Console account: personal vs org | Decide now; it is the critical path | **Defer registration.** No store target for now — **build only** ("일단 만들기만"). | **Yes** — spec made shipping week-1. |
| D9 | Leisure reward multiplier | Keep ×1.0 (leisure = growth) | **Accepted** → ×1.0. Game 3h and reading 3h pay identically. | No — adopts the recommendation. |
| D11 | Cut landmarks from MVP? | Cut (25h grind, no tester reaches it) | **Keep them.** Landmarks stay in scope. | **Yes** — spec recommended cutting. |

D2, D3, D4, D6, D8, D10 were not addressed → they proceed on the spec's defaults (presence rule (a),
Korean-only, cumulative days-recorded, in-house geometric art, the no-social-before-server boundary,
timed construction in). An unanswered decision keeps its default; it is not re-opened.

## What this changes about the spec

The 93-point spec won on a **ship-first thesis**: the binding constraint is contact with a real player,
so cut hard and ship in week 1. The director has chosen the opposite trade on three of the five: **do not
rush to ship, and keep the two heavy features the spec cut.** This is a legitimate override — the thesis
was the planner's argument, not a locked fact — and the director's choices are internally coherent:

- **D7 (no ship) dissolves the objections behind D1 and D11.** The spec cut cloud sync partly because
  "12 testers can tolerate device loss," and cut landmarks because "no one reaches 25h in a 14-day
  test." With no 14-day test and no 12-tester window, both objections are moot. Keeping both is
  consistent with a longer build-first approach.
- **Completion is now Gate 3, not a store install.** The spec's "done = a stranger installed it and
  logged a session" is withdrawn with D7. Done is now the loop's standing definition: **the 5-expert
  playtest panel at avg ≥ 90 with an 80 floor** (`VISION.md` §3.3). QA drives a real build; there is no
  store dependency.

**What survives unchanged** (the spec is still the foundation for all of it): the core loop (§4), the 7
MVP screens (§8) plus whatever cloud/landmark screens D1/D11 re-add, the data structures (§9), the
integrity position and the monotonic clock design (§5, §7.3), and the Unity technical baseline (§7.5).

**What grows**: scope is now larger than the 93-point spec proposed. Cloud sync (~3 weeks per the spec's
own estimate) and landmarks (unique art + a prosperity-buff system) are additive. The spec's 8-9 week
timeline was for the cut scope and no longer applies; a new estimate follows once the build tasks are
laid out. This is stated plainly rather than buried.

## Build sequencing (PM decision, following from the above)

Build the **decision-stable spine first** — the parts no decision changed — so work starts immediately
without waiting on a scope re-plan:

1. `Economy.Core` (pure C# assembly, no `UnityEngine`) with the **D5 curve baked in** and **D9 ×1.0**.
   Fully unit-testable → the mechanical gate can prove it. This is the ideal first build.
2. The monotonic-clock seam (§7.3) — load-bearing for integrity, testable headless.
3. Timer + session commit on top of those.

Cloud sync (D1) and landmarks (D11) are **additive** and do not block the spine — they become their own
later tasks. The core loop does not depend on either.
