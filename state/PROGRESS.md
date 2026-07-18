# PROGRESS — the loop's cockpit

> Only what the next tick needs to choose its next action. Bulk history lives in `state/journal.md`.

## Current State
- **Status**: ▶ Active (in-session, director-directed) — engine/state updated 2026-07-18. `loop.json`
  still carries `paused: true` from the 2026-07-17 stop; this session's work was done directly at the
  director's request, not via the autonomous `/tick` loop. Resume the autonomous loop with
  `paused=false` + `/tick` whenever desired.
- **Project**: **touchRPG** — touch-first online hunting action + persistent growth (**not** an MMORPG).
  Portrait fixed. Party 1-4. Hunt 10-15 min. *"탭 하나로 즐기는 타이밍 패링 협동 헌팅."* Target 20-30s
  light-midcore. Refs: Monster Hunter / Vindictus + Clair Obscur (timing parry).
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
1. **P0 is feature-complete — report this to the director as the prototype** (fulfills the 2026-07-18
   standing grant). Ask what he wants next: a Gate-3-style milestone playtest of the 손맛 question
   (`VISION.md` §3.3/§6 — needs the panel/rubric + a real QA evidence pass, not automatic/free), or hold
   here for his own hands-on look first, or something else.
2. **Get director/planner confirmation on the 5 provisional numbers** in
   `touchRPG/docs/qa/P0-provisional-gameplay-numbers-REPORT.md` (monster/player HP, basic attack damage,
   P1/medium failure damage) — explained to him in plain terms 2026-07-18, awaiting his call: confirm
   as-is, replace, or defer.
3. **TBD-14/15 are new and still open** (GDD v0.4 §4.6.1/§4.6.2 — exact shield reduction % + trigger
   condition; exact range-axis mechanism + what stops 총 from structurally dodging melee patterns). Not
   blocking anything built so far — only future weapon-differentiation work.
4. **Consider resuming the autonomous loop** (`loop.json` → `paused: false` + `/tick`) now that replies
   route through Discord — see Decisions Made 2026-07-18 "Discord reply-drain gap". Without the loop's
   own tick cycle draining the inbox, a Discord reply only gets processed when the director happens to
   prompt again in-session; this already caused two missed-reply false alarms in one day (2026-07-18).

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
1. **T004 is running** (`wf_260a794c-fa2`) — per the director's 2026-07-18 standing grant ("프로토타입이
   나올 때까지 내 허락없이 진행해줘" — `VISION.md` §4), when it lands: score it, fix any real gate-lead
   findings via the frugal path (as T002/T003 did), commit+push, and **do not pause to ask "continue?"**
   — that checkpoint is waived until P0 is playable. Report the result to the director regardless.
2. **If T004 completes P0** (likely — it's the last known P0 task): that IS the prototype the grant was
   for. Report it plainly, and only then ask what's next (e.g. a Gate-3 milestone playtest) — the grant
   covers chaining *to* the prototype, not deciding what happens *after* it.
3. **If a task comes back `escalate: true`** (5-round limit / score flat ±2 over 3 rounds / grader
   refused): **do not mark it done**. Push it to `blocked`, add to Needs Human Review + `loop.json`
   `escalations`, and tell the director plainly (channel per §7 rule 8) that it is unfinished, with the
   score history (`VISION.md` §5). A silently-shipped rejection is the Ralph Wiggum Loop — the standing
   grant to skip "continue?" checkpoints does not waive this.
4. **If it fails without `escalate`** (infrastructure): leave it `ready`, record the cause in
   **Do Not Repeat**, journal it, don't loop on it.
5. **Gate 3 (5-expert playtest) is still NOT automatic** even under the standing grant — it runs when a
   meaningful slice is playable AND the director wants it run; five experts × five rounds is real cost
   (`VISION.md` §6).
6. Commit the engine repo on any `state/`/`backlog/` change; push touchRPG/lifetown to their own remote
   branch (see Open Items) after any commit there.

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
  prototype — report it and stop inventing further work under this grant.

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
