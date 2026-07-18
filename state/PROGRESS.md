# PROGRESS — the loop's cockpit

> Only what the next tick needs to choose its next action. Bulk history lives in `state/journal.md`.

## Current State
- **Status**: ▶ Active (in-session, director-directed). **Current focus: ENGINE IMPROVEMENT** —
  director's instruction 2026-07-19: *"touchRPG도 이쯤에서 마무리해줘. 우리 루프 엔지니어링 팀의
  고도화가 먼저 되어야 할 것 같아."* No app project is active; the work is the loop engine itself.
  `loop.json` still carries `paused: true`; direct in-session work, not the autonomous `/tick` loop.
- **Project**: **(none — engine work)**. touchRPG paused 2026-07-19 (see "Paused: touchRPG" below),
  Life Town paused 2026-07-17 (see its section). Both resumable.
- **Source of truth**: **GDD v0.4** → `touchRPG/docs/spec/00-gdd-v0.4.md` (v0.1/v0.2/v0.3 kept as
  history). Its §0: if code/conversation/convention conflicts with it, *the doc wins*.
- **T001 P0-A parry core**: **DONE** — Gate 1 green (compile 0 errors, EditMode 19/19), **Gate 2 =
  97/100** (클라이언트팀장), scored 2026-07-18 against fresh QA evidence (rendered-pixel captures,
  PlayMode tests with graphics enabled, a live config-edit demonstration). Minor deductions (−3, C2):
  mobile touch-dispatch path and the auto-miss-on-timeout path were never directly exercised — noted as
  hardening for later, not a blocker. **TBD discipline called exemplary**: TBD-1/TBD-2 externalized +
  labeled; 5 additional gameplay-affecting numbers absent from the GDD entirely (monster/player HP,
  basic attack damage, P1/medium failure damage) were surfaced as open questions in
  `touchRPG/docs/qa/P0-provisional-gameplay-numbers-REPORT.md` rather than invented — **still awaiting
  director/planner confirmation.**
- **T002 P0-B — remaining input + 람팡 P2-P7**: **DONE** — Gate 1 green (compile 0, EditMode 30/30,
  PlayMode 31/31 manual), **Gate 2 = 94/100** after 2 rounds (89→94; round 1 fixed invisible gauges,
  missing P3 knockback/telegraph, hardcoded pattern-ID switch, SRP, unpooled allocation). One
  undocumented gameplay literal found in round 2 (`dissolveLead` formula, P4's counter-hit risk window)
  — fixed separately as a frugal follow-up (externalized + documented, no re-score needed since no
  observable behavior changed). Two minor deductions left as noted hardening, not blockers (see
  `backlog/tasks/T002.md` log).
- **T003 P0-C — 3-phase session + solo run to completion**: **DONE** — Gate 1 green (compile 0, EditMode
  50/50, PlayMode 39/39 manual), **Gate 2 = 90/100** (1 round, exactly at the bar). Real HP-driven phase
  transitions, phase-gated weighted pattern selection, guaranteed groggy rush per phase (forced injection
  + pity counter), clean hunt-complete/restart. One MUST violation found (balance weights hardcoded in
  code, not externalized) — fixed separately as a frugal follow-up (moved to a new `PhasePatternWeights`
  ScriptableObject, values unchanged, no re-score needed). **P0's core loop is now solo-completable
  start to finish** — the precondition GDD §10's 손맛 question needs.
- **T004 P0-D — combat UI §6.1-6.2 completion**: **DONE** — Gate 1 green (compile 0, EditMode 50/50,
  PlayMode 44/44 manual), **Gate 2 = 97/100** (1 round). Relay marker got its own §6.2 visual (red ring +
  sequence badge + opaque/pulse/haptic triple signal) + a relay-success light beam; two real rendering
  bugs found and fixed while verifying with actual screenshots. Audit confirmed no other §6.2 drift.
  Minor deductions (presentation-only, not gameplay-affecting — left as noted hardening, not fixed).
  **🎉 P0 IS FEATURE-COMPLETE** — all four tasks (T001 97, T002 94, T003 90, T004 97) done. This is the
  prototype the director's 2026-07-18 standing grant was building toward.
- **Security finding, investigated and closed (2026-07-19)**: a QA subagent `rm -rf`'d a stray untracked
  `touchRPG/touchRPG/` directory without being told to. Independently verified (not just trusting the
  subagent) — genuinely a duplicate log dir from a `gate/gate.ps1` bug (relative `-AppDir` caused Unity
  to nest `-logFile`/`-testResults` output one level too deep), nothing real was lost. **Fixed the root
  cause**: `gate.ps1` now resolves `$AppDir` to an absolute path immediately; reproduced and confirmed
  fixed. **Fixed the process gap**: added a `VISION.md` §4 "Never" rule — agents must not delete
  anything they didn't create in-task, even obvious-looking garbage; report it to the PM instead.
  `qa.md`/`client-dev.md` now point at this rule.
- **Figma MCP connected** (2026-07-19, director-requested for the art team): verified via `whoami` —
  director's own account, team "Avaritia" (`planKey: team::1054599000081459261`, Starter tier, ~6 MCP
  read calls/month). Recorded in `ui-ux.md` so the art team doesn't need to rediscover it. No touchRPG
  Figma file created yet — none of P0's UI needed real design-tool work (client-dev built it directly
  with placeholder primitives); create one when an actual ui-ux task needs it.
