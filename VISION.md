# VISION — app_in_toss (project contract)

> **This is the app's own contract**, same pattern as `lifetown/VISION.md` and `touchRPG/VISION.md`.
> The engine's `VISION.md` still holds everything project-independent: the three gates, rubrics,
> boundaries, failure policy, standing rules. When app_in_toss is the **active** project, the tick
> reads BOTH files (engine first, then this).
>
> **Status: ACTIVE (created 2026-08-02).** Brand new — nothing built yet. T001 (MVP spec) is the
> first task.

## The project

| Field | Value |
|---|---|
| Name | **app_in_toss** |
| Platform | **Toss mini-app** (runs inside the Toss app, via the Apps-in-Toss SDK) — https://developers-apps-in-toss.toss.im/ |
| Stack | **React + TypeScript + Vite**, scaffolded via `npx create-ait-app`, Toss Design System (TDS) for UI. **Approved exception to the engine's standing "Unity only" rule** (director, 2026-08-02: *"React로 승인"*) — Apps-in-Toss only supports Unity for the **game** category; a utility/finance mini-app is built React/WebView, same as any non-game mini-app on this platform. |
| One-line concept | Turn real spending/saving habits into a growing town — a Fortune-City-style gamified 가계부 (household ledger), rebuilt for Toss users. |
| Target player | Toss app users who want budgeting to feel less like a chore — casual, "watch something grow" motivation (same psychological hook as Fortune City / Forest), inside an app they already use daily for money. |
| Project folder | `C:\Users\user\loop_engine\app_in_toss` (own git repo, gitignored from the engine, same shared `loopteam` remote as touchRPG/lifetown — branch `app_in_toss`) |
| Director's brief (verbatim, 2026-08-02) | *"이 프로젝트의 목표는 포춘시티 앱을 토스에 맞게 변경하여 토스 사용자들을 위한 가계부 앱을 만드는거야."* — take the Fortune City app, adapt it to fit Toss, to make a household-ledger app for Toss users. |
| Reference | **Fortune City** — a real budgeting app whose core loop rewards tracked spending/saving with city-building progress. This is the mechanic to study and adapt, not a UI to skin. `planner` should research the actual app (App Store/Play Store listings, reviews describing the loop) before writing the spec — not invent a generic "collect stuff" loop and call it Fortune City. |
| Accounts / credentials | **Not yet provided.** Director: *"계정이랑 필요한 것들은 추후에 추가할게"* (business registration, Apps-in-Toss console access, TDS/SDK keys — later). The MVP must be buildable and demoable via local dev (`vite`) without a live Toss account or console access. Do not block spec or build work on this. |
| Scope | **TBD — T001's job.** Not yet decided: which SDK capabilities the MVP actually uses (payments/storage/analytics are all available per the dev docs, but none are required for a first loop), whether real bank-linked data is in scope at all for MVP (likely not, given no accounts yet — manual entry first). |
| Completion | **The 5-expert playtest gate (§3.3 of the engine VISION.md)** — same panel used for Life Town, since this is still a gamified habit-loop app, just about money instead of time. |

## Stack notes (read before assigning any build task)

- **`client-dev` builds this in React/TypeScript, not Unity/C#.** No agent file changes were needed —
  `client-dev`'s tools (Bash, PowerShell, WebSearch, WebFetch, etc.) already cover `npm`/`npx` work; only
  the task briefs need to say "this project is React, not Unity."
- **Gate 1 (mechanical) has no script yet.** `gate/gate.ps1` is Unity-only (checks `Assets/` +
  `ProjectSettings/ProjectVersion.txt`, invokes `Unity.exe`) and `quality-loop.js` currently hardcodes
  its path. **Before any `build`-mode task runs**, someone (PM) must either write a Node/React
  equivalent gate script (npm install, `tsc --noEmit`, `vite build`, tests if any — same JSON/exit-code
  contract as `gate.ps1`) and wire it into `quality-loop.js` as a parameter, or the workflow needs a
  `gateScript` arg added. T001 is `explore` mode and does not touch this gate at all — this only blocks
  T002 onward. **Do not let a future tick discover this the hard way mid-round.**
- **`npx create-ait-app` scaffolding is interactive** (package manager, template, TDS y/n, AI-skill
  choice, example code) with no documented non-interactive flags. The first build task must run it
  directly (not assume a blind piped-answer script works) and report exactly what it chose.
- **Rubric adaptation proposed, needs director approval** (engine `VISION.md` §4: rubric changes are
  not free). The generic `client-dev` rubric (§3.2) has a Unity-specific criterion:

  | # | Criterion (generic) | For this project, read as |
  |---|---|---|
  | C3 | Unity structure — single-responsibility MonoBehaviours, data in ScriptableObjects | React/TS structure — component decomposition, hooks correctness, state colocation (no prop-drilling sprawl), idiomatic TDS usage |
  | C4 | Performance — Update abuse, GC allocation, draw calls | Performance — unnecessary re-renders, bundle bloat, blocking the main thread |

  C1 (spec satisfied), C2 (correctness), C5 (no regression) apply unchanged. **Approved by the
  director 2026-08-02** (Discord, msg 1533234064742551795, item 4) — safe to score build-mode tasks
  against this substitution.

## Change log
- 2026-08-02 Created. Stack (React/TS/Vite/TDS via `create-ait-app`) approved by the director as an
  exception to the engine's Unity-only rule. T001 opened for `planner` (explore mode, MVP spec).
- 2026-08-02 **T001 passed 90/100** (기획팀장, 2 rounds). Spec at `docs/spec/MVP-SPEC.md`.
- 2026-08-02 **Director answered 4 of 16 open decisions** (Discord): app name stays a temporary
  placeholder ("우리동네 가계부", D-1); art style must stay clearly clear of plagiarism/trademark risk,
  not near-identical to Fortune City (D-12); monetization deferred, not in MVP (D-7); React rubric
  substitution approved (D-9, see above). The other 12 decisions were not addressed — proceeding on
  the spec's own marked assumptions until told otherwise. T001 → `done`. T002 (scaffold + first
  vertical slice) is next, blocked only on writing the Node/React mechanical gate first.