- **Team/system**: unchanged by director's instruction — same agents, same three gates, same rubrics
  (`VISION.md` §3.2), same expert panel (§3.3), same boundaries/failure policy (§4/§5).
- **Last updated**: 2026-07-19 (in-session)

## ▶ Next, in this order
1. **Engine improvement is the mission now** (director, 2026-07-19). Direction not yet specified —
   propose candidates and get his pick. Known engine gaps worth proposing: (a) `gate.ps1` runs only
   EditMode tests, PlayMode is manual (Do Not Repeat); (b) the Discord reply-drain gap — replies sit
   unread while the loop is paused (Open Items); (c) Gate 3 experts score QA evidence, not real play —
   an emulator-driven playtest (AVD Pixel_9 exists) could strengthen it; (d) build/delivery automation
   (APK path was hand-rolled 2026-07-19). Do NOT start any of these without his direction.
2. **When touchRPG resumes**: see "Paused: touchRPG" below — open items (Gate 3 not yet run, 5
   provisional numbers unconfirmed, TBD-14/15 open) are recorded there.

## Last Run
- **Date**: 2026-07-17 22:00 (Tick 49)
- **Summary**: GDD ingested and made the source of truth; Unity project created; `VISION.md` §2 rewritten
  (pillars, P0 scope, GDD §0 decision-authority + §11 non-goals, numbers-externalized MUST, TBD rule as
  a gate); T001 opened + dispatched via the full quality-loop. Then the director added the channel rule
  (in-session ⇒ no Discord mirroring), recorded in `VISION.md` §7 rule 8 + `CLAUDE.md`.
- **Output**: touchRPG Unity project + GDD in `docs/spec/`; T001 running; contract updated.

## Locked by the director 2026-07-17 (GDD v0.3 — do not re-open without him)
- **No active skills at all.** Growth is passive-centric. Chosen to *remove* the P-2 collision rather
  than compromise it: activatable skills need a trigger input, and §4.1/§6.3 forbid new buttons.
  **In-combat input remains exactly §4.1 — nothing else.**
- **Passive cards = 장식주 socketed into the 탈리스만 slots** (MH gear→decoration structure). Not a new
  growth axis — §8.1's 60/30/10 stands unchanged. Set in the pre-hunt 대기실; **locked at hunt start**.
- **Weapons = 3**: 총(원거리) / 창(중거리) / 검과 방패(근접) — they split the engagement-distance axis
  cleanly (대검 dropped; it overlapped 검과 방패). **Judgment windows ±0.15/±0.35 are weapon-common —
  per-weapon judgment is MUST NOT.** Weapons differ by rhythm/speed, distance, part-break affinity, and
  (v0.4) **검과 방패 gets damage reduction on a timed defense** — exact % is TBD-14, not decided.
- **A weapon that structurally dodges patterns is as wrong as one that out-damages them** (§4.6 MUST) —
  still the live constraint on 총; the range axis is confirmed (v0.4) but the mechanism that enforces
  this MUST is TBD-15, not decided. **Do not add distance behavior to any §7 pattern sheet before it is.**

## The rules this project lives or dies by (re-read before briefing any agent)
1. **The GDD wins.** `touchRPG/docs/spec/00-gdd-v0.4.md`. This cockpit and `VISION.md` §2 are pointers,
   not replacements.
2. **The 9 live TBDs (GDD §13) MUST NOT be filled in by the team** — they are deliberately the
   director's. Live: TBD-1..7, **14** (shield's exact reduction % + trigger), **15** (range axis's exact
   mechanism). TBD-8/9/10 resolved 2026-07-17; TBD-11/12/13 resolved 2026-07-18 (their leftover specifics
   became TBD-14/15).
   The GDD names its most-guarded failure mode in its own words: *"그럴듯한 보간(hallucinated design)"*.
   That is our **Nodding Loop** by another name. An agent that invents a TBD has failed the task
   however good the result looks. Combo cap / damage curve stay provisional + labelled until the
   director sets them **after** the P0 playtest (his plan, §13).
3. **Gameplay constants MUST be externalized** (config/ScriptableObject), never hardcoded (GDD §0/§12).
4. **P0's question is the only question**: *"터치 패링이 손맛이 있는가."* GDD §10 forbids starting P1
   (party, talismans, daily loop) before it is answered. Do not broaden scope.
5. **Director approval required** for: input vocabulary, judgment-window system, growth axes,
   monetization, pattern classification, screen orientation, anything on the §11 non-goal list.

## Open Items
- **Director confirmation still needed** on the 5 provisional numbers in
  `touchRPG/docs/qa/P0-provisional-gameplay-numbers-REPORT.md` (explained in plain terms 2026-07-18),
  and on the new TBD-14 (shield %) / TBD-15 (range mechanism).
- **Discord reply-drain gap** (found twice 2026-07-18): with the loop paused and replies routed through
  Discord (rule 8, current), a Discord reply only gets read when the director happens to prompt again
  in-session — nothing here automatically re-checks the inbox. Two of his replies sat unread until he
  asked "리스너 꺼졌나" both times (the listener itself was fine both times). Real fix: resume the
  autonomous loop (`paused: false`), since ticks drain the inbox on their own schedule. Flagged to the
  director; his call whether/when to switch back on.
- **git remotes**: touchRPG and lifetown now both push to `origin` = the `loopteam` GitHub remote (same
  URL as the engine), each on its **own branch** (`touchrpg`, `lifetown`) rather than a separate repo —
  set up 2026-07-18 per director instruction ("브랜치를 프로젝트 이름별로 나눠서"). Engine stays on
  `main`. Push touchRPG/lifetown work with `git push origin <local-branch>:<touchrpg|lifetown>`.

## Paused: touchRPG
Paused 2026-07-19 by the director (*"touchRPG도 이쯤에서 마무리해줘"*), **not cancelled** — fully
resumable. Everything committed and pushed (`origin/touchrpg` @ a1b254e).

**State at pause**: P0 feature-complete — T001-T004 all done (Gate 2: 97/94/90/97), Gate 1 green
throughout (EditMode 50/50, PlayMode 44/44 manual). APK v0.0.1 built and delivered to
`OneDrive\바탕 화면\app build\touchRPG\` for the director's own hands-on play (his request, before
pausing). Source of truth: GDD v0.4 (`touchRPG/docs/spec/00-gdd-v0.4.md`).

**Open at pause (carry into resume, do not lose):**
1. **Gate 3 (5-expert playtest) never ran** — P0's question *"터치 패링이 손맛이 있는가"* is unanswered.
   GDD §10 forbids starting P1 before it is. The director was about to play the APK himself.
2. **5 provisional gameplay numbers unconfirmed** —
   `touchRPG/docs/qa/P0-provisional-gameplay-numbers-REPORT.md`.
3. **TBD-14/15 open** (shield's exact reduction %/trigger; range-axis mechanism). 9 live TBDs total
   (TBD-1..7, 14, 15) — team must never fill them in.
4. The "Locked by the director" section below and the GDD §0/§13 rules stay binding on resume.

## Paused: Life Town
Paused, **not cancelled** — fully resumable. Snapshot: `lifetown/docs/paused-state/` (its VISION §2, its
PROGRESS cockpit — which carries a READ-THIS-FIRST resume banner — and its backlog + task files).
Code/renders all committed in `lifetown/`. It stopped with all 7 category buildings + a polished village
v2, gate-green (81/81).

**Its open question was already answered** (2026-07-17 17:56, arrived just before the project switch):
the director replied *"실제 게임 동작 진행해줘"* → **village v2 accepted; next task = real gameplay**
(tap building → timer → growth/build; wire Economy.Core T002 + Platform T003 + design system T004 into
the village scene) → playable slice → Gate 3. **Do not re-ask polish-vs-gameplay on resume.**
See `VISION.md` §2 → "Paused project" and `state/journal.md` for full history.

## Blockers
- None.

## Needs Human Review
- None.

## Next Run Should
1. **Wait for the director's pick on engine-improvement direction** (candidates proposed 2026-07-19 —
   see "▶ Next"). Do not start speculative engine work; the 2026-07-18 standing grant was scoped to
   the P0 prototype and is **fulfilled/expired** — it does not cover engine work.
2. Commit the engine repo on any `state/`/`backlog/` change; app repos push to their own remote branch
   (see Open Items) if ever touched.

## Decisions Made
- 2026-07-17 — **Channel rule (director)**: *"내가 vs코드로 대화하면 디스코드로는 보내지 말아줘."*
  In-session (VS Code) conversation is answered **in-session only — never mirrored to Discord**.
  Discord is the **async** channel: it carries what happens while he is away, which is what makes the
  unattended loop work. Judge by where he last spoke. Recorded in `VISION.md` §7 rule 8 + `CLAUDE.md`.
  **Still drain the Discord inbox every tick**, including in-session ticks (a real message was skipped
  this way on 2026-07-17).
- 2026-07-17 — **Project switch**: Life Town paused (resumable), touchRPG begins. Team + system carry
  over unchanged (director). Each app keeps its own folder + git repo, gitignored from the engine.
- 2026-07-17 — **Token economy (director, repeated 3x)**: default to the **frugal path** for
  proven-pattern work — one subagent + the mechanical gate + a PM visual check + honest disclosure to
  the director — and reserve full quality-loop workflows for genuinely novel/risky work. Proven on
  Life Town: 5 buildings in one fresh-agent run cost 200k vs 442k for a single building via a heavy
  resumed agent.
- 2026-07-17 — **Don't spend big speculatively**: when a large, direction-heavy build has been teed up
  as a question to the director, wait for the answer rather than pre-build it.
- 2026-07-18 — **Git branch-per-project** (director): touchRPG and lifetown push to the same `loopteam`
  remote as the engine, each on its own branch (`touchrpg`, `lifetown`) rather than separate GitHub
  repos, since no separate remotes exist yet. Engine stays `main`.
- 2026-07-18 — **Channel rule superseded** (director, in-session): *"지금부터 답변은 디스코드로 해줘."*
  All reports now go to Discord, even in-session — see `VISION.md` §7 rule 8 for the current wording.
  The 2026-07-17 "in-session ⇒ never Discord" default is dormant, not deleted.
- 2026-07-18 — **Standing grant — proceed to a prototype without approval** (director, in-session):
  *"프로토타입이 나올 때까지 내 허락없이 진행해줘."* Chain remaining P0 tasks without pausing for an
  inter-task "continue?" checkpoint (`VISION.md` §4). Scope: only removes that one checkpoint — still no
  finalizing designs, no stack/monetization/rubric changes, still report every score/fix honestly, and
  Gate 3 (5-expert playtest) is still not automatic. Once P0 is feature-complete, that **is** the
  prototype — report it and stop inventing further work under this grant. **FULFILLED/EXPIRED
  2026-07-19** — P0 completed (T004), the grant does not carry over to engine work or anything else.
- 2026-07-19 — **touchRPG paused; engine improvement first** (director, in-session): *"touchRPG도
  이쯤에서 마무리해줘. 우리 루프 엔지니어링 팀의 고도화가 먼저 되어야 할 것 같아."* touchRPG wrapped
  cleanly (see "Paused: touchRPG"); the team's work is now the loop engine itself. Direction within
  that not yet specified — candidates proposed, awaiting his pick.

## Do Not Repeat
(engine-level; still binding across projects)
- A workflow's `meta` must be a **pure literal** (even `'a' + 'b'` is rejected). A broken meta makes the
  workflow **invisible** — `Workflow({name:'x'})` then reports "not found", which looks like a discovery
  problem but is a parse error. Diagnose meta first; call by `scriptPath`, which fails loudly.
- `args` arrives as a **JSON string**, not an object. Our scripts coerce it — don't "fix" that away.
- Unity can **exit 0 with compile errors** — `gate/gate.ps1` also scans the editor log for `error CS####`.
  Never trust the exit code alone. Never leave an editor holding the project lock (use `-quit`).
- **`gate/gate.ps1` only runs EditMode tests, not PlayMode** (found 2026-07-18 during T001's Gate 2 —
  touchRPG's `Assets/Tests/PlayMode/*` compiled fine but the gate never executed them; QA had to run
  PlayMode manually). Not yet fixed. Any task adding PlayMode tests must verify them manually (QA
  evidence step) until the gate itself is extended to cover both platforms.
- **PlayMode batchmode: `-runTests -testPlatform PlayMode` combined with `-quit` races and silently
  produces zero tests** (found 2026-07-18, T002's QA evidence pass — exit 0, no TestRunner activity, no
  results XML; Unity's own auto-quit-when-done raced the explicit `-quit` and won). Same class of trap
  already known for EditMode (`gate.ps1`'s own comment: `-runTests` must not be combined with `-quit`) —
  confirmed to also apply to PlayMode. Drop `-quit` when running PlayMode tests manually.
- **Never `git add` from the home folder** (`C:\Users\user`) — it is an accidental git repo and would
  swallow the whole home directory.
- ✅ **FIXED 2026-07-19**: `gate.ps1` with a relative `-AppDir` caused Unity to nest `-logFile`/
  `-testResults` output one level too deep (`<AppDir>\<AppDir>\Logs\...`), since Unity resolves its own
  relative log-path args against the project dir it just switched into, not the launcher's cwd. This led
  a QA subagent to `rm -rf` the resulting stray folder on its own judgment (investigated, confirmed
  harmless — just duplicate logs — but the unauthorized delete itself was the real problem). Fixed by
  resolving `$AppDir` to an absolute path immediately in `gate.ps1`. Also added a hard rule (`VISION.md`
  §4 "Never"): agents must never delete anything they didn't create in-task, even obvious-looking
  garbage — report it to the PM instead.
- Discord resource-scoped routes 403 with `{"code":40333}` unless a real `User-Agent` is sent — every
  `.discord` script already does this.
